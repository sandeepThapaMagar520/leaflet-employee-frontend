"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { clearAuthSession } from "@/lib/auth";
import { getMyProfile, Profile, resendVerificationEmail } from "@/lib/api";
import { useToast } from "@/lib/toast";

type StoredUser = {
  fullName: string;
  email: string;
  role: string;
  profilePhotoUrl?: string | null;
  emailVerified?: boolean;
};

function initials(name: string) {
  return name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function ProfileMenu() {
  const router = useRouter();
  const toast = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("auth_user");
    if (raw) {
      try {
        setUser(JSON.parse(raw) as StoredUser);
      } catch {
        setUser(null);
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const data = await getMyProfile();
      setProfile(data);
      const raw = localStorage.getItem("auth_user");
      if (raw) {
        const stored = JSON.parse(raw) as StoredUser;
        const updated = {
          ...stored,
          fullName: data.fullName,
          email: data.email,
          profilePhotoUrl: data.profilePhotoUrl,
          emailVerified: data.emailVerified,
        };
        localStorage.setItem("auth_user", JSON.stringify(updated));
        setUser(updated);
      }
    } catch {
      // ignore — menu still works from localStorage
    }
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      await refreshProfile();
    }
  }

  function handleLogout() {
    clearAuthSession();
    window.location.href = "/login";
  }

  async function handleResendVerification() {
    setResending(true);
    try {
      await resendVerificationEmail();
      toast.success("Verification email sent. Check your inbox.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend verification email");
    } finally {
      setResending(false);
    }
  }

  const displayName = profile?.fullName ?? user?.fullName ?? "User";
  const displayEmail = profile?.email ?? user?.email ?? "";
  const photoUrl = profile?.profilePhotoUrl ?? user?.profilePhotoUrl;
  const emailVerified = profile?.emailVerified ?? user?.emailVerified ?? true;
  const role = profile?.role ?? user?.role ?? "EMPLOYEE";

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => void handleOpen()}
        aria-label="Account menu"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text-primary)",
          padding: "4px",
          borderRadius: "10px",
        }}
      >
        <div style={{ textAlign: "right", display: "none" }} className="profile-menu-text">
          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{displayName}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "capitalize" }}>
            {role.toLowerCase()}
          </div>
        </div>
        <div style={{
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          background: photoUrl ? "transparent" : "linear-gradient(135deg, #0f766e, #2563eb)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "bold",
          fontSize: "1rem",
          color: "white",
          boxShadow: "0 10px 24px rgba(15, 118, 110, 0.2)",
          overflow: "hidden",
          border: "2px solid rgba(45, 212, 191, 0.25)",
        }}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            displayName.charAt(0).toUpperCase()
          )}
        </div>
      </button>

      {open && (
        <div className="glass-panel" style={{
          position: "absolute",
          right: 0,
          top: "calc(100% + 8px)",
          width: "300px",
          zIndex: 50,
          border: "1px solid var(--border-color)",
          overflow: "hidden",
        }}>
          <div style={{ padding: "16px", borderBottom: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: photoUrl ? "transparent" : "linear-gradient(135deg, #0f766e, #2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                color: "white",
                overflow: "hidden",
                flexShrink: 0,
              }}>
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  initials(displayName)
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{displayName}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {displayEmail}
                </div>
                <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                  <span className="badge badge-in-progress" style={{ fontSize: "0.65rem" }}>{role}</span>
                  {emailVerified ? (
                    <span className="badge badge-done" style={{ fontSize: "0.65rem" }}>Verified</span>
                  ) : (
                    <span className="badge badge-todo" style={{ fontSize: "0.65rem" }}>Unverified</span>
                  )}
                </div>
              </div>
            </div>
            {!emailVerified && (
              <button
                type="button"
                onClick={() => void handleResendVerification()}
                disabled={resending}
                style={{
                  marginTop: "12px",
                  width: "100%",
                  background: "rgba(15, 118, 110, 0.15)",
                  border: "1px solid rgba(45, 212, 191, 0.25)",
                  color: "var(--text-primary)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
              >
                {resending ? "Sending…" : "Resend verification email"}
              </button>
            )}
          </div>

          <div style={{ padding: "8px" }}>
            {[
              { href: "/profile", label: "My Profile", icon: "👤" },
              { href: "/profile?tab=security", label: "Security", icon: "🔒" },
              { href: "/profile?tab=preferences", label: "Preferences", icon: "🔔" },
            ].map(item => (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(item.href);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  padding: "10px 12px",
                  background: "transparent",
                  border: "none",
                  borderRadius: "8px",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: "0.88rem",
                  textAlign: "left",
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 12px",
                background: "transparent",
                border: "none",
                borderRadius: "8px",
                color: "var(--danger-color)",
                cursor: "pointer",
                fontSize: "0.88rem",
                textAlign: "left",
                marginTop: "4px",
                borderTop: "1px solid var(--border-color)",
              }}
            >
              <span>🚪</span>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
