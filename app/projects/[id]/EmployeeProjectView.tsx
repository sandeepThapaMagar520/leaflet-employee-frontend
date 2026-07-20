"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getProject, Project, Task, getTasksByProject, getMyTasks,
  createTask, updateTask, deleteTask, updateTaskStatus, TaskStatus, TaskPriority,
  getTaskComments, createTaskComment, TaskComment, uploadFile, downloadMediaAsset,
  getProjectMilestones, ProjectMilestone,
  getProjectNotes, createProjectNote, ProjectNote,
  getProjectTaskBoards, ProjectTaskBoard,
} from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import ProjectKanban from "@/app/components/ProjectKanban";
import MentionTextarea, { MentionCandidate, mentionedUserIdsFromText } from "@/app/components/MentionTextarea";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const NOTE_CATEGORIES = ["GENERAL", "INITIAL_MEETING", "REQUIREMENT_GATHERING", "CHANGES", "FINDING"] as const;
type NoteCategory = typeof NOTE_CATEGORIES[number];
type NoteAttachment = { mediaAssetId: string; fileName: string; fileType: string; kind: "image" | "document" };

const getStatusBadgeClass = (s: string) =>
  s === "PLANNED" ? "badge-todo" : s === "ACTIVE" ? "badge-in-progress" :
  s === "COMPLETED" ? "badge-done" : s === "ON_HOLD" ? "badge-blocked" : "";

function todayIsoDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function EmployeeProjectView({ projectId }: { projectId: number }) {
  const router = useRouter();
  const toast = useToast();
  const { loading: authLoading, user } = useAuth(["EMPLOYEE"]);

  const [project, setProject] = useState<Project | null>(null);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [projectNotes, setProjectNotes] = useState<ProjectNote[]>([]);
  const [taskBoards, setTaskBoards] = useState<ProjectTaskBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentAttachment, setCommentAttachment] = useState<{ mediaAssetId: string; name: string } | null>(null);
  const [savingComment, setSavingComment] = useState(false);
  const [uploadingCommentFile, setUploadingCommentFile] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<"success" | "error">("error");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("MEDIUM");
  const [taskDueDate, setTaskDueDate] = useState("");
  const minTaskDueDate = todayIsoDate();
  const [taskAssigneeId, setTaskAssigneeId] = useState<number>(0);
  const [savingTask, setSavingTask] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteCategory, setNoteCategory] = useState<NoteCategory>("GENERAL");
  const [noteDate, setNoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [noteAttachments, setNoteAttachments] = useState<NoteAttachment[]>([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [viewingNote, setViewingNote] = useState<ProjectNote | null>(null);
  const [uploadingNoteFiles, setUploadingNoteFiles] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "MILESTONES" | "TASKS" | "NOTES">("OVERVIEW");
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const noteFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!feedback) return;
    if (feedbackKind === "success") toast.success(feedback);
    else toast.error(feedback);
  }, [feedback, feedbackKind, toast]);

  async function loadData() {
    setLoading(true);
    setFeedback("");
    try {
      const [proj, tasks, assigned, notes, milestoneList, boards] = await Promise.all([
        getProject(projectId),
        getTasksByProject(projectId),
        getMyTasks(),
        getProjectNotes(projectId),
        getProjectMilestones(projectId),
        getProjectTaskBoards(projectId),
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
      setProjectNotes(notes);
      setMilestones(milestoneList);
      setTaskBoards(boards);
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
      const task = projectTasks.find(item => item.id === taskId);
      if (canManageTasks && task) {
        await updateTask(taskId, {
          title: task.title,
          description: task.description ?? undefined,
          status,
          priority: task.priority,
          dueDate: task.dueDate ?? undefined,
          assignedToId: task.assignedToId,
        });
      } else {
        await updateTaskStatus(taskId, status);
      }
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

  function openNewTask() {
    setEditingTask(null);
    setTaskTitle("");
    setTaskDescription("");
    setTaskPriority("MEDIUM");
    setTaskDueDate("");
    setTaskAssigneeId(project?.assignedEmployees[0]?.id ?? user?.userId ?? 0);
    setShowTaskForm(true);
  }

  function openTaskEditor(task: Task) {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description ?? "");
    setTaskPriority(task.priority);
    setTaskDueDate(task.dueDate ?? "");
    setTaskAssigneeId(task.assignedToId);
    setShowTaskForm(true);
  }

  async function saveTask() {
    if (!taskTitle.trim() || !taskAssigneeId) return;
    if (taskDueDate && taskDueDate < minTaskDueDate) {
      setFeedbackKind("error");
      setFeedback("Due date must be today or a future date.");
      return;
    }
    setSavingTask(true);
    setFeedback("");
    try {
      if (editingTask) {
        await updateTask(editingTask.id, {
          title: taskTitle.trim(),
          description: taskDescription.trim() || undefined,
          status: editingTask.status,
          priority: taskPriority,
          dueDate: taskDueDate || undefined,
          assignedToId: taskAssigneeId,
        });
      } else {
        await createTask({
          title: taskTitle.trim(),
          description: taskDescription.trim() || undefined,
          priority: taskPriority,
          dueDate: taskDueDate || undefined,
          projectId,
          assignedToId: taskAssigneeId,
        });
      }
      setProjectTasks(await getTasksByProject(projectId));
      setShowTaskForm(false);
      setEditingTask(null);
      setFeedbackKind("success");
      setFeedback(editingTask ? "Task updated." : "Task created.");
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to save task.");
    } finally {
      setSavingTask(false);
    }
  }

  async function removeTask(task: Task) {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await deleteTask(task.id);
      setProjectTasks(await getTasksByProject(projectId));
      if (selectedTask?.id === task.id) setSelectedTask(null);
      setShowTaskForm(false);
      setFeedbackKind("success");
      setFeedback("Task deleted.");
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to delete task.");
    }
  }

  async function addTeamNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await createProjectNote(projectId, {
        noteType: "TEAM",
        content: JSON.stringify({
          category: noteCategory,
          date: noteDate,
          text: noteText.trim(),
          attachments: [],
        }),
        mediaAssetIds: noteAttachments.map(attachment => attachment.mediaAssetId),
      });
      setNoteText("");
      setNoteCategory("GENERAL");
      setNoteDate(new Date().toISOString().slice(0, 10));
      setNoteAttachments([]);
      setShowNoteForm(false);
      setProjectNotes(await getProjectNotes(projectId));
      setFeedbackKind("success");
      setFeedback("Project note added.");
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to add note.");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleNoteFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (noteAttachments.length + files.length > 10) {
      setFeedbackKind("error");
      setFeedback("You can attach up to 10 files to a note.");
      return;
    }
    const oversized = files.find(file => file.size > MAX_FILE_SIZE);
    if (oversized) {
      setFeedbackKind("error");
      setFeedback(`${oversized.name} exceeds the 10MB limit.`);
      return;
    }
    setUploadingNoteFiles(true);
    try {
      const uploaded = await Promise.all(files.map(async file => {
        const media = await uploadFile(file, "PROJECT_ATTACHMENT");
        if (media.status !== "VERIFIED") {
          throw new Error("The attachment is quarantined until malware scanning succeeds.");
        }
        return {
          mediaAssetId: media.id,
          fileName: media.originalFilename,
          fileType: media.detectedMimeType,
          kind: media.detectedMimeType.startsWith("image/") ? "image" as const : "document" as const,
        };
      }));
      setNoteAttachments(current => [...current, ...uploaded]);
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to upload note attachment.");
    } finally {
      setUploadingNoteFiles(false);
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
      const media = await uploadFile(file, "TASK_ATTACHMENT");
      if (media.status !== "VERIFIED") {
        throw new Error("The attachment is quarantined until malware scanning succeeds.");
      }
      setCommentAttachment({ mediaAssetId: media.id, name: media.originalFilename });
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
        mediaAssetId: commentAttachment?.mediaAssetId,
        mentionedUserIds: mentionedUserIdsFromText(commentText, mentionCandidates),
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

  const mentionCandidates = useMemo<MentionCandidate[]>(() => {
    if (!project) return [];
    const team = [
      { id: project.managerId, fullName: project.managerName },
      ...(project.assignedEmployees ?? []).map(employee => ({ id: employee.id, fullName: employee.fullName })),
    ];
    return Array.from(new Map(team.map(member => [member.id, member])).values())
      .filter(member => member.id !== user?.userId);
  }, [project, user?.userId]);

  if (authLoading || loading) return <div className="p-8">Loading project…</div>;

  if (!project) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl mb-4">{feedback || "Project not found"}</h1>
        <button onClick={() => router.push("/projects")} className="btn-secondary">Back to Projects</button>
      </div>
    );
  }

  const myMembership = project.assignedEmployees.find(employee => employee.id === user?.userId);
  const canManageTasks = myMembership?.canManageTasks ?? false;
  const canAddNotes = myMembership?.canAddNotes ?? false;
  const activeTaskCount = projectTasks.filter(task => task.status !== "DONE").length;
  const boardNameByStatus = Object.fromEntries(taskBoards.map(board => [board.statusKey, board.name]));
  const taskAssignees = project.assignedEmployees
    .filter((member, index, list) => list.findIndex(item => item.id === member.id) === index);

  function decodeNote(content: string): {
    category: NoteCategory;
    date: string;
    text: string;
    attachments: NoteAttachment[];
  } {
    try {
      const parsed = JSON.parse(content) as {
        category?: NoteCategory;
        date?: string;
        text?: string;
        attachments?: Array<NoteAttachment | string>;
      };
      return {
        category: parsed.category ?? "GENERAL",
        date: parsed.date ?? "",
        text: parsed.text ?? content,
        attachments: [],
      };
    } catch {
      return { category: "GENERAL", date: "", text: content, attachments: [] };
    }
  }

  function categoryLabel(category: NoteCategory) {
    return category.split("_").map(word => word[0] + word.slice(1).toLowerCase()).join(" ");
  }

  function decodeProjectNote(note: ProjectNote) {
    const decoded = decodeNote(note.content);
    decoded.attachments = (note.attachments ?? []).map(attachment => ({
      mediaAssetId: attachment.mediaAssetId,
      fileName: attachment.fileName,
      fileType: attachment.contentType,
      kind: attachment.contentType.startsWith("image/") ? "image" : "document",
    }));
    return decoded;
  }

  const viewingNoteDetails = viewingNote ? decodeProjectNote(viewingNote) : null;

  return (
    <div className="max-w-6xl mx-auto">
      <nav className="project-breadcrumb">
        <button type="button" onClick={() => router.push("/projects")}>Projects</button>
        <span>/</span>
        <span style={{ color: "var(--text-primary)" }}>{project.name}</span>
      </nav>

      <div className="glass-panel project-hero">
        <div className="project-hero-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <h1 style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.25 }}>{project.name}</h1>
              <span className={`badge ${getStatusBadgeClass(project.status)}`}>{project.status.replace("_", " ")}</span>
            </div>
            <div className="flex gap-4 flex-wrap text-sm text-muted">
              <span>Manager: <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>{project.managerName}</strong></span>
              {project.dueDate && <span>Due: <strong style={{ color: "var(--warning-color)", fontWeight: 500 }}>{new Date(project.dueDate).toLocaleDateString()}</strong></span>}
              <span>ID #{project.id}</span>
            </div>
          </div>
        </div>

        <div className="project-stat-strip">
          {[
            { label: "Progress", value: `${project.progressPercentage || 0}%`, color: "var(--primary-color)" },
            { label: "Active Tasks", value: String(activeTaskCount), color: "#c4b5fd" },
            { label: "My Tasks", value: String(myTasks.length), color: "var(--success-color)" },
            { label: "Notes", value: String(projectNotes.length), color: "var(--text-primary)" },
          ].map(stat => (
            <div key={stat.label} className="project-stat-chip">
              <div className="label">{stat.label}</div>
              <div className="value" style={{ color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="project-tabs" style={{ marginBottom: "20px" }}>
          {[
            { id: "OVERVIEW" as const, label: "Overview" },
            { id: "MILESTONES" as const, label: "Milestones" },
            { id: "TASKS" as const, label: "Tasks" },
            { id: "NOTES" as const, label: "Notes" },
          ].map(tab => (
            <button key={tab.id} type="button" className={`project-tab${activeTab === tab.id ? " active" : ""}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ paddingBottom: "48px" }}>
      {activeTab === "OVERVIEW" && (
        <div className="project-overview-grid" style={{ display: "grid", gridTemplateColumns: "1fr minmax(260px, 320px)", gap: "20px" }}>
          <div className="project-card-static">
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "12px" }}>About</h3>
            <p style={{ lineHeight: 1.75, color: "var(--text-secondary)", fontSize: "0.95rem" }}>{project.description || "No description provided."}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginTop: "28px", paddingTop: "24px", borderTop: "1px solid var(--border-color)" }}>
              {[
                { label: "Start", value: project.startDate ? new Date(project.startDate).toLocaleDateString() : "—" },
                { label: "Due", value: project.dueDate ? new Date(project.dueDate).toLocaleDateString() : "—" },
                { label: "Updated", value: project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : "—" },
              ].map(item => <div key={item.label}><div className="text-xs text-muted mb-1">{item.label}</div><div style={{ fontWeight: 500, fontSize: "0.9rem" }}>{item.value}</div></div>)}
            </div>
          </div>
          <div className="project-card-static">
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "16px" }}>Progress</h3>
            <div style={{ fontSize: "2.5rem", fontWeight: 700, marginBottom: "12px", color: "var(--primary-color)" }}>{project.progressPercentage || 0}%</div>
            <div style={{ height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "99px", overflow: "hidden", marginBottom: "20px" }}>
              <div style={{ width: `${project.progressPercentage || 0}%`, height: "100%", background: "linear-gradient(90deg, var(--primary-color), var(--accent-color))" }} />
            </div>
            <div style={{ paddingTop: "16px", borderTop: "1px solid var(--border-color)" }}>
              <div className="text-xs text-muted mb-1">Project Manager</div>
              <div style={{ fontWeight: 500, fontSize: "0.9rem" }}>{project.managerName}</div>
              <div className="text-xs text-muted mt-3 mb-1">Team Size</div>
              <div style={{ fontWeight: 500, fontSize: "0.9rem" }}>{project.assignedEmployees.length} employees</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "MILESTONES" && (
      <div className="project-section">
        <div className="project-section-header">
          <div>
            <h2>Milestones</h2>
            <p className="text-sm text-muted">Project checkpoints and delivery dates.</p>
          </div>
        </div>
        <div className="project-card-static">
        <div className="mb-5">
          <h3 style={{ fontSize: "1rem" }}>{milestones.length} milestone{milestones.length !== 1 ? "s" : ""}</h3>
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
      </div>
      )}

      {activeTab === "TASKS" && (
      <>
      <div className="project-section">
        <div className="flex justify-between items-end gap-4 mb-6">
          <div>
            <h2>Task Board</h2>
            <p className="text-sm text-muted">
              {canManageTasks ? "Create, assign, edit, and move tasks for this project." : "Overview of all tasks on this project."}
            </p>
          </div>
          {canManageTasks && <button type="button" className="btn-primary" onClick={openNewTask}>+ New Task</button>}
        </div>
        <ProjectKanban
          tasks={projectTasks}
          boards={taskBoards}
          readOnly={!canManageTasks}
          loading={loadingTasks}
          onTaskDrop={(taskId, status) => void handleStatusChange(taskId, status)}
          onTaskSelect={task => void handleTaskSelect(task)}
          selectedTaskId={selectedTask?.id ?? null}
        />
        {canManageTasks && selectedTask && (
          <div className="flex justify-end mt-3">
            <button type="button" className="btn-secondary" onClick={() => openTaskEditor(selectedTask)}>Edit selected task</button>
          </div>
        )}
      </div>

      {showTaskForm && canManageTasks && (
        <div className="project-modal-overlay" role="dialog" aria-modal="true" aria-label={editingTask ? "Edit task" : "Create task"}>
          <div className="glass-panel project-modal employee-task-modal">
            <div className="flex justify-between items-start gap-4 mb-5">
            <div>
              <h2 style={{ fontSize: "1.25rem" }}>{editingTask ? "Edit Task" : "New Task"}</h2>
              <p className="text-sm text-muted">Tasks can only be assigned to this project&apos;s team.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setShowTaskForm(false)}>Close</button>
            </div>
            <div className="employee-task-form">
              <label><span>Task title</span><input value={taskTitle} onChange={event => setTaskTitle(event.target.value)} placeholder="What needs to be done?" autoFocus /></label>
              <label><span>Description</span><textarea value={taskDescription} onChange={event => setTaskDescription(event.target.value)} placeholder="Add useful context for the assignee" rows={4} /></label>
              <div className="employee-task-fields">
                <label><span>Assignee</span><select value={taskAssigneeId || ""} onChange={event => setTaskAssigneeId(Number(event.target.value))}>
                  <option value="" disabled>Select assignee</option>
                  {taskAssignees.map(member => <option key={member.id} value={member.id}>{member.fullName}</option>)}
                </select></label>
                <label><span>Priority</span><select value={taskPriority} onChange={event => setTaskPriority(event.target.value as TaskPriority)}>
                  {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as TaskPriority[]).map(priority => <option key={priority} value={priority}>{priority}</option>)}
                </select></label>
                <label><span>Due date</span><input type="date" value={taskDueDate} min={minTaskDueDate} onChange={event => setTaskDueDate(event.target.value)} /></label>
              </div>
            </div>
            <div className="employee-modal-actions">
              {editingTask
                ? <button type="button" className="btn-secondary" style={{ color: "var(--danger-color)" }} onClick={() => void removeTask(editingTask)}>Delete Task</button>
                : <span />}
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => setShowTaskForm(false)}>Cancel</button>
                <button type="button" className="btn-primary" disabled={savingTask || !taskTitle.trim() || !taskAssigneeId} onClick={() => void saveTask()}>
                  {savingTask ? "Saving..." : editingTask ? "Save Changes" : "Create Task"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card" style={{ marginBottom: "32px" }}>
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h2 style={{ fontSize: "1.25rem" }}>Task Discussion</h2>
            <p className="text-sm text-muted">
              {selectedTask ? selectedTask.title : "Select a task card to view comments and attachments."}
            </p>
          </div>
          {selectedTask && <span className="badge badge-in-progress">{boardNameByStatus[selectedTask.status] ?? selectedTask.status.replace("_", " ")}</span>}
        </div>
        {selectedTask && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 360px) minmax(0, 1fr)", gap: "18px" }}>
            <div style={{ display: "grid", gap: "12px" }}>
              <MentionTextarea
                value={commentText}
                onChange={setCommentText}
                candidates={mentionCandidates}
                rows={4}
                placeholder="Add a task comment... use @ to mention someone"
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
                  Ready to attach: {commentAttachment.name}
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
                    {comment.mediaAssetId && (
                      <button type="button" className="text-sm" onClick={() => void downloadMediaAsset(
                        comment.mediaAssetId!,
                        comment.attachmentName || "attachment"
                      )} style={{ color: "var(--accent-color)", display: "inline-block", marginTop: "10px" }}>
                        {comment.attachmentName || "Download attachment"}
                      </button>
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
                    {taskBoards.map(board => (
                      <option key={board.statusKey} value={board.statusKey}>{board.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}

      {activeTab === "NOTES" && (
      <div className="project-section">
        <div className="project-section-header">
          <div>
            <h2>Notes</h2>
            <p className="text-sm text-muted">Notes shared with everyone assigned to this project.</p>
          </div>
          {canAddNotes
            ? <button type="button" className="btn-primary" onClick={() => setShowNoteForm(true)}>+ Add Note</button>
            : null}
        </div>
        <div className="employee-note-grid">
          {projectNotes.map(note => {
            const decoded = decodeProjectNote(note);
            return (
            <article key={note.id} className="employee-note-card">
              <div className="employee-note-card-header">
                <div>
                  <strong>{categoryLabel(decoded.category)}</strong>
                  <div className="text-xs text-muted">{note.createdByName} · {decoded.date || new Date(note.createdAt).toLocaleDateString()}</div>
                </div>
                <span className="employee-note-visibility">Project team</span>
              </div>
              <button
                type="button"
                className="employee-note-preview"
                onClick={() => setViewingNote(note)}
                aria-label={`View full ${categoryLabel(decoded.category)} note`}
              >
                {decoded.text}
              </button>
              <button type="button" className="note-view-link" onClick={() => setViewingNote(note)}>
                View full note
              </button>
              {decoded.attachments.length > 0 && (
                <div className="employee-note-attachments">
                  {decoded.attachments.map((attachment, index) => (
                    <button key={`${attachment.mediaAssetId}-${index}`} type="button" onClick={() => void downloadMediaAsset(attachment.mediaAssetId, attachment.fileName)}>
                      <span>{attachment.fileName}</span>
                    </button>
                  ))}
                </div>
              )}
            </article>
            );
          })}
          {projectNotes.length === 0 && <p className="text-muted">No team notes yet.</p>}
        </div>
      </div>
      )}
      </div>

      {showNoteForm && canAddNotes && (
        <div className="project-modal-overlay" role="dialog" aria-modal="true" aria-label="Add project note">
          <div className="glass-panel project-modal employee-note-modal">
            <div className="flex justify-between items-start gap-4 mb-5">
              <div>
                <h2 style={{ fontSize: "1.25rem" }}>New Project Note</h2>
                <p className="text-sm text-muted">This note will be visible to the full project team.</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setShowNoteForm(false)}>Close</button>
            </div>
            <label className="employee-field-label"><span>Category</span>
              <select value={noteCategory} onChange={event => setNoteCategory(event.target.value as NoteCategory)}>
                {NOTE_CATEGORIES.map(category => <option key={category} value={category}>{categoryLabel(category)}</option>)}
              </select>
            </label>
            <label className="employee-field-label"><span>Date</span><input type="date" value={noteDate} onChange={event => setNoteDate(event.target.value)} /></label>
            <label className="employee-field-label"><span>Note</span><textarea value={noteText} onChange={event => setNoteText(event.target.value)} rows={6} placeholder="Write a useful update, finding, or meeting note..." /></label>
            <input ref={noteFileInputRef} type="file" multiple style={{ display: "none" }} onChange={event => void handleNoteFiles(event)} />
            <div className="employee-note-upload">
              <div><strong>Attachments</strong><span>Images and documents, up to 10MB each</span></div>
              <button type="button" className="btn-secondary" disabled={uploadingNoteFiles} onClick={() => noteFileInputRef.current?.click()}>
                {uploadingNoteFiles ? "Uploading..." : "Choose files"}
              </button>
            </div>
            {noteAttachments.length > 0 && (
              <div className="employee-note-file-list">
                {noteAttachments.map((attachment, index) => (
                  <div key={`${attachment.mediaAssetId}-${index}`}>
                    <span>{attachment.fileName}</span>
                    <button type="button" onClick={() => setNoteAttachments(current => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                  </div>
                ))}
              </div>
            )}
            <div className="employee-modal-actions">
              <span className="employee-note-visibility">Project team</span>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => setShowNoteForm(false)}>Cancel</button>
                <button type="button" className="btn-primary" disabled={savingNote || uploadingNoteFiles || !noteText.trim()} onClick={() => void addTeamNote()}>
                  {savingNote ? "Adding..." : "Add Note"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingNote && viewingNoteDetails && (
        <div
          className="project-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="employee-note-view-title"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setViewingNote(null);
          }}
        >
          <div className="glass-panel project-modal note-detail-modal">
            <div className="note-detail-header">
              <div>
                <p className="text-xs text-muted">Project team note</p>
                <h2 id="employee-note-view-title">{categoryLabel(viewingNoteDetails.category)}</h2>
                <div className="text-xs text-muted">
                  {viewingNote.createdByName} · {viewingNoteDetails.date || new Date(viewingNote.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button type="button" aria-label="Close note" onClick={() => setViewingNote(null)}>×</button>
            </div>
            <div className="note-detail-body">
              <p>{viewingNoteDetails.text}</p>
            </div>
            {viewingNoteDetails.attachments.length > 0 && (
              <div className="note-detail-attachments">
                <div className="text-xs text-muted">Attachments</div>
                {viewingNoteDetails.attachments.map((attachment, index) => (
                  <button key={`${attachment.mediaAssetId}-${index}`} type="button" onClick={() => void downloadMediaAsset(attachment.mediaAssetId, attachment.fileName)}>
                    <span>{attachment.fileName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
