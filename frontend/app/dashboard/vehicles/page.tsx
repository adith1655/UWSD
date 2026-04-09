"use client";

import { useEffect, useRef, useState } from "react";
import Header from "@/components/header";
import { mockVehicles } from "@/lib/mock-data";
import { formatRelativeTime, cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  Car, ShieldCheck, ShieldAlert, ShieldX, Upload, X,
  CheckCircle, AlertCircle, Loader2, Plus, Ban, UserPlus,
  Circle, ParkingCircle, LogOut, Zap,
} from "lucide-react";

type Vehicle = {
  id: string;
  licensePlate: string;
  ownerName: string;
  vehicleType: string;
  isRegistered: boolean;
  isBlacklisted: boolean;
  status: "PARKED" | "MOVING" | "EXITED";
  entryTime: string;
  exitTime: string | null;
};

type AnalysisResult = {
  framesProcessed: number;
  framesSampled: number;
  detectedPlates: string[];
  confirmedPlates: string[];
  added: string[];
  updated: string[];
  alreadyParked: string[];
};

function vehicleColor(v: Vehicle) {
  if (v.isBlacklisted) return "red";
  if (v.isRegistered)  return "green";
  return "yellow";
}

const rowBg: Record<string, string> = {
  red:    "bg-red-500/5 hover:bg-red-500/10",
  green:  "bg-emerald-500/5 hover:bg-emerald-500/10",
  yellow: "bg-amber-500/5 hover:bg-amber-500/10",
};

const leftBorder: Record<string, string> = {
  red:    "border-l-2 border-l-red-500",
  green:  "border-l-2 border-l-emerald-500",
  yellow: "border-l-2 border-l-amber-400",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "PARKED")
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400">
        <ParkingCircle className="h-3 w-3" /> PARKED
      </span>
    );
  if (status === "MOVING")
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-orange-500/10 text-orange-400 animate-pulse">
        <Zap className="h-3 w-3" /> MOVING
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-slate-500/10 text-slate-400">
      <LogOut className="h-3 w-3" /> EXITED
    </span>
  );
}

function RegistrationBadge({ v }: { v: Vehicle }) {
  if (v.isBlacklisted)
    return (
      <span className="inline-flex items-center gap-1 text-red-400 text-xs">
        <ShieldX className="h-3.5 w-3.5" /> Blacklisted
      </span>
    );
  if (v.isRegistered)
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
        <ShieldCheck className="h-3.5 w-3.5" /> Registered
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-amber-400 text-xs">
      <ShieldAlert className="h-3.5 w-3.5" /> Unknown
    </span>
  );
}

const VEHICLE_TYPES = ["Car", "Motorcycle", "Scooter", "Truck", "Van", "Bus"];

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    licensePlate: "", ownerName: "", vehicleType: "Car", isBlacklisted: false,
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    api.getVehicles().then((v) => setVehicles(v as Vehicle[])).catch(() => setVehicles(mockVehicles as Vehicle[]));
  }

  useEffect(() => { refresh(); }, []);

  const parked       = vehicles.filter((v) => v.status === "PARKED").length;
  const moving       = vehicles.filter((v) => v.status === "MOVING").length;
  const exited       = vehicles.filter((v) => v.status === "EXITED").length;
  const blacklisted  = vehicles.filter((v) => v.isBlacklisted).length;

  async function handleAddVehicle(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.licensePlate.trim() || !addForm.ownerName.trim()) return;
    setAddLoading(true);
    setAddError(null);
    setAddSuccess(null);
    try {
      const v = await api.registerVehicle(addForm);
      setAddSuccess(`${v.licensePlate} registered successfully.`);
      setAddForm({ licensePlate: "", ownerName: "", vehicleType: "Car", isBlacklisted: false });
      refresh();
    } catch (e: any) {
      setAddError(e.message || "Failed to register vehicle");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleToggleBlacklist(id: string) {
    try {
      await api.toggleBlacklist(id);
      refresh();
    } catch {}
  }

  async function handleAnalyze() {
    if (!file) return;
    setAnalyzing(true);
    setResult(null);
    setAnalyzeError(null);
    try {
      const res: AnalysisResult = await api.analyzeVehicleVideo(file);
      setResult(res);
      refresh();
    } catch (e: any) {
      setAnalyzeError(e.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type.startsWith("video/")) setFile(dropped);
  }

  return (
    <div className="min-h-screen">
      <Header title="Vehicle Tracking" />

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-2xl font-bold text-blue-400">{parked}</p>
            <p className="text-xs text-slate-400 mt-1">Currently Parked</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-2xl font-bold text-orange-400">{moving}</p>
            <p className="text-xs text-slate-400 mt-1">Moving on Campus</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-2xl font-bold text-slate-400">{exited}</p>
            <p className="text-xs text-slate-400 mt-1">Exited Today</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-2xl font-bold text-red-400">{blacklisted}</p>
            <p className="text-xs text-slate-400 mt-1">Blacklisted</p>
          </div>
        </div>

        {/* Color legend */}
        <div className="flex items-center gap-6 px-1 text-xs text-slate-400">
          <span className="font-semibold text-slate-300">Color key:</span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
            <span className="text-emerald-400">Registered</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" />
            <span className="text-amber-400">Unknown</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />
            <span className="text-red-400">Blacklisted</span>
          </span>
        </div>

        {/* Add Known Vehicle */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <button
            onClick={() => { setShowAddForm(!showAddForm); setAddError(null); setAddSuccess(null); }}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-slate-200 hover:bg-slate-800/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-blue-400" />
              Add Known Vehicle to Database
            </span>
            <span className="text-slate-500 text-xs">{showAddForm ? "▲ collapse" : "▼ expand"}</span>
          </button>

          {showAddForm && (
            <form onSubmit={handleAddVehicle} className="border-t border-slate-800 px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">License Plate *</label>
                  <input
                    required
                    value={addForm.licensePlate}
                    onChange={(e) => setAddForm({ ...addForm, licensePlate: e.target.value.toUpperCase() })}
                    placeholder="e.g. RJ14 AB 1234"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-mono text-slate-200 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Owner Name *</label>
                  <input
                    required
                    value={addForm.ownerName}
                    onChange={(e) => setAddForm({ ...addForm, ownerName: e.target.value })}
                    placeholder="e.g. Dr. Rakesh Tiwari"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Vehicle Type</label>
                  <select
                    value={addForm.vehicleType}
                    onChange={(e) => setAddForm({ ...addForm, vehicleType: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                  >
                    {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addForm.isBlacklisted}
                      onChange={(e) => setAddForm({ ...addForm, isBlacklisted: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-600 accent-red-500"
                    />
                    <span className="text-sm text-red-400">Mark as Blacklisted</span>
                  </label>
                </div>
              </div>

              {addError && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {addError}
                </p>
              )}
              {addSuccess && (
                <p className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> {addSuccess}
                </p>
              )}

              <button
                type="submit"
                disabled={addLoading}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
              >
                {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {addLoading ? "Saving…" : "Register Vehicle"}
              </button>
            </form>
          )}
        </div>

        {/* Vehicle Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-800">
              <tr className="text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">License Plate</th>
                <th className="px-4 py-3 text-left">Owner</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Registration</th>
                <th className="px-4 py-3 text-left">Entry Time</th>
                <th className="px-4 py-3 text-left">Exit Time</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {vehicles.map((v) => {
                const color = vehicleColor(v);
                return (
                  <tr key={v.id} className={cn("transition-colors", rowBg[color], leftBorder[color])}>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-200">{v.licensePlate}</td>
                    <td className="px-4 py-3 text-slate-300">{v.ownerName}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Car className="h-3.5 w-3.5" /> {v.vehicleType}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                    <td className="px-4 py-3"><RegistrationBadge v={v} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatRelativeTime(new Date(v.entryTime))}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{v.exitTime ? formatRelativeTime(new Date(v.exitTime)) : "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleBlacklist(v.id)}
                        title={v.isBlacklisted ? "Remove from blacklist" : "Blacklist vehicle"}
                        className={cn(
                          "inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
                          v.isBlacklisted
                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            : "bg-slate-700/60 text-slate-400 hover:bg-red-500/20 hover:text-red-400"
                        )}
                      >
                        <Ban className="h-3 w-3" />
                        {v.isBlacklisted ? "Unblacklist" : "Blacklist"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Video Demo Analysis */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-200">Demo Video Analysis</h2>
            <span className="text-xs text-slate-500">— upload a video to detect &amp; log number plates</span>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => !file && inputRef.current?.click()}
            className={cn(
              "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer",
              file ? "border-blue-500/40 bg-blue-500/5" : "border-slate-700 hover:border-slate-600"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <>
                <Car className="h-8 w-8 text-blue-400" />
                <p className="text-sm font-medium text-slate-200">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); setAnalyzeError(null); }}
                  className="absolute top-2 right-2 text-slate-500 hover:text-slate-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-slate-600" />
                <p className="text-sm text-slate-400">Drop a video here or click to browse</p>
                <p className="text-xs text-slate-600">MP4, AVI, MOV, MKV supported</p>
              </>
            )}
          </div>

          {file && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {analyzing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</>
              ) : (
                <><Upload className="h-4 w-4" /> Analyze Video</>
              )}
            </button>
          )}

          {analyzeError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" /> {analyzeError}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="rounded-lg bg-slate-800/60 px-3 py-2">
                  <p className="text-lg font-bold text-slate-200">{result.framesSampled}</p>
                  <p className="text-slate-500">Frames sampled</p>
                </div>
                <div className="rounded-lg bg-slate-800/60 px-3 py-2">
                  <p className="text-lg font-bold text-slate-200">{result.detectedPlates.length}</p>
                  <p className="text-slate-500">Plates detected</p>
                </div>
                <div className="rounded-lg bg-slate-800/60 px-3 py-2">
                  <p className="text-lg font-bold text-emerald-400">{result.confirmedPlates.length}</p>
                  <p className="text-slate-500">Confirmed</p>
                </div>
              </div>

              {result.added.length > 0 && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-1">
                  <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Added to database ({result.added.length})
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {result.added.map((p) => (
                      <span key={p} className="font-mono text-xs bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {result.updated.length > 0 && (
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 space-y-1">
                  <p className="text-xs font-semibold text-blue-400 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Re-entry logged ({result.updated.length})
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {result.updated.map((p) => (
                      <span key={p} className="font-mono text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {result.alreadyParked.length > 0 && (
                <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 space-y-1">
                  <p className="text-xs font-semibold text-slate-400">Already parked — no change ({result.alreadyParked.length})</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {result.alreadyParked.map((p) => (
                      <span key={p} className="font-mono text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {result.confirmedPlates.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-2">No license plates were confidently detected in the video.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
