import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import { expenseService } from '../expense.service';
import type { Expense, ExpenseStatus } from '../expense.types';

const statusLabels: Record<ExpenseStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
  reconciled: 'Reconciled',
};

const statusStyles: Record<ExpenseStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-amber-50 text-amber-700',
  under_review: 'bg-blue-50 text-blue-700',
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
    currency,
    minimumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function formatDate(value?: string | null) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getErrorMessage(error: any) {
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    'Something went wrong. Please try again.'
  );
}

export function ExpenseDetailPage() {
  const { expenseId } = useParams();
  const navigate = useNavigate();

  const [expense, setExpense] = useState<Expense | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] = useState<string | null>(
    null
  );

  const [actionError, setActionError] =
    useState<string | null>(null);

  const [showRejectForm, setShowRejectForm] =
    useState(false);

  const [rejectionReason, setRejectionReason] =
    useState('');

  const [reviewNotes, setReviewNotes] =
    useState('');

  const [approvalNotes, setApprovalNotes] =
    useState('');

  const [paymentNotes, setPaymentNotes] =
    useState('');

  const [reconciliationNotes, setReconciliationNotes] =
    useState('');

  const loadExpense = async () => {
    if (!expenseId) {
      setError('Expense ID is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data =
        await expenseService.getExpense(expenseId);

      setExpense(data);
    } catch (err) {
      console.error(
        'Failed to load expense:',
        err
      );

      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpense();
  }, [expenseId]);

  const workflow = useMemo(() => {
    if (!expense) return [];

    return [
      {
        label: 'Created',
        date: expense.created_at,
        completed: true,
      },
      {
        label: 'Submitted',
        date: expense.submitted_at,
        completed: Boolean(expense.submitted_at),
      },
      {
        label: 'Under Review',
        date: expense.reviewed_at,
        completed: Boolean(expense.reviewed_at),
      },
      {
        label: 'Approved',
        date: expense.approved_at,
        completed: Boolean(expense.approved_at),
      },
      {
        label: 'Paid',
        date: expense.paid_at,
        completed: Boolean(expense.paid_at),
      },
      {
        label: 'Reconciled',
        date: expense.reconciled_at,
        completed: Boolean(expense.reconciled_at),
      },
    ];
  }, [expense]);

  const performAction = async (
    action: () => Promise<Expense>
  ) => {
    try {
      setActionLoading(true);
      setActionError(null);

      const updated = await action();

      setExpense(updated);
      setShowRejectForm(false);
      setRejectionReason('');
    } catch (err) {
      console.error(
        'Expense workflow action failed:',
        err
      );

      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = () =>
    performAction(() =>
      expenseService.submitExpense(expense!.id)
    );

  const handleReview = () =>
    performAction(() =>
      expenseService.reviewExpense(
        expense!.id,
        reviewNotes.trim() || undefined
      )
    );

  const handleApprove = () =>
    performAction(() =>
      expenseService.approveExpense(
        expense!.id,
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
      expenseService.rejectExpense(
        expense!.id,
        rejectionReason.trim()
      )
    );
  };

  const handlePay = () =>
    performAction(() =>
      expenseService.payExpense(
        expense!.id,
        paymentNotes.trim() || undefined
      )
    );

  const handleReconcile = () =>
    performAction(() =>
      expenseService.reconcileExpense(
        expense!.id,
        reconciliationNotes.trim() || undefined
      )
    );

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading expense...
        </div>
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="space-y-5">
        <Link
          to="/finance/expenses"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Expenses
        </Link>

        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="font-semibold text-red-900">
            Unable to load expense
          </h1>

          <p className="mt-2 text-sm text-red-700">
            {error || 'Expense not found.'}
          </p>
        </div>
      </div>
    );
  }

  const isBusy = actionLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="border-b border-slate-200 pb-6">
        <Link
          to="/finance/expenses"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Expenses
        </Link>

        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-slate-500">
                {expense.expense_number}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  statusStyles[expense.status]
                }`}
              >
                {statusLabels[expense.status]}
              </span>
            </div>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {expense.title}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Finance / Expenditure / Expense Detail
            </p>
          </div>

          <div className="text-left lg:text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Expense Amount
            </p>

            <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              {formatAmount(
                expense.amount,
                expense.currency
              )}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Incurred {formatDate(expense.incurred_date)}
            </p>
          </div>
        </div>
      </section>

      {/* Action error */}
      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Workflow actions */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-slate-600" />

            <div>
              <h2 className="font-semibold text-slate-900">
                Workflow Actions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Actions available for the current expense
                state.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 p-6">
          {expense.status === 'draft' && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isBusy}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {isBusy
                ? 'Submitting...'
                : 'Submit Expense'}
            </button>
          )}

          {expense.status === 'submitted' && (
            <div className="flex w-full flex-col gap-3 md:max-w-xl">
              <textarea
                value={reviewNotes}
                onChange={(event) =>
                  setReviewNotes(event.target.value)
                }
                rows={3}
                placeholder="Optional review notes..."
                disabled={isBusy}
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              />

              <button
                type="button"
                onClick={handleReview}
                disabled={isBusy}
                className="inline-flex w-fit items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <Clock3 className="h-4 w-4" />
                {isBusy
                  ? 'Reviewing...'
                  : 'Move to Review'}
              </button>
            </div>
          )}

          {expense.status === 'under_review' && (
            <div className="w-full space-y-4">
              <textarea
                value={approvalNotes}
                onChange={(event) =>
                  setApprovalNotes(
                    event.target.value
                  )
                }
                rows={3}
                placeholder="Optional approval notes..."
                disabled={isBusy}
                className="w-full max-w-xl resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isBusy}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve Expense
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setShowRejectForm(
                      (current) => !current
                    )
                  }
                  disabled={isBusy}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </div>

              {showRejectForm && (
                <div className="max-w-xl rounded-lg border border-red-200 bg-red-50 p-4">
                  <label className="block text-sm font-medium text-red-900">
                    Rejection Reason
                  </label>

                  <textarea
                    value={rejectionReason}
                    onChange={(event) =>
                      setRejectionReason(
                        event.target.value
                      )
                    }
                    rows={3}
                    placeholder="Explain why this expense is being rejected..."
                    disabled={isBusy}
                    className="mt-2 w-full resize-none rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  />

                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={
                      isBusy ||
                      !rejectionReason.trim()
                    }
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" />
                    Confirm Rejection
                  </button>
                </div>
              )}
            </div>
          )}

          {expense.status === 'approved' && (
            <div className="flex w-full flex-col gap-3 md:max-w-xl">
              <textarea
                value={paymentNotes}
                onChange={(event) =>
                  setPaymentNotes(
                    event.target.value
                  )
                }
                rows={3}
                placeholder="Optional payment notes..."
                disabled={isBusy}
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              />

              <button
                type="button"
                onClick={handlePay}
                disabled={isBusy}
                className="inline-flex w-fit items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <CreditCard className="h-4 w-4" />
                {isBusy
                  ? 'Recording Payment...'
                  : 'Record Payment'}
              </button>
            </div>
          )}

          {expense.status === 'paid' && (
            <div className="flex w-full flex-col gap-3 md:max-w-xl">
              <textarea
                value={reconciliationNotes}
                onChange={(event) =>
                  setReconciliationNotes(
                    event.target.value
                  )
                }
                rows={3}
                placeholder="Enter reconciliation notes..."
                disabled={isBusy}
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              />

              <button
                type="button"
                onClick={handleReconcile}
                disabled={isBusy}
                className="inline-flex w-fit items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isBusy
                  ? 'Reconciling...'
                  : 'Reconcile Expense'}
              </button>
            </div>
          )}

          {expense.status === 'rejected' && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              This expense has been rejected and cannot
              proceed through the current workflow.
            </div>
          )}

          {expense.status === 'reconciled' && (
            <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
              <CheckCircle2 className="h-4 w-4" />
              This expense has completed the finance
              workflow and has been reconciled.
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Main details */}
        <div className="space-y-6 xl:col-span-2">
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="font-semibold text-slate-900">
                Expense Information
              </h2>
            </div>

            <div className="grid gap-6 p-6 sm:grid-cols-2">
              <DetailItem
                label="Category"
                value={expense.category || '—'}
              />

              <DetailItem
                label="Expense Date"
                value={formatDate(
                  expense.incurred_date
                )}
              />

              <DetailItem
                label="Currency"
                value={expense.currency}
              />

              <DetailItem
                label="Payment Method"
                value={
                  expense.payment_method || '—'
                }
              />

              <DetailItem
                label="Vendor / Payee"
                value={
                  expense.vendor_name || '—'
                }
              />

              <DetailItem
                label="Reference"
                value={expense.reference || '—'}
              />

              <DetailItem
                label="Requester ID"
                value={expense.requester_id}
              />

              <DetailItem
                label="Created"
                value={formatDateTime(
                  expense.created_at
                )}
              />
            </div>

            {expense.description && (
              <div className="border-t border-slate-200 px-6 py-5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Description
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {expense.description}
                </p>
              </div>
            )}
          </section>

          {/* Organisational context */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="font-semibold text-slate-900">
                Organisational Context
              </h2>
            </div>

            <div className="grid gap-6 p-6 sm:grid-cols-3">
              <DetailItem
                label="Department"
                value={
                  expense.department_id || 'Not assigned'
                }
              />

              <DetailItem
                label="Programme"
                value={
                  expense.programme_id || 'Not assigned'
                }
              />

              <DetailItem
                label="Project"
                value={
                  expense.project_id || 'Not assigned'
                }
              />
            </div>
          </section>

          {/* Notes */}
          {(expense.review_notes ||
            expense.approval_notes ||
            expense.rejection_reason ||
            expense.payment_notes ||
            expense.reconciliation_notes) && (
            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="font-semibold text-slate-900">
                  Workflow Notes
                </h2>
              </div>

              <div className="space-y-5 p-6">
                {expense.review_notes && (
                  <NoteBlock
                    label="Review Notes"
                    value={expense.review_notes}
                  />
                )}

                {expense.approval_notes && (
                  <NoteBlock
                    label="Approval Notes"
                    value={expense.approval_notes}
                  />
                )}

                {expense.rejection_reason && (
                  <NoteBlock
                    label="Rejection Reason"
                    value={expense.rejection_reason}
                    danger
                  />
                )}

                {expense.payment_notes && (
                  <NoteBlock
                    label="Payment Notes"
                    value={expense.payment_notes}
                  />
                )}

                {expense.reconciliation_notes && (
                  <NoteBlock
                    label="Reconciliation Notes"
                    value={
                      expense.reconciliation_notes
                    }
                  />
                )}
              </div>
            </section>
          )}
        </div>

        {/* Workflow timeline */}
        <aside>
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="font-semibold text-slate-900">
                Workflow
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Finance processing history
              </p>
            </div>

            <div className="p-6">
              <div className="space-y-0">
                {workflow.map((step, index) => (
                  <div
                    key={step.label}
                    className="relative flex gap-4"
                  >
                    {index <
                      workflow.length - 1 && (
                      <div
                        className={`absolute left-[9px] top-5 h-full w-px ${
                          workflow[index + 1]
                            .completed
                            ? 'bg-slate-300'
                            : 'bg-slate-200'
                        }`}
                      />
                    )}

                    <div className="relative z-10 pt-0.5">
                      {step.completed ? (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900">
                          <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-slate-300 bg-white" />
                      )}
                    </div>

                    <div className="pb-7">
                      <p
                        className={`text-sm font-medium ${
                          step.completed
                            ? 'text-slate-900'
                            : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {step.completed
                          ? formatDateTime(step.date)
                          : 'Pending'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-medium text-slate-900">
        {value}
      </p>
    </div>
  );
}

function NoteBlock({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        danger
          ? 'border-red-200 bg-red-50'
          : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p
        className={`text-xs font-medium uppercase tracking-wide ${
          danger
            ? 'text-red-700'
            : 'text-slate-500'
        }`}
      >
        {label}
      </p>

      <p
        className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${
          danger
            ? 'text-red-800'
            : 'text-slate-700'
        }`}
      >
        {value}
      </p>
    </div>
  );
}