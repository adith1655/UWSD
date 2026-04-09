"use client";

import { useEffect, useState } from "react";
import Header from "@/components/header";
import { mockAccessLogs, mockWeeklyAlerts } from "@/lib/mock-data";
import { formatRelativeTime, cn } from "@/lib/utils";
import AlertBadge from "@/components/alert-badge";
import { api } from "@/lib/api";

export default function ReportsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [weekly, setWeekly] = useState<any[]>([]);

  useEffect(() => {
    api.getAccessLogs().then(setLogs).catch(() => setLogs(mockAccessLogs));
    api.getWeeklyAlerts().then(setWeekly).catch(() => setWeekly(mockWeeklyAlerts));
  }, []);

  const maxTotal = weekly.length ? Math.max(...weekly.map((d) => d.red + d.yellow + d.green)) : 1;

  return (
    <div className="min-h-screen">
      <Header title="Reports & Audit Trail" />

      <div className="p-6 space-y-6">
        {/* Weekly alert chart */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Weekly Alert Distribution</h3>
          <div className="flex items-end gap-3 h-40">
            {weekly.map((d, i) => {
              const total = d.red + d.yellow + d.green;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full flex flex-col-reverse items-stretch rounded overflow-hidden" style={{ height: "120px" }}>
                    <div className="bg-emerald-500/60" style={{ height: `${(d.green / maxTotal) * 100}%` }} title={`${d.green} green`} />
                    <div className="bg-amber-500/60"   style={{ height: `${(d.yellow / maxTotal) * 100}%` }} title={`${d.yellow} yellow`} />
                    <div className="bg-red-500/60"     style={{ height: `${(d.red / maxTotal) * 100}%` }} title={`${d.red} red`} />
                  </div>
                  <span className="text-[10px] text-slate-500">{d.day}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-5 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-500/60" />Critical</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-amber-500/60" />Warning</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-500/60" />Normal</span>
          </div>
        </div>

        {/* Access log table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-white">Access Audit Trail</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-800">
              <tr className="text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Person</th>
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-left">Camera</th>
                <th className="px-4 py-3 text-left">Confidence</th>
                <th className="px-4 py-3 text-left">Threat</th>
                <th className="px-4 py-3 text-left">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                        log.userName === "Unknown" || log.userName === "Unknown Visitor"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-slate-700 text-slate-300"
                      )}>
                        {log.userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </div>
                      <span className="font-medium text-slate-200">{log.userName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      log.eventType === "ENTRY"  ? "bg-blue-500/10 text-blue-400" :
                      log.eventType === "EXIT"   ? "bg-slate-500/10 text-slate-400" :
                      "bg-red-500/10 text-red-400"
                    )}>
                      {log.eventType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{log.cameraName}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {log.confidence > 0 ? `${(log.confidence * 100).toFixed(0)}%` : "No match"}
                  </td>
                  <td className="px-4 py-3"><AlertBadge level={log.threatLevel} size="sm" /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatRelativeTime(new Date(log.createdAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
