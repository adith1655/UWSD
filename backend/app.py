from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime, timedelta, timezone
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import asyncio
import base64
import json
import shutil
import threading
import time
import jwt
import numpy as np
import cv2

import os
import re
import tempfile
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

# ── Email alert config ────────────────────────────────────────────────────────
ALERT_EMAIL_TO   = "aakashchy018@gmail.com"
# Fill these in with a Gmail account + App Password
# (Google Account → Security → 2FA → App Passwords → generate one)
SMTP_FROM        = os.getenv("UWSD_SMTP_FROM", "")
SMTP_PASSWORD    = os.getenv("UWSD_SMTP_PASSWORD", "")
SMTP_HOST        = "smtp.gmail.com"
SMTP_PORT        = 587
_last_email_ts: dict[str, float] = {}   # type → last sent timestamp

# ── single worker so frames are processed sequentially ───────────────────────
_executor = ThreadPoolExecutor(max_workers=1)

FACES_DIR = Path(__file__).parent / "faces"
FACES_DIR.mkdir(exist_ok=True)

# ── in-memory embedding cache ─────────────────────────────────────────────────
# Each entry: {"name": str, "embedding": np.ndarray}
_face_embeddings: list[dict] = []
_embed_lock      = threading.Lock()
_deepface_ready  = False          # True once model is warm


def _cosine_dist(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 1.0
    return float(1.0 - np.dot(a, b) / denom)


def send_email_alert(alert: dict):
    """Send an email for RED alerts (rate-limited to 1 per type per 5 min)."""
    if not SMTP_FROM or not SMTP_PASSWORD:
        return   # not configured
    atype = alert.get("type", "ALERT")
    now   = time.time()
    if now - _last_email_ts.get(atype, 0) < 300:   # 5-min cooldown per type
        return
    _last_email_ts[atype] = now

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[UWSD] 🚨 {atype.replace('_', ' ')} Alert"
        msg["From"]    = SMTP_FROM
        msg["To"]      = ALERT_EMAIL_TO

        ts   = alert.get("createdAt", datetime.now().isoformat())[:19].replace("T", " ")
        html = f"""
<html><body style="font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:24px">
  <div style="max-width:480px;margin:auto;background:#1e293b;border-radius:12px;
              border:1px solid #ef444460;overflow:hidden">
    <div style="background:#ef4444;padding:12px 20px">
      <h2 style="margin:0;color:#fff;font-size:16px">⚠ UWSD Security Alert</h2>
    </div>
    <div style="padding:20px">
      <p style="margin:0 0 8px;font-size:13px;color:#94a3b8">TYPE</p>
      <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#f87171">
        {atype.replace("_"," ")}
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#94a3b8">MESSAGE</p>
      <p style="margin:0 0 16px;font-size:15px;color:#e2e8f0">{alert.get("message","")}</p>
      <p style="margin:0;font-size:12px;color:#64748b">{ts} · Manipal University Jaipur</p>
    </div>
  </div>
</body></html>"""
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.starttls()
            s.login(SMTP_FROM, SMTP_PASSWORD)
            s.sendmail(SMTP_FROM, ALERT_EMAIL_TO, msg.as_string())
    except Exception as e:
        print(f"[UWSD] Email send failed: {e}")


def reload_embeddings():
    """
    Build in-memory embedding table from every image in FACES_DIR.
    Called at startup and after every register/delete.
    """
    global _face_embeddings, _deepface_ready
    from deepface import DeepFace

    new_embeddings: list[dict] = []
    for person_dir in sorted(FACES_DIR.iterdir()):
        if not person_dir.is_dir():
            continue
        name  = person_dir.name.replace("_", " ")
        imgs  = (list(person_dir.glob("*.jpg"))
                 + list(person_dir.glob("*.jpeg"))
                 + list(person_dir.glob("*.png")))
        for img_path in imgs:
            try:
                reps = DeepFace.represent(
                    img_path=str(img_path),
                    model_name="Facenet512",
                    detector_backend="opencv",
                    enforce_detection=False,
                    align=True,
                )
                for rep in reps:
                    new_embeddings.append({
                        "name":      name,
                        "embedding": np.array(rep["embedding"], dtype=np.float32),
                    })
            except Exception:
                pass

    with _embed_lock:
        _face_embeddings = new_embeddings
    _deepface_ready = True
    print(f"[UWSD] Embeddings loaded: {len(new_embeddings)} vector(s) "
          f"for {len({e['name'] for e in new_embeddings})} person(s)")


def _match_embedding(query: np.ndarray) -> tuple[str, float, bool]:
    """Return (name, confidence, is_known) using cosine distance."""
    THRESHOLD = 0.30
    with _embed_lock:
        if not _face_embeddings:
            return "Unknown", 0.0, False
        dists = [(_cosine_dist(query, e["embedding"]), e["name"])
                 for e in _face_embeddings]
    best_dist, best_name = min(dists, key=lambda t: t[0])
    if best_dist < THRESHOLD:
        return best_name, round(1.0 - best_dist, 2), True
    return "Unknown", 0.0, False


# ── Smart visitor embedding cache ─────────────────────────────────────────────
_visitor_embeddings: list[dict] = []   # {"visitor_id", "name", "embedding", "time_start", "time_end"}
_visitor_embed_lock = threading.Lock()


def _match_visitor_embedding(query: np.ndarray) -> tuple[str | None, str | None, float, bool]:
    """
    Match a face embedding against pre-registered visitor embeddings.
    Returns (visitor_id, name, confidence, is_within_time_window).
    """
    THRESHOLD = 0.35   # slightly relaxed for selfie-vs-camera variance
    with _visitor_embed_lock:
        if not _visitor_embeddings:
            return None, None, 0.0, False
        dists = [(_cosine_dist(query, e["embedding"]), e) for e in _visitor_embeddings]
    best_dist, best = min(dists, key=lambda t: t[0])
    if best_dist < THRESHOLD:
        now_ts = datetime.now(timezone.utc)
        in_window = True
        try:
            t_start = datetime.fromisoformat(best["time_start"])
            t_end   = datetime.fromisoformat(best["time_end"])
            in_window = t_start <= now_ts <= t_end
        except Exception:
            pass
        return best["visitor_id"], best["name"], round(1.0 - best_dist, 2), in_window
    return None, None, 0.0, False


def decode_frame(b64_data: str) -> np.ndarray | None:
    if "," in b64_data:
        b64_data = b64_data.split(",", 1)[1]
    try:
        img_bytes = base64.b64decode(b64_data)
        arr       = np.frombuffer(img_bytes, np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception:
        return None


def _clear_cache():
    """Remove DeepFace .pkl caches (no longer needed but kept for safety)."""
    for pkl in FACES_DIR.rglob("*.pkl"):
        try:
            pkl.unlink()
        except Exception:
            pass


# Haar-cascade for fast face detection ────────────────────────────────────────
_haar = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)


def run_detection(frame: np.ndarray) -> list[dict]:
    """
    Fast pipeline:
      1. Resize frame to max 480 wide for detection.
      2. Haar-cascade detects face bounding boxes (very fast, CPU-only).
      3. For each face crop → DeepFace.represent (Facenet512, skip detector).
      4. Cosine match against in-memory embeddings.
    """
    from deepface import DeepFace

    # ── downscale for detection ───────────────────────────────────────────
    h_orig, w_orig = frame.shape[:2]
    scale   = min(1.0, 480 / max(w_orig, 1))
    small   = cv2.resize(frame, (int(w_orig * scale), int(h_orig * scale)))
    gray    = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    cv2.equalizeHist(gray, gray)

    faces_haar = _haar.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5,
        minSize=(40, 40), flags=cv2.CASCADE_SCALE_IMAGE,
    )

    detections: list[dict] = []

    if len(faces_haar) == 0:
        return detections

    for (fx, fy, fw, fh) in faces_haar:
        # Map back to original resolution
        x  = int(fx / scale);  y  = int(fy / scale)
        w  = int(fw / scale);  h  = int(fh / scale)

        # Expand crop slightly for better embedding quality
        pad    = int(0.15 * max(w, h))
        x1     = max(0,       x - pad)
        y1     = max(0,       y - pad)
        x2     = min(w_orig,  x + w + pad)
        y2     = min(h_orig,  y + h + pad)
        crop   = frame[y1:y2, x1:x2]

        if crop.size == 0:
            continue

        name         = "Unknown"
        match_conf   = 0.0
        is_known     = False
        det_conf     = 0.90   # Haar doesn't give per-face confidence
        visitor_match = None   # smart visitor match info

        if _deepface_ready:
            try:
                reps = DeepFace.represent(
                    img_path=crop,
                    model_name="Facenet512",
                    detector_backend="skip",      # crop is already the face
                    enforce_detection=False,
                    align=False,
                )
                if reps:
                    query = np.array(reps[0]["embedding"], dtype=np.float32)
                    # 1) Check registered hostel faces first
                    if _face_embeddings:
                        name, match_conf, is_known = _match_embedding(query)
                    # 2) If not a known resident, check visitor embeddings
                    if not is_known:
                        vid, vname, vconf, in_window = _match_visitor_embedding(query)
                        if vid:
                            visitor_match = {"visitor_id": vid, "name": vname, "confidence": vconf, "in_window": in_window}
                            name       = f"Visitor: {vname}"
                            match_conf = vconf
                            is_known   = True
            except Exception:
                pass

        detections.append({
            "bbox":           [x, y, x + w, y + h],
            "detection_conf": det_conf,
            "name":           name,
            "match_conf":     match_conf,
            "is_known":       is_known,
            "visitor_match":  visitor_match,
        })

    return detections

app = FastAPI(title="UWSD API", version="1.0.0", description="Unified Watch & Surveillance Device API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── alert broadcast subscribers ───────────────────────────────────────────────
_alert_subscribers: list[WebSocket] = []
_main_loop: asyncio.AbstractEventLoop | None = None


@app.on_event("startup")
async def startup():
    global _main_loop
    _main_loop = asyncio.get_event_loop()
    # Pre-warm DeepFace + load embeddings in background so first frame is fast
    threading.Thread(target=reload_embeddings, daemon=True).start()


async def _broadcast_alert(alert: dict):
    dead = []
    for ws in _alert_subscribers:
        try:
            await ws.send_text(json.dumps({"type": "alert", "data": alert}))
        except Exception:
            dead.append(ws)
    for ws in dead:
        _alert_subscribers.remove(ws)


def broadcast_alert_from_thread(alert: dict):
    """Called from background threads — broadcasts WS + sends email for RED."""
    if _main_loop and _main_loop.is_running():
        asyncio.run_coroutine_threadsafe(_broadcast_alert(alert), _main_loop)
    if alert.get("level") == "RED":
        threading.Thread(target=send_email_alert, args=(alert,), daemon=True).start()


@app.websocket("/ws/alerts")
async def alerts_ws(websocket: WebSocket):
    await websocket.accept()
    _alert_subscribers.append(websocket)
    try:
        while True:
            await websocket.receive_text()   # keep-alive ping from client
    except (WebSocketDisconnect, Exception):
        if websocket in _alert_subscribers:
            _alert_subscribers.remove(websocket)

SECRET_KEY = "uwsd-secret-key-2026-muj"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

security = HTTPBearer()

now = datetime.now(timezone.utc)

# ---------------------------------------------------------------------------
# In-memory data store (seeded with same data as frontend mock-data.ts)
# ---------------------------------------------------------------------------

users_db = [
    {"id": "u1",  "name": "Aarav Sharma",      "email": "aarav@muj.edu",   "password": "password", "role": "student", "room": "B-204", "photo": None, "isActive": True},
    {"id": "u2",  "name": "Priya Patel",        "email": "priya@muj.edu",   "password": "password", "role": "student", "room": "G-112", "photo": None, "isActive": True},
    {"id": "u3",  "name": "Rahul Verma",        "email": "rahul@muj.edu",   "password": "password", "role": "student", "room": "B-305", "photo": None, "isActive": True},
    {"id": "u4",  "name": "Sneha Gupta",        "email": "sneha@muj.edu",   "password": "password", "role": "student", "room": "G-208", "photo": None, "isActive": True},
    {"id": "u5",  "name": "Vikram Singh",       "email": "vikram@muj.edu",  "password": "password", "role": "guard",   "room": None,    "photo": None, "isActive": True},
    {"id": "u6",  "name": "Dr. Meera Joshi",    "email": "meera@muj.edu",   "password": "password", "role": "warden",  "room": None,    "photo": None, "isActive": True},
    {"id": "u7",  "name": "Amit Kumar",         "email": "amit@muj.edu",    "password": "password", "role": "admin",   "room": None,    "photo": None, "isActive": True},
    {"id": "u8",  "name": "Kavya Nair",         "email": "kavya@muj.edu",   "password": "password", "role": "student", "room": "G-301", "photo": None, "isActive": True},
    {"id": "u9",  "name": "Rohan Das",          "email": "rohan@muj.edu",   "password": "password", "role": "student", "room": "B-102", "photo": None, "isActive": False},
    {"id": "u10", "name": "Ananya Reddy",       "email": "ananya@muj.edu",  "password": "password", "role": "student", "room": "G-205", "photo": None, "isActive": True},
    {"id": "u11", "name": "Suresh Babu",        "email": "suresh@muj.edu",  "password": "password", "role": "guard",   "room": None,    "photo": None, "isActive": True},
    {"id": "u12", "name": "Dr. Rakesh Tiwari",  "email": "rakesh@muj.edu",  "password": "password", "role": "warden",  "room": None,    "photo": None, "isActive": True},
]

cameras_db = [
    {"id": "c1", "name": "Main Gate - Entry",  "location": "Main Gate",       "status": "ONLINE",      "lastSeen": now.isoformat()},
    {"id": "c2", "name": "Main Gate - Exit",   "location": "Main Gate",       "status": "ONLINE",      "lastSeen": now.isoformat()},
    {"id": "c3", "name": "Hostel B - Lobby",   "location": "Boys Hostel B",   "status": "ONLINE",      "lastSeen": now.isoformat()},
    {"id": "c4", "name": "Hostel G - Lobby",   "location": "Girls Hostel G",  "status": "ONLINE",      "lastSeen": now.isoformat()},
    {"id": "c5", "name": "Parking Lot A",      "location": "North Parking",   "status": "ONLINE",      "lastSeen": now.isoformat()},
    {"id": "c6", "name": "Library Entrance",   "location": "Central Library", "status": "OFFLINE",     "lastSeen": (now - timedelta(hours=1)).isoformat()},
    {"id": "c7", "name": "Canteen Area",       "location": "Food Court",      "status": "ONLINE",      "lastSeen": now.isoformat()},
    {"id": "c8", "name": "Academic Block",     "location": "Block A",         "status": "MAINTENANCE", "lastSeen": (now - timedelta(hours=2)).isoformat()},
    {"id": "c9", "name": "Sports Complex",     "location": "Sports Block",    "status": "ONLINE",      "lastSeen": now.isoformat()},
]

alerts_db = [
    {"id": "a1",  "level": "RED",    "type": "UNAUTHORIZED_ENTRY",  "message": "Unrecognized face detected at Main Gate after hours",            "cameraId": "c1", "sourceUserId": None, "acknowledgedBy": None, "createdAt": (now - timedelta(minutes=2)).isoformat()},
    {"id": "a2",  "level": "YELLOW", "type": "UNREGISTERED_VISITOR","message": "Unregistered visitor detected at Hostel B lobby",               "cameraId": "c3", "sourceUserId": None, "acknowledgedBy": "u5", "createdAt": (now - timedelta(minutes=5)).isoformat()},
    {"id": "a3",  "level": "RED",    "type": "NIGHT_OUT_VIOLATION",  "message": "Aarav Sharma attempting entry without approved night-out pass", "cameraId": "c1", "sourceUserId": "u1", "acknowledgedBy": None, "createdAt": (now - timedelta(minutes=10)).isoformat()},
    {"id": "a4",  "level": "GREEN",  "type": "AUTHORIZED_ACCESS",   "message": "Priya Patel verified and granted entry",                        "cameraId": "c4", "sourceUserId": "u2", "acknowledgedBy": None, "createdAt": (now - timedelta(minutes=15)).isoformat()},
    {"id": "a5",  "level": "YELLOW", "type": "VEHICLE_OVERSTAY",    "message": "Unregistered vehicle (RJ14 CA 7742) parked over 2 hours",       "cameraId": "c5", "sourceUserId": None, "acknowledgedBy": None, "createdAt": (now - timedelta(minutes=30)).isoformat()},
    {"id": "a6",  "level": "RED",    "type": "CAMERA_OFFLINE",      "message": "Library Entrance camera offline for 1+ hour",                   "cameraId": "c6", "sourceUserId": None, "acknowledgedBy": "u5", "createdAt": (now - timedelta(hours=1)).isoformat()},
    {"id": "a7",  "level": "GREEN",  "type": "AUTHORIZED_ACCESS",   "message": "Rahul Verma verified and granted entry",                        "cameraId": "c3", "sourceUserId": "u3", "acknowledgedBy": None, "createdAt": (now - timedelta(hours=1, minutes=10)).isoformat()},
    {"id": "a8",  "level": "YELLOW", "type": "PARCEL_UNCLAIMED",    "message": "Parcel for Kavya Nair unclaimed for 48+ hours",                 "cameraId": None, "sourceUserId": "u8", "acknowledgedBy": None, "createdAt": (now - timedelta(hours=2)).isoformat()},
    {"id": "a9",  "level": "GREEN",  "type": "AUTHORIZED_ACCESS",   "message": "Sneha Gupta verified and granted entry",                        "cameraId": "c4", "sourceUserId": "u4", "acknowledgedBy": None, "createdAt": (now - timedelta(hours=3)).isoformat()},
    {"id": "a10", "level": "RED",    "type": "UNAUTHORIZED_ENTRY",  "message": "Unknown person detected near Hostel G after 11 PM",             "cameraId": "c4", "sourceUserId": None, "acknowledgedBy": "u5", "createdAt": (now - timedelta(hours=4)).isoformat()},
]

access_logs_db = [
    {"id": "l1", "userName": "Aarav Sharma",    "eventType": "ENTRY",  "confidence": 0.94, "threatLevel": "GREEN",  "cameraName": "Main Gate - Entry",  "createdAt": (now - timedelta(minutes=15)).isoformat()},
    {"id": "l2", "userName": "Priya Patel",     "eventType": "ENTRY",  "confidence": 0.97, "threatLevel": "GREEN",  "cameraName": "Hostel G - Lobby",   "createdAt": (now - timedelta(minutes=30)).isoformat()},
    {"id": "l3", "userName": "Unknown",         "eventType": "DENIED", "confidence": 0.32, "threatLevel": "RED",    "cameraName": "Main Gate - Entry",  "createdAt": (now - timedelta(minutes=45)).isoformat()},
    {"id": "l4", "userName": "Rahul Verma",     "eventType": "EXIT",   "confidence": 0.91, "threatLevel": "GREEN",  "cameraName": "Main Gate - Exit",   "createdAt": (now - timedelta(hours=1)).isoformat()},
    {"id": "l5", "userName": "Sneha Gupta",     "eventType": "ENTRY",  "confidence": 0.89, "threatLevel": "GREEN",  "cameraName": "Hostel G - Lobby",   "createdAt": (now - timedelta(hours=1, minutes=30)).isoformat()},
    {"id": "l6", "userName": "Unknown Visitor", "eventType": "ENTRY",  "confidence": 0.0,  "threatLevel": "YELLOW", "cameraName": "Main Gate - Entry",  "createdAt": (now - timedelta(hours=2)).isoformat()},
    {"id": "l7", "userName": "Kavya Nair",      "eventType": "EXIT",   "confidence": 0.95, "threatLevel": "GREEN",  "cameraName": "Hostel G - Lobby",   "createdAt": (now - timedelta(hours=3)).isoformat()},
    {"id": "l8", "userName": "Rohan Das",       "eventType": "DENIED", "confidence": 0.88, "threatLevel": "RED",    "cameraName": "Hostel B - Lobby",   "createdAt": (now - timedelta(hours=4)).isoformat()},
]

visitors_db = [
    {"id": "v1", "name": "Ramesh Sharma",         "phone": "+91 98765 43210", "purpose": "Parent visit",   "hostUserId": "u1", "hostName": "Aarav Sharma", "status": "CHECKED_IN",  "allowedZones": ["Lobby", "Canteen"],                      "passToken": "VIS-20260328-001", "checkedInAt": (now - timedelta(minutes=30)).isoformat(), "checkedOutAt": None,                                       "createdAt": (now - timedelta(hours=1)).isoformat(), "hasFace": True,  "qrToken": "VIS-20260328-001",  "timeStart": (now - timedelta(hours=2)).isoformat(), "timeEnd": (now + timedelta(hours=4)).isoformat()},
    {"id": "v2", "name": "Sunita Patel",          "phone": "+91 87654 32109", "purpose": "Parent visit",   "hostUserId": "u2", "hostName": "Priya Patel",  "status": "PRE_APPROVED", "allowedZones": ["Lobby"],                                 "passToken": None,               "checkedInAt": None,                                          "checkedOutAt": None,                                       "createdAt": (now - timedelta(minutes=20)).isoformat(), "hasFace": True,  "qrToken": "VIS-20260409-A2B",  "timeStart": (now - timedelta(hours=1)).isoformat(), "timeEnd": (now + timedelta(hours=6)).isoformat()},
    {"id": "v3", "name": "Delivery Agent (Amazon)","phone": "+91 76543 21098", "purpose": "Parcel delivery","hostUserId": None, "hostName": None,            "status": "CHECKED_OUT", "allowedZones": ["Front Desk"],                            "passToken": "VIS-20260328-002", "checkedInAt": (now - timedelta(hours=2)).isoformat(),         "checkedOutAt": (now - timedelta(hours=1, minutes=50)).isoformat(), "createdAt": (now - timedelta(hours=2)).isoformat(), "hasFace": False, "qrToken": None,                "timeStart": None, "timeEnd": None},
    {"id": "v4", "name": "Prof. R.K. Mishra",     "phone": "+91 65432 10987", "purpose": "Guest lecture",  "hostUserId": "u7", "hostName": "Amit Kumar",   "status": "CHECKED_IN",  "allowedZones": ["Lobby", "Academic Block A", "Canteen"], "passToken": "VIS-20260328-003", "checkedInAt": (now - timedelta(hours=1, minutes=30)).isoformat(), "checkedOutAt": None,                                       "createdAt": (now - timedelta(days=1)).isoformat(), "hasFace": True,  "qrToken": "VIS-20260328-003",  "timeStart": (now - timedelta(hours=3)).isoformat(), "timeEnd": (now + timedelta(hours=5)).isoformat()},
    {"id": "v5", "name": "Unknown Visitor",       "phone": None,              "purpose": "Not specified",  "hostUserId": None, "hostName": None,            "status": "BLACKLISTED", "allowedZones": [],                                        "passToken": None,               "checkedInAt": None,                                          "checkedOutAt": None,                                       "createdAt": (now - timedelta(days=2)).isoformat(), "hasFace": False, "qrToken": None,                "timeStart": None, "timeEnd": None},
]

night_outs_db = [
    {"id": "n1", "studentId": "u1",  "studentName": "Aarav Sharma",  "room": "B-204", "reason": "Family emergency",       "destination": "Jaipur, Home",               "leaveDate": "2026-03-28", "returnDate": "2026-03-29", "returnTime": "18:00", "status": "PENDING",  "approvedBy": None,             "createdAt": (now - timedelta(hours=1)).isoformat()},
    {"id": "n2", "studentId": "u2",  "studentName": "Priya Patel",   "room": "G-112", "reason": "Medical appointment",    "destination": "Jaipur City Hospital",       "leaveDate": "2026-03-29", "returnDate": "2026-03-29", "returnTime": "14:00", "status": "APPROVED", "approvedBy": "Dr. Meera Joshi", "createdAt": (now - timedelta(hours=2)).isoformat()},
    {"id": "n3", "studentId": "u3",  "studentName": "Rahul Verma",   "room": "B-305", "reason": "Weekend trip",           "destination": "Pushkar",                    "leaveDate": "2026-03-28", "returnDate": "2026-03-30", "returnTime": "20:00", "status": "APPROVED", "approvedBy": "Dr. Meera Joshi", "createdAt": (now - timedelta(days=1)).isoformat()},
    {"id": "n4", "studentId": "u4",  "studentName": "Sneha Gupta",   "room": "G-208", "reason": "Cousin's wedding",       "destination": "Delhi",                      "leaveDate": "2026-03-27", "returnDate": "2026-03-28", "returnTime": "22:00", "status": "OVERDUE",  "approvedBy": "Dr. Meera Joshi", "createdAt": (now - timedelta(days=2)).isoformat()},
    {"id": "n5", "studentId": "u8",  "studentName": "Kavya Nair",    "room": "G-301", "reason": "Personal reasons",       "destination": "Jaipur",                     "leaveDate": "2026-03-28", "returnDate": "2026-03-28", "returnTime": "21:00", "status": "REJECTED", "approvedBy": "Dr. Meera Joshi", "createdAt": (now - timedelta(hours=4)).isoformat()},
    {"id": "n6", "studentId": "u10", "studentName": "Ananya Reddy",  "room": "G-205", "reason": "Internship interview",   "destination": "Bangalore (online from cafe)","leaveDate": "2026-03-29", "returnDate": "2026-03-29", "returnTime": "16:00", "status": "PENDING",  "approvedBy": None,             "createdAt": (now - timedelta(minutes=30)).isoformat()},
]

parcels_db = [
    {"id": "p1", "tracking_id": "FK-2026032801",  "student_id": "u1",  "recipientName": "Aarav Sharma",  "room": "B-204", "courierName": "Flipkart",  "loggedBy": "Vikram Singh", "status": "pending",   "timestamp": (now - timedelta(hours=1)).isoformat(),  "deliveredAt": None},
    {"id": "p2", "tracking_id": "AMZ-2026032802", "student_id": "u2",  "recipientName": "Priya Patel",   "room": "G-112", "courierName": "Amazon",    "loggedBy": "Vikram Singh", "status": "pending",   "timestamp": (now - timedelta(hours=2)).isoformat(),  "deliveredAt": None},
    {"id": "p3", "tracking_id": "MSH-2026032701", "student_id": "u3",  "recipientName": "Rahul Verma",   "room": "B-305", "courierName": "Meesho",    "loggedBy": "Suresh Babu",  "status": "delivered", "timestamp": (now - timedelta(days=1)).isoformat(),   "deliveredAt": (now - timedelta(hours=12)).isoformat()},
    {"id": "p4", "tracking_id": "MYN-2026032601", "student_id": "u8",  "recipientName": "Kavya Nair",    "room": "G-301", "courierName": "Myntra",    "loggedBy": "Vikram Singh", "status": "pending",   "timestamp": (now - timedelta(days=2)).isoformat(),   "deliveredAt": None},
    {"id": "p5", "tracking_id": "DLV-2026032803", "student_id": "u4",  "recipientName": "Sneha Gupta",   "room": "G-208", "courierName": "Delhivery", "loggedBy": "Suresh Babu",  "status": "pending",   "timestamp": (now - timedelta(minutes=30)).isoformat(),"deliveredAt": None},
    {"id": "p6", "tracking_id": "BD-2026032804",  "student_id": "u10", "recipientName": "Ananya Reddy",  "room": "G-205", "courierName": "BlueDart",  "loggedBy": "Vikram Singh", "status": "delivered", "timestamp": (now - timedelta(days=3)).isoformat(),   "deliveredAt": (now - timedelta(hours=60)).isoformat()},
]

vehicles_db = [
    {"id": "ve1", "licensePlate": "RJ14 CA 7742", "ownerName": "Unknown",                "vehicleType": "Car",        "isRegistered": False, "isBlacklisted": False, "status": "PARKED",  "entryTime": (now - timedelta(hours=2)).isoformat(),            "exitTime": None},
    {"id": "ve2", "licensePlate": "RJ14 AB 1234", "ownerName": "Dr. Rakesh Tiwari",      "vehicleType": "Car",        "isRegistered": True,  "isBlacklisted": False, "status": "PARKED",  "entryTime": (now - timedelta(hours=1)).isoformat(),            "exitTime": None},
    {"id": "ve3", "licensePlate": "RJ14 CD 5678", "ownerName": "Amit Kumar",             "vehicleType": "Motorcycle", "isRegistered": True,  "isBlacklisted": False, "status": "MOVING",  "entryTime": (now - timedelta(minutes=30)).isoformat(),         "exitTime": None},
    {"id": "ve4", "licensePlate": "DL01 BC 9012", "ownerName": "Visitor - Prof. Mishra", "vehicleType": "Car",        "isRegistered": False, "isBlacklisted": False, "status": "PARKED",  "entryTime": (now - timedelta(hours=1, minutes=30)).isoformat(),"exitTime": None},
    {"id": "ve5", "licensePlate": "RJ14 EF 3456", "ownerName": "Priya Patel",            "vehicleType": "Scooter",    "isRegistered": True,  "isBlacklisted": False, "status": "EXITED",  "entryTime": (now - timedelta(hours=8)).isoformat(),            "exitTime": (now - timedelta(hours=2)).isoformat()},
    {"id": "ve6", "licensePlate": "RJ27 GH 7890", "ownerName": "Unknown",                "vehicleType": "Truck",      "isRegistered": False, "isBlacklisted": True,  "status": "MOVING",  "entryTime": (now - timedelta(hours=4)).isoformat(),            "exitTime": None},
    {"id": "ve7", "licensePlate": "MH12 DE 1433", "ownerName": "Unknown",                "vehicleType": "Car",        "isRegistered": False, "isBlacklisted": True,  "status": "EXITED",  "entryTime": (now - timedelta(hours=6)).isoformat(),            "exitTime": (now - timedelta(hours=5)).isoformat()},
]

hourly_traffic_db = [
    {"hour": "6AM",  "entries": 12, "exits": 3},
    {"hour": "7AM",  "entries": 45, "exits": 8},
    {"hour": "8AM",  "entries": 89, "exits": 15},
    {"hour": "9AM",  "entries": 67, "exits": 22},
    {"hour": "10AM", "entries": 34, "exits": 28},
    {"hour": "11AM", "entries": 23, "exits": 19},
    {"hour": "12PM", "entries": 18, "exits": 31},
    {"hour": "1PM",  "entries": 29, "exits": 25},
    {"hour": "2PM",  "entries": 41, "exits": 17},
    {"hour": "3PM",  "entries": 22, "exits": 34},
    {"hour": "4PM",  "entries": 15, "exits": 52},
    {"hour": "5PM",  "entries": 11, "exits": 67},
    {"hour": "6PM",  "entries": 8,  "exits": 45},
    {"hour": "7PM",  "entries": 19, "exits": 12},
    {"hour": "8PM",  "entries": 14, "exits": 8},
    {"hour": "9PM",  "entries": 7,  "exits": 5},
    {"hour": "10PM", "entries": 3,  "exits": 2},
    {"hour": "11PM", "entries": 1,  "exits": 1},
]

weekly_alerts_db = [
    {"day": "Mon", "red": 2, "yellow": 5, "green": 87},
    {"day": "Tue", "red": 1, "yellow": 3, "green": 92},
    {"day": "Wed", "red": 0, "yellow": 4, "green": 95},
    {"day": "Thu", "red": 3, "yellow": 6, "green": 78},
    {"day": "Fri", "red": 1, "yellow": 8, "green": 105},
    {"day": "Sat", "red": 4, "yellow": 2, "green": 45},
    {"day": "Sun", "red": 2, "yellow": 1, "green": 32},
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe(user: dict) -> dict:
    return {k: v for k, v in user.items() if k != "password"}


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        user = next((u for u in users_db if u["id"] == user_id), None)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/auth/login")
def login(request: LoginRequest):
    user = next((u for u in users_db if u["email"] == request.email), None)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # Any password accepted for demo
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    return {"token": token, "user": _safe(user)}


@app.get("/auth/me")
def get_me(current_user=Depends(get_current_user)):
    return _safe(current_user)

# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@app.get("/dashboard/stats")
def get_dashboard_stats(current_user=Depends(get_current_user)):
    cameras_online      = sum(1 for c in cameras_db     if c["status"] == "ONLINE")
    active_alerts       = sum(1 for a in alerts_db      if not a["acknowledgedBy"] and a["level"] in ("RED", "YELLOW"))
    night_out_active    = sum(1 for n in night_outs_db  if n["status"] == "APPROVED")
    parcels_unclaimed   = sum(1 for p in parcels_db     if p["status"] == "pending")
    visitors_on_campus  = sum(1 for v in visitors_db    if v["status"] == "CHECKED_IN")
    unauthorized        = sum(1 for l in access_logs_db if l["eventType"] == "DENIED")
    total_entries       = sum(h["entries"] for h in hourly_traffic_db)
    return {
        "totalEntriesToday":    total_entries,
        "activeAlerts":         active_alerts,
        "camerasOnline":        cameras_online,
        "camerasTotal":         len(cameras_db),
        "nightOutActive":       night_out_active,
        "parcelsUnclaimed":     parcels_unclaimed,
        "visitorsOnCampus":     visitors_on_campus,
        "unauthorizedAttempts": unauthorized,
    }

# ---------------------------------------------------------------------------
# Cameras
# ---------------------------------------------------------------------------

@app.get("/cameras")
def get_cameras(current_user=Depends(get_current_user)):
    return cameras_db


@app.get("/cameras/{camera_id}")
def get_camera(camera_id: str, current_user=Depends(get_current_user)):
    camera = next((c for c in cameras_db if c["id"] == camera_id), None)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    return camera

# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

@app.get("/alerts")
def get_alerts(limit: Optional[int] = None, current_user=Depends(get_current_user)):
    alerts = sorted(alerts_db, key=lambda a: a["createdAt"], reverse=True)
    return alerts[:limit] if limit else alerts


@app.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: str, current_user=Depends(get_current_user)):
    alert = next((a for a in alerts_db if a["id"] == alert_id), None)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert["acknowledgedBy"] = current_user["id"]
    return alert

# ---------------------------------------------------------------------------
# Access Logs
# ---------------------------------------------------------------------------

@app.get("/access-logs")
def get_access_logs(limit: Optional[int] = None, current_user=Depends(get_current_user)):
    logs = sorted(access_logs_db, key=lambda l: l["createdAt"], reverse=True)
    return logs[:limit] if limit else logs


@app.post("/access-logs")
def create_access_log(log: dict, current_user=Depends(get_current_user)):
    log["id"] = f"l{len(access_logs_db) + 1}"
    log["createdAt"] = datetime.now(timezone.utc).isoformat()
    access_logs_db.append(log)
    return log

# ---------------------------------------------------------------------------
# Traffic
# ---------------------------------------------------------------------------

@app.get("/traffic/hourly")
def get_hourly_traffic(current_user=Depends(get_current_user)):
    return hourly_traffic_db


@app.get("/traffic/weekly-alerts")
def get_weekly_alerts(current_user=Depends(get_current_user)):
    return weekly_alerts_db

# ---------------------------------------------------------------------------
# Visitors  (updated: smart visitor system with face embeddings)
# ---------------------------------------------------------------------------

class VisitorRegisterRequest(BaseModel):
    name: str
    phone: Optional[str] = None
    purpose: str
    hostUserId: Optional[str] = None
    selfie: Optional[str] = None      # base64 image
    timeStart: Optional[str] = None   # ISO datetime
    timeEnd: Optional[str] = None     # ISO datetime
    allowedZones: Optional[list[str]] = None

class VisitorCheckRequest(BaseModel):
    qr_token: Optional[str] = None
    image: Optional[str] = None       # base64 face for matching


@app.get("/visitors")
def get_visitors(current_user=Depends(get_current_user)):
    # Return visitors without embedding data (too large for JSON)
    safe = []
    for v in visitors_db:
        sv = {k: val for k, val in v.items() if k != "_embedding"}
        safe.append(sv)
    return sorted(safe, key=lambda v: v["createdAt"], reverse=True)


@app.post("/visitors")
def create_visitor(visitor: dict, current_user=Depends(get_current_user)):
    visitor["id"] = f"v{len(visitors_db) + 1}"
    visitor["createdAt"] = datetime.now(timezone.utc).isoformat()
    visitor.setdefault("passToken", None)
    visitor.setdefault("checkedInAt", None)
    visitor.setdefault("checkedOutAt", None)
    visitor.setdefault("hasFace", False)
    visitor.setdefault("qrToken", None)
    visitor.setdefault("timeStart", None)
    visitor.setdefault("timeEnd", None)
    visitors_db.append(visitor)
    return visitor


# ── Smart Visitor Registration ────────────────────────────────────────────────
@app.post("/visitor/register")
def register_visitor(body: VisitorRegisterRequest, current_user=Depends(get_current_user)):
    """
    Online pre-registration: name, purpose, time window, selfie.
    Extracts face embedding from selfie and stores it.
    Returns visitor record with QR token for fast entry.
    """
    # Resolve host
    host_name = None
    if body.hostUserId:
        host = next((u for u in users_db if u["id"] == body.hostUserId), None)
        host_name = host["name"] if host else None

    # Generate unique QR token
    qr_token = f"VIS-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    # Default time window: now → +8 hours
    now_ts = datetime.now(timezone.utc)
    time_start = body.timeStart or now_ts.isoformat()
    time_end   = body.timeEnd   or (now_ts + timedelta(hours=8)).isoformat()

    visitor = {
        "id":           f"v{len(visitors_db) + 1}",
        "name":         body.name,
        "phone":        body.phone,
        "purpose":      body.purpose,
        "hostUserId":   body.hostUserId,
        "hostName":     host_name,
        "status":       "PRE_APPROVED",
        "allowedZones": body.allowedZones or ["Lobby"],
        "passToken":    qr_token,
        "qrToken":      qr_token,
        "checkedInAt":  None,
        "checkedOutAt": None,
        "createdAt":    now_ts.isoformat(),
        "hasFace":      False,
        "selfie":       body.selfie,   # store raw base64 photo
        "timeStart":    time_start,
        "timeEnd":      time_end,
    }

    # Extract face embedding from selfie
    if body.selfie:
        frame = decode_frame(body.selfie)
        if frame is not None:
            try:
                from deepface import DeepFace
                reps = DeepFace.represent(
                    img_path=frame,
                    model_name="Facenet512",
                    detector_backend="opencv",
                    enforce_detection=False,
                    align=True,
                )
                if reps:
                    emb = np.array(reps[0]["embedding"], dtype=np.float32)
                    visitor["hasFace"] = True
                    visitor["_embedding"] = emb
                    # Add to live visitor embedding cache
                    with _visitor_embed_lock:
                        _visitor_embeddings.append({
                            "visitor_id": visitor["id"],
                            "name":       body.name,
                            "embedding":  emb,
                            "time_start": time_start,
                            "time_end":   time_end,
                        })
            except Exception as e:
                print(f"[UWSD] Visitor face extraction failed: {e}")

    visitors_db.append(visitor)

    # Return without embedding numpy array
    return {k: v for k, v in visitor.items() if k != "_embedding"}


# ── Smart Visitor Check (at gate) ─────────────────────────────────────────────
@app.post("/visitor/check")
def check_visitor(body: VisitorCheckRequest, current_user=Depends(get_current_user)):
    """
    At the gate: verify visitor via QR token or face image.
    - QR token → look up visitor, verify time window, return details.
    - Face image → match against visitor embeddings, return result.
    Generates appropriate GREEN/YELLOW/RED alerts.
    """
    result = {"matched": False, "visitor": None, "alert_level": "RED", "message": "Unknown visitor"}

    # ── Method 1: QR token lookup ─────────────────────────────────────────
    if body.qr_token:
        visitor = next((v for v in visitors_db if v.get("qrToken") == body.qr_token), None)
        if visitor:
            now_ts = datetime.now(timezone.utc)
            in_window = True
            try:
                if visitor.get("timeStart") and visitor.get("timeEnd"):
                    t_start = datetime.fromisoformat(visitor["timeStart"])
                    t_end   = datetime.fromisoformat(visitor["timeEnd"])
                    in_window = t_start <= now_ts <= t_end
            except Exception:
                pass

            safe_visitor = {k: v for k, v in visitor.items() if k != "_embedding"}

            if visitor.get("status") == "BLACKLISTED":
                alert = {
                    "id": f"a{len(alerts_db)+1}", "level": "RED", "type": "BLACKLISTED_VISITOR",
                    "message": f"Blacklisted visitor {visitor['name']} attempted entry via QR",
                    "cameraId": None, "sourceUserId": None, "acknowledgedBy": None,
                    "createdAt": now_ts.isoformat(),
                }
                alerts_db.append(alert)
                broadcast_alert_from_thread(alert)
                return {"matched": True, "visitor": safe_visitor, "alert_level": "RED",
                        "message": "Blacklisted visitor — entry denied", "in_window": False}

            if in_window:
                alert = {
                    "id": f"a{len(alerts_db)+1}", "level": "GREEN", "type": "VISITOR_VERIFIED",
                    "message": f"Pre-approved visitor {visitor['name']} verified via QR token",
                    "cameraId": None, "sourceUserId": None, "acknowledgedBy": None,
                    "createdAt": now_ts.isoformat(),
                }
                alerts_db.append(alert)
                broadcast_alert_from_thread(alert)
                return {"matched": True, "visitor": safe_visitor, "alert_level": "GREEN",
                        "message": f"Visitor {visitor['name']} verified — approved entry", "in_window": True}
            else:
                alert = {
                    "id": f"a{len(alerts_db)+1}", "level": "YELLOW", "type": "VISITOR_OUTSIDE_WINDOW",
                    "message": f"Visitor {visitor['name']} arrived outside approved time window",
                    "cameraId": None, "sourceUserId": None, "acknowledgedBy": None,
                    "createdAt": now_ts.isoformat(),
                }
                alerts_db.append(alert)
                broadcast_alert_from_thread(alert)
                return {"matched": True, "visitor": safe_visitor, "alert_level": "YELLOW",
                        "message": f"Visitor {visitor['name']} outside time window — manual check", "in_window": False}

    # ── Method 2: Face image matching ─────────────────────────────────────
    if body.image:
        frame = decode_frame(body.image)
        if frame is not None:
            try:
                from deepface import DeepFace
                reps = DeepFace.represent(
                    img_path=frame,
                    model_name="Facenet512",
                    detector_backend="opencv",
                    enforce_detection=False,
                    align=True,
                )
                if reps:
                    query = np.array(reps[0]["embedding"], dtype=np.float32)
                    vid, vname, vconf, in_window = _match_visitor_embedding(query)
                    if vid:
                        visitor = next((v for v in visitors_db if v["id"] == vid), None)
                        safe_visitor = {k: v for k, v in visitor.items() if k != "_embedding"} if visitor else None
                        level = "GREEN" if in_window else "YELLOW"
                        msg   = (f"Visitor {vname} face matched ({vconf:.0%} confidence)"
                                 + (" — approved" if in_window else " — outside time window"))
                        alert = {
                            "id": f"a{len(alerts_db)+1}", "level": level,
                            "type": "VISITOR_FACE_MATCH" if in_window else "VISITOR_OUTSIDE_WINDOW",
                            "message": msg, "cameraId": None, "sourceUserId": None,
                            "acknowledgedBy": None, "createdAt": datetime.now(timezone.utc).isoformat(),
                        }
                        alerts_db.append(alert)
                        broadcast_alert_from_thread(alert)
                        return {"matched": True, "visitor": safe_visitor, "alert_level": level,
                                "message": msg, "in_window": in_window, "confidence": vconf}

                    # Also check registered hostel faces
                    name, match_conf, is_known = _match_embedding(query)
                    if is_known:
                        return {"matched": True, "visitor": None, "alert_level": "GREEN",
                                "message": f"Identified as registered person: {name} ({match_conf:.0%})",
                                "in_window": True, "confidence": match_conf}
            except Exception as e:
                print(f"[UWSD] Visitor face check failed: {e}")

    # No match
    alert = {
        "id": f"a{len(alerts_db)+1}", "level": "YELLOW", "type": "UNREGISTERED_VISITOR",
        "message": "Unknown visitor at gate — manual verification required",
        "cameraId": None, "sourceUserId": None, "acknowledgedBy": None,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    alerts_db.append(alert)
    broadcast_alert_from_thread(alert)
    return result


@app.post("/visitors/{visitor_id}/check-in")
def check_in_visitor(visitor_id: str, current_user=Depends(get_current_user)):
    visitor = next((v for v in visitors_db if v["id"] == visitor_id), None)
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")
    visitor["status"] = "CHECKED_IN"
    visitor["checkedInAt"] = datetime.now(timezone.utc).isoformat()
    if not visitor.get("passToken"):
        visitor["passToken"] = f"VIS-{datetime.now().strftime('%Y%m%d')}-{visitor_id}"
    return {k: v for k, v in visitor.items() if k != "_embedding"}


@app.post("/visitors/{visitor_id}/check-out")
def check_out_visitor(visitor_id: str, current_user=Depends(get_current_user)):
    visitor = next((v for v in visitors_db if v["id"] == visitor_id), None)
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")
    visitor["status"] = "CHECKED_OUT"
    visitor["checkedOutAt"] = datetime.now(timezone.utc).isoformat()
    # Remove from live visitor embedding cache
    with _visitor_embed_lock:
        _visitor_embeddings[:] = [e for e in _visitor_embeddings if e["visitor_id"] != visitor_id]
    return {k: v for k, v in visitor.items() if k != "_embedding"}

# ---------------------------------------------------------------------------
# Night-Out Requests
# ---------------------------------------------------------------------------

@app.get("/night-outs")
def get_night_outs(current_user=Depends(get_current_user)):
    return sorted(night_outs_db, key=lambda n: n["createdAt"], reverse=True)


@app.post("/night-outs")
def create_night_out(request: dict, current_user=Depends(get_current_user)):
    request["id"] = f"n{len(night_outs_db) + 1}"
    request["status"] = "PENDING"
    request["approvedBy"] = None
    request["createdAt"] = datetime.now(timezone.utc).isoformat()
    night_outs_db.append(request)
    return request


@app.post("/night-outs/{request_id}/approve")
def approve_night_out(request_id: str, current_user=Depends(get_current_user)):
    req = next((n for n in night_outs_db if n["id"] == request_id), None)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    req["status"] = "APPROVED"
    req["approvedBy"] = current_user["name"]
    return req


@app.post("/night-outs/{request_id}/reject")
def reject_night_out(request_id: str, current_user=Depends(get_current_user)):
    req = next((n for n in night_outs_db if n["id"] == request_id), None)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    req["status"] = "REJECTED"
    req["approvedBy"] = current_user["name"]
    return req

# ---------------------------------------------------------------------------
# Parcels  (updated flow: guard logs → student looks up → guard verifies)
# ---------------------------------------------------------------------------

class ParcelAddRequest(BaseModel):
    tracking_id: str
    student_id: str
    courierName: Optional[str] = None

class ParcelVerifyRequest(BaseModel):
    tracking_id: str


@app.get("/parcels")
def get_parcels(status: Optional[str] = None, current_user=Depends(get_current_user)):
    result = [p for p in parcels_db if p["status"] == status] if status else parcels_db
    return sorted(result, key=lambda p: p["timestamp"], reverse=True)


# ── NEW: POST /parcel/add  (guard logs a new parcel) ─────────────────────
@app.post("/parcel/add")
def add_parcel(body: ParcelAddRequest, current_user=Depends(get_current_user)):
    # Only guards / admins / wardens may log parcels
    if current_user["role"] not in ("guard", "admin", "warden"):
        raise HTTPException(status_code=403, detail="Only guards can log parcels")
    # Prevent duplicate tracking IDs
    if any(p["tracking_id"] == body.tracking_id for p in parcels_db):
        raise HTTPException(status_code=409, detail="Tracking ID already exists")
    # Resolve student info
    student = next((u for u in users_db if u["id"] == body.student_id), None)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    parcel = {
        "id":            f"p{len(parcels_db) + 1}",
        "tracking_id":   body.tracking_id,
        "student_id":    body.student_id,
        "recipientName": student["name"],
        "room":          student.get("room", ""),
        "courierName":   body.courierName or "Unknown",
        "loggedBy":      current_user["name"],
        "status":        "pending",
        "timestamp":     datetime.now(timezone.utc).isoformat(),
        "deliveredAt":   None,
    }
    parcels_db.append(parcel)
    return parcel


# ── NEW: GET /parcel/{tracking_id}  (look up by tracking ID) ─────────────
@app.get("/parcel/{tracking_id}")
def get_parcel_by_tracking(tracking_id: str, current_user=Depends(get_current_user)):
    parcel = next((p for p in parcels_db if p["tracking_id"] == tracking_id), None)
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")
    return parcel


# ── NEW: POST /parcel/verify  (guard approves hand-over → delivered) ─────
@app.post("/parcel/verify")
def verify_parcel(body: ParcelVerifyRequest, current_user=Depends(get_current_user)):
    if current_user["role"] not in ("guard", "admin", "warden"):
        raise HTTPException(status_code=403, detail="Only guards can verify parcels")
    parcel = next((p for p in parcels_db if p["tracking_id"] == body.tracking_id), None)
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")
    if parcel["status"] == "delivered":
        raise HTTPException(status_code=400, detail="Parcel already delivered")
    parcel["status"]      = "delivered"
    parcel["deliveredAt"]  = datetime.now(timezone.utc).isoformat()
    return parcel


# ── Legacy create / collect (kept for backward compat) ───────────────────
@app.post("/parcels")
def create_parcel(parcel: dict, current_user=Depends(get_current_user)):
    parcel["id"]          = f"p{len(parcels_db) + 1}"
    parcel["loggedBy"]    = current_user["name"]
    parcel["status"]      = "pending"
    parcel["timestamp"]   = datetime.now(timezone.utc).isoformat()
    parcel["deliveredAt"] = None
    parcels_db.append(parcel)
    return parcel


@app.post("/parcels/{parcel_id}/collect")
def collect_parcel(parcel_id: str, current_user=Depends(get_current_user)):
    parcel = next((p for p in parcels_db if p["id"] == parcel_id), None)
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")
    parcel["status"]      = "delivered"
    parcel["deliveredAt"]  = datetime.now(timezone.utc).isoformat()
    return parcel

# ---------------------------------------------------------------------------
# Vehicles
# ---------------------------------------------------------------------------

@app.get("/vehicles")
def get_vehicles(current_user=Depends(get_current_user)):
    return sorted(vehicles_db, key=lambda v: v["entryTime"], reverse=True)


@app.post("/vehicles/entry")
def log_vehicle_entry(vehicle: dict, current_user=Depends(get_current_user)):
    vehicle["id"] = f"ve{len(vehicles_db) + 1}"
    vehicle["status"] = "PARKED"
    vehicle["entryTime"] = datetime.now(timezone.utc).isoformat()
    vehicle["exitTime"] = None
    vehicles_db.append(vehicle)
    return vehicle


@app.post("/vehicles/{license_plate}/exit")
def log_vehicle_exit(license_plate: str, current_user=Depends(get_current_user)):
    vehicle = next(
        (v for v in vehicles_db if v["licensePlate"] == license_plate and v["status"] == "PARKED"),
        None,
    )
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found or already exited")
    vehicle["status"] = "EXITED"
    vehicle["exitTime"] = datetime.now(timezone.utc).isoformat()
    return vehicle


class RegisterVehicleRequest(BaseModel):
    licensePlate: str
    ownerName: str
    vehicleType: str
    isBlacklisted: bool = False


@app.post("/vehicles/register")
def register_vehicle(body: RegisterVehicleRequest, current_user=Depends(get_current_user)):
    """Add or update a known vehicle in the registry."""
    existing = next(
        (v for v in vehicles_db if v["licensePlate"].replace(" ", "").upper() == body.licensePlate.replace(" ", "").upper()),
        None,
    )
    if existing:
        existing["ownerName"]    = body.ownerName
        existing["vehicleType"]  = body.vehicleType
        existing["isRegistered"] = True
        existing["isBlacklisted"] = body.isBlacklisted
        return existing
    new_v = {
        "id":            f"ve{len(vehicles_db) + 1}",
        "licensePlate":  body.licensePlate.upper(),
        "ownerName":     body.ownerName,
        "vehicleType":   body.vehicleType,
        "isRegistered":  True,
        "isBlacklisted": body.isBlacklisted,
        "status":        "EXITED",
        "entryTime":     datetime.now(timezone.utc).isoformat(),
        "exitTime":      datetime.now(timezone.utc).isoformat(),
    }
    vehicles_db.append(new_v)
    return new_v


@app.post("/vehicles/{vehicle_id}/blacklist")
def toggle_blacklist(vehicle_id: str, current_user=Depends(get_current_user)):
    vehicle = next((v for v in vehicles_db if v["id"] == vehicle_id), None)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    vehicle["isBlacklisted"] = not vehicle.get("isBlacklisted", False)
    return vehicle


@app.post("/vehicles/{vehicle_id}/moving")
def set_moving(vehicle_id: str, current_user=Depends(get_current_user)):
    vehicle = next((v for v in vehicles_db if v["id"] == vehicle_id), None)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    vehicle["status"] = "MOVING"
    vehicle["exitTime"] = None
    return vehicle


# Lazy-loaded EasyOCR reader (English only, no GPU needed for demo)
_ocr_reader = None

def _get_ocr_reader():
    global _ocr_reader
    if _ocr_reader is None:
        import easyocr
        _ocr_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
    return _ocr_reader


# Indian plate pattern: e.g. RJ14CA7742  RJ 14 CA 7742  DL01BC9012
_PLATE_RE = re.compile(
    r'\b([A-Z]{2}[\s\-]?\d{2}[\s\-]?[A-Z]{1,3}[\s\-]?\d{4})\b'
)

def _normalise_plate(raw: str) -> str:
    """Remove separators and upper-case so plates are comparable."""
    return re.sub(r'[\s\-]', '', raw).upper()

def _format_plate(raw: str) -> str:
    """Return plate in canonical spaced form: XX99 XX 9999."""
    n = _normalise_plate(raw)
    # split: state(2) district(2) series(1-3) number(4)
    m = re.match(r'^([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{4})$', n)
    if m:
        return f"{m.group(1)}{m.group(2)} {m.group(3)} {m.group(4)}"
    return n


def _extract_plates_from_frame(frame, reader) -> list[str]:
    results = reader.readtext(frame, detail=0, paragraph=False)
    plates = []
    for text in results:
        text_clean = text.upper().replace('O', '0').replace('I', '1')
        for m in _PLATE_RE.finditer(text_clean):
            plates.append(_format_plate(m.group(1)))
    return plates


@app.post("/vehicles/analyze-video")
async def analyze_video(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """
    Accept a video upload, sample frames, run OCR to detect license plates,
    and update vehicles_db accordingly.
    Returns a summary of detections and DB changes.
    """
    # Save upload to a temp file
    suffix = Path(file.filename).suffix if file.filename else ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        reader = _get_ocr_reader()
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Cannot open video file")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        sample_every = max(1, int(fps))          # one frame per second
        detected: dict[str, int] = {}            # plate -> frame count
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % sample_every == 0:
                plates = _extract_plates_from_frame(frame, reader)
                for p in plates:
                    detected[p] = detected.get(p, 0) + 1
            frame_idx += 1

        cap.release()
    finally:
        os.unlink(tmp_path)

    # Only trust plates seen in ≥2 sampled frames (reduces false positives)
    confirmed = [p for p, cnt in detected.items() if cnt >= 2]

    added, updated, already_parked = [], [], []
    now_ts = datetime.now(timezone.utc).isoformat()

    for plate in confirmed:
        existing = next(
            (v for v in vehicles_db if _normalise_plate(v["licensePlate"]) == _normalise_plate(plate)),
            None,
        )
        if existing is None:
            # New unknown vehicle — log as PARKED entry
            new_entry = {
                "id": f"ve{len(vehicles_db) + 1}",
                "licensePlate": plate,
                "ownerName": "Unknown",
                "vehicleType": "Car",
                "isRegistered": False,
                "isBlacklisted": False,
                "status": "PARKED",
                "entryTime": now_ts,
                "exitTime": None,
            }
            vehicles_db.append(new_entry)
            added.append(plate)
        elif existing["status"] == "EXITED":
            # Vehicle re-entering
            existing["status"] = "PARKED"
            existing["entryTime"] = now_ts
            existing["exitTime"] = None
            updated.append(plate)
        else:
            already_parked.append(plate)

    return {
        "framesProcessed": frame_idx,
        "framesSampled": frame_idx // sample_every,
        "detectedPlates": list(detected.keys()),
        "confirmedPlates": confirmed,
        "added": added,
        "updated": updated,
        "alreadyParked": already_parked,
    }

# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@app.get("/users")
def get_users(current_user=Depends(get_current_user)):
    return [_safe(u) for u in users_db]


@app.get("/users/{user_id}")
def get_user(user_id: str, current_user=Depends(get_current_user)):
    user = next((u for u in users_db if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _safe(user)


@app.post("/users")
def create_user(user: dict, current_user=Depends(get_current_user)):
    user["id"] = f"u{len(users_db) + 1}"
    user["password"] = "password"
    user["photo"] = None
    user["isActive"] = True
    users_db.append(user)
    return _safe(user)


@app.put("/users/{user_id}")
def update_user(user_id: str, updates: dict, current_user=Depends(get_current_user)):
    user = next((u for u in users_db if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for key, value in updates.items():
        if key not in ("id", "password"):
            user[key] = value
    return _safe(user)


# ---------------------------------------------------------------------------
# Face Recognition — WebSocket Camera
# ---------------------------------------------------------------------------

@app.websocket("/ws/camera")
async def camera_ws(websocket: WebSocket):
    await websocket.accept()
    loop = asyncio.get_event_loop()
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            b64 = data.get("frame", "")
            if not b64:
                continue

            frame = await loop.run_in_executor(_executor, decode_frame, b64)
            if frame is None:
                continue

            detections = await loop.run_in_executor(_executor, run_detection, frame)

            # Auto-generate alerts for unknowns
            for det in detections:
                if not det["is_known"]:
                    recent = [a for a in alerts_db
                              if a["type"] == "UNAUTHORIZED_ENTRY" and a["cameraId"] == "webcam"]
                    too_soon = recent and (
                        datetime.now(timezone.utc)
                        - datetime.fromisoformat(recent[-1]["createdAt"])
                    ).total_seconds() < 30
                    if not too_soon:
                        alert = {
                            "id":             f"a{len(alerts_db) + 1}",
                            "level":          "RED",
                            "type":           "UNAUTHORIZED_ENTRY",
                            "message":        "Unknown person detected by live camera",
                            "cameraId":       "webcam",
                            "sourceUserId":   None,
                            "acknowledgedBy": None,
                            "createdAt":      datetime.now(timezone.utc).isoformat(),
                        }
                        alerts_db.append(alert)
                        broadcast_alert_from_thread(alert)

            await websocket.send_text(json.dumps({"detections": detections}))
    except (WebSocketDisconnect, Exception):
        pass


# ---------------------------------------------------------------------------
# Face Registration
# ---------------------------------------------------------------------------

class RegisterFaceRequest(BaseModel):
    name: str
    image: str  # base64


@app.post("/faces/register")
def register_face(req: RegisterFaceRequest, current_user=Depends(get_current_user)):
    person_dir = FACES_DIR / req.name.replace(" ", "_")
    person_dir.mkdir(exist_ok=True)

    frame = decode_frame(req.image)
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    img_path = person_dir / f"{timestamp}.jpg"
    cv2.imwrite(str(img_path), frame)
    _clear_cache()
    threading.Thread(target=reload_embeddings, daemon=True).start()

    return {"name": req.name, "saved": str(img_path)}


@app.get("/faces")
def list_faces(current_user=Depends(get_current_user)):
    faces = []
    for d in FACES_DIR.iterdir():
        if d.is_dir():
            imgs = list(d.glob("*.jpg")) + list(d.glob("*.png"))
            if imgs:
                faces.append({"name": d.name.replace("_", " "), "photos": len(imgs)})
    return faces


@app.delete("/faces/{name}")
def delete_face(name: str, current_user=Depends(get_current_user)):
    person_dir = FACES_DIR / name.replace(" ", "_")
    if not person_dir.exists():
        raise HTTPException(status_code=404, detail="Face not found")
    shutil.rmtree(person_dir)
    _clear_cache()
    threading.Thread(target=reload_embeddings, daemon=True).start()
    return {"deleted": name}


# ---------------------------------------------------------------------------
# RTSP / IP Camera streaming
# ---------------------------------------------------------------------------

# In-memory list of user-added RTSP cameras
rtsp_cameras: list[dict] = []

# Per-camera frame cache  {camera_id: (jpeg_bytes, timestamp)}
_rtsp_frame_cache: dict[str, tuple[bytes, float]] = {}
_rtsp_threads:     dict[str, threading.Thread]    = {}
_rtsp_stop_flags:  dict[str, threading.Event]     = {}


class AddRTSPCamera(BaseModel):
    name:     str
    url:      str          # full rtsp:// URL  OR  plain IP (we'll guess path)
    location: str = "IP Camera"


def _normalise_url(url: str) -> str:
    """Accept raw IP or full RTSP URL and return a proper rtsp:// URL."""
    url = url.strip()
    if url.startswith("rtsp://") or url.startswith("http://"):
        return url
    # bare IP (optionally with port) — try the most common generic path
    return f"rtsp://{url}/stream"


def _capture_loop(cam_id: str, url: str, stop_flag: threading.Event):
    """Background thread: continuously read frames from RTSP and cache latest."""
    cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    while not stop_flag.is_set():
        ret, frame = cap.read()
        if not ret:
            # try to reconnect
            cap.release()
            time.sleep(2)
            cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            continue
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
        _rtsp_frame_cache[cam_id] = (buf.tobytes(), time.time())

    cap.release()
    _rtsp_frame_cache.pop(cam_id, None)


def _start_capture(cam_id: str, url: str):
    if cam_id in _rtsp_threads and _rtsp_threads[cam_id].is_alive():
        return
    flag = threading.Event()
    _rtsp_stop_flags[cam_id] = flag
    t = threading.Thread(target=_capture_loop, args=(cam_id, url, flag), daemon=True)
    _rtsp_threads[cam_id] = t
    t.start()


def _stop_capture(cam_id: str):
    if cam_id in _rtsp_stop_flags:
        _rtsp_stop_flags[cam_id].set()
    _rtsp_threads.pop(cam_id, None)
    _rtsp_stop_flags.pop(cam_id, None)


def _mjpeg_generator(cam_id: str):
    """Yield MJPEG frames from the frame cache."""
    deadline = time.time() + 3          # wait up to 3 s for first frame
    while cam_id not in _rtsp_frame_cache and time.time() < deadline:
        time.sleep(0.05)

    if cam_id not in _rtsp_frame_cache:
        # produce a placeholder grey frame
        placeholder = np.full((240, 320, 3), 40, dtype=np.uint8)
        cv2.putText(placeholder, "Connecting...", (30, 120),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (200, 200, 200), 2)
        _, buf = cv2.imencode(".jpg", placeholder)
        yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
               + buf.tobytes() + b"\r\n")
        return

    last_ts = 0.0
    while True:
        entry = _rtsp_frame_cache.get(cam_id)
        if entry is None:
            break
        jpeg, ts = entry
        if ts != last_ts:
            last_ts = ts
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
                   + jpeg + b"\r\n")
        else:
            time.sleep(0.03)


# ── verify token from query param (for <img src="...?token=..."> ) ──────────
def verify_token_query(token: str = Query(...)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        user = next((u for u in users_db if u["id"] == user_id), None)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@app.get("/rtsp/cameras")
def list_rtsp_cameras(current_user=Depends(get_current_user)):
    return [
        {**c, "online": c["id"] in _rtsp_frame_cache}
        for c in rtsp_cameras
    ]


@app.post("/rtsp/cameras")
def add_rtsp_camera(body: AddRTSPCamera, current_user=Depends(get_current_user)):
    cam_id = f"rtsp_{len(rtsp_cameras) + 1}"
    url    = _normalise_url(body.url)
    cam    = {
        "id":       cam_id,
        "name":     body.name,
        "location": body.location,
        "url":      url,
        "status":   "ONLINE",
        "addedAt":  datetime.now(timezone.utc).isoformat(),
    }
    rtsp_cameras.append(cam)
    _start_capture(cam_id, url)
    return cam


@app.delete("/rtsp/cameras/{cam_id}")
def remove_rtsp_camera(cam_id: str, current_user=Depends(get_current_user)):
    cam = next((c for c in rtsp_cameras if c["id"] == cam_id), None)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    rtsp_cameras.remove(cam)
    _stop_capture(cam_id)
    return {"deleted": cam_id}


@app.get("/rtsp/stream/{cam_id}")
def stream_rtsp(cam_id: str, current_user=Depends(verify_token_query)):
    """MJPEG stream — use in <img src='...'> or <Image>."""
    cam = next((c for c in rtsp_cameras if c["id"] == cam_id), None)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    # Ensure capture thread is alive
    _start_capture(cam_id, cam["url"])
    return StreamingResponse(
        _mjpeg_generator(cam_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.post("/rtsp/test")
def test_rtsp_url(body: dict, current_user=Depends(get_current_user)):
    """Quick connectivity check — opens the URL, reads one frame."""
    url = _normalise_url(body.get("url", ""))
    cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 4000)
    cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 4000)
    ret, _ = cap.read()
    cap.release()
    return {"reachable": bool(ret), "url": url}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=True)
