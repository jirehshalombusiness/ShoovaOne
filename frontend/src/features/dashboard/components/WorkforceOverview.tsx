import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { hrService } from '@/services/hr.service';
import {
  Users,
  UserCheck,
  UserPlus,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function WorkforceOverview() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'reports', 'headcount'],
    queryFn: () => hrService.getHeadcountReport(),
    refetchInterval: 5 * 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="h-4 w-32 bg-gray-100 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const netChange = data.hired_this_year - data.left_this_year;

  // Sort departments by headcount descending
  const departments = [...data.by_department]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const maxDeptCount = Math.max(...departments.map((d) => d.count), 1);

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-gray-900">
            Workforce
          </h3>
        </div>
        <button
          onClick={() => navigate('/hr/employees')}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View employees
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {/* Top stats — 4 KPI tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile
            icon={Users}
            label="Total"
            value={data.total}
            tone="default"
          />
          <Tile
            icon={UserCheck}
            label="Active"
            value={data.active}
            tone="primary"
          />
          <Tile
            icon={UserPlus}
            label="Hired YTD"
            value={data.hired_this_year}
            tone="success"
          />
          <Tile
            icon={TrendingDown}
            label="Left YTD"
            value={data.left_this_year}
            tone="danger"
          />
        </div>

        {/* Net change banner */}
        <div
          className={cn(
            'flex items-center justify-between px-4 py-3 rounded-md border',
            netChange > 0 && 'bg-emerald-50 border-emerald-100',
            netChange < 0 && 'bg-red-50 border-red-100',
            netChange === 0 && 'bg-gray-50 border-gray-200',
          )}
        >
          <div className="flex items-center gap-2">
            {netChange > 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            ) : netChange < 0 ? (
              <TrendingDown className="w-4 h-4 text-red-600" />
            ) : (
              <TrendingUp className="w-4 h-4 text-gray-400" />
            )}
            <span
              className={cn(
                'text-[13px] font-medium',
                netChange > 0 && 'text-emerald-800',
                netChange < 0 && 'text-red-800',
                netChange === 0 && 'text-gray-700',
              )}
            >
              Net change this year
            </span>
          </div>
          <span
            className={cn(
              'text-[15px] font-bold tabular-nums',
              netChange > 0 && 'text-emerald-700',
              netChange < 0 && 'text-red-700',
              netChange === 0 && 'text-gray-700',
            )}
          >
            {netChange > 0 ? '+' : ''}
            {netChange}
          </span>
        </div>

        {/* By type */}
        <div>
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            By Type
          </div>
          <div className="space-y-2">
            {data.by_type.map((bucket) => (
              <BucketRow
                key={bucket.label}
                label={bucket.label}
                count={bucket.count}
                total={data.total}
                max={Math.max(...data.by_type.map((b) => b.count), 1)}
                onClick={() => navigate(`/hr/employees?type=${bucket.label}`)}
              />
            ))}
          </div>
        </div>

        {/* By department */}
        {departments.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Top Departments
              </div>
              <button
                onClick={() => navigate('/hr/employees')}
                className="text-[10px] text-primary hover:underline"
              >
                View all
              </button>
            </div>
            <div className="space-y-2">
              {departments.map((bucket) => (
                <BucketRow
                  key={bucket.label}
                  label={bucket.label}
                  count={bucket.count}
                  total={data.total}
                  max={maxDeptCount}
                  onClick={() =>
                    navigate(`/hr/employees?department=${bucket.label}`)
                  }
                  icon={Briefcase}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

function Tile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: 'default' | 'primary' | 'success' | 'danger';
}) {
  const color = {
    default: 'text-gray-400',
    primary: 'text-primary',
    success: 'text-emerald-500',
    danger: 'text-red-500',
  }[tone];

  return (
    <div className="border border-gray-100 rounded-md p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        <Icon className={cn('w-3.5 h-3.5', color)} strokeWidth={1.75} />
      </div>
      <div className="text-xl font-bold text-gray-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}

function BucketRow({
  label,
  count,
  total,
  max,
  onClick,
  icon: Icon,
}: {
  label: string;
  count: number;
  total: number;
  max: number;
  onClick?: () => void;
  icon?: React.ElementType;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  const share = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left group"
      disabled={!onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {Icon && <Icon className="w-3 h-3 text-gray-400 flex-shrink-0" />}
          <span className="text-[12px] text-gray-700 capitalize truncate">
            {label.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[11px] font-semibold text-gray-900 tabular-nums">
            {count}
          </span>
          <span className="text-[10px] text-gray-400 tabular-nums">
            ({share}%)
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all group-hover:bg-primary-dark"
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}