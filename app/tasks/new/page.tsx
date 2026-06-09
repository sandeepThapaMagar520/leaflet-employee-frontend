"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { createTask, Project, getProjects, getUsers, User, TaskPriority } from "@/lib/api";
import { useAuth } from "@/lib/hooks";

function NewTaskForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("projectId");
  
  const { loading: authLoading } = useAuth(["ADMIN", "MANAGER"]);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState<number | "">(initialProjectId ? Number(initialProjectId) : "");
  const [assignedToId, setAssignedToId] = useState<number | "">("");
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [projList, userList] = await Promise.all([getProjects(), getUsers()]);
        setProjects(projList);
        setUsers(userList);
      } catch (err) {
        console.error("Failed to load data", err);
      }
    }
    if (!authLoading) {
      loadData();
    }
  }, [authLoading]);

  if (authLoading) return <div className="p-8">Verifying access...</div>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !projectId || !assignedToId) {
      setError("Title, project, and assignee are required");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await createTask({
        title,
        description,
        priority,
        projectId: Number(projectId),
        assignedToId: Number(assignedToId),
        dueDate: dueDate || undefined
      });
      router.push(`/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <div className="mb-8">
        <button 
          onClick={() => router.back()}
          className="btn-secondary mb-4"
          style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back
        </button>
        <h1 className="text-gradient" style={{ fontSize: "2.2rem" }}>Create New Task</h1>
        <p className="text-muted mt-2">Define a specific deliverable and assign it to a team member.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: "32px" }}>
        {error && (
          <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--danger-color)", padding: "12px", borderRadius: "8px", marginBottom: "24px", fontSize: "0.9rem" }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gap: "24px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "0.9rem" }}>Task Title *</label>
            <input
              type="text"
              placeholder="e.g. Design homepage hero section"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%" }}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "0.9rem" }}>Description</label>
            <textarea
              placeholder="Details about the task expectations..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: "100%", minHeight: "100px", resize: "vertical" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "0.9rem" }}>Project *</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value === "" ? "" : Number(e.target.value))}
                style={{ width: "100%" }}
                required
              >
                <option value="">Select a project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "0.9rem" }}>Assignee *</label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value === "" ? "" : Number(e.target.value))}
                style={{ width: "100%" }}
                required
              >
                <option value="">Select an employee</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "0.9rem" }}>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                style={{ width: "100%" }}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: 500, fontSize: "0.9rem" }}>Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div style={{ marginTop: "12px", display: "flex", gap: "16px", justifyContent: "flex-end" }}>
            <button 
              type="button" 
              onClick={() => router.back()}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary"
              disabled={loading}
              style={{ minWidth: "160px" }}
            >
              {loading ? "Creating..." : "Create Task"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewTaskPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <NewTaskForm />
    </Suspense>
  );
}
