"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AttendanceDaySummary,
  AttendanceSession,
  downloadExport,
  endAttendanceSession,
  getActiveAttendanceSession,
  getAllAttendanceSessions,
  getMyAttendanceSessions,
  getMyTodayAttendanceSummary,
  getTeamDailyAttendanceSummary,
  startAttendanceSession,
} from "@/lib/api";
import { useToast } from "@/lib/toast";

type AuthUser = {
  role?: "ADMIN" | "MANAGER" | "EMPLOYEE";
};

const statusLabels: Record<AttendanceDaySummary["status"], string> = {
  NO_ACTIVITY: "No activity",
  IN_PROGRESS: "In progress",
  UNDER_HOURS: "Under hours",
  COMPLETED_WITH_GRACE: "Completed with grace",
  COMPLETED: "Completed",
};

const statusColors: Record<AttendanceDaySummary["status"], string> = {
  NO_ACTIVITY: "var(--text-secondary)",
  IN_PROGRESS: "var(--info-color)",
  UNDER_HOURS: "var(--warning-color)",
  COMPLETED_WITH_GRACE: "var(--success-color)",
  COMPLETED: "var(--success-color)",
};

function todayIsoDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(isoString: string) {
  return new Date(isoString).toLocaleDateString();
}

function localIsoDate(isoString: string) {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(isoString: string | null) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number) {
  const safeMinutes = Math.max(Math.round(minutes), 0);
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function AttendancePage() {
  const toast = useToast();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [todaySummary, setTodaySummary] = useState<AttendanceDaySummary | null>(null);
  const [teamSummaries, setTeamSummaries] = useState<AttendanceDaySummary[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterDate, setFilterDate] = useState(todayIsoDate());
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  const canManage = authUser?.role === "ADMIN" || authUser?.role === "MANAGER";
  const isAdmin = authUser?.role === "ADMIN";

  async function loadData(date = filterDate) {
    try {
      setLoading(true);
      const [active, history, summary, teamDaily] = await Promise.all([
        getActiveAttendanceSession(),
        canManage ? getAllAttendanceSessions() : getMyAttendanceSessions(),
        isAdmin ? Promise.resolve(null) : getMyTodayAttendanceSummary(),
        canManage ? getTeamDailyAttendanceSummary(date) : Promise.resolve([]),
      ]);
      setActiveSession(active);
      setSessions(history);
      setTodaySummary(summary);
      setTeamSummaries(teamDaily);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("auth_user");
      setAuthUser(storedUser ? JSON.parse(storedUser) : null);
    } catch {
      setAuthUser(null);
    }
    setAuthLoaded(true);
  }, []);

  useEffect(() => {
    if (!authLoaded) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded, authUser?.role]);

  useEffect(() => {
    if (authLoaded && canManage) {
      void loadData(filterDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDate, authLoaded]);

  async function handleStart() {
    try {
      setWorking(true);
      await startAttendanceSession();
      toast.success("Work session started.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start work session");
    } finally {
      setWorking(false);
    }
  }

  async function handleEnd() {
    try {
      setWorking(true);
      await endAttendanceSession();
      toast.success("Work session stopped.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to stop work session");
    } finally {
      setWorking(false);
    }
  }

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

  const todaySessions = useMemo(() => {
    const source = canManage ? sessions : sessions.filter(session => localIsoDate(session.startTime) === todayIsoDate());
    return source.filter(session => (filterDate ? localIsoDate(session.startTime) === filterDate : true));
  }, [canManage, filterDate, sessions]);

  const filteredTeamSummaries = teamSummaries.filter(summary =>
    summary.userFullName.toLowerCase().includes(filterName.toLowerCase())
  );

  const progressPercent = todaySummary
    ? Math.min((todaySummary.totalMinutes / todaySummary.requiredMinutes) * 100, 100)
    : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 style={{ fontSize: "1.8rem" }}>{canManage ? "Team Attendance" : "Work Sessions"}</h1>
          <p className="text-muted mt-2">
            Remote attendance is based on total work duration: 7h target, 6h grace completion.
          </p>
        </div>
        <button type="button" className="btn-secondary" disabled={exporting} onClick={() => void handleExport()}>
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      {!authLoaded || loading ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>Loading attendance...</div>
      ) : (
        <div style={{ display: "grid", gap: "24px" }}>
          {!isAdmin && todaySummary && (
            <div className="glass-card" style={{ display: "grid", gridTemplateColumns: "minmax(260px, 0.9fr) minmax(280px, 1.1fr)", gap: "28px", alignItems: "center" }}>
              <div>
                <div className="text-xs text-muted mb-2">Today</div>
                <h2 style={{ fontSize: "1.35rem", marginBottom: "10px" }}>
                  {activeSession ? "You are working now" : "Ready to start a work session"}
                </h2>
                <p className="text-muted" style={{ lineHeight: 1.5 }}>
                  Start and stop as many sessions as you need. Breaks are simply the gaps between sessions.
                </p>
                <button
                  onClick={activeSession ? handleEnd : handleStart}
                  disabled={working}
                  style={{
                    marginTop: "24px",
                    background: activeSession ? "var(--danger-color)" : "var(--success-color)",
                    color: "white",
                    padding: "12px 28px",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "1rem",
                    border: "none",
                    cursor: working ? "not-allowed" : "pointer",
                    opacity: working ? 0.75 : 1,
                  }}
                >
                  {working ? "Saving..." : activeSession ? "Stop Work" : "Start Work"}
                </button>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span style={{ color: statusColors[todaySummary.status], fontWeight: 700 }}>
                    {statusLabels[todaySummary.status]}
                  </span>
                  <span className="text-muted">
                    {formatDuration(todaySummary.totalMinutes)} / {formatDuration(todaySummary.requiredMinutes)}
                  </span>
                </div>
                <div style={{ height: "12px", borderRadius: "999px", background: "var(--surface-muted)", overflow: "hidden", marginBottom: "18px" }}>
                  <div
                    style={{
                      width: `${progressPercent}%`,
                      height: "100%",
                      background: todaySummary.totalMinutes >= todaySummary.graceMinutes ? "var(--success-color)" : "var(--warning-color)",
                    }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                  <Metric label="Worked" value={formatDuration(todaySummary.totalMinutes)} />
                  <Metric label="Remaining" value={formatDuration(todaySummary.remainingMinutes)} />
                  <Metric label="Grace mark" value={formatDuration(todaySummary.graceMinutes)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginTop: "12px" }}>
                  <Metric label="First start" value={formatTime(todaySummary.firstStartTime)} />
                  <Metric label={activeSession ? "Active since" : "Last stop"} value={formatTime(activeSession ? todaySummary.activeSessionStartTime : todaySummary.lastEndTime)} />
                </div>
              </div>
            </div>
          )}

          {canManage && (
            <div className="glass-card">
              <div className="flex justify-between items-center mb-6">
                <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Daily Team Summary</h2>
                <div style={{ display: "flex", gap: "12px" }}>
                  <input
                    placeholder="Search employee..."
                    value={filterName}
                    onChange={e => setFilterName(e.target.value)}
                    style={{ padding: "8px 12px", fontSize: "0.85rem", width: "180px" }}
                  />
                  <input
                    type="date"
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                    style={{ padding: "8px 12px", fontSize: "0.85rem" }}
                  />
                </div>
              </div>
              <Table>
                <thead>
                  <tr>
                    <HeaderCell>Employee</HeaderCell>
                    <HeaderCell>Status</HeaderCell>
                    <HeaderCell>Worked</HeaderCell>
                    <HeaderCell>Remaining</HeaderCell>
                    <HeaderCell>First Start</HeaderCell>
                    <HeaderCell>Last Stop</HeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeamSummaries.map(summary => (
                    <tr key={summary.userId} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <BodyCell strong>{summary.userFullName}</BodyCell>
                      <BodyCell>
                        <span style={{ color: statusColors[summary.status], fontWeight: 700 }}>
                          {statusLabels[summary.status]}
                        </span>
                      </BodyCell>
                      <BodyCell>{formatDuration(summary.totalMinutes)}</BodyCell>
                      <BodyCell>{formatDuration(summary.remainingMinutes)}</BodyCell>
                      <BodyCell>{formatTime(summary.firstStartTime)}</BodyCell>
                      <BodyCell>{summary.activeSessionStartTime ? "Active" : formatTime(summary.lastEndTime)}</BodyCell>
                    </tr>
                  ))}
                  {filteredTeamSummaries.length === 0 && <EmptyRow colSpan={6} label="No team attendance found." />}
                </tbody>
              </Table>
            </div>
          )}

          <div className="glass-card">
            <div className="flex justify-between items-center mb-6">
              <h2 style={{ fontSize: "1.2rem", margin: 0 }}>
                {canManage ? "Session Audit" : "Today's Sessions"}
              </h2>
              {!canManage && (
                <input
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  style={{ padding: "8px 12px", fontSize: "0.85rem" }}
                />
              )}
            </div>
            <Table>
              <thead>
                <tr>
                  {canManage && <HeaderCell>Employee</HeaderCell>}
                  <HeaderCell>Date</HeaderCell>
                  <HeaderCell>Start</HeaderCell>
                  <HeaderCell>Stop</HeaderCell>
                  <HeaderCell>Duration</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {todaySessions.map(session => (
                  <tr key={session.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    {canManage && <BodyCell strong>{session.userFullName}</BodyCell>}
                    <BodyCell>{formatDate(session.startTime)}</BodyCell>
                    <BodyCell>{formatTime(session.startTime)}</BodyCell>
                    <BodyCell>{session.endTime ? formatTime(session.endTime) : <span style={{ color: "var(--success-color)", fontWeight: 700 }}>Active</span>}</BodyCell>
                    <BodyCell>{session.totalHours ? `${Number(session.totalHours).toFixed(2)} hrs` : "-"}</BodyCell>
                  </tr>
                ))}
                {todaySessions.length === 0 && <EmptyRow colSpan={canManage ? 5 : 4} label="No sessions found." />}
              </tbody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--surface-muted)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "12px" }}>
      <div className="text-xs text-muted mb-1">{label}</div>
      <div style={{ fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function Table({ children }: { children: ReactNode }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>{children}</table>
    </div>
  );
}

function HeaderCell({ children }: { children: ReactNode }) {
  return <th style={{ padding: "12px 8px", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-color)" }}>{children}</th>;
}

function BodyCell({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return <td style={{ padding: "16px 8px", fontWeight: strong ? 600 : 400 }}>{children}</td>;
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
        {label}
      </td>
    </tr>
  );
}
