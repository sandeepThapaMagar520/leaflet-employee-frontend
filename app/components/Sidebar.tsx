"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useEffect, useState } from "react";

type StoredUser = {
  fullName: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
};

export default function Sidebar() {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("auth_user");
      if (raw) {
        try {
          const user = JSON.parse(raw) as StoredUser;
          setUserRole(user.role);
        } catch {}
      }
    }
  }, []);

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/attendance", label: userRole === "ADMIN" ? "Team Attendance" : "Attendance", icon: "⏱️" },
    { href: "/logs", label: userRole === "ADMIN" ? "Team Logs" : "Daily Logs", icon: "📝" },
    { href: "/leave", label: userRole === "ADMIN" || userRole === "MANAGER" ? "Leave Requests" : "Leave", icon: "🌿" },
  ];

  if (userRole === "ADMIN" || userRole === "MANAGER") {
    links.push({ href: "/projects", label: "All Projects", icon: "📁" });
    links.push({ href: "/tasks", label: "All Tasks", icon: "✅" });
  }

  if (userRole === "EMPLOYEE") {
    links.push({ href: "/projects", label: "My Projects", icon: "📁" });
    links.push({ href: "/tasks", label: "My Tasks", icon: "✅" });
  }

  if (userRole === "ADMIN") {
    links.push({ href: "/users", label: "Staff Management", icon: "👥" });
  }

  const brandName = userRole === "ADMIN" || userRole === "MANAGER" ? "Leaflet Admin" : "Leaflet Employee";

  return (
    <aside style={{
      width: "var(--sidebar-width)",
      height: "100vh",
      position: "fixed",
      left: 0,
      top: 0,
      background: "linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(17, 24, 39, 0.94))",
      borderRight: "1px solid var(--border-color)",
      backdropFilter: "blur(18px)",
      padding: "22px 0",
      display: "flex",
      flexDirection: "column",
      boxShadow: "10px 0 40px rgba(0, 0, 0, 0.18)"
    }}>
      <div style={{ padding: "0 20px", marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "42px",
            height: "42px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #0f766e, #2563eb)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: "0.82rem",
            letterSpacing: "0.04em",
            boxShadow: "0 14px 30px rgba(15, 118, 110, 0.2)"
          }}>
            LF
          </div>
          <div>
            <h2 style={{ fontSize: "1.08rem", lineHeight: 1.1, margin: 0, fontWeight: 800 }}>{brandName}</h2>
            <p style={{ marginTop: "4px", fontSize: "0.72rem", color: "var(--text-secondary)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Employee Portal
            </p>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", padding: "0 16px" }}>
        {links.map((link) => {
          const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href + "/"));
          return (
            <Link key={link.href} href={link.href} style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 16px",
              borderRadius: "8px",
              background: isActive ? "linear-gradient(135deg, rgba(15, 118, 110, 0.22), rgba(37, 99, 235, 0.14))" : "transparent",
              border: isActive ? "1px solid rgba(45, 212, 191, 0.2)" : "1px solid transparent",
              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: isActive ? 600 : 500,
              boxShadow: isActive ? "0 10px 24px rgba(0, 0, 0, 0.18)" : "none",
              transition: "all 0.2s ease",
            }}>
              <span style={{ fontSize: "1.2rem" }}>{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "0 24px", marginTop: "auto" }}>
        <p style={{ fontSize: "0.72rem", color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.5 }}>
          Account settings are in the top-right menu.
        </p>
      </div>
    </aside>
  );
}
