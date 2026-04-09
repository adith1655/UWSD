"use client";

import { useEffect, useState } from "react";
import Header from "@/components/header";
import { mockNightOutRequests } from "@/lib/mock-data";
import { formatRelativeTime, cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";

const statusConfig: Record<string, { color: string; icon: any }> = {
  PENDING:  { color: "text-amber-400 bg-amber-500/10 border-amber-500/30",   icon: Clock },
  APPROVED: { color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle },
  REJECTED: { color: "text-red-400 bg-red-500/10 border-red-500/30",         icon: XCircle },
  OVERDUE:  { color: "text-orange-400 bg-orange-500/10 border-orange-500/30",icon: AlertTriangle },
};

export default function NightOutPage() {
  const [requests, setRequests] = useState<any[]>([]);

  const load = () => api.getNightOuts().then(setRequests).catch(() => setRequests(mockNightOutRequests));

  useEffect(() => { load(); }, []);

  const approve = async (id: string) => { await api.approveNightOut(id).catch(() => {}); load(); };
  const reject  = async (id: string) => { await api.rejectNightOut(id).catch(() => {}); load(); };

  return (
    <div className="min-h-screen">
      <Header title="Night-Out Requests" />

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {(["PENDING", "APPROVED", "REJECTED", "OVERDUE"] as const).map((s) => {
            const { color, icon: Icon } = statusConfig[s];
            const count = requests.filter((r) => r.status === s).length;
            return (
              <div key={s} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <p className={cn("text-2xl font-bold", color.split(" ")[0])}>{count}</p>
                <p className="text-xs text-slate-400 mt-1">{s}</p>
              </div>
            );
          })}
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {requests.map((req) => {
            const { color, icon: Icon } = statusConfig[req.status] || statusConfig.PENDING;
            return (
              <div key={req.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-semibold text-slate-200">{req.studentName}</p>
                      <span className="text-xs text-slate-500">Room {req.room}</span>
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", color)}>
                        <Icon className="h-3 w-3" />
                        {req.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 mb-1">
                      <span className="text-slate-500">Reason:</span> {req.reason}
                    </p>
                    <p className="text-sm text-slate-300 mb-1">
                      <span className="text-slate-500">Destination:</span> {req.destination}
                    </p>
                    <p className="text-xs text-slate-500">
                      Leave: {req.leaveDate} → Return: {req.returnDate} by {req.returnTime}
                    </p>
                    {req.approvedBy && (
                      <p className="text-xs text-slate-500 mt-1">By: {req.approvedBy}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-slate-500">{formatRelativeTime(new Date(req.createdAt))}</span>
                    {req.status === "PENDING" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => approve(req.id)}
                          className="rounded-lg bg-emerald-600/20 border border-emerald-500/30 px-3 py-1 text-xs text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => reject(req.id)}
                          className="rounded-lg bg-red-600/20 border border-red-500/30 px-3 py-1 text-xs text-red-400 hover:bg-red-600/30 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
