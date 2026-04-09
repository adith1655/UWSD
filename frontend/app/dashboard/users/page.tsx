"use client";

import { useEffect, useState } from "react";
import Header from "@/components/header";
import { mockUsers } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Shield, GraduationCap, UserCog, Eye } from "lucide-react";

const roleConfig: Record<string, { color: string; icon: any }> = {
  admin:   { color: "text-purple-400 bg-purple-500/10 border-purple-500/30", icon: Shield },
  warden:  { color: "text-blue-400 bg-blue-500/10 border-blue-500/30",       icon: UserCog },
  guard:   { color: "text-amber-400 bg-amber-500/10 border-amber-500/30",    icon: Eye },
  student: { color: "text-slate-300 bg-slate-500/10 border-slate-500/30",    icon: GraduationCap },
};

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => setUsers(mockUsers));
  }, []);

  return (
    <div className="min-h-screen">
      <Header title="Users" />

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {(["admin", "warden", "guard", "student"] as const).map((role) => {
            const { color, icon: Icon } = roleConfig[role];
            const count = users.filter((u) => u.role === role).length;
            return (
              <div key={role} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn("h-4 w-4", color.split(" ")[0])} />
                  <span className="text-xs text-slate-400 capitalize">{role}s</span>
                </div>
                <p className={cn("text-2xl font-bold", color.split(" ")[0])}>{count}</p>
              </div>
            );
          })}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-800">
              <tr className="text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Room</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {users.map((u) => {
                const { color, icon: Icon } = roleConfig[u.role] || roleConfig.student;
                return (
                  <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-200">
                          {u.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="font-medium text-slate-200">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize", color)}>
                        <Icon className="h-3 w-3" />
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{u.room || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        u.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                      )}>
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
