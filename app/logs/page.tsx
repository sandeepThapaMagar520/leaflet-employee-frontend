"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createDailyLog, DailyLog, getMyDailyLogs, getAllDailyLogs, downloadExport, getUsers, updateDailyLog, User } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useAuth } from "@/lib/hooks";

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function LogsPage() {
  const toast = useToast();
  const { loading: authLoading, user } = useAuth(["ADMIN", "MANAGER", "EMPLOYEE"]);
  const today = formatLocalDate(new Date());
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [logDate, setLogDate] = useState(today);
  const [summary, setSummary] = useState("");
  const [problemsFaced, setProblemsFaced] = useState("");
  const [filterName, setFilterName] = useState("");
  const [reviewMode, setReviewMode] = useState<"ALL" | "BLOCKERS">("ALL");
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);
  const [editSummary, setEditSummary] = useState("");
  const [editProblemsFaced, setEditProblemsFaced] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";
  const isAdmin = user?.role === "ADMIN";
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const hasInvalidDateRange = Boolean(filterFrom && filterTo && filterFrom > filterTo);

  async function loadData() {
    try {
      setLoading(true);
      if (canManage) {
        const [data, userList] = await Promise.all([getAllDailyLogs(), getUsers()]);
        setLogs(data);
        setStaff(userList.filter(member => member.active && member.role !== "ADMIN"));
      } else {
        setLogs(await getMyDailyLogs());
        setStaff([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load daily logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (canManage) {
      setFilterFrom(today);
      setFilterTo(today);
    }
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canManage]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!summary) return;

    try {
      await createDailyLog({
        logDate,
        summary,
        problemsFaced
      });
      setSummary("");
      setProblemsFaced("");
      toast.success("Log submitted successfully!");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit log");
    }
  }

  function startEdit(log: DailyLog) {
    setEditingLog(log);
    setEditSummary(log.summary);
    setEditProblemsFaced(log.problemsFaced || "");
  }

  function cancelEdit() {
    setEditingLog(null);
    setEditSummary("");
    setEditProblemsFaced("");
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingLog || !editSummary.trim()) return;

    setSavingEdit(true);
    try {
      await updateDailyLog(editingLog.id, {
        logDate: editingLog.logDate,
        summary: editSummary,
        problemsFaced: editProblemsFaced,
      });
      cancelEdit();
      toast.success("Log updated successfully!");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update log");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleExport() {
    if (hasInvalidDateRange) {
      toast.error("From date must be before or equal to To date.");
      return;
    }

    setExporting(true);
    try {
      const defaultFrom = filterTo ? new Date(`${filterTo}T12:00:00`) : new Date();
      defaultFrom.setDate(defaultFrom.getDate() - 30);
      const exportFrom = filterFrom || formatLocalDate(defaultFrom);
      const exportTo = filterTo || today;
      const rangeLabel = `${exportFrom}-to-${exportTo}`;
      await downloadExport(
        "logs",
        `daily-logs-${rangeLabel}.csv`,
        { from: exportFrom, to: exportTo }
      );
      toast.success("Daily logs exported.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const filteredLogs = logs.filter(log => {
    const matchesName = log.userFullName.toLowerCase().includes(filterName.toLowerCase());
    const matchesFrom = filterFrom ? log.logDate >= filterFrom : true;
    const matchesTo = filterTo ? log.logDate <= filterTo : true;
    const matchesReviewMode = reviewMode === "ALL" || Boolean(log.problemsFaced?.trim());
    return matchesName && matchesFrom && matchesTo && matchesReviewMode;
  });

  const dailyCompliance = useMemo(() => {
    if (!canManage || !filterFrom || filterFrom !== filterTo) return null;
    const logsForDay = logs.filter(log => log.logDate === filterFrom);
    const submittedIds = new Set(logsForDay.map(log => log.userId));
    return {
      submitted: submittedIds.size,
      missing: staff.filter(member => !submittedIds.has(member.id)),
      blockers: logsForDay.filter(log => Boolean(log.problemsFaced?.trim())).length,
      expected: staff.length,
    };
  }, [canManage, filterFrom, filterTo, logs, staff]);

  const dateRangeLabel = filterFrom && filterTo
    ? filterFrom === filterTo ? filterFrom : `${filterFrom} to ${filterTo}`
    : filterFrom ? `From ${filterFrom}`
      : filterTo ? `Until ${filterTo}`
        : "All dates";

  if (authLoading) return <div className="p-8">Verifying access...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 style={{ fontSize: "1.8rem" }}>{isAdmin ? "Audit Daily Logs" : "Daily Logs"}</h1>
          <p className="text-muted mt-2">
            {isAdmin ? "Review and export employee daily log submissions." : "Submit your work log independently of tasks."}
          </p>
        </div>
        <button type="button" className="btn-secondary" disabled={exporting} onClick={() => void handleExport()}>
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>Loading logs...</div>
      ) : (
        <div className="logs-workflow">
          {canManage && dailyCompliance && (
            <section className="logs-compliance" aria-label="Daily log compliance">
              <button type="button" className={reviewMode === "ALL" ? "active" : ""} onClick={() => setReviewMode("ALL")}><span>Submitted</span><strong>{dailyCompliance.submitted}</strong><small>of {dailyCompliance.expected} expected</small></button>
              <div><span>Missing</span><strong>{dailyCompliance.missing.length}</strong><small>Not submitted</small></div>
              <button type="button" className={reviewMode === "BLOCKERS" ? "active warning" : "warning"} onClick={() => setReviewMode(reviewMode === "BLOCKERS" ? "ALL" : "BLOCKERS")}><span>With blockers</span><strong>{dailyCompliance.blockers}</strong><small>Needs follow-up</small></button>
            </section>
          )}

          {canManage && dailyCompliance && dailyCompliance.missing.length > 0 && (
            <section className="logs-missing-panel">
              <div><h2>Missing submissions</h2><p>Staff without a daily log for {filterFrom}</p></div>
              <div>{dailyCompliance.missing.map(member => (
                <span key={member.id}>{member.fullName} · {member.employeeId || member.email}</span>
              ))}</div>
            </section>
          )}

        <div style={{ 
          display: "grid", 
          gridTemplateColumns: isAdmin ? "1fr" : "minmax(300px, 1fr) minmax(400px, 2fr)", 
          gap: "24px" 
        }}>
          
          {!isAdmin && (
            <div className="glass-card" style={{ alignSelf: "start" }}>
              <h2 style={{ fontSize: "1.2rem", marginBottom: "24px" }}>
                {editingLog ? "Edit Log" : "Submit Log"}
              </h2>
              <form onSubmit={editingLog ? handleEditSubmit : handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem" }}>Log Date</label>
                  <input 
                    type="date" 
                    value={editingLog?.logDate || logDate} 
                    disabled
                    style={{ width: "100%", opacity: 0.7, cursor: "not-allowed" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem" }}>Summary</label>
                  <textarea 
                    value={editingLog ? editSummary : summary} 
                    onChange={e => editingLog ? setEditSummary(e.target.value) : setSummary(e.target.value)} 
                    required 
                    rows={4}
                    placeholder="What did you work on today?"
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem" }}>Problems Faced (Optional)</label>
                  <textarea 
                    value={editingLog ? editProblemsFaced : problemsFaced} 
                    onChange={e => editingLog ? setEditProblemsFaced(e.target.value) : setProblemsFaced(e.target.value)} 
                    rows={3}
                    placeholder="Any blockers or issues?"
                    style={{ width: "100%" }}
                  />
                </div>

                <div className="flex gap-3 mt-4">
                  {editingLog && (
                    <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={cancelEdit}>
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={savingEdit}>
                    {editingLog ? (savingEdit ? "Saving…" : "Save Changes") : "Submit Log"}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="glass-card">
            <div className="flex justify-between items-center mb-6">
              <h2 style={{ fontSize: "1.2rem", margin: 0 }}>
                {canManage ? "Team Logs" : "Your Past Logs"}
              </h2>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {canManage && (
                  <input 
                    placeholder="Search employee..." 
                    value={filterName}
                    onChange={e => setFilterName(e.target.value)}
                    style={{ padding: "8px 12px", fontSize: "0.85rem", width: "180px" }}
                  />
                )}
                {canManage && (
                  <select aria-label="Filter daily logs by review status" value={reviewMode} onChange={event => setReviewMode(event.target.value as "ALL" | "BLOCKERS")} style={{ padding: "8px 12px", fontSize: "0.85rem" }}>
                    <option value="ALL">All submissions</option>
                    <option value="BLOCKERS">With blockers</option>
                  </select>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  From
                  <input
                    type="date"
                    value={filterFrom}
                    onChange={e => setFilterFrom(e.target.value)}
                    style={{ padding: "8px 12px", fontSize: "0.85rem" }}
                  />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  To
                  <input
                    type="date"
                    value={filterTo}
                    onChange={e => setFilterTo(e.target.value)}
                    style={{ padding: "8px 12px", fontSize: "0.85rem" }}
                  />
                </label>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: "8px 12px", fontSize: "0.85rem" }}
                    onClick={() => {
                      setFilterFrom(today);
                      setFilterTo(today);
                    }}
                  >
                    Today
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: "8px 12px", fontSize: "0.85rem" }}
                  onClick={() => {
                    setFilterName("");
                    setFilterFrom("");
                    setFilterTo("");
                    setReviewMode("ALL");
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center mb-4" style={{ gap: "12px", flexWrap: "wrap" }}>
              <p className="text-muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                Showing {filteredLogs.length} {filteredLogs.length === 1 ? "log" : "logs"} · {dateRangeLabel}
              </p>
              {hasInvalidDateRange && (
                <span style={{ color: "var(--danger-color)", fontSize: "0.85rem", fontWeight: 500 }}>
                  From date must be before To date.
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {filteredLogs.map(log => (
                <div key={log.id} style={{ 
                  background: "rgba(15, 23, 42, 0.4)", 
                  padding: "20px", 
                  borderRadius: "8px", 
                  border: "1px solid var(--border-color)",
                  borderLeft: "4px solid var(--accent-color)"
                }}>
                  <div className="flex justify-between items-start mb-3">
                    <span style={{ fontWeight: 600 }}>{new Date(log.logDate).toLocaleDateString()}</span>
                    <div className="flex items-center gap-3">
                      {canManage && (
                        <span style={{ fontSize: "0.85rem", color: "var(--accent-color)", fontWeight: 500 }}>
                          {log.userFullName}
                        </span>
                      )}
                      {!canManage && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: "6px 10px", fontSize: "0.75rem" }}
                          onClick={() => startEdit(log)}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.5 }}>
                    <p style={{ whiteSpace: "pre-wrap" }}><strong>Summary:</strong><br />{log.summary}</p>
                    {log.problemsFaced && (
                      <p style={{ whiteSpace: "pre-wrap", marginTop: "12px", color: "var(--danger-color)" }}><strong>Problems Faced:</strong><br />{log.problemsFaced}</p>
                    )}
                  </div>
                </div>
              ))}
              {filteredLogs.length === 0 && <p className="text-muted">No logs found.</p>}
            </div>
          </div>

        </div>
        </div>
      )}
    </div>
  );
}
