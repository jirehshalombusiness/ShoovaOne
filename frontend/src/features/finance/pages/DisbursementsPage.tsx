import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useHRAccess } from '@/hooks/useHRAccess';

import { financeService } from '../finance.service';
import type { FundRequest } from '../finance.types';
import {
  FundRequestStageBadge,
  FundRequestStatusBadge,
} from '../components/FundRequestStatusBadge';

type Tab = 'ready' | 'paid';

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

function getErrorMessage(error: unknown, fallback: string) {
  const detail = (
    error as { response?: { data?: { detail?: unknown } } }
  )?.response?.data?.detail;

  if (typeof detail === 'string') return detail;

  return fallback;
}

function approvedAmount(request: FundRequest) {
  return request.approved_amount ?? request.amount_requested;
}

export function DisbursementsPage() {
  const queryClient = useQueryClient();
  const access = useHRAccess();

  const [tab, setTab] = useState<Tab>('ready');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const requestsQuery = useQuery({
    queryKey: ['finance', 'disbursements'],
    queryFn: () => financeService.listFundRequests({ limit: 250 }),
    refetchInterval: 60_000,
  });

  const requests = requestsQuery.data ?? [];

  const ready = useMemo(
    () => requests.filter((request) => request.status === 'approved'),
    [requests]
  );

  const paid = useMemo(
    () =>
      requests.filter((request) =>
        ['disbursed', 'verification_failed', 'verified'].includes(
          request.status
        )
      ),
    [requests]
  );

  const pendingReceipts = paid.filter(
    (request) =>
      request.status === 'disbursed' ||
      request.status === 'verification_failed'
  ).length;

  const readyTotals = useMemo(() => {
    const totals = new Map<string, number>();

    ready.forEach((request) => {
      const currency = request.currency || 'GHS';
      totals.set(
        currency,
        (totals.get(currency) ?? 0) + approvedAmount(request)
      );
    });

    return Array.from(totals.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
  }, [ready]);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['finance', 'disbursements'],
    });
    void queryClient.invalidateQueries({
      queryKey: ['finance', 'fund-requests'],
    });
    void queryClient.invalidateQueries({
      queryKey: ['finance', 'sidebar-overview'],
    });
  };

  const disburseMutation = useMutation({
    mutationFn: (request: FundRequest) =>
      financeService.disburseFundRequest(
        request.id,
        Number(amount),
        notes.trim() || undefined
      ),
    onSuccess: () => {
      toast.success('Payment recorded — receipts are now required');
      setActiveId(null);
      setAmount('');
      setNotes('');
      invalidate();
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, 'The payment could not be recorded.')
      ),
  });

  const openPayment = (request: FundRequest) => {
    setActiveId(request.id);
    setAmount(String(approvedAmount(request)));
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Banknote className="h-4 w-4" />
            Fund Management
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Disbursements
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Pay approved claims, then track them until Finance
            verifies the signed hardcopy receipts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void requestsQuery.refetch()}
          disabled={requestsQuery.isFetching}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCcw
            className={`h-4 w-4 ${
              requestsQuery.isFetching ? 'animate-spin' : ''
            }`}
          />
          Refresh
        </button>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            Ready for payment
          </p>

          <p className="mt-2 text-2xl font-semibold text-emerald-800">
            {ready.length}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Fully approved claims awaiting payout
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Value ready
          </p>

          {readyTotals.length === 0 ? (
            <p className="mt-2 text-xl font-semibold text-slate-900">
              —
            </p>
          ) : (
            <div className="mt-2 space-y-0.5">
              {readyTotals.map(([currency, total]) => (
                <p
                  key={currency}
                  className="text-xl font-semibold text-slate-900"
                >
                  {formatCurrency(total, currency)}
                </p>
              ))}
            </div>
          )}

          <p className="mt-1 text-xs text-slate-400">
            Total approved by currency
          </p>
        </div>

        <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
            Awaiting receipts
          </p>

          <p className="mt-2 text-2xl font-semibold text-purple-800">
            {pendingReceipts}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Paid claims still open for hardcopy verification
          </p>
        </div>
      </section>

      {requestsQuery.isError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

          <div>
            <h2 className="text-sm font-semibold text-red-900">
              Disbursements could not be loaded
            </h2>

            <p className="mt-1 text-sm text-red-700">
              Check your connection and try again.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:w-fit">
        {(
          [
            { value: 'ready', label: 'Ready for payment', count: ready.length },
            { value: 'paid', label: 'Paid & receipts', count: paid.length },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTab(option.value)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition sm:flex-none ${
              tab === option.value
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {option.label}

            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                tab === option.value
                  ? 'bg-white/15 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {option.count}
            </span>
          </button>
        ))}
      </div>

      {requestsQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>
      ) : tab === 'ready' ? (
        ready.length === 0 ? (
          <EmptyState
            title="Nothing to pay out"
            description="Claims appear here once manager, finance and CEO approval are complete."
          />
        ) : (
          <div className="space-y-3">
            {ready.map((request) => {
              const isActive = activeId === request.id;

              return (
                <div
                  key={request.id}
                  className="rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-400">
                          {request.request_number}
                        </span>

                        <FundRequestStatusBadge
                          status={request.status}
                        />

                        <FundRequestStageBadge
                          stage={request.current_stage}
                        />
                      </div>

                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {request.title}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {request.requester_name?.trim() ||
                          'Unknown requester'}{' '}
                        · Approved {formatDate(request.approved_at)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-right">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          Approved
                        </p>

                        <p className="text-base font-semibold text-slate-900">
                          {formatCurrency(
                            approvedAmount(request),
                            request.currency
                          )}
                        </p>
                      </div>

                      <Link
                        to={`/finance/fund-requests/${request.id}`}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        View
                      </Link>

                      {access.has('finance.disburse') && (
                        <button
                          type="button"
                          onClick={() =>
                            isActive
                              ? setActiveId(null)
                              : openPayment(request)
                          }
                          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                          <Banknote className="h-3.5 w-3.5" />
                          {isActive ? 'Close' : 'Pay out'}
                        </button>
                      )}
                    </div>
                  </div>

                  {isActive && (
                    <div className="border-t border-amber-100 bg-amber-50/50 p-5">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
                        <div>
                          <label
                            htmlFor={`amount-${request.id}`}
                            className="mb-1.5 block text-xs font-semibold text-amber-900"
                          >
                            Amount paid ({request.currency})
                          </label>

                          <input
                            id={`amount-${request.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={amount}
                            onChange={(event) =>
                              setAmount(event.target.value)
                            }
                            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`notes-${request.id}`}
                            className="mb-1.5 block text-xs font-semibold text-amber-900"
                          >
                            Payment reference or note
                          </label>

                          <input
                            id={`notes-${request.id}`}
                            type="text"
                            value={notes}
                            onChange={(event) =>
                              setNotes(event.target.value)
                            }
                            placeholder="e.g. Cash paid at finance desk"
                            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-amber-400"
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[11px] leading-5 text-amber-800">
                          After payment the requester must hand in
                          signed hardcopy receipts for verification.
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            disburseMutation.mutate(request)
                          }
                          disabled={
                            disburseMutation.isPending ||
                            !amount ||
                            Number(amount) <= 0
                          }
                          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                        >
                          {disburseMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Banknote className="h-4 w-4" />
                          )}
                          Confirm payment
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : paid.length === 0 ? (
        <EmptyState
          title="No payments recorded yet"
          description="Paid claims and their receipt verification status will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {[
                    'Request',
                    'Requester',
                    'Paid',
                    'Receipt status',
                    'Actions',
                  ].map((heading) => (
                    <th
                      key={heading}
                      className={`px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${
                        heading === 'Actions' ? 'text-right' : ''
                      }`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {paid.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-5 py-4">
                      <p className="text-xs font-semibold text-slate-400">
                        {request.request_number}
                      </p>

                      <p className="mt-0.5 max-w-[240px] truncate text-sm font-semibold text-slate-900">
                        {request.title}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-600">
                      {request.requester_name?.trim() ||
                        'Unknown requester'}
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCurrency(
                          request.amount_disbursed,
                          request.currency
                        )}
                      </p>

                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {formatDate(request.disbursed_at)}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <FundRequestStatusBadge
                        status={request.status}
                      />
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/finance/fund-requests/${request.id}`}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                        >
                          View
                        </Link>

                        {request.status !== 'verified' &&
                          access.has('finance.verify') && (
                            <Link
                              to="/finance/verification"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-900"
                            >
                              <ClipboardCheck className="h-3.5 w-3.5" />
                              Verify
                            </Link>
                          )}

                        {request.status === 'verified' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Closed
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 md:hidden">
            {paid.map((request) => (
              <li key={request.id}>
                <Link
                  to={`/finance/fund-requests/${request.id}`}
                  className="block p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-400">
                        {request.request_number}
                      </p>

                      <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                        {request.title}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatDate(request.disbursed_at)}
                      </p>
                    </div>

                    <FundRequestStatusBadge
                      status={request.status}
                    />
                  </div>

                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {formatCurrency(
                      request.amount_disbursed,
                      request.currency
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <Banknote className="h-6 w-6" />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-900">
        {title}
      </h3>

      <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}
