import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  FileText,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import { reimbursementService } from '../reimbursement.service';

import type {
  Reimbursement,
  ReimbursementStatus,
} from '../reimbursement.types';

const STATUS_LABELS: Record<
  ReimbursementStatus,
  string
> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
  reconciled: 'Reconciled',
};

const STATUS_STYLES: Record<
  ReimbursementStatus,
  string
> = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-blue-50 text-blue-700',
  under_review: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  paid: 'bg-violet-50 text-violet-700',
  reconciled: 'bg-teal-50 text-teal-700',
};

function formatAmount(
  amount: number,
  currency: string
) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: currency || 'GHS',
    minimumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function formatDate(
  value?: string | null
) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDateOnly(
  value?: string | null
) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getErrorMessage(error: any) {
  const detail = error?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail
      .map(
        (item: any) =>
          item?.msg || 'Validation error'
      )
      .join(', ');
  }

  return (
    detail ||
    error?.response?.data?.message ||
    error?.message ||
    'Something went wrong. Please try again.'
  );
}

export function ReimbursementDetailPage() {
  const { reimbursementId } = useParams();

  const [
    reimbursement,
    setReimbursement,
  ] = useState<Reimbursement | null>(null);

  const [loading, setLoading] = useState(true);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] = useState<
    string | null
  >(null);

  const [actionError, setActionError] =
    useState<string | null>(null);

  const [reviewNotes, setReviewNotes] =
    useState('');

  const [approvalNotes, setApprovalNotes] =
    useState('');

  const [rejectionReason, setRejectionReason] =
    useState('');

  const [paymentNotes, setPaymentNotes] =
    useState('');

  const [
    reconciliationNotes,
    setReconciliationNotes,
  ] = useState('');

  const [showReviewForm, setShowReviewForm] =
    useState(false);

  const [showApprovalForm, setShowApprovalForm] =
    useState(false);

  const [showRejectForm, setShowRejectForm] =
    useState(false);

  const [showPaymentForm, setShowPaymentForm] =
    useState(false);

  const [
    showReconciliationForm,
    setShowReconciliationForm,
  ] = useState(false);

  const loadReimbursement = async () => {
    if (!reimbursementId) {
      setError('Reimbursement ID is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data =
        await reimbursementService.getReimbursement(
          reimbursementId
        );

      setReimbursement(data);
    } catch (err) {
      console.error(
        'Failed to load reimbursement:',
        err
      );

      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReimbursement();
  }, [reimbursementId]);

  const workflow = useMemo(() => {
    if (!reimbursement) return [];

    return [
      {
        label: 'Created',
        date: reimbursement.created_at,
        completed: true,
      },
      {
        label: 'Submitted',
        date: reimbursement.submitted_at,
        completed: Boolean(
          reimbursement.submitted_at
        ),
      },
      {
        label: 'Under Review',
        date: reimbursement.reviewed_at,
        completed: Boolean(
          reimbursement.reviewed_at
        ),
      },
      {
        label: 'Approved',
        date: reimbursement.approved_at,
        completed: Boolean(
          reimbursement.approved_at
        ),
      },
      {
        label: 'Paid',
        date: reimbursement.paid_at,
        completed: Boolean(
          reimbursement.paid_at
        ),
      },
      {
        label: 'Reconciled',
        date: reimbursement.reconciled_at,
        completed: Boolean(
          reimbursement.reconciled_at
        ),
      },
    ];
  }, [reimbursement]);

  const performAction = async (
    action: () => Promise<Reimbursement>
  ) => {
    try {
      setActionLoading(true);
      setActionError(null);

      const updated = await action();

      setReimbursement(updated);

      setShowReviewForm(false);
      setShowApprovalForm(false);
      setShowRejectForm(false);
      setShowPaymentForm(false);
      setShowReconciliationForm(false);
    } catch (err) {
      console.error(
        'Reimbursement workflow action failed:',
        err
      );

      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = () =>
    performAction(() =>
      reimbursementService.submitReimbursement(
        reimbursement!.id
      )
    );

  const handleReview = () =>
    performAction(() =>
      reimbursementService.reviewReimbursement(
        reimbursement!.id,
        reviewNotes.trim() || undefined
      )
    );

  const handleApprove = () =>
    performAction(() =>
      reimbursementService.approveReimbursement(
        reimbursement!.id,
        approvalNotes.trim() || undefined
      )
    );

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      setActionError(
        'A rejection reason is required.'
      );
      return;
    }

    performAction(() =>
      reimbursementService.rejectReimbursement(
        reimbursement!.id,
        rejectionReason.trim()
      )
    );
  };

  const handlePay = () =>
    performAction(() =>
      reimbursementService.payReimbursement(
        reimbursement!.id,
        paymentNotes.trim() || undefined
      )
    );

  const handleReconcile = () =>
    performAction(() =>
      reimbursementService.reconcileReimbursement(
        reimbursement!.id,
        reconciliationNotes.trim() || undefined
      )
    );

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading reimbursement...
        </div>
      </div>
    );
  }

  if (error || !reimbursement) {
    return (
      <div className="space-y-5">
        <Link
          to="/finance/reimbursements"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Reimbursements
        </Link>

        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />

            <div>
              <h1 className="font-semibold text-red-900">
                Unable to load reimbursement
              </h1>

              <p className="mt-2 text-sm text-red-700">
                {error ||
                  'Reimbursement not found.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isBusy = actionLoading;

  const canSubmit =
    reimbursement.status === 'draft';

  const canReview =
    reimbursement.status === 'submitted';

  const canApprove =
    reimbursement.status === 'under_review';

  const canReject =
    reimbursement.status === 'submitted' ||
    reimbursement.status === 'under_review';

  const canPay =
    reimbursement.status === 'approved';

  const canReconcile =
    reimbursement.status === 'paid';

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="border-b border-slate-200 pb-6">
        <Link
          to="/finance/reimbursements"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Reimbursements
        </Link>

        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-slate-500">
                {reimbursement.reimbursement_number}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  STATUS_STYLES[
                    reimbursement.status
                  ]
                }`}
              >
                {
                  STATUS_LABELS[
                    reimbursement.status
                  ]
                }
              </span>
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {reimbursement.title}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {reimbursement.description ||
                'Employee reimbursement request.'}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <ShieldCheck className="h-5 w-5 text-slate-600" />

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Reimbursement
              </p>

              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {formatAmount(
                  reimbursement.amount,
                  reimbursement.currency
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Action error */}
      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />

            <div>
              <p className="text-sm font-semibold text-red-900">
                Workflow action failed
              </p>

              <p className="mt-1 text-sm text-red-700">
                {actionError}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Workflow */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-slate-100 p-2">
            <Clock3 className="h-5 w-5 text-slate-600" />
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Reimbursement Workflow
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Track the request from submission through
              reconciliation.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-6">
          {workflow.map((step, index) => (
            <div
              key={step.label}
              className="relative"
            >
              {index < workflow.length - 1 && (
                <div
                  className={`absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-4 hidden h-px md:block ${
                    workflow[index + 1].completed
                      ? 'bg-emerald-300'
                      : 'bg-slate-200'
                  }`}
                />
              )}

              <div className="relative flex flex-col items-center text-center">
                {step.completed ? (
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                ) : (
                  <Circle className="h-8 w-8 text-slate-300" />
                )}

                <p
                  className={`mt-2 text-xs font-semibold ${
                    step.completed
                      ? 'text-slate-800'
                      : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </p>

                <p className="mt-1 text-[11px] text-slate-400">
                  {step.completed
                    ? formatDate(step.date)
                    : 'Pending'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      {(canSubmit ||
        canReview ||
        canApprove ||
        canReject ||
        canPay ||
        canReconcile) && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 p-2">
              <Send className="h-5 w-5 text-slate-600" />
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Workflow Actions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Available actions for the current
                reimbursement status.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {canSubmit && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />

                {isBusy
                  ? 'Processing...'
                  : 'Submit Reimbursement'}
              </button>
            )}

            {canReview && (
              <button
                type="button"
                onClick={() =>
                  setShowReviewForm(
                    (current) => !current
                  )
                }
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Clock3 className="h-4 w-4" />
                Review Reimbursement
              </button>
            )}

            {canApprove && (
              <button
                type="button"
                onClick={() =>
                  setShowApprovalForm(
                    (current) => !current
                  )
                }
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve Reimbursement
              </button>
            )}

            {canReject && (
              <button
                type="button"
                onClick={() =>
                  setShowRejectForm(
                    (current) => !current
                  )
                }
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>
            )}

            {canPay && (
              <button
                type="button"
                onClick={() =>
                  setShowPaymentForm(
                    (current) => !current
                  )
                }
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                Record Payment
              </button>
            )}

            {canReconcile && (
              <button
                type="button"
                onClick={() =>
                  setShowReconciliationForm(
                    (current) => !current
                  )
                }
                disabled={isBusy}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                Reconcile
              </button>
            )}
          </div>

          {/* Review form */}
          {showReviewForm && canReview && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <label className="block text-sm font-medium text-amber-900">
                Review Notes
              </label>

              <textarea
                value={reviewNotes}
                onChange={(event) =>
                  setReviewNotes(
                    event.target.value
                  )
                }
                rows={4}
                placeholder="Add review notes if necessary..."
                disabled={isBusy}
                className="mt-2 w-full resize-none rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-50"
              />

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleReview}
                  disabled={isBusy}
                  className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {isBusy
                    ? 'Processing...'
                    : 'Move to Review'}
                </button>
              </div>
            </div>
          )}

          {/* Approval form */}
          {showApprovalForm && canApprove && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <label className="block text-sm font-medium text-emerald-900">
                Approval Notes
              </label>

              <textarea
                value={approvalNotes}
                onChange={(event) =>
                  setApprovalNotes(
                    event.target.value
                  )
                }
                rows={4}
                placeholder="Add approval notes if necessary..."
                disabled={isBusy}
                className="mt-2 w-full resize-none rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
              />

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isBusy}
                  className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {isBusy
                    ? 'Processing...'
                    : 'Approve Reimbursement'}
                </button>
              </div>
            </div>
          )}

          {/* Rejection form */}
          {showRejectForm && canReject && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5">
              <label className="block text-sm font-medium text-red-900">
                Rejection Reason
                <span className="text-red-500"> *</span>
              </label>

              <textarea
                value={rejectionReason}
                onChange={(event) =>
                  setRejectionReason(
                    event.target.value
                  )
                }
                rows={4}
                placeholder="Explain why this reimbursement is being rejected..."
                disabled={isBusy}
                className="mt-2 w-full resize-none rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:bg-slate-50"
              />

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isBusy}
                  className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isBusy
                    ? 'Processing...'
                    : 'Reject Reimbursement'}
                </button>
              </div>
            </div>
          )}

          {/* Payment form */}
          {showPaymentForm && canPay && (
            <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-5">
              <label className="block text-sm font-medium text-violet-900">
                Payment Notes
              </label>

              <textarea
                value={paymentNotes}
                onChange={(event) =>
                  setPaymentNotes(
                    event.target.value
                  )
                }
                rows={4}
                placeholder="Record payment reference, method or other relevant notes..."
                disabled={isBusy}
                className="mt-2 w-full resize-none rounded-lg border border-violet-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-50"
              />

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={isBusy}
                  className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {isBusy
                    ? 'Processing...'
                    : 'Record Payment'}
                </button>
              </div>
            </div>
          )}

          {/* Reconciliation form */}
          {showReconciliationForm &&
            canReconcile && (
              <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-5">
                <label className="block text-sm font-medium text-teal-900">
                  Reconciliation Notes
                </label>

                <textarea
                  value={reconciliationNotes}
                  onChange={(event) =>
                    setReconciliationNotes(
                      event.target.value
                    )
                  }
                  rows={4}
                  placeholder="Record the reconciliation outcome and any supporting notes..."
                  disabled={isBusy}
                  className="mt-2 w-full resize-none rounded-lg border border-teal-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50"
                />

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleReconcile}
                    disabled={isBusy}
                    className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
                  >
                    {isBusy
                      ? 'Processing...'
                      : 'Reconcile Reimbursement'}
                  </button>
                </div>
              </div>
            )}
        </section>
      )}

      {/* Financial summary */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-base font-semibold text-slate-900">
            Financial Summary
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Financial information associated with this
            reimbursement request.
          </p>
        </div>

        <div className="grid gap-px bg-slate-200 md:grid-cols-3">
          <div className="bg-white p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Requested
            </p>

            <p className="mt-2 text-xl font-semibold text-slate-900">
              {formatAmount(
                reimbursement.amount,
                reimbursement.currency
              )}
            </p>
          </div>

          <div className="bg-white p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Status
            </p>

            <p className="mt-2 text-sm font-semibold text-slate-900">
              {
                STATUS_LABELS[
                  reimbursement.status
                ]
              }
            </p>
          </div>

          <div className="bg-white p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Expense Date
            </p>

            <p className="mt-2 text-sm font-semibold text-slate-900">
              {formatDateOnly(
                reimbursement.incurred_date
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Details */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 p-2">
              <FileText className="h-5 w-5 text-slate-600" />
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Reimbursement Details
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Information captured when the request was
                created.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Category
            </p>

            <p className="mt-1 text-sm font-medium text-slate-900">
              {reimbursement.category || '—'}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Payment Method
            </p>

            <p className="mt-1 text-sm font-medium text-slate-900">
              {reimbursement.payment_method ||
                '—'}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Vendor / Payee
            </p>

            <p className="mt-1 text-sm font-medium text-slate-900">
              {reimbursement.vendor_name || '—'}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Vendor Reference
            </p>

            <p className="mt-1 text-sm font-medium text-slate-900">
              {reimbursement.vendor_reference ||
                '—'}
            </p>
          </div>

          <div className="md:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Description
            </p>

            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {reimbursement.description || '—'}
            </p>
          </div>
        </div>
      </section>

      {/* Workflow notes */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-base font-semibold text-slate-900">
            Workflow Notes
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Notes recorded during review, approval,
            payment and reconciliation.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          <div className="p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Review Notes
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {reimbursement.review_notes || '—'}
            </p>
          </div>

          <div className="p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Approval Notes
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {reimbursement.approval_notes ||
                '—'}
            </p>
          </div>

          <div className="p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Rejection Reason
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {reimbursement.rejection_reason ||
                '—'}
            </p>
          </div>

          <div className="p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Payment Notes
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {reimbursement.payment_notes || '—'}
            </p>
          </div>

          <div className="p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Reconciliation Notes
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {reimbursement.reconciliation_notes ||
                '—'}
            </p>
          </div>
        </div>
      </section>

      {/* Record information */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">
          Record Information
        </h2>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Created
            </p>

            <p className="mt-1 text-sm text-slate-700">
              {formatDate(
                reimbursement.created_at
              )}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Last Updated
            </p>

            <p className="mt-1 text-sm text-slate-700">
              {formatDate(
                reimbursement.updated_at
              )}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Requester ID
            </p>

            <p className="mt-1 break-all text-sm text-slate-700">
              {reimbursement.requester_id}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Reimbursement ID
            </p>

            <p className="mt-1 break-all text-sm text-slate-700">
              {reimbursement.id}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}