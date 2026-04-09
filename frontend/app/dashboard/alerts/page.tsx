"use client";

import { useEffect, useState } from "react";
import Header from "@/components/header";
import AlertBadge from "@/components/alert-badge";
import { mockAlerts } from "@/lib/mock-data";
import { formatRelativeTime, getThreatColor, cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { AlertTriangle, UserX, Moon, Car, Camera, Package, CheckCircle2, Check } from "lucide-react";

const alertTypeIcons: Record<string, any> = {
  UNAUTHORIZED_ENTRY:   UserX,
  UNREGISTERED_VISITOR: AlertTriangle,
  NIGHT_OUT_VIOLATION:  Moon,
  VEHICLE_OVERSTAY:     Car,
  CAMERA_OFFLINE:       Camera,
  PARCEL_UNCLAIMED:     Package,
  AUTHORIZED_ACCESS:    CheckCircle2,
};

const LEVELS = ["ALL", "RED", "YELLOW", "GREEN"] as const;

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("ALL");

  const load = () => api.getAlerts().then(setAlerts).catch(() => setAlerts(mockAlerts));

  useEffect(() => { load(); }, []);

  const acknowledge = async (id: string) => {
    await api.acknowledgeAlert(id).catch(() => {});
    load();
  };

  const displayed = filter === "ALL" ? alerts : alerts.filter((a) => a.level === filter);

  const counts = {
    RED:    alerts.filter((a) => a.level === "RED"    && !a.acknowledgedBy).length,
    YELLOW: alerts.filter((a) => a.level === "YELLOW" && !a.acknowledgedBy).length,
  };

  return (
    <div className="min-h-screen">
      <Header title="Alerts" />

      <div className="p-6 space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Critical (RED)",    count: alerts.filter((a) => a.level === "RED").length,    color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30" },
            { label: "Warning (YELLOW)",  count: alerts.filter((a) => a.level === "YELLOW").length, color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30" },
            { label: "Info (GREEN)",      count: alerts.filter((a) => a.level === "GREEN").length,  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
          ].map((s) => (
            <div key={s.label} className={cn("rounded-xl border p-4", s.bg, s.border)}>
              <p className={cn("text-2xl font-bold", s.color)}>{s.count}</p>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {LEVELS.map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-xs font-medium transition-colors",
                filter === lvl
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-slate-200"
              )}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Alert list */}
        <div className="space-y-2">
          {displayed.map((alert) => {
            const colors = getThreatColor(alert.level);
            const Icon = alertTypeIcons[alert.type] || AlertTriangle;
            return (
              <div
                key={alert.id}
                className={cn(
                  "flex items-start gap-4 rounded-xl border p-4",
                  colors.border, colors.bg
                )}
              >
                <div className={cn(
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                  alert.level === "RED" ? "bg-red-500/20" : alert.level === "YELLOW" ? "bg-amber-500/20" : "bg-emerald-500/20"
                )}>
                  <Icon className={cn("h-4 w-4", alert.level === "RED" ? "text-red-400" : alert.level === "YELLOW" ? "text-amber-400" : "text-emerald-400")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertBadge level={alert.level} size="sm" pulse={alert.level === "RED" && !alert.acknowledgedBy} />
                    <span className="text-xs text-slate-500">{alert.type.replace(/_/g, " ")}</span>
                    <span className="ml-auto text-xs text-slate-500">{formatRelativeTime(new Date(alert.createdAt))}</span>
                  </div>
                  <p className="text-sm text-slate-200">{alert.message}</p>
                  {alert.acknowledgedBy && (
                    <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Acknowledged
                    </p>
                  )}
                </div>
                {!alert.acknowledgedBy && (
                  <button
                    onClick={() => acknowledge(alert.id)}
                    className="flex-shrink-0 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            );
          })}
          {displayed.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-500">No alerts for this filter.</p>
          )}
        </div>
      </div>
    </div>
  );
}
