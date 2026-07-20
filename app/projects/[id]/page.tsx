"use client";

import { useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  getProject, Project, Task, getTasksByProject,
  updateProject, ProjectStatus, updateTaskStatus, TaskStatus,
  getProjectPayments, createProjectPayment, ProjectPayment,
  PaymentAttachment, updateProjectPaymentAttachments,
  getProjectNotes, createProjectNote, updateProjectNote, deleteProjectNote,
  ProjectNote, ProjectNoteType, uploadFile, downloadMediaAsset,
  getTaskComments, createTaskComment, TaskComment,
  getProjectMilestones, createProjectMilestone, completeProjectMilestone, reopenProjectMilestone, deleteProjectMilestone, ProjectMilestone,
  getUsers, User, ProjectMemberPermission,
  getProjectTaskBoards, createProjectTaskBoard, reorderProjectTaskBoards, ProjectTaskBoard,
} from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import ActionModal from "@/app/components/ActionModal";
import EmployeeProjectView from "./EmployeeProjectView";
import ProjectKanban from "@/app/components/ProjectKanban";
import MentionTextarea, { MentionCandidate, mentionedUserIdsFromText } from "@/app/components/MentionTextarea";

const TABS = [
  { id: "OVERVIEW" as const, label: "Overview" },
  { id: "TEAM" as const, label: "Team" },
  { id: "MILESTONES" as const, label: "Milestones" },
  { id: "TASKS" as const, label: "Tasks" },
  { id: "FINANCES" as const, label: "Finances" },
  { id: "ADDITIONAL_DETAILS" as const, label: "Additional Details" },
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
function domainHref(domain: string) {
  const trimmed = domain.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
const getStatusBadgeClass = (s: string) =>
  s === "PLANNED" ? "badge-todo" : s === "ACTIVE" ? "badge-in-progress" :
  s === "COMPLETED" ? "badge-done" : s === "ON_HOLD" ? "badge-blocked" : "";

// Note sub-categories shown in the UI
const NOTE_CATEGORIES = [
  { value: "INITIAL_MEETING",       label: "Initial Meeting",       icon: "🤝" },
  { value: "REQUIREMENT_GATHERING", label: "Requirement Gathering", icon: "📋" },
  { value: "CHANGES",               label: "Changes",               icon: "🔄" },
  { value: "FINDING",               label: "Finding / Issue",       icon: "🔍" },
  { value: "DOMAIN_DETAILS",        label: "Domain Details",        icon: "🌐" },
  { value: "MAINTENANCE_DETAILS",   label: "Maintenance Details",   icon: "🧾" },
  { value: "SERVER_DETAILS",        label: "Server Details",        icon: "🖥️" },
  { value: "GENERAL",               label: "General Note",          icon: "📝" },
] as const;
type NoteCategory = typeof NOTE_CATEGORIES[number]["value"];
type AdditionalDetailKey = "DOMAIN_DETAILS" | "MAINTENANCE_DETAILS" | "SERVER_DETAILS";

const ADDITIONAL_DETAIL_SECTIONS = [
  {
    key: "DOMAIN_DETAILS" as const,
    title: "Domain",
    titleLabel: "Domain title / name",
    dateLabel: "Purchase or start date",
    placeholder: "example.com",
    description: "Domain name, purchase date, payments, renewals, DNS notes, and issues.",
  },
  {
    key: "MAINTENANCE_DETAILS" as const,
    title: "AMC",
    titleLabel: "AMC title / name",
    dateLabel: "Start date",
    placeholder: "Website maintenance 2026",
    description: "Maintenance name, start date, cost, payment notes, bugs, and follow-ups.",
  },
  {
    key: "SERVER_DETAILS" as const,
    title: "Server",
    titleLabel: "Server title / name",
    dateLabel: "Purchase or start date",
    placeholder: "DigitalOcean droplet / AWS EC2",
    description: "Server name, start date, hosting payments, bugs, plan changes, and access notes.",
  },
] as const;

type NoteAttachment = {
  mediaAssetId: string;
  fileName: string;
  fileType: string;
  kind: "image" | "document";
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg", "image/png",
  "application/pdf",
]);
const FILE_INPUT_ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";
const PAYMENT_BILL_ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";
const MAX_PAYMENT_BILLS = 5;
const PAYMENT_BILL_MIME_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

function fileKind(mime: string): "image" | "document" {
  return mime.startsWith("image/") ? "image" : "document";
}

function normalizeAttachments(raw: NoteAttachment[]): NoteAttachment[] {
  return raw.filter(item => Boolean(item.mediaAssetId)).map(item => ({
    mediaAssetId: item.mediaAssetId,
    fileName: item.fileName,
    fileType: item.fileType,
    kind: item.kind ?? fileKind(item.fileType),
  }));
}

function encodeNote(data: {
  category: NoteCategory;
  date: string;
  text: string;
  attachments: NoteAttachment[];
  detailTitle?: string;
  detailCost?: string;
  isDetailProfile?: boolean;
}): string {
  return JSON.stringify(data);
}

function decodeNote(content: string): {
  category: NoteCategory;
  date: string;
  text: string;
  attachments: NoteAttachment[];
  detailTitle?: string;
  detailCost?: string;
  isDetailProfile?: boolean;
} {
  try {
    const parsed = JSON.parse(content) as {
      category?: string;
      text?: string;
      date?: string;
      attachments?: NoteAttachment[];
      detailTitle?: string;
      detailCost?: string;
      isDetailProfile?: boolean;
    };
    if (parsed.category && parsed.text !== undefined) {
      return {
        category: parsed.category as NoteCategory,
        date: parsed.date ?? "",
        text: parsed.text,
        attachments: normalizeAttachments(parsed.attachments ?? []),
        detailTitle: parsed.detailTitle,
        detailCost: parsed.detailCost,
        isDetailProfile: parsed.isDetailProfile ?? false,
      };
    }
  } catch {}
  // Legacy fallback for old "[CATEGORY] text" format
  const match = content.match(/^\[([A-Z_]+)\] ([\s\S]*)$/);
  if (match) return { category: match[1] as NoteCategory, date: "", text: match[2], attachments: [] };
  return { category: "GENERAL", date: "", text: content, attachments: [] };
}

function decodeProjectNote(note: ProjectNote) {
  const decoded = decodeNote(note.content);
  decoded.attachments = (note.attachments ?? []).map(attachment => ({
    mediaAssetId: attachment.mediaAssetId,
    fileName: attachment.fileName,
    fileType: attachment.contentType,
    kind: fileKind(attachment.contentType),
  }));
  return decoded;
}

function categoryMeta(cat: NoteCategory) {
  return NOTE_CATEGORIES.find(c => c.value === cat) ?? NOTE_CATEGORIES.find(c => c.value === "GENERAL")!;
}

function isDetailProfileNote(note: ProjectNote) {
  return decodeProjectNote(note).isDetailProfile === true;
}

function detailProfileFromNotes(notes: ProjectNote[], category: AdditionalDetailKey) {
  const note = notes.find(item => {
    const decoded = decodeNote(item.content);
    return decoded.category === category && decoded.isDetailProfile;
  });
  if (!note) return null;
  const decoded = decodeProjectNote(note);
  return {
    noteId: note.id,
    title: decoded.detailTitle ?? "",
    date: decoded.date ?? "",
    cost: decoded.detailCost ?? "",
  };
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectIdStr } = use(params);
  const projectId = parseInt(projectIdStr);
  const router = useRouter();
  const toast = useToast();
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
  const [taskBoards,      setTaskBoards]      = useState<ProjectTaskBoard[]>([]);
  const [loadingTasks,    setLoadingTasks]    = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingNotes,    setLoadingNotes]    = useState(false);

  // project header edits
  const [isSaving,    setIsSaving]    = useState(false);
  const [editBudget,  setEditBudget]  = useState("");
  const [editStatus,  setEditStatus]  = useState<ProjectStatus>("PLANNED");
  const [editServerDetails, setEditServerDetails] = useState("");
  const [editDomainName, setEditDomainName] = useState("");
  const [editAnnualMaintenanceCost, setEditAnnualMaintenanceCost] = useState("");
  const [editDomainStartDate, setEditDomainStartDate] = useState("");
  const [editServerStartDate, setEditServerStartDate] = useState("");
  const [editMaintenanceTitle, setEditMaintenanceTitle] = useState("");
  const [editMaintenanceStartDate, setEditMaintenanceStartDate] = useState("");
  const [savingDetailKey, setSavingDetailKey] = useState<AdditionalDetailKey | null>(null);

  // team assignment edits
  const [managers, setManagers] = useState<User[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [editManagerId, setEditManagerId] = useState<number>(0);
  const [editAssignedEmployeeIds, setEditAssignedEmployeeIds] = useState<number[]>([]);
  const [memberPermissions, setMemberPermissions] = useState<Record<number, Omit<ProjectMemberPermission, "userId">>>({});
  const [savedTeamSnapshot, setSavedTeamSnapshot] = useState("");
  const [selectedToAddIds, setSelectedToAddIds] = useState<number[]>([]);
  const [savingTeam, setSavingTeam] = useState(false);

  // payment form
  const [payAmount,      setPayAmount]      = useState("");
  const [payWhen,        setPayWhen]        = useState("");
  const [payIdempotencyKey, setPayIdempotencyKey] = useState(() => crypto.randomUUID());
  const [payNote,        setPayNote]        = useState("");
  const [payAttachments, setPayAttachments] = useState<PaymentAttachment[]>([]);
  const [uploadingPaymentBills, setUploadingPaymentBills] = useState(false);
  const [savingPayment,  setSavingPayment]  = useState(false);
  const paymentBillInputRef = useRef<HTMLInputElement>(null);
  const editPaymentBillInputRef = useRef<HTMLInputElement>(null);
  const [editingPaymentBills, setEditingPaymentBills] = useState<ProjectPayment | null>(null);
  const [editedPaymentAttachments, setEditedPaymentAttachments] = useState<PaymentAttachment[]>([]);
  const [uploadingEditedPaymentBills, setUploadingEditedPaymentBills] = useState(false);
  const [savingEditedPaymentBills, setSavingEditedPaymentBills] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDescription, setMilestoneDescription] = useState("");
  const [milestoneDueDate, setMilestoneDueDate] = useState("");
  const [savingMilestone, setSavingMilestone] = useState(false);

  // notes form state
  const [noteCategory,    setNoteCategory]    = useState<NoteCategory>("GENERAL");
  const [noteType,        setNoteType]        = useState<ProjectNoteType>("ADMIN_ONLY");
  const [noteText,        setNoteText]        = useState("");
  const [noteDate,        setNoteDate]        = useState<string>(new Date().toISOString().split("T")[0]);
  const [attachments,     setAttachments]     = useState<NoteAttachment[]>([]);
  const [uploadingFiles,  setUploadingFiles]  = useState(false);
  const [uploadingNote,   setUploadingNote]   = useState(false);
  const [showNoteModal,   setShowNoteModal]   = useState(false);
  const [editingNoteId,   setEditingNoteId]   = useState<number | null>(null);
  const [viewingNote,     setViewingNote]     = useState<ProjectNote | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // notes filter
  const [notesFilter, setNotesFilter] = useState<"ALL"|NoteCategory>("ALL");

  const [activeTab, setActiveTab] = useState<"OVERVIEW"|"TEAM"|"MILESTONES"|"TASKS"|"FINANCES"|"ADDITIONAL_DETAILS"|"NOTES">("OVERVIEW");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentAttachment, setCommentAttachment] = useState<{ mediaAssetId: string; name: string } | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [uploadingCommentFile, setUploadingCommentFile] = useState(false);
  const [deleteNoteTargetId, setDeleteNoteTargetId] = useState<number | null>(null);
  const [deleteMilestoneTarget, setDeleteMilestoneTarget] = useState<ProjectMilestone | null>(null);
  const [deleteModalWorking, setDeleteModalWorking] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [savingBoard, setSavingBoard] = useState(false);
  const [draggingBoardId, setDraggingBoardId] = useState<number | null>(null);
  const [boardDropTargetId, setBoardDropTargetId] = useState<number | null>(null);
  const [savingBoardOrder, setSavingBoardOrder] = useState(false);
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const draggedBoardIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!feedback) return;
    if (feedbackKind === "success") toast.success(feedback);
    else toast.error(feedback);
  }, [feedback, feedbackKind, toast]);

  useEffect(() => {
    if (!feedback) return;
    if (feedbackKind === "success") toast.success(feedback);
    else toast.error(feedback);
  }, [feedback, feedbackKind, toast]);

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
      if (!data.canManageProject) {
        return;
      }
      setEditBudget(data.budgetAmount ? String(data.budgetAmount) : "");
      setEditStatus(data.status);
      setEditServerDetails("");
      setEditDomainName("");
      setEditAnnualMaintenanceCost("");
      setEditManagerId(data.managerId);
      setEditAssignedEmployeeIds(data.assignedEmployees?.map(e => e.id) ?? []);
      const loadedPermissions = Object.fromEntries(
        (data.assignedEmployees ?? []).map(employee => [
          employee.id,
          { canManageTasks: employee.canManageTasks, canAddNotes: employee.canAddNotes },
        ])
      );
      setMemberPermissions(loadedPermissions);
      setSavedTeamSnapshot(teamSnapshot(data.managerId, data.assignedEmployees?.map(e => e.id) ?? [], loadedPermissions));
      setPayWhen(nowDatetimeLocal());
      setLoadingTasks(true); setLoadingPayments(true); setLoadingNotes(true);
      const [tasks, pays, notes, users, milestoneList, boards] = await Promise.all([
        getTasksByProject(projectId),
        getProjectPayments(projectId),
        getProjectNotes(projectId),
        getUsers(),
        getProjectMilestones(projectId),
        getProjectTaskBoards(projectId),
      ]);
      setProjectTasks(tasks); setProjectPayments(pays); setProjectNotes(notes);
      const domainProfile = detailProfileFromNotes(notes, "DOMAIN_DETAILS");
      const maintenanceProfile = detailProfileFromNotes(notes, "MAINTENANCE_DETAILS");
      const serverProfile = detailProfileFromNotes(notes, "SERVER_DETAILS");
      setEditDomainName(domainProfile?.title || "");
      setEditDomainStartDate(domainProfile?.date || "");
      setEditMaintenanceTitle(maintenanceProfile?.title || "");
      setEditMaintenanceStartDate(maintenanceProfile?.date || "");
      setEditAnnualMaintenanceCost(maintenanceProfile?.cost || "");
      setEditServerDetails(serverProfile?.title || "");
      setEditServerStartDate(serverProfile?.date || "");
      setMilestones(milestoneList);
      setTaskBoards(boards);
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

  const mentionCandidates = useMemo<MentionCandidate[]>(() => {
    if (!project) return [];
    const team = [
      { id: project.managerId, fullName: project.managerName },
      ...(project.assignedEmployees ?? []).map(employee => ({ id: employee.id, fullName: employee.fullName })),
    ];
    return Array.from(new Map(team.map(member => [member.id, member])).values())
      .filter(member => member.id !== user?.userId);
  }, [project, user?.userId]);

  if (authLoading) return <div className="p-8">Loading project details...</div>;
  if (user?.role === "EMPLOYEE") return <EmployeeProjectView projectId={projectId} />;

  if (loading) return <div className="p-8">Loading project details...</div>;
  if (!project) return (
    <div className="p-8 text-center">
      <h1 className="text-2xl mb-4">Project not found</h1>
      <button onClick={() => router.push("/projects")} className="btn-secondary">Back to Projects</button>
    </div>
  );
  if (!project.canManageProject) return <EmployeeProjectView projectId={projectId} />;

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
        memberPermissions: buildMemberPermissions(),
        budgetAmount: budgetNum,
      });
      setProject(updated);
      setEditManagerId(updated.managerId);
      setEditAssignedEmployeeIds(updated.assignedEmployees?.map(e => e.id) ?? []);
      syncMemberPermissions(updated);
      setEditBudget(updated.budgetAmount ? String(updated.budgetAmount) : "");
      setFeedbackKind("success"); setFeedback("Project updated successfully.");
    } catch { setFeedbackKind("error"); setFeedback("Failed to update project."); }
    finally { setIsSaving(false); }
  }

  function getAdditionalDetailInput(category: AdditionalDetailKey) {
    if (category === "DOMAIN_DETAILS") {
      return { title: editDomainName.trim(), date: editDomainStartDate };
    }
    if (category === "SERVER_DETAILS") {
      return { title: editServerDetails.trim(), date: editServerStartDate };
    }
    return { title: editMaintenanceTitle.trim(), date: editMaintenanceStartDate };
  }

  async function saveAdditionalDetail(category: AdditionalDetailKey) {
    if (!project) return;
    const { title, date } = getAdditionalDetailInput(category);
    if (!title) {
      setFeedbackKind("error");
      setFeedback("Please enter a title or name first.");
      return;
    }
    if (!date) {
      setFeedbackKind("error");
      setFeedback("Please choose the purchase or start date.");
      return;
    }

    const maintenanceCost = editAnnualMaintenanceCost.trim() === "" ? undefined : parseFloat(editAnnualMaintenanceCost);
    if (maintenanceCost !== undefined && (Number.isNaN(maintenanceCost) || maintenanceCost < 0)) {
      setFeedbackKind("error");
      setFeedback("Annual maintenance cost must be a valid positive number.");
      return;
    }

    setSavingDetailKey(category);
    setFeedback("");
    try {
      const updated = await updateProject(project.id, {
        name: project.name,
        description: project.description || "",
        status: editStatus,
        managerId: editManagerId,
        assignedEmployeeIds: editAssignedEmployeeIds,
        memberPermissions: buildMemberPermissions(),
        budgetAmount: editBudget.trim() === "" ? undefined : parseFloat(editBudget),
      });

      const existingProfile = projectNotes.find(note => {
        const decoded = decodeProjectNote(note);
        return decoded.category === category && decoded.isDetailProfile;
      });
      const payload = {
        content: encodeNote({
          category,
          date,
          text: "Detail setup",
          attachments: [],
          detailTitle: title,
          detailCost: category === "MAINTENANCE_DETAILS" ? editAnnualMaintenanceCost.trim() : undefined,
          isDetailProfile: true,
        }),
        noteType: "ADMIN_ONLY" as ProjectNoteType,
      };
      if (existingProfile) {
        await updateProjectNote(existingProfile.id, payload);
      } else {
        await createProjectNote(project.id, payload);
      }

      const notes = await getProjectNotes(project.id);
      setProject(updated);
      setProjectNotes(notes);
      setFeedbackKind("success");
      setFeedback("Additional detail saved.");
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to save additional detail.");
    } finally {
      setSavingDetailKey(null);
    }
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
        memberPermissions: buildMemberPermissions(),
        budgetAmount: budgetNum,
      });
      setProject(updated);
      setEditManagerId(updated.managerId);
      setEditAssignedEmployeeIds(updated.assignedEmployees?.map(e => e.id) ?? []);
      syncMemberPermissions(updated);
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
    setMemberPermissions(prev => {
      const next = { ...prev };
      selectedToAddIds.forEach(id => {
        next[id] ??= { canManageTasks: false, canAddNotes: false };
      });
      return next;
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
    setMemberPermissions(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }

  function setMemberPermission(userId: number, key: "canManageTasks" | "canAddNotes", value: boolean) {
    setMemberPermissions(prev => ({
      ...prev,
      [userId]: {
        canManageTasks: prev[userId]?.canManageTasks ?? false,
        canAddNotes: prev[userId]?.canAddNotes ?? false,
        [key]: value,
      },
    }));
  }

  function buildMemberPermissions(): ProjectMemberPermission[] {
    return editAssignedEmployeeIds.map(userId => ({
      userId,
      canManageTasks: memberPermissions[userId]?.canManageTasks ?? false,
      canAddNotes: memberPermissions[userId]?.canAddNotes ?? false,
    }));
  }

  function syncMemberPermissions(updated: Project) {
    const updatedPermissions = Object.fromEntries(
      (updated.assignedEmployees ?? []).map(employee => [
        employee.id,
        { canManageTasks: employee.canManageTasks, canAddNotes: employee.canAddNotes },
      ])
    );
    setMemberPermissions(updatedPermissions);
    setSavedTeamSnapshot(teamSnapshot(
      updated.managerId,
      updated.assignedEmployees?.map(employee => employee.id) ?? [],
      updatedPermissions
    ));
  }

  function teamSnapshot(
    managerId: number,
    employeeIds: number[],
    permissions: Record<number, Omit<ProjectMemberPermission, "userId">>
  ) {
    return JSON.stringify({
      managerId,
      members: [...employeeIds].sort((a, b) => a - b).map(userId => ({
        userId,
        canManageTasks: permissions[userId]?.canManageTasks ?? false,
        canAddNotes: permissions[userId]?.canAddNotes ?? false,
      })),
    });
  }

  const assignedMembers = editAssignedEmployeeIds.map(id => {
    const fromProject = project?.assignedEmployees?.find(e => e.id === id);
    if (fromProject) {
      return {
        ...fromProject,
        ...memberPermissions[id],
        role: "EMPLOYEE" as const,
      };
    }
    const fromUsers = employees.find(e => e.id === id);
    return {
      id,
      fullName: fromUsers?.fullName ?? `User #${id}`,
      role: "EMPLOYEE" as const,
      canManageTasks: memberPermissions[id]?.canManageTasks ?? false,
      canAddNotes: memberPermissions[id]?.canAddNotes ?? false,
    };
  });

  const availableEmployees = employees.filter(e => !editAssignedEmployeeIds.includes(e.id));

  const editManagerName = managers.find(m => m.id === editManagerId)?.fullName ?? project.managerName;
  const hasUnsavedTeamChanges = savedTeamSnapshot !== teamSnapshot(
    editManagerId,
    editAssignedEmployeeIds,
    memberPermissions
  );

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
        idempotencyKey: payIdempotencyKey,
        attachments: payAttachments
          .filter(attachment => attachment.mediaAssetId)
          .map(attachment => ({ mediaAssetId: attachment.mediaAssetId! })),
      });
      setPayAmount(""); setPayWhen(nowDatetimeLocal()); setPayNote(""); setPayAttachments([]);
      setPayIdempotencyKey(crypto.randomUUID());
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

  async function uploadPaymentBills(files: File[], existingCount: number) {
    if (existingCount + files.length > MAX_PAYMENT_BILLS) {
      throw new Error(`Maximum ${MAX_PAYMENT_BILLS} bills per payment.`);
    }
    for (const file of files) {
      if (!PAYMENT_BILL_MIME_TYPES.has(file.type)) {
        throw new Error(`"${file.name}" is not supported. Use PDF, JPG, or PNG.`);
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`"${file.name}" exceeds the 10MB limit.`);
      }
    }

    const uploaded: PaymentAttachment[] = [];
    for (const file of files) {
      const media = await uploadFile(file, "PAYMENT_ATTACHMENT");
      if (media.status !== "VERIFIED") {
        throw new Error("The bill is quarantined until malware scanning succeeds.");
      }
      uploaded.push({
        mediaAssetId: media.id,
        downloadUrl: null,
        fileName: media.originalFilename,
        fileType: media.detectedMimeType,
        legacyAssetStatus: "NONE",
      });
    }
    return uploaded;
  }

  async function handlePaymentBillSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setUploadingPaymentBills(true);
    setFeedback("");
    try {
      const uploaded = await uploadPaymentBills(files, payAttachments.length);
      setPayAttachments(previous => [...previous, ...uploaded]);
      setFeedbackKind("success");
      setFeedback(`${uploaded.length} bill${uploaded.length === 1 ? "" : "s"} uploaded.`);
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Bill upload failed.");
    } finally {
      setUploadingPaymentBills(false);
    }
  }

  function openPaymentBillEditor(payment: ProjectPayment) {
    setEditingPaymentBills(payment);
    setEditedPaymentAttachments(payment.attachments ?? []);
  }

  async function handleEditedPaymentBillSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setUploadingEditedPaymentBills(true);
    setFeedback("");
    try {
      const uploaded = await uploadPaymentBills(files, editedPaymentAttachments.length);
      setEditedPaymentAttachments(previous => [...previous, ...uploaded]);
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Bill upload failed.");
    } finally {
      setUploadingEditedPaymentBills(false);
    }
  }

  async function saveEditedPaymentBills() {
    if (!project || !editingPaymentBills) return;
    setSavingEditedPaymentBills(true);
    try {
      await updateProjectPaymentAttachments(
        project.id,
        editingPaymentBills.id,
        editedPaymentAttachments
          .filter(attachment => attachment.mediaAssetId)
          .map(attachment => ({ mediaAssetId: attachment.mediaAssetId! }))
      );
      setProjectPayments(await getProjectPayments(project.id));
      setEditingPaymentBills(null);
      setEditedPaymentAttachments([]);
      setFeedbackKind("success");
      setFeedback("Payment bills updated.");
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to update payment bills.");
    } finally {
      setSavingEditedPaymentBills(false);
    }
  }

  async function handleSaveNote() {
    if (!project) return;
    if (!noteText.trim()) {
      setFeedbackKind("error"); setFeedback("Notes/findings cannot be empty."); return;
    }
    setUploadingNote(true); setFeedback("");
    const payload = {
      content: encodeNote({
        category: noteCategory,
        date: noteDate,
        text: noteText.trim(),
        attachments: [],
      }),
      noteType,
      mediaAssetIds: editingNoteId
        ? undefined
        : attachments.map(attachment => attachment.mediaAssetId),
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
    const decoded = decodeProjectNote(note);
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

  async function handleCreateTaskBoard(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newBoardName.trim();
    if (!name) {
      setFeedbackKind("error");
      setFeedback("Board name is required.");
      return;
    }
    setSavingBoard(true);
    try {
      const board = await createProjectTaskBoard(projectId, name);
      setTaskBoards(prev => [...prev, board].sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id));
      setNewBoardName("");
      setFeedbackKind("success");
      setFeedback(`Board "${board.name}" created.`);
    } catch (err) {
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to create board.");
    } finally {
      setSavingBoard(false);
    }
  }

  function handleBoardDragStart(boardId: number) {
    draggedBoardIdRef.current = boardId;
    setDraggingBoardId(boardId);
  }

  async function handleBoardDrop(event: React.DragEvent<HTMLDivElement>, targetBoardId: number) {
    event.preventDefault();
    const draggedBoardId = draggedBoardIdRef.current;
    setBoardDropTargetId(null);
    if (!draggedBoardId || draggedBoardId === targetBoardId || savingBoardOrder) return;

    const currentIndex = taskBoards.findIndex(board => board.id === draggedBoardId);
    const targetIndex = taskBoards.findIndex(board => board.id === targetBoardId);
    if (currentIndex < 0 || targetIndex < 0) return;

    const targetRect = event.currentTarget.getBoundingClientRect();
    const dropAfterTarget = event.clientX > targetRect.left + targetRect.width / 2;
    const nextBoards = [...taskBoards];
    const [draggedBoard] = nextBoards.splice(currentIndex, 1);
    let insertIndex = targetIndex + (dropAfterTarget ? 1 : 0);
    if (currentIndex < insertIndex) insertIndex -= 1;
    nextBoards.splice(insertIndex, 0, draggedBoard);
    if (nextBoards.every((board, index) => board.id === taskBoards[index]?.id)) return;

    const previousBoards = taskBoards;
    setSavingBoardOrder(true);
    setTaskBoards(nextBoards);
    try {
      const saved = await reorderProjectTaskBoards(projectId, nextBoards.map(board => board.id));
      setTaskBoards(saved);
      setFeedbackKind("success");
      setFeedback("Board order updated.");
    } catch (err) {
      setTaskBoards(previousBoards);
      setFeedbackKind("error");
      setFeedback(err instanceof Error ? err.message : "Failed to update board order.");
    } finally {
      setSavingBoardOrder(false);
      setDraggingBoardId(null);
      draggedBoardIdRef.current = null;
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
    setNoteCategory("GENERAL"); setNoteType("ADMIN_ONLY");
    setAttachments([]);
    setEditingNoteId(null);
    setShowNoteModal(false);
  }

  function openNewNote(category: NoteCategory = "GENERAL") {
    setNoteText("");
    setNoteDate(new Date().toISOString().split("T")[0]);
    setNoteCategory(category);
    setNoteType("ADMIN_ONLY");
    setAttachments([]);
    setEditingNoteId(null);
    setShowNoteModal(true);
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
        const media = await uploadFile(file, "PROJECT_ATTACHMENT");
        if (media.status !== "VERIFIED") {
          throw new Error("The attachment is quarantined until malware scanning succeeds.");
        }
        uploaded.push({
          mediaAssetId: media.id,
          fileName: media.originalFilename,
          fileType: media.detectedMimeType,
          kind: fileKind(media.detectedMimeType),
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

  const publicProjectNotes = projectNotes.filter(note => !isDetailProfileNote(note));
  const viewingNoteDetails = viewingNote ? decodeProjectNote(viewingNote) : null;

  // filtered notes for the notes tab
  const visibleNotes = notesFilter === "ALL"
    ? publicProjectNotes
    : publicProjectNotes.filter(n => decodeNote(n.content).category === notesFilter);

  const activeTaskCount = projectTasks.filter(t => t.status !== "DONE").length;
  const boardNameByStatus = Object.fromEntries(taskBoards.map(board => [board.statusKey, board.name]));

  // ── render ────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto">
      <nav className="project-breadcrumb">
        <button type="button" onClick={() => router.push("/projects")}>Projects</button>
        <span>/</span>
        <span style={{ color: "var(--text-primary)" }}>{project.name}</span>
      </nav>

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
            { label: "Notes", value: String(publicProjectNotes.length), color: "var(--text-primary)" },
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
              <p className="text-sm text-muted">Assign employees and choose who can manage tasks or add team notes.</p>
            </div>
            <span className={`team-save-state${hasUnsavedTeamChanges ? " pending" : ""}`}>
              {hasUnsavedTeamChanges ? "Unsaved changes" : "All changes saved"}
            </span>
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
                    <div className="project-team-identity">
                      <div className="project-team-avatar">
                        {member.fullName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="project-team-name">{member.fullName}</div>
                        <div className="text-xs text-muted">Project member</div>
                      </div>
                    </div>
                    <div className="project-member-permissions">
                      <label className={memberPermissions[member.id]?.canManageTasks ? "active" : ""}>
                        <input
                          type="checkbox"
                          checked={memberPermissions[member.id]?.canManageTasks ?? false}
                          onChange={event => setMemberPermission(member.id, "canManageTasks", event.target.checked)}
                        />
                        <span><strong>Manage tasks</strong><small>Create, assign and edit</small></span>
                      </label>
                      <label className={memberPermissions[member.id]?.canAddNotes ? "active" : ""}>
                        <input
                          type="checkbox"
                          checked={memberPermissions[member.id]?.canAddNotes ?? false}
                          onChange={event => setMemberPermission(member.id, "canAddNotes", event.target.checked)}
                        />
                        <span><strong>Add notes</strong><small>Share with project team</small></span>
                      </label>
                      <button type="button" className="team-remove-button" onClick={() => removeTeamMember(member.id)} title={`Remove ${member.fullName}`}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {hasUnsavedTeamChanges && (
            <div className="team-save-bar">
              <div>
                <strong>Team settings changed</strong>
                <span>Save to apply assignments and permissions.</span>
              </div>
              <button type="button" className="btn-primary" disabled={savingTeam} onClick={() => void saveTeamAssignments()}>
                {savingTeam ? "Saving…" : "Save team changes"}
              </button>
            </div>
          )}
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
                Drag cards between columns to update the task board.
              </p>
            </div>
            <button onClick={() => router.push(`/tasks/new?projectId=${projectId}`)} className="btn-primary" style={{ fontSize: "0.875rem" }}>
              + New Task
            </button>
          </div>
          {(user?.role === "ADMIN" || user?.role === "MANAGER") && (
            <div className="project-toolbar" style={{ alignItems: "stretch", justifyContent: "space-between" }}>
              <div style={{ minWidth: "220px" }}>
                <strong style={{ display: "block", marginBottom: "4px" }}>Boards</strong>
                <span className="text-sm text-muted">Add and reorder project-specific columns.</span>
              </div>
              <div style={{ display: "grid", gap: "12px", flex: 1 }}>
                <form onSubmit={handleCreateTaskBoard} className="flex gap-3">
                  <input
                    value={newBoardName}
                    onChange={event => setNewBoardName(event.target.value)}
                    placeholder="Board name"
                    maxLength={80}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn-secondary" disabled={savingBoard}>
                    {savingBoard ? "Adding..." : "Add Board"}
                  </button>
                </form>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {taskBoards.map(board => (
                    <div
                      key={board.id}
                      draggable={!savingBoardOrder}
                      onDragStart={() => handleBoardDragStart(board.id)}
                      onDragOver={event => {
                        event.preventDefault();
                        setBoardDropTargetId(board.id);
                      }}
                      onDragLeave={() => setBoardDropTargetId(current => current === board.id ? null : current)}
                      onDrop={event => void handleBoardDrop(event, board.id)}
                      onDragEnd={() => {
                        draggedBoardIdRef.current = null;
                        setDraggingBoardId(null);
                        setBoardDropTargetId(null);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 10px",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        background: boardDropTargetId === board.id
                          ? "rgba(59, 130, 246, 0.18)"
                          : "rgba(15, 23, 42, 0.55)",
                        boxShadow: boardDropTargetId === board.id ? "0 0 0 1px var(--primary-color)" : "none",
                        cursor: savingBoardOrder ? "progress" : "grab",
                        opacity: draggingBoardId === board.id ? 0.45 : 1,
                        userSelect: "none",
                      }}
                      title="Drag to reorder"
                    >
                      <span aria-hidden="true" style={{ color: "var(--text-secondary)", fontSize: "1rem", lineHeight: 1 }}>⋮⋮</span>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>{board.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <ProjectKanban
            tasks={projectTasks}
            boards={taskBoards}
            loading={loadingTasks}
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
                          <button
                            type="button"
                            className="text-sm"
                            onClick={() => void downloadMediaAsset(
                              comment.mediaAssetId!,
                              comment.attachmentName || "attachment"
                            )}
                            style={{ color: "var(--accent-color)", display: "inline-block", marginTop: "10px" }}
                          >
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
                <div className="payment-primary-fields">
                  <input type="number" min={0.01} step="0.01" placeholder="Amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} style={{ flex: 1 }} />
                  <input type="datetime-local" value={payWhen} onChange={e => setPayWhen(e.target.value)} style={{ flex: 1.2 }} />
                </div>
                <input placeholder="Reference note (optional)" value={payNote} onChange={e => setPayNote(e.target.value)} />
                <div className="payment-bill-picker">
                  <input
                    ref={paymentBillInputRef}
                    type="file"
                    accept={PAYMENT_BILL_ACCEPT}
                    multiple
                    hidden
                    onChange={e => void handlePaymentBillSelect(e)}
                  />
                  <div>
                    <strong>Bills and receipts</strong>
                    <span>Optional · PDF, JPG, or PNG · up to {MAX_PAYMENT_BILLS}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={uploadingPaymentBills || payAttachments.length >= MAX_PAYMENT_BILLS}
                    onClick={() => paymentBillInputRef.current?.click()}
                  >
                    {uploadingPaymentBills ? "Uploading..." : "Choose files"}
                  </button>
                </div>
                {payAttachments.length > 0 && (
                  <div className="payment-bill-list">
                    {payAttachments.map((attachment, index) => (
                      <div className="payment-bill-file" key={`${attachment.mediaAssetId}-${index}`}>
                        <span title={attachment.fileName}>{attachment.fileName}</span>
                        <button type="button" aria-label={`Remove ${attachment.fileName}`} onClick={() => setPayAttachments(current => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" className="btn-primary" disabled={savingPayment || uploadingPaymentBills} onClick={() => void handleAddPayment()}>
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
                      {["Date", "Amount", "Reference", "Bills", "By", "Actions"].map(h => (
                        <th key={h} style={{ textAlign: h === "Amount" || h === "Actions" ? "right" : "left", padding: "10px 12px", color: "var(--text-secondary)", fontWeight: 500, fontSize: "0.75rem" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projectPayments.map(p => (
                      <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "12px" }}>{new Date(p.paidAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: 600, color: "var(--success-color)" }}>{formatMoney(p.amount)}</td>
                        <td style={{ padding: "12px", color: "var(--text-secondary)", maxWidth: "240px" }}>{p.referenceNote || "—"}</td>
                        <td style={{ padding: "12px" }}>
                          {p.attachments?.length ? (
                            <div className="payment-history-bills">
                              {p.attachments.map(attachment => (
                                <button
                                  type="button"
                                  key={attachment.id ?? attachment.mediaAssetId}
                                  onClick={() => attachment.mediaAssetId
                                    ? void downloadMediaAsset(attachment.mediaAssetId, attachment.fileName)
                                    : undefined}
                                  disabled={!attachment.mediaAssetId}
                                  title={attachment.fileName}
                                >
                                  {attachment.fileName}
                                </button>
                              ))}
                            </div>
                          ) : <span className="text-muted">None</span>}
                        </td>
                        <td style={{ padding: "12px" }}>{p.recordedByName}</td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                          <button type="button" className="payment-bill-manage" onClick={() => openPaymentBillEditor(p)}>Manage bills</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "ADDITIONAL_DETAILS" && (
        <div className="project-section">
          <div className="project-section-header">
            <div>
              <h2>Additional Details</h2>
              <p className="text-sm text-muted">Add a title, choose the purchase/start date, then keep notes for payments, bugs, renewals, or changes.</p>
            </div>
          </div>

          <div style={{ display: "grid", gap: "16px" }}>
              {ADDITIONAL_DETAIL_SECTIONS.map(section => {
                const detailNotes = projectNotes
                  .filter(note => {
                    const decoded = decodeProjectNote(note);
                    return decoded.category === section.key && !decoded.isDetailProfile;
                  })
                  .sort((a, b) => {
                    const aDate = decodeNote(a.content).date || a.createdAt;
                    const bDate = decodeNote(b.content).date || b.createdAt;
                    return bDate.localeCompare(aDate);
                  });
                const meta = categoryMeta(section.key);
                const titleValue = section.key === "DOMAIN_DETAILS"
                  ? editDomainName
                  : section.key === "SERVER_DETAILS"
                    ? editServerDetails
                    : editMaintenanceTitle;
                const dateValue = section.key === "DOMAIN_DETAILS"
                  ? editDomainStartDate
                  : section.key === "SERVER_DETAILS"
                    ? editServerStartDate
                    : editMaintenanceStartDate;
                const setTitle = section.key === "DOMAIN_DETAILS"
                  ? setEditDomainName
                  : section.key === "SERVER_DETAILS"
                    ? setEditServerDetails
                    : setEditMaintenanceTitle;
                const setDate = section.key === "DOMAIN_DETAILS"
                  ? setEditDomainStartDate
                  : section.key === "SERVER_DETAILS"
                    ? setEditServerStartDate
                    : setEditMaintenanceStartDate;
                const isSavingThisDetail = savingDetailKey === section.key;

                return (
                  <div key={section.key} className="project-card-static">
                    <div className="flex justify-between items-start gap-3 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ fontSize: "1.05rem" }}>{meta.icon}</span>
                          <h3 style={{ fontSize: "0.95rem", fontWeight: 600 }}>{section.title}</h3>
                        </div>
                        <p className="text-xs text-muted">{section.description}</p>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1.2fr) minmax(160px, 0.8fr)", gap: "14px", marginBottom: "14px" }}>
                      <div>
                        <label className="text-xs text-muted block mb-2">{section.titleLabel}</label>
                        <input
                          value={titleValue}
                          onChange={event => setTitle(event.target.value)}
                          placeholder={section.placeholder}
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted block mb-2">{section.dateLabel}</label>
                        <input
                          type="date"
                          value={dateValue}
                          onChange={event => setDate(event.target.value)}
                          style={{ width: "100%" }}
                        />
                      </div>
                      {section.key === "MAINTENANCE_DETAILS" && (
                        <div>
                          <label className="text-xs text-muted block mb-2">AMC cost (USD)</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={editAnnualMaintenanceCost}
                            onChange={event => setEditAnnualMaintenanceCost(event.target.value)}
                            placeholder="0.00"
                            style={{ width: "100%" }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: "14px" }}>
                      <button type="button" className="btn-primary" disabled={isSavingThisDetail} onClick={() => void saveAdditionalDetail(section.key)}>
                        {isSavingThisDetail ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        data-testid={`add-${section.key.toLowerCase().replaceAll("_", "-")}-note`}
                        className="btn-secondary"
                        onClick={() => openNewNote(section.key)}
                      >
                        + Add note
                      </button>
                      <span className="text-sm text-muted">{detailNotes.length} note{detailNotes.length !== 1 ? "s" : ""}</span>
                    </div>

                    {detailNotes.length === 0 ? (
                      <div className="project-empty-state" style={{ padding: "16px", minHeight: "auto" }}>
                        <p>No notes yet. Add payments, bugs, renewal reminders, or changes here.</p>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: "10px" }}>
                        {detailNotes.map(note => {
                          const decoded = decodeProjectNote(note);
                          const displayDate = decoded.date
                            ? new Date(`${decoded.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                            : new Date(note.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                          return (
                            <div key={note.id} style={{
                              padding: "12px",
                              border: "1px solid var(--border-color)",
                              borderRadius: "8px",
                              background: "rgba(255,255,255,0.03)",
                            }}>
                              <div className="flex justify-between items-start gap-3 mb-2">
                                <div>
                                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)" }}>{displayDate}</div>
                                  <div className="text-xs text-muted">Maintained by {note.createdByName}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button type="button" onClick={() => openNoteForEdit(note)} className="btn-secondary" style={{ padding: "4px 8px", fontSize: "0.75rem" }}>
                                    Edit
                                  </button>
                                  <button type="button" onClick={() => setDeleteNoteTargetId(note.id)} className="btn-secondary" style={{ padding: "4px 8px", fontSize: "0.75rem", color: "var(--danger-color)" }}>
                                    Delete
                                  </button>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="project-note-preview compact"
                                onClick={() => setViewingNote(note)}
                                aria-label={`View full ${meta.label} note`}
                              >
                                {decoded.text}
                              </button>
                              <button type="button" className="note-view-link" onClick={() => setViewingNote(note)}>
                                View full note
                              </button>
                              {decoded.attachments.length > 0 && (
                                <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                  {decoded.attachments.map((att, index) => (
                                    <button key={`${att.mediaAssetId}-${index}`} type="button" onClick={() => void downloadMediaAsset(att.mediaAssetId, att.fileName)} style={{ fontSize: "0.78rem", color: "var(--primary-color)" }}>
                                      {att.fileName}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {activeTab === "NOTES" && (
        <div className="project-section">
          <div className="project-section-header">
            <div>
              <h2>Notes</h2>
              <p className="text-sm text-muted">{publicProjectNotes.length} note{publicProjectNotes.length !== 1 ? "s" : ""} · attach files when adding notes</p>
            </div>
            <button onClick={() => openNewNote()} className="btn-primary" style={{ fontSize: "0.875rem" }}>
              + Add Note
            </button>
          </div>

          <div className="project-toolbar">
            <span className="text-sm text-muted">Filter:</span>
            <button type="button" className={`project-tab${notesFilter === "ALL" ? " active" : ""}`} style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => setNotesFilter("ALL")}>
              All ({publicProjectNotes.length})
            </button>
            {NOTE_CATEGORIES.map(cat => {
              const count = publicProjectNotes.filter(n => decodeNote(n.content).category === cat.value).length;
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
                const decoded = decodeProjectNote(note);
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
                          background: note.noteType === "TEAM" ? "rgba(16,185,129,0.15)" : "rgba(139,92,246,0.15)",
                          color: note.noteType === "TEAM" ? "#6ee7b7" : "#c4b5fd",
                        }}>
                          {note.noteType === "TEAM" ? "PROJECT TEAM" : "ADMINS & MANAGER"}
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
                    <button
                      type="button"
                      className="project-note-preview"
                      onClick={() => setViewingNote(note)}
                      aria-label={`View full ${meta.label} note`}
                    >
                      {decoded.text}
                    </button>
                    <button type="button" className="note-view-link" onClick={() => setViewingNote(note)}>
                      View full note
                    </button>

                    {/* Attachments */}
                    {decoded.attachments.length > 0 && (
                      <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="text-xs text-muted mb-2">Attachments</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {decoded.attachments.map((att, i) => (
                              <button key={i} type="button" onClick={() => void downloadMediaAsset(att.mediaAssetId, att.fileName)}
                                style={{ fontSize: "0.82rem", color: "var(--primary-color)", display: "flex",
                                  alignItems: "center", gap: "8px", padding: "8px 10px",
                                  background: "rgba(255,255,255,0.04)", borderRadius: "8px",
                                  border: "1px solid rgba(255,255,255,0.08)" }}>
                                <span>📄</span>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {att.fileName}
                                </span>
                              </button>
                          ))}
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
                {(["ADMIN_ONLY","TEAM"] as const).map(t => (
                  <label key={t} className="flex items-center gap-2 text-sm" style={{ cursor: "pointer" }}>
                    <input type="radio" name="modalNoteVisibility" value={t}
                      checked={noteType === t} onChange={() => setNoteType(t)}
                      style={{ accentColor: "var(--primary-color)" }} />
                    {t === "ADMIN_ONLY" ? "Admins and project manager only" : "Project team"}
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
                      <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>📄</span>
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
      {viewingNote && viewingNoteDetails && (
        <div
          className="project-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-note-view-title"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setViewingNote(null);
          }}
        >
          <div className="glass-panel project-modal note-detail-modal">
            <div className="note-detail-header">
              <div>
                <p className="text-xs text-muted">
                  {viewingNote.noteType === "TEAM" ? "Project team note" : "Admins and manager note"}
                </p>
                <h2 id="project-note-view-title">{categoryMeta(viewingNoteDetails.category).label}</h2>
                <div className="text-xs text-muted">
                  {viewingNote.createdByName}
                  {viewingNoteDetails.date ? ` · ${viewingNoteDetails.date}` : ` · ${new Date(viewingNote.createdAt).toLocaleDateString()}`}
                </div>
              </div>
              <button type="button" aria-label="Close note" onClick={() => setViewingNote(null)}>×</button>
            </div>
            {viewingNoteDetails.detailTitle || viewingNoteDetails.detailCost ? (
              <div className="note-detail-meta">
                {viewingNoteDetails.detailTitle && <span>{viewingNoteDetails.detailTitle}</span>}
                {viewingNoteDetails.detailCost && <span>{formatMoney(Number(viewingNoteDetails.detailCost))}</span>}
              </div>
            ) : null}
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
      {editingPaymentBills && (
        <div className="project-modal-overlay" onMouseDown={event => {
          if (event.target === event.currentTarget && !savingEditedPaymentBills) setEditingPaymentBills(null);
        }}>
          <div className="glass-panel project-modal payment-bill-modal" role="dialog" aria-modal="true" aria-labelledby="payment-bill-modal-title">
            <div className="payment-bill-modal-header">
              <div>
                <p className="text-xs text-muted">Payment {formatMoney(editingPaymentBills.amount)}</p>
                <h2 id="payment-bill-modal-title">Manage bills</h2>
              </div>
              <button type="button" aria-label="Close" disabled={savingEditedPaymentBills} onClick={() => setEditingPaymentBills(null)}>×</button>
            </div>

            <div className="payment-bill-modal-body">
              <p className="text-sm text-muted">Add or remove invoices, bills, and receipts. Changes apply only after you save.</p>
              <input
                ref={editPaymentBillInputRef}
                type="file"
                accept={PAYMENT_BILL_ACCEPT}
                multiple
                hidden
                onChange={e => void handleEditedPaymentBillSelect(e)}
              />
              <button
                type="button"
                className="btn-secondary"
                disabled={uploadingEditedPaymentBills || editedPaymentAttachments.length >= MAX_PAYMENT_BILLS}
                onClick={() => editPaymentBillInputRef.current?.click()}
              >
                {uploadingEditedPaymentBills ? "Uploading..." : "Add bill files"}
              </button>

              {editedPaymentAttachments.length === 0 ? (
                <div className="project-empty-state payment-bill-empty">No bills attached to this payment.</div>
              ) : (
                <div className="payment-bill-edit-list">
                  {editedPaymentAttachments.map((attachment, index) => (
                    <div className="payment-bill-edit-item" key={`${attachment.id ?? attachment.mediaAssetId}-${index}`}>
                      <div>
                        <strong>{attachment.fileName}</strong>
                        <span>{attachment.fileType === "application/pdf" ? "PDF document" : "Image"}</span>
                      </div>
                      <div>
                        {attachment.mediaAssetId && (
                          <button type="button" onClick={() => void downloadMediaAsset(attachment.mediaAssetId!, attachment.fileName)}>Download</button>
                        )}
                        <button type="button" onClick={() => setEditedPaymentAttachments(current => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="payment-bill-modal-actions">
              <button type="button" className="btn-secondary" disabled={savingEditedPaymentBills} onClick={() => setEditingPaymentBills(null)}>Cancel</button>
              <button type="button" className="btn-primary" disabled={savingEditedPaymentBills || uploadingEditedPaymentBills} onClick={() => void saveEditedPaymentBills()}>
                {savingEditedPaymentBills ? "Saving..." : "Save bills"}
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
