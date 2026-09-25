import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { hrService } from '@/services/hr.service';
import {
  Users,
  UserCheck,
  Inbox,
  CalendarDays,
  FileWarning,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function ExecutiveKpis() {
  const navigate = useNavigate();

  // Headcount
  const headcountQuery = useQuery({
    queryKey: ['hr', 'reports', 'headcount'],
    queryFn: () => hrService.getHeadcountReport(),
    refetchInterval: 5 * 60_000, // 5 min
  });

  // Today's attendance
  const attendanceQuery = useQuery({
    queryKey: ['hr', 'reports', 'attendance-today'],
    queryFn: () => hrService.getAttendanceToday(),
    refetchInterval: 60_000,
  });

  // My approval stats
  const approvalsQuery = useQuery({
    queryKey: ['hr', 'approvals', 'stats', 'me'],
    queryFn: () => hrService.getMyApprovalStats(),
    refetchInterval: 60_000,
  });

  // Leave usage this year
  const leaveQuery = useQuery({
    queryKey: ['hr', 'reports', 'leave-usage', new Date().getFullYear()],
    queryFn: () => hrService.getLeaveUsageReport(new Date().getFullYear()),
    refetchInterval: 5 * 60_000,
  });

  // Contract expiry
  const contractsQuery = useQuery({
    queryKey: ['hr', 'reports', 'contracts-expiring'],
    queryFn: () => hrService.getContractsExpiring(),
    refetchInterval: 5 * 60_000,
  });

  const headcount = headcountQuery.data;
  const attendance = attendanceQuery.data;
  const approvals = approvalsQuery.data;
  const leave = leaveQuery.data;
  const contracts = contractsQuery.data;

  const kpis = [
    {
      key: 'headcount',
      label: 'Active Workforce',
      value: headcount?.active ?? '—',
      sub:
        headcount
          ? `${headcount.hired_this_year} hired · ${headcount.left_this_year} left this year`
          : 'loading',
      icon: Users,
      tone: 'primary' as const,
      onClick: () => navigate('/hr/employees'),
    },
    {
      key: 'attendance',
      label: 'Checked In Today',
      value: attendance
        ? `${attendance.checked_in} / ${attendance.total_active}`
        : '—',
      sub: attendance
        ? `${attendance.percentage_checked_in}% of active workforce`
        : 'loading',
      icon: UserCheck,
      tone: 'success' as const,
      onClick: () => navigate('/attendance'),
    },
    {
      key: 'approvals',
      label: 'Awaiting My Decision',
      value: approvals?.pending ?? '—',
      sub:
        approvals && approvals.overdue > 0
          ? `${approvals.overdue} overdue`
          : 'no pending items',
      icon: Inbox,
      tone: approvals && approvals.overdue > 0 ? 'warning' : 'info',
      onClick: () => navigate('/hr/approvals'),
    },
    {
      key: 'leave',
      label: 'Leave Used This Year',
      value: leave ? `${leave.total_approved_days.toFixed(0)}d` : '—',
      sub: leave
        ? `${leave.total_pending_days.toFixed(0)}d pending`
        : 'loading',
      icon: CalendarDays,
      tone: 'info' as const,
      onClick: () => navigate('/hr/time-off'),
    },
    {
      key: 'contracts',
      label: 'Contracts Expiring',
      value: contracts?.within_30.length ?? '—',
      sub:
        contracts && contracts.within_30.length > 0
          ? 'within 30 days'
          : 'nothing urgent',
      icon: FileWarning,
      tone:
        contracts && contracts.within_30.length > 0 ? 'danger' : 'default',
      onClick: () => navigate('/hr/contracts'),
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <button
            key={kpi.key}
            onClick={kpi.onClick}
            className={cn(
              'group text-left bg-white border border-gray-200 rounded-lg p-5',
              'hover:border-gray-300 hover:shadow-sm transition-all',
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {kpi.label}
              </span>
              <Icon
                className={cn(
                  'w-4 h-4',
                  kpi.tone === 'primary' && 'text-primary',
                  kpi.tone === 'success' && 'text-emerald-500',
                  kpi.tone === 'warning' && 'text-amber-500',
                  kpi.tone === 'danger' && 'text-red-500',
                  kpi.tone === 'info' && 'text-blue-500',
                  kpi.tone === 'default' && 'text-gray-400',
                )}
                strokeWidth={1.75}
              />
            </div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums">
              {kpi.value}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-gray-500">{kpi.sub}</span>
              <ArrowRight className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        );
      })}
    </div>
  );
}