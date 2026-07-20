"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  getLeaveBalance,
  getLeaveRequests,
  LeaveBalance,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  rejectLeaveRequest,
} from "@/lib/api";
import ActionModal from "@/app/components/ActionModal";
import { useAuth } from "@/lib/hooks";
import { useToast } from "@/lib/toast";

const statusOptions: Array<LeaveStatus | "ALL"> = ["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"];
const leaveTypeLabels: Record<LeaveType, string> = {
  ANNUAL: "Annual",
  SICK: "Sick",
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function requestedDaysBetween(start: string, end: string) {
  if (!start || !end || end < start) return 0;
  return Math.floor((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86_400_000) + 1;
}

function badgeClass(status: LeaveStatus) {
  if (status === "APPROVED") return "badge-done";
  if (status === "REJECTED") return "badge-blocked";
  if (status === "CANCELLED") return "badge-todo";
  return "badge-in-progress";
}

function encodeLeaveReason(subject: string, reason: string) {
  return `Subject: ${subject.trim()}\n\nReason:\n${reason.trim()}`;
}

function decodeLeaveReason(value: string) {
  const subjectMatch = value.match(/^Subject:\s*(.+?)(?:\n{2,}Reason:\n([\s\S]*)|\n{2,}([\s\S]*)|$)/);
  if (!subjectMatch) {
    return { subject: "Leave request", reason: value };
  }
  return {
    subject: subjectMatch[1].trim() || "Leave request",
    reason: (subjectMatch[2] ?? subjectMatch[3] ?? "").trim(),
  };
}

export default function LeavePage() {
  const { loading: authLoading, user } = useAuth(["ADMIN", "MANAGER", "EMPLOYEE"]);
  const toast = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("ANNUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "ALL">("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [reviewTarget, setReviewTarget] = useState<{ id: number; action: "approve" | "reject" } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);
  const [modalWorking, setModalWorking] = useState(false);

  const canReview = user?.role === "ADMIN" || user?.role === "MANAGER";
  const canSubmitLeave = user?.role !== "ADMIN";

  async function loadData() {
    setLoading(true);
    try {
      const [requestList, balanceData] = await Promise.all([getLeaveRequests(), getLeaveBalance()]);
      setRequests(requestList);
      setBalance(balanceData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading) {
      if (canReview) setStatusFilter("PENDING");
      void loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canReview]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject.trim() || !startDate || !endDate || !reason.trim()) return;
    if (endDate < startDate) {
      toast.error("End date must be on or after the start date.");
      return;
    }
    setSubmitting(true);
    try {
      await createLeaveRequest({
        leaveType,
        startDate,
        endDate,
        reason: encodeLeaveReason(subject, reason),
      });
      setSubject("");
      setLeaveType("ANNUAL");
      setStartDate("");
      setEndDate("");
      setReason("");
      toast.success("Leave request submitted.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmReview() {
    if (!reviewTarget) return;
    setModalWorking(true);
    try {
      if (reviewTarget.action === "approve") {
        await approveLeaveRequest(reviewTarget.id, reviewNote.trim());
      } else {
        await rejectLeaveRequest(reviewTarget.id, reviewNote.trim());
      }
      toast.success(reviewTarget.action === "approve" ? "Leave approved." : "Leave rejected.");
      setReviewTarget(null);
      setReviewNote("");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to review request");
      await loadData();
    } finally {
      setModalWorking(false);
    }
  }

  async function confirmCancel() {
    if (!cancelTargetId) return;
    setModalWorking(true);
    try {
      await cancelLeaveRequest(cancelTargetId);
      toast.success("Leave request cancelled.");
      setCancelTargetId(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel request");
      await loadData();
    } finally {
      setModalWorking(false);
    }
  }

  const filteredRequests = useMemo(() => {
    return requests
      .filter(request => {
        const matchesStatus = statusFilter === "ALL" || request.status === statusFilter;
        const matchesName = request.userFullName.toLowerCase().includes(nameFilter.toLowerCase());
        const overlapsFrom = dateFrom ? request.endDate >= dateFrom : true;
        const overlapsTo = dateTo ? request.startDate <= dateTo : true;
        return matchesStatus && matchesName && overlapsFrom && overlapsTo;
      })
      .sort((a, b) => {
        if (a.status === "PENDING" && b.status !== "PENDING") return -1;
        if (b.status === "PENDING" && a.status !== "PENDING") return 1;
        return a.startDate.localeCompare(b.startDate);
      });
  }, [dateFrom, dateTo, nameFilter, requests, statusFilter]);

  const leaveMetrics = useMemo(() => {
    const today = localDateKey();
    const nextThirtyDays = localDateKey(new Date(Date.now() + 30 * 86_400_000));
    const approved = requests.filter(request => request.status === "APPROVED");
    return {
      pending: requests.filter(request => request.status === "PENDING").length,
      awayToday: approved.filter(request => request.startDate <= today && request.endDate >= today).length,
      upcoming: approved.filter(request => request.startDate > today && request.startDate <= nextThirtyDays).length,
      pendingDays: requests.filter(request => request.status === "PENDING").reduce((total, request) => total + request.requestedDays, 0),
    };
  }, [requests]);

  const plannedDays = requestedDaysBetween(startDate, endDate);

  function overlapCount(request: LeaveRequest) {
    return requests.filter(other =>
      other.id !== request.id
      && other.userId !== request.userId
      && other.status === "APPROVED"
      && other.startDate <= request.endDate
      && other.endDate >= request.startDate
    ).length;
  }

  function clearFilters() {
    setNameFilter("");
    setStatusFilter(canReview ? "PENDING" : "ALL");
    setDateFrom("");
    setDateTo("");
  }

  function showAllRequests() {
    setNameFilter("");
    setStatusFilter("ALL");
    setDateFrom("");
    setDateTo("");
  }

  if (authLoading || loading) return <div className="p-8">Loading leave requests...</div>;

  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-gradient" style={{ fontSize: "2.1rem", marginBottom: "8px" }}>Leave Requests</h1>
          <p className="text-muted">{user?.role === "ADMIN" ? "Review team leave requests and approval history." : "Request time off and track approvals in one place."}</p>
        </div>
      </div>

      {canSubmitLeave && (
        <div className="leave-balance-grid">
          <div className="glass-card" style={{ padding: "18px" }}>
            <div className="text-sm text-muted mb-2">Annual Allowance</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{balance?.annualAllowance ?? 21} days</div>
            <small className="text-muted">{balance?.approvedDays ?? 0} used</small>
          </div>
          <div className="glass-card" style={{ padding: "18px" }}>
            <div className="text-sm text-muted mb-2">Annual Remaining</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--success-color)" }}>{balance?.remainingDays ?? 21} days</div>
          </div>
          <div className="glass-card" style={{ padding: "18px" }}>
            <div className="text-sm text-muted mb-2">Sick Allowance</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{balance?.sickAllowance ?? 12} days</div>
            <small className="text-muted">{balance?.sickApprovedDays ?? 0} used</small>
          </div>
          <div className="glass-card" style={{ padding: "18px" }}>
            <div className="text-sm text-muted mb-2">Sick Remaining</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--info-color)" }}>{balance?.sickRemainingDays ?? 12} days</div>
          </div>
        </div>
      )}

      {canReview && (
        <section className="leave-operations-metrics" aria-label="Leave operations summary">
          <button type="button" className={statusFilter === "PENDING" ? "active" : ""} onClick={() => setStatusFilter("PENDING")}><span>Pending review</span><strong>{leaveMetrics.pending}</strong><small>{leaveMetrics.pendingDays} requested days</small></button>
          <button type="button" onClick={() => { setStatusFilter("APPROVED"); setDateFrom(localDateKey()); setDateTo(localDateKey()); }}><span>Away today</span><strong>{leaveMetrics.awayToday}</strong><small>Approved absence</small></button>
          <button type="button" onClick={() => { setStatusFilter("APPROVED"); setDateFrom(localDateKey()); setDateTo(localDateKey(new Date(Date.now() + 30 * 86_400_000))); }}><span>Upcoming</span><strong>{leaveMetrics.upcoming}</strong><small>Next 30 days</small></button>
          <button type="button" className={statusFilter === "ALL" ? "active" : ""} onClick={showAllRequests}><span>All requests</span><strong>{requests.length}</strong><small>Complete history</small></button>
        </section>
      )}

      <div className={`leave-workspace ${canSubmitLeave ? "with-form" : ""}`}>
        {canSubmitLeave && (
          <div className="glass-card" style={{ alignSelf: "start" }}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: "18px" }}>New Request</h2>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
              <label className="leave-form-field">
                <span>Subject</span>
                <input
                  value={subject}
                  onChange={event => setSubject(event.target.value)}
                  maxLength={90}
                  required
                  placeholder="Example: Medical appointment leave"
                />
              </label>
              <label className="leave-form-field">
                <span>Leave category</span>
                <select value={leaveType} onChange={event => setLeaveType(event.target.value as LeaveType)}>
                  <option value="ANNUAL">Annual leave</option>
                  <option value="SICK">Sick leave</option>
                </select>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label className="leave-form-field">
                  <span>From date</span>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={{ width: "100%" }} />
                </label>
                <label className="leave-form-field">
                  <span>To date</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required style={{ width: "100%" }} />
                </label>
              </div>
              {plannedDays > 0 && <p className="leave-duration-preview">Requested duration: <strong>{plannedDays} day{plannedDays === 1 ? "" : "s"}</strong></p>}
              <label className="leave-form-field">
                <span>Reason</span>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={4}
                  required
                  placeholder="Share the reason for your request..."
                  style={{ width: "100%" }}
                />
              </label>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </form>
          </div>
        )}

        <div className="glass-card">
          <div className="leave-review-header">
            <div><h2>{canReview ? "Team Requests" : "My Requests"}</h2><p>{filteredRequests.length} matching request{filteredRequests.length === 1 ? "" : "s"}</p></div>
            <div className="leave-review-filters">
              {canReview && (
                <input
                  value={nameFilter}
                  onChange={e => setNameFilter(e.target.value)}
                  placeholder="Search employee..."
                  style={{ width: "180px" }}
                />
              )}
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as LeaveStatus | "ALL")}>
                {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
              {canReview && <input aria-label="Leave overlap from date" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} />}
              {canReview && <input aria-label="Leave overlap to date" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} />}
              {(nameFilter || statusFilter !== (canReview ? "PENDING" : "ALL") || dateFrom || dateTo) && <button type="button" className="leave-reset" onClick={clearFilters}>Reset</button>}
            </div>
          </div>

          <div style={{ display: "grid", gap: "14px" }}>
            {filteredRequests.map(request => {
              const decoded = decodeLeaveReason(request.reason);
              return (
                <div key={request.id} className={`leave-request-item ${request.status === "PENDING" ? "pending" : ""}`}>
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div style={{ fontWeight: 700 }}>{decoded.subject}</div>
                      <div className="text-sm text-muted mt-1">
                        {request.userFullName} · {leaveTypeLabels[request.leaveType]} leave · {formatDate(request.startDate)} to {formatDate(request.endDate)} · {request.requestedDays} day{request.requestedDays !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <span className={`badge ${badgeClass(request.status)}`}>{request.status}</span>
                  </div>
                  {decoded.reason && <p className="text-sm mt-3" style={{ lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{decoded.reason}</p>}
                  {canReview && overlapCount(request) > 0 && (
                    <p className="leave-overlap-warning">{overlapCount(request)} approved team absence{overlapCount(request) === 1 ? "" : "s"} overlap this request.</p>
                  )}
                  {request.reviewerNote && (
                    <p className="text-sm text-muted mt-3">Review: {request.reviewerNote}</p>
                  )}
                  <div className="flex gap-2 mt-4">
                    {request.canReview && request.status === "PENDING" && (
                      <>
                        <button type="button" className="btn-primary" style={{ padding: "7px 12px", fontSize: "0.8rem" }} onClick={() => { setReviewTarget({ id: request.id, action: "approve" }); setReviewNote(""); }}>
                          Approve
                        </button>
                        <button type="button" className="btn-secondary" style={{ padding: "7px 12px", fontSize: "0.8rem", color: "var(--danger-color)" }} onClick={() => { setReviewTarget({ id: request.id, action: "reject" }); setReviewNote(""); }}>
                          Reject
                        </button>
                      </>
                    )}
                    {!request.canReview
                      && request.userId === user?.userId
                      && request.status === "PENDING" && (
                      <button type="button" className="btn-secondary" style={{ padding: "7px 12px", fontSize: "0.8rem" }} onClick={() => setCancelTargetId(request.id)}>
                        Cancel Request
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredRequests.length === 0 && <p className="text-muted">No leave requests found.</p>}
          </div>
        </div>
      </div>

      <ActionModal
        open={reviewTarget !== null}
        title={reviewTarget?.action === "approve" ? "Approve Leave" : "Reject Leave"}
        description={reviewTarget?.action === "approve" ? "You can add an optional approval note for this leave request." : "You can add an optional reason for rejecting this leave request."}
        confirmLabel={reviewTarget?.action === "approve" ? "Approve" : "Reject"}
        tone={reviewTarget?.action === "reject" ? "danger" : "primary"}
        noteLabel={reviewTarget?.action === "approve" ? "Approval note (optional)" : "Rejection reason (optional)"}
        notePlaceholder="Optional note for the employee..."
        noteValue={reviewNote}
        loading={modalWorking}
        onNoteChange={setReviewNote}
        onCancel={() => { setReviewTarget(null); setReviewNote(""); }}
        onConfirm={() => void confirmReview()}
      />

      <ActionModal
        open={cancelTargetId !== null}
        title="Cancel Leave Request"
        description="This will cancel your pending leave request. You can submit a new request later if needed."
        confirmLabel="Cancel Request"
        tone="danger"
        loading={modalWorking}
        onCancel={() => setCancelTargetId(null)}
        onConfirm={() => void confirmCancel()}
      />
    </div>
  );
}
