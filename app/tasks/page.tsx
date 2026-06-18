"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllTasks, deleteTask, getMyTasks, updateTaskStatus, Task, TaskStatus } from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import ActionModal from "@/app/components/ActionModal";

const taskStatusOptions: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];

function getStatusBadgeClass(status: string) {
  if (status === "TODO") return "badge-todo";
  if (status === "IN_PROGRESS") return "badge-in-progress";
  if (status === "DONE") return "badge-done";
  if (status === "BLOCKED") return "badge-blocked";
  return "";
}

function EmployeeTasksPage() {
  const router = useRouter();
  const toast = useToast();
  const { loading: authLoading } = useAuth(["EMPLOYEE"]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await getMyTasks());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) void loadData();
  }, [authLoading, loadData]);

  async function handleStatusChange(taskId: number, status: TaskStatus) {
    try {
      await updateTaskStatus(taskId, status);
      await loadData();
      toast.success("Task status updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  if (authLoading || loading) return <div className="p-8">Loading tasks…</div>;

  const filteredTasks = tasks.filter(task => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.projectName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-gradient" style={{ fontSize: "2.2rem", marginBottom: "8px" }}>My Tasks</h1>
        <p className="text-muted">All tasks assigned to you across projects.</p>
      </div>

      <div className="glass-card mb-6" style={{ padding: "16px" }}>
        <div className="flex gap-4 items-center flex-wrap">
          <input
            type="text"
            placeholder="Search by title or project…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1, minWidth: "220px" }}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minWidth: "140px" }}>
            <option value="ALL">All Status</option>
            {taskStatusOptions.map(s => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="glass-card" style={{ textAlign: "center", padding: "64px", color: "var(--text-secondary)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>✅</div>
          <h3 style={{ marginBottom: "8px" }}>No tasks assigned</h3>
          <p className="text-sm text-muted">Tasks assigned to you will appear here.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: "16px" }}>
          {filteredTasks.map(task => (
            <div key={task.id} className="glass-card" style={{ padding: "20px" }}>
              <div className="flex justify-between items-start mb-3">
                <h3 style={{ fontSize: "1.05rem", fontWeight: 600 }}>{task.title}</h3>
                <span className="badge" style={{ background: "rgba(139,92,246,0.15)", color: "#c4b5fd", fontSize: "0.7rem" }}>
                  {task.priority}
                </span>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/projects/${task.projectId}`)}
                className="text-sm"
                style={{ color: "var(--primary-color)", background: "none", border: "none", padding: 0, cursor: "pointer", marginBottom: "12px" }}
              >
                📁 {task.projectName}
              </button>
              {task.description && (
                <p className="text-sm text-muted mb-4" style={{ lineHeight: 1.5 }}>{task.description}</p>
              )}
              {task.dueDate && (
                <p className="text-xs text-muted mb-4">
                  Due: {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
              <div className="flex items-center gap-2">
                <span className={`badge ${getStatusBadgeClass(task.status)}`} style={{ fontSize: "0.7rem" }}>
                  {task.status.replace("_", " ")}
                </span>
                <select
                  value={task.status}
                  onChange={e => void handleStatusChange(task.id, e.target.value as TaskStatus)}
                  style={{ padding: "6px 10px", fontSize: "0.85rem", flex: 1 }}
                >
                  {taskStatusOptions.map(s => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminTasksPage() {
  const router = useRouter();
  const toast = useToast();
  const { loading: authLoading } = useAuth(["ADMIN", "MANAGER"]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await getAllTasks());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) void loadData();
  }, [authLoading, loadData]);

  if (authLoading) return <div className="p-8">Verifying access...</div>;

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTask(deleteTarget.id);
      toast.success("Task deleted successfully");
      setDeleteTarget(null);
      await loadData();
    } catch {
      toast.error("Failed to delete task");
    } finally {
      setDeleting(false);
    }
  }

  const filteredTasks = tasks.filter(task => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assignedToName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "ALL" || task.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: "400px" }}>
        <div className="animate-pulse text-muted">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-gradient" style={{ fontSize: "2.2rem", marginBottom: "8px" }}>Task Management</h1>
          <p className="text-muted">Monitor and distribute workload across the entire team.</p>
        </div>
        <button onClick={() => router.push("/tasks/new")} className="btn-primary">Add New Task</button>
      </div>

      <div className="glass-card mb-6" style={{ padding: "16px" }}>
        <div className="flex gap-4 items-center flex-wrap">
          <input
            type="text"
            placeholder="Search by title, project, or assignee..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1, minWidth: "250px" }}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ALL">All Status</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="BLOCKED">Blocked</option>
            <option value="DONE">Done</option>
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="ALL">All Priority</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
      </div>

      <div className="glass-card" style={{ overflowX: "auto", padding: "0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-color)", background: "rgba(255,255,255,0.02)" }}>
              <th style={{ padding: "16px" }}>TASK</th>
              <th style={{ padding: "16px" }}>PROJECT</th>
              <th style={{ padding: "16px" }}>ASSIGNEE</th>
              <th style={{ padding: "16px" }}>PRIORITY</th>
              <th style={{ padding: "16px" }}>STATUS</th>
              <th style={{ padding: "16px", textAlign: "right" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map(task => (
              <tr key={task.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <td style={{ padding: "16px", fontWeight: 600 }}>{task.title}</td>
                <td style={{ padding: "16px" }}>{task.projectName}</td>
                <td style={{ padding: "16px" }}>{task.assignedToName}</td>
                <td style={{ padding: "16px" }}>{task.priority}</td>
                <td style={{ padding: "16px" }}>
                  <span className={`badge ${getStatusBadgeClass(task.status)}`}>{task.status}</span>
                </td>
                <td style={{ padding: "16px", textAlign: "right" }}>
                  <button onClick={() => setDeleteTarget(task)} className="btn-secondary" style={{ color: "var(--danger-color)" }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filteredTasks.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "64px", textAlign: "center" }}>No tasks found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ActionModal
        open={deleteTarget !== null}
        title="Delete Task"
        description={`This will permanently delete "${deleteTarget?.title ?? "this task"}" from ${deleteTarget?.projectName ?? "the project"}.`}
        confirmLabel="Delete Task"
        tone="danger"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

export default function TasksPage() {
  const { loading, user } = useAuth(["ADMIN", "MANAGER", "EMPLOYEE"]);

  if (loading) return <div className="p-8">Verifying access...</div>;
  if (user?.role === "EMPLOYEE") return <EmployeeTasksPage />;
  return <AdminTasksPage />;
}
