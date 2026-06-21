"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AttendanceSession,
  changePassword,
  DailyLog,
  getAllAttendanceSessions,
  getAllDailyLogs,
  getAllTasks,
  getMyAttendanceSessions,
  getMyDailyLogs,
  getMyProfile,
  getMyTasks,
  getNotificationPreferences,
  getProjects,
  NotificationPreferences,
  Profile,
  Project,
  requestEmailChange,
  requestPasswordReset,
  resendVerificationEmail,
  Task,
  updateMyProfile,
  updateNotificationPreferences,
  uploadFile,
  verifyEmailChange,
} from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import { useToast } from "@/lib/toast";

type Tab = "personal" | "security" | "preferences" | "work";

const BASE_TABS: { id: Tab; label: string; description: string }[] = [
  { id: "personal", label: "Personal details", description: "Identity and contact information" },
  { id: "security", label: "Security", description: "Password and account access" },
  { id: "preferences", label: "Notifications", description: "Email delivery preferences" },
];

function formatHours(hours: number) {
  return `${hours.toFixed(2)} hrs`;
}

function initials(name: string) {
  return name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

function titleCase(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase());
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "personal";
  const { loading: authLoading, user } = useAuth(["ADMIN", "MANAGER", "EMPLOYEE"]);
  const toast = useToast();

  const [tab, setTab] = useState<Tab>(initialTab);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSession[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [resending, setResending] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [location, setLocation] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kathmandu");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailChangePending, setEmailChangePending] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [recoveringPassword, setRecoveringPassword] = useState(false);

  const canManage = user?.role === "ADMIN" || user?.role === "MANAGER";
  const hasWorkSummary = user?.role === "EMPLOYEE" || user?.role === "MANAGER";
  const tabs = useMemo(
    () => hasWorkSummary
      ? [...BASE_TABS, { id: "work" as const, label: "Work summary", description: "Tasks, hours, and recent activity" }]
      : BASE_TABS,
    [hasWorkSummary]
  );

  useEffect(() => {
    const requested = searchParams.get("tab") as Tab | null;
    if (requested && tabs.some(t => t.id === requested)) {
      setTab(requested);
    } else if (requested === "work" && !hasWorkSummary) {
      setTab("personal");
    }
  }, [hasWorkSummary, searchParams, tabs]);

  useEffect(() => {
    if (authLoading || !user) return;

    async function load() {
      setLoading(true);
      try {
        const profilePromise = getMyProfile();
        const preferencesPromise = getNotificationPreferences();
        const workPromise = hasWorkSummary
          ? Promise.all([
              getProjects(),
              user.role === "MANAGER" ? getAllTasks() : getMyTasks(),
              user.role === "MANAGER" ? getAllAttendanceSessions() : getMyAttendanceSessions(),
              user.role === "MANAGER" ? getAllDailyLogs() : getMyDailyLogs(),
            ])
          : Promise.resolve<[Project[], Task[], AttendanceSession[], DailyLog[]]>([[], [], [], []]);
        const [profileData, prefsData, [projectList, taskList, attendanceList, logList]] = await Promise.all([
          profilePromise,
          preferencesPromise,
          workPromise,
        ]);
        setProfile(profileData);
        setPrefs(prefsData);
        setProjects(projectList);
        setTasks(taskList);
        setAttendance(attendanceList);
        setLogs(logList);
        setFullName(profileData.fullName);
        setPhone(profileData.phone ?? "");
        setEmergencyContact(profileData.emergencyContact ?? "");
        setLocation(profileData.location ?? "");
        setTimezone(profileData.timezone ?? "Asia/Kathmandu");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [authLoading, hasWorkSummary, toast, user]);

  const profileStats = useMemo(() => {
    if (!user || !hasWorkSummary) return null;
    const userAttendance = canManage
      ? attendance.filter(session => session.userId === user.userId)
      : attendance;
    const userLogs = canManage ? logs.filter(log => log.userId === user.userId) : logs;
    const userTasks = canManage
      ? tasks.filter(task => task.assignedToId === user.userId)
      : tasks;

    return {
      activeTasks: userTasks.filter(task => task.status !== "DONE").length,
      completedTasks: userTasks.filter(task => task.status === "DONE").length,
      totalHours: userAttendance.reduce((sum, session) => sum + Number(session.totalHours ?? 0), 0),
      logCount: userLogs.length,
      recentLogs: userLogs.slice(0, 4),
      recentAttendance: userAttendance.slice(0, 5),
      userTasks,
    };
  }, [attendance, canManage, hasWorkSummary, logs, tasks, user]);

  const assignedProjects = useMemo(() => {
    if (!user) return [];
    if (user.role === "ADMIN") return projects;
    if (user.role === "MANAGER") return projects.filter(project => project.managerId === user.userId);
    return projects.filter(project => project.assignedEmployees?.some(employee => employee.id === user.userId));
  }, [projects, user]);

  async function handleSaveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await updateMyProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        emergencyContact: emergencyContact.trim(),
        location: location.trim(),
        timezone: timezone.trim(),
      });
      setProfile(updated);
      const raw = localStorage.getItem("auth_user");
      if (raw) {
        const stored = JSON.parse(raw);
        localStorage.setItem("auth_user", JSON.stringify({ ...stored, fullName: updated.fullName }));
      }
      toast.success("Profile updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const uploaded = await uploadFile(file);
      const updated = await updateMyProfile({ profilePhotoUrl: uploaded.url });
      setProfile(updated);
      const raw = localStorage.getItem("auth_user");
      if (raw) {
        const stored = JSON.parse(raw);
        localStorage.setItem("auth_user", JSON.stringify({ ...stored, profilePhotoUrl: updated.profilePhotoUrl }));
      }
      toast.success("Profile photo updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
      event.target.value = "";
    }
  }

  async function handlePasswordChange(event: React.FormEvent) {
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
      const refreshed = await getMyProfile();
      setProfile(refreshed);
      toast.success("Password changed successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleResendVerification() {
    setResending(true);
    try {
      await resendVerificationEmail();
      toast.success("Verification email sent. Check your inbox.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend verification email");
    } finally {
      setResending(false);
    }
  }

  async function handleEmailChangeRequest(event: React.FormEvent) {
    event.preventDefault();
    setSavingEmail(true);
    try {
      const result = await requestEmailChange(newEmail);
      setEmailChangePending(true);
      setEmailOtp("");
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send email verification OTP");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleEmailChangeVerify(event: React.FormEvent) {
    event.preventDefault();
    setSavingEmail(true);
    try {
      const result = await verifyEmailChange(emailOtp);
      localStorage.setItem("access_token", result.accessToken);
      localStorage.setItem("auth_user", JSON.stringify(result));
      setProfile(current => current ? { ...current, email: result.email, emailVerified: true } : current);
      setNewEmail("");
      setEmailOtp("");
      setEmailChangePending(false);
      toast.success("Email changed and verified.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to verify email OTP");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleForgotPassword() {
    if (!profile) return;
    const email = profile.email;
    setRecoveringPassword(true);
    try {
      await requestPasswordReset(email);
      toast.success("Password reset OTP sent. Check your inbox.");
      router.push(`/reset-password?email=${encodeURIComponent(email)}&mode=forgot`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send password reset OTP");
      setRecoveringPassword(false);
    }
  }

  async function handlePrefChange(key: keyof NotificationPreferences, value: boolean) {
    if (!prefs) return;
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      const saved = await updateNotificationPreferences({ [key]: value });
      setPrefs(saved);
      toast.success("Notification preference updated.");
    } catch (error) {
      setPrefs(previous);
      toast.error(error instanceof Error ? error.message : "Failed to update preferences");
    }
  }

  if (authLoading || loading || !profile || (hasWorkSummary && !profileStats)) {
    return <div className="p-8">Loading profile...</div>;
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div className="profile-avatar">
          {profile.profilePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.profilePhotoUrl} alt={profile.fullName} />
          ) : (
            initials(profile.fullName)
          )}
        </div>
        <div className="profile-identity">
          <div className="profile-title-row">
            <div>
              <p className="profile-eyebrow">Account settings</p>
              <h1>{profile.fullName}</h1>
              <p>{profile.email}</p>
            </div>
            <div className="profile-badges">
              <span className="badge badge-in-progress">{profile.role}</span>
              <span className={`badge ${profile.active ? "badge-done" : "badge-blocked"}`}>
                {profile.active ? "Active" : "Inactive"}
              </span>
              <span className={`badge ${profile.emailVerified ? "badge-done" : "badge-todo"}`}>
                {profile.emailVerified ? "Email verified" : "Email unverified"}
              </span>
            </div>
          </div>
          <div className="profile-header-meta">
            <div>
              <span>Job title</span>
              <strong>{profile.jobTitle || "Not set"}</strong>
            </div>
            <div>
              <span>Department</span>
              <strong>{profile.department || "Not set"}</strong>
            </div>
            <div>
              <span>Location</span>
              <strong>{profile.location || "Not set"}</strong>
            </div>
          </div>
        </div>
      </header>

      {profile.mustChangePassword && tab !== "security" && (
        <div className="profile-alert">
          <div>
            <strong>Password update required</strong>
            <p>Your administrator requires you to change your password before continuing.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={() => setTab("security")}>
            Open security
          </button>
        </div>
      )}

      <div className="profile-layout">
        <nav className="profile-nav" aria-label="Profile settings">
          {tabs.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={tab === item.id ? "active" : ""}
              aria-current={tab === item.id ? "page" : undefined}
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </button>
          ))}
        </nav>

        <div className="profile-content">
          {tab === "personal" && (
            <section className="profile-section">
              <div className="profile-section-heading">
                <div>
                  <h2>Personal details</h2>
                  <p>Keep your contact and workplace information current.</p>
                </div>
              </div>

              <div className="profile-photo-row">
                <div className="profile-photo-preview">
                  {profile.profilePhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.profilePhotoUrl} alt={profile.fullName} />
                  ) : (
                    initials(profile.fullName)
                  )}
                </div>
                <div>
                  <strong>Profile photo</strong>
                  <p className="text-sm text-muted">Use a clear square image. JPG or PNG works best.</p>
                  <label className="btn-secondary profile-upload-button" htmlFor="profile-photo">
                    {uploadingPhoto ? "Uploading..." : "Choose photo"}
                  </label>
                  <input
                    id="profile-photo"
                    className="profile-file-input"
                    type="file"
                    accept="image/*"
                    onChange={e => void handlePhotoUpload(e)}
                    disabled={uploadingPhoto}
                  />
                </div>
              </div>

              <form onSubmit={handleSaveProfile}>
                <div className="profile-form-grid">
                  <label>
                    <span>Full name</span>
                    <input value={fullName} onChange={e => setFullName(e.target.value)} required />
                  </label>
                  <label>
                    <span>Email address</span>
                    <input value={profile.email} disabled />
                  </label>
                  <label>
                    <span>Phone number</span>
                    <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+977 98XXXXXXXX" />
                  </label>
                  <label>
                    <span>Emergency contact</span>
                    <input value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="Name / phone number" />
                  </label>
                  <label>
                    <span>Current location</span>
                    <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Kathmandu" />
                  </label>
                  <label>
                    <span>Timezone</span>
                    <input value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="Asia/Kathmandu" required />
                  </label>
                </div>
                <div className="profile-form-actions">
                  <button type="submit" className="btn-primary" disabled={savingProfile}>
                    {savingProfile ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>

              <div className="profile-divider" />
              <div className="profile-section-heading compact">
                <div>
                  <h3>Employment details</h3>
                  <p>These records are managed by an administrator.</p>
                </div>
              </div>
              <div className="profile-form-grid profile-readonly-grid">
                <label><span>Employee ID</span><input value={profile.employeeId || "Not set"} disabled /></label>
                <label><span>Joining date</span><input value={profile.joiningDate || "Not set"} disabled /></label>
                <label><span>Employment type</span><input value={titleCase(profile.employmentType)} disabled /></label>
                <label><span>Department</span><input value={profile.department || "Not set"} disabled /></label>
                <label><span>Job title</span><input value={profile.jobTitle || "Not set"} disabled /></label>
              </div>
            </section>
          )}

          {tab === "security" && (
            <section className="profile-section">
              <div className="profile-section-heading">
                <div>
                  <h2>Security</h2>
                  <p>Review account access and update your password.</p>
                </div>
              </div>

              <div className="profile-status-grid">
                <div>
                  <span>Email verification</span>
                  <strong>{profile.emailVerified ? "Verified" : "Not verified"}</strong>
                </div>
                <div>
                  <span>Account status</span>
                  <strong>{profile.active ? "Active" : "Inactive"}</strong>
                </div>
                <div>
                  <span>Last login</span>
                  <strong>{formatDateTime(profile.lastLoginAt)}</strong>
                </div>
                <div>
                  <span>Password changed</span>
                  <strong>{formatDateTime(profile.passwordChangedAt)}</strong>
                </div>
              </div>

              {!profile.emailVerified && (
                <button type="button" className="btn-secondary" onClick={() => void handleResendVerification()} disabled={resending}>
                  {resending ? "Sending..." : "Resend verification email"}
                </button>
              )}

              <div className="profile-divider" />

              <div className="profile-section-heading compact">
                <div>
                  <h3>Change email address</h3>
                  <p>Your new email will only be saved after you verify the OTP sent to it.</p>
                </div>
              </div>
              {!emailChangePending ? (
                <form onSubmit={handleEmailChangeRequest} className="profile-password-form">
                  <label>
                    <span>Current email</span>
                    <input type="email" value={profile.email} disabled />
                  </label>
                  <label>
                    <span>New email address</span>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={event => setNewEmail(event.target.value)}
                      required
                      autoComplete="email"
                      placeholder="new.email@company.com"
                    />
                  </label>
                  <div className="profile-form-actions">
                    <button type="submit" className="btn-secondary" disabled={savingEmail}>
                      {savingEmail ? "Sending..." : "Send verification OTP"}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleEmailChangeVerify} className="profile-password-form">
                  <label>
                    <span>OTP sent to {newEmail}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={emailOtp}
                      onChange={event => setEmailOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      autoComplete="one-time-code"
                      placeholder="000000"
                    />
                  </label>
                  <div className="profile-inline-actions">
                    <button type="submit" className="btn-primary" disabled={savingEmail || emailOtp.length !== 6}>
                      {savingEmail ? "Verifying..." : "Verify and change email"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setEmailChangePending(false);
                        setEmailOtp("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="profile-divider" />

              <div className="profile-section-heading compact">
                <div>
                  <h3>Change password</h3>
                  <p>Use this option when you know your current password.</p>
                </div>
              </div>
              <form onSubmit={handlePasswordChange} className="profile-password-form">
                <label>
                  <span>Current password</span>
                  <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
                </label>
                <label>
                  <span>New password</span>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
                </label>
                <label>
                  <span>Confirm new password</span>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
                </label>
                <div className="profile-form-actions">
                  <button type="submit" className="btn-primary" disabled={savingPassword}>
                    {savingPassword ? "Saving..." : "Change password"}
                  </button>
                </div>
              </form>

              <div className="profile-recovery">
                <div>
                  <strong>Forgot your current password?</strong>
                  <p>We will send a verification OTP to {profile.email} before you can create a new password.</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => void handleForgotPassword()} disabled={recoveringPassword}>
                  {recoveringPassword ? "Sending..." : "Reset with email OTP"}
                </button>
              </div>
            </section>
          )}

          {tab === "preferences" && prefs && (
            <section className="profile-section">
              <div className="profile-section-heading">
                <div>
                  <h2>Email notifications</h2>
                  <p>Choose which updates should also be delivered to your inbox.</p>
                </div>
                <span className="profile-muted-chip">In-app alerts stay on</span>
              </div>
              <div className="profile-preferences">
                {([
                  ["emailTaskAssigned", "Task assignments", "When a task is assigned to you"],
                  ["emailTaskCompleted", "Task completion", "When work is marked as completed"],
                  ["emailTaskCommented", "Task comments", "When someone comments on a task"],
                  ["emailTaskDueSoon", "Due soon", "Reminders before a task reaches its due date"],
                  ["emailTaskOverdue", "Overdue tasks", "Alerts when a task passes its due date"],
                  ["emailProjectAssigned", "Project assignments", "When you are added to a project"],
                  ["emailLeaveUpdates", "Leave updates", "Decisions and changes to leave requests"],
                ] as const).map(([key, label, description]) => (
                  <label key={key}>
                    <span>
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={prefs[key]}
                      onChange={e => void handlePrefChange(key, e.target.checked)}
                    />
                  </label>
                ))}
              </div>
            </section>
          )}

          {tab === "work" && hasWorkSummary && profileStats && (
            <section className="profile-work">
              <div className="profile-section-heading">
                <div>
                  <h2>Work summary</h2>
                  <p>Your current workload and recent activity.</p>
                </div>
              </div>

              <div className="profile-stat-grid">
                {[
                  ["Assigned projects", assignedProjects.length],
                  ["Active tasks", profileStats.activeTasks],
                  ["Completed tasks", profileStats.completedTasks],
                  ["Logged hours", formatHours(profileStats.totalHours)],
                  ["Daily logs", profileStats.logCount],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>

              <div className="profile-work-grid">
                <section className="profile-section">
                  <div className="profile-section-heading compact">
                    <h3>Current work</h3>
                  </div>
                  <div className="profile-task-list">
                    {profileStats.userTasks.slice(0, 6).map(task => (
                      <div key={task.id}>
                        <span>
                          <strong>{task.title}</strong>
                          <small>{task.projectName}</small>
                        </span>
                        <span className="badge badge-todo">{task.status.replace("_", " ")}</span>
                      </div>
                    ))}
                    {profileStats.userTasks.length === 0 && <p className="text-muted">No tasks assigned yet.</p>}
                  </div>
                </section>

                <div className="profile-work-aside">
                  <section className="profile-section">
                    <div className="profile-section-heading compact">
                      <h3>Recent attendance</h3>
                    </div>
                    <div className="profile-activity-list">
                      {profileStats.recentAttendance.map(session => (
                        <div key={session.id}>
                          <span>{new Date(session.startTime).toLocaleDateString()}</span>
                          <strong>{session.totalHours ? formatHours(Number(session.totalHours)) : "Active"}</strong>
                        </div>
                      ))}
                      {profileStats.recentAttendance.length === 0 && <p className="text-sm text-muted">No attendance sessions yet.</p>}
                    </div>
                  </section>

                  <section className="profile-section">
                    <div className="profile-section-heading compact">
                      <h3>Recent logs</h3>
                    </div>
                    <div className="profile-log-list">
                      {profileStats.recentLogs.map(log => (
                        <div key={log.id}>
                          <small>{new Date(log.logDate).toLocaleDateString()}</small>
                          <p>{log.summary}</p>
                        </div>
                      ))}
                      {profileStats.recentLogs.length === 0 && <p className="text-sm text-muted">No daily logs yet.</p>}
                    </div>
                  </section>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
