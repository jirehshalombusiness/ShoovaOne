import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Landmark,
  Loader2,
  Plus,
  Receipt,
  RefreshCcw,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { PayrollStatusBadge } from '../PayrollStatusBadge';
import { payrollService } from '../payroll.service';
import {
  formatDate,
  formatMoney,
  formatNumber,
  getErrorMessage,
  titleCase,
} from '../payroll.utils';
import { useHRAccess } from '@/hooks/useHRAccess';

const WORKFLOW = [
  {
    title: 'Timesheets',
    detail: 'Employees submit weekly hours; their direct manager approves.',
  },
  {
    title: 'HR review',
    detail: 'HR checks approved hours across the organisation and prepares the run.',
  },
  {
    title: 'Calculate',
    detail: 'Gross pay, overtime, statutory deductions, loans and other deductions are computed.',
  },
  {
    title: 'Finance review',
    detail: 'Finance checks totals and either approves or returns the run to HR.',
  },
  {
    title: 'Final approval',
    detail: 'A separate approver signs off. The run is then finalized and payslips are issued.',
  },
  {
    title: 'Disbursement',
    detail: 'Finance creates a payment batch, generates the bank file, submits and reconciles.',
  },
];

export function PayrollOverviewPage() {
  const access = useHRAccess();

  const overviewQuery = useQuery({
    queryKey: ['payroll', 'overview'],
    queryFn: () => payrollService.getOverview(),
  });

  const runsQuery = useQuery({
    queryKey: ['payroll', 'runs', 'recent'],
    queryFn: () => payrollService.getRuns(),
  });

  const loading = overviewQuery.isLoading || runsQuery.isLoading;
  const error = overviewQuery.error ?? runsQuery.error;

  const refresh = () => {
    overviewQuery.refetch();
    runsQuery.refetch();
  };

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading payroll overview...
        </div>
      </div>
    );
  }

  const overview = overviewQuery.data;
  const runs = runsQuery.data ?? [];

  const awaitingFinance = runs.filter((run) => run.status === 'hr_approved').length;
  const prepared = runs.filter((run) =>
    ['draft', 'calculated', 'finance_approved', 'approved'].includes(run.status),
  ).length;
  const recentRuns = runs.slice(0, 6);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Payroll</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Payroll overview
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            The full cycle from approved timesheets to salary payment, with HR,
            Finance and final approval separated.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refresh}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>

          {access.has('payroll.prepare') && (
            <Link
              to="/payroll/runs?new=1"
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              New pay run
            </Link>
          )}
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Unable to load payroll data</p>
            <p className="mt-1">{getErrorMessage(error)}</p>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Runs awaiting Finance"
          value={formatNumber(awaitingFinance)}
          description="Calculated by HR and submitted for Finance review"
          icon={Clock3}
          tone="warning"
        />
        <SummaryCard
          label="Open runs"
          value={formatNumber(prepared)}
          description="Draft, calculated, in review or approved"
          icon={CalendarRange}
          tone="accent"
        />
        <SummaryCard
          label="Pending remittances"
          value={formatNumber(overview?.pending_remittances.count ?? 0)}
          description={`${formatMoney(
            overview?.pending_remittances.total ?? 0,
          )} due to statutory schemes`}
          icon={Landmark}
          tone="default"
        />
        <SummaryCard
          label="Active staff loans"
          value={formatNumber(overview?.active_loans.count ?? 0)}
          description={`${formatMoney(
            overview?.active_loans.outstanding_balance ?? 0,
          )} outstanding`}
          icon={Receipt}
          tone="positive"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Recent pay runs</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                The latest payroll cycles across all pay groups.
              </p>
            </div>
            <Link
              to="/payroll/runs"
              className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-950"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {recentRuns.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Wallet className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">
                No pay runs yet
              </h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Create your first run after a pay period and pay group have been
                configured.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Period</Th>
                    <Th>Status</Th>
                    <Th align="right">Employees</Th>
                    <Th align="right">Net pay</Th>
                    <Th align="right">Employer cost</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {run.period_name ?? '—'}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {run.pay_group_name ?? 'Pay group'} ·{' '}
                          {titleCase(run.run_type)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <PayrollStatusBadge status={run.status} />
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-slate-700">
                        {formatNumber(run.employee_count)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">
                        {formatMoney(run.total_net, run.currency)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-slate-700">
                        {formatMoney(run.total_employer_cost, run.currency)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          to={`/payroll/runs/${run.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          Open
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-950">
              Controlled workflow
            </h2>
          </div>

          <ol className="mt-4 space-y-4">
            {WORKFLOW.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
            The preparer, Finance reviewer and final approver must be different
            people. Finalized runs are locked and feed the bank payment batch.
          </div>
        </div>
      </section>

      {access.has('payroll.reports') && (
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-4">
          <Banknote className="h-5 w-5 shrink-0 text-blue-600" />
          <p className="min-w-0 flex-1 text-sm text-blue-900">
            Payroll cost, statutory remittances and department costs are available
            in the payroll reports workspace.
          </p>
          <Link
            to="/payroll/reports"
            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-800 hover:text-blue-950"
          >
            Open reports
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      )}

      {access.has(['payroll.config']) && recentRuns.length === 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1 text-sm text-amber-900">
            Before your first run, configure at least one pay period, pay group and
            statutory scheme.
          </p>
          <Link
            to="/payroll/config"
            className="inline-flex items-center gap-1 text-sm font-semibold text-amber-900 hover:text-amber-950"
          >
            Open configuration
            <ArrowRight className="h-4 w-4" />
          </Link>
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
  icon: React.ElementType;
  tone: 'default' | 'warning' | 'accent' | 'positive';
}) {
  const toneClasses = {
    default: { icon: 'bg-slate-100 text-slate-700', value: 'text-slate-900' },
    warning: { icon: 'bg-amber-50 text-amber-700', value: 'text-amber-700' },
    accent: { icon: 'bg-blue-50 text-blue-700', value: 'text-blue-700' },
    positive: { icon: 'bg-emerald-50 text-emerald-700', value: 'text-emerald-700' },
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-start gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p
            className={`mt-2 break-words text-2xl font-semibold tracking-tight ${toneClasses[tone].value}`}
          >
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
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

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}
