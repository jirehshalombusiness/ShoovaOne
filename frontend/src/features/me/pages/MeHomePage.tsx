import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Cake,
  CheckCircle2,
  Clock,
  FileSignature,
  FileText,
  Inbox,
  Laptop,
  Plus,
  Sun,
  Wallet,
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
      <div className="space-y-5">
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="border border-red-200 bg-red-50 rounded-xl p-6">
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

  const totalRemaining = balances.reduce((sum, b) => sum + b.remaining_days, 0);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary to-emerald-900 p-6 text-white">
        <div className="absolute -right-16 -top-20 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute right-10 -bottom-24 w-56 h-56 rounded-full bg-white/5" />

        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </div>
            <h2 className="text-2xl font-bold tracking-tight mt-1.5">
              {greeting}, {person.first_name}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {person.job_title && (
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-[11px] text-white/90">
                  {person.job_title}
                </span>
              )}
              {person.department && (
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-[11px] text-white/90">
                  {person.department}
                </span>
              )}
              {person.location && (
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-[11px] text-white/90">
                  {person.location}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/me/time-off')}
              className="flex items-center gap-2 px-4 py-2 bg-white text-primary rounded-md text-xs font-semibold hover:bg-white/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Request Time Off
            </button>
            <button
              onClick={() => navigate('/me/profile')}
              className="px-4 py-2 border border-white/25 text-white rounded-md text-xs font-semibold hover:bg-white/10 transition-colors"
            >
              My Profile
            </button>
          </div>
        </div>
      </div>

      {/* Pending approvals */}
      {pending_approvals.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
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
              onClick={() => navigate('/me/approvals')}
              className="flex items-center gap-1 text-xs font-medium text-amber-800 hover:text-amber-900 transition-colors flex-shrink-0"
            >
              Open inbox
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Birthday nudge */}
      {!person.date_of_birth && (
        <button
          onClick={() => navigate('/me/profile')}
          className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 bg-white hover:border-amber-200 hover:bg-amber-50/40 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Cake className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-gray-900">
              Add your date of birth
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              HR will include you in company birthday celebrations
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
        </button>
      )}

      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Clock}
          label="Leave remaining"
          value={`${totalRemaining.toFixed(1)} days`}
          onClick={() => navigate('/me/time-off')}
        />
        <StatCard
          icon={Inbox}
          label="Pending approvals"
          value={String(pending_approvals.length)}
          onClick={() => navigate('/me/approvals')}
        />
        <StatCard
          icon={Laptop}
          label="Devices assigned"
          value={String(data.devices_count)}
          onClick={() => navigate('/me/devices')}
        />
        <StatCard
          icon={FileText}
          label={data.documents_pending > 0 ? 'Docs to verify' : 'Documents'}
          value={
            data.documents_pending > 0
              ? String(data.documents_pending)
              : 'All clear'
          }
          onClick={() => navigate('/me/documents')}
        />
      </div>

      {/* Balances + holidays */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="border border-gray-200 rounded-xl p-5 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-semibold text-gray-900">
              Time Off Balance
            </h3>
            <button
              onClick={() => navigate('/me/time-off')}
              className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
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
              <p className="text-[11px] text-gray-400 mt-1">
                Your allocation is created automatically from HR policy
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
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
            </div>
          )}
        </div>

        <div className="border border-gray-200 rounded-xl p-5 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-semibold text-gray-900">
              Upcoming Holidays
            </h3>
            <Sun className="w-4 h-4 text-gray-400" />
          </div>

          {upcoming_holidays.length === 0 ? (
            <div className="text-center py-8">
              <Sun className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">No upcoming holidays</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {upcoming_holidays.map((h) => {
                const daysAway = differenceInDays(
                  new Date(h.holiday_date),
                  new Date(),
                );
                return (
                  <div
                    key={h.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
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

      {/* Recent requests + records */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 border border-gray-200 rounded-xl p-5 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-semibold text-gray-900">
              Recent Leave Requests
            </h3>
            <button
              onClick={() => navigate('/me/time-off')}
              className="text-[11px] font-medium text-primary hover:underline"
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

        <div className="border border-gray-200 rounded-xl p-5 bg-white">
          <h3 className="text-[13px] font-semibold text-gray-900 mb-3">
            My Records
          </h3>
          <div className="space-y-1">
            <RecordLink
              icon={Wallet}
              label="Compensation"
              onClick={() => navigate('/me/compensation')}
            />
            <RecordLink
              icon={FileSignature}
              label="Contract"
              onClick={() => navigate('/me/contract')}
            />
            <RecordLink
              icon={FileText}
              label="Documents"
              onClick={() => navigate('/me/documents')}
            />
            <RecordLink
              icon={Laptop}
              label="Devices"
              onClick={() => navigate('/me/devices')}
            />
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            {data.documents_pending > 0 ? (
              <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-800">
                  {data.documents_pending} document
                  {data.documents_pending === 1 ? '' : 's'} pending verification
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-[11px] text-gray-600">
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

function StatCard({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left border border-gray-200 rounded-xl p-4 bg-white hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 text-gray-400">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-lg font-bold text-gray-900 tabular-nums mt-2 truncate">
        {value}
      </div>
    </button>
  );
}

function RecordLink({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-[12px] font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
    >
      <Icon className="w-3.5 h-3.5 text-gray-400" />
      <span className="flex-1 text-left">{label}</span>
      <ArrowRight className="w-3 h-3 text-gray-300" />
    </button>
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
