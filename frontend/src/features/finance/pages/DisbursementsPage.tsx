import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCcw,
  WalletCards,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { financeService } from '../finance.service';
import type { FundRequest } from '../finance.types';

type DisbursementTab = 'pending' | 'disbursed';

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function formatDate(date?: string | null) {
  if (!date) return '—';

  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

function getRemainingAmount(request: FundRequest) {
  const approved = Number(request.approved_amount ?? 0);
  const disbursed = Number(request.amount_disbursed ?? 0);

  return Math.max(approved - disbursed, 0);
}

function getDisbursementProgress(request: FundRequest) {
  const approved = Number(request.approved_amount ?? 0);
  const disbursed = Number(request.amount_disbursed ?? 0);

  if (approved <= 0) return 0;

  return Math.min((disbursed / approved) * 100, 100);
}

export function DisbursementsPage() {
  const navigate = useNavigate();

  const [approvedRequests, setApprovedRequests] = useState<
    FundRequest[]
  >([]);

  const [disbursedRequests, setDisbursedRequests] = useState<
    FundRequest[]
  >([]);

  const [activeTab, setActiveTab] =
    useState<DisbursementTab>('pending');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDisbursements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        approvedRequestsData,
        disbursedRequestsData,
      ] = await Promise.all([
        financeService.getFundRequests({
          status: 'approved',
        }),

        financeService.getFundRequests({
          status: 'disbursed',
        }),
      ]);

      setApprovedRequests(approvedRequestsData);
      setDisbursedRequests(disbursedRequestsData);
    } catch (err) {
      console.error(
        'Failed to load finance disbursements:',
        err
      );

      setError(
        'Unable to load disbursement records. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDisbursements();
  }, [loadDisbursements]);

  const pendingRequests = useMemo(() => {
    return approvedRequests
      .filter(
        (request) => getRemainingAmount(request) > 0
      )
      .sort((a, b) => {
        const aDate = a.approved_at
          ? new Date(a.approved_at).getTime()
          : 0;

        const bDate = b.approved_at
          ? new Date(b.approved_at).getTime()
          : 0;

        return aDate - bDate;
      });
  }, [approvedRequests]);

  const partiallyDisbursedCount = useMemo(() => {
    return pendingRequests.filter(
      (request) =>
        Number(request.amount_disbursed ?? 0) > 0
    ).length;
  }, [pendingRequests]);

  const fullyDisbursedCount = disbursedRequests.length;

  const totalPendingAmount = useMemo(() => {
    return pendingRequests.reduce(
      (total, request) =>
        total + getRemainingAmount(request),
      0
    );
  }, [pendingRequests]);

  const totalDisbursedAmount = useMemo(() => {
    return disbursedRequests.reduce(
      (total, request) =>
        total + Number(request.amount_disbursed ?? 0),
      0
    );
  }, [disbursedRequests]);

  const activeRequests =
    activeTab === 'pending'
      ? pendingRequests
      : disbursedRequests;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
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
            Monitor approved funding awaiting release and
            maintain a register of completed disbursements.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDisbursements}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
        >
          <RefreshCcw
            className={`h-4 w-4 ${
              loading ? 'animate-spin' : ''
            }`}
          />

          Refresh
        </button>
      </section>

      {/* Summary */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Ready to Disburse"
          value={String(pendingRequests.length)}
          description="Approved requests with an outstanding balance"
          icon={Clock3}
          tone="amber"
        />

        <SummaryCard
          label="Partially Disbursed"
          value={String(partiallyDisbursedCount)}
          description="Approved requests with funds already released"
          icon={WalletCards}
          tone="blue"
        />

        <SummaryCard
          label="Fully Disbursed"
          value={String(fullyDisbursedCount)}
          description="Requests that have reached full disbursement"
          icon={CheckCircle2}
          tone="emerald"
        />

        <SummaryCard
          label="Outstanding Value"
          value={
            pendingRequests.length > 0
              ? formatCurrency(
                  totalPendingAmount,
                  pendingRequests[0].currency
                )
              : '—'
          }
          description={
            pendingRequests.length > 0
              ? 'Remaining approved value'
              : 'No outstanding disbursement'
          }
          icon={Banknote}
          tone="slate"
        />
      </section>

      {/* Error */}
      {error && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
              <AlertCircle className="h-5 w-5" />
            </div>

            <div className="flex-1">
              <h2 className="text-sm font-semibold text-red-900">
                Disbursements could not be loaded
              </h2>

              <p className="mt-1 text-sm text-red-700">
                {error}
              </p>

              <button
                type="button"
                onClick={loadDisbursements}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-red-800 hover:text-red-900"
              >
                <RefreshCcw className="h-4 w-4" />
                Try again
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Register */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Register header */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Disbursement Register
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Track approved funds through release and completion.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <TabButton
                active={activeTab === 'pending'}
                onClick={() => setActiveTab('pending')}
              >
                Pending Disbursement
                <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                  {pendingRequests.length}
                </span>
              </TabButton>

              <TabButton
                active={activeTab === 'disbursed'}
                onClick={() => setActiveTab('disbursed')}
              >
                Disbursed
                <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                  {disbursedRequests.length}
                </span>
              </TabButton>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading disbursement records...
            </div>
          </div>
        ) : activeRequests.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Request
                  </th>

                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Status
                  </th>

                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Approved
                  </th>

                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Disbursed
                  </th>

                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Remaining
                  </th>

                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {activeTab === 'pending'
                      ? 'Approved'
                      : 'Disbursed'}
                  </th>

                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {activeRequests.map((request) => {
                  const approvedAmount = Number(
                    request.approved_amount ?? 0
                  );

                  const disbursedAmount = Number(
                    request.amount_disbursed ?? 0
                  );

                  const remainingAmount =
                    getRemainingAmount(request);

                  const progress =
                    getDisbursementProgress(request);

                  return (
                    <tr
                      key={request.id}
                      className="transition hover:bg-slate-50"
                    >
                      {/* Request */}
                      <td className="px-5 py-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-slate-500">
                              {request.request_number}
                            </span>
                          </div>

                          <p className="mt-1 max-w-[280px] truncate text-sm font-semibold text-slate-900">
                            {request.title}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {request.currency}
                          </p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        {activeTab === 'pending' ? (
                          <div>
                            <span
                              className={[
                                'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                                progress > 0
                                  ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200'
                                  : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
                              ].join(' ')}
                            >
                              {progress > 0
                                ? 'Partially Disbursed'
                                : 'Approved'}
                            </span>

                            {progress > 0 && (
                              <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-blue-600"
                                  style={{
                                    width: `${progress}%`,
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                            Fully Disbursed
                          </span>
                        )}
                      </td>

                      {/* Approved */}
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <span className="text-sm font-semibold text-slate-900">
                          {formatCurrency(
                            approvedAmount,
                            request.currency
                          )}
                        </span>
                      </td>

                      {/* Disbursed */}
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <span className="text-sm font-semibold text-slate-900">
                          {formatCurrency(
                            disbursedAmount,
                            request.currency
                          )}
                        </span>
                      </td>

                      {/* Remaining */}
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <span
                          className={[
                            'text-sm font-semibold',
                            remainingAmount > 0
                              ? 'text-amber-700'
                              : 'text-emerald-700',
                          ].join(' ')}
                        >
                          {formatCurrency(
                            remainingAmount,
                            request.currency
                          )}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className="text-sm text-slate-500">
                          {formatDate(
                            activeTab === 'pending'
                              ? request.approved_at
                              : request.disbursed_at
                          )}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/finance/fund-requests/${request.id}`
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                          {activeTab === 'pending'
                            ? 'Disburse Funds'
                            : 'View Request'}

                          {activeTab === 'pending' ? (
                            <Banknote className="h-3.5 w-3.5" />
                          ) : (
                            <ExternalLink className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Control note */}
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />

          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Disbursement control
            </h3>

            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
              Only approved fund requests with an outstanding
              approved balance appear in the pending register.
              The actual release is recorded from the fund request
              workflow and cannot exceed the remaining approved
              amount.
            </p>
          </div>
        </div>
      </section>

      {/* Additional metric */}
      {disbursedRequests.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Completed Disbursements
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Total value represented by fully disbursed
                requests in the current register.
              </p>
            </div>

            <p className="text-xl font-semibold text-slate-900">
              {formatCurrency(
                totalDisbursedAmount,
                disbursedRequests[0].currency
              )}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  description: string;
  icon: typeof Banknote;
  tone: 'amber' | 'blue' | 'emerald' | 'slate';
}) {
  const toneClasses = {
    amber: {
      wrapper: 'border-amber-200 bg-amber-50/40',
      icon: 'bg-amber-100 text-amber-700',
      label: 'text-amber-700',
      value: 'text-amber-900',
    },
    blue: {
      wrapper: 'border-blue-200 bg-blue-50/40',
      icon: 'bg-blue-100 text-blue-700',
      label: 'text-blue-700',
      value: 'text-blue-900',
    },
    emerald: {
      wrapper: 'border-emerald-200 bg-emerald-50/40',
      icon: 'bg-emerald-100 text-emerald-700',
      label: 'text-emerald-700',
      value: 'text-emerald-900',
    },
    slate: {
      wrapper: 'border-slate-200 bg-white',
      icon: 'bg-slate-100 text-slate-600',
      label: 'text-slate-500',
      value: 'text-slate-900',
    },
  };

  const classes = toneClasses[tone];

  return (
    <div
      className={`rounded-xl border p-5 shadow-sm ${classes.wrapper}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${classes.label}`}
          >
            {label}
          </p>

          <p
            className={`mt-2 text-2xl font-semibold ${classes.value}`}
          >
            {value}
          </p>
        </div>

        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${classes.icon}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg px-3 py-2 text-xs font-medium transition',
        active
          ? 'bg-slate-900 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function EmptyState({
  tab,
}: {
  tab: DisbursementTab;
}) {
  const isPending = tab === 'pending';

  return (
    <div className="flex min-h-[320px] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          {isPending ? (
            <Clock3 className="h-6 w-6 text-slate-500" />
          ) : (
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          )}
        </div>

        <p className="mt-4 text-sm font-semibold text-slate-900">
          {isPending
            ? 'Nothing is awaiting disbursement'
            : 'No completed disbursements yet'}
        </p>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          {isPending
            ? 'Approved requests with an outstanding balance will appear here.'
            : 'Fully disbursed fund requests will appear here once funds have been released.'}
        </p>
      </div>
    </div>
  );
}