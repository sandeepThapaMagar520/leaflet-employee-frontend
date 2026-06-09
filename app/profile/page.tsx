"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AttendanceSession,
  changePassword,
  DailyLog,
  getAllAttendanceSessions,
  getAllDailyLogs,
  getAllTasks,
  getMyAttendanceSessions,
  getMyDailyLogs,
  getMyTasks,
  getProjects,
  Project,
  Task,
} from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import { useToast } from "@/lib/toast";

function formatHours(hours: number) {
  return `${hours.toFixed(2)} hrs`;
}

function initials(name: string) {
  return name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function ProfilePage() {
  const { loading: authLoading, user } = useAuth(["ADMIN", "MANAGER", "EMPLOYEE"]);
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSession[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";

  useEffect(() => {
    if (authLoading || !user) return;

    async function loadProfile() {
      setLoading(true);
      setFeedback("");
      try {
        const [projectList, taskList, attendanceList, logList] = await Promise.all([
          getProjects(),
          canManage ? getAllTasks() : getMyTasks(),
          canManage ? getAllAttendanceSessions() : getMyAttendanceSessions(),
          canManage ? getAllDailyLogs() : getMyDailyLogs(),
        ]);
        setProjects(projectList);
        setTasks(taskList);
        setAttendance(attendanceList);
        setLogs(logList);
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [authLoading, canManage, user]);

  const profileStats = useMemo(() => {
    const userAttendance = canManage
      ? attendance.filter(session => session.userId === user?.userId)
      : attendance;
    const userLogs = canManage
      ? logs.filter(log => log.userId === user?.userId)
      : logs;
    const userTasks = canManage
      ? tasks.filter(task => task.assignedToId === user?.userId)
      : tasks;
    const activeTasks = userTasks.filter(task => task.status !== "DONE").length;
    const completedTasks = userTasks.filter(task => task.status === "DONE").length;
    const totalHours = userAttendance.reduce((sum, session) => sum + Number(session.totalHours ?? 0), 0);

    return {
      activeTasks,
      completedTasks,
      totalHours,
      logCount: userLogs.length,
      recentLogs: userLogs.slice(0, 4),
      recentAttendance: userAttendance.slice(0, 5),
      userTasks,
    };
  }, [attendance, canManage, logs, tasks, user?.userId]);

  const assignedProjects = useMemo(() => {
    if (!user) return [];
    if (user.role === "ADMIN") return projects;
    if (user.role === "MANAGER") return projects.filter(project => project.managerId === user.userId);
    return projects.filter(project => project.assignedEmployees?.some(employee => employee.id === user.userId));
  }, [projects, user]);

  async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  }

  if (authLoading || loading) {
    return <div className="p-8">Loading profile...</div>;
  }

  if (!user) {
    return <div className="p-8">Profile unavailable.</div>;
  }

  return (
    <div>
      <div className="glass-panel" style={{ padding: "32px", marginBottom: "28px" }}>
        <div className="flex items-center gap-5 flex-wrap">
          <div style={{
            width: "84px",
            height: "84px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--primary-color), var(--accent-color))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.7rem",
            fontWeight: 800,
          }}>
            {initials(user.fullName)}
          </div>
          <div style={{ flex: 1, minWidth: "240px" }}>
            <h1 className="text-gradient" style={{ fontSize: "2rem", marginBottom: "6px" }}>{user.fullName}</h1>
            <p className="text-muted">{user.email}</p>
            <div className="flex gap-2 mt-3">
              <span className="badge badge-in-progress">{user.role}</span>
              <span className="badge badge-done">Active</span>
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger-color)", padding: "12px", borderRadius: "8px", marginBottom: "24px" }}>
          {feedback}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        {[
          ["Assigned Projects", assignedProjects.length],
          ["Active Tasks", profileStats.activeTasks],
          ["Completed Tasks", profileStats.completedTasks],
          ["Logged Hours", formatHours(profileStats.totalHours)],
          ["Daily Logs", profileStats.logCount],
        ].map(([label, value]) => (
          <div key={label} className="glass-card" style={{ padding: "18px" }}>
            <div className="text-sm text-muted mb-2">{label}</div>
            <div style={{ fontSize: "1.45rem", fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 380px)", gap: "24px" }}>
        <div className="glass-card">
          <h2 style={{ fontSize: "1.2rem", marginBottom: "18px" }}>Current Work</h2>
          <div style={{ display: "grid", gap: "12px" }}>
            {profileStats.userTasks.slice(0, 6).map(task => (
              <div key={task.id} style={{ padding: "14px", background: "rgba(15,23,42,0.35)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div style={{ fontWeight: 600 }}>{task.title}</div>
                    <div className="text-xs text-muted mt-1">{task.projectName}</div>
                  </div>
                  <span className="badge badge-todo">{task.status.replace("_", " ")}</span>
                </div>
              </div>
            ))}
            {profileStats.userTasks.length === 0 && <p className="text-muted">No tasks assigned yet.</p>}
          </div>
        </div>

        <div style={{ display: "grid", gap: "24px" }}>
          <div className="glass-card">
            <h2 style={{ fontSize: "1.05rem", marginBottom: "14px" }}>Security</h2>
            <form onSubmit={handlePasswordChange} style={{ display: "grid", gap: "12px" }}>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                required
              />
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="New password"
                minLength={8}
                required
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                minLength={8}
                required
              />
              <button type="submit" className="btn-primary" disabled={savingPassword}>
                {savingPassword ? "Saving..." : "Change Password"}
              </button>
            </form>
          </div>

          <div className="glass-card">
            <h2 style={{ fontSize: "1.05rem", marginBottom: "14px" }}>Recent Attendance</h2>
            <div style={{ display: "grid", gap: "10px" }}>
              {profileStats.recentAttendance.map(session => (
                <div key={session.id} className="flex justify-between text-sm">
                  <span>{new Date(session.startTime).toLocaleDateString()}</span>
                  <span className="text-muted">{session.totalHours ? formatHours(Number(session.totalHours)) : "Active"}</span>
                </div>
              ))}
              {profileStats.recentAttendance.length === 0 && <p className="text-sm text-muted">No attendance sessions yet.</p>}
            </div>
          </div>

          <div className="glass-card">
            <h2 style={{ fontSize: "1.05rem", marginBottom: "14px" }}>Recent Logs</h2>
            <div style={{ display: "grid", gap: "12px" }}>
              {profileStats.recentLogs.map(log => (
                <div key={log.id}>
                  <div className="text-xs text-muted mb-1">{new Date(log.logDate).toLocaleDateString()}</div>
                  <p className="text-sm" style={{ lineHeight: 1.45 }}>{log.summary}</p>
                </div>
              ))}
              {profileStats.recentLogs.length === 0 && <p className="text-sm text-muted">No daily logs yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
