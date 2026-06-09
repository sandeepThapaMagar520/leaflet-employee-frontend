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

const leaveTypes: LeaveType[] = ["ANNUAL", "SICK", "PERSONAL", "UNPAID"];
const statusOptions: Array<LeaveStatus | "ALL"> = ["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"];

function badgeClass(status: LeaveStatus) {
  if (status === "APPROVED") return "badge-done";
  if (status === "REJECTED") return "badge-blocked";
  if (status === "CANCELLED") return "badge-todo";
  return "badge-in-progress";
}

export default function LeavePage() {
  const { loading: authLoading, user } = useAuth(["ADMIN", "MANAGER", "EMPLOYEE"]);
  const toast = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaveType, setLeaveType] = useState<LeaveType>("ANNUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "ALL">("ALL");
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
    if (!authLoading) void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!startDate || !endDate || !reason.trim()) return;
    setSubmitting(true);
    try {
      await createLeaveRequest({ leaveType, startDate, endDate, reason: reason.trim() });
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
    if (!reviewTarget || !reviewNote.trim()) return;
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
    } finally {
      setModalWorking(false);
    }
  }

  const filteredRequests = useMemo(() => {
    return requests.filter(request => {
      const matchesStatus = statusFilter === "ALL" || request.status === statusFilter;
      const matchesName = request.userFullName.toLowerCase().includes(nameFilter.toLowerCase());
      return matchesStatus && matchesName;
    });
  }, [nameFilter, requests, statusFilter]);

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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          <div className="glass-card" style={{ padding: "18px" }}>
            <div className="text-sm text-muted mb-2">Annual Allowance</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{balance?.annualAllowance ?? 20} days</div>
          </div>
          <div className="glass-card" style={{ padding: "18px" }}>
            <div className="text-sm text-muted mb-2">Approved</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{balance?.approvedDays ?? 0} days</div>
          </div>
          <div className="glass-card" style={{ padding: "18px" }}>
            <div className="text-sm text-muted mb-2">Remaining</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--success-color)" }}>{balance?.remainingDays ?? 20} days</div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: canSubmitLeave ? "minmax(280px, 420px) minmax(0, 1fr)" : "1fr", gap: "24px" }}>
        {canSubmitLeave && (
          <div className="glass-card" style={{ alignSelf: "start" }}>
            <h2 style={{ fontSize: "1.2rem", marginBottom: "18px" }}>New Request</h2>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
              <div>
                <label className="text-sm text-muted block mb-2">Leave Type</label>
                <select value={leaveType} onChange={e => setLeaveType(e.target.value as LeaveType)} style={{ width: "100%" }}>
                  {leaveTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label className="text-sm text-muted block mb-2">Start</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={{ width: "100%" }} />
                </div>
                <div>
                  <label className="text-sm text-muted block mb-2">End</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required style={{ width: "100%" }} />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted block mb-2">Reason</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={4}
                  required
                  placeholder="Share the reason for your request..."
                  style={{ width: "100%" }}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </form>
          </div>
        )}

        <div className="glass-card">
          <div className="flex justify-between items-center gap-3 flex-wrap mb-5">
            <h2 style={{ fontSize: "1.2rem", margin: 0 }}>{canReview ? "Team Requests" : "My Requests"}</h2>
            <div className="flex gap-3">
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
            </div>
          </div>

          <div style={{ display: "grid", gap: "14px" }}>
            {filteredRequests.map(request => (
              <div key={request.id} style={{ padding: "16px", background: "rgba(15,23,42,0.35)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div style={{ fontWeight: 700 }}>{request.leaveType} leave</div>
                    <div className="text-sm text-muted mt-1">
                      {request.userFullName} · {new Date(request.startDate).toLocaleDateString()} to {new Date(request.endDate).toLocaleDateString()} · {request.requestedDays} day{request.requestedDays !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <span className={`badge ${badgeClass(request.status)}`}>{request.status}</span>
                </div>
                <p className="text-sm mt-3" style={{ lineHeight: 1.5 }}>{request.reason}</p>
                {request.reviewerNote && (
                  <p className="text-sm text-muted mt-3">Review: {request.reviewerNote}</p>
                )}
                <div className="flex gap-2 mt-4">
                  {canReview && request.status === "PENDING" && (
                    <>
                      <button type="button" className="btn-primary" style={{ padding: "7px 12px", fontSize: "0.8rem" }} onClick={() => { setReviewTarget({ id: request.id, action: "approve" }); setReviewNote(""); }}>
                        Approve
                      </button>
                      <button type="button" className="btn-secondary" style={{ padding: "7px 12px", fontSize: "0.8rem", color: "var(--danger-color)" }} onClick={() => { setReviewTarget({ id: request.id, action: "reject" }); setReviewNote(""); }}>
                        Reject
                      </button>
                    </>
                  )}
                  {!canReview && request.status === "PENDING" && (
                    <button type="button" className="btn-secondary" style={{ padding: "7px 12px", fontSize: "0.8rem" }} onClick={() => setCancelTargetId(request.id)}>
                      Cancel Request
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredRequests.length === 0 && <p className="text-muted">No leave requests found.</p>}
          </div>
        </div>
      </div>

      <ActionModal
        open={reviewTarget !== null}
        title={reviewTarget?.action === "approve" ? "Approve Leave" : "Reject Leave"}
        description={reviewTarget?.action === "approve" ? "Add a short approval note for this leave request." : "Share the reason this leave request is being rejected."}
        confirmLabel={reviewTarget?.action === "approve" ? "Approve" : "Reject"}
        tone={reviewTarget?.action === "reject" ? "danger" : "primary"}
        noteLabel={reviewTarget?.action === "approve" ? "Approval Note" : "Rejection Reason"}
        notePlaceholder="Write a note for the employee..."
        noteValue={reviewNote}
        noteRequired
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
