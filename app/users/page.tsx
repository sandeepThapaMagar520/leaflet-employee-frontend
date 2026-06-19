"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AccountStatus, deleteUser, EmploymentType, getUsersPaged, registerUser, Role, updateUser, User } from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import ActionModal from "@/app/components/ActionModal";
import Pagination from "@/app/components/Pagination";

const roleOptions: Role[] = ["EMPLOYEE", "MANAGER", "ADMIN"];
const employmentTypeOptions: EmploymentType[] = ["FULL_TIME", "PART_TIME", "CONTRACTOR", "INTERN"];
type RoleFilter = "ALL" | Role;
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

const roleLabel = (role: Role) => role.charAt(0) + role.slice(1).toLowerCase();
const titleCase = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase());
const accountStatusLabel = (status: AccountStatus) => titleCase(status);
const initials = (name: string) => name.split(" ").filter(Boolean).map(part => part[0]).join("").slice(0, 2).toUpperCase();

export default function UsersAdminPage() {
  const { loading: authLoading } = useAuth(["ADMIN"]);
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [panelMode, setPanelMode] = useState<"register" | "edit" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("EMPLOYEE");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType>("FULL_TIME");
  const [phone, setPhone] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<Role>("EMPLOYEE");
  const [editActive, setEditActive] = useState(true);
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [editJoiningDate, setEditJoiningDate] = useState("");
  const [editEmploymentType, setEditEmploymentType] = useState<EmploymentType>("FULL_TIME");
  const [editPhone, setEditPhone] = useState("");
  const [editEmergencyContact, setEditEmergencyContact] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editTimezone, setEditTimezone] = useState("Asia/Kathmandu");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadData(nextPage = page) {
    setLoading(true);
    try {
      const result = await getUsersPaged(nextPage, 15, searchQuery);
      setUsers(result.content);
      setPage(result.page);
      setTotalPages(result.totalPages);
      setTotalElements(result.totalElements);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading) void loadData(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  useEffect(() => {
    if (authLoading) return;
    const timer = window.setTimeout(() => void loadData(0), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const visibleUsers = useMemo(
    () => users.filter(user =>
      (roleFilter === "ALL" || user.role === roleFilter)
      && (statusFilter === "ALL" || (statusFilter === "ACTIVE" ? user.active : !user.active))
    ),
    [roleFilter, statusFilter, users]
  );

  const metrics = useMemo(() => ({
    active: users.filter(user => user.active).length,
    managers: users.filter(user => user.role === "MANAGER").length,
    pending: users.filter(user => user.accountStatus !== "VERIFIED").length,
  }), [users]);

  function closePanel() {
    if (submitting || savingEdit) return;
    setPanelMode(null);
    setEditingUser(null);
  }

  function startEdit(user: User) {
    setEditingUser(user);
    setEditFullName(user.fullName);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditActive(user.active);
    setEditJobTitle(user.jobTitle ?? "");
    setEditEmployeeId(user.employeeId ?? "");
    setEditJoiningDate(user.joiningDate ?? "");
    setEditEmploymentType(user.employmentType ?? "FULL_TIME");
    setEditPhone(user.phone ?? "");
    setEditEmergencyContact(user.emergencyContact ?? "");
    setEditDepartment(user.department ?? "");
    setEditLocation(user.location ?? "");
    setEditTimezone(user.timezone ?? "Asia/Kathmandu");
    setPanelMode("edit");
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await registerUser({
        fullName,
        email,
        role,
        temporaryPassword,
        jobTitle,
        employeeId,
        joiningDate: joiningDate || undefined,
        employmentType,
        phone,
        emergencyContact,
        department,
        location,
      });
      toast.success(result.message);
      setFullName("");
      setEmail("");
      setRole("EMPLOYEE");
      setTemporaryPassword("");
      setJobTitle("");
      setEmployeeId("");
      setJoiningDate("");
      setEmploymentType("FULL_TIME");
      setPhone("");
      setEmergencyContact("");
      setDepartment("");
      setLocation("");
      setPanelMode(null);
      await loadData(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to register user");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      await updateUser(editingUser.id, {
        fullName: editFullName,
        email: editEmail,
        role: editRole,
        active: editActive,
        jobTitle: editJobTitle,
        employeeId: editEmployeeId,
        joiningDate: editJoiningDate || undefined,
        employmentType: editEmploymentType,
        phone: editPhone,
        emergencyContact: editEmergencyContact,
        department: editDepartment,
        location: editLocation,
        timezone: editTimezone,
      });
      toast.success(`${editFullName} was updated.`);
      setPanelMode(null);
      setEditingUser(null);
      await loadData(page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update user");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUser(deleteTarget.id);
      toast.success(`${deleteTarget.fullName} was deactivated.`);
      setDeleteTarget(null);
      await loadData(page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to deactivate user");
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading) return <div className="p-8">Verifying access...</div>;

  return (
    <div className="staff-page">
      <header className="staff-page-header">
        <div>
          <p className="staff-eyebrow">Administration</p>
          <h1>Staff management</h1>
          <p>Manage access, roles, job titles, and first-time account setup.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setPanelMode("register")}>
          Add staff member
        </button>
      </header>

      <section className="staff-metrics" aria-label="Staff summary">
        <div><span>Total staff</span><strong>{totalElements}</strong></div>
        <div><span>Active on this page</span><strong>{metrics.active}</strong></div>
        <div><span>Managers</span><strong>{metrics.managers}</strong></div>
        <div><span>Onboarding pending</span><strong>{metrics.pending}</strong></div>
      </section>

      <section className="staff-directory">
        <div className="staff-toolbar">
          <div>
            <h2>Staff directory</h2>
            <p>{totalElements} people across all roles</p>
          </div>
          <div className="staff-toolbar-controls">
            <label className="staff-search">
              <span className="sr-only">Search staff</span>
              <input type="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search name, email, or role" />
            </label>
            <select aria-label="Filter by role" value={roleFilter} onChange={event => setRoleFilter(event.target.value as RoleFilter)}>
              <option value="ALL">All roles</option>
              {roleOptions.map(option => <option key={option} value={option}>{roleLabel(option)}</option>)}
            </select>
            <select aria-label="Filter by status" value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead>
              <tr><th>Staff member</th><th>Job title</th><th>Role</th><th>Onboarding</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="staff-empty">Loading staff...</td></tr>
              ) : visibleUsers.length === 0 ? (
                <tr><td colSpan={6} className="staff-empty">No staff match these filters.</td></tr>
              ) : visibleUsers.map(user => (
                <tr key={user.id}>
                  <td>
                    <Link className="staff-person staff-person-link" href={`/users/${user.id}`} aria-label={`View ${user.fullName}'s records`}>
                      <span className="staff-avatar">
                        {user.profilePhotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.profilePhotoUrl} alt="" />
                        ) : (
                          initials(user.fullName)
                        )}
                      </span>
                      <span><strong>{user.fullName}</strong><small>{user.email}</small></span>
                    </Link>
                  </td>
                  <td><span className="staff-job-title">{user.jobTitle || "Not assigned"}{user.employeeId ? ` · ${user.employeeId}` : ""}</span></td>
                  <td><span className={`staff-role staff-role-${user.role.toLowerCase()}`}>{roleLabel(user.role)}</span></td>
                  <td><span className={`staff-status ${user.accountStatus === "VERIFIED" ? "active" : "inactive"}`}><i aria-hidden="true" />{accountStatusLabel(user.accountStatus)}</span></td>
                  <td><span className={`staff-status ${user.active ? "active" : "inactive"}`}><i aria-hidden="true" />{user.active ? "Active" : "Inactive"}</span></td>
                  <td>
                    <div className="staff-row-actions">
                      <button type="button" onClick={() => startEdit(user)}>Edit</button>
                      <button type="button" className="danger" onClick={() => setDeleteTarget(user)}>Deactivate</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} totalElements={totalElements} onPageChange={next => void loadData(next)} />
      </section>

      {panelMode && (
        <div className="staff-panel-backdrop" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) closePanel();
        }}>
          <aside className="staff-panel" role="dialog" aria-modal="true" aria-labelledby="staff-panel-title">
            <div className="staff-panel-header">
              <div>
                <p className="staff-eyebrow">{panelMode === "register" ? "New account" : `Staff #${editingUser?.id}`}</p>
                <h2 id="staff-panel-title">{panelMode === "register" ? "Register staff member" : "Edit staff member"}</h2>
              </div>
              <button type="button" className="staff-panel-close" onClick={closePanel} aria-label="Close panel">×</button>
            </div>

            {panelMode === "register" ? (
              <form className="staff-form" onSubmit={handleRegister}>
                <div className="staff-form-section">
                  <h3>Staff details</h3>
                  <label><span>Full name</span><input value={fullName} onChange={event => setFullName(event.target.value)} required placeholder="Jane Smith" /></label>
                  <label><span>Work email</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} required placeholder="jane@company.com" /></label>
                  <label><span>Job title</span><input value={jobTitle} onChange={event => setJobTitle(event.target.value)} required maxLength={100} placeholder="Software Engineer" /></label>
                  <label><span>Role</span><select value={role} onChange={event => setRole(event.target.value as Role)}>{roleOptions.map(option => <option key={option} value={option}>{roleLabel(option)}</option>)}</select></label>
                  <div className="staff-form-split">
                    <label><span>Employee ID</span><input value={employeeId} onChange={event => setEmployeeId(event.target.value)} maxLength={50} placeholder="EMP-001" /></label>
                    <label><span>Joining date</span><input type="date" value={joiningDate} onChange={event => setJoiningDate(event.target.value)} /></label>
                  </div>
                  <label><span>Employment type</span><select value={employmentType} onChange={event => setEmploymentType(event.target.value as EmploymentType)}>{employmentTypeOptions.map(option => <option key={option} value={option}>{titleCase(option)}</option>)}</select></label>
                  <div className="staff-form-split">
                    <label><span>Department</span><input value={department} onChange={event => setDepartment(event.target.value)} maxLength={100} placeholder="Engineering" /></label>
                    <label><span>Location</span><input value={location} onChange={event => setLocation(event.target.value)} maxLength={120} placeholder="Kathmandu" /></label>
                  </div>
                  <div className="staff-form-split">
                    <label><span>Phone</span><input value={phone} onChange={event => setPhone(event.target.value)} maxLength={50} placeholder="+977..." /></label>
                    <label><span>Emergency contact</span><input value={emergencyContact} onChange={event => setEmergencyContact(event.target.value)} maxLength={120} placeholder="Name / phone" /></label>
                  </div>
                </div>
                <div className="staff-form-section">
                  <h3>First-time access</h3>
                  <label><span>Temporary one-time password</span><input type="password" value={temporaryPassword} onChange={event => setTemporaryPassword(event.target.value)} required minLength={8} maxLength={100} autoComplete="new-password" placeholder="At least 8 characters" /></label>
                  <p>The setup link and temporary password are emailed first. OTP verification follows before the employee creates a permanent password.</p>
                </div>
                <div className="staff-panel-actions">
                  <button type="button" className="btn-secondary" onClick={closePanel}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Registering..." : "Register staff"}</button>
                </div>
              </form>
            ) : (
              <form className="staff-form" onSubmit={handleUpdate}>
                <div className="staff-form-section">
                  <h3>Account details</h3>
                  <label><span>Full name</span><input value={editFullName} onChange={event => setEditFullName(event.target.value)} required /></label>
                  <label><span>Work email</span><input type="email" value={editEmail} onChange={event => setEditEmail(event.target.value)} required /></label>
                  <label><span>Job title</span><input value={editJobTitle} onChange={event => setEditJobTitle(event.target.value)} maxLength={100} placeholder="Software Engineer" /></label>
                  <div className="staff-form-split">
                    <label><span>Employee ID</span><input value={editEmployeeId} onChange={event => setEditEmployeeId(event.target.value)} maxLength={50} /></label>
                    <label><span>Joining date</span><input type="date" value={editJoiningDate} onChange={event => setEditJoiningDate(event.target.value)} /></label>
                  </div>
                  <label><span>Employment type</span><select value={editEmploymentType} onChange={event => setEditEmploymentType(event.target.value as EmploymentType)}>{employmentTypeOptions.map(option => <option key={option} value={option}>{titleCase(option)}</option>)}</select></label>
                  <div className="staff-form-split">
                    <label><span>Role</span><select value={editRole} onChange={event => setEditRole(event.target.value as Role)}>{roleOptions.map(option => <option key={option} value={option}>{roleLabel(option)}</option>)}</select></label>
                    <label><span>Status</span><select value={editActive ? "true" : "false"} onChange={event => setEditActive(event.target.value === "true")}><option value="true">Active</option><option value="false">Inactive</option></select></label>
                  </div>
                  <div className="staff-form-split">
                    <label><span>Department</span><input value={editDepartment} onChange={event => setEditDepartment(event.target.value)} maxLength={100} /></label>
                    <label><span>Location</span><input value={editLocation} onChange={event => setEditLocation(event.target.value)} maxLength={120} /></label>
                  </div>
                  <div className="staff-form-split">
                    <label><span>Phone</span><input value={editPhone} onChange={event => setEditPhone(event.target.value)} maxLength={50} /></label>
                    <label><span>Emergency contact</span><input value={editEmergencyContact} onChange={event => setEditEmergencyContact(event.target.value)} maxLength={120} /></label>
                  </div>
                  <label><span>Timezone</span><input value={editTimezone} onChange={event => setEditTimezone(event.target.value)} maxLength={50} placeholder="Asia/Kathmandu" /></label>
                </div>
                <div className="staff-panel-actions">
                  <button type="button" className="btn-secondary" onClick={closePanel}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={savingEdit}>{savingEdit ? "Saving..." : "Save changes"}</button>
                </div>
              </form>
            )}
          </aside>
        </div>
      )}

      <ActionModal
        open={deleteTarget !== null}
        title="Deactivate staff member"
        description={`${deleteTarget?.fullName ?? "This user"} will lose access immediately but remain in the staff record.`}
        confirmLabel="Deactivate"
        tone="danger"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
