"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  getProject, Project, Task, getTasksByProject,
  updateProject, ProjectStatus, updateTaskStatus, TaskStatus,
  getProjectPayments, createProjectPayment, ProjectPayment,
  getProjectNotes, createProjectNote, updateProjectNote, deleteProjectNote,
  ProjectNote, ProjectNoteType, uploadToCloudinary,
  getTaskComments, createTaskComment, TaskComment,
  getProjectMilestones, createProjectMilestone, completeProjectMilestone, reopenProjectMilestone, deleteProjectMilestone, ProjectMilestone,
  getUsers, User,
} from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import ActionModal from "@/app/components/ActionModal";
import EmployeeProjectView from "./EmployeeProjectView";
import ProjectKanban from "@/app/components/ProjectKanban";

const TABS = [
  { id: "OVERVIEW" as const, label: "Overview" },
  { id: "TEAM" as const, label: "Team" },
  { id: "MILESTONES" as const, label: "Milestones" },
  { id: "TASKS" as const, label: "Tasks" },
  { id: "FINANCES" as const, label: "Finances" },
  { id: "NOTES" as const, label: "Notes" },
];

// ─── helpers ────────────────────────────────────────────────
function formatMoney(amount: number | null | undefined) {
  const n = Number(amount ?? 0);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function toDatetimeLocalValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function nowDatetimeLocal() { return toDatetimeLocalValue(new Date().toISOString()); }
const getStatusBadgeClass = (s: string) =>
  s === "PLANNED" ? "badge-todo" : s === "ACTIVE" ? "badge-in-progress" :
  s === "COMPLETED" ? "badge-done" : s === "ON_HOLD" ? "badge-blocked" : "";

// Note sub-categories shown in the UI
const NOTE_CATEGORIES = [
  { value: "INITIAL_MEETING",       label: "Initial Meeting",       icon: "🤝" },
  { value: "REQUIREMENT_GATHERING", label: "Requirement Gathering", icon: "📋" },
  { value: "CHANGES",               label: "Changes",               icon: "🔄" },
  { value: "FINDING",               label: "Finding / Issue",       icon: "🔍" },
  { value: "GENERAL",               label: "General Note",          icon: "📝" },
] as const;
type NoteCategory = typeof NOTE_CATEGORIES[number]["value"];

type NoteAttachment = {
  url: string;
  fileName: string;
  fileType: string;
  kind: "image" | "document";
};

type StoredAttachment = string | NoteAttachment;

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const FILE_INPUT_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,image/*,application/pdf";

function fileKind(mime: string): "image" | "document" {
  return mime.startsWith("image/") ? "image" : "document";
}

function normalizeAttachments(raw: StoredAttachment[]): NoteAttachment[] {
  return raw.map(item => {
    if (typeof item === "string") {
      const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(item) || item.includes("/image/upload/");
      return {
        url: item,
        fileName: decodeURIComponent(item.split("/").pop()?.split("?")[0] || "attachment"),
        fileType: isImage ? "image/jpeg" : "application/octet-stream",
        kind: isImage ? "image" : "document",
      };
    }
    return {
      url: item.url,
      fileName: item.fileName,
      fileType: item.fileType,
      kind: item.kind ?? fileKind(item.fileType),
    };
  });
}

function encodeNote(data: {
  category: NoteCategory;
  date: string;
  text: string;
  attachments: NoteAttachment[];
}): string {
  return JSON.stringify(data);
}

function decodeNote(content: string): {
  category: NoteCategory;
  date: string;
  text: string;
  attachments: NoteAttachment[];
} {
  try {
    const parsed = JSON.parse(content) as {
      category?: string;
      text?: string;
      date?: string;
      attachments?: StoredAttachment[];
    };
    if (parsed.category && parsed.text !== undefined) {
      return {
        category: parsed.category as NoteCategory,
        date: parsed.date ?? "",
        text: parsed.text,
        attachments: normalizeAttachments(parsed.attachments ?? []),
      };
    }
  } catch {}
  // Legacy fallback for old "[CATEGORY] text" format
  const match = content.match(/^\[([A-Z_]+)\] ([\s\S]*)$/);
  if (match) return { category: match[1] as NoteCategory, date: "", text: match[2], attachments: [] };
  return { category: "GENERAL", date: "", text: content, attachments: [] };
}

function categoryMeta(cat: NoteCategory) {
  return NOTE_CATEGORIES.find(c => c.value === cat) ?? NOTE_CATEGORIES[4];
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectIdStr } = use(params);
  const projectId = parseInt(projectIdStr);
  const router = useRouter();
  const { loading: authLoading, user } = useAuth(["ADMIN", "MANAGER", "EMPLOYEE"]);

  const [project, setProject]           = useState<Project | null>(null);
  const [loading, setLoading]           = useState(true);
  const [feedback, setFeedback]         = useState("");
  const [feedbackKind, setFeedbackKind] = useState<"success"|"error">("error");

  const [projectTasks,    setProjectTasks]    = useState<Task[]>([]);
  const [projectPayments, setProjectPayments] = useState<ProjectPayment[]>([]);
  const [projectNotes,    setProjectNotes]    = useState<ProjectNote[]>([]);
  const [taskComments,    setTaskComments]    = useState<TaskComment[]>([]);
  const [milestones,      setMilestones]      = useState<ProjectMilestone[]>([]);
  const [loadingTasks,    setLoadingTasks]    = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingNotes,    setLoadingNotes]    = useState(false);

  // project header edits
  const [isSaving,    setIsSaving]    = useState(false);
  const [editDocs,    setEditDocs]    = useState("");
  const [editBudget,  setEditBudget]  = useState("");
  const [editStatus,  setEditStatus]  = useState<ProjectStatus>("PLANNED");

  // team assignment edits
  const [managers, setManagers] = useState<User[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [editManagerId, setEditManagerId] = useState<number>(0);
  const [editAssignedEmployeeIds, setEditAssignedEmployeeIds] = useState<number[]>([]);
  const [selectedToAddIds, setSelectedToAddIds] = useState<number[]>([]);
  const [savingTeam, setSavingTeam] = useState(false);

  // payment form
  const [payAmount,      setPayAmount]      = useState("");
  const [payWhen,        setPayWhen]        = useState("");
  const [payNote,        setPayNote]        = useState("");
  const [savingPayment,  setSavingPayment]  = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDescription, setMilestoneDescription] = useState("");
  const [milestoneDueDate, setMilestoneDueDate] = useState("");
  const [savingMilestone, setSavingMilestone] = useState(false);

  // notes form state
  const [noteCategory,    setNoteCategory]    = useState<NoteCategory>("GENERAL");
  const [noteType,        setNoteType]        = useState<ProjectNoteType>("INTERNAL");
  const [noteText,        setNoteText]        = useState("");
  const [noteDate,        setNoteDate]        = useState<string>(new Date().toISOString().split("T")[0]);
  const [attachments,     setAttachments]     = useState<NoteAttachment[]>([]);
  const [uploadingFiles,  setUploadingFiles]  = useState(false);
  const [uploadingNote,   setUploadingNote]   = useState(false);
  const [showNoteModal,   setShowNoteModal]   = useState(false);
  const [editingNoteId,   setEditingNoteId]   = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // notes filter
  const [notesFilter, setNotesFilter] = useState<"ALL"|NoteCategory>("ALL");

  const [activeTab, setActiveTab] = useState<"OVERVIEW"|"TEAM"|"MILESTONES"|"TASKS"|"FINANCES"|"NOTES">("OVERVIEW");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentAttachment, setCommentAttachment] = useState<{ url: string; name: string } | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [uploadingCommentFile, setUploadingCommentFile] = useState(false);
  const [deleteNoteTargetId, setDeleteNoteTargetId] = useState<number | null>(null);
  const [deleteMilestoneTarget, setDeleteMilestoneTarget] = useState<ProjectMilestone | null>(null);
  const [deleteModalWorking, setDeleteModalWorking] = useState(false);
  const commentFileInputRef = useRef<HTMLInputElement>(null);

  // ── Escape key closes modal ────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowNoteModal(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ── load ──────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true); setFeedback("");
    try {
      const data = await getProject(projectId);
      setProject(data);
      setEditDocs(data.documentUrl || "");
      setEditBudget(data.budgetAmount ? String(data.budgetAmount) : "");
      setEditStatus(data.status);
      setEditManagerId(data.managerId);
      setEditAssignedEmployeeIds(data.assignedEmployees?.map(e => e.id) ?? []);
      setPayWhen(nowDatetimeLocal());
      setLoadingTasks(true); setLoadingPayments(true); setLoadingNotes(true);
      const [tasks, pays, notes, users, milestoneList] = await Promise.all([
        getTasksByProject(projectId),
        getProjectPayments(projectId),
        getProjectNotes(projectId),
        getUsers(),
        getProjectMilestones(projectId),
      ]);
      setProjectTasks(tasks); setProjectPayments(pays); setProjectNotes(notes);
      setMilestones(milestoneList);
      setManagers(users.filter(u => u.role === "ADMIN" || u.role === "MANAGER"));
      setEmployees(users.filter(u => u.role === "EMPLOYEE"));
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setLoading(false); setLoadingTasks(false); setLoadingPayments(false); setLoadingNotes(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!authLoading && user?.role !== "EMPLOYEE" && !Number.isNaN(projectId)) void loadData();
  }, [authLoading, loadData, projectId, user?.role]);

  if (authLoading) return <div className="p-8">Loading project details...</div>;
  if (user?.role === "EMPLOYEE") return <EmployeeProjectView projectId={projectId} />;

  if (loading) return <div className="p-8">Loading project details...</div>;
  if (!project) return (
    <div className="p-8 text-center">
      <h1 className="text-2xl mb-4">Project not found</h1>
      <button onClick={() => router.push("/projects")} className="btn-secondary">Back to Projects</button>
    </div>
  );

  // ── handlers ──────────────────────────────────────────────
  async function handleUpdateProject() {
    if (!project) return;
    const budgetNum = editBudget.trim() === "" ? undefined : parseFloat(editBudget);
    if (budgetNum !== undefined && (Number.isNaN(budgetNum) || budgetNum < 0)) {
      setFeedbackKind("error"); setFeedback("Budget must be a valid positive number."); return;
    }
    setIsSaving(true); setFeedback("");
    try {
      const updated = await updateProject(project.id, {
        name: project.name,
        description: project.description || "",
        status: editStatus,
        managerId: editManagerId,
        assignedEmployeeIds: editAssignedEmployeeIds,
        documentUrl: editDocs,
        budgetAmount: budgetNum,
      });
      setProject(updated);
      setEditManagerId(updated.managerId);
      setEditAssignedEmployeeIds(updated.assignedEmployees?.map(e => e.id) ?? []);
      setEditBudget(updated.budgetAmount ? String(updated.budgetAmount) : "");
      setFeedbackKind("success"); setFeedback("Project updated successfully.");
    } catch { setFeedbackKind("error"); setFeedback("Failed to update project."); }
    finally { setIsSaving(false); }
  }

  async function saveTeamAssignments() {
    if (!project) return;
    if (!editManagerId) {
      setFeedbackKind("error");
      setFeedback("Please select a project manager.");
      return;
    }
    setSavingTeam(true);
    setFeedback("");
    try {
      const budgetNum = editBudget.trim() === "" ? undefined : parseFloat(editBudget);
      const updated = await updateProject(project.id, {
        name: project.name,
        description: project.description || "",
        status: editStatus,
        managerId: editManagerId,
        assignedEmployeeIds: editAssignedEmployeeIds,
        documentUrl: editDocs,
        budgetAmount: budgetNum,
      });
      setProject(updated);
      setEditManagerId(updated.managerId);
      setEditAssignedEmployeeIds(updated.assignedEmployees?.map(e => e.id) ?? []);
      setFeedbackKind("success");
      setFeedback("Team assignments updated.");
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to update team.");
    } finally {
      setSavingTeam(false);
    }
  }

  function toggleEmployeeToAdd(id: number) {
    setSelectedToAddIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function addSelectedEmployees() {
    if (selectedToAddIds.length === 0) return;
    setEditAssignedEmployeeIds(prev => {
      const merged = new Set([...prev, ...selectedToAddIds]);
      return Array.from(merged);
    });
    setSelectedToAddIds([]);
  }

  function selectAllAvailable() {
    setSelectedToAddIds(availableEmployees.map(e => e.id));
  }

  function clearAddSelection() {
    setSelectedToAddIds([]);
  }

  function removeTeamMember(userId: number) {
    setEditAssignedEmployeeIds(prev => prev.filter(id => id !== userId));
  }

  const assignedMembers = editAssignedEmployeeIds.map(id => {
    const fromProject = project?.assignedEmployees?.find(e => e.id === id);
    if (fromProject) return { id, fullName: fromProject.fullName, role: "EMPLOYEE" as const };
    const fromUsers = employees.find(e => e.id === id);
    return { id, fullName: fromUsers?.fullName ?? `User #${id}`, role: "EMPLOYEE" as const };
  });

  const availableEmployees = employees.filter(e => !editAssignedEmployeeIds.includes(e.id));

  const editManagerName = managers.find(m => m.id === editManagerId)?.fullName ?? project.managerName;

  async function handleAddPayment() {
    if (!project) return;
    const amount = parseFloat(payAmount);
    if (Number.isNaN(amount) || amount < 0.01) {
      setFeedbackKind("error"); setFeedback("Payment amount must be at least $0.01."); return;
    }
    if (!payWhen) { setFeedbackKind("error"); setFeedback("Choose a payment date."); return; }
    setSavingPayment(true); setFeedback("");
    try {
      await createProjectPayment(project.id, {
        amount, paidAt: new Date(payWhen).toISOString(),
        referenceNote: payNote.trim() || undefined,
      });
      setPayAmount(""); setPayWhen(nowDatetimeLocal()); setPayNote("");
      const [updatedProject, pays] = await Promise.all([
        getProject(project.id), getProjectPayments(project.id),
      ]);
      setProject(updatedProject); setProjectPayments(pays);
      setFeedbackKind("success"); setFeedback("Payment recorded.");
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to record payment.");
    } finally { setSavingPayment(false); }
  }

  async function handleSaveNote() {
    if (!project) return;
    if (!noteText.trim()) {
      setFeedbackKind("error"); setFeedback("Notes/findings cannot be empty."); return;
    }
    setUploadingNote(true); setFeedback("");
    const payload = {
      content: encodeNote({ category: noteCategory, date: noteDate, text: noteText.trim(), attachments }),
      noteType,
    };
    const isEdit = editingNoteId !== null;
    try {
      if (editingNoteId) {
        await updateProjectNote(editingNoteId, payload);
      } else {
        await createProjectNote(project.id, payload);
      }
      resetNoteModal();
      const notes = await getProjectNotes(project.id);
      setProjectNotes(notes);
      setFeedbackKind("success");
      setFeedback(isEdit ? "Note updated." : "Note added.");
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to save note.");
    } finally { setUploadingNote(false); }
  }

  function openNoteForEdit(note: ProjectNote) {
    const decoded = decodeNote(note.content);
    setEditingNoteId(note.id);
    setNoteCategory(decoded.category);
    setNoteType(note.noteType);
    setNoteText(decoded.text);
    setNoteDate(decoded.date || new Date(note.createdAt).toISOString().split("T")[0]);
    setAttachments(decoded.attachments);
    setShowNoteModal(true);
  }

  async function confirmDeleteNote() {
    if (!deleteNoteTargetId) return;
    setDeleteModalWorking(true);
    try {
      await deleteProjectNote(deleteNoteTargetId);
      setProjectNotes(prev => prev.filter(n => n.id !== deleteNoteTargetId));
      setDeleteNoteTargetId(null);
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to delete note.");
    } finally {
      setDeleteModalWorking(false);
    }
  }

  async function handleTaskDrop(taskId: number, newStatus: TaskStatus) {
    try {
      await updateTaskStatus(taskId, newStatus);
      const [tasks, updatedProject] = await Promise.all([
        getTasksByProject(projectId), getProject(projectId),
      ]);
      setProjectTasks(tasks); setProject(updatedProject);
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to update task.");
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

  async function handleAddMilestone() {
    if (!project || !milestoneTitle.trim()) return;
    setSavingMilestone(true);
    try {
      await createProjectMilestone(project.id, {
        title: milestoneTitle.trim(),
        description: milestoneDescription.trim() || undefined,
        dueDate: milestoneDueDate || undefined,
      });
      setMilestoneTitle("");
      setMilestoneDescription("");
      setMilestoneDueDate("");
      setMilestones(await getProjectMilestones(project.id));
      setFeedbackKind("success");
      setFeedback("Milestone added.");
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to add milestone.");
    } finally {
      setSavingMilestone(false);
    }
  }

  async function toggleMilestone(milestone: ProjectMilestone) {
    if (!project) return;
    try {
      if (milestone.completed) {
        await reopenProjectMilestone(milestone.id);
      } else {
        await completeProjectMilestone(milestone.id);
      }
      setMilestones(await getProjectMilestones(project.id));
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to update milestone.");
    }
  }

  async function confirmRemoveMilestone() {
    if (!project || !deleteMilestoneTarget) return;
    setDeleteModalWorking(true);
    try {
      await deleteProjectMilestone(deleteMilestoneTarget.id);
      setMilestones(await getProjectMilestones(project.id));
      setDeleteMilestoneTarget(null);
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to delete milestone.");
    } finally {
      setDeleteModalWorking(false);
    }
  }

  function resetNoteModal() {
    setNoteText(""); setNoteDate(new Date().toISOString().split("T")[0]);
    setNoteCategory("GENERAL"); setNoteType("INTERNAL");
    setAttachments([]);
    setEditingNoteId(null);
    setShowNoteModal(false);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      setFeedbackKind("error");
      setFeedback(`Maximum ${MAX_ATTACHMENTS} attachments per note.`);
      return;
    }

    setUploadingFiles(true); setFeedback("");
    try {
      for (const file of files) {
        if (!ACCEPTED_MIME_TYPES.has(file.type)) {
          throw new Error(`"${file.name}" is not supported. Use images (JPG, PNG, GIF, WebP) or documents (PDF, DOC, DOCX).`);
        }
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`"${file.name}" exceeds the 10MB limit.`);
        }
      }

      const uploaded: NoteAttachment[] = [];
      for (const file of files) {
        const url = await uploadToCloudinary(file);
        uploaded.push({
          url,
          fileName: file.name,
          fileType: file.type,
          kind: fileKind(file.type),
        });
      }
      setAttachments(prev => [...prev, ...uploaded]);
      setFeedbackKind("success");
      setFeedback(`${uploaded.length} file${uploaded.length !== 1 ? "s" : ""} uploaded.`);
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "File upload failed.");
    } finally {
      setUploadingFiles(false);
    }
  }

  const feedbackStyles = feedbackKind === "success"
    ? { background: "rgba(34,197,94,0.12)", color: "var(--success-color,#22c55e)" }
    : { background: "rgba(239,68,68,0.1)", color: "var(--danger-color)" };

  // filtered notes for the notes tab
  const visibleNotes = notesFilter === "ALL"
    ? projectNotes
    : projectNotes.filter(n => decodeNote(n.content).category === notesFilter);

  const activeTaskCount = projectTasks.filter(t => t.status !== "DONE").length;

  // ── render ────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto">
      <nav className="project-breadcrumb">
        <button type="button" onClick={() => router.push("/projects")}>Projects</button>
        <span>/</span>
        <span style={{ color: "var(--text-primary)" }}>{project.name}</span>
      </nav>

      {feedback && (
        <div className="project-feedback" style={feedbackStyles}>{feedback}</div>
      )}

      {/* Hero */}
      <div className="glass-panel project-hero">
        <div className="project-hero-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <h1 style={{ fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.25 }}>{project.name}</h1>
              <span className={`badge ${getStatusBadgeClass(editStatus)}`}>{editStatus.replace("_", " ")}</span>
            </div>
            <div className="flex gap-4 flex-wrap text-sm text-muted">
              <span>Manager: <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>{editManagerName}</strong></span>
              {project.dueDate && (
                <span>Due: <strong style={{ color: "var(--warning-color)", fontWeight: 500 }}>{new Date(project.dueDate).toLocaleDateString()}</strong></span>
              )}
              <span>ID #{project.id}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={editStatus}
              onChange={e => setEditStatus(e.target.value as ProjectStatus)}
              style={{ minWidth: "140px", fontSize: "0.875rem" }}
              aria-label="Project status"
            >
              <option value="PLANNED">Planned</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <button onClick={() => void handleUpdateProject()} disabled={isSaving} className="btn-primary">
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div className="project-stat-strip">
          {[
            { label: "Progress", value: `${project.progressPercentage || 0}%`, color: "var(--primary-color)" },
            { label: "Active Tasks", value: String(activeTaskCount), color: "#c4b5fd" },
            { label: "Team", value: String(editAssignedEmployeeIds.length), color: "var(--success-color)" },
            { label: "Notes", value: String(projectNotes.length), color: "var(--text-primary)" },
            ...(project.budgetAmount ? [{ label: "Budget", value: formatMoney(project.budgetAmount), color: "var(--warning-color)" }] : []),
          ].map(stat => (
            <div key={stat.label} className="project-stat-chip">
              <div className="label">{stat.label}</div>
              <div className="value" style={{ color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="project-tabs" style={{ marginBottom: "20px" }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`project-tab${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ paddingBottom: "48px" }}>
      {activeTab === "OVERVIEW" && (
        <div className="project-overview-grid" style={{ display: "grid", gridTemplateColumns: "1fr minmax(260px, 320px)", gap: "20px" }}>
          <div className="project-card-static">
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "12px" }}>About</h3>
            <p style={{ lineHeight: 1.75, color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              {project.description || "No description provided."}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginTop: "28px", paddingTop: "24px", borderTop: "1px solid var(--border-color)" }}>
              {[
                { label: "Start", value: project.startDate ? new Date(project.startDate).toLocaleDateString() : "—" },
                { label: "Due", value: project.dueDate ? new Date(project.dueDate).toLocaleDateString() : "—", accent: true },
                { label: "Updated", value: project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : "—" },
              ].map(item => (
                <div key={item.label}>
                  <div className="text-xs text-muted mb-1">{item.label}</div>
                  <div style={{ fontWeight: 500, fontSize: "0.9rem", color: item.accent ? "var(--warning-color)" : "var(--text-primary)" }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="project-card-static">
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "16px" }}>Progress</h3>
            <div style={{ fontSize: "2.5rem", fontWeight: 700, marginBottom: "12px", color: "var(--primary-color)" }}>
              {project.progressPercentage || 0}%
            </div>
            <div style={{ height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "99px", overflow: "hidden", marginBottom: "20px" }}>
              <div style={{ width: `${project.progressPercentage || 0}%`, height: "100%", background: "linear-gradient(90deg, var(--primary-color), var(--accent-color))", borderRadius: "99px" }} />
            </div>
            {project.budgetAmount ? (
              <div style={{ paddingTop: "16px", borderTop: "1px solid var(--border-color)" }}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted">Budget used</span>
                  <span>{Math.round(((project.totalPaid ?? 0) / (project.budgetAmount ?? 1)) * 100)}%</span>
                </div>
                <div className="text-sm text-muted">{formatMoney(project.totalPaid)} of {formatMoney(project.budgetAmount)}</div>
              </div>
            ) : null}
            <div style={{ paddingTop: "16px", marginTop: "16px", borderTop: "1px solid var(--border-color)" }}>
              <div className="text-xs text-muted mb-1">Project Manager</div>
              <div style={{ fontWeight: 500, fontSize: "0.9rem" }}>{editManagerName}</div>
              <div className="text-xs text-muted mt-3 mb-1">Team Size</div>
              <div style={{ fontWeight: 500, fontSize: "0.9rem" }}>{editAssignedEmployeeIds.length} employee{editAssignedEmployeeIds.length !== 1 ? "s" : ""}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "TEAM" && (
        <div className="project-section">
          <div className="project-section-header">
            <div>
              <h2>Team</h2>
              <p className="text-sm text-muted">Assign the project manager and employees working on this project.</p>
            </div>
            <button type="button" className="btn-primary" disabled={savingTeam} onClick={() => void saveTeamAssignments()}>
              {savingTeam ? "Saving…" : "Save Team"}
            </button>
          </div>

          <div className="project-card-static">
            <div style={{ marginBottom: "28px" }}>
              <label className="text-xs text-muted block mb-2" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Project Manager</label>
              <select value={editManagerId || ""} onChange={e => setEditManagerId(Number(e.target.value))} style={{ width: "100%", maxWidth: "400px" }}>
                <option value="" disabled>Select manager</option>
                {managers.map(m => (
                  <option key={m.id} value={m.id}>{m.fullName} · {m.role}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "28px", paddingBottom: "28px", borderBottom: "1px solid var(--border-color)" }}>
              <div className="flex justify-between items-center flex-wrap gap-3 mb-3">
                <label className="text-xs text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Add Employees
                </label>
                {availableEmployees.length > 0 && (
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={selectAllAvailable}>
                      Select all
                    </button>
                    {selectedToAddIds.length > 0 && (
                      <button type="button" className="btn-secondary" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={clearAddSelection}>
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>

              {availableEmployees.length === 0 ? (
                <p className="text-sm text-muted">All employees are already on this project.</p>
              ) : (
                <>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: "8px",
                    padding: "12px",
                    background: "rgba(15,23,42,0.4)",
                    borderRadius: "10px",
                    border: "1px solid var(--border-color)",
                    maxHeight: "240px",
                    overflowY: "auto",
                  }}>
                    {availableEmployees.map(emp => (
                      <label
                        key={emp.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          cursor: "pointer",
                          background: selectedToAddIds.includes(emp.id) ? "rgba(59,130,246,0.15)" : "transparent",
                          border: selectedToAddIds.includes(emp.id) ? "1px solid rgba(59,130,246,0.35)" : "1px solid transparent",
                          fontSize: "0.875rem",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedToAddIds.includes(emp.id)}
                          onChange={() => toggleEmployeeToAdd(emp.id)}
                          style={{ accentColor: "var(--primary-color)" }}
                        />
                        {emp.fullName}
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-3 flex-wrap gap-3">
                    <span className="text-sm text-muted">
                      {selectedToAddIds.length > 0
                        ? `${selectedToAddIds.length} employee${selectedToAddIds.length !== 1 ? "s" : ""} selected`
                        : "Select one or more employees to add"}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={selectedToAddIds.length === 0}
                      onClick={addSelectedEmployees}
                    >
                      Add {selectedToAddIds.length > 0 ? selectedToAddIds.length : ""} to team
                    </button>
                  </div>
                </>
              )}
            </div>

            <label className="text-xs text-muted block mb-3" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Assigned Employees ({assignedMembers.length})
            </label>
            {assignedMembers.length === 0 ? (
              <div className="project-empty-state" style={{ padding: "32px" }}>
                <p>No employees assigned yet.</p>
              </div>
            ) : (
              <div className="project-team-grid">
                {assignedMembers.map(member => (
                  <div key={member.id} className="project-team-member">
                    <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--accent-color)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, flexShrink: 0 }}>
                        {member.fullName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <span style={{ fontWeight: 500, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.fullName}</span>
                    </div>
                    <button type="button" className="btn-secondary" onClick={() => removeTeamMember(member.id)} style={{ padding: "6px 10px", fontSize: "0.75rem", color: "var(--danger-color)", flexShrink: 0 }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "MILESTONES" && (
        <div className="project-section">
          <div className="project-section-header">
            <div>
              <h2>Milestones</h2>
              <p className="text-sm text-muted">Track major project phases and delivery checkpoints.</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 380px) minmax(0, 1fr)", gap: "20px" }}>
            <div className="project-card-static">
              <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "14px" }}>Add Milestone</h3>
              <div style={{ display: "grid", gap: "12px" }}>
                <input
                  value={milestoneTitle}
                  onChange={e => setMilestoneTitle(e.target.value)}
                  placeholder="Milestone title"
                />
                <textarea
                  value={milestoneDescription}
                  onChange={e => setMilestoneDescription(e.target.value)}
                  rows={3}
                  placeholder="Description"
                />
                <input
                  type="date"
                  value={milestoneDueDate}
                  onChange={e => setMilestoneDueDate(e.target.value)}
                />
                <button type="button" className="btn-primary" disabled={savingMilestone || !milestoneTitle.trim()} onClick={() => void handleAddMilestone()}>
                  {savingMilestone ? "Adding..." : "Add Milestone"}
                </button>
              </div>
            </div>

            <div className="project-card-static">
              <div style={{ display: "grid", gap: "12px" }}>
                {milestones.map(milestone => (
                  <div key={milestone.id} style={{ padding: "16px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "rgba(15,23,42,0.35)" }}>
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <h3 style={{ fontSize: "1rem", fontWeight: 600, textDecoration: milestone.completed ? "line-through" : "none" }}>{milestone.title}</h3>
                        {milestone.description && <p className="text-sm text-muted mt-2" style={{ lineHeight: 1.5 }}>{milestone.description}</p>}
                        <div className="text-xs text-muted mt-3">
                          {milestone.dueDate ? `Due ${new Date(milestone.dueDate).toLocaleDateString()}` : "No due date"}
                        </div>
                      </div>
                      <span className={`badge ${milestone.completed ? "badge-done" : "badge-in-progress"}`}>
                        {milestone.completed ? "DONE" : "OPEN"}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button type="button" className="btn-secondary" style={{ padding: "7px 12px", fontSize: "0.8rem" }} onClick={() => void toggleMilestone(milestone)}>
                        {milestone.completed ? "Reopen" : "Mark Done"}
                      </button>
                      <button type="button" className="btn-secondary" style={{ padding: "7px 12px", fontSize: "0.8rem", color: "var(--danger-color)" }} onClick={() => setDeleteMilestoneTarget(milestone)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {milestones.length === 0 && <p className="text-muted">No milestones yet.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "TASKS" && (
        <div className="project-section">
          <div className="project-section-header">
            <div>
              <h2>Task Board</h2>
              <p className="text-sm text-muted">
                {user?.role === "ADMIN" ? "Audit task progress and add tasks for the team." : "Drag cards between columns to update status."}
              </p>
            </div>
            <button onClick={() => router.push(`/tasks/new?projectId=${projectId}`)} className="btn-primary" style={{ fontSize: "0.875rem" }}>
              + New Task
            </button>
          </div>
          <ProjectKanban
            tasks={projectTasks}
            loading={loadingTasks}
            readOnly={user?.role === "ADMIN"}
            onTaskDrop={(taskId, status) => void handleTaskDrop(taskId, status)}
            onTaskSelect={task => void handleTaskSelect(task)}
            selectedTaskId={selectedTask?.id ?? null}
          />

          <div className="project-card-static" style={{ marginTop: "20px" }}>
            <div className="flex justify-between items-start gap-4 mb-4">
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 600 }}>Task Discussion</h3>
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
        </div>
      )}

      {activeTab === "FINANCES" && (
        <div className="project-section">
          <div className="project-section-header">
            <div>
              <h2>Finances</h2>
              <p className="text-sm text-muted">Track budget and payment history.</p>
            </div>
          </div>

          <div className="project-stat-strip" style={{ marginBottom: "24px" }}>
            {[
              { label: "Budget", value: formatMoney(project.budgetAmount), color: "var(--text-primary)" },
              { label: "Paid", value: formatMoney(project.totalPaid), color: "var(--success-color)" },
              { label: "Remaining", value: formatMoney((project.budgetAmount ?? 0) - (project.totalPaid ?? 0)), color: "var(--warning-color)" },
              { label: "Payments", value: String(projectPayments.length), color: "var(--primary-color)" },
            ].map(card => (
              <div key={card.label} className="project-stat-chip">
                <div className="label">{card.label}</div>
                <div className="value" style={{ color: card.color, fontSize: "1.1rem" }}>{card.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "24px" }}>
            <div className="project-card-static">
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "16px" }}>Set Budget</h3>
              <label className="text-xs text-muted block mb-2">Total (USD)</label>
              <div className="flex items-center gap-2">
                <span className="text-muted">$</span>
                <input type="number" min={0} step="0.01" placeholder="Optional" value={editBudget} onChange={e => setEditBudget(e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>
            <div className="project-card-static">
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "16px" }}>Record Payment</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div className="flex gap-2">
                  <input type="number" min={0.01} step="0.01" placeholder="Amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} style={{ flex: 1 }} />
                  <input type="datetime-local" value={payWhen} onChange={e => setPayWhen(e.target.value)} style={{ flex: 1.2 }} />
                </div>
                <input placeholder="Reference note (optional)" value={payNote} onChange={e => setPayNote(e.target.value)} />
                <button type="button" className="btn-primary" disabled={savingPayment} onClick={() => void handleAddPayment()}>
                  {savingPayment ? "Processing…" : "Add Payment"}
                </button>
              </div>
            </div>
          </div>

          <div className="project-card-static">
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "16px" }}>Payment History</h3>
            {loadingPayments ? (
              <p className="text-muted text-sm">Loading…</p>
            ) : projectPayments.length === 0 ? (
              <div className="project-empty-state" style={{ padding: "40px" }}>
                <p>No payments recorded yet.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                      {["Date", "Amount", "Reference", "By"].map(h => (
                        <th key={h} style={{ textAlign: h === "Amount" ? "right" : "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 500, fontSize: "0.75rem" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projectPayments.map(p => (
                      <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "12px" }}>{new Date(p.paidAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: 600, color: "var(--success-color)" }}>{formatMoney(p.amount)}</td>
                        <td style={{ padding: "12px", color: "var(--text-secondary)", maxWidth: "240px" }}>{p.referenceNote || "—"}</td>
                        <td style={{ padding: "12px" }}>{p.recordedByName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "NOTES" && (
        <div className="project-section">
          <div className="project-section-header">
            <div>
              <h2>Notes</h2>
              <p className="text-sm text-muted">{projectNotes.length} note{projectNotes.length !== 1 ? "s" : ""} · attach files when adding notes</p>
            </div>
            <button onClick={() => setShowNoteModal(true)} className="btn-primary" style={{ fontSize: "0.875rem" }}>
              + Add Note
            </button>
          </div>

          <div className="project-toolbar">
            <span className="text-sm text-muted">Filter:</span>
            <button type="button" className={`project-tab${notesFilter === "ALL" ? " active" : ""}`} style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => setNotesFilter("ALL")}>
              All ({projectNotes.length})
            </button>
            {NOTE_CATEGORIES.map(cat => {
              const count = projectNotes.filter(n => decodeNote(n.content).category === cat.value).length;
              if (count === 0) return null;
              return (
                <button key={cat.value} type="button" className={`project-tab${notesFilter === cat.value ? " active" : ""}`} style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => setNotesFilter(cat.value)}>
                  {cat.icon} {cat.label} ({count})
                </button>
              );
            })}
          </div>

          {loadingNotes ? (
            <div className="project-empty-state">Loading notes…</div>
          ) : visibleNotes.length === 0 ? (
            <div className="project-empty-state">
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📋</div>
              <p>No notes yet. Click &quot;Add Note&quot; to get started.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
              {visibleNotes.map(note => {
                const decoded = decodeNote(note.content);
                const meta = categoryMeta(decoded.category);
                return (
                  <div key={note.id} className="project-card-static" style={{ padding: "20px" }}>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: "1.1rem" }}>{meta.icon}</span>
                        <div>
                          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)" }}>{meta.label}</div>
                          <div className="text-xs text-muted">
                            {note.createdByName}
                            {decoded.date ? ` · ${decoded.date}` : ` · ${new Date(note.createdAt).toLocaleDateString()}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{
                          fontSize: "0.68rem", padding: "2px 8px", borderRadius: "10px", fontWeight: 600,
                          background: note.noteType === "CLIENT" ? "rgba(16,185,129,0.15)" : "rgba(139,92,246,0.15)",
                          color: note.noteType === "CLIENT" ? "#6ee7b7" : "#c4b5fd",
                        }}>
                          {note.noteType === "CLIENT" ? "CLIENT" : "INTERNAL"}
                        </span>
                        <button onClick={() => openNoteForEdit(note)}
                          style={{ padding: "4px", background: "transparent", color: "var(--text-secondary)",
                            borderRadius: "4px", transition: "color 0.15s ease" }}
                          title="Edit note">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button onClick={() => setDeleteNoteTargetId(note.id)}
                          style={{ padding: "4px", background: "transparent", color: "var(--text-secondary)",
                            borderRadius: "4px", transition: "color 0.15s ease" }}
                          title="Delete note">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Body text */}
                    <p style={{ whiteSpace: "pre-wrap", fontSize: "0.92rem", lineHeight: 1.6, color: "var(--text-primary)" }}>
                      {decoded.text}
                    </p>

                    {/* Attachments */}
                    {decoded.attachments.length > 0 && (
                      <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="text-xs text-muted mb-2">Attachments</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {decoded.attachments.map((att, i) =>
                            att.kind === "image" ? (
                              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                                style={{ display: "block", borderRadius: "8px", overflow: "hidden",
                                  border: "1px solid rgba(255,255,255,0.08)" }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={att.url} alt={att.fileName}
                                  style={{ width: "100%", maxHeight: "160px", objectFit: "cover", display: "block" }} />
                                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", padding: "6px 8px" }}>
                                  {att.fileName}
                                </div>
                              </a>
                            ) : (
                              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" download={att.fileName}
                                style={{ fontSize: "0.82rem", color: "var(--primary-color)", display: "flex",
                                  alignItems: "center", gap: "8px", padding: "8px 10px",
                                  background: "rgba(255,255,255,0.04)", borderRadius: "8px",
                                  border: "1px solid rgba(255,255,255,0.08)" }}>
                                <span>📄</span>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {att.fileName}
                                </span>
                              </a>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      </div>

      {showNoteModal && (
        <div className="project-modal-overlay">
          <div className="glass-panel project-modal">
            <button type="button" onClick={resetNoteModal}
              style={{ position: "absolute", top: "16px", right: "16px", background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--border-color)", borderRadius: "8px", width: "32px", height: "32px",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-secondary)", fontSize: "1rem", cursor: "pointer" }}
              title="Close (Esc)">
              ✕
            </button>

            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "20px" }}>
              {editingNoteId ? "Edit Note" : "New Note"}
            </h3>

            <div style={{ marginBottom: "16px" }}>
              <label className="text-xs text-muted block mb-2" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Category</label>
              <div className="project-toolbar" style={{ marginBottom: 0, padding: "8px" }}>
                {NOTE_CATEGORIES.map(cat => (
                  <button key={cat.value} type="button" className={`project-tab${noteCategory === cat.value ? " active" : ""}`}
                    style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                    onClick={() => setNoteCategory(cat.value)}>
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* b) Visibility */}
            <div style={{ marginBottom: "20px" }}>
              <label className="text-xs text-muted block mb-3" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Visibility</label>
              <div className="flex gap-6">
                {(["INTERNAL","CLIENT"] as const).map(t => (
                  <label key={t} className="flex items-center gap-2 text-sm" style={{ cursor: "pointer" }}>
                    <input type="radio" name="modalNoteVisibility" value={t}
                      checked={noteType === t} onChange={() => setNoteType(t)}
                      style={{ accentColor: "var(--primary-color)" }} />
                    {t === "INTERNAL" ? "🔒 Internal (team only)" : "👤 Client-facing"}
                  </label>
                ))}
              </div>
            </div>

            {/* c) Date */}
            <div style={{ marginBottom: "20px" }}>
              <label className="text-xs text-muted block mb-2" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Date</label>
              <input type="date" value={noteDate} onChange={e => setNoteDate(e.target.value)}
                style={{ width: "100%" }} />
            </div>

            {/* d) Notes / Findings textarea */}
            <div style={{ marginBottom: "20px" }}>
              <label className="text-xs text-muted block mb-2" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes / Findings</label>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                placeholder="Write your notes, findings, or meeting summary here…"
                style={{ width: "100%", minHeight: "120px", resize: "vertical" }} />
            </div>

            {/* e) Attachments */}
            <div style={{ marginBottom: "24px" }}>
              <label className="text-xs text-muted block mb-2" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Attachments</label>
              <p className="text-xs text-muted mb-3">
                Upload images (JPG, PNG, GIF, WebP) or documents (PDF, DOC, DOCX). Max 10MB each, up to {MAX_ATTACHMENTS} files.
              </p>
              <input ref={fileInputRef} type="file" multiple accept={FILE_INPUT_ACCEPT}
                onChange={e => void handleFileSelect(e)} style={{ display: "none" }} />
              <button type="button" className="btn-secondary" disabled={uploadingFiles || attachments.length >= MAX_ATTACHMENTS}
                onClick={() => fileInputRef.current?.click()}
                style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                {uploadingFiles ? (
                  <>⏳ Uploading…</>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Choose Files
                  </>
                )}
              </button>
              {attachments.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {attachments.map((att, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px",
                      background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "8px 12px",
                      border: "1px solid var(--border-color)" }}>
                      {att.kind === "image" ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={att.url} alt={att.fileName}
                          style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "6px", flexShrink: 0 }} />
                      ) : (
                        <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>📄</span>
                      )}
                      <span style={{ flex: 1, fontSize: "0.82rem", color: "var(--text-secondary)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {att.fileName}
                      </span>
                      <button type="button" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: "transparent", color: "var(--danger-color)", fontSize: "0.85rem",
                          padding: "2px 6px", borderRadius: "4px", border: "none", cursor: "pointer", flexShrink: 0 }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* f) Action buttons */}
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={resetNoteModal}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={uploadingNote || uploadingFiles || !noteText.trim()}
                onClick={() => void handleSaveNote()}>
                {uploadingNote ? "Saving…" : editingNoteId ? "Update Note" : "Save Note"}
              </button>
            </div>
          </div>
        </div>
      )}
      <ActionModal
        open={deleteNoteTargetId !== null}
        title="Delete Note"
        description="This will permanently delete the selected project note and its saved attachment references."
        confirmLabel="Delete Note"
        tone="danger"
        loading={deleteModalWorking}
        onCancel={() => setDeleteNoteTargetId(null)}
        onConfirm={() => void confirmDeleteNote()}
      />
      <ActionModal
        open={deleteMilestoneTarget !== null}
        title="Delete Milestone"
        description={`This will permanently delete "${deleteMilestoneTarget?.title ?? "this milestone"}" from the project timeline.`}
        confirmLabel="Delete Milestone"
        tone="danger"
        loading={deleteModalWorking}
        onCancel={() => setDeleteMilestoneTarget(null)}
        onConfirm={() => void confirmRemoveMilestone()}
      />
    </div>
  );
}
