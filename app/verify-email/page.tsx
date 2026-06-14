"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { verifyEmail } from "@/lib/api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }

    const verificationToken = token;
    async function run() {
      try {
        const result = await verifyEmail(verificationToken);
        setStatus("success");
        setMessage(result.message || "Email verified successfully.");
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Verification failed.");
      }
    }

    void run();
  }, [token]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div className="glass-panel" style={{ maxWidth: "480px", width: "100%", padding: "32px", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.6rem", marginBottom: "12px" }}>
          {status === "loading" ? "Verifying email" : status === "success" ? "Email verified" : "Verification failed"}
        </h1>
        <p className="text-muted" style={{ marginBottom: "24px", lineHeight: 1.6 }}>{message}</p>
        <Link href="/login" className="btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>
          Go to login
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Verifying...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
