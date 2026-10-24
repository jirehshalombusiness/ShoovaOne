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
  AlertCircle,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { hrService, type ApprovalSummary } from '@/services/hr.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

const STAGE_LABELS: Record<string, string> = {
  manager: 'Manager',
  hr: 'HR',
  ceo: 'CEO',
  exec: 'Exec',
};

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

  const approvalOverviewQuery = useQuery({
    queryKey: ['hr', 'approvals', 'overview'],
    queryFn: () => hrService.getApprovalOverview(),
    enabled: access.canViewLeave,
  });

  const approvalsQuery = useQuery({
    queryKey: ['hr', 'approvals', 'pending-preview'],
    queryFn: () =>
      hrService.getApprovals({
        status: 'pending',
        assigned_to_me: false,
        include_all_if_hr: true,
        limit: 6,
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
  const overview = approvalOverviewQuery.data;
  const approvals = approvalsQuery.data?.items ?? [];
  const celebrations = celebrationsQuery.data?.items ?? [];
  const docs = docsQuery.data;
  const contracts = contractsQuery.data;

  const kpis: {
    label: string;
    value: number | string;
    sub: string;
    icon: LucideIcon;
    tone: 'primary' | 'warning' | 'danger' | 'info';
    onClick: () => void;
  }[] = [
    {
      label: 'Active employees',
      value: stats?.active ?? '—',
      sub:
        stats && stats.total !== stats.active
          ? `${stats.total} on record`
          : 'all active',
      icon: UserCheck,
      tone: 'primary',
      onClick: () => navigate('/hr/employees'),
    },
    ...(access.canViewLeave
      ? [
          {
            label: 'Pending approvals',
            value: overview?.pending ?? leaveStats?.pending ?? '—',
            sub:
              overview && overview.overdue > 0
                ? `${overview.overdue} past SLA`
                : 'all within SLA',
            icon: Inbox,
            tone:
              overview && overview.overdue > 0
                ? ('danger' as const)
                : ('warning' as const),
            onClick: () => navigate('/hr/approvals'),
          },
          {
            label: 'On leave today',
            value: leaveStats?.currently_on_leave ?? '—',
            sub:
              leaveStats && leaveStats.upcoming_7_days > 0
                ? `${leaveStats.upcoming_7_days} starting within 7d`
                : 'no one starting soon',
            icon: CalendarClock,
            tone: 'info' as const,
            onClick: () => navigate('/hr/time-off'),
          },
        ]
      : []),
    {
      label: 'Documents to review',
      value: docs?.unverified ?? '—',
      sub:
        docs && docs.expiring_30 > 0
          ? `${docs.expiring_30} expiring soon`
          : 'unverified',
      icon: FileWarning,
      tone: 'danger',
      onClick: () => navigate('/hr/documents'),
    },
  ];

  const departments = Object.entries(stats?.by_department ?? {})
    .filter(([name]) => name && name !== 'Unassigned')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxDept = Math.max(1, ...departments.map(([, count]) => count));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">
            Overview
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            People, approvals, and organisational health
          </p>
        </div>
        <div className="flex items-center gap-2">
          {access.canViewLeave && (
            <button
              onClick={() => navigate('/hr/approvals')}
              className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
            >
              <Inbox className="w-4 h-4" />
              Review queue
            </button>
          )}
          <button
            onClick={() => navigate('/hr/employees')}
            className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 bg-white rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Users className="w-4 h-4" />
            Employees
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Queue + headcount */}
      <div
        className={cn(
          'grid grid-cols-1 gap-5',
          access.canViewLeave && 'lg:grid-cols-5',
        )}
      >
        {access.canViewLeave && (
          <div className="lg:col-span-3 border border-gray-200 rounded-lg bg-white">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Approval queue
                </h3>
                {overview && overview.pending > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold tabular-nums">
                    {overview.pending}
                  </span>
                )}
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
              <div className="text-center py-14">
                <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">
                  No pending approvals
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {approvals.map((approval) => (
                  <ApprovalPreview
                    key={approval.id}
                    approval={approval}
                    onClick={() => navigate(`/hr/approvals/${approval.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Headcount by department */}
        <div
          className={cn(
            'border border-gray-200 rounded-lg bg-white',
            access.canViewLeave ? 'lg:col-span-2' : 'lg:col-span-5',
          )}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              Headcount by department
            </h3>
            <span className="text-[11px] text-gray-400 tabular-nums">
              {stats?.active ?? '—'} active
            </span>
          </div>

          {departments.length === 0 ? (
            <div className="text-center py-14">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">
                No department data yet
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-3">
              {departments.map(([name, count]) => (
                <div key={name}>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="text-gray-700 truncate">{name}</span>
                    <span className="text-gray-500 tabular-nums font-medium">
                      {count}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-full"
                      style={{ width: `${Math.max(4, (count / maxDept) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={() => navigate('/hr/employees')}
                className="mt-1 flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                View all employees
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lower row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Celebrations */}
        {access.canViewSensitive && (
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Cake className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Upcoming celebrations
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
                {celebrations.slice(0, 4).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3">
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

        {/* Compliance */}
        <div className="border border-gray-200 rounded-lg bg-white">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              Compliance watch
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            <ComplianceRow
              label="Unverified documents"
              value={docs?.unverified ?? 0}
              tone={(docs?.unverified ?? 0) > 0 ? 'warning' : 'default'}
              onClick={() => navigate('/hr/documents')}
            />
            <ComplianceRow
              label="Documents expiring in 30 days"
              value={docs?.expiring_30 ?? 0}
              tone={(docs?.expiring_30 ?? 0) > 0 ? 'danger' : 'default'}
              onClick={() => navigate('/hr/documents')}
            />
            {access.canViewEmployment && contracts && (
              <>
                <ComplianceRow
                  label="Contracts expiring in 30 days"
                  value={contracts.expiring_30}
                  tone={contracts.expiring_30 > 0 ? 'danger' : 'default'}
                  onClick={() => navigate('/hr/reports')}
                />
                <ComplianceRow
                  label="Contracts expiring in 90 days"
                  value={contracts.expiring_90}
                  tone={contracts.expiring_90 > 0 ? 'warning' : 'default'}
                  onClick={() => navigate('/hr/reports')}
                />
              </>
            )}
            {!access.canViewEmployment && (
              <div className="px-5 py-4 text-[12px] text-gray-500">
                Contract data requires employment access.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="border border-gray-200 rounded-lg bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Quick actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {access.has('people.create') && (
            <QuickAction
              icon={UserPlus}
              label="Add employee"
              onClick={() => navigate('/people/new')}
            />
          )}
          {access.canViewLeave && (
            <QuickAction
              icon={Inbox}
              label="Approvals inbox"
              onClick={() => navigate('/hr/approvals')}
            />
          )}
          {access.canViewLeave && (
            <QuickAction
              icon={CalendarClock}
              label="Time off oversight"
              onClick={() => navigate('/hr/time-off')}
            />
          )}
          <QuickAction
            icon={FileWarning}
            label="Document compliance"
            onClick={() => navigate('/hr/documents')}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

const TONE_STYLES = {
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
  info: 'bg-blue-50 text-blue-600',
} as const;

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: number | string;
  sub: string;
  icon: LucideIcon;
  tone: keyof typeof TONE_STYLES;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left border border-gray-200 rounded-lg bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        <span
          className={cn(
            'w-7 h-7 rounded-md flex items-center justify-center',
            TONE_STYLES[tone],
          )}
        >
          <Icon className="w-4 h-4" strokeWidth={1.75} />
        </span>
      </div>
      <div className="text-[26px] leading-none font-bold text-gray-900 tabular-nums mt-2">
        {value}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span
          className={cn(
            'text-[11px]',
            tone === 'danger' ? 'text-red-600' : 'text-gray-500',
          )}
        >
          {sub}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}

function ApprovalPreview({
  approval,
  onClick,
}: {
  approval: ApprovalSummary;
  onClick: () => void;
}) {
  const overdue =
    approval.due_at && new Date(approval.due_at) < new Date();

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
    >
      <Avatar
        firstName={approval.requested_by.first_name}
        lastName={approval.requested_by.last_name}
        imageUrl={approval.requested_by.profile_image_url}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-gray-900 truncate">
          {approval.title}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span>
            {approval.requested_by.first_name} {approval.requested_by.last_name}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[9px] font-semibold uppercase tracking-wider">
            {STAGE_LABELS[approval.stage] ?? approval.stage}
          </span>
          {approval.due_at && (
            <span className={overdue ? 'text-red-600 font-medium' : ''}>
              {overdue ? 'overdue' : `due ${format(new Date(approval.due_at), 'MMM d')}`}
            </span>
          )}
        </div>
      </div>
      {overdue && (
        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-1" />
      )}
    </button>
  );
}

function ComplianceRow({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone: 'default' | 'warning' | 'danger';
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
    >
      <span className="text-[12px] text-gray-700">{label}</span>
      <span className="flex items-center gap-2">
        <span
          className={cn(
            'text-sm font-semibold tabular-nums',
            tone === 'danger'
              ? 'text-red-600'
              : tone === 'warning'
                ? 'text-amber-600'
                : 'text-gray-900',
          )}
        >
          {value}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
      </span>
    </button>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors text-left"
    >
      <span className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-3.5 h-3.5 text-gray-600" strokeWidth={1.75} />
      </span>
      <span className="text-[12px] font-medium text-gray-800">{label}</span>
    </button>
  );
}
