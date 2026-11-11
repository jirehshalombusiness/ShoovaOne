import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, BarChart3, Download, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NAV_SECTIONS } from '@/app/nav.config';
import { useHRAccess } from '@/hooks/useHRAccess';
import { financialReportService } from '@/features/finance/financial-report.service';
import { payrollService } from '@/features/payroll/payroll.service';
import { useAuth } from '@/lib/auth';
import { crmService } from '@/services/crm.service';
import { hrService } from '@/services/hr.service';
import { myWorkService } from '@/services/mywork.service';
import { cn } from '@/lib/utils';

interface Metric {
  label: string;
  value: string | number;
  displayValue: string;
  currency?: string;
}

interface SummaryReport {
  id: string;
  title: string;
  period: string;
  path: string;
  loading: boolean;
  error: boolean;
  metrics: Metric[];
}

function numberValue(value: number): string {
  return new Intl.NumberFormat('en-GH', { maximumFractionDigits: 2 }).format(value);
}

function moneyValue(value: number, currency: string): string {
  return `${currency} ${numberValue(value)}`;
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function exportSummaries(reports: SummaryReport[]) {
  const generatedAt = new Date().toISOString();
  const rows: (string | number)[][] = [
    ['Module', 'Metric', 'Value', 'Currency', 'Reporting period', 'Generated at'],
    ...reports.flatMap((report) =>
      report.metrics.map((metric) => [
        report.title,
        metric.label,
        metric.value,
        metric.currency ?? '',
        report.period,
        generatedAt,
      ]),
    ),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `shoova-reports-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const REPORT_PATHS: Record<string, string> = {
  '/hr': '/hr/reports',
  '/crm': '/crm/reports',
  '/finance': '/finance/reports',
  '/payroll': '/payroll/reports',
};

const MODULE_DESCRIPTIONS: Record<string, string> = {
  '/dashboard': 'Organisation-wide overview and key indicators',
  '/my-work': 'Your tasks, due dates and weekly time summary',
  '/chat': 'Conversations and collaboration activity',
  '/me': 'Your HR, time off and employment information',
  '/my-learning': 'Your learning progress and assignments',
  '/notifications': 'Your notifications and updates',
  '/projects': 'Projects, delivery and project activity',
  '/documents': 'Shared document activity',
  '/meetings': 'Meetings and attendance',
  '/tasks': 'Task status and workload',
  '/timesheets': 'Submitted and approved work hours',
  '/attendance': 'Attendance and check-in activity',
  '/people/org-chart': 'Organisation structure',
  '/people': 'People and directory information',
  '/hr': 'Headcount, leave, contracts and people trends',
  '/crm': 'Pipeline, opportunities and forecasts',
  '/programmes': 'Programme, learner and cohort outcomes',
  '/events': 'Events and participation',
  '/finance': 'Budgets, expenditure and receivables',
  '/payroll': 'Payroll cost and statutory reporting',
  '/settings': 'Organisation and application configuration',
  '/help': 'Help resources and support',
  '/users': 'User account administration',
  '/roles': 'Roles and permission administration',
  '/audit': 'Security and system audit activity',
};

export function ReportsPage() {
  const access = useHRAccess();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const today = new Date().toISOString().slice(0, 10);

  const workQuery = useQuery({
    queryKey: ['reports', 'my-work'],
    queryFn: () => myWorkService.getSummary(),
  });
  const hrQuery = useQuery({
    queryKey: ['reports', 'hr-headcount'],
    queryFn: () => hrService.getHeadcountReport(),
    enabled: access.canViewSensitive,
  });
  const crmQuery = useQuery({
    queryKey: ['reports', 'crm'],
    queryFn: () => crmService.getReport({ period: 'this_year' }),
    enabled: access.has('crm.view'),
  });
  const financeQuery = useQuery({
    queryKey: ['reports', 'finance', yearStart, today],
    queryFn: () =>
      financialReportService.getSummary({
        start_date: yearStart,
        end_date: today,
      }),
    enabled: access.has('finance.view'),
  });
  const payrollQuery = useQuery({
    queryKey: ['reports', 'payroll', yearStart, today],
    queryFn: () => payrollService.getSummary(yearStart, today),
    enabled: access.has('payroll.reports'),
  });

  const summaries = useMemo<SummaryReport[]>(() => {
    const reports: SummaryReport[] = [
      {
        id: 'my-work',
        title: 'My Work',
        period: 'Current week',
        path: '/my-work',
        loading: workQuery.isLoading,
        error: workQuery.isError,
        metrics: workQuery.data
          ? [
              { label: 'Open tasks', value: workQuery.data.open_tasks, displayValue: numberValue(workQuery.data.open_tasks) },
              { label: 'Overdue tasks', value: workQuery.data.overdue_tasks, displayValue: numberValue(workQuery.data.overdue_tasks) },
              { label: 'Hours this week', value: workQuery.data.timesheet_hours, displayValue: `${numberValue(workQuery.data.timesheet_hours)} h` },
            ]
          : [],
      },
    ];

    if (access.canViewSensitive) {
      reports.push({
        id: 'hr',
        title: 'My HR · People',
        period: 'Year to date',
        path: '/hr/reports',
        loading: hrQuery.isLoading,
        error: hrQuery.isError,
        metrics: hrQuery.data
          ? [
              { label: 'Total people', value: hrQuery.data.total, displayValue: numberValue(hrQuery.data.total) },
              { label: 'Active', value: hrQuery.data.active, displayValue: numberValue(hrQuery.data.active) },
              { label: 'Hired this year', value: hrQuery.data.hired_this_year, displayValue: numberValue(hrQuery.data.hired_this_year) },
              { label: 'Left this year', value: hrQuery.data.left_this_year, displayValue: numberValue(hrQuery.data.left_this_year) },
            ]
          : [],
      });
    }

    if (access.has('crm.view')) {
      reports.push({
        id: 'crm',
        title: 'CRM',
        period: 'Year to date',
        path: '/crm/reports',
        loading: crmQuery.isLoading,
        error: crmQuery.isError,
        metrics: crmQuery.data
          ? [
              { label: 'Open opportunities', value: crmQuery.data.summary.open_count, displayValue: numberValue(crmQuery.data.summary.open_count) },
              { label: 'Open pipeline', value: crmQuery.data.summary.open_value, displayValue: moneyValue(crmQuery.data.summary.open_value, crmQuery.data.base_currency), currency: crmQuery.data.base_currency },
              { label: 'Won value', value: crmQuery.data.summary.won_value, displayValue: moneyValue(crmQuery.data.summary.won_value, crmQuery.data.base_currency), currency: crmQuery.data.base_currency },
              { label: 'Win rate', value: crmQuery.data.summary.win_rate, displayValue: `${numberValue(crmQuery.data.summary.win_rate)}%` },
            ]
          : [],
      });
    }

    if (access.has('finance.view')) {
      reports.push({
        id: 'finance',
        title: 'Finance',
        period: 'Year to date',
        path: '/finance/reports',
        loading: financeQuery.isLoading,
        error: financeQuery.isError,
        metrics: financeQuery.data
          ? [
              { label: 'Budget', value: financeQuery.data.total_budget, displayValue: moneyValue(financeQuery.data.total_budget, financeQuery.data.currency), currency: financeQuery.data.currency },
              { label: 'Disbursed', value: financeQuery.data.total_funds_disbursed, displayValue: moneyValue(financeQuery.data.total_funds_disbursed, financeQuery.data.currency), currency: financeQuery.data.currency },
              { label: 'Expenditure', value: financeQuery.data.total_expenditure, displayValue: moneyValue(financeQuery.data.total_expenditure, financeQuery.data.currency), currency: financeQuery.data.currency },
              { label: 'Outstanding receivables', value: financeQuery.data.outstanding_receivables, displayValue: moneyValue(financeQuery.data.outstanding_receivables, financeQuery.data.currency), currency: financeQuery.data.currency },
            ]
          : [],
      });
    }

    if (access.has('payroll.reports')) {
      reports.push({
        id: 'payroll',
        title: 'Payroll',
        period: `${yearStart} to ${today}`,
        path: '/payroll/reports',
        loading: payrollQuery.isLoading,
        error: payrollQuery.isError,
        metrics: payrollQuery.data
          ? [
              { label: 'Employee count across runs', value: payrollQuery.data.totals.employee_count, displayValue: numberValue(payrollQuery.data.totals.employee_count) },
              { label: 'Finalized payroll runs', value: payrollQuery.data.runs.length, displayValue: numberValue(payrollQuery.data.runs.length) },
            ]
          : [],
      });
    }
    return reports;
  }, [
    access,
    crmQuery.data,
    crmQuery.isError,
    crmQuery.isLoading,
    financeQuery.data,
    financeQuery.isError,
    financeQuery.isLoading,
    hrQuery.data,
    hrQuery.isError,
    hrQuery.isLoading,
    payrollQuery.data,
    payrollQuery.isError,
    payrollQuery.isLoading,
    today,
    yearStart,
    workQuery.data,
    workQuery.isError,
    workQuery.isLoading,
  ]);

  const modules = NAV_SECTIONS.flatMap((section) => section.items)
    .filter(
      (item) =>
        item.path !== '/reports' &&
        (!item.permission || access.has(item.permission)),
    )
    .map((item) => ({
      ...item,
      target: REPORT_PATHS[item.path] ?? item.path,
      description: MODULE_DESCRIPTIONS[item.path] ?? 'Module reporting and activity',
      hasReport: Boolean(REPORT_PATHS[item.path]) || item.path === '/my-work',
    }));
  const moduleGroups = NAV_SECTIONS.map((section) => ({
    label: section.label,
    modules: modules.filter((module) =>
      section.items.some((item) => item.path === module.path),
    ),
  }))
    .map((section) => ({
      ...section,
      modules: section.modules.filter((module) =>
        `${module.label} ${module.description}`.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((section) => section.modules.length > 0);
  const filteredModules = moduleGroups.flatMap((section) => section.modules);
  const readyReports = summaries.filter((report) => report.metrics.length > 0);
  const pendingReports = summaries.filter((report) => report.loading);

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <BarChart3 className="h-4 w-4" />
            Reporting hub
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
            Reports
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Module summaries and report links{user?.first_name ? ` for ${user.first_name}` : ''}.
            Sensitive summaries follow your existing module access.
          </p>
        </div>
        <button
          type="button"
          disabled={readyReports.length === 0}
          onClick={() => exportSummaries(readyReports)}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export summaries CSV
        </button>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <OverviewStat label="Accessible modules" value={modules.length} />
        <OverviewStat label="Summary reports" value={summaries.length} />
        <OverviewStat
          label="Summaries ready"
          value={`${readyReports.length}${pendingReports.length ? ` · ${pendingReports.length} loading` : ''}`}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Module summaries</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Current live summaries from modules that already provide reporting data.
            The export contains only the summaries shown here.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {summaries.map((report) => (
            <SummaryCard key={report.id} report={report} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Browse modules</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Open a module report or explore the module. Access is filtered to your permissions.
            </p>
          </div>
          <label className="relative block w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search modules"
              className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
        </div>
        {filteredModules.length ? (
          <div className="space-y-5">
            {moduleGroups.map((section) => (
              <div key={section.label} className="space-y-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {section.label}
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {section.modules.map((module) => {
                    const Icon = module.icon;
                    return (
                      <Link
                        key={module.path}
                        to={module.target}
                        className="group flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-primary/40 hover:bg-primary/[0.02]"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-50 text-gray-600 group-hover:bg-primary/10 group-hover:text-primary">
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-gray-900">
                              {module.label}
                            </span>
                            <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-400 group-hover:text-primary" />
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-gray-500">
                            {module.description}
                          </span>
                          <span
                            className={cn(
                              'mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
                              module.hasReport
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-gray-100 text-gray-600',
                            )}
                          >
                            {module.hasReport ? 'Report available' : 'Open module'}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500">
            No accessible modules match “{search}”.
          </div>
        )}
      </section>
    </div>
  );
}

function OverviewStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value}</div>
    </div>
  );
}

function SummaryCard({ report }: { report: SummaryReport }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{report.title}</h3>
          <p className="mt-0.5 text-xs text-gray-500">{report.period}</p>
        </div>
        <Link
          to={report.path}
          aria-label={`Open ${report.title} report`}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-primary"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
      {report.loading ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-12 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      ) : report.error ? (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Could not load this summary. Open the module report to retry.
        </p>
      ) : report.metrics.length ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {report.metrics.map((metric) => (
            <div key={metric.label} className="min-w-0">
              <dt className="truncate text-[11px] text-gray-500">{metric.label}</dt>
              <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-gray-900">
                {metric.displayValue}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-4 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
          No summary data is available yet.
        </p>
      )}
    </article>
  );
}
