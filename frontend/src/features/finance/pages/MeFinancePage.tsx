import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowUpRight,
  FilePlus2,
  RefreshCcw,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { financeService } from '../finance.service';
import type {
  FundRequest,
  FundRequestStatus,
} from '../finance.types';
import {
  FundRequestStageBadge,
  FundRequestStatusBadge,
  REQUEST_TYPE_LABELS,
} from '../components/FundRequestStatusBadge';

const FILTERS: Array<{
  value: FundRequestStatus | 'all';
  label: string;
}> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'manager_approved', label: 'Manager approved' },
  { value: 'finance_approved', label: 'Finance approved' },
  { value: 'approved', label: 'Ready for payment' },
  { value: 'disbursed', label: 'Awaiting receipts' },
  { value: 'verified', label: 'Closed' },
  { value: 'rejected', label: 'Rejected' },
];

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

function actionsRequired(request: FundRequest) {
  return (
    request.status === 'verification_failed' ||
    request.status === 'draft' ||
    request.status === 'rejected'
  );
}

export function MeFinancePage() {
  const [filter, setFilter] = useState<FundRequestStatus | 'all'>(
    'all'
  );

  const requestsQuery = useQuery({
    queryKey: ['me', 'fund-requests'],
    queryFn: () => financeService.listMyFundRequests({ limit: 100 }),
    refetchInterval: 60_000,
  });

  const requests = requestsQuery.data ?? [];

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? requests
        : requests.filter((request) => request.status === filter),
    [filter, requests]
  );

  const summary = useMemo(() => {
    const open = requests.filter((request) =>
      [
        'submitted',
        'manager_approved',
        'finance_approved',
        'approved',
      ].includes(request.status)
    ).length;

    const awaitingReceipts = requests.filter(
      (request) =>
        request.status === 'disbursed' ||
        request.status === 'verification_failed'
    ).length;

    const needsAction = requests.filter(actionsRequired).length;

    return { open, awaitingReceipts, needsAction };
  }, [requests]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Wallet className="h-4 w-4" />
            My Finance
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            My Claims
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Claim money you spent on Shoova's behalf, or request an
            advance before a planned expense.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void requestsQuery.refetch()}
            disabled={requestsQuery.isFetching}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw
              className={`h-3.5 w-3.5 ${
                requestsQuery.isFetching ? 'animate-spin' : ''
              }`}
            />
            Refresh
          </button>

          <Link
            to="/me/finance/new"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <FilePlus2 className="h-4 w-4" />
            New claim
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            In approval
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {summary.open}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Moving through manager, finance and CEO
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            Receipts to hand in
          </p>

          <p className="mt-2 text-2xl font-semibold text-amber-800">
            {summary.awaitingReceipts}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Paid claims still awaiting hardcopy verification
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Needs your action
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {summary.needsAction}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Drafts, rejected claims or returned receipts
          </p>
        </div>
      </section>

      {requestsQuery.isError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

          <div>
            <h2 className="text-sm font-semibold text-red-900">
              Your claims could not be loaded
            </h2>

            <p className="mt-1 text-sm text-red-700">
              Check your connection and try again.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              filter === option.value
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {option.label}
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
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <Wallet className="h-6 w-6" />
          </div>

          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            No claims here yet
          </h3>

          <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-slate-500">
            Create a claim with your receipts and it will move
            through manager, finance and CEO approval automatically.
          </p>

          <Link
            to="/me/finance/new"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <FilePlus2 className="h-4 w-4" />
            Start a claim
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((request) => (
            <Link
              key={request.id}
              to={`/me/finance/${request.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">
                      {request.request_number}
                    </span>

                    <FundRequestStatusBadge status={request.status} />

                    <FundRequestStageBadge
                      stage={request.current_stage}
                    />

                    {actionsRequired(request) && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        Action needed
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 text-sm font-semibold text-slate-900">
                    {request.title}
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
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

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatCurrency(
                        request.amount_requested,
                        request.currency
                      )}
                    </p>

                    {request.approved_amount != null && (
                      <p className="text-[11px] text-slate-400">
                        Approved{' '}
                        {formatCurrency(
                          request.approved_amount,
                          request.currency
                        )}
                      </p>
                    )}
                  </div>

                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
