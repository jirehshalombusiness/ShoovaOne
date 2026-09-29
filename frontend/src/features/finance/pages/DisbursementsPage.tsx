import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  Loader2,
  RefreshCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { financeService } from '../finance.service';
import type {
  FundRequest,
  FundRequestStatus,
} from '../finance.types';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const currencyLocales: Record<string, string> = {
  GHS: 'en-GH',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
};

function formatCurrency(
  amount: number,
  currency: string
) {
  return new Intl.NumberFormat(
    currencyLocales[currency] ?? 'en-US',
    {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(Number(amount || 0));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-GH').format(
    Number(value || 0)
  );
}

function formatDate(date?: string | null) {
  if (!date) return '—';

  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

function getErrorMessage(error: any) {
  return (
    error?.response?.data?.detail ||
    error?.message ||
    'We could not load the disbursement register. Please try again.'
  );
}

function getStatusLabel(status: FundRequestStatus) {
  switch (status) {
    case 'approved':
      return 'Approved';

    case 'disbursed':
      return 'Disbursed';

    case 'reconciled':
      return 'Reconciled';

    default:
      return status
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) =>
          letter.toUpperCase()
        );
  }
}

function getStatusClasses(status: FundRequestStatus) {
  switch (status) {
    case 'approved':
      return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200';

    case 'disbursed':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200';

    case 'reconciled':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200';

    default:
      return 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200';
  }
}

/**
 * A request is fully disbursed when:
 *
 * - its status is "disbursed", or
 * - its status is "reconciled", or
 * - the recorded disbursed amount has reached the approved amount.
 */
function isFullyDisbursed(request: FundRequest) {
  const approvedAmount =
    Number(
      request.approved_amount ??
        request.amount_requested ??
        0
    );

  const disbursedAmount = Number(
    request.amount_disbursed || 0
  );

  return (
    request.status === 'disbursed' ||
    request.status === 'reconciled' ||
    (
      approvedAmount > 0 &&
      disbursedAmount >= approvedAmount
    )
  );
}

/**
 * Outstanding balance against the approved amount.
 */
function getRemainingAmount(request: FundRequest) {
  const approvedAmount =
    Number(
      request.approved_amount ??
        request.amount_requested ??
        0
    );

  const disbursedAmount = Number(
    request.amount_disbursed || 0
  );

  return Math.max(
    approvedAmount - disbursedAmount,
    0
  );
}

/**
 * A pending disbursement is an approved request with money
 * still outstanding.
 *
 * Partial disbursement is represented by:
 * status = approved
 * amount_disbursed > 0
 * remaining > 0
 */
function isPendingDisbursement(request: FundRequest) {
  return (
    request.status === 'approved' &&
    getRemainingAmount(request) > 0
  );
}

function isPartiallyDisbursed(request: FundRequest) {
  return (
    request.status === 'approved' &&
    Number(request.amount_disbursed || 0) > 0 &&
    getRemainingAmount(request) > 0
  );
}

/* -------------------------------------------------------------------------- */
/* Currency grouping                                                          */
/* -------------------------------------------------------------------------- */

type CurrencyTotals = {
  count: number;
  amount: number;
};

function buildCurrencyTotals(
  requests: FundRequest[],
  valueSelector: (request: FundRequest) => number
) {
  const totals: Record<string, CurrencyTotals> = {};

  requests.forEach((request) => {
    const currency = (
      request.currency || 'GHS'
    ).toUpperCase();

    if (!totals[currency]) {
      totals[currency] = {
        count: 0,
        amount: 0,
      };
    }

    totals[currency].count += 1;
    totals[currency].amount += Number(
      valueSelector(request) || 0
    );
  });

  return Object.entries(totals).sort(
    ([currencyA], [currencyB]) =>
      currencyA.localeCompare(currencyB)
  );
}

function CurrencySummary({
  requests,
  valueSelector,
  emptyLabel,
}: {
  requests: FundRequest[];
  valueSelector: (request: FundRequest) => number;
  emptyLabel: string;
}) {
  const entries = buildCurrencyTotals(
    requests,
    valueSelector
  );

  if (!entries.length) {
    return (
      <span className="text-sm text-slate-400">
        {emptyLabel}
      </span>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map(([currency, totals]) => (
        <div
          key={currency}
          className="flex items-baseline justify-between gap-3"
        >
          <span className="text-sm font-medium text-slate-600">
            {currency}
          </span>

          <span className="text-sm font-semibold text-slate-900">
            {formatCurrency(
              totals.amount,
              currency
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

type RegisterTab = 'pending' | 'completed';

export function DisbursementsPage() {
  const [approvedRequests, setApprovedRequests] =
    useState<FundRequest[]>([]);

  const [disbursedRequests, setDisbursedRequests] =
    useState<FundRequest[]>([]);

  const [reconciledRequests, setReconciledRequests] =
    useState<FundRequest[]>([]);

  const [activeTab, setActiveTab] =
    useState<RegisterTab>('pending');

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const loadDisbursements = useCallback(
    async () => {
      try {
        setLoading(true);
        setError(null);

        /*
         * IMPORTANT:
         *
         * We deliberately load all three relevant statuses.
         *
         * The old page only loaded:
         *   approved
         *   disbursed
         *
         * Once a request was reconciled, however, its status became:
         *   reconciled
         *
         * That meant a fully completed request disappeared from
         * the Disbursements register.
         */
        const [
          approved,
          disbursed,
          reconciled,
        ] = await Promise.all([
          financeService.getFundRequests({
            status: 'approved',
          }),

          financeService.getFundRequests({
            status: 'disbursed',
          }),

          financeService.getFundRequests({
            status: 'reconciled',
          }),
        ]);

        setApprovedRequests(
          Array.isArray(approved)
            ? approved
            : []
        );

        setDisbursedRequests(
          Array.isArray(disbursed)
            ? disbursed
            : []
        );

        setReconciledRequests(
          Array.isArray(reconciled)
            ? reconciled
            : []
        );
      } catch (err: any) {
        console.error(
          'Failed to load disbursements:',
          err
        );

        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadDisbursements();
  }, [loadDisbursements]);

  /* ---------------------------------------------------------------------- */
  /* Register data                                                          */
  /* ---------------------------------------------------------------------- */

  const pendingRequests = useMemo(() => {
    return approvedRequests
      .filter(isPendingDisbursement)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );
  }, [approvedRequests]);

  /*
   * Fully disbursed requests come from both:
   *
   *   disbursed
   *   reconciled
   *
   * A reconciled request remains part of the historical
   * disbursement register.
   */
  const completedRequests = useMemo(() => {
    const combined = [
      ...disbursedRequests,
      ...reconciledRequests,
    ];

    /*
     * Protect against duplicate records if the backend
     * ever returns the same request through multiple sources.
     */
    const unique = new Map<string, FundRequest>();

    combined.forEach((request) => {
      unique.set(request.id, request);
    });

    return Array.from(unique.values())
      .filter(isFullyDisbursed)
      .sort((a, b) => {
        const dateA =
          a.disbursed_at ||
          a.reconciled_at ||
          a.updated_at ||
          a.created_at;

        const dateB =
          b.disbursed_at ||
          b.reconciled_at ||
          b.updated_at ||
          b.created_at;

        return (
          new Date(dateB).getTime() -
          new Date(dateA).getTime()
        );
      });
  }, [
    disbursedRequests,
    reconciledRequests,
  ]);

  const partiallyDisbursedRequests =
    useMemo(
      () =>
        pendingRequests.filter(
          isPartiallyDisbursed
        ),
      [pendingRequests]
    );

  const readyToDisburseRequests =
    useMemo(
      () =>
        pendingRequests.filter(
          (request) =>
            Number(
              request.amount_disbursed || 0
            ) <= 0
        ),
      [pendingRequests]
    );

  /* ---------------------------------------------------------------------- */
  /* Metrics                                                                */
  /* ---------------------------------------------------------------------- */

  const outstandingValueByCurrency =
    useMemo(
      () =>
        buildCurrencyTotals(
          pendingRequests,
          getRemainingAmount
        ),
      [pendingRequests]
    );

  const completedValueByCurrency =
    useMemo(
      () =>
        buildCurrencyTotals(
          completedRequests,
          (request) =>
            Number(
              request.amount_disbursed || 0
            )
        ),
      [completedRequests]
    );

  const activeRequests =
    activeTab === 'pending'
      ? pendingRequests
      : completedRequests;

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading disbursements...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                             */}
      {/* ------------------------------------------------------------------ */}

      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Fund Management
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Disbursements
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Monitor approved funding awaiting release
            and maintain a register of completed
            disbursements.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDisbursements}
          disabled={loading}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Error                                                              */}
      {/* ------------------------------------------------------------------ */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              Unable to load disbursements
            </p>

            <p className="mt-1">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={loadDisbursements}
            className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Summary cards                                                      */}
      {/* ------------------------------------------------------------------ */}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Ready to Disburse"
          value={formatNumber(
            readyToDisburseRequests.length
          )}
          description="Approved requests with no funds released yet"
          icon={Clock3}
          tone="warning"
        />

        <SummaryCard
          label="Partially Disbursed"
          value={formatNumber(
            partiallyDisbursedRequests.length
          )}
          description="Approved requests with funds already released"
          icon={Banknote}
          tone="accent"
        />

        <SummaryCard
          label="Fully Disbursed"
          value={formatNumber(
            completedRequests.length
          )}
          description="Requests that have reached full disbursement"
          icon={CheckCircle2}
          tone="positive"
        />

        <SummaryCard
          label="Outstanding Value"
          value={
            outstandingValueByCurrency.length
              ? outstandingValueByCurrency
                  .map(
                    ([currency, totals]) =>
                      formatCurrency(
                        totals.amount,
                        currency
                      )
                  )
                  .join(' · ')
              : '—'
          }
          description={
            pendingRequests.length
              ? 'Remaining approved funding by currency'
              : 'No outstanding disbursement'
          }
          icon={Banknote}
          tone="default"
        />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Currency control note                                               */}
      {/* ------------------------------------------------------------------ */}

      {pendingRequests.length > 0 && (
        <section className="rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

            <div>
              <p className="text-sm font-semibold text-blue-900">
                Currency-aware disbursement tracking
              </p>

              <p className="mt-1 text-sm leading-6 text-blue-800">
                Outstanding amounts are kept separate by
                currency. GHS, USD, GBP, and other funding
                currencies are never added together as if
                they were the same currency.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Register                                                            */}
      {/* ------------------------------------------------------------------ */}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Register header */}
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Disbursement Register
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Track approved funds through release and
                completion.
              </p>
            </div>

            {/* Tabs */}
            <div className="inline-flex w-fit rounded-lg bg-slate-100 p-1">
              <TabButton
                active={
                  activeTab === 'pending'
                }
                onClick={() =>
                  setActiveTab('pending')
                }
                label="Pending Disbursement"
                count={
                  pendingRequests.length
                }
              />

              <TabButton
                active={
                  activeTab === 'completed'
                }
                onClick={() =>
                  setActiveTab('completed')
                }
                label="Disbursed"
                count={
                  completedRequests.length
                }
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {activeRequests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Request
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Approved
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Disbursed
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Remaining
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Date
                  </th>

                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {activeRequests.map(
                  (request) => {
                    const approvedAmount =
                      Number(
                        request.approved_amount ??
                          request.amount_requested ??
                          0
                      );

                    const disbursedAmount =
                      Number(
                        request.amount_disbursed ||
                          0
                      );

                    const remainingAmount =
                      getRemainingAmount(
                        request
                      );

                    const fullyDisbursed =
                      isFullyDisbursed(
                        request
                      );

                    const displayDate =
                      request.disbursed_at ||
                      request.reconciled_at ||
                      request.updated_at ||
                      request.created_at;

                    return (
                      <tr
                        key={request.id}
                        className="transition hover:bg-slate-50"
                      >
                        {/* Request */}
                        <td className="px-6 py-4">
                          <Link
                            to={`/finance/fund-requests/${request.id}`}
                            className="group block min-w-[220px]"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                                <Banknote className="h-4 w-4" />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-slate-700">
                                  {request.title ||
                                    'Fund Request'}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {request.request_number}
                                </p>
                              </div>
                            </div>
                          </Link>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-start gap-1.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                                request.status
                              )}`}
                            >
                              {request.status ===
                                'reconciled' && (
                                <FileCheck2 className="mr-1 h-3.5 w-3.5" />
                              )}

                              {getStatusLabel(
                                request.status
                              )}
                            </span>

                            {isPartiallyDisbursed(
                              request
                            ) && (
                              <span className="text-xs text-slate-500">
                                Partial release
                              </span>
                            )}

                            {request.status ===
                              'reconciled' && (
                              <span className="text-xs text-emerald-600">
                                Reconciliation complete
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Approved */}
                        <td className="px-6 py-4 text-right">
                          <p className="whitespace-nowrap text-sm font-semibold text-slate-900">
                            {formatCurrency(
                              approvedAmount,
                              request.currency
                            )}
                          </p>
                        </td>

                        {/* Disbursed */}
                        <td className="px-6 py-4 text-right">
                          <p className="whitespace-nowrap text-sm font-semibold text-blue-700">
                            {formatCurrency(
                              disbursedAmount,
                              request.currency
                            )}
                          </p>
                        </td>

                        {/* Remaining */}
                        <td className="px-6 py-4 text-right">
                          <p
                            className={`whitespace-nowrap text-sm font-semibold ${
                              remainingAmount > 0
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {formatCurrency(
                              remainingAmount,
                              request.currency
                            )}
                          </p>
                        </td>

                        {/* Date */}
                        <td className="px-6 py-4">
                          <p className="whitespace-nowrap text-sm text-slate-600">
                            {formatDate(
                              displayDate
                            )}
                          </p>
                        </td>

                        {/* Action */}
                        <td className="px-6 py-4 text-right">
                          <Link
                            to={`/finance/fund-requests/${request.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            {fullyDisbursed
                              ? 'View'
                              : 'Open'}

                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            type={activeTab}
          />
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Completed currency totals                                        */}
        {/* ---------------------------------------------------------------- */}

        {activeTab === 'completed' &&
          completedRequests.length > 0 && (
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Completed disbursement totals
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Total funds released, shown separately
                    by currency.
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {completedValueByCurrency.map(
                    ([currency, totals]) => (
                      <div
                        key={currency}
                        className="text-right"
                      >
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {currency}
                        </p>

                        <p className="mt-0.5 text-sm font-semibold text-slate-900">
                          {formatCurrency(
                            totals.amount,
                            currency
                          )}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Workflow note                                                       */}
      {/* ------------------------------------------------------------------ */}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />

          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Disbursement workflow
            </h3>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Approved funding appears here while it has
              an outstanding balance. The actual release is
              completed from the fund request detail page.
              Once fully disbursed, the request remains in
              the register even after reconciliation.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
              <WorkflowBadge>
                Approved
              </WorkflowBadge>

              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />

              <WorkflowBadge>
                Disbursed
              </WorkflowBadge>

              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />

              <WorkflowBadge>
                Reconciled
              </WorkflowBadge>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Summary Card                                                               */
/* -------------------------------------------------------------------------- */

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
  tone:
    | 'default'
    | 'warning'
    | 'accent'
    | 'positive';
}) {
  const toneClasses = {
    default: {
      icon: 'bg-slate-100 text-slate-700',
      value: 'text-slate-900',
    },

    warning: {
      icon: 'bg-amber-50 text-amber-700',
      value: 'text-amber-700',
    },

    accent: {
      icon: 'bg-blue-50 text-blue-700',
      value: 'text-blue-700',
    },

    positive: {
      icon: 'bg-emerald-50 text-emerald-700',
      value: 'text-emerald-700',
    },
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-start gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {label}
          </p>

          <p
            className={`mt-2 break-words text-2xl font-semibold tracking-tight ${toneClasses[tone].value}`}
          >
            {value}
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone].icon}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tab Button                                                                 */
/* -------------------------------------------------------------------------- */

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition ${
        active
          ? 'bg-slate-900 text-white shadow-sm'
          : 'text-slate-600 hover:bg-white hover:text-slate-900'
      }`}
    >
      {label}

      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] ${
          active
            ? 'bg-white/15 text-white'
            : 'bg-slate-200 text-slate-600'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty State                                                                */
/* -------------------------------------------------------------------------- */

function EmptyState({
  type,
}: {
  type: RegisterTab;
}) {
  const pending = type === 'pending';

  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        {pending ? (
          <Clock3 className="h-6 w-6" />
        ) : (
          <CheckCircle2 className="h-6 w-6" />
        )}
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-900">
        {pending
          ? 'Nothing is awaiting disbursement'
          : 'No completed disbursements'}
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        {pending
          ? 'Approved requests with an outstanding balance will appear here.'
          : 'Fully disbursed and reconciled requests will remain available in this register.'}
      </p>

      {pending && (
        <Link
          to="/finance/fund-requests"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          View fund requests
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Workflow Badge                                                             */
/* -------------------------------------------------------------------------- */

function WorkflowBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
      {children}
    </span>
  );
}