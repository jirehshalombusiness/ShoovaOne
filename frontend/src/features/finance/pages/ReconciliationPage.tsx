import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { financeService } from '../finance.service';
import type { FundRequest } from '../finance.types';

type ReconciliationTab = 'pending' | 'completed';

interface CurrencyTotal {
  currency: string;
  amount: number;
  count: number;
}

const formatCurrency = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })}`;
  }
};

const formatDate = (value?: string | null) => {
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
};

const getApprovedAmount = (request: FundRequest) =>
  request.approved_amount ?? request.amount_requested;

const getDisbursedAmount = (request: FundRequest) =>
  request.amount_disbursed ?? 0;

const getRemainingAmount = (request: FundRequest) =>
  Math.max(getApprovedAmount(request) - getDisbursedAmount(request), 0);

const buildCurrencyTotals = (
  requests: FundRequest[],
  amountSelector: (request: FundRequest) => number,
): CurrencyTotal[] => {
  const totals = new Map<string, CurrencyTotal>();

  requests.forEach((request) => {
    const currency = request.currency || 'USD';
    const amount = amountSelector(request);

    const existing = totals.get(currency);

    if (existing) {
      existing.amount += amount;
      existing.count += 1;
    } else {
      totals.set(currency, {
        currency,
        amount,
        count: 1,
      });
    }
  });

  return Array.from(totals.values()).sort((a, b) =>
    a.currency.localeCompare(b.currency),
  );
};

export function ReconciliationPage() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState<FundRequest[]>([]);
  const [activeTab, setActiveTab] =
    useState<ReconciliationTab>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setError(null);

    try {
      const [disbursedResponse, reconciledResponse] = await Promise.all([
        financeService.getFundRequests({
          status: 'disbursed',
        }),
        financeService.getFundRequests({
          status: 'reconciled',
        }),
      ]);

      const combined = [
        ...(disbursedResponse || []),
        ...(reconciledResponse || []),
      ];

      const uniqueRequests = Array.from(
        new Map(combined.map((request) => [request.id, request])).values(),
      );

      setRequests(uniqueRequests);
    } catch (err) {
      console.error('Failed to load reconciliation records:', err);
      setError(
        'Unable to load reconciliation records. Please try again.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
  };

  const pendingRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.status === 'disbursed' &&
          getRemainingAmount(request) === 0,
      ),
    [requests],
  );

  const completedRequests = useMemo(
    () => requests.filter((request) => request.status === 'reconciled'),
    [requests],
  );

  const filteredRequests = useMemo(() => {
    const source =
      activeTab === 'pending' ? pendingRequests : completedRequests;

    const search = searchTerm.trim().toLowerCase();

    if (!search) {
      return source;
    }

    return source.filter((request) => {
      const searchableText = [
        request.request_number,
        request.title,
        request.description,
        request.justification,
        request.currency,
        request.project_id,
        request.programme_id,
        request.department_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [
    activeTab,
    completedRequests,
    pendingRequests,
    searchTerm,
  ]);

  const pendingTotals = useMemo(
    () =>
      buildCurrencyTotals(
        pendingRequests,
        getDisbursedAmount,
      ),
    [pendingRequests],
  );

  const completedTotals = useMemo(
    () =>
      buildCurrencyTotals(
        completedRequests,
        getDisbursedAmount,
      ),
    [completedRequests],
  );

  const currentTotals =
    activeTab === 'pending' ? pendingTotals : completedTotals;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <span>Finance</span>
            <span>/</span>
            <span>Governance</span>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
              <ClipboardCheck className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                Reconciliation
              </h1>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Review fully disbursed fund requests and confirm that
                their financial reconciliation has been completed.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Clock3 className="h-5 w-5" />}
          label="Pending Reconciliation"
          value={pendingRequests.length.toString()}
          description="Fully disbursed requests"
        />

        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Reconciled"
          value={completedRequests.length.toString()}
          description="Completed reconciliation"
        />

        <SummaryCard
          icon={<ClipboardCheck className="h-5 w-5" />}
          label="Total Records"
          value={requests.length.toString()}
          description="Disbursed and reconciled"
        />

        <SummaryCard
          icon={<ExternalLink className="h-5 w-5" />}
          label="Current View"
          value={filteredRequests.length.toString()}
          description={
            activeTab === 'pending'
              ? 'Awaiting reconciliation'
              : 'Completed records'
          }
        />
      </div>

      {/* Currency summary */}
      {currentTotals.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {activeTab === 'pending'
                ? 'Pending Reconciliation Amounts'
                : 'Reconciled Amounts'}
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Amounts are grouped by currency and are not combined
              across currencies.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {currentTotals.map((total) => (
              <div
                key={total.currency}
                className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {total.currency}
                </div>

                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {formatCurrency(total.amount, total.currency)}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  {total.count}{' '}
                  {total.count === 1 ? 'request' : 'requests'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main panel */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Tabs / filters */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Reconciliation Queue
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {activeTab === 'pending'
                  ? 'Fully disbursed requests waiting for reconciliation.'
                  : 'Requests that have completed reconciliation.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <TabButton
                active={activeTab === 'pending'}
                onClick={() => setActiveTab('pending')}
                count={pendingRequests.length}
              >
                Pending
              </TabButton>

              <TabButton
                active={activeTab === 'completed'}
                onClick={() => setActiveTab('completed')}
                count={completedRequests.length}
              >
                Reconciled
              </TabButton>
            </div>
          </div>

          <div className="mt-4">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                placeholder="Search request number or title..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading reconciliation records...
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex min-h-[320px] items-center justify-center px-6">
            <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-5 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertCircle className="h-5 w-5" />
              </div>

              <h3 className="mt-3 text-sm font-semibold text-red-900">
                Unable to load reconciliation
              </h3>

              <p className="mt-1 text-sm leading-6 text-red-700">
                {error}
              </p>

              <button
                type="button"
                onClick={handleRefresh}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filteredRequests.length === 0 && (
          <div className="flex min-h-[320px] items-center justify-center px-6">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>

              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {activeTab === 'pending'
                  ? 'Nothing needs reconciliation'
                  : 'No reconciled records'}
              </h3>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                {activeTab === 'pending'
                  ? 'There are currently no fully disbursed fund requests waiting for reconciliation.'
                  : 'No fund requests have completed reconciliation yet.'}
              </p>

              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="mt-4 text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-950"
                >
                  Clear search
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        {!loading && !error && filteredRequests.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>Request</TableHeader>
                  <TableHeader>Amount Disbursed</TableHeader>
                  <TableHeader>Disbursed</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Reconciled</TableHeader>
                  <TableHeader align="right">Action</TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRequests.map((request) => (
                  <tr
                    key={request.id}
                    className="transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <div>
                        <Link
                          to={`/finance/fund-requests/${request.id}`}
                          className="font-medium text-slate-900 hover:text-slate-700 hover:underline"
                        >
                          {request.request_number}
                        </Link>

                        <div className="mt-1 max-w-xs truncate text-sm text-slate-500">
                          {request.title}
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="text-sm font-semibold text-slate-900">
                        {formatCurrency(
                          getDisbursedAmount(request),
                          request.currency,
                        )}
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        Approved:{' '}
                        {formatCurrency(
                          getApprovedAmount(request),
                          request.currency,
                        )}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                      {formatDate(request.disbursed_at)}
                    </td>

                    <td className="px-5 py-4">
                      {request.status === 'reconciled' ? (
                        <StatusBadge
                          tone="success"
                          label="Reconciled"
                        />
                      ) : (
                        <StatusBadge
                          tone="warning"
                          label="Pending"
                        />
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                      {formatDate(request.reconciled_at)}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/finance/fund-requests/${request.id}`,
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        {request.status === 'disbursed'
                          ? 'Reconcile'
                          : 'View'}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && !error && filteredRequests.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
            <p className="text-xs text-slate-500">
              Showing {filteredRequests.length}{' '}
              {filteredRequests.length === 1 ? 'record' : 'records'}.
            </p>
          </div>
        )}
      </div>

      {/* Workflow note */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />

          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Finance workflow
            </h3>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Fund requests move through{' '}
              <span className="font-medium text-slate-700">
                Approved → Disbursed → Reconciled
              </span>
              . Reconciliation confirms that a fully disbursed
              request has completed the required financial close-out.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
          {icon}
        </div>

        <span className="text-right text-xs font-medium text-slate-400">
          {label}
        </span>
      </div>

      <div className="mt-4">
        <div className="text-2xl font-semibold tracking-tight text-slate-950">
          {value}
        </div>

        <div className="mt-1 text-sm text-slate-500">
          {description}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  children,
  active,
  count,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
        active
          ? 'bg-slate-950 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {children}

      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] ${
          active
            ? 'bg-white/15 text-white'
            : 'bg-white text-slate-500'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function TableHeader({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      scope="col"
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function StatusBadge({
  tone,
  label,
}: {
  tone: 'success' | 'warning';
  label: string;
}) {
  const classes =
    tone === 'success'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
      : 'bg-amber-50 text-amber-700 ring-amber-100';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${classes}`}
    >
      {label}
    </span>
  );
}

export default ReconciliationPage;