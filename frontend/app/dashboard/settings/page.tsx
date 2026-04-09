"use client";

import Header from "@/components/header";
import { Shield, Bell, Camera, Moon, Save } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="min-h-screen">
      <Header title="Settings" />

      <div className="p-6 max-w-2xl space-y-6">
        {/* Alert thresholds */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-white">Alert Settings</h3>
          </div>
          <div className="space-y-4">
            {[
              { label: "Unauthorized Entry Alert",    desc: "Trigger RED alert when unknown face detected", defaultOn: true },
              { label: "Vehicle Overstay Alert",      desc: "Trigger YELLOW after 2 hours unregistered", defaultOn: true },
              { label: "Parcel Escalation (48h)",     desc: "Escalate unclaimed parcels after 48 hours",  defaultOn: true },
              { label: "Camera Offline Alert",        desc: "Alert when camera goes offline for 30+ min", defaultOn: true },
              { label: "Night-Out Overdue Alert",     desc: "Alert when student doesn't return on time",  defaultOn: true },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">{s.label}</p>
                  <p className="text-xs text-slate-500">{s.desc}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" defaultChecked={s.defaultOn} className="peer sr-only" />
                  <div className="h-5 w-9 rounded-full bg-slate-700 peer-checked:bg-blue-600 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Camera settings */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Camera className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-white">Camera Settings</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Default Grid View</label>
              <select className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500">
                <option>3 columns</option>
                <option>2 columns</option>
                <option>4 columns</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Motion Detection Sensitivity</label>
              <input type="range" min="1" max="10" defaultValue="7" className="w-full accent-blue-500" />
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-white">Security Policy</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Night Curfew Time</label>
              <input type="time" defaultValue="22:00" className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Face Match Confidence Threshold (%)</label>
              <input type="number" defaultValue="85" min="50" max="100" className="w-32 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500" />
            </div>
          </div>
        </div>

        <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors">
          <Save className="h-4 w-4" /> Save Settings
        </button>
      </div>
    </div>
  );
}
