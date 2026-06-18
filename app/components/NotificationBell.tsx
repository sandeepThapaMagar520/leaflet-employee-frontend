"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  Notification,
  NotificationType,
} from "@/lib/api";
import { useToast } from "@/lib/toast";

function notificationMeta(type: NotificationType) {
  switch (type) {
    case "TASK_OVERDUE":
      return { label: "Overdue", color: "var(--danger-color)", background: "rgba(239, 68, 68, 0.14)" };
    case "TASK_DUE_SOON":
      return { label: "Due Soon", color: "#fde68a", background: "rgba(245, 158, 11, 0.14)" };
    case "TASK_COMMENTED":
      return { label: "Comment", color: "#bae6fd", background: "rgba(14, 165, 233, 0.14)" };
    case "TASK_ASSIGNED":
      return { label: "Task", color: "#c4b5fd", background: "rgba(139, 92, 246, 0.14)" };
    case "TASK_COMPLETED":
      return { label: "Done", color: "#bbf7d0", background: "rgba(34, 197, 94, 0.14)" };
    case "PROJECT_ASSIGNED":
      return { label: "Project", color: "#bfdbfe", background: "rgba(59, 130, 246, 0.14)" };
    default:
      return { label: "System", color: "var(--text-secondary)", background: "rgba(148, 163, 184, 0.12)" };
  }
}

export default function NotificationBell() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [{ count }, list] = await Promise.all([
        getUnreadNotificationCount(),
        getNotifications(),
      ]);
      setUnread(count);
      setNotifications(list.slice(0, 20));
    } catch {
      // ignore polling errors
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60000);
    return () => window.clearInterval(interval);
  }, [refresh]);

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
      setLoading(true);
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleClick(notification: Notification) {
    try {
      if (!notification.read) {
        await markNotificationRead(notification.id);
        setUnread(prev => Math.max(0, prev - 1));
        setNotifications(prev =>
          prev.map(n => (n.id === notification.id ? { ...n, read: true } : n))
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark notification as read");
      return;
    }
    setOpen(false);
    if (notification.link) {
      router.push(notification.link);
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setUnread(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success("All notifications marked as read.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark notifications as read");
    }
  }

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => void handleOpen()}
        aria-label="Notifications"
        style={{
          position: "relative",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid var(--border-color)",
          borderRadius: "10px",
          width: "40px",
          height: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "var(--text-primary)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: "absolute", top: "-4px", right: "-4px",
            background: "var(--danger-color)", color: "white",
            fontSize: "0.65rem", fontWeight: 700, borderRadius: "999px",
            minWidth: "18px", height: "18px", display: "flex",
            alignItems: "center", justifyContent: "center", padding: "0 4px",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="glass-panel" style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: "340px", maxHeight: "420px", overflow: "hidden",
          display: "flex", flexDirection: "column", zIndex: 50,
          border: "1px solid var(--border-color)",
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 16px", borderBottom: "1px solid var(--border-color)",
          }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={() => void handleMarkAllRead()}
                style={{ background: "transparent", border: "none", color: "var(--primary-color)",
                  fontSize: "0.75rem", cursor: "pointer" }}>
                Mark all read
              </button>
            )}
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading ? (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
                No notifications yet
              </div>
            ) : (
              notifications.map(n => {
                const meta = notificationMeta(n.type);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void handleClick(n)}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "12px 16px", border: "none", cursor: "pointer",
                      background: n.read ? "transparent" : "rgba(99,102,241,0.08)",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <div className="flex justify-between items-start gap-2" style={{ marginBottom: "5px" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{n.title}</div>
                      <span style={{
                        flexShrink: 0,
                        borderRadius: "999px",
                        padding: "2px 8px",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        color: meta.color,
                        background: meta.background,
                      }}>
                        {meta.label}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "6px" }}>
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
