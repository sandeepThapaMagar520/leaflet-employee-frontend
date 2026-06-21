"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AttendanceDaySummary,
  DailyLog,
  getAllDailyLogs,
  getAllTasks,
  getLeaveRequests,
  getMyTasks,
  getProjects,
  getTeamDailyAttendanceSummary,
  getUsers,
  LeaveRequest,
  Project,
  Task,
  User,
} from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import { useToast } from "@/lib/toast";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function titleCase(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase());
}

function formatDueDate(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default function DashboardPage() {
  const toast = useToast();
  const { loading: authLoading, user } = useAuth(["ADMIN", "MANAGER", "EMPLOYEE"]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendance, setAttendance] = useState<AttendanceDaySummary[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";
  const isAdmin = user?.role === "ADMIN";
  const today = localDateKey();

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [projectList, taskList] = await Promise.all([
        getProjects(),
        canManage ? getAllTasks() : getMyTasks(),
      ]);
      setProjects(projectList);
      setTasks(taskList);

      if (canManage) {
        const [userList, attendanceList, logList, leaveList] = await Promise.all([
          getUsers(),
          getTeamDailyAttendanceSummary(today),
          getAllDailyLogs(),
          getLeaveRequests(),
        ]);
        setUsers(userList);
        setAttendance(attendanceList);
        setLogs(logList);
        setLeaveRequests(leaveList);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [canManage, toast, today, user]);

  useEffect(() => {
    if (!authLoading) void loadData();
  }, [authLoading, loadData]);

  const dashboard = useMemo(() => {
    const activeTasks = tasks.filter(task => task.status !== "DONE");
    const overdueTasks = activeTasks.filter(task => task.dueDate && task.dueDate < today);
    const blockedTasks = activeTasks.filter(task => task.status === "BLOCKED");
    const activeProjects = projects.filter(project => project.status === "ACTIVE");
    const pendingLeave = leaveRequests.filter(request => request.status === "PENDING");
    const eligibleStaff = users.filter(member => member.active && member.role !== "ADMIN");
    const submittedToday = new Set(logs.filter(log => log.logDate === today).map(log => log.userId));
    const missingLogs = eligibleStaff.filter(member => !submittedToday.has(member.id));
    const absentToday = attendance.filter(day => day.status === "NO_ACTIVITY");
    const activeNow = attendance.filter(day => day.status === "IN_PROGRESS");
    const pendingOnboarding = users.filter(member => member.active && member.role !== "ADMIN" && member.accountStatus !== "VERIFIED");

    const atRiskTasks = [...activeTasks]
      .filter(task => task.status === "BLOCKED" || (task.dueDate && task.dueDate < today))
      .sort((a, b) => {
        if (a.status === "BLOCKED" && b.status !== "BLOCKED") return -1;
        if (b.status === "BLOCKED" && a.status !== "BLOCKED") return 1;
        return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
      })
      .slice(0, 6);

    const workload = eligibleStaff
      .map(member => ({
        id: member.id,
        name: member.fullName,
        count: activeTasks.filter(task => task.assignedToId === member.id).length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      activeTasks,
      overdueTasks,
      blockedTasks,
      activeProjects,
      pendingLeave,
      missingLogs,
      absentToday,
      activeNow,
      pendingOnboarding,
      atRiskTasks,
      workload,
      eligibleStaff,
    };
  }, [attendance, leaveRequests, logs, projects, tasks, today, users]);

  if (authLoading || loading) {
    return (
      <div className="dashboard-loading" aria-live="polite">
        <span />
        <p>Preparing your workspace...</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="operations-dashboard">
        <header className="dashboard-heading">
          <div><p className="dashboard-eyebrow">My workspace</p><h1>Good to see you, {user?.fullName}</h1><p>Your current projects, priorities, and deadlines.</p></div>
        </header>
        <section className="dashboard-metrics" aria-label="Personal work summary">
          <Link href="/tasks"><span>Active tasks</span><strong>{dashboard.activeTasks.length}</strong><small>Assigned to you</small></Link>
          <Link href="/tasks"><span>Overdue</span><strong className={dashboard.overdueTasks.length ? "danger" : ""}>{dashboard.overdueTasks.length}</strong><small>Needs attention</small></Link>
          <Link href="/tasks"><span>Blocked</span><strong className={dashboard.blockedTasks.length ? "warning" : ""}>{dashboard.blockedTasks.length}</strong><small>Waiting for help</small></Link>
          <Link href="/projects"><span>Projects</span><strong>{projects.length}</strong><small>Your assigned work</small></Link>
        </section>
        <section className="dashboard-two-column">
          <div className="dashboard-panel">
            <div className="dashboard-panel-head"><div><h2>Priority tasks</h2><p>Blocked and overdue work first</p></div><Link href="/tasks">View all</Link></div>
            <TaskRiskList tasks={dashboard.atRiskTasks.length ? dashboard.atRiskTasks : dashboard.activeTasks.slice(0, 6)} today={today} />
          </div>
          <div className="dashboard-panel">
            <div className="dashboard-panel-head"><div><h2>My projects</h2><p>Current project involvement</p></div><Link href="/projects">View all</Link></div>
            <ProjectHealthList projects={projects.slice(0, 6)} />
          </div>
        </section>
      </div>
    );
  }

  const attentionItems = [
    { label: "Overdue tasks", value: dashboard.overdueTasks.length, detail: "Past their due date", href: "/tasks", tone: "danger" },
    { label: "Blocked tasks", value: dashboard.blockedTasks.length, detail: "Waiting for intervention", href: "/tasks", tone: "warning" },
    { label: "Missing attendance", value: dashboard.absentToday.length, detail: "No activity today", href: "/attendance", tone: "neutral" },
    { label: "Missing daily logs", value: dashboard.missingLogs.length, detail: "Not submitted today", href: "/logs", tone: "neutral" },
    { label: "Pending leave", value: dashboard.pendingLeave.length, detail: "Awaiting review", href: "/leave", tone: "neutral" },
    ...(isAdmin ? [{ label: "Pending onboarding", value: dashboard.pendingOnboarding.length, detail: "Setup not completed", href: "/users", tone: "neutral" }] : []),
  ];

  return (
    <div className="operations-dashboard">
      <header className="dashboard-heading">
        <div>
          <p className="dashboard-eyebrow">Today · {new Intl.DateTimeFormat("en", { weekday: "long", day: "2-digit", month: "long" }).format(new Date())}</p>
          <h1>{isAdmin ? "Operations overview" : "Team overview"}</h1>
          <p>Review exceptions first, then move into the work that needs attention.</p>
        </div>
        <div className="dashboard-quick-actions">
          <Link href="/tasks/new" className="btn-secondary">New task</Link>
          <Link href="/projects/new" className="btn-primary">New project</Link>
        </div>
      </header>

      <section className="dashboard-metrics" aria-label="Operations summary">
        <Link href={isAdmin ? "/users" : "/attendance"}><span>Active staff</span><strong>{dashboard.eligibleStaff.length}</strong><small>{dashboard.activeNow.length} working now</small></Link>
        <Link href="/projects"><span>Active projects</span><strong>{dashboard.activeProjects.length}</strong><small>{projects.length} total projects</small></Link>
        <Link href="/tasks"><span>Active tasks</span><strong>{dashboard.activeTasks.length}</strong><small>{tasks.length} total tasks</small></Link>
        <Link href="/leave"><span>Pending approvals</span><strong className={dashboard.pendingLeave.length ? "warning" : ""}>{dashboard.pendingLeave.length}</strong><small>Leave requests</small></Link>
      </section>

      <section className="dashboard-panel dashboard-attention">
        <div className="dashboard-panel-head"><div><h2>Needs attention</h2><p>Live exceptions across today&apos;s operations</p></div></div>
        <div className="dashboard-attention-grid">
          {attentionItems.map(item => (
            <Link href={item.href} key={item.label} className={`dashboard-attention-item ${item.tone}`}>
              <span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard-two-column">
        <div className="dashboard-panel">
          <div className="dashboard-panel-head"><div><h2>At-risk tasks</h2><p>Blocked and overdue work</p></div><Link href="/tasks">Open tasks</Link></div>
          <TaskRiskList tasks={dashboard.atRiskTasks} today={today} />
        </div>
        <div className="dashboard-panel">
          <div className="dashboard-panel-head"><div><h2>Project health</h2><p>Progress across current projects</p></div><Link href="/projects">Open projects</Link></div>
          <ProjectHealthList projects={projects.filter(project => project.status !== "COMPLETED").slice(0, 6)} />
        </div>
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel-head"><div><h2>Team workload</h2><p>Active task ownership across employees and managers</p></div><Link href="/tasks">Manage assignments</Link></div>
        <div className="dashboard-workload">
          {dashboard.workload.map(member => {
            const max = Math.max(...dashboard.workload.map(item => item.count), 1);
            return <div key={member.id}><span>{member.name}</span><div><i style={{ width: `${(member.count / max) * 100}%` }} /></div><strong>{member.count}</strong></div>;
          })}
          {dashboard.workload.length === 0 && <p className="dashboard-empty">No active assignments.</p>}
        </div>
      </section>
    </div>
  );
}

function TaskRiskList({ tasks, today }: { tasks: Task[]; today: string }) {
  if (!tasks.length) return <p className="dashboard-empty">No tasks need attention right now.</p>;
  return (
    <div className="dashboard-list">
      {tasks.map(task => {
        const overdue = Boolean(task.dueDate && task.dueDate < today && task.status !== "DONE");
        return (
          <Link href={`/projects/${task.projectId}`} key={task.id}>
            <div><strong>{task.title}</strong><span>{task.projectName} · {task.assignedToName || "Unassigned"}</span></div>
            <div className="dashboard-list-meta"><span className={`record-badge ${task.status === "BLOCKED" ? "record-blocked" : overdue ? "dashboard-overdue" : ""}`}>{task.status === "BLOCKED" ? "Blocked" : overdue ? "Overdue" : titleCase(task.status)}</span><small>{formatDueDate(task.dueDate)}</small></div>
          </Link>
        );
      })}
    </div>
  );
}

function ProjectHealthList({ projects }: { projects: Project[] }) {
  if (!projects.length) return <p className="dashboard-empty">No current projects.</p>;
  return (
    <div className="dashboard-list">
      {projects.map(project => (
        <Link href={`/projects/${project.id}`} key={project.id}>
          <div><strong>{project.name}</strong><span>{project.managerName || "No manager"} · {project.assignedEmployees?.length ?? 0} team members</span></div>
          <div className="dashboard-list-meta"><span>{project.progressPercentage ?? 0}%</span><small>{project.dueDate ? `Due ${formatDueDate(project.dueDate)}` : titleCase(project.status)}</small></div>
        </Link>
      ))}
    </div>
  );
}
