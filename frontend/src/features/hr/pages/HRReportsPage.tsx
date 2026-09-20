import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  TrendingUp,
  CalendarDays,
  DollarSign,
  FileWarning,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { hrService } from '@/services/hr.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { cn } from '@/lib/utils';

type ReportTab = 'headcount' | 'turnover' | 'leave' | 'compensation' | 'contracts';

export function HRReportsPage() {
  const access = useHRAccess();
  const [tab, setTab] = useState<ReportTab>('headcount');

  const tabs: { id: ReportTab; label: string; icon: React.ElementType; enabled: boolean }[] = [
    { id: 'headcount', label: 'Headcount', icon: Users, enabled: access.canViewSensitive },
    { id: 'turnover', label: 'Turnover', icon: TrendingUp, enabled: access.canViewSensitive },
    { id: 'leave', label: 'Leave Usage', icon: CalendarDays, enabled: access.canViewLeave },
    { id: 'compensation', label: 'Compensation', icon: DollarSign, enabled: access.canViewCompensation },
    { id: 'contracts', label: 'Contracts', icon: FileWarning, enabled: access.canViewEmployment },
  ];

  const visibleTabs = tabs.filter((t) => t.enabled);

  // If current tab isn't accessible, switch to first visible
  if (visibleTabs.length > 0 && !visibleTabs.find((t) => t.id === tab)) {
    setTab(visibleTabs[0].id);
  }

  if (visibleTabs.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg bg-white text-center py-20">
        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-gray-700">
          No reports available
        </p>
        <p className="text-xs text-gray-400 mt-1">
          You don't have access to any HR reports
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">HR Reports</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Organisation-wide analytics and compliance reporting
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto -mb-px">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300',
                )}
              >
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      {tab === 'headcount' && <HeadcountReport />}
      {tab === 'turnover' && <TurnoverReport />}
      {tab === 'leave' && <LeaveUsageReport />}
      {tab === 'compensation' && <CompensationReport />}
      {tab === 'contracts' && <ContractExpiryReport />}
    </div>
  );
}

// ============================================================
// HEADCOUNT
// ============================================================

function HeadcountReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'reports', 'headcount'],
    queryFn: () => hrService.getHeadcountReport(),
  });

  if (isLoading || !data) {
    return <LoadingGrid />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total People" value={data.total} />
        <Kpi label="Active" value={data.active} tone="primary" />
        <Kpi label="Hired This Year" value={data.hired_this_year} tone="info" />
        <Kpi label="Left This Year" value={data.left_this_year} tone="danger" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <BucketCard title="By Type" buckets={data.by_type} />
        <BucketCard title="By Status" buckets={data.by_status} />
        <BucketCard title="By Department" buckets={data.by_department} />
        <BucketCard title="By Employment Type" buckets={data.by_employment_type} />
        <BucketCard title="By Location" buckets={data.by_location} />
      </div>
    </div>
  );
}

// ============================================================
// TURNOVER
// ============================================================

function TurnoverReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'reports', 'turnover'],
    queryFn: () => hrService.getTurnoverReport(12),
  });

  if (isLoading || !data) {
    return <LoadingGrid />;
  }

  const max = Math.max(
    1,
    ...data.months.map((m) => Math.max(m.hires, m.terminations)),
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total Hires (12m)" value={data.total_hires} tone="primary" />
        <Kpi label="Total Terminations (12m)" value={data.total_terminations} tone="danger" />
        <Kpi
          label="Net Change"
          value={
            (data.total_hires - data.total_terminations > 0 ? '+' : '') +
            (data.total_hires - data.total_terminations)
          }
          tone={data.total_hires >= data.total_terminations ? 'primary' : 'danger'}
        />
        <Kpi
          label="Rolling Rate"
          value={`${data.rolling_12_month_rate}%`}
          tone="warning"
        />
      </div>

      <div className="border border-gray-200 rounded-lg bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Monthly Hires vs Terminations
        </h3>
        <div className="space-y-3">
          {data.months.map((m) => (
            <div key={m.month} className="flex items-center gap-3">
              <div className="w-20 text-[11px] font-mono text-gray-500">
                {m.month}
              </div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 flex items-center gap-1">
                  <div
                    className="h-5 bg-emerald-500 rounded-sm transition-all"
                    style={{ width: `${(m.hires / max) * 100}%`, minWidth: m.hires > 0 ? '4px' : '0' }}
                    title={`${m.hires} hires`}
                  />
                  <span className="text-[11px] text-gray-600 tabular-nums">
                    {m.hires > 0 ? m.hires : ''}
                  </span>
                </div>
                <div className="flex-1 flex items-center gap-1">
                  <div
                    className="h-5 bg-red-500 rounded-sm transition-all"
                    style={{
                      width: `${(m.terminations / max) * 100}%`,
                      minWidth: m.terminations > 0 ? '4px' : '0',
                    }}
                    title={`${m.terminations} terminations`}
                  />
                  <span className="text-[11px] text-gray-600 tabular-nums">
                    {m.terminations > 0 ? m.terminations : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-gray-100 text-[11px] text-gray-600">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
            Hires
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-red-500 rounded-sm" />
            Terminations
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LEAVE USAGE
// ============================================================

function LeaveUsageReport() {
  const [year, setYear] = useState(new Date().getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'reports', 'leave-usage', year],
    queryFn: () => hrService.getLeaveUsageReport(year),
  });

  if (isLoading || !data) {
    return <LoadingGrid />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-4 flex-1">
          <Kpi label="Approved Days" value={data.total_approved_days.toFixed(1)} tone="primary" />
          <Kpi label="Pending Days" value={data.total_pending_days.toFixed(1)} tone="warning" />
          <Kpi label="Most Used" value={data.most_used_type ?? '—'} />
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="ml-4 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {data.rows.length === 0 ? (
        <div className="border border-gray-200 rounded-lg bg-white text-center py-16">
          <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-700">No leave records for {year}</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="hidden lg:grid grid-cols-[minmax(180px,1.5fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(100px,0.8fr)] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            <div>Leave Type</div>
            <div>Requests</div>
            <div>Requested</div>
            <div>Approved</div>
            <div>Rejected</div>
            <div>Avg Days</div>
          </div>
          <div className="divide-y divide-gray-100">
            {data.rows.map((r) => (
              <div
                key={r.leave_type_id}
                className="grid grid-cols-1 lg:grid-cols-[minmax(180px,1.5fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(100px,0.8fr)] gap-4 px-5 py-3 items-center hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: r.leave_type_color }}
                  />
                  <span className="text-[13px] font-medium text-gray-900">
                    {r.leave_type_name}
                  </span>
                </div>
                <div className="text-[12px] text-gray-700 tabular-nums">
                  {r.requests_count}
                </div>
                <div className="text-[12px] text-gray-700 tabular-nums">
                  {r.total_days_requested.toFixed(1)}
                </div>
                <div className="text-[12px] text-emerald-700 font-medium tabular-nums">
                  {r.total_days_approved.toFixed(1)}
                </div>
                <div className="text-[12px] text-red-700 font-medium tabular-nums">
                  {r.total_days_rejected.toFixed(1)}
                </div>
                <div className="text-[12px] text-gray-700 tabular-nums">
                  {r.avg_days_per_request.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPENSATION
// ============================================================

function CompensationReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'reports', 'compensation'],
    queryFn: () => hrService.getCompensationReport(),
  });

  if (isLoading || !data) {
    return <LoadingGrid />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi
          label="Annual Cost"
          value={`${data.currency} ${data.total_annual_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          tone="primary"
        />
        <Kpi label="Tracked Employees" value={data.headcount_with_salary} />
        <Kpi label="Departments" value={data.rows.length} />
      </div>

      {data.rows.length === 0 ? (
        <div className="border border-gray-200 rounded-lg bg-white text-center py-16">
          <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-700">No compensation records</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="hidden lg:grid grid-cols-[minmax(200px,2fr)_minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            <div>Department</div>
            <div>Headcount</div>
            <div>Average</div>
            <div>Minimum</div>
            <div>Maximum</div>
          </div>
          <div className="divide-y divide-gray-100">
            {data.rows.map((r) => (
              <div
                key={r.department}
                className="grid grid-cols-1 lg:grid-cols-[minmax(200px,2fr)_minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] gap-4 px-5 py-3 items-center hover:bg-gray-50 transition-colors"
              >
                <div className="text-[13px] font-medium text-gray-900">
                  {r.department}
                </div>
                <div className="text-[12px] text-gray-700 tabular-nums">
                  {r.headcount}
                </div>
                <div className="text-[12px] text-gray-900 font-medium tabular-nums">
                  {r.currency} {r.avg_base_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[12px] text-gray-600 tabular-nums">
                  {r.currency} {r.min_base_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[12px] text-gray-600 tabular-nums">
                  {r.currency} {r.max_base_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CONTRACT EXPIRY
// ============================================================

function ContractExpiryReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'reports', 'contracts-expiring'],
    queryFn: () => hrService.getContractsExpiring(),
  });

  if (isLoading || !data) {
    return <LoadingGrid />;
  }

  const all = data.within_90;

  if (all.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg bg-white text-center py-20">
        <FileWarning className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-gray-700">
          No contracts expiring within 90 days
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Expiring ≤30 days" value={data.within_30.length} tone="danger" />
        <Kpi label="Expiring ≤60 days" value={data.within_60.length} tone="warning" />
        <Kpi label="Expiring ≤90 days" value={data.within_90.length} tone="info" />
      </div>

      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <div className="hidden lg:grid grid-cols-[minmax(200px,1.5fr)_minmax(160px,1fr)_minmax(180px,1.2fr)_minmax(140px,1fr)_minmax(100px,0.8fr)] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          <div>Employee</div>
          <div>Position</div>
          <div>Contract Type</div>
          <div>End Date</div>
          <div>Days Left</div>
        </div>
        <div className="divide-y divide-gray-100">
          {all.map((c) => {
            const tone =
              c.days_until_expiry <= 30
                ? 'text-red-600'
                : c.days_until_expiry <= 60
                  ? 'text-amber-600'
                  : 'text-gray-700';
            return (
              <div
                key={c.contract_id}
                className="grid grid-cols-1 lg:grid-cols-[minmax(200px,1.5fr)_minmax(160px,1fr)_minmax(180px,1.2fr)_minmax(140px,1fr)_minmax(100px,0.8fr)] gap-4 px-5 py-3 items-center hover:bg-gray-50 transition-colors"
              >
                <div className="text-[13px] font-medium text-gray-900">
                  {c.person_name}
                </div>
                <div className="text-[12px] text-gray-600">
                  {c.position ?? '—'}
                </div>
                <div className="text-[12px] text-gray-600 capitalize">
                  {c.contract_type.replace(/_/g, ' ')}
                </div>
                <div className="text-[12px] text-gray-700 tabular-nums">
                  {format(new Date(c.end_date), 'MMM d, yyyy')}
                </div>
                <div className={cn('text-[12px] font-semibold tabular-nums', tone)}>
                  {c.days_until_expiry} days
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SHARED COMPONENTS
// ============================================================

function Kpi({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  tone?: 'default' | 'primary' | 'warning' | 'info' | 'danger';
}) {
  const color = {
    default: 'text-gray-900',
    primary: 'text-primary',
    warning: 'text-amber-600',
    info: 'text-blue-600',
    danger: 'text-red-600',
  }[tone];

  return (
    <div className="border border-gray-200 rounded-lg bg-white p-5">
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className={cn('text-2xl font-bold tabular-nums', color)}>{value}</div>
    </div>
  );
}

function BucketCard({
  title,
  buckets,
}: {
  title: string;
  buckets: { label: string; count: number }[];
}) {
  if (buckets.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
        <p className="text-xs text-gray-500">No data</p>
      </div>
    );
  }

  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const max = Math.max(...buckets.map((b) => b.count));

  return (
    <div className="border border-gray-200 rounded-lg bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {buckets
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)
          .map((b) => (
            <div key={b.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] text-gray-700 capitalize">
                  {b.label.replace(/_/g, ' ')}
                </span>
                <span className="text-[12px] font-semibold text-gray-900 tabular-nums">
                  {b.count}
                  <span className="text-gray-400 font-normal ml-1">
                    ({total > 0 ? Math.round((b.count / total) * 100) : 0}%)
                  </span>
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(b.count / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-28 bg-gray-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}