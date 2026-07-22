import { getAccessToken, handleUnauthorized } from "./auth";

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
export type LeaveType = "ANNUAL" | "SICK";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type UploadPurpose =
  | "PROFILE_IMAGE"
  | "PROJECT_ATTACHMENT"
  | "TASK_ATTACHMENT"
  | "PAYMENT_ATTACHMENT"
  | "HR_DOCUMENT";
export type MediaStatus =
  | "PENDING"
  | "QUARANTINED"
  | "VERIFIED"
  | "REJECTED"
  | "ATTACHED"
  | "DELETED";
export type MediaScanningStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "CLEAN"
  | "STRUCTURE_VALIDATED"
  | "MALWARE_DETECTED"
  | "FAILED"
  | "UNAVAILABLE";

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
  notificationDeliveryStatus: "QUEUED" | "SENT" | "FAILED" | "NOT_REQUIRED" | "SUPPRESSED";
  message: string;
};

export type Profile = {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
  profilePhotoUrl: string | null;
  profileMediaAssetId: string | null;
  profilePhotoLegacyStatus: string;
  employeeId: string | null;
  joiningDate: string | null;
  employmentType: EmploymentType;
  phone: string | null;
  emergencyContact: string | null;
  jobTitle: string | null;
  department: string | null;
  location: string | null;
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
  emailAttendanceUpdates: boolean;
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
  numberOfElements: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  sort: string[];
};

export type StaffDirectorySummary = {
  totalStaff: number;
  activeStaff: number;
  managers: number;
  onboardingPending: number;
  incompleteRecords: number;
  departments: string[];
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
  documentMediaAssetId: string | null;
  documentDownloadUrl: string | null;
  documentLegacyStatus: string;
  budgetAmount: number | null;
  totalPaid: number | null;
  lastPaymentAmount: number | null;
  lastPaymentAt: string | null;
  lastPaymentNote: string | null;
  canManageProject: boolean;
  canViewFinancials: boolean;
  canRecordPayment: boolean;
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
  mediaAssetId: string | null;
  downloadUrl: string | null;
  fileName: string;
  fileType: string;
  legacyAssetStatus: string;
};

export type ProjectNote = {
  id: number;
  content: string;
  noteType: ProjectNoteType;
  createdByName: string;
  createdAt: string;
  attachments: Array<{
    mediaAssetId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    downloadUrl: string;
  }>;
  legacyAttachmentStatus: string;
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
  mediaAssetId: string | null;
  downloadUrl: string | null;
  attachmentName: string | null;
  legacyAssetStatus: string;
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
  canReview: boolean;
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
    approvedAnnualLeaveDaysThisYear: number;
    approvedSickLeaveDaysThisYear: number;
    annualLeaveAllowance: number;
    remainingLeaveDays: number;
    sickLeaveAllowance: number;
    sickRemainingLeaveDays: number;
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
  mediaAssetId: string | null;
  downloadUrl: string | null;
  legacyAssetStatus: string;
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
  sickAllowance: number;
  sickApprovedDays: number;
  sickRemainingDays: number;
};

export type AppSettings = {
  leave: {
    annualLeaveDays: number;
    sickLeaveDays: number;
    resetMonth: number;
    carryForwardAllowed: boolean;
  };
  attendance: {
    requiredMinutes: number;
    graceMinutes: number;
    breakReminderMinutes: number;
    missingCheckoutMinutes: number;
    heartbeatStaleMinutes: number;
    adminOverrideEnabled: boolean;
  };
  session: {
    idleTimeoutMinutes: number;
    warningSeconds: number;
    browserSessionOnly: boolean;
  };
};

type ErrorBody = {
  message?: string;
  errors?: Array<{ defaultMessage?: string; field?: string }>;
  error?: string;
};

function getToken() {
  return getAccessToken();
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

export async function revokeAllMySessions() {
  return request<{ message: string }>("/users/me/sessions/revoke-all", {
    method: "POST",
  });
}

export async function revokeUserSessions(userId: number, reason?: string) {
  return request<{ message: string }>(`/users/${userId}/sessions/revoke-all`, {
    method: "POST",
    body: JSON.stringify({ reason: reason?.trim() || null }),
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

export async function getMyDocuments() {
  return request<StaffDocument[]>("/users/me/documents");
}

export async function updateMyProfile(payload: {
  fullName?: string;
  phone?: string;
  emergencyContact?: string;
  location?: string;
  timezone?: string;
  profileMediaAssetId?: string;
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

export async function getUsers(signal?: AbortSignal) {
  return (await request<PageResponse<User>>("/users?size=100", { signal })).content;
}

export async function getUsersPaged(page = 0, size = 20, search = "", filters: {
  role?: Role;
  active?: boolean;
  accountStatus?: AccountStatus;
  employmentType?: EmploymentType;
  department?: string;
  incompleteOnly?: boolean;
} = {}, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (search.trim()) params.set("search", search.trim());
  if (filters.role) params.set("role", filters.role);
  if (filters.active !== undefined) params.set("active", String(filters.active));
  if (filters.accountStatus) params.set("accountStatus", filters.accountStatus);
  if (filters.employmentType) params.set("employmentType", filters.employmentType);
  if (filters.department) params.set("department", filters.department);
  if (filters.incompleteOnly) params.set("incompleteOnly", "true");
  return request<PageResponse<User>>(`/users?${params.toString()}`, { signal });
}

export async function getStaffDirectorySummary(signal?: AbortSignal) {
  return request<StaffDirectorySummary>("/users/summary", { signal });
}

export async function getStaffOverview(id: number) {
  return request<StaffOverview>(`/users/${id}/overview`);
}

export async function updateStaffLeaveBalance(userId: number, annualRemainingDays: number, sickRemainingDays?: number) {
  return request<LeaveBalance>(`/leave-requests/users/${userId}/balance`, {
    method: "PATCH",
    body: JSON.stringify({ annualRemainingDays, sickRemainingDays }),
  });
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
  payload: { documentType: StaffDocumentType; mediaAssetId: string; note?: string }
) {
  return request<StaffDocument>(`/users/${userId}/documents`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteStaffDocument(userId: number, documentId: number): Promise<void> {
  await request<void>(`/users/${userId}/documents/${documentId}`, { method: "DELETE" });
}

export async function getProjects(signal?: AbortSignal) {
  return (await request<PageResponse<Project>>("/projects?size=100", { signal })).content;
}

export async function getProject(projectId: number, signal?: AbortSignal) {
  return request<Project>(`/projects/${projectId}`, { signal });
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
  documentMediaAssetId?: string;
  budgetAmount?: number;
  internalNotes?: string;
}) {
  return request<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMyTasks(signal?: AbortSignal) {
  return (await request<PageResponse<Task>>("/tasks/me?size=100", { signal })).content;
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

export async function getProjectTaskBoards(projectId: number, signal?: AbortSignal) {
  return request<ProjectTaskBoard[]>(`/projects/${projectId}/task-boards`, { signal });
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
  documentMediaAssetId?: string;
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
  return (await request<PageResponse<Task>>("/tasks?size=100")).content;
}

export async function getTasksByProject(projectId: number, signal?: AbortSignal) {
  return (await request<PageResponse<Task>>(`/tasks/project/${projectId}?size=100`, { signal })).content;
}

export async function getProjectPayments(projectId: number, signal?: AbortSignal) {
  return (await request<PageResponse<ProjectPayment>>(`/projects/${projectId}/payments?size=100`, { signal })).content;
}

export async function createProjectPayment(
  projectId: number,
  payload: {
    amount: number;
    paidAt: string;
    referenceNote?: string;
    attachments?: Array<{ mediaAssetId: string }>;
    idempotencyKey?: string;
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
  attachments: Array<{ mediaAssetId: string }>
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
  return (await request<PageResponse<TaskComment>>(`/tasks/${taskId}/comments?size=100`)).content;
}

export async function createTaskComment(
  taskId: number,
  payload: { content: string; mediaAssetId?: string; mentionedUserIds?: number[] }
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
  lastHeartbeatAt: string | null;
  breakStartedAt: string | null;
  breakMinutes: number;
};

export type AttendanceDayStatus =
  | "NO_ACTIVITY"
  | "ON_LEAVE"
  | "IN_PROGRESS"
  | "ON_BREAK"
  | "MISSING_CHECKOUT"
  | "WORKED_ON_LEAVE"
  | "UNDER_HOURS"
  | "COMPLETED_WITH_GRACE"
  | "COMPLETED"
  | "OVERTIME";

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
  overtimeMinutes: number;
  shortfallMinutes: number;
  status: AttendanceDayStatus;
};

export async function startAttendanceSession() {
  return request<AttendanceSession>("/attendance/start", { method: "POST" });
}

export async function startTeamMemberAttendanceSession(userId: number, reason: string) {
  return request<AttendanceSession>(`/attendance/users/${userId}/active/start`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function endAttendanceSession() {
  return request<AttendanceSession>("/attendance/end", { method: "POST" });
}

export async function heartbeatAttendanceSession() {
  return request<AttendanceSession>("/attendance/heartbeat", { method: "POST" });
}

export async function startAttendanceBreak() {
  return request<AttendanceSession>("/attendance/break/start", { method: "POST" });
}

export async function endAttendanceBreak() {
  return request<AttendanceSession>("/attendance/break/end", { method: "POST" });
}

export function endAttendanceSessionOnUnload() {
  const token = getToken();
  if (!token) return;
  void fetch(`${API_BASE_URL}/attendance/end`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    keepalive: true,
  }).catch(() => {});
}

export async function endTeamMemberAttendanceSession(userId: number, reason: string) {
  return request<AttendanceSession>(`/attendance/users/${userId}/active/end`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export async function getMyAttendanceSessions(signal?: AbortSignal) {
  return (await request<PageResponse<AttendanceSession>>("/attendance/me?size=100", { signal })).content;
}

export async function getAllAttendanceSessions(signal?: AbortSignal) {
  return (await request<PageResponse<AttendanceSession>>("/attendance?size=100", { signal })).content;
}

export async function getMyTodayAttendanceSummary(signal?: AbortSignal) {
  return request<AttendanceDaySummary>("/attendance/me/today", { signal });
}

export async function getTeamDailyAttendanceSummary(date?: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ size: "100" });
  if (date) params.set("date", date);
  return (await request<PageResponse<AttendanceDaySummary>>(`/attendance/daily?${params}`, { signal })).content;
}

export async function getActiveAttendanceSession(signal?: AbortSignal) {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/attendance/active`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error("Failed to fetch active session");
  return (await response.json()) as AttendanceSession;
}

export type AttendanceCorrectionStatus = "PENDING" | "APPROVED" | "REJECTED";

export type AttendanceCorrection = {
  id: number;
  sessionId: number;
  userId: number;
  userFullName: string;
  originalStartTime: string;
  originalEndTime: string | null;
  requestedStartTime: string;
  requestedEndTime: string;
  reason: string;
  status: AttendanceCorrectionStatus;
  reviewerFullName: string | null;
  reviewerNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  canReview: boolean;
};

export async function getAttendanceCorrections(signal?: AbortSignal) {
  return (await request<PageResponse<AttendanceCorrection>>("/attendance/corrections?size=100", { signal })).content;
}

export async function createAttendanceCorrection(payload: {
  sessionId: number;
  requestedStartTime: string;
  requestedEndTime: string;
  reason: string;
}) {
  return request<AttendanceCorrection>("/attendance/corrections", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function approveAttendanceCorrection(correctionId: number, reviewerNote: string) {
  return request<AttendanceCorrection>(`/attendance/corrections/${correctionId}/approve`, {
    method: "PATCH",
    body: JSON.stringify({ reviewerNote }),
  });
}

export async function rejectAttendanceCorrection(correctionId: number, reviewerNote: string) {
  return request<AttendanceCorrection>(`/attendance/corrections/${correctionId}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reviewerNote }),
  });
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
  return (await request<PageResponse<DailyLog>>("/logs/me?size=100")).content;
}

export async function getAllDailyLogs() {
  return (await request<PageResponse<DailyLog>>("/logs?size=100")).content;
}

// Project Notes
export async function getProjectNotes(projectId: number, type?: ProjectNoteType, signal?: AbortSignal) {
  const params = new URLSearchParams({ size: "100" });
  if (type) params.set("type", type);
  return (await request<PageResponse<ProjectNote>>(`/projects/${projectId}/notes?${params}`, { signal })).content;
}

export async function createProjectNote(
  projectId: number,
  payload: { content: string; noteType: ProjectNoteType; mediaAssetIds?: string[] }
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

export async function getProjectMilestones(projectId: number, signal?: AbortSignal) {
  return request<ProjectMilestone[]>(`/projects/${projectId}/milestones`, { signal });
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
  id: string;
  purpose: UploadPurpose;
  status: MediaStatus;
  scanningStatus: MediaScanningStatus;
  originalFilename: string;
  detectedMimeType: string;
  detectedFormat: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  publicUrl: string | null;
  createdAt: string;
};

export async function uploadFile(
  file: File,
  purpose: UploadPurpose,
  signal?: AbortSignal
): Promise<UploadResponse> {
  const token = getToken();
  const formData = new FormData();
  formData.append("purpose", purpose);
  formData.append("file", file);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), 60_000);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/media/uploads`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(signal?.aborted ? "Upload canceled." : "Upload timed out. Please try again.");
    }
    if (err instanceof TypeError) {
      throw new Error("Cannot reach the server for file upload.");
    }
    throw err;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized();
    }
    const errorMessage = await readErrorMessage(response, "/media/uploads");
    throw new Error(errorMessage);
  }
  return response.json() as Promise<UploadResponse>;
}

export async function deleteUploadedMedia(assetId: string): Promise<void> {
  await request<void>(`/media/assets/${assetId}`, { method: "DELETE" });
}

export async function downloadMediaAsset(assetId: string, filename: string): Promise<void> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/media/assets/${assetId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error("Your session has expired. Please log in again.");
  }
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `/media/assets/${assetId}/download`));
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function getNotifications(signal?: AbortSignal) {
  return (await request<PageResponse<Notification>>("/notifications?size=50", { signal })).content;
}

export async function getUnreadNotificationCount(signal?: AbortSignal) {
  return request<{ count: number }>("/notifications/unread-count", { signal });
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


export async function getLeaveRequests(signal?: AbortSignal) {
  return (await request<PageResponse<LeaveRequest>>("/leave-requests?size=100", { signal })).content;
}

export async function getLeaveBalance(signal?: AbortSignal) {
  return request<LeaveBalance>("/leave-requests/balance", { signal });
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

export async function approveLeaveRequest(id: number, reviewerNote?: string) {
  return request<LeaveRequest>(`/leave-requests/${id}/approve`, {
    method: "PATCH",
    body: JSON.stringify({ reviewerNote }),
  });
}

export async function rejectLeaveRequest(id: number, reviewerNote?: string) {
  return request<LeaveRequest>(`/leave-requests/${id}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reviewerNote }),
  });
}

export async function cancelLeaveRequest(id: number) {
  return request<LeaveRequest>(`/leave-requests/${id}/cancel`, { method: "PATCH" });
}

export async function getAppSettings() {
  return request<AppSettings>("/settings");
}

export async function updateAppSettings(payload: AppSettings) {
  return request<AppSettings>("/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
