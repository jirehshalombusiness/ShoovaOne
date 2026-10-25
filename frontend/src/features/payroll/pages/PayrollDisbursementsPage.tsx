import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Download,
  Landmark,
  Loader2,
  Plus,
  RefreshCcw,
  RotateCcw,
  Send,
  ShieldCheck,
  Smartphone,
  X,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { PayrollStatusBadge } from '../PayrollStatusBadge';
import { payrollService } from '../payroll.service';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  getErrorMessage,
  inputClasses,
  labelClasses,
  titleCase,
} from '../payroll.utils';
import { useHRAccess } from '@/hooks/useHRAccess';
import type { DisbursementBatch, DisbursementItem, PayRun } from '../payroll.types';

const STATUS_OPTIONS = [
  '',
  'pending_approval',
  'approved',
  'processing',
  'partially_paid',
  'paid',
  'failed',
];

const METHOD_OPTIONS = [
  { value: 'bank_transfer', label: 'Bank transfer / direct deposit', icon: Landmark },
  { value: 'mobile_money', label: 'Mobile money', icon: Smartphone },
  { value: 'check', label: 'Cheque', icon: CreditCard },
  { value: 'cash', label: 'Cash', icon: Banknote },
];

const METHOD_ICONS: Record<string, typeof Landmark> = {
  bank_transfer: Landmark,
  mobile_money: Smartphone,
  check: CreditCard,
  cash: Banknote,
};

export function PayrollDisbursementsPage() {
  const access = useHRAccess();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const canCreate = access.has(['payroll.disburse', 'payroll.review_finance']);
  const canApprove = access.has(['payroll.approve', 'payroll.review_finance']);

  const batchesQuery = useQuery({
    queryKey: ['payroll', 'disbursements', status],
    queryFn: () =>
      payrollService.getDisbursements(status ? { status } : undefined),
  });

  const runsQuery = useQuery({
    queryKey: ['payroll', 'runs', 'finalized'],
    queryFn: () => payrollService.getRuns(),
  });

  const batches = batchesQuery.data ?? [];
  const payableRuns = useMemo(
    () =>
      (runsQuery.data ?? []).filter((run) =>
        ['finalized', 'disbursing'].includes(run.status),
      ),
    [runsQuery.data],
  );

  const loading = batchesQuery.isLoading;
  const error = batchesQuery.error;

  const totals = useMemo(
    () =>
      batches.reduce(
        (acc, batch) => {
          if (['cancelled', 'failed'].includes(batch.status)) return acc;
          acc.amount += Number(batch.control_total);
          acc.people += batch.control_count;
          return acc;
        },
        { amount: 0, people: 0 },
      ),
    [batches],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['payroll', 'disbursements'] });
    queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] });
    queryClient.invalidateQueries({ queryKey: ['payroll', 'overview'] });
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => payrollService.approveDisbursement(id),
    onSuccess: (batch) => {
      invalidate();
      toast.success(`Batch ${batch.batch_number} approved.`);
    },
    onError: (mutationError) =>
      toast.error(getErrorMessage(mutationError, 'Could not approve the batch')),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => payrollService.submitDisbursement(id),
    onSuccess: (batch) => {
      invalidate();
      toast.success(
        `Batch ${batch.batch_number} submitted for payment. Reconcile the outcome when the provider confirms.`,
      );
    },
    onError: (mutationError) =>
      toast.error(getErrorMessage(mutationError, 'Could not submit the batch')),
  });

  const reconcileBatchMutation = useMutation({
    mutationFn: ({
      id,
      outcome,
      failure_reason,
    }: {
      id: string;
      outcome: 'paid' | 'failed';
      failure_reason?: string;
    }) =>
      payrollService.reconcileDisbursement(id, outcome, { failure_reason }),
    onSuccess: (batch) => {
      invalidate();
      toast.success(`Batch ${batch.batch_number} reconciled.`);
    },
    onError: (mutationError) =>
      toast.error(getErrorMessage(mutationError, 'Could not reconcile the batch')),
  });

  const reconcileItemMutation = useMutation({
    mutationFn: ({
      itemId,
      itemStatus,
      failure_reason,
    }: {
      itemId: string;
      itemStatus: 'paid' | 'failed';
      failure_reason?: string;
    }) =>
      payrollService.reconcileDisbursementItem(itemId, itemStatus, {
        failure_reason,
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Payment item updated.');
    },
    onError: (mutationError) =>
      toast.error(getErrorMessage(mutationError, 'Could not update the payment item')),
  });

  const retryItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      payrollService.retryDisbursementItem(itemId),
    onSuccess: () => {
      invalidate();
      toast.success('Payment item queued for retry.');
    },
    onError: (mutationError) =>
      toast.error(getErrorMessage(mutationError, 'Could not retry the payment item')),
  });

  const downloadMutation = useMutation({
    mutationFn: (batch: DisbursementBatch) => payrollService.downloadBankFile(batch),
    onError: (mutationError) =>
      toast.error(getErrorMessage(mutationError, 'Could not download the bank file')),
  });

  const markBatch = (batch: DisbursementBatch, outcome: 'paid' | 'failed') => {
    if (outcome === 'paid') {
      if (
        !window.confirm(
          `Mark all outstanding payments in ${batch.batch_number} as paid? This records the provider confirmation.`,
        )
      ) {
        return;
      }
      reconcileBatchMutation.mutate({ id: batch.id, outcome });
      return;
    }

    const reason = window.prompt(
      `Reason for marking ${batch.batch_number} as failed:`,
      'Provider rejected the batch',
    );
    if (reason === null) return;
    reconcileBatchMutation.mutate({
      id: batch.id,
      outcome,
      failure_reason: reason.trim() || undefined,
    });
  };

  const markItem = (item: DisbursementItem, itemStatus: 'paid' | 'failed') => {
    if (itemStatus === 'paid') {
      reconcileItemMutation.mutate({ itemId: item.id, itemStatus });
      return;
    }
    const reason = window.prompt(
      `Reason payment to ${item.person_name} failed:`,
      item.failure_reason ?? '',
    );
    if (reason === null) return;
    reconcileItemMutation.mutate({
      itemId: item.id,
      itemStatus,
      failure_reason: reason.trim() || undefined,
    });
  };

  const busy =
    approveMutation.isPending ||
    submitMutation.isPending ||
    reconcileBatchMutation.isPending ||
    reconcileItemMutation.isPending ||
    retryItemMutation.isPending;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Payroll</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Disbursements
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Pay finalized runs by bank transfer, mobile money, cheque or cash.
            Batches use maker-checker: the creator cannot approve their own
            batch.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              batchesQuery.refetch();
              runsQuery.refetch();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              New payment batch
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Unable to load disbursements</p>
            <p className="mt-1">{getErrorMessage(error)}</p>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric label="Batches in view" value={formatNumber(batches.length)} />
        <Metric label="Employees in view" value={formatNumber(totals.people)} />
        <Metric label="Payment value in view" value={formatMoney(totals.amount)} />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Payment batches</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Bank files and reconciliation are recorded against the batch for audit.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600" htmlFor="batch-status">
              Status
            </label>
            <select
              id="batch-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option ? titleCase(option) : 'All statuses'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading payment batches...
          </div>
        ) : batches.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Banknote className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No payment batches yet
            </h3>
            <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
              Finalize a pay run first, then create a batch to pay the net salaries.
            </p>
            <Link
              to="/payroll/runs"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-900 hover:underline"
            >
              Go to pay runs
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {batches.map((batch) => {
              const expanded = expandedId === batch.id;
              const MethodIcon = METHOD_ICONS[batch.method] ?? Banknote;
              const canReconcile = ['processing', 'partially_paid', 'failed'].includes(
                batch.status,
              );
              const paidCount = batch.items.filter((item) => item.status === 'paid').length;
              const failedCount = batch.items.filter(
                (item) => item.status === 'failed',
              ).length;

              return (
                <div key={batch.id}>
                  <div className="flex flex-col gap-4 px-5 py-4 transition hover:bg-slate-50 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : batch.id)}
                        className="mt-0.5 rounded-md p-1 text-slate-500 hover:bg-slate-100"
                        aria-label={expanded ? 'Collapse batch' : 'Expand batch'}
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <MethodIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {batch.batch_number}
                          </p>
                          <PayrollStatusBadge status={batch.status} />
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {titleCase(batch.method)} · {formatNumber(batch.control_count)}{' '}
                          employees · pay date {formatDate(batch.pay_date)}
                        </p>
                        {batch.items.length > 0 && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {paidCount} paid
                            {failedCount > 0 ? ` · ${failedCount} failed` : ''}
                            {batch.bank_file_reference
                              ? ` · file ${batch.bank_file_reference}`
                              : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <div className="mr-2 text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatMoney(batch.control_total, batch.currency)}
                        </p>
                        <p className="text-xs text-slate-500">Control total</p>
                      </div>

                      {canApprove && batch.status === 'pending_approval' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => approveMutation.mutate(batch.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Approve
                        </button>
                      )}

                      {canCreate &&
                        ['approved', 'processing', 'submitted'].includes(batch.status) && (
                          <button
                            type="button"
                            disabled={downloadMutation.isPending}
                            onClick={() => downloadMutation.mutate(batch)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Bank file
                          </button>
                        )}

                      {canCreate && batch.status === 'approved' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => submitMutation.mutate(batch.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Submit
                        </button>
                      )}

                      {canCreate && canReconcile && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => markBatch(batch, 'paid')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Mark paid
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => markBatch(batch, 'failed')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Failed
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
                      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500">
                        <span>
                          Created {formatDateTime(batch.created_at)}
                          {batch.approved_at
                            ? ` · approved ${formatDateTime(batch.approved_at)}`
                            : ''}
                          {batch.submitted_at
                            ? ` · submitted ${formatDateTime(batch.submitted_at)}`
                            : ''}
                        </span>
                        <Link
                          to={`/payroll/runs/${batch.run_id}`}
                          className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:underline"
                        >
                          View pay run
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>

                      {batch.notes && (
                        <p className="mb-3 whitespace-pre-line rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
                          {batch.notes}
                        </p>
                      )}

                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50">
                            <tr>
                              <Th>Employee</Th>
                              <Th>Destination</Th>
                              <Th>Status</Th>
                              <Th align="right">Amount</Th>
                              <Th align="right">Action</Th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {batch.items.map((item) => {
                              const itemReconcilable = ['pending', 'submitted', 'processing', 'failed'].includes(
                                item.status,
                              );
                              return (
                                <tr key={item.id}>
                                  <td className="px-4 py-3">
                                    <p className="text-sm font-medium text-slate-900">
                                      {item.person_name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {item.employee_number ?? 'No employee number'}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-600">
                                    {item.destination_masked ?? '—'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <PayrollStatusBadge status={item.status} />
                                    {item.failure_reason && (
                                      <p className="mt-1 max-w-xs text-[11px] leading-4 text-red-600">
                                        {item.failure_reason}
                                      </p>
                                    )}
                                    {item.retry_count > 0 && (
                                      <p className="mt-1 text-[11px] text-slate-500">
                                        Retried {item.retry_count}×
                                      </p>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                                    {formatMoney(item.amount, batch.currency)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap justify-end gap-1.5">
                                      {canCreate && itemReconcilable && batch.status !== 'pending_approval' && batch.status !== 'approved' && (
                                        <>
                                          <button
                                            type="button"
                                            disabled={busy || item.status === 'paid'}
                                            onClick={() => markItem(item, 'paid')}
                                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                                          >
                                            Paid
                                          </button>
                                          <button
                                            type="button"
                                            disabled={busy || item.status === 'failed'}
                                            onClick={() => markItem(item, 'failed')}
                                            className="rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
                                          >
                                            Failed
                                          </button>
                                        </>
                                      )}
                                      {canCreate && item.status === 'failed' && (
                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() => retryItemMutation.mutate(item.id)}
                                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                                        >
                                          <RotateCcw className="h-3 w-3" />
                                          Retry
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {showCreate && (
        <CreateBatchDialog
          runs={payableRuns}
          onClose={() => setShowCreate(false)}
          onCreated={(batch) => {
            setShowCreate(false);
            setExpandedId(batch.id);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

function CreateBatchDialog({
  runs,
  onClose,
  onCreated,
}: {
  runs: PayRun[];
  onClose: () => void;
  onCreated: (batch: DisbursementBatch) => void;
}) {
  const [form, setForm] = useState({
    run_id: runs[0]?.id ?? '',
    method: 'bank_transfer',
    pay_date: '',
    notes: '',
  });

  const selectedRun = runs.find((run) => run.id === form.run_id);

  const mutation = useMutation({
    mutationFn: () =>
      payrollService.createDisbursement({
        run_id: form.run_id,
        method: form.method,
        pay_date: form.pay_date || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: (batch) => {
      toast.success('Payment batch created. It needs approval before submission.');
      onCreated(batch);
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not create the batch')),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.run_id) {
      toast.error('Select a finalized pay run');
      return;
    }
    mutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">New payment batch</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              A batch pays the net salaries of a finalized run. Bank transfers and
              mobile money require verified primary accounts.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          {runs.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              There are no finalized pay runs available. Finalize a run before
              creating a payment batch.
            </div>
          )}

          <div>
            <label className={labelClasses()} htmlFor="batch-run">
              Finalized pay run
            </label>
            <select
              id="batch-run"
              required
              value={form.run_id}
              onChange={(event) => setForm({ ...form, run_id: event.target.value })}
              className={inputClasses()}
            >
              <option value="">Select a run</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.run_number ?? 'Run'} · {run.period_name ?? '—'} ·{' '}
                  {formatMoney(run.total_net, run.currency)} net
                </option>
              ))}
            </select>
            {selectedRun && (
              <p className="mt-1.5 text-xs text-slate-500">
                {formatNumber(selectedRun.employee_count)} employees · net{' '}
                {formatMoney(selectedRun.total_net, selectedRun.currency)}
              </p>
            )}
          </div>

          <div>
            <label className={labelClasses()} htmlFor="batch-method">
              Payment method
            </label>
            <select
              id="batch-method"
              value={form.method}
              onChange={(event) => setForm({ ...form, method: event.target.value })}
              className={inputClasses()}
            >
              {METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              One batch uses one method. Split different methods into separate
              batches.
            </p>
          </div>

          <div>
            <label className={labelClasses()} htmlFor="batch-date">
              Pay date (optional)
            </label>
            <input
              id="batch-date"
              type="date"
              value={form.pay_date}
              onChange={(event) => setForm({ ...form, pay_date: event.target.value })}
              className={inputClasses()}
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Defaults to the run's period pay date. Bank accounts must be effective
              on this date.
            </p>
          </div>

          <div>
            <label className={labelClasses()} htmlFor="batch-notes">
              Notes
            </label>
            <textarea
              id="batch-notes"
              rows={3}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              className={inputClasses()}
              placeholder="Optional context for the approver"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || runs.length === 0}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending ? 'Creating…' : 'Create batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}
