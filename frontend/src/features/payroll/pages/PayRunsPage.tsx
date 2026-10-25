import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CalendarRange,
  Loader2,
  Plus,
  RefreshCcw,
  X,
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

const STATUS_OPTIONS = [
  '',
  'draft',
  'calculated',
  'hr_approved',
  'finance_approved',
  'approved',
  'finalized',
  'disbursing',
  'paid',
];

export function PayRunsPage() {
  const access = useHRAccess();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState('');

  const showCreate = searchParams.get('new') === '1';

  const runsQuery = useQuery({
    queryKey: ['payroll', 'runs', status],
    queryFn: () => payrollService.getRuns(status ? { status } : undefined),
  });

  const periodsQuery = useQuery({
    queryKey: ['payroll', 'periods'],
    queryFn: () => payrollService.getPayPeriods(),
  });

  const groupsQuery = useQuery({
    queryKey: ['payroll', 'groups'],
    queryFn: () => payrollService.getPayGroups(),
  });

  const loading = runsQuery.isLoading || periodsQuery.isLoading || groupsQuery.isLoading;
  const error = runsQuery.error ?? periodsQuery.error ?? groupsQuery.error;

  const runs = runsQuery.data ?? [];

  const totals = useMemo(() => {
    return runs.reduce(
      (acc, run) => {
        if (['cancelled', 'reversed'].includes(run.status)) return acc;
        acc.net += Number(run.total_net);
        acc.cost += Number(run.total_employer_cost);
        acc.employees += run.employee_count;
        return acc;
      },
      { net: 0, cost: 0, employees: 0 },
    );
  }, [runs]);

  const closeCreate = () => {
    searchParams.delete('new');
    setSearchParams(searchParams, { replace: true });
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] });
    queryClient.invalidateQueries({ queryKey: ['payroll', 'overview'] });
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Payroll</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Pay runs
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Create a run for a pay period, calculate salaries from approved
            timesheets and route it through HR, Finance and final approval.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>

          {access.has(['payroll.prepare', 'payroll.review_hr']) && (
            <button
              type="button"
              onClick={() => {
                searchParams.set('new', '1');
                setSearchParams(searchParams);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              New pay run
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Unable to load pay runs</p>
            <p className="mt-1">{getErrorMessage(error)}</p>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric label="Runs" value={formatNumber(runs.length)} />
        <Metric label="Net pay in view" value={formatMoney(totals.net)} />
        <Metric label="Employer cost in view" value={formatMoney(totals.cost)} />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">All pay runs</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {formatNumber(totals.employees)} employee payments in the current view.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600" htmlFor="run-status">
              Status
            </label>
            <select
              id="run-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option ? titleCase(option) : 'All statuses'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading pay runs...
          </div>
        ) : runs.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <CalendarRange className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">No pay runs found</h3>
            <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
              Create a run once the pay period and pay group exist. Approved
              timesheet hours are picked up automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Run</Th>
                  <Th>Period</Th>
                  <Th>Status</Th>
                  <Th align="right">Employees</Th>
                  <Th align="right">Gross</Th>
                  <Th align="right">Deductions</Th>
                  <Th align="right">Net</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {run.run_number ?? 'Draft run'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {run.pay_group_name ?? '—'} · {titleCase(run.run_type)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-slate-800">{run.period_name ?? '—'}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Created {formatDate(run.created_at)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <PayrollStatusBadge status={run.status} />
                      {run.exception_count > 0 && (
                        <p className="mt-1 text-[11px] font-medium text-amber-700">
                          {run.exception_count} exception(s)
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-slate-700">
                      {formatNumber(run.employee_count)}
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-slate-700">
                      {formatMoney(run.total_gross, run.currency)}
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-slate-700">
                      {formatMoney(run.total_employee_deductions, run.currency)}
                    </td>
                    <td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">
                      {formatMoney(run.total_net, run.currency)}
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
      </section>

      {showCreate && (
        <CreateRunDialog
          periods={periodsQuery.data ?? []}
          groups={groupsQuery.data ?? []}
          onClose={closeCreate}
          onCreated={(runId) => {
            closeCreate();
            navigate(`/payroll/runs/${runId}`);
          }}
        />
      )}
    </div>
  );
}

function CreateRunDialog({
  periods,
  groups,
  onClose,
  onCreated,
}: {
  periods: Awaited<ReturnType<typeof payrollService.getPayPeriods>>;
  groups: Awaited<ReturnType<typeof payrollService.getPayGroups>>;
  onClose: () => void;
  onCreated: (runId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    period_id: periods[0]?.id ?? '',
    pay_group_id: groups[0]?.id ?? '',
    run_type: 'regular',
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: () =>
      payrollService.createRun({
        period_id: form.period_id,
        pay_group_id: form.pay_group_id,
        run_type: form.run_type,
        notes: form.notes || undefined,
      }),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'overview'] });
      toast.success('Pay run created. Calculate it when ready.');
      onCreated(run.id);
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not create the pay run')),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.period_id || !form.pay_group_id) {
      toast.error('Select both a pay period and a pay group');
      return;
    }
    mutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">New pay run</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              A run is created empty. Calculate it to pull approved timesheets and
              configured pay components.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          {periods.length === 0 || groups.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              You need at least one pay period and one pay group before creating a
              run. Configure them under Payroll → Configuration.
            </div>
          ) : null}

          <div>
            <label className={labelClasses()} htmlFor="period">
              Pay period
            </label>
            <select
              id="period"
              required
              value={form.period_id}
              onChange={(event) => setForm({ ...form, period_id: event.target.value })}
              className={inputClasses()}
            >
              <option value="">Select a period</option>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name} ({formatDate(period.period_start)} –{' '}
                  {formatDate(period.period_end)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClasses()} htmlFor="group">
              Pay group
            </label>
            <select
              id="group"
              required
              value={form.pay_group_id}
              onChange={(event) =>
                setForm({ ...form, pay_group_id: event.target.value })
              }
              className={inputClasses()}
            >
              <option value="">Select a pay group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} · {group.pay_type} · {group.currency}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClasses()} htmlFor="run-type">
              Run type
            </label>
            <select
              id="run-type"
              value={form.run_type}
              onChange={(event) => setForm({ ...form, run_type: event.target.value })}
              className={inputClasses()}
            >
              <option value="regular">Regular</option>
              <option value="off_cycle">Off-cycle</option>
              <option value="bonus">Bonus</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </div>

          <div>
            <label className={labelClasses()} htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              className={inputClasses()}
              placeholder="Optional context for reviewers"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                mutation.isPending ||
                periods.length === 0 ||
                groups.length === 0
              }
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending ? 'Creating…' : 'Create run'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
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
