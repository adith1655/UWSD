"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar";
import { AlertProvider } from "@/components/alert-provider";
import { getStoredToken, getStoredUser, canAccess } from "@/lib/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const user = getStoredUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    // Redirect students / guards away from pages they can't access
    if (!canAccess(user.role, pathname)) {
      if (user.role === "student") {
        router.replace("/dashboard/parcels");
      } else if (user.role === "guard") {
        router.replace("/dashboard/live");
      }
    }
  }, [pathname, router]);

  return (
    <AlertProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="ml-64 flex-1">{children}</main>
      </div>
    </AlertProvider>
  );
}
