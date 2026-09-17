import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timesheetService, TimesheetAnalytics } from '@/services/timesheet.service';
import { useAuth } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Send,
  CheckCircle,
  AlertCircle,
  Briefcase,
  Calendar,
  TrendingUp,
  TrendingDown,
  Zap,
  Target,
  Info,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  addDays,
  subWeeks,
  addWeeks,
  isSameDay,
} from 'date-fns';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

const STANDARD_HOURS = 8;
const STANDARD_WEEK_HOURS = 40;

export function TimesheetsPage() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [currentWeek, setCurrentWeek] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const canEditAny = hasPermission('timesheets.edit_any');

  const { data: timesheet, isLoading } = useQuery({
    queryKey: ['timesheet', currentWeek],
    queryFn: () =>
      timesheetService.getMyTimesheet(currentWeek.toISOString().split('T')[0]),
  });

  const { data: analytics } = useQuery({
    queryKey: ['timesheet-analytics', currentWeek],
    queryFn: () =>
      timesheetService.getAnalytics(currentWeek.toISOString().split('T')[0]),
  });

  const submitMutation = useMutation({
    mutationFn: () => timesheetService.submitTimesheet(timesheet!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      queryClient.invalidateQueries({ queryKey: ['timesheet-analytics'] });
      toast.success('Timesheet submitted for approval');
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.detail || 'Failed to submit'),
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));

  const entriesByDay = (day: Date) =>
    timesheet?.entries?.filter((e) => isSameDay(new Date(e.date), day)) || [];

  const dailyHours = (day: Date) =>
    entriesByDay(day).reduce((sum, e) => sum + e.duration, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'submitted':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'under_review':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'rejected':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'locked':
        return 'text-gray-600 bg-gray-100 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'submitted':
        return 'Pending approval';
      case 'under_review':
        return 'Under review';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Returned for correction';
      default:
        return status.replace(/_/g, ' ');
    }
  };

  // =============================
  // Stats & Analytics
  // =============================

  const stats = useMemo(() => {
    const total = analytics?.total_hours ?? 0;
    const expected = analytics?.expected_hours ?? STANDARD_WEEK_HOURS;
    const remaining = Math.max(0, expected - total);
    const pct = expected > 0 ? Math.min(100, (total / expected) * 100) : 0;
    const daysWithWork = analytics?.daily.filter((d) => d.hours > 0).length ?? 0;
    const avgPerDay = daysWithWork > 0 ? total / daysWithWork : 0;

    // Overtime per day (over 8h)
    const overtimeByDay = (analytics?.daily || []).map((d) => ({
      ...d,
      standard: Math.min(d.hours, STANDARD_HOURS),
      overtime: Math.max(0, d.hours - STANDARD_HOURS),
    }));
    const totalOvertime = overtimeByDay.reduce((s, d) => s + d.overtime, 0);

    return {
      total,
      expected,
      remaining,
      pct,
      daysWithWork,
      avgPerDay,
      overtimeByDay,
      totalOvertime,
    };
  }, [analytics]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const canSubmit =
    timesheet &&
    ['draft', 'rejected'].includes(timesheet.status) &&
    stats.total > 0;

  const isWeekend = (day: Date) => [0, 6].includes(day.getDay());

  // Max for scaling daily bars
  const maxDailyHours = Math.max(
    ...(analytics?.daily.map((d) => d.hours) || [STANDARD_HOURS]),
    STANDARD_HOURS
  );

  return (
    <div className="space-y-4 max-w-9xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Timesheets</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Weekly summary · auto-filled from your sessions
          </p>
        </div>
        {timesheet && (
          <div
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-semibold border',
              getStatusColor(timesheet.status)
            )}
          >
            {getStatusLabel(timesheet.status)}
          </div>
        )}
      </div>

      {/* Week Navigator */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
        <button
          onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          title="Previous week"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="text-center flex-1">
          <div className="text-sm font-semibold text-gray-900">
            {format(currentWeek, 'MMM d')} –{' '}
            {format(addDays(currentWeek, 6), 'MMM d, yyyy')}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {stats.total.toFixed(1)}h of {stats.expected}h logged
            {stats.totalOvertime > 0 &&
              ` · ${stats.totalOvertime.toFixed(1)}h overtime`}
          </div>
        </div>
        <button
          onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          title="Next week"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800">
          Time is automatically recorded from your work sessions. Review your
          week below and submit for approval when ready.
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Logged"
          value={`${stats.total.toFixed(1)}h`}
          hint={
            stats.pct >= 100
              ? 'Target reached'
              : `${stats.pct.toFixed(0)}% complete`
          }
          icon={Clock}
          tone="primary"
        />
        <KpiCard
          label="Expected"
          value={`${stats.expected}h`}
          hint="Standard week"
          icon={Target}
          tone="neutral"
        />
        <KpiCard
          label={stats.totalOvertime > 0 ? 'Overtime' : 'Remaining'}
          value={
            stats.totalOvertime > 0
              ? `+${stats.totalOvertime.toFixed(1)}h`
              : `${stats.remaining.toFixed(1)}h`
          }
          hint={
            stats.totalOvertime > 0 ? 'Above 8h/day' : 'To complete'
          }
          icon={stats.totalOvertime > 0 ? Zap : TrendingDown}
          tone={stats.totalOvertime > 0 ? 'warning' : 'neutral'}
        />
        <KpiCard
          label="Avg / Day"
          value={`${stats.avgPerDay.toFixed(1)}h`}
          hint={`${stats.daysWithWork} active days`}
          icon={TrendingUp}
          tone="neutral"
        />
      </div>

      {/* Main grid: Left = Daily breakdown, Right = Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Daily Breakdown — 2/3 */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              Daily Breakdown
            </h3>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">
              {format(currentWeek, 'MMM d')} –{' '}
              {format(addDays(currentWeek, 6), 'MMM d')}
            </span>
          </div>

          <div className="divide-y divide-gray-50">
            {weekDays.map((day) => {
              const entries = entriesByDay(day);
              const hours = dailyHours(day);
              const isToday = isSameDay(day, new Date());
              const weekend = isWeekend(day);
              const overtime = Math.max(0, hours - STANDARD_HOURS);
              const standard = Math.min(hours, STANDARD_HOURS);

              return (
                <div
                  key={day.toString()}
                  className={cn(
                    'px-4 py-3 transition-colors',
                    isToday && 'bg-primary/5',
                    weekend && !isToday && 'bg-gray-50/50'
                  )}
                >
                  {/* Day header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          isToday ? 'text-primary' : 'text-gray-900'
                        )}
                      >
                        {format(day, 'EEE, MMM d')}
                      </span>
                      {isToday && (
                        <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Today
                        </span>
                      )}
                      {weekend && !isToday && (
                        <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">
                          Weekend
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {overtime > 0 && (
                        <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5" />
                          +{overtime.toFixed(1)}h OT
                        </span>
                      )}
                      <span className="text-xs font-bold text-gray-700 tabular-nums">
                        {hours.toFixed(2)}h
                      </span>
                    </div>
                  </div>

                  {/* Day progress bar */}
                  {hours > 0 && (
                    <div className="mb-2 w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full flex">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{
                            width: `${(standard / STANDARD_HOURS) * 100}%`,
                          }}
                        />
                        {overtime > 0 && (
                          <div
                            className="h-full bg-amber-500 transition-all"
                            style={{
                              width: `${(overtime / STANDARD_HOURS) * 100}%`,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Entries */}
                  {entries.length === 0 ? (
                    <div className="text-[11px] text-gray-400 italic">
                      {weekend ? 'Weekend — no entries' : 'No time recorded'}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {entries.map((e) => (
                        <div
                          key={e.id}
                          className="flex items-center justify-between gap-2 text-[11px] pl-3 border-l-2 border-gray-200"
                        >
                          <span className="text-gray-700 truncate flex items-center gap-1.5">
                            {e.project_id ? (
                              <Briefcase className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                            ) : (
                              <Clock className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                            )}
                            <span className="truncate">
                              {e.description || 'General work'}
                            </span>
                          </span>
                          <span
                            className={cn(
                              'text-gray-500 font-semibold flex-shrink-0 tabular-nums',
                              e.is_overtime && 'text-amber-600'
                            )}
                          >
                            {e.duration}h
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Week total */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Week Total
            </span>
            <div className="flex items-center gap-3">
              {stats.totalOvertime > 0 && (
                <span className="text-[11px] font-bold text-amber-600">
                  +{stats.totalOvertime.toFixed(1)}h OT
                </span>
              )}
              <span className="text-sm font-bold text-gray-900 tabular-nums">
                {stats.total.toFixed(2)}h
              </span>
            </div>
          </div>
        </div>

        {/* Right column — Analytics */}
        <div className="space-y-4">
          {/* Daily bar chart */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">
                Hours by Day
              </h3>
            </div>

            <div className="flex items-end justify-between gap-1.5 h-32 mb-2">
              {stats.overtimeByDay.map((d) => {
                const day = new Date(d.date);
                const isToday = isSameDay(day, new Date());
                const totalHeight =
                  maxDailyHours > 0 ? (d.hours / maxDailyHours) * 100 : 0;
                const standardHeight =
                  maxDailyHours > 0 ? (d.standard / maxDailyHours) * 100 : 0;
                const overtimeHeight =
                  maxDailyHours > 0 ? (d.overtime / maxDailyHours) * 100 : 0;

                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div className="text-[9px] font-semibold text-gray-600 tabular-nums h-3">
                      {d.hours > 0 ? d.hours.toFixed(1) : ''}
                    </div>
                    <div
                      className="w-full relative rounded-t-sm overflow-hidden"
                      style={{ height: '88px' }}
                    >
                      <div className="absolute inset-0 bg-gray-100 rounded-t-sm" />
                      {/* Overtime on top */}
                      {overtimeHeight > 0 && (
                        <div
                          className="absolute left-0 right-0 bg-amber-500 rounded-t-sm transition-all"
                          style={{
                            height: `${totalHeight}%`,
                            bottom: 0,
                          }}
                        />
                      )}
                      {/* Standard below */}
                      <div
                        className={cn(
                          'absolute left-0 right-0 bottom-0 transition-all rounded-t-sm',
                          overtimeHeight > 0
                            ? 'bg-primary'
                            : 'bg-primary rounded-t-sm',
                          isToday && 'ring-1 ring-primary ring-offset-1'
                        )}
                        style={{
                          height: `${standardHeight}%`,
                        }}
                      />
                    </div>
                    <div
                      className={cn(
                        'text-[9px] font-medium',
                        isToday ? 'text-primary' : 'text-gray-500'
                      )}
                    >
                      {format(day, 'EEE').charAt(0)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 pt-3 mt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
                <span className="text-[10px] text-gray-600">Standard</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                <span className="text-[10px] text-gray-600">Overtime</span>
              </div>
            </div>
          </div>

          {/* Hours by Project */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-3.5 h-3.5 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">
                Hours by Project
              </h3>
            </div>

            {!analytics?.by_project || analytics.by_project.length === 0 ? (
              <div className="text-[11px] text-gray-400 text-center py-6">
                No project hours yet
              </div>
            ) : (
              <div className="space-y-3">
                {analytics.by_project.map((p, idx) => {
                  const pct =
                    stats.total > 0 ? (p.hours / stats.total) * 100 : 0;
                  // Rotate through a few muted colors
                  const colors = [
                    'bg-primary',
                    'bg-blue-500',
                    'bg-purple-500',
                    'bg-emerald-500',
                    'bg-amber-500',
                  ];
                  const color = colors[idx % colors.length];
                  return (
                    <div key={p.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-medium text-gray-700 truncate pr-2">
                          {p.name}
                        </span>
                        <span className="text-[10px] text-gray-500 font-semibold flex-shrink-0 tabular-nums">
                          {p.hours.toFixed(1)}h
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', color)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[9px] text-gray-400 mt-0.5 text-right">
                        {pct.toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Progress Bar (full width) */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700">
            Weekly Progress
          </span>
          <div className="flex items-center gap-2">
            {stats.totalOvertime > 0 && (
              <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5" />
                {stats.totalOvertime.toFixed(1)}h OT
              </span>
            )}
            <span className="text-xs font-bold text-gray-700 tabular-nums">
              {stats.pct.toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: `${Math.min(100, (Math.min(stats.total, stats.expected) / stats.expected) * 100)}%`,
            }}
          />
          {stats.totalOvertime > 0 && (
            <div
              className="h-full bg-amber-500 transition-all"
              style={{
                width: `${Math.min(100, (stats.totalOvertime / stats.expected) * 100)}%`,
              }}
            />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5" />
          {canEditAny ? (
            <span>You have admin rights — entries can be edited.</span>
          ) : (
            <span>Entries are auto-generated and cannot be edited.</span>
          )}
        </div>

        {canSubmit && (
          <button
            onClick={() => {
              if (
                confirm(
                  `Submit your timesheet for ${format(currentWeek, 'MMM d')} – ${format(addDays(currentWeek, 6), 'MMM d, yyyy')}?\n\nTotal: ${stats.total.toFixed(1)}h${stats.totalOvertime > 0 ? `\nOvertime: ${stats.totalOvertime.toFixed(1)}h` : ''}\n\nOnce submitted, you cannot edit unless it's returned by your manager.`
                )
              ) {
                submitMutation.mutate();
              }
            }}
            disabled={submitMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
          </button>
        )}

        {timesheet?.status === 'submitted' && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-sm font-medium">
            <Clock className="w-4 h-4" />
            Awaiting approval
          </div>
        )}

        {timesheet?.status === 'approved' && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Approved
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   KPI CARD
   ============================================================ */

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  tone?: 'primary' | 'warning' | 'neutral';
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        <Icon
          className={cn(
            'w-3.5 h-3.5',
            tone === 'warning'
              ? 'text-amber-500'
              : tone === 'primary'
              ? 'text-primary'
              : 'text-gray-400'
          )}
          strokeWidth={1.75}
        />
      </div>
      <div
        className={cn(
          'text-2xl font-bold tabular-nums',
          tone === 'warning' ? 'text-amber-600' : 'text-gray-900'
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="text-[10px] text-gray-500 mt-0.5">{hint}</div>
      )}
    </div>
  );
}