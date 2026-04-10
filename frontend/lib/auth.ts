/**
 * Lightweight auth helpers — read/write the token + user stored in localStorage.
 * All functions are safe to call during SSR (return null/undefined when window is absent).
 */

export interface UwsdUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "warden" | "guard" | "student";
  room?: string | null;
  photo?: string | null;
  isActive: boolean;
}

export function getStoredUser(): UwsdUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("uwsd_user");
    return raw ? (JSON.parse(raw) as UwsdUser) : null;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("uwsd_token");
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("uwsd_token");
  localStorage.removeItem("uwsd_user");
}

/** Returns the default landing path for a given role after login. */
export function defaultPathForRole(role: UwsdUser["role"]): string {
  switch (role) {
    case "student":
      return "/dashboard/parcels";
    case "guard":
      return "/dashboard/live";
    default:
      return "/dashboard";
  }
}

/** Returns true if the role is allowed to access the given pathname. */
export function canAccess(role: UwsdUser["role"], pathname: string): boolean {
  if (role === "admin" || role === "warden") return true; // full access

  if (role === "guard") {
    const allowed = ["/dashboard/live", "/dashboard/parcels", "/dashboard/alerts"];
    return allowed.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }

  if (role === "student") {
    const allowed = ["/dashboard/parcels", "/dashboard/night-out"];
    return allowed.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }

  return false;
}
