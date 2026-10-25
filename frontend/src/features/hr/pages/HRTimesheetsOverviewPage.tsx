import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  RefreshCcw,
  Search,
  Send,
  Timer,
  Users,
} from 'lucide-react';
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import {
  formatDate,
  formatNumber,
  getErrorMessage,
} from '@/features/payroll/payroll.utils';
import { timesheetService, type HROverviewEmployee } from '@/services/timesheet.service';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'approved', label: 'Approved only' },
  { value: 'submitted', label: 'Submitted only' },
  { value: 'draft', label: 'Draft only' },
];

function iso(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

type RangePreset = 'this_week' | 'last_week' | 'last_4_weeks' | 'this_month' | 'last_month';

function presetRange(preset: RangePreset) {
  const today = new Date();
  switch (preset) {
    case 'this_week':
      return {
        start: iso(startOfWeek(today, { weekStartsOn: 1 })),
        end: iso(endOfWeek(today, { weekStartsOn: 1 })),
      };
    case 'last_week': {
      const lastWeek = subWeeks(today, 1);
      return {
        start: iso(startOfWeek(lastWeek, { weekStartsOn: 1 })),
        end: iso(endOfWeek(lastWeek, { weekStartsOn: 1 })),
      };
    }
    case 'this_month':
      return { start: iso(startOfMonth(today)), end: iso(today) };
    case 'last_month': {
      const lastMonth = subMonths(today, 1);
      return {
        start: iso(startOfMonth(lastMonth)),
        end: iso(endOfMonth(lastMonth)),
      };
    }
    case 'last_4_weeks':
    default:
      return {
        start: iso(startOfWeek(subWeeks(today, 3), { weekStartsOn: 1 })),
        end: iso(today),
      };
  }
}

export function HRTimesheetsOverviewPage() {
  const initial = presetRange('last_4_weeks');
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [onlyWithHours, setOnlyWithHours] = useState(false);

  const query = useQuery({
    queryKey: ['timesheets', 'hr-overview', startDate, endDate, status],
    queryFn: () =>
      timesheetService.getHROverview({
        start_date: startDate,
        end_date: endDate,
        status: status || undefined,
      }),
    enabled: Boolean(startDate && endDate),
  });

  const data = query.data;
  const employees = data?.employees ?? [];

  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          employees
            .map((employee) => employee.department)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [employees],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return employees.filter((employee) => {
      if (onlyWithHours && employee.total_hours === 0) return false;
      if (department && employee.department !== department) return false;
      if (!needle) return true;
      return (
        employee.person_name.toLowerCase().includes(needle) ||
        (employee.employee_number ?? '').toLowerCase().includes(needle) ||
        (employee.department ?? '').toLowerCase().includes(needle)
      );
    });
  }, [employees, search, department, onlyWithHours]);

  const filteredTotals = useMemo(
    () =>
      filtered.reduce(
        (acc, employee) => {
          acc.total += employee.total_hours;
          acc.approved += employee.approved_hours;
          acc.submitted += employee.submitted_hours;
          acc.overtime += employee.overtime_hours;
          acc.expected += employee.expected_hours;
          return acc;
        },
        { total: 0, approved: 0, submitted: 0, overtime: 0, expected: 0 },
      ),
    [filtered],
  );

  const applyPreset = (preset: RangePreset) => {
    const range = presetRange(preset);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const exportCsv = () => {
    const header = [
      'Employee',
      'Employee number',
      'Department',
      'Timesheets',
      'Total hours',
      'Approved hours',
      'Submitted hours',
      'Draft hours',
      'Overtime hours',
      'Expected hours',
    ];
    const rows = filtered.map((employee) => [
      employee.person_name,
      employee.employee_number ?? '',
      employee.department ?? '',
      employee.timesheet_count,
      employee.total_hours,
      employee.approved_hours,
      employee.submitted_hours,
      employee.draft_hours,
      employee.overtime_hours,
      employee.expected_hours,
    ]);
    const escape = (value: string | number) => {
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = [header, ...rows]
      .map((row) => row.map(escape).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timesheets_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const summary = data?.summary;
  const approvalRate =
    summary && summary.total_hours > 0
      ? (summary.approved_hours / summary.total_hours) * 100
      : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Timesheets</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Organisation-wide hours by employee and week. Payroll uses approved hours
            for hourly staff and approved timesheets as the attendance basis for
            salaried staff.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => query.refetch()}
            className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-gray-600" htmlFor="ts-start">
              From
            </label>
            <input
              id="ts-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-gray-600" htmlFor="ts-end">
              To
            </label>
            <input
              id="ts-end"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-gray-600" htmlFor="ts-status">
              Timesheet status
            </label>
            <select
              id="ts-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5 sm:ml-auto">
            <PresetButton onClick={() => applyPreset('this_week')}>This week</PresetButton>
            <PresetButton onClick={() => applyPreset('last_week')}>Last week</PresetButton>
            <PresetButton onClick={() => applyPreset('last_4_weeks')}>Last 4 weeks</PresetButton>
            <PresetButton onClick={() => applyPreset('this_month')}>This month</PresetButton>
            <PresetButton onClick={() => applyPreset('last_month')}>Last month</PresetButton>
          </div>
        </div>
      </div>

      {query.error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">Unable to load timesheet overview</p>
            <p className="mt-0.5 text-xs leading-5">{getErrorMessage(query.error)}</p>
          </div>
        </div>
      )}

      {query.isLoading ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-gray-200 bg-white text-sm text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading organisation hours...
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric
              icon={<Users className="h-4 w-4" />}
              label="Employees with hours"
              value={formatNumber(summary?.employee_count ?? 0)}
              hint={`of ${formatNumber(employees.length)} active employees`}
            />
            <Metric
              icon={<Clock className="h-4 w-4" />}
              label="Total hours"
              value={formatNumber(summary?.total_hours ?? 0, 1)}
              hint="All recorded hours"
            />
            <Metric
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Approved hours"
              value={formatNumber(summary?.approved_hours ?? 0, 1)}
              hint={`${approvalRate.toFixed(1)}% of total`}
              tone="positive"
            />
            <Metric
              icon={<Send className="h-4 w-4" />}
              label="Awaiting approval"
              value={formatNumber(summary?.submitted_hours ?? 0, 1)}
              hint="Submitted to managers"
              tone="warning"
            />
            <Metric
              icon={<Timer className="h-4 w-4" />}
              label="Overtime hours"
              value={formatNumber(summary?.overtime_hours ?? 0, 1)}
              hint="From approved entries"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Employee hours</h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatNumber(filtered.length)} employee(s) shown ·{' '}
                    {formatNumber(filteredTotals.approved, 1)} approved hours
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search employees"
                      className="w-48 rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <select
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All departments</option>
                    {departments.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={onlyWithHours}
                      onChange={(event) => setOnlyWithHours(event.target.checked)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    With hours
                  </label>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
                  <CalendarDays className="h-6 w-6 text-gray-400" />
                  <p className="mt-3 text-sm font-semibold text-gray-900">
                    No timesheet hours found
                  </p>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-gray-500">
                    Adjust the date range or clear the filters. Employees without
                    timesheets still appear with zero hours.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <Th>Employee</Th>
                        <Th>Department</Th>
                        <Th align="right">Sheets</Th>
                        <Th align="right">Total</Th>
                        <Th align="right">Approved</Th>
                        <Th align="right">Submitted</Th>
                        <Th align="right">Draft</Th>
                        <Th align="right">Overtime</Th>
                        <Th align="right">Expected</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((employee) => (
                        <EmployeeRow key={employee.person_id} employee={employee} />
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td className="px-4 py-3 text-xs font-semibold text-gray-900" colSpan={3}>
                          Filtered total
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold tabular-nums text-gray-900">
                          {formatNumber(filteredTotals.total, 1)}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold tabular-nums text-emerald-700">
                          {formatNumber(filteredTotals.approved, 1)}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold tabular-nums text-amber-700">
                          {formatNumber(filteredTotals.submitted, 1)}
                        </td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 text-right text-xs font-semibold tabular-nums text-gray-900">
                          {formatNumber(filteredTotals.overtime, 1)}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold tabular-nums text-gray-900">
                          {formatNumber(filteredTotals.expected, 1)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-900">By week</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Weekly totals across the selected range
                </p>
              </div>

              {data.by_week.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-gray-500">
                  No weekly timesheets in this range.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {data.by_week.map((week) => {
                    const rate =
                      week.total_hours > 0
                        ? (week.approved_hours / week.total_hours) * 100
                        : 0;
                    return (
                      <div key={week.week_start} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-gray-900">
                              {formatDate(week.week_start)} – {formatDate(week.week_end)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-gray-500">
                              {formatNumber(week.employee_count)} employee(s)
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold tabular-nums text-gray-900">
                              {formatNumber(week.total_hours, 1)} h
                            </p>
                            <p className="text-[11px] text-emerald-700">
                              {formatNumber(week.approved_hours, 1)} h approved
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${Math.min(100, rate)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

function EmployeeRow({ employee }: { employee: HROverviewEmployee }) {
  const coverage =
    employee.expected_hours > 0
      ? (employee.approved_hours / employee.expected_hours) * 100
      : 0;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2.5">
        <p className="text-sm font-medium text-gray-900">{employee.person_name}</p>
        <p className="text-[11px] text-gray-500">
          {employee.employee_number ?? '—'}
        </p>
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-600">
        {employee.department ?? '—'}
      </td>
      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-gray-700">
        {formatNumber(employee.timesheet_count)}
      </td>
      <td className="px-4 py-2.5 text-right text-xs font-medium tabular-nums text-gray-900">
        {formatNumber(employee.total_hours, 1)}
      </td>
      <td className="px-4 py-2.5 text-right">
        <p className="text-xs font-semibold tabular-nums text-emerald-700">
          {formatNumber(employee.approved_hours, 1)}
        </p>
        {employee.expected_hours > 0 && (
          <div className="mt-1 ml-auto h-1 w-16 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${
                coverage >= 100 ? 'bg-emerald-500' : 'bg-amber-400'
              }`}
              style={{ width: `${Math.min(100, coverage)}%` }}
            />
          </div>
        )}
      </td>
      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-amber-700">
        {formatNumber(employee.submitted_hours, 1)}
      </td>
      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-gray-500">
        {formatNumber(employee.draft_hours, 1)}
      </td>
      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-gray-700">
        {formatNumber(employee.overtime_hours, 1)}
      </td>
      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-gray-500">
        {formatNumber(employee.expected_hours, 1)}
      </td>
    </tr>
  );
}

function PresetButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      {children}
    </button>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: 'neutral' | 'positive' | 'warning';
}) {
  const iconClasses =
    tone === 'positive'
      ? 'bg-emerald-50 text-emerald-600'
      : tone === 'warning'
        ? 'bg-amber-50 text-amber-600'
        : 'bg-gray-100 text-gray-500';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-md ${iconClasses}`}
        >
          {icon}
        </span>
        <p className="text-xs font-medium text-gray-500">{label}</p>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-gray-900">{value}</p>
      <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p>
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
      className={`whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}
