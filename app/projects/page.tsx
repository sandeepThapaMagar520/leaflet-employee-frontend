"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getProjects, deleteProject, Project } from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import ActionModal from "@/app/components/ActionModal";

function formatMoney(amount: number | null | undefined) {
  const n = Number(amount ?? 0);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function getStatusBadgeClass(status: string) {
  if (status === "PLANNED") return "badge-todo";
  if (status === "ACTIVE") return "badge-in-progress";
  if (status === "COMPLETED") return "badge-done";
  if (status === "ON_HOLD") return "badge-blocked";
  return "";
}

function EmployeeProjectsPage() {
  const router = useRouter();
  const toast = useToast();
  const { loading: authLoading, user } = useAuth(["EMPLOYEE"]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      try {
        const list = await getProjects(controller.signal);
        setProjects(list.filter(p => p.assignedEmployees?.some(e => e.id === user?.userId)));
      } catch (err) {
        if (controller.signal.aborted) return;
        toast.error(err instanceof Error ? err.message : "Failed to load projects");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [authLoading, toast, user?.userId]);

  if (authLoading || loading) return <div className="p-8">Loading projects…</div>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-gradient" style={{ fontSize: "2.2rem", marginBottom: "8px" }}>My Projects</h1>
        <p className="text-muted">Projects you are assigned to. Open a project to view the board and your tasks.</p>
      </div>

      {projects.length === 0 ? (
        <div className="glass-card" style={{ textAlign: "center", padding: "64px", color: "var(--text-secondary)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>📁</div>
          <h3 style={{ marginBottom: "8px" }}>No projects assigned</h3>
          <p className="text-sm text-muted">You will see projects here once a manager adds you to a team.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: "20px" }}>
          {projects.map(project => (
            <button
              key={project.id}
              type="button"
              onClick={() => router.push(`/projects/${project.id}`)}
              className="glass-card"
              style={{ padding: "24px", textAlign: "left", cursor: "pointer", border: "1px solid var(--border-color)", width: "100%" }}
            >
              <div className="flex justify-between items-start mb-3">
                <h2 style={{ fontSize: "1.2rem", fontWeight: 600 }}>{project.name}</h2>
                <span className={`badge ${getStatusBadgeClass(project.status)}`}>{project.status}</span>
              </div>
              {project.description && (
                <p className="text-sm text-muted mb-4" style={{ lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {project.description}
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                <span>Manager: {project.managerName}</span>
                {project.dueDate && (
                  <span>Due: {new Date(project.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                )}
                <span>Progress: {project.progressPercentage ?? 0}%</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminProjectsPage() {
  const router = useRouter();
  const toast = useToast();
  const { loading: authLoading } = useAuth(["ADMIN", "MANAGER"]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const list = await getProjects(signal);
      setProjects(list);
    } catch (error) {
      if (signal?.aborted) return;
      toast.error(error instanceof Error ? error.message : "Failed to load projects");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [authLoading, loadData]);

  if (authLoading) return <div className="p-8">Verifying access...</div>;

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProject(deleteTarget.id);
      toast.success("Project deleted successfully");
      setDeleteTarget(null);
      await loadData();
    } catch {
      toast.error("Failed to delete project");
    } finally {
      setDeleting(false);
    }
  }

  const filteredProjects = projects
    .filter(project => {
      const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: "400px" }}>
        <div className="animate-pulse text-muted">Loading projects...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-gradient" style={{ fontSize: "2.2rem", marginBottom: "8px" }}>Projects</h1>
          <p className="text-muted">Manage and track all company projects and their deliverables.</p>
        </div>
        <button
          onClick={() => router.push("/projects/new")}
          className="btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Project
        </button>
      </div>

      <div className="glass-card mb-6" style={{ padding: "16px" }}>
        <div className="flex gap-4 items-center">
          <div style={{ position: "relative", flex: 1 }}>
            <input
              type="text"
              placeholder="Search projects by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", paddingLeft: "40px" }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Status:</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ minWidth: "140px" }}>
              <option value="ALL">All Statuses</option>
              <option value="PLANNED">Planned</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ overflowX: "auto", padding: "0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-color)", background: "rgba(255,255,255,0.02)" }}>
              <th style={{ padding: "16px", color: "var(--text-secondary)", fontWeight: 500, fontSize: "0.85rem" }}>PROJECT NAME</th>
              <th style={{ padding: "16px", color: "var(--text-secondary)", fontWeight: 500, fontSize: "0.85rem" }}>PROGRESS</th>
              <th style={{ padding: "16px", color: "var(--text-secondary)", fontWeight: 500, fontSize: "0.85rem" }}>MANAGER</th>
              <th style={{ padding: "16px", color: "var(--text-secondary)", fontWeight: 500, fontSize: "0.85rem" }}>BUDGET</th>
              <th style={{ padding: "16px", color: "var(--text-secondary)", fontWeight: 500, fontSize: "0.85rem" }}>STATUS</th>
              <th style={{ padding: "16px", color: "var(--text-secondary)", fontWeight: 500, fontSize: "0.85rem" }}>DUE DATE</th>
              <th style={{ padding: "16px", color: "var(--text-secondary)", fontWeight: 500, fontSize: "0.85rem", textAlign: "right" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map(project => {
              const pct = project.progressPercentage ?? 0;
              return (
                <tr
                  key={project.id}
                  onClick={() => router.push(`/projects/${project.id}`)}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer" }}
                  className="hover-row"
                >
                  <td style={{ padding: "16px" }}>
                    <div style={{ fontWeight: 600 }}>{project.name}</div>
                    <div className="text-xs text-muted" style={{ marginTop: "4px" }}>ID: #{project.id}</div>
                  </td>
                  <td style={{ padding: "16px", minWidth: "150px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ flex: 1, height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "10px", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "var(--success-color)" : "var(--primary-color)" }} />
                      </div>
                      <span style={{ fontSize: "0.75rem", fontWeight: 500, width: "32px" }}>{pct}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "16px" }}>{project.managerName}</td>
                  <td style={{ padding: "16px" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>{formatMoney(project.budgetAmount)}</div>
                  </td>
                  <td style={{ padding: "16px" }}>
                    <span className={`badge ${getStatusBadgeClass(project.status)}`}>{project.status}</span>
                  </td>
                  <td style={{ padding: "16px" }}>
                    {project.dueDate ? new Date(project.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </td>
                  <td style={{ padding: "16px", textAlign: "right" }} onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(project)}
                      className="btn-secondary"
                      style={{ padding: "6px", borderRadius: "6px", color: "var(--danger-color)" }}
                      title="Delete Project"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredProjects.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "64px 32px", textAlign: "center" }}>
                  <h3 style={{ marginBottom: "8px" }}>No projects found</h3>
                  <p className="text-sm text-muted">Try adjusting your filters or search terms.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ActionModal
        open={deleteTarget !== null}
        title="Delete Project"
        description={`This will permanently delete "${deleteTarget?.name ?? "this project"}" and all tasks inside it.`}
        confirmLabel="Delete Project"
        tone="danger"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

export default function ProjectsPage() {
  const { loading, user } = useAuth(["ADMIN", "MANAGER", "EMPLOYEE"]);

  if (loading) return <div className="p-8">Verifying access...</div>;
  if (user?.role === "EMPLOYEE") return <EmployeeProjectsPage />;
  return <AdminProjectsPage />;
}
