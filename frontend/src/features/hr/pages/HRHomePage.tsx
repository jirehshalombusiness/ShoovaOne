import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { hrService } from '@/services/hr.service';
import {
  Calendar,
  Laptop,
  FileText,
  Plus,
  ArrowRight,
  Cake,
  Sun,
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

export function HRHomePage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'my-home'],
    queryFn: () => hrService.getMyHRHome(),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const firstName = data.person.first_name;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}, {firstName}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Two-column top: Time Off Balance + Holidays */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Time Off Balances */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Time Off Balance
            </h2>
            <button
              onClick={() => navigate('/hr/time-off')}
              className="text-xs text-primary hover:text-primary-dark font-medium flex items-center gap-0.5"
            >
              View all
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {data.balances.length === 0 ? (
            <div className="text-center py-6">
              <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">
                No leave balances configured yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.balances.slice(0, 4).map((b) => (
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
                      {b.remaining_days} days
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (b.used_days / b.total_days) * 100)}%`,
                        backgroundColor: b.leave_type_color,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                    <span>{b.used_days} used</span>
                    <span>{b.total_days} total</span>
                  </div>
                </div>
              ))}

              <button
                onClick={() => navigate('/hr/time-off')}
                className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Request Time Off
              </button>
            </div>
          )}
        </div>

        {/* Upcoming Holidays */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Upcoming Holidays
            </h2>
            <Sun className="w-4 h-4 text-gray-400" />
          </div>

          {data.upcoming_holidays.length === 0 ? (
            <div className="text-center py-6">
              <Sun className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">No upcoming holidays</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.upcoming_holidays.map((h) => {
                const daysAway = differenceInDays(
                  new Date(h.holiday_date),
                  new Date()
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

      {/* Three-column bottom: My Requests, My Devices, My Documents */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Recent Requests */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">My Requests</h3>
            <button
              onClick={() => navigate('/hr/time-off')}
              className="text-[10px] text-primary hover:text-primary-dark font-medium"
            >
              View all
            </button>
          </div>
          {data.recent_requests.length === 0 ? (
            <div className="text-center py-6">
              <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">No requests yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recent_requests.slice(0, 3).map((r) => (
                <div
                  key={r.id}
                  className="p-2.5 rounded-md border border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-gray-900">
                      {r.leave_type_name}
                    </span>
                    <StatusPill status={r.status} />
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {format(new Date(r.start_date), 'MMM d')} –{' '}
                    {format(new Date(r.end_date), 'MMM d')} · {r.total_days}d
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Devices */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">My Devices</h3>
            <button
              onClick={() => navigate('/hr/devices')}
              className="text-[10px] text-primary hover:text-primary-dark font-medium"
            >
              View all
            </button>
          </div>
          {data.devices_count === 0 ? (
            <div className="text-center py-6">
              <Laptop className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">No devices assigned</p>
            </div>
          ) : (
            <div className="text-center py-3">
              <div className="text-3xl font-bold text-gray-900">
                {data.devices_count}
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                device{data.devices_count !== 1 ? 's' : ''} assigned to you
              </div>
            </div>
          )}
        </div>

        {/* My Documents */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Documents</h3>
            <button
              onClick={() => navigate('/hr/documents')}
              className="text-[10px] text-primary hover:text-primary-dark font-medium"
            >
              View all
            </button>
          </div>
          {data.documents_pending > 0 ? (
            <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-md">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-[10px] text-amber-800">
                {data.documents_pending} document
                {data.documents_pending !== 1 ? 's' : ''} pending verification
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">All documents in order</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  };
  return (
    <span
      className={cn(
        'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
        map[status] ?? 'bg-gray-100 text-gray-500'
      )}
    >
      {status}
    </span>
  );
}