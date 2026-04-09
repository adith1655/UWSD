"use client";

import { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import Header from "@/components/header";
import { mockVisitors, mockUsers } from "@/lib/mock-data";
import { formatRelativeTime, cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  UserCheck, UserX, Clock, Ban, UserPlus, ScanLine, Users, Camera, Upload,
  CheckCircle, AlertTriangle, X, Shield, QrCode, Calendar, Phone, FileText,
  MapPin, Fingerprint, Copy, Eye, Download, RefreshCw, Search, ZoomIn,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────── */
const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  CHECKED_IN:   { label: "Checked In",   color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", icon: UserCheck },
  PRE_APPROVED: { label: "Pre-Approved", color: "text-blue-400 bg-blue-500/10 border-blue-500/30",         icon: Shield },
  PENDING:      { label: "Pending",      color: "text-amber-400 bg-amber-500/10 border-amber-500/30",      icon: Clock },
  CHECKED_OUT:  { label: "Checked Out",  color: "text-slate-400 bg-slate-500/10 border-slate-500/30",      icon: UserX },
  BLACKLISTED:  { label: "Blacklisted",  color: "text-red-400 bg-red-500/10 border-red-500/30",            icon: Ban },
};

const alertColors: Record<string, string> = {
  GREEN:  "border-emerald-500/40 bg-emerald-500/5",
  YELLOW: "border-amber-500/40 bg-amber-500/5",
  RED:    "border-red-500/40 bg-red-500/5",
};
const alertTextColors: Record<string, string> = {
  GREEN:  "text-emerald-400",
  YELLOW: "text-amber-400",
  RED:    "text-red-400",
};

type Tab = "register" | "verify" | "all";

/* ── QR Modal ───────────────────────────────────────────────────────────── */
function QRModal({ token, name, onClose }: { token: string; name: string; onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    const svg = printRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visitor-pass-${token}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 text-center space-y-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Visitor Pass</p>
            <h3 className="text-lg font-semibold text-slate-100">{name}</h3>
          </div>

          <div ref={printRef} className="flex justify-center p-4 bg-white rounded-xl">
            <QRCodeSVG
              value={token}
              size={200}
              level="H"
              includeMargin={false}
              fgColor="#0f172a"
            />
          </div>

          <div className="rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-3">
            <p className="text-xs text-slate-500 mb-1">Scan at gate or share token</p>
            <p className="font-mono text-sm font-bold text-blue-400 tracking-wide">{token}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(token)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-all"
            >
              <Copy className="h-4 w-4" /> Copy Token
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-all"
            >
              <Download className="h-4 w-4" /> Download QR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Selfie Modal ───────────────────────────────────────────────────────── */
function SelfieModal({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative max-w-xs w-full rounded-2xl overflow-hidden border border-slate-700 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-lg p-1 bg-black/50 text-white hover:bg-black/70">
          <X className="h-4 w-4" />
        </button>
        <img src={src} alt={`${name}'s selfie`} className="w-full object-cover" />
        <div className="px-4 py-3 bg-slate-900 border-t border-slate-800">
          <p className="text-sm font-medium text-slate-200">{name}</p>
          <p className="text-xs text-slate-500">Visitor selfie — face ID registered</p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
export default function VisitorsPage() {
  const [visitors, setVisitors] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");

  /* ── Register form ──────────────────────────────────────────────────────── */
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPurpose, setRegPurpose] = useState("");
  const [regHost, setRegHost] = useState("");
  const [regTimeStart, setRegTimeStart] = useState("");
  const [regTimeEnd, setRegTimeEnd] = useState("");
  const [regSelfie, setRegSelfie] = useState<string | null>(null);
  const [regSelfiePreview, setRegSelfiePreview] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState<any>(null);
  const [regError, setRegError] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /* ── Verify state ───────────────────────────────────────────────────────── */
  const [verifyQR, setVerifyQR] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  /* ── Walk-in quick add (in verify tab) ─────────────────────────────────── */
  const [walkinName, setWalkinName] = useState("");
  const [walkinPhone, setWalkinPhone] = useState("");
  const [walkinPurpose, setWalkinPurpose] = useState("");
  const [walkinSelfie, setWalkinSelfie] = useState<string | null>(null);
  const [walkinPreview, setWalkinPreview] = useState<string | null>(null);
  const [walkinCamActive, setWalkinCamActive] = useState(false);
  const [walkinLoading, setWalkinLoading] = useState(false);
  const [walkinResult, setWalkinResult] = useState<any>(null);
  const walkinVideoRef = useRef<HTMLVideoElement>(null);
  const walkinStreamRef = useRef<MediaStream | null>(null);
  const walkinFileRef = useRef<HTMLInputElement>(null);

  /* ── Modals ─────────────────────────────────────────────────────────────── */
  const [qrModal, setQrModal] = useState<{ token: string; name: string } | null>(null);
  const [selfieModal, setSelfieModal] = useState<{ src: string; name: string } | null>(null);

  const isGuard = currentUser?.role === "guard" || currentUser?.role === "admin" || currentUser?.role === "warden";

  const load = useCallback(() => {
    api.getVisitors().then(setVisitors).catch(() => setVisitors(mockVisitors as any));
  }, []);

  useEffect(() => {
    load();
    api.me().then(setCurrentUser).catch(() => setCurrentUser({ id: "u5", name: "Vikram Singh", role: "guard" }));
    api.getUsers().then(setUsers).catch(() => setUsers(mockUsers as any));
  }, [load]);

  /* ── Auto-poll visitors every 5 s so all tabs stay in sync ─────────────── */
  useEffect(() => {
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  /* ── Cleanup camera streams on unmount ──────────────────────────────────── */
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      walkinStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /* ── Attach stream to video elements after they mount in the DOM ────────── */
  useLayoutEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  useLayoutEffect(() => {
    if (walkinCamActive && walkinVideoRef.current && walkinStreamRef.current) {
      walkinVideoRef.current.srcObject = walkinStreamRef.current;
    }
  }, [walkinCamActive]);

  /* ── Camera helpers ─────────────────────────────────────────────────────── */
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 480, height: 360 } });
      streamRef.current = stream;
      setCameraActive(true); // triggers useLayoutEffect to wire srcObject after render
    } catch { setRegError("Camera access denied"); }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setRegSelfie(dataUrl);
    setRegSelfiePreview(dataUrl);
    stopCamera();
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setRegSelfie(result);
      setRegSelfiePreview(result);
    };
    reader.readAsDataURL(file);
  };

  /* ── Walk-in camera helpers ─────────────────────────────────────────────── */
  const startWalkinCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 480, height: 360 } });
      walkinStreamRef.current = stream;
      setWalkinCamActive(true); // triggers useLayoutEffect to wire srcObject after render
    } catch { /* ignore */ }
  };

  const captureWalkinPhoto = () => {
    if (!walkinVideoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = walkinVideoRef.current.videoWidth;
    canvas.height = walkinVideoRef.current.videoHeight;
    canvas.getContext("2d")!.drawImage(walkinVideoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setWalkinSelfie(dataUrl);
    setWalkinPreview(dataUrl);
    walkinStreamRef.current?.getTracks().forEach((t) => t.stop());
    walkinStreamRef.current = null;
    setWalkinCamActive(false);
  };

  const handleWalkinFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      setWalkinSelfie(r);
      setWalkinPreview(r);
    };
    reader.readAsDataURL(file);
  };

  /* ── Register visitor ───────────────────────────────────────────────────── */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    setRegError("");
    setRegSuccess(null);
    try {
      const res = await api.registerVisitor({
        name: regName.trim(),
        phone: regPhone.trim() || undefined,
        purpose: regPurpose.trim(),
        hostUserId: regHost || undefined,
        selfie: regSelfie || undefined,
        timeStart: regTimeStart ? new Date(regTimeStart).toISOString() : undefined,
        timeEnd: regTimeEnd ? new Date(regTimeEnd).toISOString() : undefined,
      });
      setRegSuccess({ ...res, selfiePreview: regSelfiePreview });
      setRegName(""); setRegPhone(""); setRegPurpose(""); setRegHost("");
      setRegTimeStart(""); setRegTimeEnd("");
      setRegSelfie(null); setRegSelfiePreview(null);
      load();
    } catch (err: any) {
      setRegError(err.message || "Registration failed");
    } finally {
      setRegLoading(false);
    }
  };

  /* ── Walk-in register ───────────────────────────────────────────────────── */
  const handleWalkin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkinName.trim() || !walkinPurpose.trim()) return;
    setWalkinLoading(true);
    try {
      const now = new Date();
      const end = new Date(now.getTime() + 4 * 60 * 60 * 1000); // +4 hours
      const res = await api.registerVisitor({
        name: walkinName.trim(),
        phone: walkinPhone.trim() || undefined,
        purpose: walkinPurpose.trim(),
        selfie: walkinSelfie || undefined,
        timeStart: now.toISOString(),
        timeEnd: end.toISOString(),
      });
      setWalkinResult({ ...res, selfiePreview: walkinPreview });
      // Immediately check them in
      await api.checkInVisitor(res.id).catch(() => {});
      setWalkinName(""); setWalkinPhone(""); setWalkinPurpose("");
      setWalkinSelfie(null); setWalkinPreview(null);
      load();
    } catch (err: any) {
      /* ignore */
    } finally {
      setWalkinLoading(false);
    }
  };

  /* ── Verify visitor ─────────────────────────────────────────────────────── */
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyQR.trim()) return;
    setVerifyLoading(true);
    setVerifyError("");
    setVerifyResult(null);
    try {
      const res = await api.checkVisitor({ qr_token: verifyQR.trim() });
      setVerifyResult(res);
    } catch (err: any) {
      setVerifyError(err.message || "Verification failed");
    } finally {
      setVerifyLoading(false);
    }
  };

  const checkIn = async (id: string) => { await api.checkInVisitor(id).catch(() => {}); load(); };
  const checkOut = async (id: string) => { await api.checkOutVisitor(id).catch(() => {}); load(); };

  /* ── Stats ──────────────────────────────────────────────────────────────── */
  const onCampus    = visitors.filter((v) => v.status === "CHECKED_IN").length;
  const preApproved = visitors.filter((v) => v.status === "PRE_APPROVED").length;
  const checkedOut  = visitors.filter((v) => v.status === "CHECKED_OUT").length;
  const blacklisted = visitors.filter((v) => v.status === "BLACKLISTED").length;

  /* ── Filtered visitors ──────────────────────────────────────────────────── */
  const filteredVisitors = visitors.filter((v) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      v.name?.toLowerCase().includes(q) ||
      v.purpose?.toLowerCase().includes(q) ||
      v.hostName?.toLowerCase().includes(q) ||
      v.qrToken?.toLowerCase().includes(q) ||
      v.phone?.toLowerCase().includes(q)
    );
  });

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "register", label: "Register Visitor", icon: UserPlus },
    ...(isGuard ? [{ key: "verify" as Tab, label: "Gate Verification", icon: ScanLine }] : []),
    { key: "all", label: "All Visitors", icon: Users },
  ];

  /* ─────────────────────────────────────────────────────────────────────────  */
  return (
    <div className="min-h-screen">
      <Header title="Smart Visitors" />

      {/* Modals */}
      {qrModal && <QRModal token={qrModal.token} name={qrModal.name} onClose={() => setQrModal(null)} />}
      {selfieModal && <SelfieModal src={selfieModal.src} name={selfieModal.name} onClose={() => setSelfieModal(null)} />}

      <div className="p-6 space-y-6">
        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "On Campus",    value: onCampus,    color: "text-emerald-400", icon: UserCheck, bg: "bg-emerald-500/5 border-emerald-500/20" },
            { label: "Pre-Approved", value: preApproved, color: "text-blue-400",    icon: Shield,    bg: "bg-blue-500/5 border-blue-500/20" },
            { label: "Checked Out",  value: checkedOut,  color: "text-slate-400",   icon: UserX,     bg: "bg-slate-500/5 border-slate-700" },
            { label: "Blacklisted",  value: blacklisted, color: "text-red-400",     icon: Ban,       bg: "bg-red-500/5 border-red-500/20" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={cn("relative overflow-hidden rounded-2xl border p-5", s.bg)}>
                <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-30"
                     style={{ background: `radial-gradient(circle, currentColor, transparent)` }} />
                <Icon className={cn("h-5 w-5 mb-3", s.color)} />
                <p className={cn("text-3xl font-bold tabular-nums", s.color)}>{s.value}</p>
                <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wider">{s.label}</p>
              </div>
            );
          })}
        </div>

        {/* ── Tab bar ───────────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-xl bg-slate-900/80 border border-slate-800 w-fit">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200",
                  active ? "bg-blue-600/20 text-blue-400 shadow-lg shadow-blue-500/10"
                         : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                )}>
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: Register Visitor                                               */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "register" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* ── Form ──────────────────────────────────────────────────────── */}
            <div className="lg:col-span-3 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20">
                  <UserPlus className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Pre-Register Visitor</h2>
                  <p className="text-xs text-slate-500">Fill the form — a QR pass is generated instantly</p>
                </div>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Full Name *</label>
                    <div className="relative">
                      <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input type="text" required value={regName} onChange={(e) => setRegName(e.target.value)}
                        placeholder="Visitor name"
                        className="w-full rounded-xl border border-slate-700 bg-slate-800/50 pl-10 pr-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input type="text" value={regPhone} onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+91 XXXXX XXXXX"
                        className="w-full rounded-xl border border-slate-700 bg-slate-800/50 pl-10 pr-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Purpose of Visit *</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input type="text" required value={regPurpose} onChange={(e) => setRegPurpose(e.target.value)}
                      placeholder="e.g. Parent visit, Guest lecture, Delivery"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/50 pl-10 pr-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Host (who are they visiting?)</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <select value={regHost} onChange={(e) => setRegHost(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-800/50 pl-10 pr-4 py-3 text-sm text-slate-200 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all">
                      <option value="">No host / General visit</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Visit From</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input type="datetime-local" value={regTimeStart} onChange={(e) => setRegTimeStart(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800/50 pl-10 pr-4 py-3 text-sm text-slate-200 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Visit Until</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input type="datetime-local" value={regTimeEnd} onChange={(e) => setRegTimeEnd(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800/50 pl-10 pr-4 py-3 text-sm text-slate-200 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                    </div>
                  </div>
                </div>

                {regError && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {regError}
                  </div>
                )}

                <button type="submit" disabled={regLoading}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-600/20">
                  <UserPlus className="h-4 w-4" />
                  {regLoading ? "Registering…" : "Register & Generate Pass"}
                </button>
              </form>
            </div>

            {/* ── Right: Selfie + Result ─────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-5">
              {/* Selfie capture */}
              <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20">
                    <Fingerprint className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Face ID (Selfie)</h3>
                    <p className="text-xs text-slate-500">Enables automatic gate entry</p>
                  </div>
                </div>

                {cameraActive ? (
                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-black">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full" />
                      <div className="absolute inset-0 border-2 border-violet-500/30 rounded-xl pointer-events-none" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-40 border-2 border-violet-400/50 rounded-full pointer-events-none" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={capturePhoto}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 transition-all">
                        <Camera className="h-4 w-4" /> Capture
                      </button>
                      <button type="button" onClick={stopCamera}
                        className="flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-600 transition-all">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : regSelfiePreview ? (
                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-xl border border-violet-500/30">
                      <img src={regSelfiePreview} alt="Selfie" className="w-full object-cover" />
                      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-emerald-500/90 px-2 py-1 text-xs font-medium text-white">
                        <CheckCircle className="h-3 w-3" /> Captured
                      </div>
                    </div>
                    <p className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" /> Face registered — auto-entry enabled
                    </p>
                    <button type="button" onClick={() => { setRegSelfie(null); setRegSelfiePreview(null); }}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                      Remove & retake
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={startCamera}
                        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-800/30 px-3 py-5 text-xs text-slate-400 hover:border-violet-500/50 hover:text-violet-400 transition-all">
                        <Camera className="h-5 w-5" /> Open Camera
                      </button>
                      <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-800/30 px-3 py-5 text-xs text-slate-400 hover:border-violet-500/50 hover:text-violet-400 transition-all cursor-pointer">
                        <Upload className="h-5 w-5" /> Upload Photo
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                      </label>
                    </div>
                    <p className="text-xs text-slate-600 text-center">Optional — enables face-based auto entry</p>
                  </div>
                )}
              </div>

              {/* ── Success card with real QR code ──────────────────────────── */}
              {regSuccess && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-emerald-400 flex-shrink-0" />
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-300">Registration Complete!</h3>
                      <p className="text-xs text-emerald-400/70">{regSuccess.name} has been pre-approved</p>
                    </div>
                  </div>

                  {/* QR code image */}
                  <div className="flex justify-center">
                    <div className="rounded-xl bg-white p-3 shadow-lg shadow-emerald-500/10">
                      <QRCodeSVG
                        value={regSuccess.qrToken}
                        size={160}
                        level="H"
                        includeMargin={false}
                        fgColor="#0f172a"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 uppercase tracking-wider">Pass Token</span>
                      <button onClick={() => navigator.clipboard.writeText(regSuccess.qrToken)}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </div>
                    <p className="font-mono text-sm font-bold text-blue-400 tracking-wide">{regSuccess.qrToken}</p>
                    <p className="text-xs text-slate-500">
                      {regSuccess.hasFace ? "✅ Face registered — auto-entry enabled" : "⚠ No face — QR scan required at gate"}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setQrModal({ token: regSuccess.qrToken, name: regSuccess.name })}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-all">
                      <ZoomIn className="h-3.5 w-3.5" /> Full QR
                    </button>
                    <button onClick={() => setRegSuccess(null)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 px-3 py-2.5 text-xs font-medium text-emerald-400 hover:bg-emerald-600/30 transition-all">
                      <UserPlus className="h-3.5 w-3.5" /> New Visitor
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: Gate Verification                                              */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "verify" && isGuard && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── QR Verify panel ─────────────────────────────────────────── */}
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/20">
                    <ScanLine className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-100">Verify at Gate</h2>
                    <p className="text-xs text-slate-500">Enter QR token to verify a visitor</p>
                  </div>
                </div>

                <form onSubmit={handleVerify} className="flex gap-3">
                  <div className="relative flex-1">
                    <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input type="text" required value={verifyQR} onChange={(e) => setVerifyQR(e.target.value)}
                      placeholder="VIS-20260409-XXXXXX"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/50 pl-10 pr-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all font-mono" />
                  </div>
                  <button type="submit" disabled={verifyLoading}
                    className="flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-all shadow-lg shadow-amber-600/20">
                    <ScanLine className="h-4 w-4" />
                    {verifyLoading ? "…" : "Verify"}
                  </button>
                </form>
              </div>

              {verifyError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-5 py-4 text-sm text-red-400">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {verifyError}
                  <button onClick={() => setVerifyError("")} className="ml-auto"><X className="h-4 w-4" /></button>
                </div>
              )}

              {verifyResult && (
                <div className={cn("rounded-2xl border overflow-hidden", alertColors[verifyResult.alert_level] || "border-slate-700 bg-slate-900/50")}>
                  <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {verifyResult.alert_level === "GREEN"  && <CheckCircle className="h-5 w-5 text-emerald-400" />}
                      {verifyResult.alert_level === "YELLOW" && <AlertTriangle className="h-5 w-5 text-amber-400" />}
                      {verifyResult.alert_level === "RED"    && <Ban className="h-5 w-5 text-red-400" />}
                      <span className="text-sm font-semibold text-slate-100">{verifyResult.message}</span>
                    </div>
                    <span className={cn("rounded-full border px-3 py-1 text-xs font-bold", alertColors[verifyResult.alert_level], alertTextColors[verifyResult.alert_level])}>
                      {verifyResult.alert_level}
                    </span>
                  </div>

                  {verifyResult.visitor && (
                    <div className="px-5 py-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><p className="text-xs text-slate-500 mb-0.5 uppercase tracking-wider">Name</p><p className="text-slate-200 font-medium">{verifyResult.visitor.name}</p></div>
                        <div><p className="text-xs text-slate-500 mb-0.5 uppercase tracking-wider">Purpose</p><p className="text-slate-200 font-medium">{verifyResult.visitor.purpose}</p></div>
                        <div><p className="text-xs text-slate-500 mb-0.5 uppercase tracking-wider">Host</p><p className="text-slate-200 font-medium">{verifyResult.visitor.hostName || "—"}</p></div>
                        <div><p className="text-xs text-slate-500 mb-0.5 uppercase tracking-wider">Face ID</p>
                          <p className={cn("font-medium text-sm", verifyResult.visitor.hasFace ? "text-emerald-400" : "text-slate-500")}>
                            {verifyResult.visitor.hasFace ? "✅ Registered" : "❌ Not set"}
                          </p>
                        </div>
                      </div>

                      {verifyResult.visitor.selfie && (
                        <div>
                          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Visitor Photo</p>
                          <img src={verifyResult.visitor.selfie} alt="Visitor selfie"
                            className="h-20 w-20 rounded-xl object-cover border border-slate-700 cursor-pointer hover:border-violet-500/50 transition-colors"
                            onClick={() => setSelfieModal({ src: verifyResult.visitor.selfie, name: verifyResult.visitor.name })} />
                        </div>
                      )}

                      {verifyResult.alert_level !== "RED" && verifyResult.visitor.status !== "CHECKED_IN" && (
                        <button onClick={() => { checkIn(verifyResult.visitor.id); setVerifyResult(null); setVerifyQR(""); }}
                          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20">
                          <UserCheck className="h-4 w-4" /> Approve & Check In
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Walk-in quick register ───────────────────────────────────── */}
            <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/20">
                  <UserPlus className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-100">Walk-in Registration</h2>
                  <p className="text-xs text-slate-500">Add an unregistered visitor on the spot — auto check-in</p>
                </div>
              </div>

              {walkinResult ? (
                <div className="space-y-4 text-center">
                  <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto" />
                  <p className="text-sm font-semibold text-emerald-300">{walkinResult.name} checked in!</p>

                  <div className="flex justify-center">
                    <div className="rounded-xl bg-white p-3 shadow-lg">
                      <QRCodeSVG value={walkinResult.qrToken} size={140} level="H" fgColor="#0f172a" />
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-3">
                    <p className="font-mono text-sm font-bold text-blue-400">{walkinResult.qrToken}</p>
                    <p className="text-xs text-slate-500 mt-1">Valid for 4 hours</p>
                  </div>

                  <button onClick={() => setWalkinResult(null)}
                    className="flex items-center justify-center gap-2 mx-auto rounded-xl bg-slate-800 border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-all">
                    <RefreshCw className="h-4 w-4" /> Register Another
                  </button>
                </div>
              ) : (
                <form onSubmit={handleWalkin} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Name *</label>
                      <input type="text" required value={walkinName} onChange={(e) => setWalkinName(e.target.value)}
                        placeholder="Visitor name"
                        className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Phone</label>
                      <input type="text" value={walkinPhone} onChange={(e) => setWalkinPhone(e.target.value)}
                        placeholder="+91 XXXXX"
                        className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Purpose *</label>
                    <input type="text" required value={walkinPurpose} onChange={(e) => setWalkinPurpose(e.target.value)}
                      placeholder="e.g. Delivery, Parent visit"
                      className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                  </div>

                  {/* Walk-in selfie */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Selfie (optional)</label>
                    {walkinCamActive ? (
                      <div className="space-y-2">
                        <video ref={walkinVideoRef} autoPlay playsInline muted className="w-full rounded-xl border border-slate-700 bg-black" />
                        <div className="flex gap-2">
                          <button type="button" onClick={captureWalkinPhoto}
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 transition-all">
                            <Camera className="h-3.5 w-3.5" /> Capture
                          </button>
                          <button type="button" onClick={() => { walkinStreamRef.current?.getTracks().forEach(t => t.stop()); setWalkinCamActive(false); }}
                            className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-600 transition-all">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : walkinPreview ? (
                      <div className="relative">
                        <img src={walkinPreview} alt="Walk-in selfie" className="w-full rounded-xl border border-emerald-500/30 object-cover max-h-32" />
                        <button type="button" onClick={() => { setWalkinSelfie(null); setWalkinPreview(null); }}
                          className="absolute top-2 right-2 rounded-lg bg-black/50 p-1 text-white hover:bg-black/70">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button type="button" onClick={startWalkinCamera}
                          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-800/30 px-3 py-3 text-xs text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400 transition-all">
                          <Camera className="h-4 w-4" /> Camera
                        </button>
                        <label className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-800/30 px-3 py-3 text-xs text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400 transition-all cursor-pointer">
                          <Upload className="h-4 w-4" /> Upload
                          <input ref={walkinFileRef} type="file" accept="image/*" className="hidden" onChange={handleWalkinFile} />
                        </label>
                      </div>
                    )}
                  </div>

                  <button type="submit" disabled={walkinLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-lg shadow-emerald-600/20">
                    <UserCheck className="h-4 w-4" />
                    {walkinLoading ? "Registering & Checking In…" : "Register & Check In Now"}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB: All Visitors                                                   */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === "all" && (
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Visitor Log</h2>
                <p className="text-xs text-slate-500 mt-0.5">{filteredVisitors.length} of {visitors.length} visitors</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search visitors…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-52 rounded-xl border border-slate-700 bg-slate-800/50 pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <button onClick={load}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-800/60">
                  <tr className="text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-3.5 text-left">Visitor</th>
                    <th className="px-5 py-3.5 text-left">Purpose</th>
                    <th className="px-5 py-3.5 text-left">Host</th>
                    <th className="px-5 py-3.5 text-left">Status</th>
                    <th className="px-5 py-3.5 text-left">QR Pass</th>
                    <th className="px-5 py-3.5 text-left">Face ID</th>
                    <th className="px-5 py-3.5 text-left">Time Window</th>
                    <th className="px-5 py-3.5 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredVisitors.map((v) => {
                    const cfg = statusConfig[v.status] || statusConfig.PENDING;
                    const Icon = cfg.icon;
                    const now = new Date();
                    const expired = v.timeEnd && new Date(v.timeEnd) < now;
                    const token = v.qrToken || v.passToken;
                    return (
                      <tr key={v.id} className="hover:bg-slate-800/20 transition-colors duration-150">
                        {/* Visitor */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            {v.selfie ? (
                              <button onClick={() => setSelfieModal({ src: v.selfie, name: v.name })}
                                className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg border border-slate-700 hover:border-violet-500/50 transition-colors group">
                                <img src={v.selfie} alt={v.name} className="h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <ZoomIn className="h-3 w-3 text-white" />
                                </div>
                              </button>
                            ) : (
                              <div className="h-9 w-9 flex-shrink-0 rounded-lg border border-slate-700 bg-slate-800 flex items-center justify-center">
                                <span className="text-xs font-bold text-slate-500">{v.name?.[0]?.toUpperCase() || "?"}</span>
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-slate-200">{v.name}</p>
                              <p className="text-xs text-slate-500">{v.phone || "No phone"}</p>
                            </div>
                          </div>
                        </td>

                        {/* Purpose */}
                        <td className="px-5 py-3.5 text-slate-400 text-sm">{v.purpose}</td>

                        {/* Host */}
                        <td className="px-5 py-3.5 text-slate-400 text-sm">{v.hostName || "—"}</td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", cfg.color)}>
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                        </td>

                        {/* QR pass */}
                        <td className="px-5 py-3.5">
                          {token ? (
                            <button
                              onClick={() => setQrModal({ token, name: v.name })}
                              className="flex items-center gap-1.5 rounded-lg bg-blue-600/10 border border-blue-500/20 px-2 py-1 text-xs font-mono text-blue-400 hover:bg-blue-600/20 hover:border-blue-500/40 transition-all group"
                              title="View QR Code"
                            >
                              <QrCode className="h-3 w-3 group-hover:scale-110 transition-transform" />
                              {token.split("-").slice(-1)[0]}
                            </button>
                          ) : <span className="text-slate-600 text-xs">—</span>}
                        </td>

                        {/* Face ID */}
                        <td className="px-5 py-3.5">
                          {v.hasFace ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                              <Fingerprint className="h-3 w-3" /> Yes
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600">No</span>
                          )}
                        </td>

                        {/* Time window */}
                        <td className="px-5 py-3.5">
                          <div className="text-xs space-y-0.5">
                            <p className="text-slate-500">{formatRelativeTime(new Date(v.createdAt))}</p>
                            {v.timeEnd && (
                              <p className={cn("font-medium", expired ? "text-red-400" : "text-emerald-400/70")}>
                                {expired ? "Expired" : `Until ${new Date(v.timeEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5">
                          <div className="flex gap-2">
                            {(v.status === "PENDING" || v.status === "PRE_APPROVED") && (
                              <button onClick={() => checkIn(v.id)}
                                className="flex items-center gap-1 rounded-lg bg-emerald-600/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-600/30 transition-colors">
                                <UserCheck className="h-3.5 w-3.5" /> Check In
                              </button>
                            )}
                            {v.status === "CHECKED_IN" && (
                              <button onClick={() => checkOut(v.id)}
                                className="flex items-center gap-1 rounded-lg bg-slate-700/50 border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors">
                                <UserX className="h-3.5 w-3.5" /> Check Out
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredVisitors.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-16 text-center">
                        <Users className="h-8 w-8 text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">
                          {search ? `No visitors match "${search}"` : "No visitors found"}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
