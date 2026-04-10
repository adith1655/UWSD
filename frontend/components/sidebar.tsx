"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getStoredUser, clearAuth, type UwsdUser } from "@/lib/auth";
import {
  LayoutDashboard,
  Video,
  Bell,
  Users,
  Moon,
  Package,
  Car,
  BarChart3,
  Settings,
  UserCog,
  Shield,
  LogOut,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ElementType };

const wardenNav: NavItem[] = [
  { href: "/dashboard",           label: "Overview",   icon: LayoutDashboard },
  { href: "/dashboard/live",      label: "Live Feed",  icon: Video },
  { href: "/dashboard/alerts",    label: "Alerts",     icon: Bell },
  { href: "/dashboard/visitors",  label: "Visitors",   icon: Users },
  { href: "/dashboard/night-out", label: "Outpass",    icon: Moon },
  { href: "/dashboard/parcels",   label: "Parcels",    icon: Package },
  { href: "/dashboard/vehicles",  label: "Vehicles",   icon: Car },
  { href: "/dashboard/reports",   label: "Reports",    icon: BarChart3 },
  { href: "/dashboard/settings",  label: "Settings",   icon: Settings },
  { href: "/dashboard/users",     label: "Users",      icon: UserCog },
];

const guardNav: NavItem[] = [
  { href: "/dashboard/live",    label: "Live Feed", icon: Video },
  { href: "/dashboard/parcels", label: "Parcels",   icon: Package },
  { href: "/dashboard/alerts",  label: "Alerts",    icon: Bell },
];

const studentNav: NavItem[] = [
  { href: "/dashboard/parcels",   label: "My Parcels", icon: Package },
  { href: "/dashboard/night-out", label: "Outpass",    icon: Moon },
];

function navForRole(role: UwsdUser["role"]): NavItem[] {
  if (role === "admin" || role === "warden") return wardenNav;
  if (role === "guard") return guardNav;
  return studentNav;
}

function roleLabel(role: UwsdUser["role"]): string {
  switch (role) {
    case "warden": return "Warden";
    case "guard":  return "Guard · On Duty";
    case "admin":  return "Admin";
    default:       return "Student";
  }
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [user, setUser] = useState<UwsdUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const navItems = user ? navForRole(user.role) : wardenNav;

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-950">
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">UWSD</h1>
          <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
            {user?.role === "student" ? "Student Portal" : "Surveillance System"}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-blue-600/10 text-blue-400"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              )}
            >
              <Icon
                className={cn("h-4.5 w-4.5", isActive ? "text-blue-400" : "text-slate-500")}
              />
              {item.label}
              {item.label === "Alerts" && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/20 px-1.5 text-[10px] font-bold text-red-400">
                  3
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">
            {user ? initials(user.name) : "??"}
          </div>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium text-slate-200">
              {user?.name ?? "Loading…"}
            </p>
            <p className="truncate text-xs text-slate-500">
              {user ? roleLabel(user.role) : ""}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
