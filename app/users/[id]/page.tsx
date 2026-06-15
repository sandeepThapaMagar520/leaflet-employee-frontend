"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AttendanceSession,
  DailyLog,
  getStaffOverview,
  LeaveRequest,
  Project,
  StaffOverview,
  Task,
} from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import { useToast } from "@/lib/toast";

type Tab = "overview" | "projects" | "tasks" | "attendance" | "leave" | "dsu";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "projects", label: "Projects" },
  { id: "tasks", label: "Tasks" },
  { id: "attendance", label: "Attendance" },
  { id: "leave", label: "Leave" },
  { id: "dsu", label: "DSU" },
];

const initials = (name: string) => name.split(" ").filter(Boolean).map(part => part[0]).join("").slice(0, 2).toUpperCase();
const titleCase = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase());
const formatDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
  : "Not available";
const formatDateTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
  : "In progress";
const formatHours = (value: number | null) => value == null ? "Active" : `${Number(value).toFixed(2)}h`;

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

export default function StaffRecordPage() {
  const { loading: authLoading } = useAuth(["ADMIN"]);
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [record, setRecord] = useState<StaffOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

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
          </div>
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
              : ""}</span>
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <div className="staff-overview">
          <section className="staff-overview-metrics" aria-label="Staff record summary">
            <div><span>Active projects</span><strong>{summary.activeProjectCount}</strong><small>{summary.projectCount} total involved</small></div>
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
                <span>Latest DSU</span>
                <strong>{formatDate(summary.latestDailyLogDate)}</strong>
              </div>
              <div>
                <span>Total DSUs</span>
                <strong>{summary.dailyLogCount}</strong>
              </div>
            </aside>
          </section>

          <section className="staff-record-section">
            <div className="staff-record-section-head"><div><h2>Recent DSU updates</h2><p>Latest submitted work summaries and blockers</p></div><button type="button" onClick={() => setActiveTab("dsu")}>View all DSUs</button></div>
            <DsuRows logs={record.dailyLogs.slice(0, 3)} />
          </section>
        </div>
      )}

      {activeTab === "projects" && <section className="staff-record-section"><div className="staff-record-section-head"><div><h2>Project involvement</h2><p>Projects assigned to or managed by this staff member</p></div></div><ProjectRows projects={record.projects} /></section>}
      {activeTab === "tasks" && <section className="staff-record-section"><div className="staff-record-section-head"><div><h2>Assigned tasks</h2><p>Complete task history across projects</p></div></div><TaskRows tasks={record.tasks} /></section>}
      {activeTab === "attendance" && <section className="staff-record-section"><div className="staff-record-section-head"><div><h2>Attendance sessions</h2><p>Clock-in, clock-out, and recorded working hours</p></div></div><AttendanceRows sessions={record.attendanceSessions} /></section>}
      {activeTab === "leave" && <section className="staff-record-section"><div className="staff-record-section-head"><div><h2>Leave history</h2><p>Requested dates, decisions, and reviewers</p></div></div><LeaveRows requests={record.leaveRequests} /></section>}
      {activeTab === "dsu" && <section className="staff-record-section"><div className="staff-record-section-head"><div><h2>Daily stand-up updates</h2><p>Submitted summaries and reported blockers</p></div></div><DsuRows logs={record.dailyLogs} /></section>}
    </div>
  );
}
