"use client";

import { useEffect, useState } from "react";
import NotificationBell from "./NotificationBell";
import ProfileMenu from "./ProfileMenu";

type StoredUser = {
  fullName: string;
  role: string;
};

export default function Topbar() {
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("auth_user");
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        setUser(null);
      }
    }
  }, []);

  const portalName = user?.role === "ADMIN" || user?.role === "MANAGER" ? "Leaflet Admin" : "Leaflet Employee";

  return (
    <header style={{
      height: "72px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 40px",
      borderBottom: "1px solid var(--border-color)",
      background: "rgba(15, 23, 42, 0.78)",
      backdropFilter: "blur(18px)",
      position: "sticky",
      top: 0,
      zIndex: 10
    }}>
      <div>
        <h3 style={{ margin: 0, fontWeight: 800 }}>{portalName}</h3>
        <p style={{ marginTop: "4px", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
          {user?.role === "ADMIN" ? "Administration and approvals" : user?.role === "MANAGER" ? "Team operations" : "Personal work overview"}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <NotificationBell />
        <ProfileMenu />
      </div>
    </header>
  );
}
