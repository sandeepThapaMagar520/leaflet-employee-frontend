"use client";

import { FormEvent, useState } from "react";
import { login } from "@/lib/api";
import { setStoredAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Please enter your email address.");
      return;
    }
    if (!password) {
      toast.error("Please enter your password.");
      return;
    }
    setIsLoading(true);

    try {
      const result = await login({ email: trimmedEmail, password });
      setStoredAuth(result.accessToken, result);
      if (result.mustChangePassword) {
        toast.info("Signed in. Please update your password to continue.");
        router.push("/profile?tab=security");
      } else {
        toast.success(`Welcome back, ${result.fullName}.`);
        router.push("/dashboard");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="leaflet-login" style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 480px)",
      alignItems: "center",
      justifyContent: "center",
      gap: "48px",
      padding: "48px",
    }}>
      <div style={{ maxWidth: "680px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "34px" }}>
          <div style={{
            width: "52px",
            height: "52px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #0f766e, #2563eb)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: "0.95rem",
            letterSpacing: "0.04em",
            boxShadow: "0 16px 34px rgba(15, 118, 110, 0.22)",
          }}>
            LF
          </div>
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>Leaflet</div>
            <div className="text-muted text-xs" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>Employee Operations</div>
          </div>
        </div>

        <h1 style={{ fontSize: "3.05rem", lineHeight: 1.08, maxWidth: "650px", marginBottom: "20px", fontWeight: 820 }}>
          A focused employee portal for daily operations.
        </h1>
        <p className="text-muted" style={{ fontSize: "1.05rem", lineHeight: 1.7, maxWidth: "560px" }}>
          Access attendance, tasks, leave, daily logs, and project updates through a secure professional workspace.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px", marginTop: "34px", maxWidth: "620px" }}>
          {[
            ["Track", "Attendance"],
            ["Manage", "Tasks"],
            ["Review", "Leave"],
          ].map(([label, value]) => (
            <div key={value} className="glass-card" style={{ padding: "16px" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "6px" }}>{label}</div>
              <div style={{ fontWeight: 800 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel" style={{ width: "100%", padding: "38px" }}>
        <div style={{ marginBottom: "30px" }}>
          <h2 className="text-gradient" style={{ fontSize: "2rem", marginBottom: "8px" }}>Welcome Back</h2>
          <p className="text-muted" style={{ fontSize: "0.95rem" }}>Sign in to your Leaflet workspace.</p>
        </div>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", fontWeight: 500 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%" }}
              placeholder="you@company.com"
            />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", marginBottom: "8px" }}>
              <label style={{ fontSize: "0.9rem", fontWeight: 500 }}>Password</label>
              <Link
                href="/reset-password"
                style={{ color: "var(--primary-color)", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" }}
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: "100%" }}
              placeholder="••••••••"
            />
          </div>

          <button
            className="btn-primary"
            disabled={isLoading}
            type="submit"
            style={{ width: "100%", marginTop: "12px", padding: "12px" }}
          >
            {isLoading ? "Authenticating..." : "Sign in"}
          </button>

          <p className="text-muted" style={{ fontSize: "0.82rem", lineHeight: 1.55, textAlign: "center" }}>
            New staff?{" "}
            <Link href="/reset-password?mode=setup" style={{ color: "var(--primary-color)", fontWeight: 600 }}>
              Start first-time setup
            </Link>
            {" "}with the temporary password delivered to your email.
          </p>

        </form>
      </div>
    </div>
  );
}
