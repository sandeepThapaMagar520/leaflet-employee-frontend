"use client";

import { useEffect, useState } from "react";
import {
  AttendanceSession,
  endAttendanceSession,
  getActiveAttendanceSession,
  getMyAttendanceSessions,
  getAllAttendanceSessions,
  startAttendanceSession,
  downloadExport,
} from "@/lib/api";
import { useToast } from "@/lib/toast";

export default function AttendancePage() {
  const toast = useToast();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [exporting, setExporting] = useState(false);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const authUser = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("auth_user") || "{}") : null;
  const canManage = authUser?.role === "ADMIN" || authUser?.role === "MANAGER";
  const isAdmin = authUser?.role === "ADMIN";

  async function loadData() {
    try {
      setLoading(true);
      const [active, history] = await Promise.all([
        getActiveAttendanceSession(),
        canManage ? getAllAttendanceSessions() : getMyAttendanceSessions()
      ]);
      setActiveSession(active);
      setSessions(history);
    } catch (error) {
      setFeedback("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStart() {
    try {
      await startAttendanceSession();
      await loadData();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to start session");
    }
  }

  async function handleEnd() {
    try {
      await endAttendanceSession();
      await loadData();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to end session");
    }
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString();
  };

  async function handleExport() {
    setExporting(true);
    try {
      await downloadExport(
        "attendance",
        filterDate ? `attendance-${filterDate}.csv` : "attendance-export.csv",
        filterDate ? { from: filterDate, to: filterDate } : undefined
      );
      toast.success("Attendance exported.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const filteredSessions = sessions.filter(s => {
    const matchesName = s.userFullName.toLowerCase().includes(filterName.toLowerCase());
    const matchesDate = filterDate ? s.startTime.startsWith(filterDate) : true;
    return matchesName && matchesDate;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 style={{ fontSize: "1.8rem" }}>Attendance Tracker</h1>
          <p className="text-muted mt-2">Manage your daily work hours.</p>
        </div>
        <button type="button" className="btn-secondary" disabled={exporting} onClick={() => void handleExport()}>
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {feedback && (
        <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--danger-color)", padding: "12px", borderRadius: "8px", marginBottom: "24px" }}>
          {feedback}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>Loading attendance...</div>
      ) : (
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: isAdmin ? "1fr" : "1fr 2fr", 
          gap: "24px" 
        }}>
          
          {!isAdmin && (
            <div className="glass-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
              <h2 style={{ fontSize: "1.2rem", marginBottom: "32px", textAlign: "center" }}>Current Status</h2>
              
              {activeSession ? (
                <>
                  <div style={{ 
                    width: "160px", height: "160px", borderRadius: "50%", 
                    border: "4px solid var(--success-color)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 30px rgba(16, 185, 129, 0.2)",
                    marginBottom: "32px"
                  }}>
                    <span style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--success-color)" }}>Active</span>
                    <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginTop: "4px" }}>Since {formatTime(activeSession.startTime)}</span>
                  </div>
                  <button onClick={handleEnd} style={{ 
                    background: "var(--danger-color)", color: "white", padding: "12px 32px", 
                    borderRadius: "30px", fontWeight: "bold", fontSize: "1.1rem",
                    boxShadow: "0 4px 14px rgba(239, 68, 68, 0.4)", cursor: "pointer", border: "none"
                  }}>
                    Clock Out
                  </button>
                </>
              ) : (
                <>
                  <div style={{ 
                    width: "160px", height: "160px", borderRadius: "50%", 
                    border: "4px solid var(--border-color)",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    marginBottom: "32px"
                  }}>
                    <span style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--text-secondary)" }}>Offline</span>
                  </div>
                  <button onClick={handleStart} style={{ 
                    background: "var(--success-color)", color: "white", padding: "12px 32px", 
                    borderRadius: "30px", fontWeight: "bold", fontSize: "1.1rem",
                    boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)", cursor: "pointer", border: "none"
                  }}>
                    Clock In
                  </button>
                </>
              )}
            </div>
          )}

          <div className="glass-card">
            <div className="flex justify-between items-center mb-6">
              <h2 style={{ fontSize: "1.2rem", margin: 0 }}>
                {canManage ? "Team Attendance" : "Recent Sessions"}
              </h2>
              <div style={{ display: "flex", gap: "12px" }}>
                {canManage && (
                  <input 
                    placeholder="Search employee..." 
                    value={filterName}
                    onChange={e => setFilterName(e.target.value)}
                    style={{ padding: "8px 12px", fontSize: "0.85rem", width: "180px" }}
                  />
                )}
                <input 
                  type="date" 
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  style={{ padding: "8px 12px", fontSize: "0.85rem" }}
                />
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                    {canManage && <th style={{ padding: "12px 8px" }}>Employee</th>}
                    <th style={{ padding: "12px 8px" }}>Date</th>
                    <th style={{ padding: "12px 8px" }}>Clock In</th>
                    <th style={{ padding: "12px 8px" }}>Clock Out</th>
                    <th style={{ padding: "12px 8px" }}>Total Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map(session => (
                    <tr key={session.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      {canManage && <td style={{ padding: "16px 8px", fontWeight: 500 }}>{session.userFullName}</td>}
                      <td style={{ padding: "16px 8px" }}>{formatDate(session.startTime)}</td>
                      <td style={{ padding: "16px 8px" }}>{formatTime(session.startTime)}</td>
                      <td style={{ padding: "16px 8px" }}>{session.endTime ? formatTime(session.endTime) : <span style={{ color: "var(--success-color)" }}>Active</span>}</td>
                      <td style={{ padding: "16px 8px" }}>{session.totalHours ? `${session.totalHours} hrs` : "-"}</td>
                    </tr>
                  ))}
                  {filteredSessions.length === 0 && (
                    <tr>
                      <td colSpan={canManage ? 5 : 4} style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>No history found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
