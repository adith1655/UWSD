"use client";

import { useEffect, useState } from "react";
import Header from "@/components/header";
import { mockNightOutRequests } from "@/lib/mock-data";
import { formatRelativeTime, cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { CheckCircle, XCircle, Clock, AlertTriangle, Plus, Send, X } from "lucide-react";

const statusConfig: Record<string, { color: string; icon: any }> = {
  PENDING:  { color: "text-amber-400 bg-amber-500/10 border-amber-500/30",      icon: Clock },
  APPROVED: { color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle },
  REJECTED: { color: "text-red-400 bg-red-500/10 border-red-500/30",             icon: XCircle },
  OVERDUE:  { color: "text-orange-400 bg-orange-500/10 border-orange-500/30",    icon: AlertTriangle },
};

/* ─── Warden / Admin view ─────────────────────────────────────────────────── */
function WardenView() {
  const [requests, setRequests] = useState<any[]>([]);

  const load = () =>
    api.getNightOuts().then(setRequests).catch(() => setRequests(mockNightOutRequests));

  useEffect(() => { load(); }, []);

  const approve = async (id: string) => { await api.approveNightOut(id).catch(() => {}); load(); };
  const reject  = async (id: string) => { await api.rejectNightOut(id).catch(() => {}); load(); };

  return (
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
            <div key={req.id} className={cn(
              "rounded-xl border bg-slate-900/50 p-4",
              req.status === "OVERDUE" ? "border-orange-500/30" : "border-slate-800"
            )}>
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
        {requests.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-12">No outpass requests found.</p>
        )}
      </div>
    </div>
  );
}

/* ─── Student view ────────────────────────────────────────────────────────── */
function StudentView({ user }: { user: any }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [reason,      setReason]      = useState("");
  const [destination, setDestination] = useState("");
  const [leaveDate,   setLeaveDate]   = useState("");
  const [returnDate,  setReturnDate]  = useState("");
  const [returnTime,  setReturnTime]  = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [submitMsg,   setSubmitMsg]   = useState("");

  const load = () =>
    api.getMyNightOuts().then(setRequests).catch(() => {
      // fallback: filter mock by student id
      setRequests(mockNightOutRequests.filter((r: any) => r.studentId === user.id));
    });

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitMsg("");
    try {
      await api.createNightOut({
        studentId:   user.id,
        studentName: user.name,
        room:        user.room ?? "",
        reason,
        destination,
        leaveDate,
        returnDate,
        returnTime,
      });
      setSubmitMsg("Request submitted! Awaiting warden approval.");
      setReason(""); setDestination(""); setLeaveDate(""); setReturnDate(""); setReturnTime("");
      setShowForm(false);
      load();
    } catch (err: any) {
      setSubmitMsg(err.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
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

      {/* Success banner */}
      {submitMsg && !showForm && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <span>{submitMsg}</span>
          <button onClick={() => setSubmitMsg("")}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* New request button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20"
        >
          <Plus className="h-4 w-4" /> New Outpass Request
        </button>
      )}

      {/* New request form */}
      {showForm && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-100">New Outpass Request</h2>
            <button onClick={() => { setShowForm(false); setSubmitMsg(""); }} className="text-slate-500 hover:text-slate-300">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Reason</label>
              <input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Medical appointment"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Destination</label>
              <input
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Jaipur City Hospital"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Leave Date</label>
                <input
                  required
                  type="date"
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Return Date</label>
                <input
                  required
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Expected Return Time</label>
              <input
                required
                type="time"
                value={returnTime}
                onChange={(e) => setReturnTime(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {submitMsg && (
              <p className="text-xs text-red-400">{submitMsg}</p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/20"
              >
                <Send className="h-4 w-4" />
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-medium text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* My requests */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-400">My Requests</h3>
        {requests.map((req) => {
          const { color, icon: Icon } = statusConfig[req.status] || statusConfig.PENDING;
          return (
            <div key={req.id} className={cn(
              "rounded-xl border bg-slate-900/50 p-4",
              req.status === "OVERDUE" ? "border-orange-500/30 animate-pulse-subtle" : "border-slate-800"
            )}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", color)}>
                      <Icon className="h-3 w-3" />
                      {req.status}
                    </span>
                    <span className="text-xs text-slate-500">{formatRelativeTime(new Date(req.createdAt))}</span>
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
                    <p className="text-xs text-slate-500 mt-1">
                      {req.status === "APPROVED" ? "Approved" : "Handled"} by: {req.approvedBy}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {requests.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-8">
            No outpass requests yet. Click "New Outpass Request" to submit one.
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function NightOutPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen">
        <Header title="Outpass / Night-Out" />
        <div className="flex items-center justify-center h-64">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  const isWarden = user.role === "warden" || user.role === "admin";

  return (
    <div className="min-h-screen">
      <Header title={isWarden ? "Outpass Requests — Warden View" : "My Outpass Requests"} />
      {isWarden ? <WardenView /> : <StudentView user={user} />}
    </div>
  );
}
