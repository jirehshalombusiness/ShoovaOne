import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  Clock,
  CalendarRange,
  Palmtree,
  ArrowRight,
  CircleDot,
} from 'lucide-react';
import { myWorkService } from '@/services/mywork.service';
import { meService } from '@/services/me.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { cn } from '@/lib/utils';

const statusStyles: Record<string, { label: string; className: string }> = {
  not_started: { label: 'Not started', className: 'bg-gray-100 text-gray-600' },
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
  submitted: { label: 'Submitted', className: 'bg-blue-50 text-blue-700' },
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700' },
};

export function MyWeekWidget() {
  const navigate = useNavigate();
  const access = useHRAccess();

  const timesheetQuery = useQuery({
    queryKey: ['my-work', 'timesheet'],
    queryFn: () => myWorkService.getTimesheet(),
    refetchInterval: 2 * 60_000,
  });

  const homeQuery = useQuery({
    queryKey: ['me', 'home'],
    queryFn: () => meService.getHome(),
    refetchInterval: 5 * 60_000,
  });

  const timesheet = timesheetQuery.data;
  const home = homeQuery.data;

  const total = timesheet?.total_hours ?? 0;
  const expected = timesheet?.expected_hours || 40;
  const percent = Math.min(100, Math.round((total / expected) * 100));
  const status = statusStyles[timesheet?.status ?? 'not_started'] ?? statusStyles.not_started;

  const balances = [...(home?.balances ?? [])]
    .sort((a, b) => b.remaining_days - a.remaining_days)
    .slice(0, 2);
  const nextHoliday = home?.upcoming_holidays?.[0];

  const daysLogged = new Set(
    (timesheet?.entries ?? []).map((entry) => entry.date),
  ).size;

  return (
    <div className="bg-white border border-gray-200 rounded-lg h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-gray-900">My Week</h3>
        </div>
        <span
          className={cn(
            'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
            status.className,
          )}
        >
          {status.label}
        </span>
      </div>

      <div className="flex-1 p-5 space-y-5">
        {/* Hours */}
        <div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Hours this week
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900 tabular-nums">
                  {total.toFixed(1)}
                </span>
                <span className="text-sm text-gray-400 tabular-nums">
                  / {expected.toFixed(0)}h
                </span>
              </div>
            </div>
            <span className="text-[11px] text-gray-500 tabular-nums">
              {percent}%
            </span>
          </div>

          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                percent >= 100
                  ? 'bg-emerald-500'
                  : percent >= 60
                    ? 'bg-primary'
                    : 'bg-amber-500',
              )}
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
            <span>{daysLogged} day{daysLogged === 1 ? '' : 's'} logged</span>
            {timesheet && (
              <span>
                {format(parseISO(timesheet.week_start_date), 'MMM d')} –{' '}
                {format(parseISO(timesheet.week_end_date), 'MMM d')}
              </span>
            )}
          </div>
        </div>

        {/* Leave balances */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Leave balance
            </span>
            <button
              onClick={() => navigate('/me/time-off')}
              className="text-[10px] font-medium text-primary hover:underline"
            >
              Request time off
            </button>
          </div>

          {homeQuery.isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : balances.length === 0 ? (
            <p className="text-[11px] text-gray-400">
              No leave balances assigned yet
            </p>
          ) : (
            <div className="space-y-2">
              {balances.map((balance) => (
                <div
                  key={balance.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: balance.leave_type_color || '#94a3b8',
                      }}
                    />
                    <span className="text-[12px] text-gray-700 truncate">
                      {balance.leave_type_name}
                    </span>
                  </span>
                  <span className="text-[12px] font-semibold text-gray-900 tabular-nums flex-shrink-0">
                    {balance.remaining_days.toFixed(1)}d
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Next holiday */}
        {nextHoliday && (
          <div className="flex items-start gap-2.5 rounded-md border border-gray-100 bg-gray-50 px-3 py-2.5">
            <Palmtree className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-gray-700 truncate">
                {nextHoliday.name}
              </div>
              <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                <CircleDot className="w-2.5 h-2.5" />
                {format(parseISO(nextHoliday.holiday_date), 'EEEE, MMM d')}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
        {access.has('timesheets.view') ? (
          <button
            onClick={() => navigate('/timesheets')}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Clock className="w-3 h-3" />
            Log time
          </button>
        ) : (
          <span className="text-[11px] text-gray-400">
            Timesheets managed by HR
          </span>
        )}

        <button
          onClick={() => navigate('/me')}
          className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
        >
          My HR
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
