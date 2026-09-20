import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Clock,
  Users,
  AlertCircle,
  Search,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Ban,
} from 'lucide-react';
import { format } from 'date-fns';
import { hrService, type AdminLeaveRequest } from '@/services/hr.service';
import { Avatar } from '@/components/ui/Avatar';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

export function HRTimeOffPage() {
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const debouncedSearch = useDebounce(search, 300);

  const statsQuery = useQuery({
    queryKey: ['hr', 'time-off', 'stats'],
    queryFn: () => hrService.getLeaveStats(),
  });

  const typesQuery = useQuery({
    queryKey: ['hr', 'leave-policies', 'types'],
    queryFn: () => hrService.listLeaveTypes(),
  });

  const employeesQuery = useQuery({
    queryKey: ['hr', 'employees', 'stats'],
    queryFn: () => hrService.getEmployeeStats(),
  });

  const requestsQuery = useQuery({
    queryKey: [
      'hr',
      'time-off',
      'requests',
      statusFilter,
      typeFilter,
      departmentFilter,
      debouncedSearch,
    ],
    queryFn: () =>
      hrService.listAllLeaveRequests({
        status: statusFilter === 'all' ? undefined : statusFilter,
        leave_type_id: typeFilter || undefined,
        department: departmentFilter || undefined,
        search: debouncedSearch || undefined,
        limit: 500,
      }),
  });

  const stats = statsQuery.data;
  const types = typesQuery.data ?? [];
  const employees = employeesQuery.data;
  const requests = requestsQuery.data?.items ?? [];

  const departments = useMemo(() => {
    if (!employees?.by_department) return [];
    return Object.keys(employees.by_department).sort();
  }, [employees]);

  const hasFilters =
    statusFilter !== 'all' ||
    typeFilter ||
    departmentFilter ||
    search.length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Time Off</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Organisation-wide leave requests, balances, and calendar
          </p>
        </div>
        <button
          onClick={() => navigate('/hr/leave-policies')}
          className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 bg-white rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Leave Policies
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Clock}
          label="Pending Requests"
          value={stats?.pending ?? '—'}
          sub="awaiting decision"
          tone="warning"
        />
        <KpiCard
          icon={UserCheck}
          label="On Leave Today"
          value={stats?.currently_on_leave ?? '—'}
          sub={
            stats && stats.upcoming_7_days > 0
              ? `${stats.upcoming_7_days} starting within 7 days`
              : 'no one starting soon'
          }
          tone="info"
        />
        <KpiCard
          icon={TrendingUp}
          label="Approved This Month"
          value={stats?.approved_this_month ?? '—'}
          sub={
            stats && stats.rejected_this_month > 0
              ? `${stats.rejected_this_month} rejected`
              : 'all approved'
          }
          tone="primary"
        />
        <KpiCard
          icon={CalendarDays}
          label="Leave Types"
          value={types.filter((t) => t.is_active).length}
          sub="active policies"
          tone="default"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
        {/* Status */}
        <div className="flex flex-wrap items-center gap-1">
          {[
            { value: 'all', label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'cancelled', label: 'Cancelled' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                statusFilter === f.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="hidden lg:block w-px h-6 bg-gray-200" />

        {/* Selects */}
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All leave types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {departments.length > 0 && (
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by employee name…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {hasFilters && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setTypeFilter('');
                setDepartmentFilter('');
                setSearch('');
              }}
              className="px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {requestsQuery.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="border border-gray-200 rounded-lg bg-white text-center py-16">
          <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">
            {hasFilters ? 'No leave requests match your filters' : 'No leave requests yet'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {hasFilters
              ? 'Try adjusting or clearing your filters'
              : 'Requests submitted by employees will appear here'}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          {/* Table head */}
          <div className="hidden lg:grid grid-cols-[minmax(240px,2fr)_minmax(140px,1fr)_minmax(200px,1.5fr)_minmax(90px,0.5fr)_minmax(120px,0.8fr)_minmax(140px,1fr)_40px] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            <div>Employee</div>
            <div>Type</div>
            <div>Dates</div>
            <div>Days</div>
            <div>Status</div>
            <div>Approver</div>
            <div />
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100">
            {requests.map((req) => (
              <RequestRow key={req.id} request={req} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// KPI CARD
// ============================================================

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub: string;
  tone: 'default' | 'primary' | 'warning' | 'info';
}) {
  const iconColor = {
    default: 'text-gray-400',
    primary: 'text-primary',
    warning: 'text-amber-500',
    info: 'text-blue-500',
  }[tone];

  return (
    <div className="border border-gray-200 rounded-lg bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        <Icon className={cn('w-4 h-4', iconColor)} strokeWidth={1.75} />
      </div>
      <div className="text-3xl font-bold text-gray-900 tabular-nums">{value}</div>
      <div className="text-[11px] text-gray-500 mt-1">{sub}</div>
    </div>
  );
}

// ============================================================
// REQUEST ROW
// ============================================================

function RequestRow({ request }: { request: AdminLeaveRequest }) {
  const navigate = useNavigate();

  const statusStyles: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,2fr)_minmax(140px,1fr)_minmax(200px,1.5fr)_minmax(90px,0.5fr)_minmax(120px,0.8fr)_minmax(140px,1fr)_40px] gap-4 px-5 py-3 hover:bg-gray-50 transition-colors items-center">
      {/* Employee */}
      <button
        onClick={() => navigate(`/hr/employees/${request.person_id}`)}
        className="flex items-center gap-3 min-w-0 text-left"
      >
        <Avatar
          firstName={request.person.first_name}
          lastName={request.person.last_name}
          imageUrl={request.person.profile_image_url}
          size="sm"
        />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-gray-900 truncate">
            {request.person.first_name} {request.person.last_name}
          </div>
          {request.person.department && (
            <div className="text-[11px] text-gray-500 truncate">
              {request.person.department}
            </div>
          )}
        </div>
      </button>

      {/* Type */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: request.leave_type_color }}
        />
        <span className="text-[12px] text-gray-700 truncate">
          {request.leave_type_name}
        </span>
      </div>

      {/* Dates */}
      <div className="text-[12px] text-gray-700">
        {format(new Date(request.start_date), 'MMM d')} –{' '}
        {format(new Date(request.end_date), 'MMM d, yyyy')}
      </div>

      {/* Days */}
      <div className="text-[12px] text-gray-900 font-medium tabular-nums">
        {request.total_days} day{request.total_days !== 1 ? 's' : ''}
      </div>

      {/* Status */}
      <div>
        <span
          className={cn(
            'inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border',
            statusStyles[request.status] ?? statusStyles.pending,
          )}
        >
          {request.status}
        </span>
      </div>

      {/* Approver */}
      <div className="text-[11px] text-gray-600 truncate">
        {request.approval_assigned_to_name ||
          request.approved_by_name ||
          (request.status === 'pending' ? 'Unassigned' : '—')}
      </div>

      {/* Chevron */}
      <button
        onClick={() => {
          if (request.approval_id) {
            navigate(`/hr/approvals/${request.approval_id}`);
          } else {
            navigate(`/hr/employees/${request.person_id}`);
          }
        }}
        className="hidden lg:flex items-center justify-center p-1.5 rounded-md hover:bg-gray-200 transition-colors"
        title="View details"
      >
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </button>
    </div>
  );
}