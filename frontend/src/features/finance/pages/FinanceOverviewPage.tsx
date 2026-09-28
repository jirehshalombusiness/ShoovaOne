import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  Landmark,
  Receipt,
  RefreshCcw,
  ShieldCheck,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { financeService } from '../finance.service';
import type {
  FinanceCurrencyTotals,
  FinanceOverview,
} from '../finance.types';

const currencyLocales: Record<string, string> = {
  GHS: 'en-GH',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
};

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(
    currencyLocales[currency] ?? 'en-US',
    {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-GH').format(value);
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  href,
  tone = 'default',
}: {
  label: string;
  value: string;
  description: string;
  icon: typeof Wallet;
  href?: string;
  tone?: 'default' | 'positive' | 'warning' | 'accent';
}) {
  const toneClasses = {
    default: {
      icon: 'bg-slate-100 text-slate-700',
      value: 'text-slate-900',
    },
    positive: {
      icon: 'bg-emerald-50 text-emerald-700',
      value: 'text-emerald-700',
    },
    warning: {
      icon: 'bg-amber-50 text-amber-700',
      value: 'text-amber-700',
    },
    accent: {
      icon: 'bg-blue-50 text-blue-700',
      value: 'text-blue-700',
    },
  };

  const content = (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md">
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

      {href && (
        <div className="mt-4 flex items-center gap-1 text-xs font-medium text-slate-500">
          View details
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );

  return href ? <Link to={href}>{content}</Link> : content;
}

function AttentionItem({
  title,
  description,
  count,
  href,
  icon: Icon,
  tone = 'warning',
}: {
  title: string;
  description: string;
  count: number;
  href: string;
  icon: typeof AlertTriangle;
  tone?: 'warning' | 'neutral' | 'danger';
}) {
  const styles = {
    warning: {
      wrapper: 'border-amber-200 bg-amber-50/50',
      icon: 'bg-amber-100 text-amber-700',
      count: 'text-amber-800',
    },
    neutral: {
      wrapper: 'border-slate-200 bg-slate-50/50',
      icon: 'bg-slate-100 text-slate-700',
      count: 'text-slate-800',
    },
    danger: {
      wrapper: 'border-red-200 bg-red-50/50',
      icon: 'bg-red-100 text-red-700',
      count: 'text-red-800',
    },
  };

  return (
    <Link
      to={href}
      className={`group flex items-center gap-4 rounded-xl border p-4 transition hover:shadow-sm ${styles[tone].wrapper}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${styles[tone].icon}`}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900">
          {title}
        </p>

        <p className="mt-0.5 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`text-xl font-semibold ${styles[tone].count}`}
        >
          {formatNumber(count)}
        </span>

        <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function WorkflowStage({
  label,
  count,
  description,
  icon: Icon,
  tone,
}: {
  label: string;
  count: number;
  description: string;
  icon: typeof Clock3;
  tone: 'slate' | 'amber' | 'emerald' | 'blue';
}) {
  const styles = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  return (
    <div className="relative">
      <div className={`rounded-xl border p-4 ${styles[tone]}`}>
        <div className="flex items-center justify-between">
          <Icon className="h-5 w-5" />

          <span className="text-2xl font-semibold">
            {formatNumber(count)}
          </span>
        </div>

        <p className="mt-4 text-sm font-semibold text-slate-900">
          {label}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function QuickAccessCard({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: typeof FileText;
}) {
  return (
    <Link
      to={href}
      className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>

        <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
      </div>

      <h3 className="mt-4 font-semibold text-slate-900">
        {title}
      </h3>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </Link>
  );
}

function CurrencyTotalsList({
  totals,
}: {
  totals: Record<string, FinanceCurrencyTotals>;
}) {
  const entries = Object.entries(totals);

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
        No funding transactions have been recorded yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>Currency</span>
        <span className="text-right">Requested</span>
        <span className="text-right">Approved</span>
        <span className="text-right">Disbursed</span>
      </div>

      <div className="divide-y divide-slate-100">
        {entries.map(([currency, values]) => (
          <div
            key={currency}
            className="grid grid-cols-4 items-center px-4 py-4 text-sm"
          >
            <div className="font-semibold text-slate-900">
              {currency}
            </div>

            <div className="text-right font-medium text-slate-700">
              {formatCurrency(values.requested, currency)}
            </div>

            <div className="text-right font-medium text-emerald-700">
              {formatCurrency(values.approved, currency)}
            </div>

            <div className="text-right font-medium text-blue-700">
              {formatCurrency(values.disbursed, currency)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CurrencyMetricSummary({
  totals,
}: {
  totals: Record<string, FinanceCurrencyTotals>;
}) {
  const entries = Object.entries(totals);

  if (entries.length === 0) {
    return 'No funding recorded';
  }

  if (entries.length === 1) {
    const [currency, values] = entries[0];

    return formatCurrency(values.requested, currency);
  }

  return `${entries.length} currencies`;
}

function CurrencyAmountSummary({
  totals,
  field,
  emptyLabel,
}: {
  totals: Record<string, FinanceCurrencyTotals>;
  field: 'approved' | 'disbursed';
  emptyLabel: string;
}) {
  const entries = Object.entries(totals).filter(
    ([, values]) => values[field] > 0
  );

  if (entries.length === 0) {
    return emptyLabel;
  }

  if (entries.length === 1) {
    const [currency, values] = entries[0];

    return formatCurrency(values[field], currency);
  }

  return `${entries.length} currencies`;
}

export function FinanceOverviewPage() {
  const [overview, setOverview] =
    useState<FinanceOverview | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  async function loadOverview() {
    try {
      setLoading(true);
      setError(null);

      const data = await financeService.getOverview();

      setOverview(data);
    } catch (err) {
      console.error(
        'Failed to load finance overview:',
        err
      );

      setError(
        'We could not load the financial overview. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  const currencyEntries = useMemo(() => {
    if (!overview) {
      return [];
    }

    return Object.entries(
      overview.fund_totals_by_currency ?? {}
    );
  }, [overview]);

  const hasMultipleCurrencies =
    currencyEntries.length > 1;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-4 w-20 rounded bg-slate-200" />
          <div className="mt-3 h-8 w-72 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-96 max-w-full rounded bg-slate-200" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white xl:col-span-2" />
          <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
            <AlertTriangle className="h-5 w-5" />
          </div>

          <div className="flex-1">
            <h2 className="font-semibold text-red-900">
              Finance overview unavailable
            </h2>

            <p className="mt-1 text-sm text-red-700">
              {error ??
                'No financial overview data is currently available.'}
            </p>

            <button
              type="button"
              onClick={loadOverview}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800"
            >
              <RefreshCcw className="h-4 w-4" />
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Landmark className="h-4 w-4" />
            Finance
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Financial Overview
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Institutional view of funding requests, expenditure,
            disbursements, approvals, and financial controls.
          </p>
        </div>

        <button
          type="button"
          onClick={loadOverview}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </section>

      {/* Financial position */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Financial Position
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Current aggregate position across the Finance workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Funds Requested"
            value={CurrencyMetricSummary({
              totals: overview.fund_totals_by_currency,
            })}
            description={`${formatNumber(
              overview.total_fund_requests
            )} fund requests recorded`}
            icon={CircleDollarSign}
            href="/finance/fund-requests"
          />

          <MetricCard
            label="Funds Approved"
            value={CurrencyAmountSummary({
              totals: overview.fund_totals_by_currency,
              field: 'approved',
              emptyLabel: 'No approved funding',
            })}
            description={`${formatNumber(
              overview.approved_fund_requests
            )} approved requests`}
            icon={CheckCircle2}
            tone="positive"
            href="/finance/approvals"
          />

          <MetricCard
            label="Funds Disbursed"
            value={CurrencyAmountSummary({
              totals: overview.fund_totals_by_currency,
              field: 'disbursed',
              emptyLabel: 'No disbursements',
            })}
            description="See funding analysis for currency-level totals"
            icon={Banknote}
            tone="accent"
            href="/finance/disbursements"
          />

          <MetricCard
            label="Paid Expenses"
            value={formatCurrency(
              overview.total_paid_expenses,
              'GHS'
            )}
            description={`${formatNumber(
              overview.total_expenses
            )} expense records recorded`}
            icon={Wallet}
            tone="default"
            href="/finance/expenses"
          />
        </div>
      </section>

      {/* Management attention */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Management Attention
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Items currently requiring review, action, or financial control.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AttentionItem
            title="Fund Requests Awaiting Action"
            description="Requests currently in the approval workflow."
            count={overview.pending_fund_requests}
            href="/finance/fund-requests"
            icon={Clock3}
            tone="warning"
          />

          <AttentionItem
            title="Expenses Awaiting Action"
            description="Expense records that have not completed their workflow."
            count={overview.pending_expenses}
            href="/finance/expenses"
            icon={Receipt}
            tone="warning"
          />

          <AttentionItem
            title="Fund Requests Requiring Reconciliation"
            description="Disbursed funding requiring reconciliation."
            count={overview.fund_requests_requiring_reconciliation}
            href="/finance/reconciliation"
            icon={ClipboardCheck}
            tone="neutral"
          />

          <AttentionItem
            title="Expenses Requiring Reconciliation"
            description="Paid expenses awaiting financial reconciliation."
            count={overview.expenses_requiring_reconciliation}
            href="/finance/reconciliation"
            icon={ShieldCheck}
            tone="neutral"
          />
        </div>
      </section>

      {/* Funding analysis */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-slate-500" />

                <h2 className="text-lg font-semibold text-slate-900">
                  Funding Analysis
                </h2>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Funding totals are displayed separately by currency.
              </p>
            </div>

            <Link
              to="/finance/reports"
              className="hidden items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 sm:flex"
            >
              Reports
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8">
            <CurrencyTotalsList
              totals={overview.fund_totals_by_currency}
            />
          </div>

          {hasMultipleCurrencies && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">
                Multiple currencies detected
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-800">
                Funding amounts are intentionally not combined across
                currencies. Each currency is reported separately to avoid
                misleading financial totals.
              </p>
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 gap-3 border-t border-slate-100 pt-6 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Requests
              </p>

              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatNumber(overview.total_fund_requests)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Approved
              </p>

              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatNumber(overview.approved_fund_requests)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Pending
              </p>

              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatNumber(overview.pending_fund_requests)}
              </p>
            </div>
          </div>
        </div>

        {/* Expense position */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-slate-500" />

                <h2 className="text-lg font-semibold text-slate-900">
                  Expenditure
                </h2>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Current expense workflow position.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-3xl font-semibold tracking-tight text-slate-950">
              {formatCurrency(
                overview.total_expense_amount,
                'GHS'
              )}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Total recorded expenditure
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-slate-600">
                  Pending
                </span>
              </div>

              <span className="font-semibold text-slate-900">
                {formatNumber(overview.pending_expenses)}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm text-slate-600">
                  Approved
                </span>
              </div>

              <span className="font-semibold text-slate-900">
                {formatNumber(overview.approved_expenses)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-slate-600">
                  Paid
                </span>
              </div>

              <span className="font-semibold text-slate-900">
                {formatCurrency(
                  overview.total_paid_expenses,
                  'GHS'
                )}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow control */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Financial Workflow Control
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Operational view of the funding lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkflowStage
            label="Requests"
            count={overview.total_fund_requests}
            description="Funding requests recorded in the system."
            icon={FileText}
            tone="slate"
          />

          <WorkflowStage
            label="Pending Review"
            count={overview.pending_fund_requests}
            description="Requests requiring review or approval action."
            icon={Clock3}
            tone="amber"
          />

          <WorkflowStage
            label="Approved"
            count={overview.approved_fund_requests}
            description="Requests that have received approval."
            icon={FileCheck2}
            tone="emerald"
          />

          <WorkflowStage
            label="Disbursed"
            count={
              currencyEntries.some(
                ([, values]) => values.disbursed > 0
              )
                ? overview.approved_fund_requests
                : 0
            }
            description="Approved funding progressing through disbursement."
            icon={Banknote}
            tone="blue"
          />
        </div>
      </section>

      {/* Financial controls */}
      <section className="rounded-xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-slate-300" />

              <h2 className="text-lg font-semibold">
                Financial Controls
              </h2>
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              Finance activity should move through documented approval,
              disbursement, and reconciliation controls. Use the
              operational modules below to manage the financial lifecycle.
            </p>
          </div>

          <Link
            to="/finance/reconciliation"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Open Reconciliation
            <ArrowDownRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Quick access */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Finance Operations
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Access the core financial management areas.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <QuickAccessCard
            title="Fund Requests"
            description="Create, review, submit, approve, and track funding requests."
            href="/finance/fund-requests"
            icon={FileText}
          />

          <QuickAccessCard
            title="Expenses"
            description="Manage expenditure from submission through payment and reconciliation."
            href="/finance/expenses"
            icon={Receipt}
          />

          <QuickAccessCard
            title="Financial Reports"
            description="Review financial reporting and management-level financial information."
            href="/finance/reports"
            icon={BarChart3}
          />

          <QuickAccessCard
            title="Audit Trail"
            description="Review finance-related actions and financial governance records."
            href="/finance/audit-trail"
            icon={ShieldCheck}
          />
        </div>
      </section>

      {/* Footer status */}
      <div className="flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-3.5 w-3.5" />
          <span>
            Finance overview is based on recorded system transactions.
          </span>
        </div>

        <div className="flex items-center gap-1">
          <ArrowUpRight className="h-3.5 w-3.5" />
          <span>Institutional Finance Module</span>
        </div>
      </div>
    </div>
  );
}