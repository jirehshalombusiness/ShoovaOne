import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  FileBarChart,
  Loader2,
  Printer,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { financialReportService } from '../financial-report.service';

import type {
  BudgetVsActualItem,
  FinancialReportFilters,
  FinancialSummary,
  FundFlowReport,
  IncomeExpenditureReport,
  ReceivableItem,
} from '../financial-report.types';

function formatCurrency(
  amount: number,
  currency: string
): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-GH', {
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date?: string | null): string {
  if (!date) return '—';

  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

function getStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function getStatusClasses(status: string): string {
  switch (status) {
    case 'active':
    case 'paid':
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200';

    case 'approved':
    case 'issued':
    case 'partially_paid':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200';

    case 'submitted':
    case 'under_review':
      return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200';

    case 'closed':
    case 'cancelled':
      return 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200';

    default:
      return 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200';
  }
}

function getUtilisationClasses(
  percentage: number
): string {
  if (percentage >= 100) {
    return 'text-red-700';
  }

  if (percentage >= 80) {
    return 'text-amber-700';
  }

  return 'text-emerald-700';
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="relative min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="min-w-0 pr-14">
        <p className="min-h-5 text-sm font-medium leading-5 text-slate-500">
          {title}
        </p>

        <p className="mt-2 break-words text-2xl font-bold leading-8 tracking-tight text-slate-900">
          {value}
        </p>

        {description && (
          <p className="mt-1 break-words text-xs leading-5 text-slate-400">
            {description}
          </p>
        )}
      </div>

      <div className="absolute right-4 top-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
        <Icon className="h-5 w-5 text-slate-600" />
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-900">
        {title}
      </h2>

      {description && (
        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}

export function FinancialReportsPage() {
  const [currency, setCurrency] = useState('GHS');

  const [startDate, setStartDate] =
    useState('');
  const [endDate, setEndDate] =
    useState('');
  const [fiscalYear, setFiscalYear] =
    useState('');

  const [includePaidReceivables, setIncludePaidReceivables] =
    useState(false);

  const [currencies, setCurrencies] =
    useState<string[]>([]);

  const [summary, setSummary] =
    useState<FinancialSummary | null>(null);

  const [budgetVsActual, setBudgetVsActual] =
    useState<BudgetVsActualItem[]>([]);

  const [incomeExpenditure, setIncomeExpenditure] =
    useState<IncomeExpenditureReport | null>(null);

  const [receivables, setReceivables] =
    useState<ReceivableItem[]>([]);

  const [fundFlow, setFundFlow] =
    useState<FundFlowReport | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [refreshing, setRefreshing] =
    useState(false);

  const filters = useMemo<FinancialReportFilters>(
    () => ({
      currency,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      fiscal_year:
        fiscalYear || undefined,
      include_paid: includePaidReceivables,
    }),
    [
      currency,
      startDate,
      endDate,
      fiscalYear,
      includePaidReceivables,
    ]
  );

  const loadCurrencies = useCallback(
    async () => {
      const response =
        await financialReportService.getCurrencies();

      const availableCurrencies =
        response.currencies.map(
          (item) => item.currency
        );

      setCurrencies(availableCurrencies);

      if (
        availableCurrencies.length > 0 &&
        !availableCurrencies.includes(currency)
      ) {
        setCurrency(
          availableCurrencies.includes('GHS')
            ? 'GHS'
            : availableCurrencies[0]
        );
      }
    },
    [currency]
  );

  const loadReports = useCallback(
    async () => {
      try {
        setError(null);

        const [
          summaryResult,
          budgetResult,
          incomeResult,
          receivablesResult,
          fundFlowResult,
        ] = await Promise.all([
          financialReportService.getSummary(
            filters
          ),

          financialReportService.getBudgetVsActual(
            filters
          ),

          financialReportService.getIncomeExpenditure(
            filters
          ),

          financialReportService.getReceivables(
            filters
          ),

          financialReportService.getFundFlow(
            filters
          ),
        ]);

        setSummary(summaryResult);
        setBudgetVsActual(budgetResult);
        setIncomeExpenditure(
          incomeResult
        );
        setReceivables(
          receivablesResult
        );
        setFundFlow(
          fundFlowResult
        );
      } catch (err) {
        console.error(
          'Failed to load financial reports:',
          err
        );

        setError(
          'Unable to load financial reports. Please try again.'
        );
      }
    },
    [filters]
  );

  useEffect(() => {
    let mounted = true;

    async function loadInitialData() {
      try {
        setLoading(true);
        setError(null);

        const currencyResult =
          await financialReportService.getCurrencies();

        if (!mounted) return;

        const availableCurrencies =
          currencyResult.currencies.map(
            (item) => item.currency
          );

        setCurrencies(
          availableCurrencies
        );

        const selectedCurrency =
          availableCurrencies.includes(
            currency
          )
            ? currency
            : availableCurrencies.includes(
                'GHS'
              )
              ? 'GHS'
              : availableCurrencies[0];

        if (
          selectedCurrency &&
          selectedCurrency !== currency
        ) {
          setCurrency(
            selectedCurrency
          );
        }

        const reportFilters: FinancialReportFilters =
          {
            currency:
              selectedCurrency || 'GHS',
            start_date:
              startDate || undefined,
            end_date:
              endDate || undefined,
            fiscal_year:
              fiscalYear || undefined,
            include_paid:
              includePaidReceivables,
          };

        const [
          summaryResult,
          budgetResult,
          incomeResult,
          receivablesResult,
          fundFlowResult,
        ] = await Promise.all([
          financialReportService.getSummary(
            reportFilters
          ),

          financialReportService.getBudgetVsActual(
            reportFilters
          ),

          financialReportService.getIncomeExpenditure(
            reportFilters
          ),

          financialReportService.getReceivables(
            reportFilters
          ),

          financialReportService.getFundFlow(
            reportFilters
          ),
        ]);

        if (!mounted) return;

        setSummary(summaryResult);
        setBudgetVsActual(
          budgetResult
        );
        setIncomeExpenditure(
          incomeResult
        );
        setReceivables(
          receivablesResult
        );
        setFundFlow(
          fundFlowResult
        );
      } catch (err) {
        console.error(
          'Failed to load financial reports:',
          err
        );

        if (mounted) {
          setError(
            'Unable to load financial reports. Please try again.'
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleApplyFilters() {
    try {
      setRefreshing(true);
      setError(null);

      await loadReports();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    try {
      setRefreshing(true);
      setError(null);

      await Promise.all([
        loadCurrencies(),
        loadReports(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const outstandingReceivables =
    receivables.reduce(
      (total, item) =>
        total + Number(item.outstanding || 0),
      0
    );

  const overdueReceivables =
    receivables
      .filter((item) => item.overdue)
      .reduce(
        (total, item) =>
          total +
          Number(item.outstanding || 0),
        0
      );

  return (
    <div className="space-y-6 pb-10 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between print:block">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-900 p-2.5">
              <FileBarChart className="h-6 w-6 text-white" />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Financial Reports
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Management reporting across budgets,
                expenditure, income, receivables, and
                fund flow.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing
                  ? 'animate-spin'
                  : ''
              }`}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      {/* Filters */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Report Filters
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Select the reporting currency and
            optional reporting period.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <label
              htmlFor="report-currency"
              className="mb-1.5 block text-xs font-medium text-slate-600"
            >
              Currency
            </label>

            <div className="relative">
              <select
                id="report-currency"
                value={currency}
                onChange={(event) =>
                  setCurrency(
                    event.target.value
                  )
                }
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              >
                {currencies.length === 0 ? (
                  <option value="GHS">
                    GHS
                  </option>
                ) : (
                  currencies.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    )
                  )
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div>
            <label
              htmlFor="report-fiscal-year"
              className="mb-1.5 block text-xs font-medium text-slate-600"
            >
              Fiscal Year
            </label>

            <input
              id="report-fiscal-year"
              type="text"
              placeholder="e.g. 2026"
              value={fiscalYear}
              onChange={(event) =>
                setFiscalYear(
                  event.target.value
                )
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="report-start-date"
              className="mb-1.5 block text-xs font-medium text-slate-600"
            >
              Start Date
            </label>

            <input
              id="report-start-date"
              type="date"
              value={startDate}
              onChange={(event) =>
                setStartDate(
                  event.target.value
                )
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="report-end-date"
              className="mb-1.5 block text-xs font-medium text-slate-600"
            >
              End Date
            </label>

            <input
              id="report-end-date"
              type="date"
              value={endDate}
              onChange={(event) =>
                setEndDate(
                  event.target.value
                )
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div className="flex flex-col justify-end">
            <label className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={
                  includePaidReceivables
                }
                onChange={(event) =>
                  setIncludePaidReceivables(
                    event.target.checked
                  )
                }
                className="h-4 w-4 rounded border-slate-300"
              />

              Include paid invoices
            </label>

            <button
              type="button"
              onClick={
                handleApplyFilters
              }
              disabled={
                refreshing || loading
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}

              Apply Filters
            </button>
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <div>
            <p className="font-medium">
              Unable to load report
            </p>

            <p className="mt-1">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="h-7 w-7 animate-spin" />

            <p className="text-sm">
              Loading financial reports...
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary */}
          <section>
            <SectionHeader
              title="Financial Summary"
              description={`Current reporting currency: ${currency}`}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Total Budget"
                value={
                  summary
                    ? formatCurrency(
                        summary.total_budget,
                        currency
                      )
                    : formatCurrency(
                        0,
                        currency
                      )
                }
                description="Recorded budgets"
                icon={Wallet}
              />

              <MetricCard
                title="Funds Disbursed"
                value={
                  summary
                    ? formatCurrency(
                        summary.total_funds_disbursed,
                        currency
                      )
                    : formatCurrency(
                        0,
                        currency
                      )
                }
                description="Disbursed fund requests"
                icon={ArrowDownRight}
              />

              <MetricCard
                title="Total Expenditure"
                value={
                  summary
                    ? formatCurrency(
                        summary.total_expenditure,
                        currency
                      )
                    : formatCurrency(
                        0,
                        currency
                      )
                }
                description="Expenses + reimbursements"
                icon={CircleDollarSign}
              />

              <MetricCard
                title="Total Received"
                value={
                  summary
                    ? formatCurrency(
                        summary.total_received,
                        currency
                      )
                    : formatCurrency(
                        0,
                        currency
                      )
                }
                description="Recorded invoice payments"
                icon={ArrowUpRight}
              />

              <MetricCard
                title="Outstanding Receivables"
                value={formatCurrency(
                  summary
                    ? summary.outstanding_receivables
                    : 0,
                  currency
                )}
                description="Unpaid invoice balances"
                icon={BarChart3}
              />

              <MetricCard
                title="Funds Requested"
                value={formatCurrency(
                  summary
                    ? summary.total_funds_requested
                    : 0,
                  currency
                )}
                description="Submitted/requested funds"
                icon={FileBarChart}
              />

              <MetricCard
                title="Expenses"
                value={formatCurrency(
                  summary
                    ? summary.total_expenses
                    : 0,
                  currency
                )}
                description="Recorded expenses"
                icon={ArrowDownRight}
              />

              <MetricCard
                title="Reimbursements"
                value={formatCurrency(
                  summary
                    ? summary.total_reimbursements
                    : 0,
                  currency
                )}
                description="Recorded reimbursements"
                icon={ArrowDownRight}
              />
            </div>
          </section>

          {/* Budget vs Actual */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="p-5 pb-0">
              <SectionHeader
                title="Budget vs Actual"
                description="Compare approved/active budgets against recorded expenditure."
              />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">
                      Budget
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Fiscal Year
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Budget
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Spent
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Remaining
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Utilisation
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {budgetVsActual.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-10 text-center text-sm text-slate-400"
                      >
                        No budget data available
                        for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    budgetVsActual.map(
                      (item) => (
                        <tr
                          key={item.budget_id}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <div className="font-medium text-slate-900">
                              {item.name}
                            </div>

                            <div className="mt-0.5 text-xs text-slate-400">
                              {
                                item.budget_number
                              }
                            </div>
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {
                              item.fiscal_year
                            }
                          </td>

                          <td className="px-5 py-4 text-right font-medium text-slate-900">
                            {formatCurrency(
                              item.budget_amount,
                              item.currency
                            )}
                          </td>

                          <td className="px-5 py-4 text-right text-slate-700">
                            {formatCurrency(
                              item.spent,
                              item.currency
                            )}
                          </td>

                          <td className="px-5 py-4 text-right text-slate-700">
                            {formatCurrency(
                              item.remaining,
                              item.currency
                            )}
                          </td>

                          <td
                            className={`px-5 py-4 text-right font-semibold ${getUtilisationClasses(
                              item.utilisation_percentage
                            )}`}
                          >
                            {formatNumber(
                              item.utilisation_percentage
                            )}
                            %
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                                item.status
                              )}`}
                            >
                              {getStatusLabel(
                                item.status
                              )}
                            </span>
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Income and expenditure */}
          <section>
            <SectionHeader
              title="Income & Expenditure"
              description="Summary of recorded income and expenditure for the selected period."
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Income"
                value={formatCurrency(
                  incomeExpenditure
                    ?.income ?? 0,
                  currency
                )}
                description="Completed invoice payments"
                icon={ArrowUpRight}
              />

              <MetricCard
                title="Expenses"
                value={formatCurrency(
                  incomeExpenditure
                    ?.expenses ?? 0,
                  currency
                )}
                description="Approved/paid expenses"
                icon={ArrowDownRight}
              />

              <MetricCard
                title="Reimbursements"
                value={formatCurrency(
                  incomeExpenditure
                    ?.reimbursements ?? 0,
                  currency
                )}
                description="Approved/paid reimbursements"
                icon={ArrowDownRight}
              />

              <MetricCard
                title="Net Cash Flow"
                value={formatCurrency(
                  incomeExpenditure
                    ?.net_cash_flow ?? 0,
                  currency
                )}
                description="Income less expenditure"
                icon={CircleDollarSign}
              />
            </div>
          </section>

          {/* Fund Flow */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeader
              title="Fund Flow"
              description="Movement of recorded funds during the selected reporting period."
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                title="Inflow"
                value={formatCurrency(
                  fundFlow?.inflow ?? 0,
                  currency
                )}
                icon={ArrowUpRight}
              />

              <MetricCard
                title="Fund Disbursements"
                value={formatCurrency(
                  fundFlow
                    ?.fund_disbursements ?? 0,
                  currency
                )}
                icon={ArrowDownRight}
              />

              <MetricCard
                title="Expense Outflow"
                value={formatCurrency(
                  fundFlow
                    ?.expense_outflow ?? 0,
                  currency
                )}
                icon={ArrowDownRight}
              />

              <MetricCard
                title="Reimbursement Outflow"
                value={formatCurrency(
                  fundFlow
                    ?.reimbursement_outflow ??
                    0,
                  currency
                )}
                icon={ArrowDownRight}
              />

              <MetricCard
                title="Net Flow"
                value={formatCurrency(
                  fundFlow?.net_flow ?? 0,
                  currency
                )}
                icon={CircleDollarSign}
              />
            </div>
          </section>

          {/* Receivables */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 p-5 pb-0 md:flex-row md:items-start md:justify-between">
              <SectionHeader
                title="Receivables"
                description="Outstanding invoice balances and overdue receivables."
              />

              <div className="flex gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-600">
                  Outstanding:{' '}
                  {formatCurrency(
                    outstandingReceivables,
                    currency
                  )}
                </span>

                <span className="rounded-full bg-red-50 px-3 py-1.5 font-medium text-red-700">
                  Overdue:{' '}
                  {formatCurrency(
                    overdueReceivables,
                    currency
                  )}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">
                      Invoice
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Customer
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Issue Date
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Due Date
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Amount
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Paid
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Outstanding
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {receivables.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-10 text-center text-sm text-slate-400"
                      >
                        No receivables found
                        for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    receivables.map(
                      (item) => (
                        <tr
                          key={
                            item.invoice_id
                          }
                          className="hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <div className="font-medium text-slate-900">
                              {
                                item.invoice_number
                              }
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="font-medium text-slate-700">
                              {
                                item.customer_name
                              }
                            </div>

                            {item.customer_email && (
                              <div className="mt-0.5 text-xs text-slate-400">
                                {
                                  item.customer_email
                                }
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {formatDate(
                              item.issue_date
                            )}
                          </td>

                          <td
                            className={`px-5 py-4 ${
                              item.overdue
                                ? 'font-medium text-red-600'
                                : 'text-slate-600'
                            }`}
                          >
                            {formatDate(
                              item.due_date
                            )}

                            {item.overdue && (
                              <div className="mt-0.5 text-xs">
                                Overdue
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-4 text-right text-slate-700">
                            {formatCurrency(
                              item.amount,
                              item.currency
                            )}
                          </td>

                          <td className="px-5 py-4 text-right text-slate-700">
                            {formatCurrency(
                              item.amount_paid,
                              item.currency
                            )}
                          </td>

                          <td className="px-5 py-4 text-right font-semibold text-slate-900">
                            {formatCurrency(
                              item.outstanding,
                              item.currency
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                                item.status
                              )}`}
                            >
                              {getStatusLabel(
                                item.status
                              )}
                            </span>
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Reporting period */}
          <section className="flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between print:border-slate-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5" />

              <span>
                Reporting currency:{' '}
                <strong className="text-slate-600">
                  {currency}
                </strong>
              </span>
            </div>

            <span>
              {startDate || endDate
                ? `${formatDate(
                    startDate
                  )} – ${formatDate(endDate)}`
                : fiscalYear
                  ? `Fiscal Year ${fiscalYear}`
                  : 'All available periods'}
            </span>
          </section>
        </>
      )}
    </div>
  );
}