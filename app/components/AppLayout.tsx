"use client";

import { usePathname } from "next/navigation";
import { ToastProvider } from "@/lib/toast";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import SessionManager from "./SessionManager";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = ["/login", "/verify-email", "/reset-password"].some(
    path => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (isAuthPage) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  return (
    <ToastProvider>
      <SessionManager />
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <Topbar />
          <main className="page-content">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
