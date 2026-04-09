"use client";

import {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Info, X, Bell } from "lucide-react";

const WS_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001").replace("http", "ws");

// ─── Toast types ─────────────────────────────────────────────────────────────
export interface Toast {
  id:      string;
  level:   "RED" | "YELLOW" | "GREEN" | "INFO";
  title:   string;
  message: string;
}

interface AlertCtx {
  toasts:   Toast[];
  dismiss:  (id: string) => void;
  push:     (t: Omit<Toast, "id">) => void;
  unread:   number;
  clearUnread: () => void;
}

const AlertContext = createContext<AlertCtx>({
  toasts: [], dismiss: () => {}, push: () => {}, unread: 0, clearUnread: () => {},
});

export function useAlerts() {
  return useContext(AlertContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [toasts,  setToasts]  = useState<Toast[]>([]);
  const [unread,  setUnread]  = useState(0);
  const wsRef  = useRef<WebSocket | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast: Toast = { ...t, id };
    setToasts(prev => [toast, ...prev].slice(0, 6));
    setUnread(n => n + 1);

    // Play beep for RED
    if (t.level === "RED") {
      try {
        const ctx = audioRef.current ?? new AudioContext();
        audioRef.current = ctx;
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type      = "square";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      } catch {}
    }

    // Auto-dismiss after delay
    const delay = t.level === "RED" ? 8000 : t.level === "YELLOW" ? 5000 : 3500;
    setTimeout(() => dismiss(id), delay);
  }, [dismiss]);

  // Connect to alert WebSocket
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const token = localStorage.getItem("uwsd_token");
      if (!token) {
        retryTimer = setTimeout(connect, 3000);
        return;
      }

      const ws = new WebSocket(`${WS_URL}/ws/alerts`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const { type, data } = JSON.parse(e.data);
          if (type === "alert") {
            push({
              level:   data.level as Toast["level"],
              title:   data.type.replace(/_/g, " "),
              message: data.message,
            });
          }
        } catch {}
      };

      ws.onclose = () => {
        retryTimer = setTimeout(connect, 4000);  // reconnect
      };

      // Keep-alive ping every 20 s
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 20000);

      ws.onclose = () => {
        clearInterval(ping);
        retryTimer = setTimeout(connect, 4000);
      };
    };

    connect();
    return () => {
      clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, [push]);

  return (
    <AlertContext.Provider value={{ toasts, dismiss, push, unread, clearUnread: () => setUnread(0) }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </AlertContext.Provider>
  );
}

// ─── Toast container ──────────────────────────────────────────────────────────
const levelStyle = {
  RED:    { bg: "bg-red-950 border-red-500/60",    icon: AlertTriangle, iconCls: "text-red-400",    bar: "bg-red-500" },
  YELLOW: { bg: "bg-amber-950 border-amber-500/60", icon: AlertTriangle, iconCls: "text-amber-400",  bar: "bg-amber-500" },
  GREEN:  { bg: "bg-emerald-950 border-emerald-500/50", icon: CheckCircle2, iconCls: "text-emerald-400", bar: "bg-emerald-500" },
  INFO:   { bg: "bg-slate-900 border-slate-700",   icon: Info,          iconCls: "text-blue-400",   bar: "bg-blue-500" },
};

function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-80">
      {toasts.map(t => {
        const s    = levelStyle[t.level] ?? levelStyle.INFO;
        const Icon = s.icon;
        return (
          <div
            key={t.id}
            className={cn(
              "relative overflow-hidden rounded-xl border shadow-2xl shadow-black/50",
              "animate-in slide-in-from-right-5 fade-in duration-300",
              s.bg,
            )}
          >
            {/* coloured top bar */}
            <div className={cn("h-0.5 w-full", s.bar)} />
            <div className="flex items-start gap-3 px-4 py-3">
              <Icon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", s.iconCls)} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300">{t.title}</p>
                <p className="mt-0.5 text-sm text-slate-200 leading-snug">{t.message}</p>
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="flex-shrink-0 text-slate-600 hover:text-slate-400 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
