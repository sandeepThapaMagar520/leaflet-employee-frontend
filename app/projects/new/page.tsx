"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createProject, User, getUsers } from "@/lib/api";
import { useAuth } from "@/lib/hooks";

export default function NewProjectPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth(["ADMIN", "MANAGER"]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [managerId, setManagerId] = useState<number | "">("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  // Budget is optional — empty string means "not set"
  const [budgetAmount, setBudgetAmount] = useState("");


  const [managers, setManagers] = useState<User[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUsers() {
      try {
        const users = await getUsers();
        setManagers(users.filter(u => u.role === "ADMIN" || u.role === "MANAGER"));
        setEmployees(users.filter(u => u.role === "EMPLOYEE"));
      } catch (err) {
        console.error("Failed to load users", err);
      }
    }
    if (!authLoading) void loadUsers();
  }, [authLoading]);

  if (authLoading) return <div className="p-8">Verifying access...</div>;

  function toggleEmployee(id: number) {
    setAssignedEmployeeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !managerId) {
      setError("Project name and manager are required.");
      return;
    }
    const parsedBudget = budgetAmount.trim() === "" ? undefined : parseFloat(budgetAmount);
    if (parsedBudget !== undefined && (Number.isNaN(parsedBudget) || parsedBudget < 0)) {
      setError("Budget must be a valid positive number.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        managerId: Number(managerId),
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        budgetAmount: parsedBudget,
        assignedEmployeeIds,
      });
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto" }}>
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="btn-secondary mb-4"
          style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </button>
        <h1 className="text-gradient" style={{ fontSize: "2.2rem" }}>Create New Project</h1>
        <p className="text-muted mt-2">Set up a new project, assign a manager, and optionally set a budget.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: "32px" }}>
        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--danger-color)", padding: "12px", borderRadius: "8px", marginBottom: "24px", fontSize: "0.9rem" }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gap: "24px" }}>

          {/* Name */}
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "0.9rem" }}>
              Project Name <span style={{ color: "var(--danger-color)" }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Website Redesign"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ width: "100%" }}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "0.9rem" }}>Description</label>
            <textarea
              placeholder="Brief overview of the project goals..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ width: "100%", minHeight: "90px", resize: "vertical" }}
            />
          </div>

          {/* Manager + Budget */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "0.9rem" }}>
                Project Manager <span style={{ color: "var(--danger-color)" }}>*</span>
              </label>
              <select
                value={managerId}
                onChange={e => setManagerId(e.target.value === "" ? "" : Number(e.target.value))}
                style={{ width: "100%" }}
                required
              >
                <option value="">Select a manager</option>
                {managers.map(m => (
                  <option key={m.id} value={m.id}>{m.fullName}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "0.9rem" }}>
                Budget (USD) <span style={{ color: "var(--text-secondary)", fontWeight: 400, fontSize: "0.8rem" }}>— optional</span>
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Leave blank if not set yet"
                value={budgetAmount}
                onChange={e => setBudgetAmount(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "0.9rem" }}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "0.9rem" }}>Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Team Members */}
          {employees.length > 0 && (
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "0.9rem" }}>
                Assign Team Members <span style={{ color: "var(--text-secondary)", fontWeight: 400, fontSize: "0.8rem" }}>— optional</span>
              </label>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "8px",
                padding: "12px",
                background: "rgba(15,23,42,0.4)",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
              }}>
                {employees.map(emp => (
                  <label
                    key={emp.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      background: assignedEmployeeIds.includes(emp.id) ? "rgba(59,130,246,0.15)" : "transparent",
                      border: assignedEmployeeIds.includes(emp.id) ? "1px solid rgba(59,130,246,0.3)" : "1px solid transparent",
                      transition: "all 0.15s ease",
                      fontSize: "0.85rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={assignedEmployeeIds.includes(emp.id)}
                      onChange={() => toggleEmployee(emp.id)}
                      style={{ accentColor: "var(--primary-color)" }}
                    />
                    {emp.fullName}
                  </label>
                ))}
              </div>
              {assignedEmployeeIds.length > 0 && (
                <p className="text-xs text-muted mt-2">{assignedEmployeeIds.length} member{assignedEmployeeIds.length > 1 ? "s" : ""} selected</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ marginTop: "8px", display: "flex", gap: "16px", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => router.back()} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading} style={{ minWidth: "160px" }}>
              {loading ? "Creating..." : "Create Project"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
