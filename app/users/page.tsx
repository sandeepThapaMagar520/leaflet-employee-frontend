"use client";

import { FormEvent, useEffect, useState } from "react";
import { getUsersPaged, registerUser, updateUser, deleteUser, Role, User } from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import ActionModal from "@/app/components/ActionModal";
import Pagination from "@/app/components/Pagination";

const roleOptions: Role[] = ["EMPLOYEE", "MANAGER", "ADMIN"];

const roleBadgeStyle = (role: Role): React.CSSProperties => {
  switch (role) {
    case "ADMIN":
      return { background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" };
    case "MANAGER":
      return { background: "rgba(251,146,60,0.15)", color: "#fdba74", border: "1px solid rgba(251,146,60,0.3)" };
    case "EMPLOYEE":
      return { background: "rgba(34,197,94,0.15)", color: "#86efac", border: "1px solid rgba(34,197,94,0.3)" };
  }
};

export default function UsersAdminPage() {
  const { loading: authLoading } = useAuth(["ADMIN"]);
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("EMPLOYEE");
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<Role>("EMPLOYEE");
  const [editActive, setEditActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadData(nextPage = page) {
    setLoading(true);
    try {
      const result = await getUsersPaged(nextPage, 15, searchQuery);
      setUsers(result.content);
      setPage(result.page);
      setTotalPages(result.totalPages);
      setTotalElements(result.totalElements);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading) {
      void loadData(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  useEffect(() => {
    if (!authLoading) {
      const timer = window.setTimeout(() => void loadData(0), 300);
      return () => window.clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  if (authLoading) return <div className="p-8">Verifying access...</div>;

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await registerUser({ fullName, email, role });
      toast.success(result.message);
      setFullName(""); setEmail(""); setRole("EMPLOYEE");
      setShowForm(false);
      await loadData(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to register user");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(user: User) {
    setEditingUser(user);
    setEditFullName(user.fullName);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditActive(user.active);
    setShowForm(false);
  }

  function cancelEdit() {
    setEditingUser(null);
  }

  async function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      await updateUser(editingUser.id, {
        fullName: editFullName,
        email: editEmail,
        role: editRole,
        active: editActive,
      });
      toast.success(`User "${editFullName}" updated successfully!`);
      setEditingUser(null);
      await loadData(page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update user");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUser(deleteTarget.id);
      toast.success(`User "${deleteTarget.fullName}" deleted successfully!`);
      setDeleteTarget(null);
      await loadData(page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>Loading users...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 style={{ fontSize: "1.8rem" }}>Staff Management</h1>
          <p className="text-muted mt-2">View, manage, and register all system staff.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowForm(f => !f)}
        >
          {showForm ? "Cancel" : "+ Register New Staff"}
        </button>
      </div>

      {showForm && (
        <div className="glass-card" style={{ marginBottom: "32px", maxWidth: "600px" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>👤</span> Register New Staff
          </h2>
          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                placeholder="e.g. Jane Smith"
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="e.g. jane@company.com"
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value as Role)} style={{ width: "100%" }}>
                {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <button type="submit" className="btn-primary mt-4" disabled={submitting}>
              {submitting ? "Registering..." : "Register Staff"}
            </button>
            <p className="text-muted text-sm" style={{ lineHeight: 1.6 }}>
              The staff member will receive a six-digit email OTP. They must verify it before the new-password form becomes available.
            </p>
          </form>
        </div>
      )}

      {editingUser && (
        <div className="glass-card" style={{ marginBottom: "32px", maxWidth: "600px", border: "1px solid var(--primary-color)" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>✏️</span> Edit Staff: {editingUser.fullName}
          </h2>
          <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Full Name</label>
              <input
                type="text"
                value={editFullName}
                onChange={e => setEditFullName(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Email Address</label>
              <input
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </div>
            <div className="flex gap-4">
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Role</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value as Role)} style={{ width: "100%" }}>
                  {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>Status</label>
                <select value={editActive ? "true" : "false"} onChange={e => setEditActive(e.target.value === "true")} style={{ width: "100%" }}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={savingEdit}>
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card" style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "16px" }}>
          <h2 style={{ fontSize: "1.1rem" }}>All Staff ({totalElements})</h2>
          <div style={{ position: "relative", width: "100%", maxWidth: "300px" }}>
            <input 
              type="text" 
              placeholder="Search by name, email or role..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "10px 16px", borderRadius: "8px", fontSize: "0.9rem" }}
            />
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
              <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontWeight: 500 }}>ID</th>
              <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontWeight: 500 }}>Full Name</th>
              <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontWeight: 500 }}>Email</th>
              <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontWeight: 500 }}>Role</th>
              <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontWeight: 500 }}>Status</th>
              <th style={{ padding: "12px 16px", color: "var(--text-secondary)", fontWeight: 500, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <td style={{ padding: "16px", color: "var(--text-secondary)" }}>#{user.id}</td>
                <td style={{ padding: "16px", fontWeight: 500 }}>{user.fullName}</td>
                <td style={{ padding: "16px", color: "var(--text-secondary)" }}>{user.email}</td>
                <td style={{ padding: "16px" }}>
                  <span style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    ...roleBadgeStyle(user.role),
                  }}>
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: "16px" }}>
                  <span style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    background: user.active ? "rgba(34,197,94,0.1)" : "rgba(100,116,139,0.15)",
                    color: user.active ? "#86efac" : "#94a3b8",
                    border: `1px solid ${user.active ? "rgba(34,197,94,0.3)" : "rgba(100,116,139,0.3)"}`,
                  }}>
                    {user.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ padding: "16px", textAlign: "right" }}>
                  <button 
                    className="btn-secondary" 
                    style={{ padding: "6px 12px", fontSize: "0.8rem", marginRight: "8px" }}
                    onClick={() => startEdit(user)}
                  >
                    Edit
                  </button>
                  <button 
                    className="btn-secondary" 
                    style={{ padding: "6px 12px", fontSize: "0.8rem", background: "rgba(239,68,68,0.1)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }}
                    onClick={() => setDeleteTarget(user)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>No staff found.</td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={page}
          totalPages={totalPages}
          totalElements={totalElements}
          onPageChange={(next) => void loadData(next)}
        />
      </div>
      <ActionModal
        open={deleteTarget !== null}
        title="Delete Staff Member"
        description={`This will deactivate and delete "${deleteTarget?.fullName ?? "this user"}" from the staff list.`}
        confirmLabel="Delete User"
        tone="danger"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
