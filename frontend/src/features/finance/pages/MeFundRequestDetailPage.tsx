import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  History,
  Loader2,
  Pencil,
  RefreshCcw,
  Send,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { financeService } from '../finance.service';
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

const EDITABLE_STATUSES = new Set(['draft', 'rejected']);

const CANCELLABLE_STATUSES = new Set([
  'draft',
  'submitted',
  'manager_approved',
  'finance_approved',
]);

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

export function MeFundRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showResubmit, setShowResubmit] = useState(false);
  const [resubmitNote, setResubmitNote] = useState('');

  const requestQuery = useQuery({
    queryKey: ['me', 'fund-request', requestId],
    queryFn: () => financeService.getMyFundRequest(requestId!),
    enabled: Boolean(requestId),
  });

  const request = requestQuery.data;

  const refresh = () => {
    void requestQuery.refetch();
  };

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['me', 'fund-request', requestId],
    });
    void queryClient.invalidateQueries({
      queryKey: ['me', 'fund-requests'],
    });
    void queryClient.invalidateQueries({
      queryKey: ['workflow', 'my-approvals'],
    });
  };

  const submitMutation = useMutation({
    mutationFn: () => financeService.submitMyFundRequest(requestId!),
    onSuccess: () => {
      toast.success('Claim submitted for approval');
      invalidate();
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, 'The claim could not be submitted.')
      ),
  });

  const cancelMutation = useMutation({
    mutationFn: () => financeService.cancelMyFundRequest(requestId!),
    onSuccess: () => {
      toast.success('Claim cancelled');
      invalidate();
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, 'The claim could not be cancelled.')
      ),
  });

  const resubmitMutation = useMutation({
    mutationFn: () =>
      financeService.resubmitMyReceipt(
        requestId!,
        resubmitNote.trim() || undefined
      ),
    onSuccess: () => {
      toast.success('Receipts resubmitted to Finance');
      setShowResubmit(false);
      setResubmitNote('');
      invalidate();
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, 'The receipts could not be resubmitted.')
      ),
  });

  if (requestQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (requestQuery.isError || !request) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <button
          type="button"
          onClick={() => navigate('/me/finance')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to my claims
        </button>

        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

          <p className="text-sm text-red-700">
            This claim could not be loaded. It may have been
            removed or belongs to another employee.
          </p>
        </div>
      </div>
    );
  }

  const canEdit = EDITABLE_STATUSES.has(request.status);
  const canSubmit =
    EDITABLE_STATUSES.has(request.status) &&
    request.documents.length > 0;
  const canCancel = CANCELLABLE_STATUSES.has(request.status);
  const canResubmit = request.status === 'verification_failed';

  const busy =
    submitMutation.isPending ||
    cancelMutation.isPending ||
    resubmitMutation.isPending;

  const handleSubmit = () => {
    if (request.documents.length === 0) {
      toast.error(
        'Attach at least one supporting document before submitting.'
      );
      return;
    }

    submitMutation.mutate();
  };

  const handleCancel = () => {
    if (
      window.confirm(
        'Cancel this claim? You will not be able to resubmit it after cancelling.'
      )
    ) {
      cancelMutation.mutate();
    }
  };

  const amountToPay =
    (request.approved_amount ?? request.amount_requested) -
    request.amount_disbursed;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/me/finance')}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to my claims
          </button>

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
                request.request_type}
              {request.expense_date
                ? ` · Spent ${formatDate(request.expense_date)}`
                : ''}
              {request.submitted_at
                ? ` · Submitted ${formatDate(request.submitted_at)}`
                : ''}
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
                Approved{' '}
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

        {/* Actions */}
        {(canEdit || canSubmit || canCancel || canResubmit) && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            {canEdit && (
              <Link
                to={`/me/finance/${request.id}/edit`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit claim
              </Link>
            )}

            {canSubmit && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {request.status === 'rejected'
                  ? 'Resubmit for approval'
                  : 'Submit for approval'}
              </button>
            )}

            {canResubmit && (
              <button
                type="button"
                onClick={() => setShowResubmit((current) => !current)}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-purple-700"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                Resubmit receipts
              </button>
            )}

            {canCancel && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={busy}
                className="ml-auto inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Cancel claim
              </button>
            )}
          </div>
        )}

        {showResubmit && canResubmit && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <p className="text-sm font-semibold text-purple-950">
              Resubmit hardcopy receipts
            </p>

            <p className="mt-1 text-xs leading-5 text-purple-800">
              Upload the corrected or signed receipts above, then
              tell Finance what changed.
            </p>

            <textarea
              rows={2}
              value={resubmitNote}
              onChange={(event) =>
                setResubmitNote(event.target.value)
              }
              placeholder="What did you correct or add? (optional)"
              className="mt-3 w-full resize-none rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-purple-400"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => resubmitMutation.mutate()}
                disabled={resubmitMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-60"
              >
                {resubmitMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Send to Finance
              </button>

              <button
                type="button"
                onClick={() => setShowResubmit(false)}
                className="inline-flex items-center gap-2 rounded-lg border border-purple-200 bg-white px-4 py-2 text-sm font-semibold text-purple-700 transition hover:bg-purple-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
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
                    Why it was rejected
                  </p>

                  <p className="mt-1 text-sm text-red-800">
                    {request.rejection_reason}
                  </p>

                  <p className="mt-2 text-xs text-red-600">
                    Edit the claim, add any missing receipts, and
                    resubmit it.
                  </p>
                </div>
              )}
            </div>
          </section>

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
                canUpload={
                  EDITABLE_STATUSES.has(request.status) ||
                  request.status === 'verification_failed'
                }
                onUploaded={refresh}
                emptyMessage="Attach your receipts, invoices or quotations so the claim can be reviewed."
              />
            </div>
          </section>

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
                      className="rounded-lg border border-slate-100 px-4 py-3"
                    >
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
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
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
                label="Paid to you"
                value={formatCurrency(
                  request.amount_disbursed,
                  request.currency
                )}
              />

              {amountToPay > 0 && request.status === 'approved' && (
                <SummaryRow
                  label="Due"
                  value={formatCurrency(
                    amountToPay,
                    request.currency
                  )}
                />
              )}
            </dl>

            {request.receipt_reference && (
              <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
                Receipt reference:{' '}
                <span className="font-medium text-slate-700">
                  {request.receipt_reference}
                </span>
              </p>
            )}
          </section>

          {(request.status === 'disbursed' ||
            request.status === 'verification_failed') && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

                <div>
                  <h2 className="text-sm font-semibold text-amber-950">
                    {request.status === 'verification_failed'
                      ? 'Receipts returned by Finance'
                      : 'Hand in your hardcopy receipts'}
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    {request.status === 'verification_failed'
                      ? 'Finance could not verify the receipts. Correct them, upload them, then resubmit.'
                      : 'Give the signed original receipts to Finance. The claim stays open until they are verified.'}
                  </p>

                  {request.receipt_verification_note && (
                    <p className="mt-2 rounded bg-white/60 px-2.5 py-1.5 text-xs text-amber-900">
                      {request.receipt_verification_note}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {request.status === 'verified' && (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

                <div>
                  <h2 className="text-sm font-semibold text-emerald-950">
                    Claim verified and closed
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-emerald-800">
                    Finance has checked the signed hardcopy
                    receipts. No further action is needed.
                  </p>
                </div>
              </div>
            </section>
          )}

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
