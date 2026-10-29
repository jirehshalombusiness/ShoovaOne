import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  History,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useHRAccess } from '@/hooks/useHRAccess';
import { hrService } from '@/services/hr.service';

import { financeService } from '../finance.service';
import type {
  FundRequestDetail,
  FundRequestReceiptVerificationPayload,
} from '../finance.types';
import { FundRequestDocuments } from '../components/FundRequestDocuments';
import {
  FundRequestStageBadge,
  FundRequestStatusBadge,
  REQUEST_TYPE_LABELS,
} from '../components/FundRequestStatusBadge';
import { FundRequestTimeline } from '../components/FundRequestTimeline';

const STAGE_LABELS: Record<string, string> = {
  manager: 'Manager review',
  finance: 'Finance review',
  ceo: 'CEO approval',
  disbursement: 'Payment',
  verification: 'Receipt verification',
  closed: 'Closed',
};

const DECISION_STYLES: Record<string, string> = {
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  cancelled: 'border-slate-200 bg-slate-50 text-slate-600',
};

function formatCurrency(amount: number, currency = 'GHS') {
  try {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return `${currency} ${Number(amount || 0).toLocaleString()}`;
  }
}

function formatDate(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getErrorMessage(error: unknown, fallback: string) {
  const detail = (
    error as { response?: { data?: { detail?: unknown } } }
  )?.response?.data?.detail;

  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === 'object' && item && 'msg' in item
          ? String((item as { msg: unknown }).msg)
          : String(item)
      )
      .join(' ');
  }

  return fallback;
}

export function FundRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const access = useHRAccess();

  const [decisionNote, setDecisionNote] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const [disburseAmount, setDisburseAmount] = useState('');
  const [disburseNotes, setDisburseNotes] = useState('');

  const [receiptReference, setReceiptReference] = useState('');
  const [verificationNote, setVerificationNote] = useState('');

  const requestQuery = useQuery({
    queryKey: ['finance', 'fund-request', requestId],
    queryFn: () => financeService.getFundRequest(requestId!),
    enabled: Boolean(requestId),
  });

  const pendingApprovalQuery = useQuery({
    queryKey: ['finance', 'fund-request-approval', requestId],
    queryFn: () =>
      hrService.getApprovals({
        entity_types: 'fund_request',
        status: 'pending',
        limit: 50,
      }),
    enabled: Boolean(requestId),
  });

  const request = requestQuery.data;
  const pendingApproval = pendingApprovalQuery.data?.items.find(
    (item) => item.entity_id === requestId && item.status === 'pending'
  );

  const refresh = () => {
    void requestQuery.refetch();
    void pendingApprovalQuery.refetch();
  };

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['finance', 'fund-request', requestId],
    });
    void queryClient.invalidateQueries({
      queryKey: ['finance', 'fund-request-approval', requestId],
    });
    void queryClient.invalidateQueries({
      queryKey: ['finance', 'fund-requests'],
    });
    void queryClient.invalidateQueries({
      queryKey: ['finance', 'sidebar-overview'],
    });
  };

  const approveMutation = useMutation({
    mutationFn: () => {
      if (!pendingApproval) {
        throw new Error('No pending approval to act on.');
      }

      const amount =
        pendingApproval.stage === 'finance' &&
        approvedAmount.trim()
          ? Number(approvedAmount)
          : undefined;

      return hrService.approveRequest(
        pendingApproval.id,
        decisionNote.trim() || undefined,
        amount
      );
    },
    onSuccess: () => {
      toast.success('Decision recorded');
      setDecisionNote('');
      setApprovedAmount('');
      invalidate();
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, 'The decision could not be recorded.')
      ),
  });

  const rejectMutation = useMutation({
    mutationFn: () => {
      if (!pendingApproval) {
        throw new Error('No pending approval to act on.');
      }

      return hrService.rejectRequest(
        pendingApproval.id,
        rejectNote.trim()
      );
    },
    onSuccess: () => {
      toast.success('Claim rejected');
      setShowReject(false);
      setRejectNote('');
      invalidate();
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, 'The claim could not be rejected.')
      ),
  });

  const disburseMutation = useMutation({
    mutationFn: () =>
      financeService.disburseFundRequest(
        requestId!,
        Number(disburseAmount),
        disburseNotes.trim() || undefined
      ),
    onSuccess: () => {
      toast.success('Payment recorded');
      setDisburseNotes('');
      invalidate();
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, 'The payment could not be recorded.')
      ),
  });

  const verifyMutation = useMutation({
    mutationFn: (payload: FundRequestReceiptVerificationPayload) =>
      financeService.verifyFundRequestReceipt(requestId!, payload),
    onSuccess: (_, payload) => {
      toast.success(
        payload.verified
          ? 'Receipts verified — claim closed'
          : 'Receipts returned to the requester'
      );
      setVerificationNote('');
      invalidate();
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, 'The receipt check could not be saved.')
      ),
  });

  const receiptUploadAllowed = useMemo(() => {
    if (!request) return false;

    return (
      access.has('finance.verify') &&
      ['disbursed', 'verification_failed', 'verified'].includes(
        request.status
      )
    );
  }, [access, request]);

  if (requestQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (requestQuery.isError || !request) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/finance/fund-requests')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to fund requests
        </button>

        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

            <div>
              <h2 className="text-sm font-semibold text-red-900">
                This claim could not be loaded
              </h2>

              <p className="mt-1 text-sm text-red-700">
                {getErrorMessage(
                  requestQuery.error,
                  'The request may have been removed or is outside your access scope.'
                )}
              </p>

              <button
                type="button"
                onClick={refresh}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-red-800"
              >
                <RefreshCcw className="h-4 w-4" />
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isFinanceStage =
    pendingApproval?.stage === 'finance' &&
    pendingApproval.can_act &&
    request.status !== 'rejected' &&
    request.status !== 'cancelled';

  const canDisburse =
    request.status === 'approved' && access.has('finance.disburse');

  const awaitingReceipts =
    request.status === 'disbursed' ||
    request.status === 'verification_failed';

  const canVerify = awaitingReceipts && access.has('finance.verify');

  const disbursableAmount =
    request.approved_amount ?? request.amount_requested;

  const amountPaid = request.amount_disbursed;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/finance/fund-requests')}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to fund requests
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={requestQuery.isFetching}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCcw
                className={`h-3.5 w-3.5 ${
                  requestQuery.isFetching ? 'animate-spin' : ''
                }`}
              />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">
                {request.request_number}
              </span>

              <FundRequestStatusBadge status={request.status} />

              <FundRequestStageBadge
                stage={request.current_stage}
              />
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {request.title}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {REQUEST_TYPE_LABELS[request.request_type] ??
                request.request_type}{' '}
              · Requested by{' '}
              <span className="font-medium text-slate-700">
                {request.requester_name?.trim() || 'Unknown requester'}
              </span>{' '}
              · Submitted {formatDate(request.submitted_at)}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Requested
            </p>

            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {formatCurrency(
                request.amount_requested,
                request.currency
              )}
            </p>

            {request.approved_amount != null && (
              <p className="mt-1 text-xs text-slate-500">
                Approved:{' '}
                <span className="font-semibold text-slate-700">
                  {formatCurrency(
                    request.approved_amount,
                    request.currency
                  )}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {/* Claim details */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-base font-semibold text-slate-900">
                Claim Details
              </h2>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                <Detail
                  label="Claim type"
                  value={
                    REQUEST_TYPE_LABELS[request.request_type] ??
                    request.request_type
                  }
                />
                <Detail
                  label="Spent on"
                  value={formatDate(request.expense_date)}
                />
                <Detail
                  label="Needed by"
                  value={formatDate(request.required_by_date)}
                />
                <Detail
                  label="Currency"
                  value={request.currency}
                />
              </div>

              {request.description && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    What the money was used for
                  </p>

                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {request.description}
                  </p>
                </div>
              )}

              {request.justification && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Business justification
                  </p>

                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {request.justification}
                  </p>
                </div>
              )}

              {request.rejection_reason && (
                <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-500">
                    Rejection reason
                  </p>

                  <p className="mt-1 text-sm text-red-800">
                    {request.rejection_reason}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Documents */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <FileText className="h-4 w-4" />
              </div>

              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Supporting Documents
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  {request.documents.length} file
                  {request.documents.length === 1 ? '' : 's'} attached
                  to this claim.
                </p>
              </div>
            </div>

            <div className="p-6">
              <FundRequestDocuments
                requestId={request.id}
                documents={request.documents}
                canUpload={receiptUploadAllowed}
                onUploaded={refresh}
                emptyMessage="No supporting documents were attached."
              />
            </div>
          </section>

          {/* Approval history */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5">
              <History className="h-4 w-4 text-slate-500" />

              <h2 className="text-base font-semibold text-slate-900">
                Approval History
              </h2>
            </div>

            <div className="p-6">
              {request.approvals.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No decisions have been recorded yet.
                </p>
              ) : (
                <ol className="space-y-4">
                  {request.approvals.map((approval) => (
                    <li
                      key={approval.id}
                      className="flex items-start justify-between gap-4 rounded-lg border border-slate-100 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {STAGE_LABELS[approval.stage] ??
                              approval.stage}
                          </p>

                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              DECISION_STYLES[approval.decision] ??
                              DECISION_STYLES.pending
                            }`}
                          >
                            {approval.decision}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                          {approval.actor_name
                            ? `Decided by ${approval.actor_name}`
                            : 'Awaiting decision'}
                          {approval.decided_at
                            ? ` · ${formatDateTime(approval.decided_at)}`
                            : ''}
                        </p>

                        {approval.note && (
                          <p className="mt-2 rounded bg-slate-50 px-2.5 py-1.5 text-xs leading-5 text-slate-600">
                            {approval.note}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Summary */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Financial Summary
            </h2>

            <dl className="mt-4 space-y-3 text-sm">
              <SummaryRow
                label="Requested"
                value={formatCurrency(
                  request.amount_requested,
                  request.currency
                )}
              />

              <SummaryRow
                label="Approved"
                value={
                  request.approved_amount != null
                    ? formatCurrency(
                        request.approved_amount,
                        request.currency
                      )
                    : 'Pending'
                }
              />

              <SummaryRow
                label="Paid out"
                value={formatCurrency(
                  amountPaid,
                  request.currency
                )}
              />

              <SummaryRow
                label="Outstanding"
                value={formatCurrency(
                  Math.max(
                    (request.approved_amount ??
                      request.amount_requested) - amountPaid,
                    0
                  ),
                  request.currency
                )}
              />
            </dl>

            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <p>
                Receipt required:{' '}
                <span className="font-medium text-slate-700">
                  {request.receipt_required ? 'Yes — hardcopy' : 'No'}
                </span>
              </p>

              {request.receipt_reference && (
                <p>
                  Receipt reference:{' '}
                  <span className="font-medium text-slate-700">
                    {request.receipt_reference}
                  </span>
                </p>
              )}

              {request.receipt_verified_at && (
                <p>
                  Receipts verified:{' '}
                  <span className="font-medium text-slate-700">
                    {formatDateTime(request.receipt_verified_at)}
                  </span>
                </p>
              )}
            </div>
          </section>

          {/* Decision panel */}
          {pendingApproval && (
            <section className="rounded-xl border border-slate-900/10 bg-slate-900 p-6 text-white shadow-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-white/70" />

                <div>
                  <h2 className="text-sm font-semibold">
                    {pendingApproval.can_act
                      ? `${STAGE_LABELS[pendingApproval.stage] ??
                          'Review'} decision`
                      : `${STAGE_LABELS[pendingApproval.stage] ??
                          'Review'} in progress`}
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-white/70">
                    {pendingApproval.can_act
                      ? pendingApproval.assigned_to_name
                        ? `Assigned to ${pendingApproval.assigned_to_name}.`
                        : 'This decision is assigned to you.'
                      : pendingApproval.assigned_to_name
                        ? `Waiting on ${pendingApproval.assigned_to_name}.`
                        : 'Waiting on the assigned approver.'}
                  </p>
                </div>
              </div>

              {pendingApproval.can_act && (
                <div className="mt-5 space-y-3">
                  {isFinanceStage && (
                    <div>
                      <label
                        htmlFor="approved_amount"
                        className="mb-1.5 block text-xs font-medium text-white/80"
                      >
                        Approved amount ({request.currency})
                      </label>

                      <input
                        id="approved_amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={approvedAmount}
                        onChange={(event) =>
                          setApprovedAmount(event.target.value)
                        }
                        placeholder={String(disbursableAmount)}
                        className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
                      />

                      <p className="mt-1 text-[11px] text-white/50">
                        Leave blank to approve the full requested
                        amount.
                      </p>
                    </div>
                  )}

                  {!showReject ? (
                    <>
                      <textarea
                        rows={2}
                        value={decisionNote}
                        onChange={(event) =>
                          setDecisionNote(event.target.value)
                        }
                        placeholder="Optional note for the requester…"
                        className="w-full resize-none rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
                      />

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => approveMutation.mutate()}
                          disabled={approveMutation.isPending}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60"
                        >
                          {approveMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          Approve
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowReject(true)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <textarea
                        rows={3}
                        value={rejectNote}
                        onChange={(event) =>
                          setRejectNote(event.target.value)
                        }
                        placeholder="Explain what needs to change…"
                        className="w-full resize-none rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
                      />

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => rejectMutation.mutate()}
                          disabled={
                            !rejectNote.trim() ||
                            rejectMutation.isPending
                          }
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
                        >
                          {rejectMutation.isPending && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          Confirm rejection
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowReject(false);
                            setRejectNote('');
                          }}
                          className="inline-flex flex-1 items-center justify-center rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Disbursement */}
          {canDisburse && (
            <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

                <div>
                  <h2 className="text-sm font-semibold text-amber-950">
                    Release payment
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    Record the amount handed to the requester. The
                    claim then moves to hardcopy receipt
                    verification.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div>
                  <label
                    htmlFor="disburse_amount"
                    className="mb-1.5 block text-xs font-medium text-amber-900"
                  >
                    Amount paid ({request.currency})
                  </label>

                  <input
                    id="disburse_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={disburseAmount}
                    onChange={(event) =>
                      setDisburseAmount(event.target.value)
                    }
                    placeholder={String(disbursableAmount)}
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setDisburseAmount(String(disbursableAmount))
                    }
                    className="mt-1 text-[11px] font-semibold text-amber-800 hover:text-amber-950"
                  >
                    Use full approved amount
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={disburseNotes}
                  onChange={(event) =>
                    setDisburseNotes(event.target.value)
                  }
                  placeholder="Payment reference or note…"
                  className="w-full resize-none rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-amber-400"
                />

                <button
                  type="button"
                  onClick={() => disburseMutation.mutate()}
                  disabled={
                    disburseMutation.isPending ||
                    !disburseAmount ||
                    Number(disburseAmount) <= 0
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                >
                  {disburseMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Banknote className="h-4 w-4" />
                  )}
                  Record payment
                </button>
              </div>
            </section>
          )}

          {/* Receipt verification */}
          {canVerify && (
            <section className="rounded-xl border border-purple-200 bg-purple-50/60 p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-purple-700" />

                <div>
                  <h2 className="text-sm font-semibold text-purple-950">
                    Hardcopy receipt check
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-purple-800">
                    Only verify once the signed original receipts
                    have been handed in and match the approved claim.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <input
                  type="text"
                  value={receiptReference}
                  onChange={(event) =>
                    setReceiptReference(event.target.value)
                  }
                  placeholder="Receipt reference (optional)"
                  className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-purple-400"
                />

                <textarea
                  rows={2}
                  value={verificationNote}
                  onChange={(event) =>
                    setVerificationNote(event.target.value)
                  }
                  placeholder="Verification note — required if returning receipts…"
                  className="w-full resize-none rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-purple-400"
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      verifyMutation.mutate({
                        verified: true,
                        note: verificationNote.trim() || undefined,
                        receipt_reference:
                          receiptReference.trim() || undefined,
                      })
                    }
                    disabled={verifyMutation.isPending}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-60"
                  >
                    {verifyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Verify & close
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      verifyMutation.mutate({
                        verified: false,
                        note: verificationNote.trim(),
                        receipt_reference:
                          receiptReference.trim() || undefined,
                      })
                    }
                    disabled={
                      verifyMutation.isPending ||
                      !verificationNote.trim()
                    }
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-purple-300 bg-white px-4 py-2.5 text-sm font-semibold text-purple-700 transition hover:bg-purple-100 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Return receipts
                  </button>
                </div>
              </div>
            </section>
          )}

          {awaitingReceipts && !access.has('finance.verify') && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-xs leading-5 text-amber-800">
              Payment has been released. Finance must verify the
              signed hardcopy receipts before this claim can close.
            </section>
          )}

          {/* Workflow */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Workflow
            </h2>

            <div className="mt-4">
              <FundRequestTimeline request={request} />
            </div>
          </section>

          <p className="text-center text-[11px] text-slate-400">
            Created {formatDateTime(request.created_at)}
          </p>

          {request.status === 'verified' && (
            <Link
              to="/finance/fund-requests"
              className="flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              <CheckCircle2 className="h-4 w-4" />
              Claim fully closed
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-slate-800">
        {value || '—'}
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>

      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
