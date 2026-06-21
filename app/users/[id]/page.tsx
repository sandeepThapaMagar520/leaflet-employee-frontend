"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  addStaffDocument,
  AttendanceSession,
  DailyLog,
  deleteStaffDocument,
  downloadExport,
  getStaffOverview,
  LeaveRequest,
  Project,
  StaffDocument,
  StaffDocumentType,
  StaffOverview,
  Task,
  uploadFile,
} from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import { useToast } from "@/lib/toast";

type Tab = "overview" | "projects" | "tasks" | "attendance" | "leave" | "dsu" | "documents" | "audit";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "projects", label: "Projects" },
  { id: "tasks", label: "Tasks" },
  { id: "attendance", label: "Attendance" },
  { id: "leave", label: "Leave" },
  { id: "dsu", label: "DSU" },
  { id: "documents", label: "Documents" },
  { id: "audit", label: "Audit" },
];

const documentTypes: StaffDocumentType[] = ["CONTRACT", "ID_PROOF", "RESUME", "OFFER_LETTER", "CERTIFICATE", "OTHER"];
const initials = (name: string) => name.split(" ").filter(Boolean).map(part => part[0]).join("").slice(0, 2).toUpperCase();
const titleCase = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase());
const formatDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
  : "Not available";
const formatDateTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
  : "In progress";
const formatLastLogin = (value?: string | null) => value ? formatDateTime(value) : "Never logged in";
const formatHours = (value: number | null) => value == null ? "Active" : `${Number(value).toFixed(2)}h`;
const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const isWithinDateRange = (value: string | null | undefined, from: string, to: string) => {
  if (!value) return false;
  const date = value.slice(0, 10);
  return (!from || date >= from) && (!to || date <= to);
};

function EmptyState({ children }: { children: string }) {
  return <div className="staff-record-empty">{children}</div>;
}

function ProjectRows({ projects }: { projects: Project[] }) {
  if (!projects.length) return <EmptyState>No project involvement recorded.</EmptyState>;
  return (
    <div className="staff-record-list">
      {projects.map(project => (
        <Link href={`/projects/${project.id}`} className="staff-record-item staff-record-project" key={project.id}>
          <div>
            <strong>{project.name}</strong>
            <span>{project.managerName} · {project.progressPercentage}% complete</span>
          </div>
          <div className="staff-record-item-meta">
            <span className={`record-badge record-${project.status.toLowerCase()}`}>{titleCase(project.status)}</span>
            <small>{project.dueDate ? `Due ${formatDate(project.dueDate)}` : "No due date"}</small>
          </div>
        </Link>
      ))}
    </div>
  );
}

function TaskRows({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) return <EmptyState>No tasks assigned.</EmptyState>;
  return (
    <div className="staff-record-list">
      {tasks.map(task => (
        <div className="staff-record-item" key={task.id}>
          <div>
            <strong>{task.title}</strong>
            <span>{task.projectName} · {titleCase(task.priority)} priority</span>
          </div>
          <div className="staff-record-item-meta">
            <span className={`record-badge record-${task.status.toLowerCase()}`}>{titleCase(task.status)}</span>
            <small>{task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date"}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function AttendanceRows({ sessions }: { sessions: AttendanceSession[] }) {
  if (!sessions.length) return <EmptyState>No attendance sessions recorded.</EmptyState>;
  return (
    <div className="staff-record-table-wrap">
      <table className="staff-record-table">
        <thead><tr><th>Date</th><th>Clock in</th><th>Clock out</th><th>Hours</th></tr></thead>
        <tbody>
          {sessions.map(session => (
            <tr key={session.id}>
              <td>{formatDate(session.startTime)}</td>
              <td>{formatDateTime(session.startTime)}</td>
              <td>{session.endTime ? formatDateTime(session.endTime) : "Active session"}</td>
              <td><strong>{formatHours(session.totalHours)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaveRows({ requests }: { requests: LeaveRequest[] }) {
  if (!requests.length) return <EmptyState>No leave requests recorded.</EmptyState>;
  return (
    <div className="staff-record-list">
      {requests.map(request => (
        <div className="staff-record-item" key={request.id}>
          <div>
            <strong>{titleCase(request.leaveType)} leave · {request.requestedDays} day{request.requestedDays === 1 ? "" : "s"}</strong>
            <span>{formatDate(request.startDate)} to {formatDate(request.endDate)} · {request.reason}</span>
          </div>
          <div className="staff-record-item-meta">
            <span className={`record-badge record-${request.status.toLowerCase()}`}>{titleCase(request.status)}</span>
            <small>{request.reviewerName ? `Reviewed by ${request.reviewerName}` : "Awaiting review"}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function DsuRows({ logs }: { logs: DailyLog[] }) {
  if (!logs.length) return <EmptyState>No DSU submissions recorded.</EmptyState>;
  return (
    <div className="staff-dsu-list">
      {logs.map(log => (
        <article className="staff-dsu-entry" key={log.id}>
          <time>{formatDate(log.logDate)}</time>
          <div>
            <h3>{log.summary}</h3>
            {log.problemsFaced && <p><strong>Blockers:</strong> {log.problemsFaced}</p>}
          </div>
        </article>
      ))}
    </div>
  );
}

function FilterBar({
  from,
  to,
  onFrom,
  onTo,
  children,
}: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="staff-toolbar-controls" style={{ justifyContent: "flex-start", marginBottom: "16px" }}>
      <label>From <input type="date" value={from} onChange={event => onFrom(event.target.value)} /></label>
      <label>To <input type="date" value={to} onChange={event => onTo(event.target.value)} /></label>
      <button type="button" className="btn-secondary" onClick={() => { onFrom(""); onTo(""); }}>Clear dates</button>
      {children}
    </div>
  );
}

function DocumentRows({ documents, onDelete }: { documents: StaffDocument[]; onDelete: (document: StaffDocument) => void }) {
  if (!documents.length) return <EmptyState>No staff documents uploaded.</EmptyState>;
  return (
    <div className="staff-document-list">
      {documents.map(document => (
        <article className="staff-document-item" key={document.id}>
          <div>
            <span className="staff-document-type">{titleCase(document.documentType)}</span>
            <h3>{document.fileName}</h3>
            <p>{formatDateTime(document.createdAt)}</p>
            {document.note && <p>{document.note}</p>}
          </div>
          <div className="staff-document-actions">
            <a href={document.fileUrl} target="_blank" rel="noreferrer">Open file</a>
            <button type="button" onClick={() => onDelete(document)}>Remove</button>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function StaffRecordPage() {
  const { loading: authLoading } = useAuth(["ADMIN"]);
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [record, setRecord] = useState<StaffOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [taskStatusFilter, setTaskStatusFilter] = useState("ALL");
  const [taskFrom, setTaskFrom] = useState("");
  const [taskTo, setTaskTo] = useState("");
  const [attendanceFrom, setAttendanceFrom] = useState("");
  const [attendanceTo, setAttendanceTo] = useState("");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [dsuFrom, setDsuFrom] = useState("");
  const [dsuTo, setDsuTo] = useState("");
  const [documentType, setDocumentType] = useState<StaffDocumentType>("CONTRACT");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentFileKey, setDocumentFileKey] = useState(0);
  const [documentNote, setDocumentNote] = useState("");
  const [documentUploadStep, setDocumentUploadStep] = useState<"idle" | "uploading" | "saving">("idle");
  const [savingDocument, setSavingDocument] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    const staffId = Number(params.id);
    if (!Number.isInteger(staffId)) {
      setLoading(false);
      return;
    }
    getStaffOverview(staffId)
      .then(setRecord)
      .catch(error => toast.error(error instanceof Error ? error.message : "Failed to load staff records"))
      .finally(() => setLoading(false));
  }, [authLoading, params.id, toast]);

  const completionRate = useMemo(() => {
    if (!record?.summary.taskCount) return 0;
    return Math.round((record.summary.completedTaskCount / record.summary.taskCount) * 100);
  }, [record]);

  const taskStatuses = useMemo(() => Array.from(new Set(record?.tasks.map(task => task.status) ?? [])), [record]);
  const filteredTasks = useMemo(() => (record?.tasks ?? []).filter(task => {
    const matchesStatus = taskStatusFilter === "ALL" || task.status === taskStatusFilter;
    const matchesDate = !taskFrom && !taskTo ? true : isWithinDateRange(task.dueDate ?? task.createdAt, taskFrom, taskTo);
    return matchesStatus && matchesDate;
  }), [record, taskFrom, taskStatusFilter, taskTo]);
  const filteredAttendance = useMemo(() => (record?.attendanceSessions ?? []).filter(session => isWithinDateRange(session.startTime, attendanceFrom, attendanceTo)), [attendanceFrom, attendanceTo, record]);
  const filteredLeave = useMemo(() => (record?.leaveRequests ?? []).filter(request => (
    (!leaveFrom || request.endDate >= leaveFrom) && (!leaveTo || request.startDate <= leaveTo)
  )), [leaveFrom, leaveTo, record]);
  const filteredDsu = useMemo(() => (record?.dailyLogs ?? []).filter(log => isWithinDateRange(log.logDate, dsuFrom, dsuTo)), [dsuFrom, dsuTo, record]);
  const blockedTasks = useMemo(() => (record?.tasks ?? []).filter(task => task.status === "BLOCKED"), [record]);
  const activeTasks = useMemo(() => (record?.tasks ?? []).filter(task => task.status !== "DONE"), [record]);
  const activityTimeline = useMemo(() => {
    if (!record) return [];
    const today = new Date().toISOString().slice(0, 10);
    const hasAttendanceToday = record.attendanceSessions.some(session => session.startTime.slice(0, 10) === today);
    return [
      ...(!hasAttendanceToday && record.staff.active ? [{
        id: "attendance-missed-today",
        date: new Date().toISOString(),
        title: "Attendance not recorded today",
        detail: "No clock-in session is available for today.",
      }] : []),
      ...record.projects.map(project => ({
        id: `project-${project.id}`,
        date: project.createdAt,
        title: `Joined project: ${project.name}`,
        detail: `${titleCase(project.status)} · ${project.managerName}`,
      })),
      ...record.tasks.map(task => ({
        id: `task-${task.id}`,
        date: task.createdAt,
        title: `Task assigned: ${task.title}`,
        detail: `${task.projectName} · ${titleCase(task.status)}`,
      })),
      ...record.leaveRequests.filter(request => request.reviewedAt).map(request => ({
        id: `leave-${request.id}`,
        date: request.reviewedAt ?? request.createdAt,
        title: `Leave ${titleCase(request.status)}`,
        detail: `${formatDate(request.startDate)} to ${formatDate(request.endDate)}`,
      })),
      ...record.dailyLogs.map(log => ({
        id: `dsu-${log.id}`,
        date: log.createdAt,
        title: "DSU submitted",
        detail: log.problemsFaced ? `Blocker: ${log.problemsFaced}` : log.summary,
      })),
      ...record.attendanceSessions.map(session => ({
        id: `attendance-${session.id}`,
        date: session.startTime,
        title: session.endTime ? "Attendance recorded" : "Attendance active",
        detail: `${formatDateTime(session.startTime)} · ${formatHours(session.totalHours)}`,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 12);
  }, [record]);

  async function refreshRecord() {
    const staffId = Number(params.id);
    const nextRecord = await getStaffOverview(staffId);
    setRecord(nextRecord);
  }

  async function handleDocumentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || !documentFile) {
      toast.error("Choose a document to upload.");
      return;
    }
    if (documentFile.size > 10 * 1024 * 1024) {
      toast.error("Document must be 10 MB or smaller.");
      return;
    }
    setSavingDocument(true);
    try {
      setDocumentUploadStep("uploading");
      const upload = await uploadFile(documentFile);
      setDocumentUploadStep("saving");
      await addStaffDocument(record.staff.id, {
        documentType,
        fileName: documentFile.name,
        fileUrl: upload.url,
        note: documentNote,
      });
      setDocumentFile(null);
      setDocumentFileKey(key => key + 1);
      setDocumentNote("");
      setDocumentType("CONTRACT");
      toast.success("Document added to staff record.");
      await refreshRecord();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add document");
    } finally {
      setSavingDocument(false);
      setDocumentUploadStep("idle");
    }
  }

  async function handleDeleteDocument(document: StaffDocument) {
    if (!record) return;
    try {
      await deleteStaffDocument(record.staff.id, document.id);
      toast.success("Document removed.");
      await refreshRecord();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove document");
    }
  }

  async function handleCsvExport() {
    if (!record) return;
    setExporting(true);
    try {
      await downloadExport(`staff/${record.staff.id}`, `staff-record-${record.staff.id}.csv`);
      toast.success("Staff CSV exported.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Staff export failed");
    } finally {
      setExporting(false);
    }
  }

  if (authLoading || loading) return <div className="staff-record-state">Loading staff records...</div>;
  if (!record) return (
    <div className="staff-record-state">
      <h1>Staff record unavailable</h1>
      <Link href="/users">Return to staff management</Link>
    </div>
  );

  const { staff, summary } = record;

  return (
    <div className="staff-record-page">
      <Link href="/users" className="staff-record-back">← Staff management</Link>

      <header className="staff-record-header">
        <div className="staff-record-identity">
          <span className="staff-record-avatar">
            {staff.profilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={staff.profilePhotoUrl} alt="" />
            ) : initials(staff.fullName)}
          </span>
          <div>
            <div className="staff-record-name-line">
              <h1>{staff.fullName}</h1>
              <span className={`staff-status ${staff.active ? "active" : "inactive"}`}><i aria-hidden="true" />{staff.active ? "Active" : "Inactive"}</span>
            </div>
            <p>{staff.jobTitle || "Job title not assigned"} · {titleCase(staff.role)}</p>
            <a href={`mailto:${staff.email}`}>{staff.email}</a>
            <p>{staff.employeeId || "No employee ID"} · {titleCase(staff.employmentType)} · {staff.accountStatus ? titleCase(staff.accountStatus) : "Unknown setup status"}</p>
          </div>
        </div>
        <div className="staff-row-actions">
          <button type="button" onClick={() => void handleCsvExport()} disabled={exporting}>{exporting ? "Exporting..." : "Export CSV"}</button>
          <button type="button" onClick={() => window.print()}>Export PDF</button>
        </div>
      </header>

      <nav className="staff-record-tabs" aria-label="Staff record sections">
        {tabs.map(tab => (
          <button type="button" key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
            <span>{tab.id === "projects" ? record.projects.length
              : tab.id === "tasks" ? record.tasks.length
              : tab.id === "attendance" ? record.attendanceSessions.length
              : tab.id === "leave" ? record.leaveRequests.length
              : tab.id === "dsu" ? record.dailyLogs.length
              : tab.id === "documents" ? record.documents.length
              : tab.id === "audit" ? record.auditEvents.length
              : ""}</span>
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <div className="staff-overview">
          <section className="staff-overview-metrics" aria-label="Staff record summary">
            <div><span>Active projects</span><strong>{summary.activeProjectCount}</strong><small>{summary.projectCount} total involved</small></div>
            <div><span>Active tasks</span><strong>{activeTasks.length}</strong><small>{blockedTasks.length} blocked</small></div>
            <div><span>Task completion</span><strong>{completionRate}%</strong><small>{summary.completedTaskCount} of {summary.taskCount} completed</small></div>
            <div><span>Attendance · 30 days</span><strong>{Number(summary.attendanceHoursLast30Days).toFixed(1)}h</strong><small>Across {summary.attendanceDaysLast30Days} working days</small></div>
            <div><span>Approved leave · {new Date().getFullYear()}</span><strong>{summary.approvedLeaveDaysThisYear}</strong><small>{summary.pendingLeaveRequests} pending request{summary.pendingLeaveRequests === 1 ? "" : "s"}</small></div>
          </section>

          <section className="staff-overview-grid">
            <div className="staff-record-section">
              <div className="staff-record-section-head"><div><h2>Current work</h2><p>Projects and assigned tasks</p></div><button type="button" onClick={() => setActiveTab("tasks")}>View tasks</button></div>
              <ProjectRows projects={record.projects.filter(project => project.status !== "COMPLETED").slice(0, 4)} />
            </div>
            <aside className="staff-overview-side">
              <div>
                <span>Overdue tasks</span>
                <strong className={summary.overdueTaskCount ? "attention" : ""}>{summary.overdueTaskCount}</strong>
              </div>
              <div>
                <span>Last attendance</span>
                <strong>{formatDate(summary.lastAttendanceAt)}</strong>
              </div>
              <div>
                <span>Last login</span>
                <strong>{formatLastLogin(staff.lastLoginAt)}</strong>
              </div>
              <div>
                <span>Latest DSU</span>
                <strong>{formatDate(summary.latestDailyLogDate)}</strong>
              </div>
              <div>
                <span>Total DSUs</span>
                <strong>{summary.dailyLogCount}</strong>
              </div>
              <div>
                <span>Documents</span>
                <strong>{record.documents.length}</strong>
              </div>
            </aside>
          </section>

          <section className="staff-record-section">
            <div className="staff-record-section-head"><div><h2>Recent DSU updates</h2><p>Latest submitted work summaries and blockers</p></div><button type="button" onClick={() => setActiveTab("dsu")}>View all DSUs</button></div>
            <DsuRows logs={record.dailyLogs.slice(0, 3)} />
          </section>

          <section className="staff-record-section">
            <div className="staff-record-section-head"><div><h2>Recent activity</h2><p>Projects, tasks, leave, DSUs, and attendance activity</p></div></div>
            <div className="staff-record-list">
              {activityTimeline.map(item => (
                <div className="staff-record-item" key={item.id}>
                  <div><strong>{item.title}</strong><span>{item.detail}</span></div>
                  <div className="staff-record-item-meta"><small>{formatDateTime(item.date)}</small></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === "projects" && <section className="staff-record-section"><div className="staff-record-section-head"><div><h2>Project involvement</h2><p>Projects assigned to or managed by this staff member</p></div></div><ProjectRows projects={record.projects} /></section>}
      {activeTab === "tasks" && <section className="staff-record-section"><div className="staff-record-section-head"><div><h2>Assigned tasks</h2><p>Complete task history across projects</p></div></div><FilterBar from={taskFrom} to={taskTo} onFrom={setTaskFrom} onTo={setTaskTo}><select value={taskStatusFilter} onChange={event => setTaskStatusFilter(event.target.value)}><option value="ALL">All statuses</option>{taskStatuses.map(status => <option key={status} value={status}>{titleCase(status)}</option>)}</select></FilterBar><TaskRows tasks={filteredTasks} /></section>}
      {activeTab === "attendance" && <section className="staff-record-section"><div className="staff-record-section-head"><div><h2>Attendance sessions</h2><p>Clock-in, clock-out, and recorded working hours</p></div></div><FilterBar from={attendanceFrom} to={attendanceTo} onFrom={setAttendanceFrom} onTo={setAttendanceTo} /><AttendanceRows sessions={filteredAttendance} /></section>}
      {activeTab === "leave" && <section className="staff-record-section"><div className="staff-record-section-head"><div><h2>Leave history</h2><p>Requested dates, decisions, and reviewers</p></div></div><FilterBar from={leaveFrom} to={leaveTo} onFrom={setLeaveFrom} onTo={setLeaveTo} /><LeaveRows requests={filteredLeave} /></section>}
      {activeTab === "dsu" && <section className="staff-record-section"><div className="staff-record-section-head"><div><h2>Daily stand-up updates</h2><p>Submitted summaries and reported blockers</p></div></div><FilterBar from={dsuFrom} to={dsuTo} onFrom={setDsuFrom} onTo={setDsuTo} /><DsuRows logs={filteredDsu} /></section>}
      {activeTab === "documents" && (
        <section className="staff-record-section">
          <div className="staff-record-section-head">
            <div>
              <h2>Documents</h2>
              <p>Contracts, ID proof, resumes, offer letters, certificates, and custom HR notes.</p>
            </div>
          </div>
          <div className="staff-documents-layout">
            <form className="staff-document-uploader" onSubmit={handleDocumentSubmit}>
              <div>
                <h3>Add document</h3>
                <p>Upload a staff file and add context for future HR review.</p>
              </div>
              <label>
                <span>Document type</span>
                <select value={documentType} onChange={event => setDocumentType(event.target.value as StaffDocumentType)}>
                  {documentTypes.map(type => <option key={type} value={type}>{titleCase(type)}</option>)}
                </select>
              </label>
              <label className="staff-file-picker">
                <span>File</span>
                <input
                  key={documentFileKey}
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                  onChange={event => setDocumentFile(event.target.files?.[0] ?? null)}
                />
                <small>{documentFile ? `${documentFile.name} · ${formatBytes(documentFile.size)}` : "PDF, Word, image, or text file up to 10 MB"}</small>
              </label>
              <label>
                <span>Note</span>
                <textarea
                  value={documentNote}
                  onChange={event => setDocumentNote(event.target.value)}
                  rows={4}
                  placeholder="Example: Switched from intern to full-time employee, completion certificate attached."
                />
              </label>
              <button type="submit" className="btn-primary" disabled={savingDocument}>
                {documentUploadStep === "uploading" ? "Uploading file..."
                  : documentUploadStep === "saving" ? "Saving record..."
                    : "Add document"}
              </button>
            </form>
            <div className="staff-document-library">
              <div>
                <h3>Document library</h3>
                <p>{record.documents.length} saved {record.documents.length === 1 ? "document" : "documents"}</p>
              </div>
              <DocumentRows documents={record.documents} onDelete={document => void handleDeleteDocument(document)} />
            </div>
          </div>
        </section>
      )}
      {activeTab === "audit" && <section className="staff-record-section"><div className="staff-record-section-head"><div><h2>Audit log</h2><p>Admin changes, deactivations, and document actions</p></div></div><div className="staff-record-list">{record.auditEvents.length === 0 ? <EmptyState>No audit events recorded.</EmptyState> : record.auditEvents.map(event => <div className="staff-record-item" key={event.id}><div><strong>{titleCase(event.action)}</strong><span>{event.description}</span></div><div className="staff-record-item-meta"><small>{event.actorName} · {formatDateTime(event.createdAt)}</small></div></div>)}</div></section>}
    </div>
  );
}
