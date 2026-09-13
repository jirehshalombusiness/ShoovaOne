import { useState } from 'react';
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
  TrendingUp,
  Briefcase,
  Calendar,
  BarChart3,
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
      case 'approved': return 'text-emerald-600 bg-emerald-50';
      case 'submitted': return 'text-amber-600 bg-amber-50';
      case 'under_review': return 'text-blue-600 bg-blue-50';
      case 'rejected': return 'text-red-600 bg-red-50';
      case 'locked': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalHours = analytics?.total_hours ?? 0;
  const expectedHours = analytics?.expected_hours ?? 40;
  const remaining = Math.max(0, expectedHours - totalHours);
  const pct = Math.min(100, (totalHours / expectedHours) * 100);
  const canSubmit =
    timesheet && ['draft', 'rejected'].includes(timesheet.status) && totalHours > 0;

  // Max daily hours for scaling chart
  const maxDailyHours = Math.max(
    ...(analytics?.daily.map((d) => d.hours) || [8]),
    8
  );

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Timesheets</h1>
          <p className="text-sm text-gray-500 mt-0.5">My Timesheet</p>
        </div>
        {timesheet && (
          <span
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold capitalize',
              getStatusColor(timesheet.status)
            )}
          >
            {timesheet.status.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Week Navigator */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
        <button
          onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold text-gray-900">
            {format(currentWeek, 'MMM d')} –{' '}
            {format(addDays(currentWeek, 6), 'MMM d, yyyy')}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {totalHours.toFixed(1)}h of {expectedHours}h logged
          </div>
        </div>
        <button
          onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
        <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800">
          Time is automatically recorded from your daily attendance check-in and
          check-out. Review your week below, then submit for manager approval.
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Logged" value={`${totalHours.toFixed(1)}h`} hint={pct >= 100 ? 'On track' : `${pct.toFixed(0)}% complete`} />
        <KpiCard label="Expected" value={`${expectedHours}h`} hint="Standard week" />
        <KpiCard
          label="Remaining"
          value={`${remaining.toFixed(1)}h`}
          hint={remaining === 0 ? 'Complete' : 'To log'}
          tone={remaining === 0 ? 'success' : 'neutral'}
        />
        <KpiCard
          label="Entries"
          value={String(timesheet?.entries?.length ?? 0)}
          hint="Total for week"
        />
      </div>

      {/* Weekly Overview + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly breakdown table */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              Daily Breakdown
            </h3>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">
              {format(currentWeek, 'MMM d')} – {format(addDays(currentWeek, 6), 'MMM d')}
            </span>
          </div>

          <div className="divide-y divide-gray-50">
            {weekDays.map((day) => {
              const entries = entriesByDay(day);
              const hours = dailyHours(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toString()}
                  className={cn(
                    'px-4 py-3 transition-colors',
                    isToday && 'bg-blue-50/40'
                  )}
                >
                  {/* Day row */}
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
                    </div>
                    <span className="text-xs font-bold text-gray-700">
                      {hours.toFixed(2)}h
                    </span>
                  </div>

                  {/* Entries for the day */}
                  {entries.length === 0 ? (
                    <div className="text-[11px] text-gray-400 italic">
                      No time recorded
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
                            {e.description || 'General work'}
                          </span>
                          <span className="text-gray-500 font-semibold flex-shrink-0">
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
        </div>

        {/* Right column: charts */}
        <div className="space-y-4">
          {/* Daily bar chart */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">
                Hours by Day
              </h3>
            </div>
            <div className="flex items-end justify-between gap-1 h-32">
              {analytics?.daily.map((d) => {
                const height = maxDailyHours > 0 ? (d.hours / maxDailyHours) * 100 : 0;
                const isWeekend = [5, 6].includes(new Date(d.date).getDay());
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[9px] font-semibold text-gray-600">
                      {d.hours > 0 ? d.hours.toFixed(1) : ''}
                    </div>
                    <div
                      className="w-full bg-gray-100 rounded-t-sm relative overflow-hidden"
                      style={{ height: '88px' }}
                    >
                      <div
                        className={cn(
                          'absolute bottom-0 left-0 right-0 rounded-t-sm transition-all',
                          isWeekend ? 'bg-gray-400' : 'bg-primary'
                        )}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-gray-500 font-medium">
                      {format(new Date(d.date), 'EEE').charAt(0)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hours by project */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
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
              <div className="space-y-2.5">
                {analytics.by_project.map((p) => {
                  const pct =
                    totalHours > 0 ? (p.hours / totalHours) * 100 : 0;
                  return (
                    <div key={p.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-gray-700 truncate pr-2">
                          {p.name}
                        </span>
                        <span className="text-[10px] text-gray-500 font-semibold flex-shrink-0">
                          {p.hours}h
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700">
            Weekly Progress
          </span>
          <span className="text-xs font-bold text-gray-700">
            {pct.toFixed(0)}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              pct >= 100 ? 'bg-emerald-500' : 'bg-primary'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" />
          {canEditAny ? (
            <span>You have admin rights — entries can be edited from the day view.</span>
          ) : (
            <span>Time cannot be edited — it&apos;s recorded automatically.</span>
          )}
        </div>
        {canSubmit && (
          <button
            onClick={() => {
              if (
                confirm(
                  `Submit your timesheet for ${format(currentWeek, 'MMM d')} – ${format(addDays(currentWeek, 6), 'MMM d, yyyy')}?\n\nTotal: ${totalHours.toFixed(1)}h\n\nOnce submitted, you can no longer edit unless returned by your manager.`
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
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-md text-sm font-medium">
            <Clock className="w-4 h-4" />
            Awaiting approval
          </div>
        )}
        {timesheet?.status === 'approved' && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-md text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Approved
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'success' | 'danger';
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-900 mt-2">{value}</div>
      {hint && (
        <div
          className={cn(
            'text-[11px] mt-0.5',
            tone === 'success'
              ? 'text-emerald-600 font-medium'
              : tone === 'danger'
              ? 'text-red-600 font-medium'
              : 'text-gray-500'
          )}
        >
          {hint}
        </div>
      )}
    </div>
  );
}