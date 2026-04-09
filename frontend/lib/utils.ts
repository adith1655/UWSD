import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return formatDate(date);
}

export function getThreatColor(level: string) {
  switch (level.toUpperCase()) {
    case "RED":
      return { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", dot: "bg-red-500" };
    case "YELLOW":
      return { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", dot: "bg-amber-500" };
    case "GREEN":
      return { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", dot: "bg-emerald-500" };
    default:
      return { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30", dot: "bg-slate-500" };
  }
}

export function getStatusColor(status: string) {
  switch (status.toUpperCase()) {
    case "ONLINE":
    case "ACTIVE":
    case "APPROVED":
    case "COLLECTED":
    case "RETURNED":
    case "CHECKED_IN":
    case "DELIVERED":
    case "PRE_APPROVED":
      return "text-emerald-400";
    case "OFFLINE":
    case "REJECTED":
    case "BLACKLISTED":
    case "OVERDUE":
    case "DENIED":
      return "text-red-400";
    case "ARRIVED":
    case "OUT":
      return "text-amber-400";
    case "NOTIFIED":
      return "text-blue-400";
    case "PENDING":
      return "text-amber-400";
    case "MAINTENANCE":
      return "text-blue-400";
    case "ESCALATED":
      return "text-red-400";
    case "PARKED":
      return "text-amber-400";
    case "EXITED":
      return "text-slate-400";
    default:
      return "text-slate-400";
  }
}
