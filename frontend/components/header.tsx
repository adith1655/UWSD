"use client";

import { useState, useEffect } from "react";
import { Bell, Search, Wifi } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { useAlerts } from "@/components/alert-provider";
import Link from "next/link";

export default function Header({ title }: { title: string }) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const { unread, clearUnread }       = useAlerts();

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>

      <div className="flex items-center gap-4">
        {searchOpen ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              autoFocus
              onBlur={() => setSearchOpen(false)}
              className="h-9 w-64 rounded-lg border border-slate-700 bg-slate-800 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500"
              placeholder="Search events, users..."
            />
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Search className="h-4 w-4" />
          </button>
        )}

        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5">
          <Wifi className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-emerald-400">System Online</span>
        </div>

        {/* Live alert bell */}
        <Link
          href="/dashboard/alerts"
          onClick={clearUnread}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <Bell className={unread > 0 ? "h-4 w-4 text-red-400" : "h-4 w-4"} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white animate-pulse">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>

        <div className="text-sm text-slate-400 font-mono">
          {currentTime ? formatTime(currentTime) : ""}
        </div>
      </div>
    </header>
  );
}
