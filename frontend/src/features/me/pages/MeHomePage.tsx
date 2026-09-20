import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Clock,
  Laptop,
  FileText,
  ArrowRight,
  Inbox,
  CheckCircle2,
  AlertCircle,
  Sun,
  Plus,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { meService } from '@/services/me.service';
import { cn } from '@/lib/utils';

export function MeHomePage() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['me', 'home'],
    queryFn: () => meService.getHome(),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="border border-red-200 bg-red-50 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-900">
              Could not load your HR data
            </h3>
            <p className="text-sm text-red-700 mt-1">
              {(error as Error)?.message ??
                'Your account may not be linked to an employee record.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { person, balances, upcoming_holidays, recent_requests, pending_approvals } = data;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          {greeting}, {person.first_name}
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
          {person.job_title ? ` · ${person.job_title}` : ''}
        </p>
      </div>

      {/* Pending approvals banner */}
      {pending_approvals.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Inbox className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-amber-900">
                  {pending_approvals.length} approval
                  {pending_approvals.length === 1 ? '' : 's'} waiting for you
                </div>
                <div className="text-xs text-amber-700 mt-0.5">
                  Review and decide on these requests
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/hr/approvals')}
              className="flex items-center gap-1 text-xs font-medium text-amber-800 hover:text-amber-900 transition-colors"
            >
              Open inbox
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Top row — balances + holidays */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Time off balances */}
        <div className="border border-gray-200 rounded-lg p-5 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Time Off Balance</h3>
            <button
              onClick={() => navigate('/me/time-off')}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {balances.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">
                No leave balances set up yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {balances.slice(0, 4).map((b) => {
                const pct =
                  b.total_days > 0
                    ? Math.min(100, (b.used_days / b.total_days) * 100)
                    : 0;
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: b.leave_type_color }}
                        />
                        <span className="text-[12px] font-medium text-gray-700">
                          {b.leave_type_name}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-gray-900 tabular-nums">
                        {b.remaining_days.toFixed(1)} days
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: b.leave_type_color,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                      <span>
                        {b.used_days.toFixed(1)} used
                        {b.pending_days > 0 && `, ${b.pending_days.toFixed(1)} pending`}
                      </span>
                      <span>{b.total_days.toFixed(1)} total</span>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() => navigate('/me/time-off')}
                className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Request Time Off
              </button>
            </div>
          )}
        </div>

        {/* Upcoming holidays */}
        <div className="border border-gray-200 rounded-lg p-5 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Upcoming Holidays</h3>
            <Sun className="w-4 h-4 text-gray-400" />
          </div>

          {upcoming_holidays.length === 0 ? (
            <div className="text-center py-8">
              <Sun className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">No upcoming holidays</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming_holidays.map((h) => {
                const daysAway = differenceInDays(
                  new Date(h.holiday_date),
                  new Date(),
                );
                return (
                  <div
                    key={h.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-11 text-center flex-shrink-0 border border-gray-200 rounded-md overflow-hidden">
                      <div className="bg-gray-50 text-[8px] font-bold text-gray-500 uppercase py-0.5">
                        {format(new Date(h.holiday_date), 'MMM')}
                      </div>
                      <div className="text-base font-bold text-gray-900 py-0.5">
                        {format(new Date(h.holiday_date), 'd')}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-gray-900 truncate">
                        {h.name}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {h.is_paid ? 'Paid holiday' : 'Holiday'}
                        {daysAway >= 0 && (
                          <span className="ml-1">
                            · in {daysAway} {daysAway === 1 ? 'day' : 'days'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row — recent requests + quick stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent leave requests */}
        <div className="lg:col-span-2 border border-gray-200 rounded-lg p-5 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Recent Leave Requests
            </h3>
            <button
              onClick={() => navigate('/me/time-off')}
              className="text-xs font-medium text-primary hover:underline"
            >
              View all
            </button>
          </div>

          {recent_requests.length === 0 ? (
            <div className="text-center py-8">
              <CalendarDays className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">
                You haven't made any leave requests yet
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recent_requests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: r.leave_type_color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-gray-900">
                      {r.leave_type_name}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {format(new Date(r.start_date), 'MMM d')} –{' '}
                      {format(new Date(r.end_date), 'MMM d, yyyy')} ·{' '}
                      {r.total_days} day{r.total_days !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <StatusPill status={r.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="space-y-4">
          {/* Devices */}
          <div className="border border-gray-200 rounded-lg p-5 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">Devices</h3>
              </div>
              <button
                onClick={() => navigate('/me/devices')}
                className="text-[10px] font-medium text-primary hover:underline"
              >
                View
              </button>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {data.devices_count}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {data.devices_count === 1 ? 'device assigned' : 'devices assigned'}
            </div>
          </div>

          {/* Documents */}
          <div className="border border-gray-200 rounded-lg p-5 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">Documents</h3>
              </div>
              <button
                onClick={() => navigate('/me/documents')}
                className="text-[10px] font-medium text-primary hover:underline"
              >
                View
              </button>
            </div>
            {data.documents_pending > 0 ? (
              <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-100 rounded-md">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-800">
                  {data.documents_pending} document
                  {data.documents_pending === 1 ? '' : 's'} pending verification
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="text-[12px] text-gray-600">
                  All documents in order
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border',
        styles[status] ?? 'bg-gray-100 text-gray-600 border-gray-200',
      )}
    >
      {status}
    </span>
  );
}