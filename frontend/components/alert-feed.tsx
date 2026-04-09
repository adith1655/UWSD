"use client";

import { useEffect, useState } from "react";
import { mockAlerts } from "@/lib/mock-data";
import { formatRelativeTime, getThreatColor, cn } from "@/lib/utils";
import AlertBadge from "./alert-badge";
import {
  AlertTriangle,
  UserX,
  Moon,
  Car,
  Camera,
  Package,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";

const alertTypeIcons: Record<string, any> = {
  UNAUTHORIZED_ENTRY:  UserX,
  UNREGISTERED_VISITOR: AlertTriangle,
  NIGHT_OUT_VIOLATION: Moon,
  VEHICLE_OVERSTAY:    Car,
  CAMERA_OFFLINE:      Camera,
  PARCEL_UNCLAIMED:    Package,
  AUTHORIZED_ACCESS:   CheckCircle2,
};

interface AlertFeedProps {
  limit?: number;
  showAll?: boolean;
}

export default function AlertFeed({ limit = 6, showAll = false }: AlertFeedProps) {
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    api
      .getAlerts(showAll ? undefined : limit)
      .then((data) => setAlerts(showAll ? data : data.slice(0, limit)))
      .catch(() => setAlerts(showAll ? mockAlerts : mockAlerts.slice(0, limit)));
  }, [limit, showAll]);

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const colors = getThreatColor(alert.level);
        const Icon = alertTypeIcons[alert.type] || AlertTriangle;

        return (
          <div
            key={alert.id}
            className={cn(
              "group flex items-start gap-3 rounded-lg border p-3 transition-all duration-200 hover:bg-slate-800/50",
              colors.border,
              colors.bg
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                alert.level === "RED"
                  ? "bg-red-500/20"
                  : alert.level === "YELLOW"
                  ? "bg-amber-500/20"
                  : "bg-emerald-500/20"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  alert.level === "RED"
                    ? "text-red-400"
                    : alert.level === "YELLOW"
                    ? "text-amber-400"
                    : "text-emerald-400"
                )}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <AlertBadge
                  level={alert.level}
                  size="sm"
                  pulse={alert.level === "RED" && !alert.acknowledgedBy}
                />
                <span className="text-xs text-slate-500">
                  {formatRelativeTime(new Date(alert.createdAt))}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-300">{alert.message}</p>
              {alert.acknowledgedBy && (
                <p className="mt-1 text-xs text-slate-500">Acknowledged by guard</p>
              )}
            </div>

            <button className="flex-shrink-0 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
