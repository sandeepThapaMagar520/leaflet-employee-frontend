import { handleUnauthorized } from "./auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";

export type Role = "ADMIN" | "MANAGER" | "EMPLOYEE";
export type AccountStatus = "INVITE_SENT" | "SETUP_PENDING" | "VERIFIED";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACTOR" | "INTERN";
export type StaffDocumentType = "CONTRACT" | "ID_PROOF" | "RESUME" | "OFFER_LETTER" | "CERTIFICATE" | "OTHER";
export type StaffAuditAction = "REGISTERED" | "UPDATED" | "DEACTIVATED" | "DOCUMENT_ADDED" | "DOCUMENT_REMOVED";
export type TaskStatus = string;
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ProjectStatus = "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED";
export type ProjectNoteType = "TEAM" | "ADMIN_ONLY";
export type LeaveType = "ANNUAL" | "SICK" | "PERSONAL" | "UNPAID";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type LoginPayload = {
  email: string;
  password: string;
};

export type AuthResponse = {
  accessToken: string;
  tokenType: string;
  userId: number;
  fullName: string;
  email: string;
  role: Role;
  emailVerified?: boolean;
  mustChangePassword?: boolean;
  profilePhotoUrl?: string | null;
};

export type StaffRegistrationResponse = {
  userId: number;
  fullName: string;
  email: string;
  role: Role;
  message: string;
};

export type Profile = {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
  profilePhotoUrl: string | null;
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  timezone: string;
  emailVerified: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
};

export type NotificationPreferences = {
  emailTaskAssigned: boolean;
  emailTaskCompleted: boolean;
  emailTaskCommented: boolean;
  emailTaskDueSoon: boolean;
  emailTaskOverdue: boolean;
  emailProjectAssigned: boolean;
  emailLeaveUpdates: boolean;
};

export type User = {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
  jobTitle: string | null;
  profilePhotoUrl: string | null;
  employeeId: string | null;
  joiningDate: string | null;
  employmentType: EmploymentType;
  phone: string | null;
  emergencyContact: string | null;
  department: string | null;
  location: string | null;
  timezone: string;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type NotificationType =
  | "TASK_ASSIGNED"
  | "TASK_COMPLETED"
  | "TASK_COMMENTED"
  | "TASK_DUE_SOON"
  | "TASK_OVERDUE"
  | "PROJECT_ASSIGNED"
  | "SYSTEM";

export type Notification = {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export type Project = {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  dueDate: string | null;
  managerId: number;
  managerName: string;
  assignedEmployees: {
    id: number;
    fullName: string;
    canManageTasks: boolean;
    canAddNotes: boolean;
  }[];
  clientNotes: string | null;
  internalNotes: string | null;
  documentUrl: string | null;
  budgetAmount: number;
  totalPaid: number;
  lastPaymentAmount: number | null;
  lastPaymentAt: string | null;
  lastPaymentNote: string | null;
  progressPercentage: number;
  createdById: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectMilestone = {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectTaskBoard = {
  id: number;
  projectId: number;
  statusKey: TaskStatus;
  name: string;
  displayOrder: number;
  defaultBoard: boolean;
  terminal: boolean;
};

export type ProjectPayment = {
  id: number;
  amount: number;
  paidAt: string;
  referenceNote: string | null;
  recordedByName: string;
  attachments: PaymentAttachment[];
};

export type PaymentAttachment = {
  id?: number;
  fileUrl: string;
  fileName: string;
  fileType: string;
};

export type ProjectNote = {
  id: number;
  content: string;
  noteType: ProjectNoteType;
  createdByName: string;
  createdAt: string;
};

export type Task = {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  projectId: number;
  projectName: string;
  assignedToId: number;
  assignedToName: string;
  createdById: number;
  createdAt: string;
  updatedAt: string;
};

export type TaskComment = {
  id: number;
  taskId: number;
  userId: number;
  userFullName: string;
  content: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdAt: string;
};

export type LeaveRequest = {
  id: number;
  userId: number;
  userFullName: string;
  leaveType: LeaveType;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  requestedDays: number;
  reason: string;
  reviewerName: string | null;
  reviewerNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type StaffOverview = {
  staff: User;
  summary: {
    projectCount: number;
    activeProjectCount: number;
    taskCount: number;
    completedTaskCount: number;
    overdueTaskCount: number;
    attendanceHoursLast30Days: number;
    attendanceDaysLast30Days: number;
    lastAttendanceAt: string | null;
    approvedLeaveDaysThisYear: number;
    pendingLeaveRequests: number;
    dailyLogCount: number;
    latestDailyLogDate: string | null;
  };
  projects: Project[];
  tasks: Task[];
  attendanceSessions: AttendanceSession[];
  leaveRequests: LeaveRequest[];
  dailyLogs: DailyLog[];
  documents: StaffDocument[];
  auditEvents: StaffAuditEvent[];
};

export type StaffDocument = {
  id: number;
  documentType: StaffDocumentType;
  fileName: string;
  fileUrl: string;
  note: string | null;
  createdAt: string;
};

export type StaffAuditEvent = {
  id: number;
  action: StaffAuditAction;
  description: string;
  actorName: string;
  createdAt: string;
};

export type LeaveBalance = {
  annualAllowance: number;
  approvedDays: number;
  remainingDays: number;
};

type ErrorBody = {
  message?: string;
  errors?: Array<{ defaultMessage?: string; field?: string }>;
  error?: string;
};

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
}

function statusFallbackMessage(status: number, path: string): string {
  if (status === 401 && path.startsWith("/auth/login")) {
    return "Invalid email or password.";
  }
  if (status === 401) {
    return "Your session has expired or you are not signed in. Please log in again.";
  }
  switch (status) {
    case 400:
      return "The server could not process this request.";
    case 403:
      return "You do not have permission for this action.";
    case 404:
      return "The requested resource was not found.";
    case 409:
      return "This request conflicts with existing data.";
    case 429:
      return "Too many attempts. Please wait and try again.";
    case 500:
    case 502:
    case 503:
      return "The server is temporarily unavailable. Please try again later.";
    default:
      return "Something went wrong. Please try again.";
  }
}

async function readErrorMessage(response: Response, path: string): Promise<string> {
  const text = await response.text();
  if (!text.trim()) {
    return statusFallbackMessage(response.status, path);
  }
  try {
    const body = JSON.parse(text) as ErrorBody;
    if (typeof body.message === "string" && body.message.trim()) {
      return body.message.trim();
    }
    if (Array.isArray(body.errors) && body.errors.length > 0) {
      const first = body.errors[0];
      if (typeof first.defaultMessage === "string" && first.defaultMessage.trim()) {
        return first.defaultMessage.trim();
      }
    }
    if (typeof body.error === "string" && body.error.trim()) {
      return body.error.trim();
    }
  } catch {
    const trimmed = text.trim();
    if (trimmed.length > 0 && trimmed.length < 240) {
      return trimmed;
    }
  }
  return statusFallbackMessage(response.status, path);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(
        "Cannot reach the server. Start the backend (for example on port 8080) and confirm NEXT_PUBLIC_API_BASE_URL in .env.local matches your API."
      );
    }
    throw err;
  }

  if (!response.ok) {
    const isPublicAuthRequest = [
      "/auth/login",
      "/auth/start-account-setup",
      "/auth/verify-email",
      "/auth/forgot-password",
      "/auth/verify-password-otp",
      "/auth/set-password",
    ].some(publicPath => path.startsWith(publicPath));
    if (response.status === 401 && !isPublicAuthRequest) {
      handleUnauthorized();
    }
    const errorMessage = await readErrorMessage(response, path);
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text.trim()) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export async function login(payload: LoginPayload) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ ...payload, email: payload.email.trim() }),
  });
}

export async function changePassword(payload: { currentPassword: string; newPassword: string }) {
  await request<void>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function requestEmailChange(newEmail: string) {
  return request<{ message: string }>("/auth/change-email/request", {
    method: "POST",
    body: JSON.stringify({ newEmail: newEmail.trim() }),
  });
}

export async function verifyEmailChange(otp: string) {
  return request<AuthResponse>("/auth/change-email/verify", {
    method: "POST",
    body: JSON.stringify({ otp }),
  });
}

export async function requestPasswordReset(email: string) {
  return request<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: email.trim() }),
  });
}

export async function startAccountSetup(payload: { email: string; temporaryPassword: string }) {
  return request<{ message: string }>("/auth/start-account-setup", {
    method: "POST",
    body: JSON.stringify({ ...payload, email: payload.email.trim() }),
  });
}

export async function verifyPasswordOtp(payload: { email: string; otp: string }) {
  return request<{ resetToken: string; message: string }>("/auth/verify-password-otp", {
    method: "POST",
    body: JSON.stringify({ ...payload, email: payload.email.trim() }),
  });
}

export async function setPassword(payload: { resetToken: string; newPassword: string }) {
  return request<{ message: string }>("/auth/set-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyEmail(token: string) {
  return request<{ message: string }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function resendVerificationEmail() {
  return request<{ message: string }>("/auth/resend-verification", {
    method: "POST",
  });
}

export async function getMyProfile() {
  return request<Profile>("/users/me");
}

export async function updateMyProfile(payload: {
  fullName?: string;
  phone?: string;
  timezone?: string;
  profilePhotoUrl?: string;
}) {
  return request<Profile>("/users/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getNotificationPreferences() {
  return request<NotificationPreferences>("/users/me/notification-preferences");
}

export async function updateNotificationPreferences(payload: Partial<NotificationPreferences>) {
  return request<NotificationPreferences>("/users/me/notification-preferences", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getUsers() {
  return request<User[]>("/users");
}

export async function getUsersPaged(page = 0, size = 20, search = "") {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (search.trim()) params.set("search", search.trim());
  return request<PageResponse<User>>(`/users?${params.toString()}`);
}

export async function getStaffOverview(id: number) {
  return request<StaffOverview>(`/users/${id}/overview`);
}

export async function getProjectsPaged(page = 0, size = 20) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return request<PageResponse<Project>>(`/projects?${params.toString()}`);
}

export async function getAllTasksPaged(page = 0, size = 20) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return request<PageResponse<Task>>(`/tasks?${params.toString()}`);
}

export async function registerUser(payload: {
  fullName: string;
  email: string;
  role: Role;
  temporaryPassword: string;
  jobTitle: string;
  employeeId?: string;
  joiningDate?: string;
  employmentType?: EmploymentType;
  phone?: string;
  emergencyContact?: string;
  department?: string;
  location?: string;
}) {
  return request<StaffRegistrationResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ ...payload, email: payload.email.trim() }),
  });
}

export async function updateUser(
  id: number,
  payload: {
    fullName: string;
    email: string;
    role: Role;
    active: boolean;
    jobTitle: string;
    employeeId?: string;
    joiningDate?: string;
    employmentType: EmploymentType;
    phone?: string;
    emergencyContact?: string;
    department?: string;
    location?: string;
    timezone?: string;
  }
) {
  return request<User>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(id: number): Promise<void> {
  await request<void>(`/users/${id}`, { method: "DELETE" });
}

export async function addStaffDocument(
  userId: number,
  payload: { documentType: StaffDocumentType; fileName: string; fileUrl: string; note?: string }
) {
  return request<StaffDocument>(`/users/${userId}/documents`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteStaffDocument(userId: number, documentId: number): Promise<void> {
  await request<void>(`/users/${userId}/documents/${documentId}`, { method: "DELETE" });
}

export async function getProjects() {
  return request<Project[]>("/projects");
}

export async function getProject(projectId: number) {
  return request<Project>(`/projects/${projectId}`);
}

export async function createProject(payload: {
  name: string;
  description?: string;
  startDate?: string;
  dueDate?: string;
  managerId: number;
  assignedEmployeeIds?: number[];
  memberPermissions?: ProjectMemberPermission[];
  clientNotes?: string;
  documentUrl?: string;
  budgetAmount?: number;
  internalNotes?: string;
}) {
  return request<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMyTasks() {
  return request<Task[]>("/tasks/me");
}

export async function createTask(payload: {
  title: string;
  description?: string;
  priority: TaskPriority;
  dueDate?: string;
  projectId: number;
  assignedToId: number;
}) {
  return request<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTaskStatus(taskId: number, status: TaskStatus) {
  return request<Task>(`/tasks/${taskId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function getProjectTaskBoards(projectId: number) {
  return request<ProjectTaskBoard[]>(`/projects/${projectId}/task-boards`);
}

export async function createProjectTaskBoard(projectId: number, name: string) {
  return request<ProjectTaskBoard>(`/projects/${projectId}/task-boards`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function reorderProjectTaskBoards(projectId: number, boardIds: number[]) {
  return request<ProjectTaskBoard[]>(`/projects/${projectId}/task-boards/order`, {
    method: "PUT",
    body: JSON.stringify({ boardIds }),
  });
}

export async function deleteProject(projectId: number): Promise<void> {
  await request<void>(`/projects/${projectId}`, { method: "DELETE" });
}

export async function updateProject(projectId: number, payload: {
  name: string;
  description?: string;
  status: ProjectStatus;
  startDate?: string;
  dueDate?: string;
  managerId: number;
  assignedEmployeeIds?: number[];
  memberPermissions?: ProjectMemberPermission[];
  clientNotes?: string;
  documentUrl?: string;
  budgetAmount?: number;
  internalNotes?: string;
}) {
  return request<Project>(`/projects/${projectId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export type ProjectMemberPermission = {
  userId: number;
  canManageTasks: boolean;
  canAddNotes: boolean;
};

export async function getAllTasks() {
  return request<Task[]>("/tasks");
}

export async function getTasksByProject(projectId: number) {
  return request<Task[]>(`/tasks/project/${projectId}`);
}

export async function getProjectPayments(projectId: number) {
  return request<ProjectPayment[]>(`/projects/${projectId}/payments`);
}

export async function createProjectPayment(
  projectId: number,
  payload: {
    amount: number;
    paidAt: string;
    referenceNote?: string;
    attachments?: Array<Pick<PaymentAttachment, "fileUrl" | "fileName" | "fileType">>;
  }
) {
  return request<ProjectPayment>(`/projects/${projectId}/payments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProjectPaymentAttachments(
  projectId: number,
  paymentId: number,
  attachments: Array<Pick<PaymentAttachment, "fileUrl" | "fileName" | "fileType">>
) {
  return request<ProjectPayment>(`/projects/${projectId}/payments/${paymentId}/attachments`, {
    method: "PUT",
    body: JSON.stringify({ attachments }),
  });
}

export async function deleteTask(taskId: number): Promise<void> {
  await request<void>(`/tasks/${taskId}`, { method: "DELETE" });
}

export async function updateTask(taskId: number, payload: {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  assignedToId: number;
}) {
  return request<Task>(`/tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getTaskComments(taskId: number) {
  return request<TaskComment[]>(`/tasks/${taskId}/comments`);
}

export async function createTaskComment(
  taskId: number,
  payload: { content: string; attachmentUrl?: string; attachmentName?: string; mentionedUserIds?: number[] }
) {
  return request<TaskComment>(`/tasks/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Attendance
export type AttendanceSession = {
  id: number;
  userId: number;
  userFullName: string;
  startTime: string;
  endTime: string | null;
  totalHours: number | null;
};

export type AttendanceDayStatus =
  | "NO_ACTIVITY"
  | "IN_PROGRESS"
  | "UNDER_HOURS"
  | "COMPLETED_WITH_GRACE"
  | "COMPLETED";

export type AttendanceDaySummary = {
  userId: number;
  userFullName: string;
  workDate: string;
  firstStartTime: string | null;
  lastEndTime: string | null;
  activeSessionStartTime: string | null;
  totalMinutes: number;
  requiredMinutes: number;
  graceMinutes: number;
  remainingMinutes: number;
  status: AttendanceDayStatus;
};

export async function startAttendanceSession() {
  return request<AttendanceSession>("/attendance/start", { method: "POST" });
}

export async function endAttendanceSession() {
  return request<AttendanceSession>("/attendance/end", { method: "POST" });
}

export async function getMyAttendanceSessions() {
  return request<AttendanceSession[]>("/attendance/me");
}

export async function getAllAttendanceSessions() {
  return request<AttendanceSession[]>("/attendance");
}

export async function getMyTodayAttendanceSummary() {
  return request<AttendanceDaySummary>("/attendance/me/today");
}

export async function getTeamDailyAttendanceSummary(date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return request<AttendanceDaySummary[]>(`/attendance/daily${query}`);
}

export async function getActiveAttendanceSession() {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/attendance/active`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error("Failed to fetch active session");
  return (await response.json()) as AttendanceSession;
}

// Daily Logs
export type DailyLog = {
  id: number;
  userId: number;
  userFullName: string;
  logDate: string;
  summary: string;
  problemsFaced: string | null;
  createdAt: string;
};

export async function createDailyLog(payload: { logDate: string; summary: string; problemsFaced?: string; }) {
  return request<DailyLog>("/logs", { method: "POST", body: JSON.stringify(payload) });
}

export async function updateDailyLog(
  logId: number,
  payload: { logDate: string; summary: string; problemsFaced?: string; }
) {
  return request<DailyLog>(`/logs/${logId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getMyDailyLogs() {
  return request<DailyLog[]>("/logs/me");
}

export async function getAllDailyLogs() {
  return request<DailyLog[]>("/logs");
}

// Project Notes
export async function getProjectNotes(projectId: number, type?: ProjectNoteType) {
  const query = type ? `?type=${type}` : "";
  return request<ProjectNote[]>(`/projects/${projectId}/notes${query}`);
}

export async function createProjectNote(
  projectId: number,
  payload: { content: string; noteType: ProjectNoteType }
) {
  return request<ProjectNote>(`/projects/${projectId}/notes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteProjectNote(noteId: number): Promise<void> {
  await request<void>(`/projects/notes/${noteId}`, { method: "DELETE" });
}

export async function updateProjectNote(
  noteId: number,
  payload: { content: string; noteType: ProjectNoteType }
) {
  return request<ProjectNote>(`/projects/notes/${noteId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getProjectMilestones(projectId: number) {
  return request<ProjectMilestone[]>(`/projects/${projectId}/milestones`);
}

export async function createProjectMilestone(
  projectId: number,
  payload: { title: string; description?: string; dueDate?: string }
) {
  return request<ProjectMilestone>(`/projects/${projectId}/milestones`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function completeProjectMilestone(milestoneId: number) {
  return request<ProjectMilestone>(`/projects/milestones/${milestoneId}/complete`, { method: "PATCH" });
}

export async function reopenProjectMilestone(milestoneId: number) {
  return request<ProjectMilestone>(`/projects/milestones/${milestoneId}/reopen`, { method: "PATCH" });
}

export async function deleteProjectMilestone(milestoneId: number): Promise<void> {
  await request<void>(`/projects/milestones/${milestoneId}`, { method: "DELETE" });
}

export type UploadResponse = {
  url: string;
  publicId: string | null;
  resourceType: string;
  bytes: number;
};

export async function uploadFile(file: File): Promise<UploadResponse> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/uploads`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error("Cannot reach the server for file upload.");
    }
    throw err;
  }
  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized();
    }
    const errorMessage = await readErrorMessage(response, "/uploads");
    throw new Error(errorMessage);
  }
  return response.json() as Promise<UploadResponse>;
}

export async function getNotifications() {
  return request<Notification[]>("/notifications");
}

export async function getUnreadNotificationCount() {
  return request<{ count: number }>("/notifications/unread-count");
}

export async function markNotificationRead(id: number) {
  await request<void>(`/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead() {
  await request<void>("/notifications/read-all", { method: "PATCH" });
}

export async function downloadExport(
  type: "attendance" | "logs" | `staff/${number}`,
  filename: string,
  filters?: { from?: string; to?: string }
) {
  const token = getToken();
  const params = new URLSearchParams();
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${API_BASE_URL}/exports/${type}${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error("Your session has expired. Please log in again.");
  }
  if (!response.ok) {
    const errorMessage = await readErrorMessage(response, `/exports/${type}`);
    throw new Error(errorMessage);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function uploadToCloudinary(file: File): Promise<string> {
  try {
    const result = await uploadFile(file);
    return result.url;
  } catch (backendError) {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      throw backendError instanceof Error ? backendError : new Error("File upload failed.");
    }
    const resourceType = file.type.startsWith("image/") ? "image" : "raw";
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Cloudinary upload failed: ${err}`);
    }
    const data = await res.json() as { secure_url: string };
    return data.secure_url;
  }
}

export async function getLeaveRequests() {
  return request<LeaveRequest[]>("/leave-requests");
}

export async function getLeaveBalance() {
  return request<LeaveBalance>("/leave-requests/balance");
}

export async function createLeaveRequest(payload: {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}) {
  return request<LeaveRequest>("/leave-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function approveLeaveRequest(id: number, reviewerNote: string) {
  return request<LeaveRequest>(`/leave-requests/${id}/approve`, {
    method: "PATCH",
    body: JSON.stringify({ reviewerNote }),
  });
}

export async function rejectLeaveRequest(id: number, reviewerNote: string) {
  return request<LeaveRequest>(`/leave-requests/${id}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reviewerNote }),
  });
}

export async function cancelLeaveRequest(id: number) {
  return request<LeaveRequest>(`/leave-requests/${id}/cancel`, { method: "PATCH" });
}
