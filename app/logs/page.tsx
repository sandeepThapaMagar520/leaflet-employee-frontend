"use client";

import { FormEvent, useEffect, useState } from "react";
import { createDailyLog, DailyLog, getMyDailyLogs, getAllDailyLogs, downloadExport, updateDailyLog } from "@/lib/api";
import { useToast } from "@/lib/toast";

export default function LogsPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");

  const [logDate, setLogDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState("");
  const [problemsFaced, setProblemsFaced] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);
  const [editSummary, setEditSummary] = useState("");
  const [editProblemsFaced, setEditProblemsFaced] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const authUser = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("auth_user") || "{}") : null;
  const canManage = authUser?.role === "ADMIN" || authUser?.role === "MANAGER";
  const isAdmin = authUser?.role === "ADMIN";

  async function loadData() {
    try {
      setLoading(true);
      const data = canManage ? await getAllDailyLogs() : await getMyDailyLogs();
      setLogs(data);
    } catch (error) {
      setFeedback("Failed to load daily logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setFeedback("Log submitted successfully!");
      await loadData();
      
      setTimeout(() => setFeedback(""), 3000);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to submit log");
    }
  }

  function startEdit(log: DailyLog) {
    setEditingLog(log);
    setEditSummary(log.summary);
    setEditProblemsFaced(log.problemsFaced || "");
    setFeedback("");
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
      setFeedback("Log updated successfully!");
      await loadData();
      setTimeout(() => setFeedback(""), 3000);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to update log");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadExport(
        "logs",
        filterDate ? `daily-logs-${filterDate}.csv` : "daily-logs-export.csv",
        filterDate ? { from: filterDate, to: filterDate } : undefined
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
    const matchesDate = filterDate ? log.logDate.startsWith(filterDate) : true;
    return matchesName && matchesDate;
  });

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

      {feedback && (
        <div style={{ 
          background: feedback.includes("success") ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", 
          color: feedback.includes("success") ? "var(--success-color)" : "var(--danger-color)", 
          padding: "12px", borderRadius: "8px", marginBottom: "24px" 
        }}>
          {feedback}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>Loading logs...</div>
      ) : (
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
      )}
    </div>
  );
}
