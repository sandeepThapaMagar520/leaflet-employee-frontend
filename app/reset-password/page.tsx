"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { requestPasswordReset, setPassword, startAccountSetup, verifyPasswordOtp } from "@/lib/api";
import { useToast } from "@/lib/toast";

type Step = "setup" | "email" | "otp" | "password" | "success";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const setupMode = searchParams.get("mode") === "setup";
  const recoveryMode = searchParams.get("mode") === "forgot";
  const initialEmail = searchParams.get("email") ?? "";
  const startsWithOtp = Boolean(initialEmail && recoveryMode);
  const [step, setStep] = useState<Step>(setupMode ? "setup" : startsWithOtp ? "otp" : "email");
  const [email, setEmail] = useState(initialEmail);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(
    startsWithOtp ? `Enter the OTP sent to ${initialEmail}.` : ""
  );
  const [loading, setLoading] = useState(false);

  async function handleSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await startAccountSetup({ email, temporaryPassword });
      setMessage(result.message);
      toast.success(result.message);
      setTemporaryPassword("");
      setStep("otp");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Temporary password verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await requestPasswordReset(email);
      setMessage(result.message);
      toast.success(result.message);
      setStep("otp");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Could not queue the OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await verifyPasswordOtp({ email, otp });
      setResetToken(result.resetToken);
      setMessage(result.message);
      toast.success(result.message);
      setStep("password");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    setLoading(true);
    try {
      const result = await setPassword({ resetToken, newPassword });
      setMessage(result.message);
      toast.success(result.message);
      setStep("success");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Could not save the password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: "32px 20px",
    }}>
      <section className="glass-panel" style={{ width: "100%", maxWidth: "460px", padding: "34px" }}>
        <Link href="/login" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.88rem" }}>
          Back to sign in
        </Link>

        <div style={{ margin: "24px 0" }}>
          <h1 style={{ fontSize: "1.8rem", marginBottom: "8px" }}>
            {setupMode ? "Create your password" : "Reset your password"}
          </h1>
          <p className="text-muted" style={{ lineHeight: 1.6 }}>
            {step === "setup" && "Enter the temporary password provided by your administrator. We will then send an email OTP."}
            {step === "email" && "Enter your work email to receive a six-digit OTP."}
            {step === "otp" && "Verify the six-digit code from your email."}
            {step === "password" && "OTP verified. Choose a new password for your account."}
            {step === "success" && "Your password is ready."}
          </p>
        </div>

        {step === "setup" && (
          <form onSubmit={handleSetup} style={{ display: "grid", gap: "16px" }}>
            <label style={{ display: "grid", gap: "8px", fontSize: "0.9rem" }}>
              Work email
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
            </label>
            <label style={{ display: "grid", gap: "8px", fontSize: "0.9rem" }}>
              Temporary one-time password
              <input
                type="password"
                value={temporaryPassword}
                onChange={event => setTemporaryPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Checking..." : "Continue and send OTP"}
            </button>
          </form>
        )}

        {step === "email" && (
          <form onSubmit={handleEmail} style={{ display: "grid", gap: "16px" }}>
            <label style={{ display: "grid", gap: "8px", fontSize: "0.9rem" }}>
              Work email
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
            </label>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Sending..." : "Send email OTP"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleOtp} style={{ display: "grid", gap: "16px" }}>
            <label style={{ display: "grid", gap: "8px", fontSize: "0.9rem" }}>
              Email
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label style={{ display: "grid", gap: "8px", fontSize: "0.9rem" }}>
              Six-digit OTP
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                required
                autoComplete="one-time-code"
                style={{ fontSize: "1.25rem", letterSpacing: "0.22em", textAlign: "center" }}
              />
            </label>
            <button type="submit" className="btn-primary" disabled={loading || otp.length !== 6}>
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
            <button type="button" className="btn-secondary" disabled={loading} onClick={() => setStep(setupMode ? "setup" : "email")}>
              {setupMode ? "Enter temporary password again" : "Send a new OTP"}
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handlePassword} style={{ display: "grid", gap: "16px" }}>
            <label style={{ display: "grid", gap: "8px", fontSize: "0.9rem" }}>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </label>
            <label style={{ display: "grid", gap: "8px", fontSize: "0.9rem" }}>
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Saving..." : "Save new password"}
            </button>
          </form>
        )}

        {step === "success" && (
          <Link href="/login" className="btn-primary" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
            Continue to sign in
          </Link>
        )}

        {message && step !== "success" && (
          <p aria-live="polite" className="text-muted" style={{ marginTop: "18px", fontSize: "0.84rem", lineHeight: 1.55 }}>
            {message}
          </p>
        )}
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Loading...</main>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
