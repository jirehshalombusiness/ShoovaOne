import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  Inbox,
  Cake,
  FileWarning,
  CalendarClock,
  ArrowRight,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { hrService } from '@/services/hr.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

export function HROverviewPage() {
  const navigate = useNavigate();
  const access = useHRAccess();

  const statsQuery = useQuery({
    queryKey: ['hr', 'employees', 'stats'],
    queryFn: () => hrService.getEmployeeStats(),
  });

  const leaveStatsQuery = useQuery({
    queryKey: ['hr', 'time-off', 'stats'],
    queryFn: () => hrService.getLeaveStats(),
    enabled: access.canViewLeave,
  });

  const approvalsQuery = useQuery({
    queryKey: ['hr', 'approvals', 'pending-preview'],
    queryFn: () =>
      hrService.getApprovals({
        status: 'pending',
        assigned_to_me: false,
        include_all_if_hr: true,
        limit: 5,
      }),
    enabled: access.canViewLeave,
  });

  const celebrationsQuery = useQuery({
    queryKey: ['hr', 'celebrations', 30],
    queryFn: () => hrService.getCelebrations({ days_ahead: 30 }),
    enabled: access.canViewSensitive,
  });

  const docsQuery = useQuery({
    queryKey: ['hr', 'documents', 'summary'],
    queryFn: () => hrService.listDocuments({ limit: 1 }),
    enabled: access.canViewSensitive,
  });

  const contractsQuery = useQuery({
    queryKey: ['hr', 'contracts', 'stats'],
    queryFn: () => hrService.getContractStats(),
    enabled: access.canViewEmployment,
  });

  const stats = statsQuery.data;
  const leaveStats = leaveStatsQuery.data;
  const approvals = approvalsQuery.data?.items ?? [];
  const celebrations = celebrationsQuery.data?.items ?? [];
  const docs = docsQuery.data;
  const contracts = contractsQuery.data;

  const kpis = [
    {
      label: 'Active Employees',
      value: stats?.active ?? '—',
      sub:
        stats && stats.total !== stats.active
          ? `${stats.total} total`
          : 'all active',
      icon: UserCheck,
      tone: 'primary',
    },
    {
      label: 'Pending Approvals',
      value: leaveStats?.pending ?? approvals.length ?? '—',
      sub: 'awaiting decision',
      icon: Inbox,
      tone: 'warning',
    },
    {
      label: 'On Leave Today',
      value: leaveStats?.currently_on_leave ?? '—',
      sub:
        leaveStats && leaveStats.upcoming_7_days > 0
          ? `${leaveStats.upcoming_7_days} starting within 7d`
          : 'no one starting soon',
      icon: CalendarClock,
      tone: 'info',
    },
    {
      label: 'Documents',
      value: docs?.unverified ?? '—',
      sub:
        docs && docs.expiring_30 > 0
          ? `${docs.expiring_30} expiring soon`
          : 'unverified',
      icon: FileWarning,
      tone: 'danger',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">HR Overview</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            People, compliance, and organisational health
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/hr/employees')}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Users className="w-4 h-4" />
            Employees
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="border border-gray-200 rounded-lg bg-white p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  {kpi.label}
                </span>
                <Icon
                  className={cn(
                    'w-4 h-4',
                    kpi.tone === 'warning' && 'text-amber-500',
                    kpi.tone === 'info' && 'text-blue-500',
                    kpi.tone === 'danger' && 'text-red-500',
                    kpi.tone === 'primary' && 'text-primary',
                  )}
                  strokeWidth={1.75}
                />
              </div>
              <div className="text-3xl font-bold text-gray-900 tabular-nums">
                {kpi.value}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">{kpi.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pending approvals */}
        {access.canViewLeave && (
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Approvals Waiting
                </h3>
              </div>
              <button
                onClick={() => navigate('/hr/approvals')}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Open inbox
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {approvalsQuery.isLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded-md animate-pulse" />
                ))}
              </div>
            ) : approvals.length === 0 ? (
              <div className="text-center py-12">
                <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No pending approvals</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {approvals.slice(0, 5).map((a) => {
                  const overdue = a.due_at
                    ? new Date(a.due_at) < new Date()
                    : false;
                  return (
                    <button
                      key={a.id}
                      onClick={() => navigate(`/hr/approvals/${a.id}`)}
                      className="w-full flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <Avatar
                        firstName={a.requested_by.first_name}
                        lastName={a.requested_by.last_name}
                        imageUrl={a.requested_by.profile_image_url}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-gray-900 truncate">
                          {a.title}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {a.requested_by.first_name} {a.requested_by.last_name}
                          {a.due_at && (
                            <span className={overdue ? 'text-red-600 ml-1.5' : 'ml-1.5'}>
                              · due {format(new Date(a.due_at), 'MMM d')}
                            </span>
                          )}
                        </div>
                      </div>
                      <PriorityPill priority={a.priority} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Upcoming celebrations */}
        {access.canViewSensitive && (
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Cake className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Upcoming Celebrations
                </h3>
              </div>
              <button
                onClick={() => navigate('/hr/celebrations')}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View all
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {celebrationsQuery.isLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded-md animate-pulse" />
                ))}
              </div>
            ) : celebrations.length === 0 ? (
              <div className="text-center py-12">
                <Cake className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">
                  No celebrations in the next 30 days
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {celebrations.slice(0, 5).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <Avatar
                      firstName={c.first_name}
                      lastName={c.last_name}
                      imageUrl={c.profile_image_url}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-gray-900 truncate">
                        {c.first_name} {c.last_name}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                        {c.kind === 'birthday' ? (
                          <Cake className="w-3 h-3" />
                        ) : (
                          <TrendingUp className="w-3 h-3" />
                        )}
                        {c.label}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[11px] font-semibold text-gray-700">
                        {c.days_away === 0
                          ? 'Today'
                          : c.days_away === 1
                            ? 'Tomorrow'
                            : `In ${c.days_away}d`}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {format(new Date(c.date), 'MMM d')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom row — quick links + contract expiry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Quick actions */}
        <div className="border border-gray-200 rounded-lg bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="space-y-1">
            <QuickLink
              icon={UserPlus}
              label="Add Employee"
              description="Create a new person record"
              onClick={() => navigate('/people/new')}
            />
            <QuickLink
              icon={Inbox}
              label="Approvals Inbox"
              description="Review pending requests"
              onClick={() => navigate('/hr/approvals')}
            />
            <QuickLink
              icon={CalendarClock}
              label="Time Off Oversight"
              description="All leave requests and balances"
              onClick={() => navigate('/hr/time-off')}
            />
            <QuickLink
              icon={FileWarning}
              label="Document Compliance"
              description="Verify and track expiring docs"
              onClick={() => navigate('/hr/documents')}
            />
          </div>
        </div>

        {/* Contracts expiring */}
        {access.canViewEmployment && contracts && (
          <div className="border border-gray-200 rounded-lg bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Contract Status
              </h3>
              <button
                onClick={() => navigate('/hr/contracts')}
                className="text-xs font-medium text-primary hover:underline"
              >
                View all
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatBlock
                label="Expiring ≤30d"
                value={contracts.expiring_30}
                tone={contracts.expiring_30 > 0 ? 'danger' : 'default'}
              />
              <StatBlock
                label="Expiring ≤60d"
                value={contracts.expiring_60}
                tone={contracts.expiring_60 > 0 ? 'warning' : 'default'}
              />
              <StatBlock
                label="Expiring ≤90d"
                value={contracts.expiring_90}
                tone={contracts.expiring_90 > 0 ? 'info' : 'default'}
              />
            </div>
            {contracts.expiring_30 > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-md flex items-start gap-2">
                <FileWarning className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-red-800">
                  {contracts.expiring_30} contract
                  {contracts.expiring_30 === 1 ? '' : 's'} expiring within 30 days.
                  Review and renew.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

function PriorityPill({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600',
    normal: 'bg-blue-50 text-blue-700',
    high: 'bg-amber-50 text-amber-700',
    urgent: 'bg-red-50 text-red-700',
  };
  return (
    <span
      className={cn(
        'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider flex-shrink-0',
        styles[priority] ?? styles.normal,
      )}
    >
      {priority}
    </span>
  );
}

function QuickLink({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-gray-50 transition-colors text-left group"
    >
      <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-600" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-gray-900">{label}</div>
        <div className="text-[11px] text-gray-500">{description}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function StatBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'default' | 'info' | 'warning' | 'danger';
}) {
  const valueColor = {
    default: 'text-gray-900',
    info: 'text-blue-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
  }[tone];

  return (
    <div className="text-center p-3 bg-gray-50 rounded-md">
      <div className={cn('text-2xl font-bold tabular-nums', valueColor)}>
        {value}
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider font-semibold">
        {label}
      </div>
    </div>
  );
}