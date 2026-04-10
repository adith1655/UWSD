"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/header";
import { mockParcels, mockUsers } from "@/lib/mock-data";
import { formatRelativeTime, cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import {
  Package,
  CheckCircle,
  Search,
  Plus,
  Clock,
  Truck,
  ShieldCheck,
  AlertTriangle,
  X,
  ChevronRight,
  Hash,
  User,
  Box,
} from "lucide-react";

/* ── Status look-up ─────────────────────────────────────────────────────── */
const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: {
    label: "Pending",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    icon: Clock,
  },
  delivered: {
    label: "Delivered",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    icon: CheckCircle,
  },
};

/* ── Tab type ────────────────────────────────────────────────────────────── */
type Tab = "log" | "track" | "all";

export default function ParcelsPage() {
  /* ── shared state ──────────────────────────────────────────────────────── */
  const [parcels, setParcels] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>("all");

  /* ── "Log Parcel" form state (guard only) ──────────────────────────────── */
  const [logTrackingId, setLogTrackingId] = useState("");
  const [logStudentId, setLogStudentId] = useState("");
  const [logCourier, setLogCourier] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [logSuccess, setLogSuccess] = useState("");
  const [logError, setLogError] = useState("");
  const [students, setStudents] = useState<any[]>([]);

  /* ── "Track Parcel" state ──────────────────────────────────────────────── */
  const [searchTrackingId, setSearchTrackingId] = useState("");
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  /* ── verify feedback ───────────────────────────────────────────────────── */
  const [verifyLoading, setVerifyLoading] = useState<string | null>(null);

  /* ── helpers ────────────────────────────────────────────────────────────── */
  const isGuard   = currentUser?.role === "guard" || currentUser?.role === "admin" || currentUser?.role === "warden";
  const isStudent = currentUser?.role === "student";

  const load = useCallback(() => {
    if (isStudent) {
      api.getMyParcels().then(setParcels).catch(() =>
        setParcels((mockParcels as any).filter((p: any) => p.student_id === currentUser?.id))
      );
    } else {
      api.getParcels().then(setParcels).catch(() => setParcels(mockParcels as any));
    }
  }, [isStudent, currentUser?.id]);

  useEffect(() => {
    const stored = getStoredUser();
    const user = stored ?? { id: "u5", name: "Vikram Singh", role: "guard" };
    setCurrentUser(user);
    api.getUsers().then((u) => setStudents(u.filter((x: any) => x.role === "student"))).catch(() => {
      setStudents(mockUsers.filter((x: any) => x.role === "student"));
    });
    // Load parcels immediately with resolved user role
    if (user.role === "student") {
      api.getMyParcels().then(setParcels).catch(() =>
        setParcels((mockParcels as any).filter((p: any) => p.student_id === user.id))
      );
    } else {
      api.getParcels().then(setParcels).catch(() => setParcels(mockParcels as any));
    }
  }, []);

  /* ── Log parcel (guard) ────────────────────────────────────────────────── */
  const handleLogParcel = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogLoading(true);
    setLogError("");
    setLogSuccess("");
    try {
      const res = await api.addParcel({
        tracking_id: logTrackingId.trim(),
        student_id: logStudentId,
        courierName: logCourier.trim() || undefined,
      });
      setLogSuccess(`Parcel ${res.tracking_id} logged for ${res.recipientName}`);
      setLogTrackingId("");
      setLogStudentId("");
      setLogCourier("");
      load();
    } catch (err: any) {
      setLogError(err.message || "Failed to log parcel");
    } finally {
      setLogLoading(false);
    }
  };

  /* ── Search by tracking ID ─────────────────────────────────────────────── */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTrackingId.trim()) return;
    setSearchLoading(true);
    setSearchError("");
    setSearchResult(null);
    try {
      const res = await api.getParcelByTracking(searchTrackingId.trim());
      setSearchResult(res);
    } catch (err: any) {
      setSearchError(err.message || "Parcel not found");
    } finally {
      setSearchLoading(false);
    }
  };

  /* ── Verify / approve delivery (guard) ─────────────────────────────────── */
  const handleVerify = async (trackingId: string) => {
    setVerifyLoading(trackingId);
    try {
      await api.verifyParcel(trackingId);
      load();
      // refresh search result if it matches
      if (searchResult?.tracking_id === trackingId) {
        setSearchResult({ ...searchResult, status: "delivered", deliveredAt: new Date().toISOString() });
      }
    } catch {
    } finally {
      setVerifyLoading(null);
    }
  };

  /* ── Counts ────────────────────────────────────────────────────────────── */
  const pendingCount = parcels.filter((p) => p.status === "pending").length;
  const deliveredCount = parcels.filter((p) => p.status === "delivered").length;

  /* ── Tab definitions ───────────────────────────────────────────────────── */
  const tabs: { key: Tab; label: string; icon: any; guard?: boolean }[] = [
    ...(isGuard ? [{ key: "log" as Tab, label: "Log Parcel", icon: Plus, guard: true }] : []),
    { key: "track", label: "Track Parcel", icon: Search },
    { key: "all", label: "All Parcels", icon: Package },
  ];

  return (
    <div className="min-h-screen">
      <Header title="Parcel System" />

      <div className="p-6 space-y-6">
        {/* ── Stats strip ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50 p-5">
            <div className="absolute -right-3 -top-3 h-20 w-20 rounded-full bg-amber-500/5" />
            <Package className="h-5 w-5 text-amber-400 mb-2" />
            <p className="text-3xl font-bold text-amber-400">{pendingCount}</p>
            <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wider">Pending</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50 p-5">
            <div className="absolute -right-3 -top-3 h-20 w-20 rounded-full bg-emerald-500/5" />
            <CheckCircle className="h-5 w-5 text-emerald-400 mb-2" />
            <p className="text-3xl font-bold text-emerald-400">{deliveredCount}</p>
            <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wider">Delivered</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50 p-5">
            <div className="absolute -right-3 -top-3 h-20 w-20 rounded-full bg-blue-500/5" />
            <Box className="h-5 w-5 text-blue-400 mb-2" />
            <p className="text-3xl font-bold text-blue-400">{parcels.length}</p>
            <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wider">Total</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50 p-5">
            <div className="absolute -right-3 -top-3 h-20 w-20 rounded-full bg-violet-500/5" />
            <ShieldCheck className="h-5 w-5 text-violet-400 mb-2" />
            <p className="text-3xl font-bold text-violet-400 capitalize">{currentUser?.role ?? "—"}</p>
            <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wider">Role</p>
          </div>
        </div>

        {/* ── Tab bar ───────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-xl bg-slate-900/80 border border-slate-800 w-fit">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-blue-600/20 text-blue-400 shadow-lg shadow-blue-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── TAB: Log Parcel (guard only) ──────────────────────────────── */}
        {activeTab === "log" && isGuard && (
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20">
                <Plus className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Log New Parcel</h2>
                <p className="text-xs text-slate-500">Register an incoming parcel for a student</p>
              </div>
            </div>

            <form onSubmit={handleLogParcel} className="space-y-4 max-w-lg">
              {/* Tracking ID */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                  Tracking ID
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    id="parcel-tracking-input"
                    type="text"
                    required
                    value={logTrackingId}
                    onChange={(e) => setLogTrackingId(e.target.value)}
                    placeholder="e.g. FK-2026040901"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/50 pl-10 pr-4 py-3 text-sm text-slate-200 placeholder:text-slate-600
                               focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Student */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                  Student
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <select
                    id="parcel-student-select"
                    required
                    value={logStudentId}
                    onChange={(e) => setLogStudentId(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-800/50 pl-10 pr-4 py-3 text-sm text-slate-200
                               focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="">Select student…</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.room || "N/A"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Courier */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                  Courier (optional)
                </label>
                <div className="relative">
                  <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    id="parcel-courier-input"
                    type="text"
                    value={logCourier}
                    onChange={(e) => setLogCourier(e.target.value)}
                    placeholder="e.g. Amazon, Flipkart"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/50 pl-10 pr-4 py-3 text-sm text-slate-200 placeholder:text-slate-600
                               focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>

              {logError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {logError}
                </div>
              )}
              {logSuccess && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  {logSuccess}
                </div>
              )}

              <button
                id="parcel-log-submit"
                type="submit"
                disabled={logLoading}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white
                           hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                           shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30"
              >
                <Plus className="h-4 w-4" />
                {logLoading ? "Logging…" : "Log Parcel"}
              </button>
            </form>
          </div>
        )}

        {/* ── TAB: Track Parcel ─────────────────────────────────────────── */}
        {activeTab === "track" && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20">
                  <Search className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Track Parcel</h2>
                  <p className="text-xs text-slate-500">Enter your tracking ID to check parcel status</p>
                </div>
              </div>

              <form onSubmit={handleSearch} className="flex gap-3 max-w-lg">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    id="parcel-search-input"
                    type="text"
                    required
                    value={searchTrackingId}
                    onChange={(e) => setSearchTrackingId(e.target.value)}
                    placeholder="Enter tracking ID…"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/50 pl-10 pr-4 py-3 text-sm text-slate-200 placeholder:text-slate-600
                               focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
                  />
                </div>
                <button
                  id="parcel-search-submit"
                  type="submit"
                  disabled={searchLoading}
                  className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-medium text-white
                             hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                             shadow-lg shadow-violet-600/20 hover:shadow-violet-500/30"
                >
                  <Search className="h-4 w-4" />
                  {searchLoading ? "Searching…" : "Search"}
                </button>
              </form>
            </div>

            {/* Search error */}
            {searchError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-5 py-4 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {searchError}
                <button onClick={() => setSearchError("")} className="ml-auto text-red-500 hover:text-red-300">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Search result card */}
            {searchResult && (
              <div className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 overflow-hidden">
                {/* Header strip */}
                <div
                  className={cn(
                    "px-6 py-4 border-b",
                    searchResult.status === "delivered"
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : "bg-amber-500/5 border-amber-500/20"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-lg font-bold text-slate-100">{searchResult.tracking_id}</span>
                      <ChevronRight className="h-4 w-4 text-slate-600" />
                      <span className="text-sm text-slate-400">{searchResult.courierName}</span>
                    </div>
                    {(() => {
                      const cfg = statusConfig[searchResult.status] || statusConfig.pending;
                      const Icon = cfg.icon;
                      return (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                            cfg.color
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Details */}
                <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-5 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Recipient</p>
                    <p className="text-slate-200 font-medium">{searchResult.recipientName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Room</p>
                    <p className="text-slate-200 font-medium">{searchResult.room || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Logged By</p>
                    <p className="text-slate-200 font-medium">{searchResult.loggedBy}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Logged At</p>
                    <p className="text-slate-200 font-medium">
                      {formatRelativeTime(new Date(searchResult.timestamp))}
                    </p>
                  </div>
                  {searchResult.deliveredAt && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Delivered At</p>
                      <p className="text-emerald-400 font-medium">
                        {formatRelativeTime(new Date(searchResult.deliveredAt))}
                      </p>
                    </div>
                  )}
                </div>

                {/* Guard verify action */}
                {isGuard && searchResult.status === "pending" && (
                  <div className="px-6 pb-5">
                    <button
                      id="parcel-verify-btn"
                      onClick={() => handleVerify(searchResult.tracking_id)}
                      disabled={verifyLoading === searchResult.tracking_id}
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white
                                 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                                 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {verifyLoading === searchResult.tracking_id ? "Verifying…" : "Approve & Mark Delivered"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: All Parcels (logs table) ─────────────────────────────── */}
        {activeTab === "all" && (
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Parcel Logs</h2>
              <span className="text-xs text-slate-500">{parcels.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-800/60">
                  <tr className="text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-3.5 text-left">Tracking ID</th>
                    <th className="px-5 py-3.5 text-left">Recipient</th>
                    <th className="px-5 py-3.5 text-left">Courier</th>
                    <th className="px-5 py-3.5 text-left">Status</th>
                    <th className="px-5 py-3.5 text-left">Logged By</th>
                    <th className="px-5 py-3.5 text-left">Timestamp</th>
                    {isGuard && <th className="px-5 py-3.5 text-left">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {parcels.map((p) => {
                    const cfg = statusConfig[p.status] || statusConfig.pending;
                    const Icon = cfg.icon;
                    return (
                      <tr key={p.id} className="hover:bg-slate-800/20 transition-colors duration-150">
                        <td className="px-5 py-3.5 font-mono text-xs text-blue-400 font-medium">
                          {p.tracking_id}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-slate-200">{p.recipientName}</p>
                          <p className="text-xs text-slate-500">{p.room || "—"}</p>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400">{p.courierName}</td>
                        <td className="px-5 py-3.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                              cfg.color
                            )}
                          >
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-400">{p.loggedBy}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">
                          {formatRelativeTime(new Date(p.timestamp))}
                        </td>
                        {isGuard && (
                          <td className="px-5 py-3.5">
                            {p.status === "pending" && (
                              <button
                                onClick={() => handleVerify(p.tracking_id)}
                                disabled={verifyLoading === p.tracking_id}
                                className="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 px-3 py-1.5
                                           text-xs font-medium text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-50
                                           disabled:cursor-not-allowed transition-colors duration-200"
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                {verifyLoading === p.tracking_id ? "…" : "Approve"}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {parcels.length === 0 && (
                    <tr>
                      <td colSpan={isGuard ? 7 : 6} className="px-5 py-12 text-center text-slate-500">
                        No parcels found
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
