"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createProject,
  createTask,
  getAllTasks,
  getAllAttendanceSessions,
  getMyTasks,
  getProjects,
  getUsers,
  Project,
  ProjectStatus,
  Task,
  TaskPriority,
  TaskStatus,
  updateTaskStatus,
  User,
  AttendanceSession,
} from "@/lib/api";
import { useToast } from "@/lib/toast";

const taskStatusOptions: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];
const taskPriorityOptions: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const projectStatusOptions: ProjectStatus[] = ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED"];

type StoredUser = {
  fullName: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
};

export default function DashboardPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [teamTasks, setTeamTasks] = useState<Task[]>([]);
  const [activeSessions, setActiveSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectManagerId, setProjectManagerId] = useState<number | "">("");
  const [projectTeamIds, setProjectTeamIds] = useState<number[]>([]);
  const [projectClientNotes, setProjectClientNotes] = useState("");
  const [projectInternalNotes, setProjectInternalNotes] = useState("");
  const [projectBudget, setProjectBudget] = useState("");
  const [projectDocumentUrl, setProjectDocumentUrl] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskProjectId, setTaskProjectId] = useState<number | "">("");
  const [taskAssigneeId, setTaskAssigneeId] = useState<number | "">("");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("MEDIUM");

  const authUser = useMemo(() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("auth_user");
    if (!raw) return null;
    try { return JSON.parse(raw) as StoredUser; } catch { return null; }
  }, []);

  const canManage = authUser?.role === "ADMIN" || authUser?.role === "MANAGER";
  const isAdmin = authUser?.role === "ADMIN";

  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const visibleTasks = canManage ? teamTasks : myTasks;
    return {
      totalEmployees: users.filter(u => u.role === "EMPLOYEE").length,
      totalManagers: users.filter(u => u.role === "MANAGER").length,
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === "ACTIVE").length,
      myActiveTasks: myTasks.filter(t => t.status !== "DONE").length,
      overdueTasks: visibleTasks.filter(t =>
        t.status !== "DONE" && t.dueDate && t.dueDate < today
      ).length,
    };
  }, [canManage, users, projects, myTasks, teamTasks]);

  const insights = useMemo(() => {
    const visibleTasks = canManage ? teamTasks : myTasks;
    const taskStatusBreakdown = taskStatusOptions.map(status => ({
      label: status.replace("_", " "),
      value: visibleTasks.filter(task => task.status === status).length,
    }));
    const projectStatusBreakdown = projectStatusOptions.map(status => ({
      label: status.replace("_", " "),
      value: projects.filter(project => project.status === status).length,
    }));
    const workload = users
      .filter(user => user.role === "EMPLOYEE")
      .map(user => ({
        id: user.id,
        name: user.fullName,
        activeTasks: teamTasks.filter(task => task.assignedToId === user.id && task.status !== "DONE").length,
      }))
      .sort((a, b) => b.activeTasks - a.activeTasks)
      .slice(0, 5);

    return {
      taskStatusBreakdown,
      projectStatusBreakdown,
      workload,
      maxTaskCount: Math.max(...taskStatusBreakdown.map(item => item.value), 1),
      maxProjectCount: Math.max(...projectStatusBreakdown.map(item => item.value), 1),
      maxWorkloadCount: Math.max(...workload.map(item => item.activeTasks), 1),
    };
  }, [canManage, myTasks, projects, teamTasks, users]);

  const projectTeamMembers = useMemo(() => {
    const assignableUsers = users.filter(user => user.role === "EMPLOYEE" || user.role === "MANAGER");
    if (!taskProjectId) return assignableUsers;
    const project = projects.find(p => p.id === Number(taskProjectId));
    if (!project) {
      return assignableUsers;
    }
    const projectManager = assignableUsers.find(user => user.id === project.managerId);
    const assignedMembers = project.assignedEmployees ?? [];
    const members = [
      ...(projectManager ? [projectManager] : []),
      ...assignedMembers,
    ];
    return Array.from(new Map(members.map(member => [member.id, member])).values());
  }, [taskProjectId, projects, users]);

  async function loadData() {
    setLoading(true);
    try {
      const [projectList, taskList] = await Promise.all([getProjects(), getMyTasks()]);
      setProjects(projectList);
      setMyTasks(taskList);
      if (canManage) {
        const [userList, attendanceList, taskListAll] = await Promise.all([getUsers(), getAllAttendanceSessions(), getAllTasks()]);
        setUsers(userList);
        setActiveSessions(attendanceList.filter(s => s.endTime === null));
        setTeamTasks(taskListAll);
      } else {
        setTeamTasks(taskList);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectManagerId) return;
    const budgetParsed = projectBudget.trim() === "" ? undefined : parseFloat(projectBudget);
    if (budgetParsed !== undefined && Number.isNaN(budgetParsed)) {
      toast.error("Budget must be a valid number.");
      return;
    }
    try {
      await createProject({ 
        name: projectName, 
        description: projectDescription, 
        managerId: Number(projectManagerId),
        assignedEmployeeIds: projectTeamIds,
        clientNotes: projectClientNotes,
        internalNotes: projectInternalNotes || undefined,
        documentUrl: projectDocumentUrl,
        budgetAmount: budgetParsed,
      });
      setProjectName(""); 
      setProjectDescription(""); 
      setProjectManagerId("");
      setProjectTeamIds([]);
      setProjectClientNotes("");
      setProjectInternalNotes("");
      setProjectBudget("");
      setProjectDocumentUrl("");
      toast.success("Project created.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create project");
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskProjectId || !taskAssigneeId) return;
    try {
      await createTask({ title: taskTitle, description: taskDescription, priority: taskPriority, projectId: Number(taskProjectId), assignedToId: Number(taskAssigneeId) });
      setTaskTitle(""); setTaskDescription(""); setTaskProjectId(""); setTaskAssigneeId(""); setTaskPriority("MEDIUM");
      toast.success("Task created.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create task");
    }
  }

  async function handleStatusChange(taskId: number, status: TaskStatus) {
    try {
      await updateTaskStatus(taskId, status);
      toast.success("Task status updated.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    }
  }

  const getStatusBadgeClass = (status: string) => {
    if (status === "TODO") return "badge-todo";
    if (status === "IN_PROGRESS") return "badge-in-progress";
    if (status === "DONE") return "badge-done";
    if (status === "BLOCKED") return "badge-blocked";
    return "";
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>Loading dashboard...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 style={{ fontSize: "1.8rem" }}>{isAdmin ? "Admin Console" : "Dashboard Overview"}</h1>
          <p className="text-muted mt-2">Welcome back, {authUser?.fullName}. Here&apos;s the latest status.</p>
        </div>
      </div>

      {/* Overview Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "32px" }}>
        {isAdmin && (
          <>
            <div className="glass-card" style={{ padding: "20px", textAlign: "center" }}>
              <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Total Staff</div>
              <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "var(--primary-color)" }}>{stats.totalEmployees + stats.totalManagers}</div>
            </div>
            <div className="glass-card" style={{ padding: "20px", textAlign: "center" }}>
              <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Active Projects</div>
              <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "var(--success-color)" }}>{stats.activeProjects}</div>
            </div>
          </>
        )}
        {!isAdmin && (
          <div className="glass-card" style={{ padding: "20px", textAlign: "center" }}>
            <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "8px" }}>My Pending Tasks</div>
            <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#c4b5fd" }}>{stats.myActiveTasks}</div>
          </div>
        )}
        {stats.overdueTasks > 0 && (
          <div className="glass-card" style={{ padding: "20px", textAlign: "center", borderLeft: "4px solid var(--danger-color)" }}>
            <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Overdue Tasks</div>
            <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "var(--danger-color)" }}>{stats.overdueTasks}</div>
          </div>
        )}
        <div className="glass-card" style={{ padding: "20px", textAlign: "center" }}>
          <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "8px" }}>System Status</div>
          <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "var(--success-color)" }}>Online</div>
        </div>
        {canManage && (
          <div className="glass-card" style={{ padding: "20px", textAlign: "center", borderLeft: "4px solid var(--success-color)" }}>
            <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Team Presence</div>
            <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#86efac" }}>{activeSessions.length} Active</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px" }}>
              {activeSessions.map(s => s.userFullName).join(", ") || "No one active"}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px", marginBottom: "32px" }}>
        <div className="glass-card" style={{ padding: "20px" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "16px" }}>Task Status</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {insights.taskStatusBreakdown.map(item => (
              <div key={item.label}>
                <div className="flex justify-between items-center" style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  <span>{item.label}</span>
                  <strong style={{ color: "var(--text-primary)" }}>{item.value}</strong>
                </div>
                <div style={{ height: "8px", borderRadius: "999px", background: "rgba(148, 163, 184, 0.14)", overflow: "hidden" }}>
                  <div style={{ width: `${(item.value / insights.maxTaskCount) * 100}%`, height: "100%", borderRadius: "999px", background: "var(--primary-color)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card" style={{ padding: "20px" }}>
          <h2 style={{ fontSize: "1.05rem", marginBottom: "16px" }}>Project Status</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {insights.projectStatusBreakdown.map(item => (
              <div key={item.label}>
                <div className="flex justify-between items-center" style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                  <span>{item.label}</span>
                  <strong style={{ color: "var(--text-primary)" }}>{item.value}</strong>
                </div>
                <div style={{ height: "8px", borderRadius: "999px", background: "rgba(148, 163, 184, 0.14)", overflow: "hidden" }}>
                  <div style={{ width: `${(item.value / insights.maxProjectCount) * 100}%`, height: "100%", borderRadius: "999px", background: "var(--success-color)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {canManage && (
          <div className="glass-card" style={{ padding: "20px" }}>
            <h2 style={{ fontSize: "1.05rem", marginBottom: "16px" }}>Team Workload</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {insights.workload.map(member => (
                <div key={member.id}>
                  <div className="flex justify-between items-center" style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>
                    <span>{member.name}</span>
                    <strong style={{ color: "var(--text-primary)" }}>{member.activeTasks}</strong>
                  </div>
                  <div style={{ height: "8px", borderRadius: "999px", background: "rgba(148, 163, 184, 0.14)", overflow: "hidden" }}>
                    <div style={{ width: `${(member.activeTasks / insights.maxWorkloadCount) * 100}%`, height: "100%", borderRadius: "999px", background: "#38bdf8" }} />
                  </div>
                </div>
              ))}
              {insights.workload.length === 0 && <p className="text-muted text-sm">No employee workload data available.</p>}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "24px" }}>
        
        {/* Projects Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="glass-card">
            <h2 style={{ fontSize: "1.2rem", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>📁</span> {isAdmin ? "All Projects" : "Active Projects"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {projects.map(project => (
                <div key={project.id} style={{ background: "rgba(15, 23, 42, 0.4)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                  <div className="flex justify-between items-center mb-2">
                    <h3 style={{ fontSize: "1rem" }}>{project.name}</h3>
                    <span className={`badge ${getStatusBadgeClass(project.status)}`}>{project.status}</span>
                  </div>
                  
                  {project.assignedEmployees && project.assignedEmployees.length > 0 && (
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "8px" }}>
                      Team: {project.assignedEmployees.map(e => e.fullName).join(", ")}
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-4">
                    <span className="text-muted text-xs">Manager: {project.managerName}</span>
                    {project.documentUrl && (
                      <a href={project.documentUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.75rem", color: "var(--accent-color)", textDecoration: "none" }}>
                        📄 View Docs
                      </a>
                    )}
                  </div>
                  
                  {project.clientNotes && (
                    <div style={{ marginTop: "12px", padding: "8px", background: "rgba(255,255,255,0.03)", borderRadius: "4px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      <strong>Notes:</strong> {project.clientNotes}
                    </div>
                  )}
                </div>
              ))}
              {projects.length === 0 && <p className="text-muted text-sm">No projects available.</p>}
            </div>
          </div>

          {canManage && (
            <div className="glass-card">
              <h2 style={{ fontSize: "1.2rem", marginBottom: "16px" }}>Create Project</h2>
              <form onSubmit={handleCreateProject} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <input placeholder="Project Name" value={projectName} onChange={e => setProjectName(e.target.value)} required />
                <textarea placeholder="Description" value={projectDescription} onChange={e => setProjectDescription(e.target.value)} rows={2} />
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <select value={projectManagerId} onChange={e => setProjectManagerId(e.target.value ? Number(e.target.value) : "")} required>
                    <option value="">Select Manager</option>
                    {users.filter(u => u.role === "MANAGER").map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                  </select>
                  <div style={{ position: "relative" }}>
                    <select 
                      multiple 
                      value={projectTeamIds.map(String)} 
                      onChange={e => setProjectTeamIds(Array.from(e.target.selectedOptions, option => Number(option.value)))}
                      style={{ height: "80px", width: "100%", padding: "8px" }}
                    >
                      {users.filter(u => u.role === "EMPLOYEE").map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                    </select>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>Hold Cmd/Ctrl to select multiple team members</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <input placeholder="Document URL (e.g. Google Drive)" value={projectDocumentUrl} onChange={e => setProjectDocumentUrl(e.target.value)} />
                  <input type="number" min={0} step="0.01" placeholder="Total budget USD (optional)" value={projectBudget} onChange={e => setProjectBudget(e.target.value)} />
                </div>
                <textarea placeholder="Client-facing notes" value={projectClientNotes} onChange={e => setProjectClientNotes(e.target.value)} rows={2} />
                <textarea placeholder="Internal notes (team only)" value={projectInternalNotes} onChange={e => setProjectInternalNotes(e.target.value)} rows={2} />

                <button type="submit" className="btn-primary mt-2">Create Project</button>
              </form>
            </div>
          )}
        </div>

        {/* Tasks Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {!isAdmin && (
            <div className="glass-card">
              <h2 style={{ fontSize: "1.2rem", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>✅</span> My Tasks
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {myTasks.map(task => (
                  <div key={task.id} style={{ background: "rgba(15, 23, 42, 0.4)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 style={{ fontSize: "1rem" }}>{task.title}</h3>
                      <span className={`badge`} style={{ background: "rgba(139, 92, 246, 0.15)", color: "#c4b5fd" }}>{task.priority}</span>
                    </div>
                    <p className="text-muted text-sm mb-4">Project: {task.projectName}</p>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Status:</span>
                      <select 
                        value={task.status} 
                        onChange={e => handleStatusChange(task.id, e.target.value as TaskStatus)}
                        style={{ padding: "6px 10px", fontSize: "0.85rem", flex: 1 }}
                      >
                        {taskStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                {myTasks.length === 0 && <p className="text-muted text-sm">No tasks assigned.</p>}
              </div>
            </div>
          )}

          {canManage && (
            <div className="glass-card">
              <h2 style={{ fontSize: "1.2rem", marginBottom: "16px" }}>Assign Task</h2>
              <form onSubmit={handleCreateTask} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <input placeholder="Task Title" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} required />
                <textarea placeholder="Description" value={taskDescription} onChange={e => setTaskDescription(e.target.value)} rows={2} />
                <select value={taskProjectId} onChange={e => setTaskProjectId(e.target.value ? Number(e.target.value) : "")} required>
                  <option value="">Select Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={taskAssigneeId} onChange={e => setTaskAssigneeId(e.target.value ? Number(e.target.value) : "")} required>
                  <option value="">Select Assignee</option>
                  {projectTeamMembers.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
                <select value={taskPriority} onChange={e => setTaskPriority(e.target.value as TaskPriority)}>
                  {taskPriorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <button type="submit" className="btn-primary mt-4">Assign Task</button>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
