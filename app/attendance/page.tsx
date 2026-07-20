"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import ActionModal from "@/app/components/ActionModal";
import {
  approveAttendanceCorrection,
  AttendanceCorrection,
  AttendanceDaySummary,
  AttendanceSession,
  createAttendanceCorrection,
  downloadExport,
  endAttendanceSession,
  endAttendanceBreak,
  endAttendanceSessionOnUnload,
  endTeamMemberAttendanceSession,
  getActiveAttendanceSession,
  getAllAttendanceSessions,
  getAppSettings,
  getAttendanceCorrections,
  getMyAttendanceSessions,
  getMyTodayAttendanceSummary,
  getTeamDailyAttendanceSummary,
  heartbeatAttendanceSession,
  rejectAttendanceCorrection,
  startAttendanceBreak,
  startAttendanceSession,
  startTeamMemberAttendanceSession,
} from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useAuth } from "@/lib/hooks";

type AttendanceFilter = "ALL" | "EXCEPTIONS" | "COMPLETED_ANY" | AttendanceDaySummary["status"];

const statusLabels: Record<AttendanceDaySummary["status"], string> = {
  NO_ACTIVITY: "No activity",
  ON_LEAVE: "On approved leave",
  IN_PROGRESS: "In progress",
  ON_BREAK: "On break",
  MISSING_CHECKOUT: "Missing checkout",
  WORKED_ON_LEAVE: "Worked on approved leave",
  UNDER_HOURS: "Under hours",
  COMPLETED_WITH_GRACE: "Completed with grace",
  COMPLETED: "Completed",
  OVERTIME: "Overtime",
};

const statusColors: Record<AttendanceDaySummary["status"], string> = {
  NO_ACTIVITY: "var(--text-secondary)",
  ON_LEAVE: "var(--info-color)",
  IN_PROGRESS: "var(--info-color)",
  ON_BREAK: "var(--warning-color)",
  MISSING_CHECKOUT: "var(--danger-color)",
  WORKED_ON_LEAVE: "var(--warning-color)",
  UNDER_HOURS: "var(--warning-color)",
  COMPLETED_WITH_GRACE: "var(--success-color)",
  COMPLETED: "var(--success-color)",
  OVERTIME: "var(--info-color)",
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

function toDateTimeLocal(isoString: string | null) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function AttendancePage() {
  const toast = useToast();
  const { loading: authLoading, user } = useAuth(["ADMIN", "MANAGER", "EMPLOYEE"]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [todaySummary, setTodaySummary] = useState<AttendanceDaySummary | null>(null);
  const [teamSummaries, setTeamSummaries] = useState<AttendanceDaySummary[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [breakWorking, setBreakWorking] = useState(false);
  const [breakReminderOpen, setBreakReminderOpen] = useState(false);
  const [breakReminderSnoozedUntil, setBreakReminderSnoozedUntil] = useState<number | null>(null);
  const [breakReminderMinutes, setBreakReminderMinutes] = useState(30);
  const [exporting, setExporting] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterDate, setFilterDate] = useState(todayIsoDate());
  const [statusFilter, setStatusFilter] = useState<AttendanceFilter>("EXCEPTIONS");
  const [correctionSession, setCorrectionSession] = useState<AttendanceSession | null>(null);
  const [correctedStart, setCorrectedStart] = useState("");
  const [correctedEnd, setCorrectedEnd] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [reviewTarget, setReviewTarget] = useState<{ correction: AttendanceCorrection; action: "approve" | "reject" } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [correctionWorking, setCorrectionWorking] = useState(false);
  const [startSessionTarget, setStartSessionTarget] = useState<AttendanceDaySummary | null>(null);
  const [startSessionWorking, setStartSessionWorking] = useState(false);
  const [closeSessionTarget, setCloseSessionTarget] = useState<AttendanceDaySummary | AttendanceSession | null>(null);
  const [closeSessionWorking, setCloseSessionWorking] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";
  const isAdmin = user?.role === "ADMIN";

  async function loadData(date = filterDate) {
    try {
      setLoading(true);
      const [active, history, summary, teamDaily, correctionList] = await Promise.all([
        getActiveAttendanceSession(),
        canManage ? getAllAttendanceSessions() : getMyAttendanceSessions(),
        isAdmin ? Promise.resolve(null) : getMyTodayAttendanceSummary(),
        canManage ? getTeamDailyAttendanceSummary(date) : Promise.resolve([]),
        getAttendanceCorrections(),
      ]);
      setActiveSession(active);
      setSessions(history);
      setTodaySummary(summary);
      setTeamSummaries(teamDaily);
      setCorrections(correctionList);
      void getAppSettings()
        .then(settings => setBreakReminderMinutes(settings.attendance.breakReminderMinutes))
        .catch(() => setBreakReminderMinutes(30));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    void loadData(filterDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canManage, filterDate, user?.role]);

  useEffect(() => {
    if (!activeSession || activeSession.endTime) return;
    const interval = window.setInterval(() => {
      void heartbeatAttendanceSession()
        .then(setActiveSession)
        .catch(() => {});
    }, 120_000);
    return () => window.clearInterval(interval);
  }, [activeSession]);

  useEffect(() => {
    if (!activeSession || activeSession.endTime) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "Active working session";
      return "Active working session";
    };
    const handlePageHide = () => endAttendanceSessionOnUnload();
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [activeSession]);

  useEffect(() => {
    if (!activeSession?.breakStartedAt || activeSession.endTime) {
      setBreakReminderOpen(false);
      return;
    }
    const breakStartedAt = new Date(activeSession.breakStartedAt).getTime();
    const reminderAt = Math.max(breakStartedAt + breakReminderMinutes * 60_000, breakReminderSnoozedUntil ?? 0);
    const delay = Math.max(reminderAt - Date.now(), 0);
    const timeout = window.setTimeout(() => setBreakReminderOpen(true), delay);
    return () => window.clearTimeout(timeout);
  }, [activeSession?.breakStartedAt, activeSession?.endTime, breakReminderMinutes, breakReminderSnoozedUntil]);

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
      setBreakReminderOpen(false);
      setBreakReminderSnoozedUntil(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to stop work session");
    } finally {
      setWorking(false);
    }
  }

  async function handleStartBreak() {
    try {
      setBreakWorking(true);
      await startAttendanceBreak();
      toast.success(`Break started. I will remind you after ${breakReminderMinutes} minutes.`);
      setBreakReminderOpen(false);
      setBreakReminderSnoozedUntil(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start break");
    } finally {
      setBreakWorking(false);
    }
  }

  async function handleEndBreak() {
    try {
      setBreakWorking(true);
      await endAttendanceBreak();
      toast.success("Break ended. Welcome back.");
      setBreakReminderOpen(false);
      setBreakReminderSnoozedUntil(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to end break");
    } finally {
      setBreakWorking(false);
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

  function openCorrection(session: AttendanceSession) {
    setCorrectionSession(session);
    setCorrectedStart(toDateTimeLocal(session.startTime));
    setCorrectedEnd(toDateTimeLocal(session.endTime));
    setCorrectionReason("");
  }

  async function handleCorrectionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!correctionSession || !correctedStart || !correctedEnd || !correctionReason.trim()) return;
    if (new Date(correctedEnd) <= new Date(correctedStart)) {
      toast.error("Corrected end time must be after the start time.");
      return;
    }
    setCorrectionWorking(true);
    try {
      await createAttendanceCorrection({
        sessionId: correctionSession.id,
        requestedStartTime: new Date(correctedStart).toISOString(),
        requestedEndTime: new Date(correctedEnd).toISOString(),
        reason: correctionReason.trim(),
      });
      toast.success("Attendance correction submitted for review.");
      setCorrectionSession(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit attendance correction");
      await loadData();
    } finally {
      setCorrectionWorking(false);
    }
  }

  async function handleCorrectionReview() {
    if (!reviewTarget || !reviewNote.trim()) return;
    setCorrectionWorking(true);
    try {
      if (reviewTarget.action === "approve") {
        await approveAttendanceCorrection(reviewTarget.correction.id, reviewNote.trim());
      } else {
        await rejectAttendanceCorrection(reviewTarget.correction.id, reviewNote.trim());
      }
      toast.success(reviewTarget.action === "approve" ? "Attendance correction approved." : "Attendance correction rejected.");
      setReviewTarget(null);
      setReviewNote("");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to review attendance correction");
      await loadData();
    } finally {
      setCorrectionWorking(false);
    }
  }

  async function confirmCloseTeamSession() {
    if (!closeSessionTarget || !overrideReason.trim()) return;
    setCloseSessionWorking(true);
    try {
      await endTeamMemberAttendanceSession(closeSessionTarget.userId, overrideReason.trim());
      toast.success(`${closeSessionTarget.userFullName}'s session was closed.`);
      setCloseSessionTarget(null);
      setOverrideReason("");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to close team member session");
      await loadData();
    } finally {
      setCloseSessionWorking(false);
    }
  }

  async function confirmStartTeamSession() {
    if (!startSessionTarget || !overrideReason.trim()) return;
    setStartSessionWorking(true);
    try {
      await startTeamMemberAttendanceSession(startSessionTarget.userId, overrideReason.trim());
      toast.success(`${startSessionTarget.userFullName}'s session was started.`);
      setStartSessionTarget(null);
      setOverrideReason("");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start team member session");
      await loadData();
    } finally {
      setStartSessionWorking(false);
    }
  }

  const todaySessions = useMemo(() => {
    const source = canManage ? sessions : sessions.filter(session => localIsoDate(session.startTime) === todayIsoDate());
    return source.filter(session => (filterDate ? localIsoDate(session.startTime) === filterDate : true));
  }, [canManage, filterDate, sessions]);

  const attendanceMetrics = useMemo(() => ({
    noActivity: teamSummaries.filter(summary => summary.status === "NO_ACTIVITY").length,
    onLeave: teamSummaries.filter(summary => summary.status === "ON_LEAVE").length,
    inProgress: teamSummaries.filter(summary => summary.status === "IN_PROGRESS").length,
    onBreak: teamSummaries.filter(summary => summary.status === "ON_BREAK").length,
    missingCheckout: teamSummaries.filter(summary => summary.status === "MISSING_CHECKOUT").length,
    underHours: teamSummaries.filter(summary => summary.status === "UNDER_HOURS").length,
    completed: teamSummaries.filter(summary => ["COMPLETED", "COMPLETED_WITH_GRACE", "OVERTIME"].includes(summary.status)).length,
  }), [teamSummaries]);

  const filteredTeamSummaries = teamSummaries.filter(summary => {
    const matchesName = summary.userFullName.toLowerCase().includes(filterName.toLowerCase());
    const matchesStatus = statusFilter === "ALL"
      || (statusFilter === "EXCEPTIONS" ? ["NO_ACTIVITY", "MISSING_CHECKOUT", "UNDER_HOURS", "WORKED_ON_LEAVE"].includes(summary.status) : summary.status === statusFilter);
    const matchesCombinedCompleted = statusFilter === "COMPLETED_ANY"
      && ["COMPLETED", "COMPLETED_WITH_GRACE", "OVERTIME"].includes(summary.status);
    return matchesName && (matchesStatus || matchesCombinedCompleted);
  });

  const progressPercent = todaySummary
    ? Math.min((todaySummary.totalMinutes / todaySummary.requiredMinutes) * 100, 100)
    : 0;
  const onApprovedLeaveToday = todaySummary?.status === "ON_LEAVE";
  const isOnBreak = Boolean(activeSession?.breakStartedAt);

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

      {authLoading || loading ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>Loading attendance...</div>
      ) : (
        <div className="attendance-page-grid">
          {!isAdmin && todaySummary && (
            <div className="glass-card" style={{ display: "grid", gridTemplateColumns: "minmax(260px, 0.9fr) minmax(280px, 1.1fr)", gap: "28px", alignItems: "center" }}>
              <div>
                <div className="text-xs text-muted mb-2">Today</div>
                <h2 style={{ fontSize: "1.35rem", marginBottom: "10px" }}>
                  {onApprovedLeaveToday ? "You are on approved leave today" : isOnBreak ? "You are on break" : activeSession ? "You are working now" : "Ready to start a work session"}
                </h2>
                <p className="text-muted" style={{ lineHeight: 1.5 }}>
                  {onApprovedLeaveToday
                    ? "Attendance cannot be started from your account while approved leave is active. Ask an admin if work attendance must still be recorded."
                    : isOnBreak
                    ? `Break time is paused from worked hours. I will remind you after ${breakReminderMinutes} minutes.`
                    : "Start and stop as many sessions as you need. Breaks are simply the gaps between sessions."}
                </p>
                <div className="attendance-session-actions">
                  <button
                    onClick={activeSession ? handleEnd : handleStart}
                    disabled={working || onApprovedLeaveToday}
                    style={{
                      background: activeSession ? "var(--danger-color)" : "var(--success-color)",
                      color: "white",
                      padding: "12px 28px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      fontSize: "1rem",
                      border: "none",
                      cursor: working || onApprovedLeaveToday ? "not-allowed" : "pointer",
                      opacity: working || onApprovedLeaveToday ? 0.75 : 1,
                    }}
                  >
                    {working ? "Saving..." : onApprovedLeaveToday ? "On Leave" : activeSession ? "Stop Work" : "Start Work"}
                  </button>
                  {activeSession && !onApprovedLeaveToday && (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={breakWorking || working}
                      onClick={isOnBreak ? () => void handleEndBreak() : () => void handleStartBreak()}
                    >
                      {breakWorking ? "Saving..." : isOnBreak ? "End break" : "Take break"}
                    </button>
                  )}
                </div>
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
            <div className="attendance-team-workflow">
              <section className="attendance-metrics" aria-label="Daily attendance summary">
                <button type="button" className={statusFilter === "NO_ACTIVITY" ? "active" : ""} onClick={() => setStatusFilter("NO_ACTIVITY")}><span>No activity</span><strong>{attendanceMetrics.noActivity}</strong><small>Needs review</small></button>
                <button type="button" className={statusFilter === "MISSING_CHECKOUT" ? "active" : ""} onClick={() => setStatusFilter("MISSING_CHECKOUT")}><span>Missing checkout</span><strong>{attendanceMetrics.missingCheckout}</strong><small>Open too long</small></button>
                <button type="button" className={statusFilter === "IN_PROGRESS" ? "active" : ""} onClick={() => setStatusFilter("IN_PROGRESS")}><span>Working now</span><strong>{attendanceMetrics.inProgress}</strong><small>Active sessions</small></button>
                <button type="button" className={statusFilter === "ON_BREAK" ? "active" : ""} onClick={() => setStatusFilter("ON_BREAK")}><span>On break</span><strong>{attendanceMetrics.onBreak}</strong><small>Paused work</small></button>
                <button type="button" className={statusFilter === "UNDER_HOURS" ? "active" : ""} onClick={() => setStatusFilter("UNDER_HOURS")}><span>Under hours</span><strong>{attendanceMetrics.underHours}</strong><small>Below grace mark</small></button>
                <button type="button" className={statusFilter === "ON_LEAVE" ? "active" : ""} onClick={() => setStatusFilter("ON_LEAVE")}><span>On leave</span><strong>{attendanceMetrics.onLeave}</strong><small>Approved absence</small></button>
                <button type="button" className={statusFilter === "COMPLETED_ANY" ? "active" : ""} onClick={() => setStatusFilter("COMPLETED_ANY")}><span>Completed</span><strong>{attendanceMetrics.completed}</strong><small>Target or grace met</small></button>
              </section>

              <div className="glass-card">
                <div className="attendance-team-header">
                  <div><h2>Daily Team Summary</h2><p>{filteredTeamSummaries.length} of {teamSummaries.length} staff shown</p></div>
                  <div className="attendance-team-filters">
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
                  <select aria-label="Filter attendance status" value={statusFilter} onChange={event => setStatusFilter(event.target.value as AttendanceFilter)}>
                    <option value="EXCEPTIONS">Exceptions first</option>
                    <option value="ALL">All statuses</option>
                    <option value="NO_ACTIVITY">No activity</option>
                    <option value="MISSING_CHECKOUT">Missing checkout</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="ON_BREAK">On break</option>
                    <option value="UNDER_HOURS">Under hours</option>
                    <option value="ON_LEAVE">On approved leave</option>
                    <option value="COMPLETED_ANY">Any completion</option>
                    <option value="COMPLETED_WITH_GRACE">Completed with grace</option>
                    <option value="OVERTIME">Overtime</option>
                    <option value="WORKED_ON_LEAVE">Worked on approved leave</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
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
                    <HeaderCell>Action</HeaderCell>
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
                      <BodyCell>
                        {summary.activeSessionStartTime ? (
                          <button type="button" className="btn-secondary" style={{ padding: "7px 12px", fontSize: "0.8rem" }} onClick={() => setCloseSessionTarget(summary)}>
                            Close session
                          </button>
                        ) : ["ON_LEAVE", "NO_ACTIVITY"].includes(summary.status) ? (
                          <button type="button" className="btn-secondary" style={{ padding: "7px 12px", fontSize: "0.8rem" }} onClick={() => setStartSessionTarget(summary)}>
                            Start session
                          </button>
                        ) : <span className="text-muted text-sm">-</span>}
                      </BodyCell>
                    </tr>
                  ))}
                  {filteredTeamSummaries.length === 0 && <EmptyRow colSpan={7} label="No team attendance found." />}
                </tbody>
              </Table>
              </div>
            </div>
          )}

          {canManage && (
            <div className="glass-card">
              <div className="attendance-team-header">
                <div>
                  <h2>Correction Requests</h2>
                  <p>{corrections.filter(correction => correction.status === "PENDING").length} pending review</p>
                </div>
              </div>
              <Table>
                <thead><tr><HeaderCell>Employee</HeaderCell><HeaderCell>Requested time</HeaderCell><HeaderCell>Reason</HeaderCell><HeaderCell>Status</HeaderCell><HeaderCell>Action</HeaderCell></tr></thead>
                <tbody>
                  {corrections.slice(0, 10).map(correction => (
                    <tr key={correction.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <BodyCell strong>{correction.userFullName}</BodyCell>
                      <BodyCell>{formatDate(correction.requestedStartTime)} · {formatTime(correction.requestedStartTime)}–{formatTime(correction.requestedEndTime)}</BodyCell>
                      <BodyCell>{correction.reason}</BodyCell>
                      <BodyCell><span className={correction.status === "APPROVED" ? "badge-done" : correction.status === "REJECTED" ? "badge-blocked" : "badge-in-progress"}>{correction.status.toLowerCase()}</span></BodyCell>
                      <BodyCell>
                        {correction.status === "PENDING" && correction.canReview ? <div className="attendance-review-actions"><button type="button" className="btn-primary" onClick={() => setReviewTarget({ correction, action: "approve" })}>Approve</button><button type="button" className="btn-secondary" onClick={() => setReviewTarget({ correction, action: "reject" })}>Reject</button></div> : <span className="text-muted text-sm">{correction.status === "PENDING" ? "Awaiting review" : correction.reviewerFullName ?? "Reviewed"}</span>}
                      </BodyCell>
                    </tr>
                  ))}
                  {corrections.length === 0 && <EmptyRow colSpan={5} label="No attendance corrections yet." />}
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
                  {canManage && <HeaderCell>Action</HeaderCell>}
                  {!canManage && <HeaderCell>Correction</HeaderCell>}
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
                    {canManage && (
                      <BodyCell>
                        {!session.endTime ? (
                          <button type="button" className="btn-secondary" style={{ padding: "7px 12px", fontSize: "0.8rem" }} onClick={() => setCloseSessionTarget(session)}>
                            Close session
                          </button>
                        ) : <span className="text-muted text-sm">-</span>}
                      </BodyCell>
                    )}
                    {!canManage && <BodyCell><button type="button" className="btn-secondary" disabled={!session.endTime} onClick={() => openCorrection(session)}>{session.endTime ? "Request edit" : "End first"}</button></BodyCell>}
                  </tr>
                ))}
                {todaySessions.length === 0 && <EmptyRow colSpan={canManage ? 6 : 5} label="No sessions found." />}
              </tbody>
            </Table>
          </div>
        </div>
      )}

      {correctionSession && (
        <div className="project-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="attendance-correction-title">
          <form className="glass-panel attendance-correction-modal" onSubmit={handleCorrectionSubmit}>
            <h2 id="attendance-correction-title">Request attendance correction</h2>
            <p className="text-muted text-sm">The original session remains unchanged until a manager or admin approves this request.</p>
            <label><span>Corrected start</span><input type="datetime-local" value={correctedStart} onChange={event => setCorrectedStart(event.target.value)} required /></label>
            <label><span>Corrected end</span><input type="datetime-local" value={correctedEnd} onChange={event => setCorrectedEnd(event.target.value)} required /></label>
            <label><span>Reason</span><textarea rows={4} maxLength={1000} value={correctionReason} onChange={event => setCorrectionReason(event.target.value)} placeholder="Explain what happened, for example: forgot to check out after client call." required /></label>
            <div className="attendance-correction-actions"><button type="button" className="btn-secondary" onClick={() => setCorrectionSession(null)} disabled={correctionWorking}>Cancel</button><button type="submit" className="btn-primary" disabled={correctionWorking}>{correctionWorking ? "Submitting..." : "Submit request"}</button></div>
          </form>
        </div>
      )}

      <ActionModal
        open={breakReminderOpen}
        title="Still on break?"
        description={`Your break has been active for around ${breakReminderMinutes} minutes. Continue the break if you are still away, or return to work to resume counting attendance time.`}
        confirmLabel="Continue break"
        cancelLabel="Back to work"
        tone="primary"
        loading={breakWorking}
        onCancel={() => void handleEndBreak()}
        onConfirm={() => {
          setBreakReminderOpen(false);
          setBreakReminderSnoozedUntil(Date.now() + breakReminderMinutes * 60_000);
          toast.info(`Break reminder snoozed for ${breakReminderMinutes} minutes.`);
        }}
      />

      <ActionModal
        open={reviewTarget !== null}
        title={reviewTarget?.action === "approve" ? "Approve correction" : "Reject correction"}
        description={reviewTarget ? `${reviewTarget.correction.userFullName} requested ${formatTime(reviewTarget.correction.requestedStartTime)}–${formatTime(reviewTarget.correction.requestedEndTime)}. Add a note to preserve the review context.` : ""}
        confirmLabel={reviewTarget?.action === "approve" ? "Approve correction" : "Reject correction"}
        tone={reviewTarget?.action === "reject" ? "danger" : "primary"}
        noteLabel="Review note"
        notePlaceholder="Why is this correction being approved or rejected?"
        noteValue={reviewNote}
        noteRequired
        loading={correctionWorking}
        onNoteChange={setReviewNote}
        onCancel={() => { setReviewTarget(null); setReviewNote(""); }}
        onConfirm={() => void handleCorrectionReview()}
      />

      <ActionModal
        open={startSessionTarget !== null}
        title="Start attendance session"
        description={startSessionTarget
          ? `This will start an attendance session for ${startSessionTarget.userFullName} now. Use this only when attendance must be recorded while the employee is on leave or unable to start it themselves.`
          : ""}
        confirmLabel="Start Session"
        noteLabel="Override reason"
        notePlaceholder="Why must this session be started on the employee's behalf?"
        noteValue={overrideReason}
        noteRequired
        onNoteChange={setOverrideReason}
        tone="primary"
        loading={startSessionWorking}
        onCancel={() => { setStartSessionTarget(null); setOverrideReason(""); }}
        onConfirm={() => void confirmStartTeamSession()}
      />

      <ActionModal
        open={closeSessionTarget !== null}
        title="Close active session"
        description={closeSessionTarget
          ? `This will stop ${closeSessionTarget.userFullName}'s active attendance session now. Active since ${formatTime("activeSessionStartTime" in closeSessionTarget ? closeSessionTarget.activeSessionStartTime : closeSessionTarget.startTime)}.`
          : ""}
        confirmLabel="Close Session"
        noteLabel="Override reason"
        notePlaceholder="Why must this session be closed on the employee's behalf?"
        noteValue={overrideReason}
        noteRequired
        onNoteChange={setOverrideReason}
        tone="danger"
        loading={closeSessionWorking}
        onCancel={() => { setCloseSessionTarget(null); setOverrideReason(""); }}
        onConfirm={() => void confirmCloseTeamSession()}
      />
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
