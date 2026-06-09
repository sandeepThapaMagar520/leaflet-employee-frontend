"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getProject, Project, Task, getTasksByProject, getMyTasks,
  updateTaskStatus, TaskStatus,
  getTaskComments, createTaskComment, TaskComment, uploadToCloudinary,
  getProjectMilestones, ProjectMilestone,
} from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import ProjectKanban from "@/app/components/ProjectKanban";

const taskStatusOptions: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const getStatusBadgeClass = (s: string) =>
  s === "PLANNED" ? "badge-todo" : s === "ACTIVE" ? "badge-in-progress" :
  s === "COMPLETED" ? "badge-done" : s === "ON_HOLD" ? "badge-blocked" : "";

export default function EmployeeProjectView({ projectId }: { projectId: number }) {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth(["EMPLOYEE"]);

  const [project, setProject] = useState<Project | null>(null);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentAttachment, setCommentAttachment] = useState<{ url: string; name: string } | null>(null);
  const [savingComment, setSavingComment] = useState(false);
  const [uploadingCommentFile, setUploadingCommentFile] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<"success" | "error">("error");
  const commentFileInputRef = useRef<HTMLInputElement>(null);

  async function loadData() {
    setLoading(true);
    setFeedback("");
    try {
      const [proj, tasks, assigned] = await Promise.all([
        getProject(projectId),
        getTasksByProject(projectId),
        getMyTasks(),
      ]);
      const isAssigned = proj.assignedEmployees?.some(e => e.id === user?.userId);
      if (!isAssigned) {
        setFeedbackKind("error");
        setFeedback("You are not assigned to this project.");
        setProject(null);
        return;
      }
      setProject(proj);
      setProjectTasks(tasks);
      setMyTasks(assigned.filter(t => t.projectId === projectId));
      setMilestones(await getProjectMilestones(projectId));
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
      setLoadingTasks(false);
    }
  }

  useEffect(() => {
    if (!authLoading && user && !Number.isNaN(projectId)) void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, projectId, user?.userId]);

  async function handleStatusChange(taskId: number, status: TaskStatus) {
    setFeedback("");
    try {
      await updateTaskStatus(taskId, status);
      setLoadingTasks(true);
      const [tasks, assigned] = await Promise.all([
        getTasksByProject(projectId),
        getMyTasks(),
      ]);
      setProjectTasks(tasks);
      setMyTasks(assigned.filter(t => t.projectId === projectId));
      setFeedbackKind("success");
      setFeedback("Task status updated.");
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to update task status.");
    } finally {
      setLoadingTasks(false);
    }
  }

  async function handleTaskSelect(task: Task) {
    setSelectedTask(task);
    setCommentText("");
    setCommentAttachment(null);
    setLoadingComments(true);
    try {
      setTaskComments(await getTaskComments(task.id));
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to load task comments.");
    } finally {
      setLoadingComments(false);
    }
  }

  async function handleCommentFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setFeedbackKind("error");
      setFeedback("Attachment exceeds the 10MB limit.");
      return;
    }
    setUploadingCommentFile(true);
    try {
      const url = await uploadToCloudinary(file);
      setCommentAttachment({ url, name: file.name });
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "File upload failed.");
    } finally {
      setUploadingCommentFile(false);
    }
  }

  async function handleAddTaskComment() {
    if (!selectedTask || !commentText.trim()) return;
    setSavingComment(true);
    try {
      await createTaskComment(selectedTask.id, {
        content: commentText.trim(),
        attachmentUrl: commentAttachment?.url,
        attachmentName: commentAttachment?.name,
      });
      setCommentText("");
      setCommentAttachment(null);
      setTaskComments(await getTaskComments(selectedTask.id));
      setFeedbackKind("success");
      setFeedback("Task comment added.");
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to add comment.");
    } finally {
      setSavingComment(false);
    }
  }

  if (authLoading || loading) return <div className="p-8">Loading project…</div>;

  if (!project) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl mb-4">{feedback || "Project not found"}</h1>
        <button onClick={() => router.push("/projects")} className="btn-secondary">Back to Projects</button>
      </div>
    );
  }

  const feedbackStyles = feedbackKind === "success"
    ? { background: "rgba(34,197,94,0.12)", color: "var(--success-color,#22c55e)" }
    : { background: "rgba(239,68,68,0.1)", color: "var(--danger-color)" };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-6 mb-8">
        <button onClick={() => router.push("/projects")} className="btn-secondary"
          style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Projects
        </button>
        <div>
          <h1 className="text-gradient" style={{ fontSize: "2.2rem", lineHeight: 1.2 }}>{project.name}</h1>
          <p className="text-muted" style={{ marginTop: "4px" }}>View project board and your assigned tasks.</p>
        </div>
      </div>

      {feedback && (
        <div style={{ ...feedbackStyles, padding: "12px", borderRadius: "8px", marginBottom: "24px" }}>
          {feedback}
        </div>
      )}

      <div className="glass-panel" style={{ padding: "32px", marginBottom: "32px" }}>
        <div className="flex items-center gap-3 mb-2">
          <span className={`badge ${getStatusBadgeClass(project.status)}`}>{project.status}</span>
          <span className="text-sm text-muted">Manager: {project.managerName}</span>
          {project.dueDate && (
            <span className="text-sm text-muted">
              Due: {new Date(project.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>
        {project.description && (
          <p style={{ lineHeight: 1.7, color: "var(--text-secondary)", marginTop: "12px" }}>
            {project.description}
          </p>
        )}
      </div>

      <div className="glass-card" style={{ marginBottom: "32px" }}>
        <div className="mb-5">
          <h2 style={{ fontSize: "1.25rem" }}>Milestones</h2>
          <p className="text-sm text-muted">Project checkpoints and delivery dates.</p>
        </div>
        <div style={{ display: "grid", gap: "12px" }}>
          {milestones.map(milestone => (
            <div key={milestone.id} className="flex justify-between items-start gap-4" style={{ padding: "14px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "rgba(15,23,42,0.35)" }}>
              <div>
                <div style={{ fontWeight: 600, textDecoration: milestone.completed ? "line-through" : "none" }}>{milestone.title}</div>
                {milestone.description && <p className="text-sm text-muted mt-1">{milestone.description}</p>}
                <div className="text-xs text-muted mt-2">{milestone.dueDate ? `Due ${new Date(milestone.dueDate).toLocaleDateString()}` : "No due date"}</div>
              </div>
              <span className={`badge ${milestone.completed ? "badge-done" : "badge-in-progress"}`}>{milestone.completed ? "DONE" : "OPEN"}</span>
            </div>
          ))}
          {milestones.length === 0 && <p className="text-muted">No milestones yet.</p>}
        </div>
      </div>

      <div className="mb-10">
        <div className="mb-6">
          <h2 style={{ fontSize: "1.8rem" }}>Project Board</h2>
          <p className="text-muted">Overview of all tasks on this project (view only).</p>
        </div>
        <ProjectKanban
          tasks={projectTasks}
          readOnly
          loading={loadingTasks}
          onTaskSelect={task => void handleTaskSelect(task)}
          selectedTaskId={selectedTask?.id ?? null}
        />
      </div>

      <div className="glass-card" style={{ marginBottom: "32px" }}>
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h2 style={{ fontSize: "1.25rem" }}>Task Discussion</h2>
            <p className="text-sm text-muted">
              {selectedTask ? selectedTask.title : "Select a task card to view comments and attachments."}
            </p>
          </div>
          {selectedTask && <span className="badge badge-in-progress">{selectedTask.status.replace("_", " ")}</span>}
        </div>
        {selectedTask && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 360px) minmax(0, 1fr)", gap: "18px" }}>
            <div style={{ display: "grid", gap: "12px" }}>
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                rows={4}
                placeholder="Add a task comment..."
                style={{ width: "100%" }}
              />
              <input
                ref={commentFileInputRef}
                type="file"
                style={{ display: "none" }}
                onChange={e => void handleCommentFileSelect(e)}
              />
              <div className="flex gap-2 flex-wrap">
                <button type="button" className="btn-secondary" disabled={uploadingCommentFile} onClick={() => commentFileInputRef.current?.click()}>
                  {uploadingCommentFile ? "Uploading..." : "Attach File"}
                </button>
                <button type="button" className="btn-primary" disabled={savingComment || !commentText.trim()} onClick={() => void handleAddTaskComment()}>
                  {savingComment ? "Posting..." : "Post Comment"}
                </button>
              </div>
              {commentAttachment && (
                <div className="text-sm text-muted">
                  Attached: <a href={commentAttachment.url} target="_blank" rel="noreferrer">{commentAttachment.name}</a>
                </div>
              )}
            </div>
            <div style={{ display: "grid", gap: "12px" }}>
              {loadingComments ? (
                <p className="text-muted">Loading comments...</p>
              ) : taskComments.length === 0 ? (
                <p className="text-muted">No comments yet.</p>
              ) : (
                taskComments.map(comment => (
                  <div key={comment.id} style={{ padding: "14px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "rgba(15,23,42,0.35)" }}>
                    <div className="flex justify-between text-xs text-muted mb-2">
                      <span>{comment.userFullName}</span>
                      <span>{new Date(comment.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm" style={{ lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{comment.content}</p>
                    {comment.attachmentUrl && (
                      <a className="text-sm" href={comment.attachmentUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent-color)", display: "inline-block", marginTop: "10px" }}>
                        {comment.attachmentName || "Open attachment"}
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="mb-6">
          <h2 style={{ fontSize: "1.8rem" }}>My Assigned Tasks</h2>
          <p className="text-muted">
            {myTasks.length} task{myTasks.length !== 1 ? "s" : ""} assigned to you on this project.
          </p>
        </div>
        {myTasks.length === 0 ? (
          <div className="glass-card" style={{ textAlign: "center", padding: "48px", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "12px" }}>✅</div>
            <p>No tasks assigned to you on this project yet.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: "16px" }}>
            {myTasks.map(task => (
              <div key={task.id} className="glass-card" style={{ padding: "18px" }}>
                <div className="flex justify-between items-start mb-3">
                  <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>{task.title}</h3>
                  <span className="badge" style={{ background: "rgba(139,92,246,0.15)", color: "#c4b5fd", fontSize: "0.7rem" }}>
                    {task.priority}
                  </span>
                </div>
                {task.description && (
                  <p className="text-sm text-muted mb-4" style={{ lineHeight: 1.5 }}>{task.description}</p>
                )}
                {task.dueDate && (
                  <p className="text-xs text-muted mb-4">
                    Due: {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-sm">Status:</span>
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
    </div>
  );
}
