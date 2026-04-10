"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Header from "@/components/header";
import { mockCameras } from "@/lib/mock-data";
import { cn, getStatusColor } from "@/lib/utils";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import {
  Camera, Circle, Maximize2, Volume2, RefreshCw,
  Video, VideoOff, UserPlus, Trash2, AlertTriangle, CheckCircle2, X,
  Wifi, WifiOff, Plus, Link,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL  = API_URL.replace("http", "ws");

// ─── Types ───────────────────────────────────────────────────────────────────
interface Detection {
  bbox: [number, number, number, number];
  detection_conf: number;
  name: string;
  match_conf: number;
  is_known: boolean;
}

interface RegisteredFace {
  name: string;
  photos: number;
}

// ─── Webcam AI Panel ─────────────────────────────────────────────────────────
function WebcamPanel() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef     = useRef<WebSocket | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const [active,      setActive]      = useState(false);
  const [detections,  setDetections]  = useState<Detection[]>([]);
  const [alerts,      setAlerts]      = useState<string[]>([]);
  const [faces,       setFaces]       = useState<RegisteredFace[]>([]);
  const [showRegister,setShowRegister]= useState(false);
  const [regName,     setRegName]     = useState("");
  const [regLoading,      setRegLoading]      = useState(false);
  const [regMsg,          setRegMsg]          = useState("");
  const [canManageFaces,  setCanManageFaces]  = useState(false);

  useEffect(() => {
    const u = getStoredUser();
    setCanManageFaces(u?.role === "warden" || u?.role === "admin");
  }, []);

  // Load registered faces
  const loadFaces = () =>
    api.getUsers ? fetch(`${API_URL}/faces`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("uwsd_token")}` },
    }).then(r => r.json()).then(setFaces).catch(() => {}) : Promise.resolve();

  useEffect(() => { loadFaces(); }, []);

  // Start webcam
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Connect WebSocket
      const ws = new WebSocket(`${WS_URL}/ws/camera`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        const dets: Detection[] = data.detections || [];
        setDetections(dets);

        // Draw on canvas
        const canvas = canvasRef.current;
        const video  = videoRef.current;
        if (!canvas || !video) return;
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Frames are sent at 480px wide — scale bbox back to canvas resolution
        const sentScale = Math.min(1, 480 / (video.videoWidth || 480));
        const sentW = Math.round((video.videoWidth  || 480) * sentScale);
        const sentH = Math.round((video.videoHeight || 360) * sentScale);
        const rx = canvas.width  / sentW;
        const ry = canvas.height / sentH;

        for (const det of dets) {
          const [x1, y1, x2, y2] = det.bbox;
          const cx1 = x1 * rx, cy1 = y1 * ry;
          const cw  = (x2 - x1) * rx, ch = (y2 - y1) * ry;
          const color = det.is_known ? "#10b981" : "#ef4444";
          ctx.strokeStyle = color;
          ctx.lineWidth   = 3;
          ctx.strokeRect(cx1, cy1, cw, ch);

          // Label background
          const label = det.is_known
            ? `${det.name} (${(det.match_conf * 100).toFixed(0)}%)`
            : "UNKNOWN";
          ctx.font = "bold 14px monospace";
          ctx.fillStyle = color;
          ctx.fillRect(cx1, cy1 - 24, ctx.measureText(label).width + 12, 24);
          ctx.fillStyle = "#fff";
          ctx.fillText(label, cx1 + 6, cy1 - 7);

          // Alert for unknown
          if (!det.is_known) {
            setAlerts(prev => {
              const msg = `Unknown person detected at ${new Date().toLocaleTimeString()}`;
              return [msg, ...prev].slice(0, 5);
            });
          }
        }
      };

      // Send frames every 500ms at reduced resolution for speed
      timerRef.current = setInterval(() => {
        if (!videoRef.current || ws.readyState !== WebSocket.OPEN) return;
        const tmp = document.createElement("canvas");
        // Cap at 480px wide — enough for face detection, much faster to encode
        const scale = Math.min(1, 480 / (videoRef.current.videoWidth || 480));
        tmp.width  = Math.round((videoRef.current.videoWidth  || 480) * scale);
        tmp.height = Math.round((videoRef.current.videoHeight || 360) * scale);
        tmp.getContext("2d")?.drawImage(videoRef.current, 0, 0, tmp.width, tmp.height);
        const b64 = tmp.toDataURL("image/jpeg", 0.6);
        ws.send(JSON.stringify({ frame: b64 }));
      }, 500);

      setActive(true);
    } catch (err) {
      console.error("Camera error:", err);
    }
  };

  const stopCamera = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    wsRef.current?.close();
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    const ctx = canvasRef.current?.getContext("2d");
    ctx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    setActive(false);
    setDetections([]);
  };

  useEffect(() => () => stopCamera(), []);

  // Register face
  const registerFace = async () => {
    if (!regName.trim() || !videoRef.current) return;
    setRegLoading(true);
    setRegMsg("");
    const tmp = document.createElement("canvas");
    tmp.width  = videoRef.current.videoWidth  || 640;
    tmp.height = videoRef.current.videoHeight || 480;
    tmp.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const image = tmp.toDataURL("image/jpeg", 0.9);
    try {
      const res = await fetch(`${API_URL}/faces/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("uwsd_token")}`,
        },
        body: JSON.stringify({ name: regName.trim(), image }),
      });
      if (res.ok) {
        setRegMsg(`✓ "${regName}" registered successfully!`);
        setRegName("");
        loadFaces();
      } else {
        setRegMsg("Failed to register face.");
      }
    } catch {
      setRegMsg("Error connecting to backend.");
    }
    setRegLoading(false);
  };

  const deleteFace = async (name: string) => {
    await fetch(`${API_URL}/faces/${encodeURIComponent(name.replace(/ /g, "_"))}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("uwsd_token")}` },
    });
    loadFaces();
  };

  return (
    <div className="rounded-xl border border-blue-500/40 bg-slate-900/80 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {active && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />}
            <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", active ? "bg-red-500" : "bg-slate-600")} />
          </span>
          <span className="text-sm font-semibold text-white">AI Camera — Live Detection</span>
          {active && <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">LIVE</span>}
        </div>
        <div className="flex gap-2">
          {canManageFaces && (
            <button
              onClick={() => setShowRegister(s => !s)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" /> Add Face
            </button>
          )}
          <button
            onClick={active ? stopCamera : startCamera}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/30"
                : "bg-blue-600 text-white hover:bg-blue-500"
            )}
          >
            {active ? <><VideoOff className="h-3.5 w-3.5" /> Stop</> : <><Video className="h-3.5 w-3.5" /> Start Webcam</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-0">
        {/* Camera feed */}
        <div className="col-span-2 relative bg-black aspect-video">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          {!active && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Camera className="h-12 w-12 text-slate-700" />
              <p className="text-sm text-slate-600">Click "Start Webcam" to begin AI monitoring</p>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="border-l border-slate-800 flex flex-col">
          {/* Detections */}
          <div className="flex-1 p-3 overflow-y-auto">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Detections ({detections.length})
            </p>
            {detections.length === 0 ? (
              <p className="text-xs text-slate-600">No persons detected</p>
            ) : (
              <div className="space-y-2">
                {detections.map((d, i) => (
                  <div key={i} className={cn(
                    "rounded-lg border p-2",
                    d.is_known
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-red-500/30 bg-red-500/5"
                  )}>
                    <div className="flex items-center gap-1.5 mb-1">
                      {d.is_known
                        ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        : <AlertTriangle className="h-3 w-3 text-red-400" />}
                      <span className={cn("text-xs font-bold", d.is_known ? "text-emerald-400" : "text-red-400")}>
                        {d.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Detect: {(d.detection_conf * 100).toFixed(0)}%
                      {d.is_known && ` · Match: ${(d.match_conf * 100).toFixed(0)}%`}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Recent alerts */}
            {alerts.length > 0 && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mt-3 mb-2">
                  Alerts
                </p>
                <div className="space-y-1">
                  {alerts.map((a, i) => (
                    <div key={i} className="rounded border border-red-500/20 bg-red-500/5 px-2 py-1.5">
                      <p className="text-[10px] text-red-400">{a}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Registered faces */}
          <div className="border-t border-slate-800 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Face DB ({faces.length})
            </p>
            {faces.length === 0 ? (
              <p className="text-[10px] text-slate-600">No faces registered</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {faces.map((f) => (
                  <div key={f.name} className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">{f.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-600">{f.photos} photo{f.photos !== 1 ? "s" : ""}</span>
                      {canManageFaces && (
                        <button onClick={() => deleteFace(f.name)} className="text-slate-600 hover:text-red-400 transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Register face modal — warden/admin only */}
      {showRegister && canManageFaces && (
        <div className="border-t border-slate-800 p-4 bg-slate-900/50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">Register New Face</p>
            <button onClick={() => { setShowRegister(false); setRegMsg(""); }} className="text-slate-500 hover:text-slate-300">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Make sure the person is clearly visible in the webcam feed, then enter their name and click Register.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={regName}
              onChange={e => setRegName(e.target.value)}
              placeholder="Full name (e.g. Aarav Sharma)"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500"
              onKeyDown={e => e.key === "Enter" && registerFace()}
            />
            <button
              onClick={registerFace}
              disabled={regLoading || !active || !regName.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {regLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <UserPlus className="h-4 w-4" />}
              Register
            </button>
          </div>
          {!active && <p className="mt-2 text-xs text-amber-400">Start the webcam first before registering a face.</p>}
          {regMsg && <p className="mt-2 text-xs text-emerald-400">{regMsg}</p>}
        </div>
      )}
    </div>
  );
}

// ─── RTSP / IP Camera Panel ───────────────────────────────────────────────────
function RTSPPanel() {
  const [cameras,    setCameras]    = useState<any[]>([]);
  const [showForm,   setShowForm]   = useState(false);
  const [name,       setName]       = useState("");
  const [url,        setUrl]        = useState("");
  const [location,   setLocation]   = useState("");
  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState<null | boolean>(null);
  const [adding,     setAdding]     = useState(false);
  const [fullscreen, setFullscreen] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("uwsd_token") : "";

  const load = () =>
    fetch(`${API_URL}/rtsp/cameras`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(setCameras).catch(() => {});

  useEffect(() => { load(); }, []);

  const testUrl = async () => {
    if (!url.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_URL}/rtsp/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      setTestResult(data.reachable);
    } catch {
      setTestResult(false);
    }
    setTesting(false);
  };

  const addCamera = async () => {
    if (!name.trim() || !url.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${API_URL}/rtsp/cameras`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), url: url.trim(), location: location.trim() || "IP Camera" }),
      });
      if (res.ok) {
        setName(""); setUrl(""); setLocation(""); setTestResult(null); setShowForm(false);
        load();
      }
    } catch {}
    setAdding(false);
  };

  const removeCamera = async (id: string) => {
    await fetch(`${API_URL}/rtsp/cameras/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  };

  if (cameras.length === 0 && !showForm) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-6 text-center">
        <Wifi className="mx-auto h-8 w-8 text-slate-600 mb-2" />
        <p className="text-sm text-slate-400 mb-1">No IP cameras connected</p>
        <p className="text-xs text-slate-600 mb-4">Connect an RTSP camera via IP address or stream URL</p>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add IP Camera
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Wifi className="h-4 w-4 text-blue-400" />
          IP / RTSP Cameras
          <span className="text-xs font-normal text-slate-500">({cameras.length} connected)</span>
        </h3>
        <button
          onClick={() => { setShowForm(s => !s); setTestResult(null); }}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add Camera
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
          <p className="text-sm font-medium text-white">Connect IP / RTSP Camera</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Camera Name *</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Front Gate Cam"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Location</label>
              <input
                value={location} onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Building Entrance"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">RTSP URL or IP Address *</label>
            <div className="flex gap-2">
              <input
                value={url} onChange={e => { setUrl(e.target.value); setTestResult(null); }}
                placeholder="rtsp://192.168.1.100:554/stream  or  192.168.1.100"
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 font-mono"
              />
              <button
                onClick={testUrl}
                disabled={testing || !url.trim()}
                className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-600 disabled:opacity-50 transition-colors"
              >
                {testing
                  ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                  : <Link className="h-3.5 w-3.5" />}
                Test
              </button>
            </div>

            {testResult !== null && (
              <p className={cn("mt-1.5 text-xs flex items-center gap-1", testResult ? "text-emerald-400" : "text-red-400")}>
                {testResult
                  ? <><CheckCircle2 className="h-3 w-3" /> Connection successful — camera is reachable</>
                  : <><AlertTriangle className="h-3 w-3" /> Could not connect — check the URL or network</>}
              </p>
            )}
          </div>

          {/* Common URL templates */}
          <div>
            <p className="text-[10px] text-slate-600 mb-1.5 uppercase tracking-wider">Common formats</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: "Generic",     tmpl: "rtsp://{ip}:554/stream" },
                { label: "Hikvision",   tmpl: "rtsp://admin:pass@{ip}:554/h264/ch1/main/av_stream" },
                { label: "Dahua",       tmpl: "rtsp://admin:pass@{ip}:554/cam/realmonitor?channel=1" },
                { label: "Reolink",     tmpl: "rtsp://admin:pass@{ip}:554/h264Preview_01_main" },
              ].map(t => (
                <button
                  key={t.label}
                  onClick={() => { setUrl(t.tmpl.replace("{ip}", "192.168.1.100")); setTestResult(null); }}
                  className="rounded border border-slate-700 bg-slate-800/50 px-2 py-1 text-left text-[10px] text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
                >
                  <span className="text-slate-300">{t.label}</span>
                  <span className="block text-slate-600 font-mono truncate">{t.tmpl}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={addCamera}
              disabled={adding || !name.trim() || !url.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {adding ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Plus className="h-4 w-4" />}
              Connect Camera
            </button>
            <button onClick={() => { setShowForm(false); setTestResult(null); }} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Camera grid */}
      {cameras.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map(cam => (
            <div key={cam.id} className="group relative overflow-hidden rounded-xl border border-slate-700 bg-black">
              {/* MJPEG stream */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${API_URL}/rtsp/stream/${cam.id}?token=${token}`}
                alt={cam.name}
                className="w-full aspect-video object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />

              {/* Fullscreen overlay button */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setFullscreen(cam.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => removeCamera(cam.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-red-500/20 text-red-400 backdrop-blur-sm hover:bg-red-500/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* LIVE badge */}
              <div className="absolute left-2 top-2 flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Live</span>
              </div>

              {/* Footer */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-3 py-2">
                <p className="text-xs font-medium text-white">{cam.name}</p>
                <p className="text-[10px] text-slate-400 font-mono truncate">{cam.url}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen modal */}
      {fullscreen && (() => {
        const cam = cameras.find(c => c.id === fullscreen);
        if (!cam) return null;
        return (
          <div className="fixed inset-0 z-50 bg-black flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80">
              <div>
                <p className="text-sm font-semibold text-white">{cam.name}</p>
                <p className="text-xs text-slate-400 font-mono">{cam.url}</p>
              </div>
              <button onClick={() => setFullscreen(null)} className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:bg-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${API_URL}/rtsp/stream/${cam.id}?token=${token}`}
              alt={cam.name}
              className="flex-1 w-full object-contain"
            />
          </div>
        );
      })()}
    </div>
  );
}

// ─── Static Camera Grid ───────────────────────────────────────────────────────
function StaticCameraGrid({ cameras, columns }: { cameras: any[]; columns: 2 | 3 | 4 }) {
  return (
    <div className={cn(
      "grid gap-4",
      columns === 2 && "grid-cols-1 md:grid-cols-2",
      columns === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      columns === 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    )}>
      {cameras.map((camera) => (
        <div key={camera.id} className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition-all">
          <div className="camera-feed-placeholder aspect-video">
            <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2">
              {camera.status === "ONLINE" ? (
                <>
                  <Camera className="h-8 w-8 text-slate-600" />
                  <span className="text-xs text-slate-600">Live Feed</span>
                  <div className="absolute left-3 top-3 flex items-center gap-1.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Live</span>
                  </div>
                </>
              ) : camera.status === "OFFLINE" ? (
                <><Camera className="h-8 w-8 text-red-900" /><span className="text-xs font-medium text-red-500">Camera Offline</span></>
              ) : (
                <><Camera className="h-8 w-8 text-amber-900" /><span className="text-xs font-medium text-amber-500">Maintenance</span></>
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
              <div>
                <p className="text-xs font-medium text-white">{camera.name}</p>
                <p className="text-[10px] text-slate-400">{camera.location}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 transition-colors">
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
                <button className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 transition-colors">
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Circle className={cn("h-2 w-2 fill-current",
                camera.status === "ONLINE" ? "text-emerald-400" : camera.status === "OFFLINE" ? "text-red-400" : "text-amber-400"
              )} />
              <span className={cn("text-xs font-medium", getStatusColor(camera.status))}>{camera.status}</span>
            </div>
            <span className="text-[10px] text-slate-600">{camera.id.toUpperCase()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LiveFeedPage() {
  const [cameras,     setCameras]     = useState<any[]>([]);
  const [columns,     setColumns]     = useState<2 | 3 | 4>(3);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = () =>
    api.getCameras()
      .then(data => { setCameras(data); setLastRefresh(new Date()); })
      .catch(() => { setCameras(mockCameras); setLastRefresh(new Date()); });

  useEffect(() => { load(); }, []);

  const online      = cameras.filter(c => c.status === "ONLINE").length;
  const offline     = cameras.filter(c => c.status === "OFFLINE").length;
  const maintenance = cameras.filter(c => c.status === "MAINTENANCE").length;

  return (
    <div className="min-h-screen">
      <Header title="Live Feed" />

      <div className="p-6 space-y-6">
        {/* AI Webcam Panel */}
        <WebcamPanel />

        {/* Status + controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <span className="flex items-center gap-2 text-emerald-400"><Circle className="h-2 w-2 fill-current" /> {online} Online</span>
            <span className="flex items-center gap-2 text-red-400"><Circle className="h-2 w-2 fill-current" /> {offline} Offline</span>
            <span className="flex items-center gap-2 text-amber-400"><Circle className="h-2 w-2 fill-current" /> {maintenance} Maintenance</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{lastRefresh ? `Refreshed ${lastRefresh.toLocaleTimeString()}` : "Loading..."}</span>
            <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors">
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
            <div className="flex rounded-lg border border-slate-700 overflow-hidden">
              {([2, 3, 4] as const).map(n => (
                <button key={n} onClick={() => setColumns(n)} className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  columns === n ? "bg-blue-600 text-white" : "bg-slate-800/50 text-slate-400 hover:bg-slate-700"
                )}>{n}×</button>
              ))}
            </div>
          </div>
        </div>

        {/* IP / RTSP cameras */}
        <RTSPPanel />

        {/* Built-in static camera grid */}
        <div>
          <h3 className="text-sm font-semibold text-slate-400 mb-3">Fixed Cameras</h3>
          <StaticCameraGrid cameras={cameras} columns={columns} />
        </div>
      </div>
    </div>
  );
}
