"use client";

import { useEffect, useRef, useState } from "react";
import ActionModal from "@/app/components/ActionModal";
import { getActiveAttendanceSession } from "@/lib/api";
import { clearAuthSession } from "@/lib/auth";
import { useToast } from "@/lib/toast";

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const LOGOUT_WARNING_MS = 60 * 1000;
const ACTIVE_SESSION_CHECK_MS = 2 * 60 * 1000;
const IDLE_CHECK_MS = 30 * 1000;

export default function SessionManager() {
  const toast = useToast();
  const lastActivityRef = useRef(Date.now());
  const activeAttendanceRef = useRef(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(LOGOUT_WARNING_MS / 1000);

  useEffect(() => {
    function markActivity() {
      lastActivityRef.current = Date.now();
      if (warningOpen) setWarningOpen(false);
    }

    const events: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "focus"];
    events.forEach(event => window.addEventListener(event, markActivity, { passive: true }));
    return () => events.forEach(event => window.removeEventListener(event, markActivity));
  }, [warningOpen]);

  useEffect(() => {
    let cancelled = false;

    async function checkActiveAttendance() {
      try {
        const active = await getActiveAttendanceSession();
        if (!cancelled) activeAttendanceRef.current = Boolean(active);
      } catch {
        if (!cancelled) activeAttendanceRef.current = false;
      }
    }

    void checkActiveAttendance();
    const interval = window.setInterval(() => void checkActiveAttendance(), ACTIVE_SESSION_CHECK_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (activeAttendanceRef.current) {
        setWarningOpen(false);
        return;
      }

      const idleFor = Date.now() - lastActivityRef.current;
      const remaining = IDLE_TIMEOUT_MS - idleFor;
      if (remaining <= 0) {
        clearAuthSession();
        window.location.href = "/login?reason=idle";
        return;
      }
      if (remaining <= LOGOUT_WARNING_MS) {
        setSecondsLeft(Math.max(Math.ceil(remaining / 1000), 0));
        setWarningOpen(true);
      }
    }, IDLE_CHECK_MS);

    return () => window.clearInterval(interval);
  }, []);

  function staySignedIn() {
    lastActivityRef.current = Date.now();
    setWarningOpen(false);
    toast.success("Session extended.");
  }

  function logoutNow() {
    clearAuthSession();
    window.location.href = "/login";
  }

  return (
    <ActionModal
      open={warningOpen}
      title="Session expiring"
      description={`You have been idle with no active work session. You will be logged out in about ${secondsLeft} seconds.`}
      confirmLabel="Stay Signed In"
      cancelLabel="Log Out"
      tone="primary"
      onCancel={logoutNow}
      onConfirm={staySignedIn}
    />
  );
}
