import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  CalendarRange,
  Loader2,
  Receipt,
  RefreshCcw,
  Scale,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PayrollStatusBadge } from '../PayrollStatusBadge';
import { payrollService } from '../payroll.service';
import {
  formatDate,
  formatMoney,
  formatNumber,
  getErrorMessage,
  inputClasses,
  labelClasses,
  titleCase,
} from '../payroll.utils';
import { useHRAccess } from '@/hooks/useHRAccess';

type Tab = 'summary' | 'statutory' | 'department';

const REMITTANCE_STATUSES = ['', 'pending', 'paid'];

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function PayrollReportsPage() {
  const access = useHRAccess();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('summary');
  const [fromDate, setFromDate] = useState(
    isoDate(new Date(new Date().getFullYear(), 0, 1)),
  );
  const [toDate, setToDate] = useState(isoDate(new Date()));
  const [remittanceStatus, setRemittanceStatus] = useState('');
  const [runId, setRunId] = useState('');

  const canDisburse = access.has(['payroll.disburse', 'payroll.review_finance']);

  const summaryQuery = useQuery({
    queryKey: ['payroll', 'report', 'summary', fromDate, toDate],
    queryFn: () => payrollService.getSummary(fromDate, toDate),
    enabled: tab === 'summary',
  });

  const statutoryQuery = useQuery({
    queryKey: ['payroll', 'report', 'statutory', remittanceStatus],
    queryFn: () =>
      payrollService.getStatutoryReport(remittanceStatus || undefined),
    enabled: tab === 'statutory',
  });

  const runsQuery = useQuery({
    queryKey: ['payroll', 'runs'],
    queryFn: () => payrollService.getRuns(),
    enabled: tab === 'department',
  });

  const reportRuns = useMemo(
    () =>
      (runsQuery.data ?? []).filter((run) =>
        ['finalized', 'disbursing', 'paid', 'closed'].includes(run.status),
      ),
    [runsQuery.data],
  );

  const activeRunId = runId || reportRuns[0]?.id || '';

  const departmentQuery = useQuery({
    queryKey: ['payroll', 'report', 'department', activeRunId],
    queryFn: () => payrollService.getDepartmentCost(activeRunId),
    enabled: tab === 'department' && Boolean(activeRunId),
  });

  const payRemittanceMutation = useMutation({
    mutationFn: ({ id, reference }: { id: string; reference: string }) =>
      payrollService.payRemittance(id, reference),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'report', 'statutory'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'overview'] });
      toast.success('Remittance recorded as paid.');
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Could not record the remittance payment')),
  });

  const payRemittance = (remittance: { id: string; scheme_name: string }) => {
    const reference = window.prompt(
      `Payment reference for ${remittance.scheme_name}:`,
      '',
    );
    if (reference === null) return;
    if (!reference.trim()) {
      toast.error('A payment reference is required');
      return;
    }
    payRemittanceMutation.mutate({ id: remittance.id, reference: reference.trim() });
  };

  const summary = summaryQuery.data;
  const statutory = statutoryQuery.data;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Payroll</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Reports
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Payroll cost, statutory remittance and department cost reporting across
            finalized runs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            summaryQuery.refetch();
            statutoryQuery.refetch();
            departmentQuery.refetch();
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <TabButton active={tab === 'summary'} onClick={() => setTab('summary')}>
          <CalendarRange className="h-4 w-4" />
          Payroll summary
        </TabButton>
        <TabButton active={tab === 'statutory'} onClick={() => setTab('statutory')}>
          <Scale className="h-4 w-4" />
          Statutory & remittances
        </TabButton>
        <TabButton active={tab === 'department'} onClick={() => setTab('department')}>
          <Building2 className="h-4 w-4" />
          Department cost
        </TabButton>
      </div>

      {tab === 'summary' && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <label className={labelClasses()} htmlFor="report-from">
                From
              </label>
              <input
                id="report-from"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className={inputClasses()}
              />
            </div>
            <div>
              <label className={labelClasses()} htmlFor="report-to">
                To
              </label>
              <input
                id="report-to"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className={inputClasses()}
              />
            </div>
            <p className="pb-2 text-xs text-slate-500">
              Includes runs whose period pay date falls in this range.
            </p>
          </div>

          {summaryQuery.error && <ErrorBanner message={getErrorMessage(summaryQuery.error)} />}

          {summaryQuery.isLoading ? (
            <Loading label="Loading payroll summary..." />
          ) : summary ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Metric label="Gross pay" value={formatMoney(summary.totals.gross)} />
                <Metric
                  label="Employee deductions"
                  value={formatMoney(summary.totals.employee_deductions)}
                />
                <Metric
                  label="Employer contributions"
                  value={formatMoney(summary.totals.employer_contributions)}
                />
                <Metric label="Net pay" value={formatMoney(summary.totals.net)} />
                <Metric
                  label="Total employer cost"
                  value={formatMoney(summary.totals.employer_cost)}
                />
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="text-base font-semibold text-slate-950">By pay period</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatNumber(summary.totals.employee_count)} employee payments across{' '}
                    {formatNumber(summary.runs.length)} run(s).
                  </p>
                </div>
                {summary.by_period.length === 0 ? (
                  <Empty
                    icon={<CalendarRange className="h-5 w-5" />}
                    title="No finalized payroll in this range"
                    message="Finalized runs with a pay date in the selected range will appear here."
                  />
                ) : (
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <Th>Period</Th>
                        <Th>Pay date</Th>
                        <Th align="right">Employees</Th>
                        <Th align="right">Gross</Th>
                        <Th align="right">Net</Th>
                        <Th align="right">Employer cost</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.by_period.map((period) => (
                        <tr key={period.period_name}>
                          <td className="px-5 py-3 text-sm font-medium text-slate-900">
                            {period.period_name}
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-600">
                            {formatDate(period.pay_date)}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-slate-700">
                            {formatNumber(period.employee_count)}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-slate-700">
                            {formatMoney(period.gross)}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-slate-700">
                            {formatMoney(period.net)}
                          </td>
                          <td className="px-5 py-3 text-right text-sm font-semibold text-slate-900">
                            {formatMoney(period.employer_cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {summary.runs.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <h2 className="text-base font-semibold text-slate-950">Included runs</h2>
                  </div>
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <Th>Run</Th>
                        <Th>Period</Th>
                        <Th>Status</Th>
                        <Th align="right">Net</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.runs.map((run) => (
                        <tr key={run.id}>
                          <td className="px-5 py-3 text-sm font-medium text-slate-900">
                            {run.run_number ?? '—'}
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-600">
                            {run.period_name ?? '—'}
                          </td>
                          <td className="px-5 py-3">
                            <PayrollStatusBadge status={run.status} />
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-slate-700">
                            {formatMoney(run.total_net, run.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </section>
      )}

      {tab === 'statutory' && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600" htmlFor="remittance-status">
                Remittance status
              </label>
              <select
                id="remittance-status"
                value={remittanceStatus}
                onChange={(event) => setRemittanceStatus(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                {REMITTANCE_STATUSES.map((option) => (
                  <option key={option || 'all'} value={option}>
                    {option ? titleCase(option) : 'All'}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500">
              Remittances are generated when a pay run is finalized.
            </p>
          </div>

          {statutoryQuery.error && (
            <ErrorBanner message={getErrorMessage(statutoryQuery.error)} />
          )}

          {statutoryQuery.isLoading ? (
            <Loading label="Loading statutory report..." />
          ) : statutory ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Metric
                  label="Employee share"
                  value={formatMoney(statutory.total_employee)}
                />
                <Metric
                  label="Employer share"
                  value={formatMoney(statutory.total_employer)}
                />
                <Metric label="Total due" value={formatMoney(statutory.total)} />
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="text-base font-semibold text-slate-950">By scheme</h2>
                </div>
                {statutory.by_scheme.length === 0 ? (
                  <Empty
                    icon={<Scale className="h-5 w-5" />}
                    title="No statutory remittances"
                    message="PAYE, SSNIT and other statutory schemes appear after a run is finalized."
                  />
                ) : (
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <Th>Scheme</Th>
                        <Th align="right">Employee</Th>
                        <Th align="right">Employer</Th>
                        <Th align="right">Total</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {statutory.by_scheme.map((scheme) => (
                        <tr key={scheme.scheme_code}>
                          <td className="px-5 py-3">
                            <p className="text-sm font-medium text-slate-900">
                              {scheme.scheme_name}
                            </p>
                            <p className="text-xs text-slate-500">{scheme.scheme_code}</p>
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-slate-700">
                            {formatMoney(scheme.employee_amount)}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-slate-700">
                            {formatMoney(scheme.employer_amount)}
                          </td>
                          <td className="px-5 py-3 text-right text-sm font-semibold text-slate-900">
                            {formatMoney(scheme.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h2 className="text-base font-semibold text-slate-950">Remittances</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Record the reference when each remittance is paid to the authority.
                  </p>
                </div>
                {statutory.remittances.length === 0 ? (
                  <Empty
                    icon={<Receipt className="h-5 w-5" />}
                    title="No remittances found"
                    message="Try a different status filter."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <Th>Scheme</Th>
                          <Th>Due date</Th>
                          <Th>Status</Th>
                          <Th align="right">Total</Th>
                          <Th align="right">Action</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {statutory.remittances.map((remittance) => (
                          <tr key={remittance.id}>
                            <td className="px-5 py-3 text-sm font-medium text-slate-900">
                              {remittance.scheme_name}
                            </td>
                            <td className="px-5 py-3 text-sm text-slate-600">
                              {formatDate(remittance.due_date)}
                            </td>
                            <td className="px-5 py-3">
                              <PayrollStatusBadge status={remittance.status} />
                              {remittance.reference && (
                                <p className="mt-1 text-[11px] text-slate-500">
                                  Ref {remittance.reference}
                                </p>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right text-sm font-semibold text-slate-900">
                              {formatMoney(remittance.total_amount)}
                            </td>
                            <td className="px-5 py-3 text-right">
                              {canDisburse && remittance.status !== 'paid' ? (
                                <button
                                  type="button"
                                  disabled={payRemittanceMutation.isPending}
                                  onClick={() => payRemittance(remittance)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  <BadgeCheck className="h-3.5 w-3.5" />
                                  Record payment
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </section>
      )}

      {tab === 'department' && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="min-w-[280px]">
              <label className={labelClasses()} htmlFor="department-run">
                Pay run
              </label>
              <select
                id="department-run"
                value={activeRunId}
                onChange={(event) => setRunId(event.target.value)}
                className={inputClasses()}
              >
                {reportRuns.length === 0 && <option value="">No finalized runs</option>}
                {reportRuns.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.run_number ?? 'Run'} · {run.period_name ?? '—'}
                  </option>
                ))}
              </select>
            </div>
            {departmentQuery.data && (
              <p className="pb-2 text-sm text-slate-600">
                {departmentQuery.data.period_name ?? 'Selected run'} ·{' '}
                {formatNumber(departmentQuery.data.rows.length)} department/cost-centre
                group(s)
              </p>
            )}
          </div>

          {departmentQuery.error && (
            <ErrorBanner message={getErrorMessage(departmentQuery.error)} />
          )}

          {departmentQuery.isLoading ? (
            <Loading label="Loading department cost..." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-950">Cost by department</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Employer cost includes gross pay and employer contributions.
                </p>
              </div>
              {!departmentQuery.data || departmentQuery.data.rows.length === 0 ? (
                <Empty
                  icon={<Building2 className="h-5 w-5" />}
                  title="No cost data"
                  message="Select a finalized pay run to see department costs."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <Th>Department</Th>
                        <Th>Cost centre</Th>
                        <Th align="right">Employees</Th>
                        <Th align="right">Gross</Th>
                        <Th align="right">Employer contrib.</Th>
                        <Th align="right">Net</Th>
                        <Th align="right">Employer cost</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {departmentQuery.data.rows.map((row) => (
                        <tr key={`${row.department}-${row.cost_center}`}>
                          <td className="px-5 py-3 text-sm font-medium text-slate-900">
                            {row.department}
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-600">
                            {row.cost_center}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-slate-700">
                            {formatNumber(row.employee_count)}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-slate-700">
                            {formatMoney(row.gross, departmentQuery.data?.currency)}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-slate-700">
                            {formatMoney(
                              row.employer_contributions,
                              departmentQuery.data?.currency,
                            )}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-slate-700">
                            {formatMoney(row.net, departmentQuery.data?.currency)}
                          </td>
                          <td className="px-5 py-3 text-right text-sm font-semibold text-slate-900">
                            {formatMoney(row.employer_cost, departmentQuery.data?.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      )}
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
      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
        active
          ? 'border-slate-900 text-slate-900'
          : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500 shadow-sm">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      {label}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">Unable to load the report</p>
        <p className="mt-1">{message}</p>
      </div>
    </div>
  );
}

function Empty({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        {icon}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{message}</p>
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
