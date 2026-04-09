"use client";

import Sidebar from "@/components/sidebar";
import { AlertProvider } from "@/components/alert-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AlertProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="ml-64 flex-1">{children}</main>
      </div>
    </AlertProvider>
  );
}
