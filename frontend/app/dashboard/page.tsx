"use client";

import { useEffect, useState } from "react";
import Header from "@/components/header";
import StatCard from "@/components/stat-card";
import AlertFeed from "@/components/alert-feed";
import CameraGrid from "@/components/camera-grid";
import { mockDashboardStats, mockHourlyTraffic, mockAccessLogs } from "@/lib/mock-data";
import { formatRelativeTime, cn } from "@/lib/utils";
import AlertBadge from "@/components/alert-badge";
import {
  ShieldAlert,
  Bell,
  Camera,
  Moon,
  Package,
  Users,
  UserX,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [traffic, setTraffic] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    api.getDashboardStats().then(setStats).catch(() => setStats(mockDashboardStats));
    api.getHourlyTraffic().then(setTraffic).catch(() => setTraffic(mockHourlyTraffic));
    api.getAccessLogs().then(setLogs).catch(() => setLogs(mockAccessLogs));
  }, []);

  if (!stats) {
    return (
      <div className="min-h-screen">
        <Header title="Dashboard Overview" />
        <div className="flex items-center justify-center h-64">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  const redAlerts = stats.activeAlerts;
  const offlineCameras = stats.camerasTotal - stats.camerasOnline;

  return (
    <div className="min-h-screen">
      <Header title="Dashboard Overview" />

      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Entries Today"
            value={stats.totalEntriesToday}
            change="↑ 12% vs yesterday"
            changeType="positive"
            icon={Activity}
            iconColor="text-blue-400"
          />
          <StatCard
            label="Active Alerts"
            value={stats.activeAlerts}
            change="2 RED · 1 YELLOW"
            changeType="negative"
            icon={Bell}
            iconColor="text-red-400"
          />
          <StatCard
            label="Cameras Online"
            value={`${stats.camerasOnline}/${stats.camerasTotal}`}
            change={`${offlineCameras} offline/maintenance`}
            changeType="neutral"
            icon={Camera}
            iconColor="text-emerald-400"
          />
          <StatCard
            label="Unauthorized Attempts"
            value={stats.unauthorizedAttempts}
            change="↓ 90% this month"
            changeType="positive"
            icon={UserX}
            iconColor="text-amber-400"
          />
        </div>

        {/* Second row stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Night-Out Active"
            value={stats.nightOutActive}
            change="0 overdue"
            changeType="positive"
            icon={Moon}
            iconColor="text-indigo-400"
          />
          <StatCard
            label="Parcels Pending"
            value={stats.parcelsUnclaimed}
            change="1 escalated (48h+)"
            changeType="negative"
            icon={Package}
            iconColor="text-orange-400"
          />
          <StatCard
            label="Visitors on Campus"
            value={stats.visitorsOnCampus}
            change="1 pre-registered pending"
            changeType="neutral"
            icon={Users}
            iconColor="text-cyan-400"
          />
          <StatCard
            label="Threat Level"
            value={redAlerts > 0 ? "ELEVATED" : "NORMAL"}
            change={redAlerts > 0 ? `${redAlerts} active RED alerts` : "All clear"}
            changeType={redAlerts > 0 ? "negative" : "positive"}
            icon={ShieldAlert}
            iconColor={redAlerts > 0 ? "text-red-400" : "text-emerald-400"}
          />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Alert Feed */}
          <div className="lg:col-span-1 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Recent Alerts</h3>
              <Link
                href="/dashboard/alerts"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                View All
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <AlertFeed limit={5} />
          </div>

          {/* Traffic Chart */}
          <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Today&apos;s Traffic</h3>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Entries
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-500" />
                  Exits
                </span>
              </div>
            </div>
            <div className="flex items-end gap-1 h-48">
              {traffic.map((hour, i) => {
                const maxVal = Math.max(...traffic.map((h) => Math.max(h.entries, h.exits)));
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="w-full flex gap-0.5 items-end" style={{ height: "160px" }}>
                      <div
                        className="flex-1 rounded-t bg-blue-500/80 transition-all group-hover:bg-blue-400"
                        style={{ height: `${(hour.entries / maxVal) * 100}%` }}
                        title={`${hour.entries} entries`}
                      />
                      <div
                        className="flex-1 rounded-t bg-slate-600/80 transition-all group-hover:bg-slate-500"
                        style={{ height: `${(hour.exits / maxVal) * 100}%` }}
                        title={`${hour.exits} exits`}
                      />
                    </div>
                    <span className="text-[8px] text-slate-600 group-hover:text-slate-400 transition-colors">
                      {hour.hour}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Camera Preview + Recent Logs */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Camera Preview */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Camera Feeds</h3>
              <Link
                href="/dashboard/live"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                Full View
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <CameraGrid columns={2} limit={4} />
          </div>

          {/* Recent Access Logs */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Recent Access Logs</h3>
              <Link
                href="/dashboard/reports"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                Full Audit Trail
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-800/50 bg-slate-800/20 px-3 py-2.5"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                      log.userName === "Unknown" || log.userName === "Unknown Visitor"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-slate-700 text-slate-300"
                    )}
                  >
                    {log.userName
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{log.userName}</p>
                    <p className="text-xs text-slate-500">
                      {log.cameraName} · {log.confidence > 0 ? `${(log.confidence * 100).toFixed(0)}% match` : "No match"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <AlertBadge level={log.threatLevel} size="sm" />
                    <p className="mt-1 text-[10px] text-slate-600">
                      {formatRelativeTime(new Date(log.createdAt))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
