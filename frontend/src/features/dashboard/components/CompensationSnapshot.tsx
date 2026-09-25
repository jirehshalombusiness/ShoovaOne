import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { hrService } from '@/services/hr.service';
import {
  DollarSign,
  TrendingUp,
  Users,
  Clock,
  ArrowRight,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function CompensationSnapshot() {
  const navigate = useNavigate();

  // Current comp breakdown
  const compQuery = useQuery({
    queryKey: ['hr', 'reports', 'compensation'],
    queryFn: () => hrService.getCompensationReport(),
    refetchInterval: 5 * 60_000,
  });

  // Pending comp change requests
  const pendingQuery = useQuery({
    queryKey: ['hr', 'approvals', 'compensation-pending'],
    queryFn: () =>
      hrService.getApprovals({
        status: 'pending',
        entity_types: 'compensation_request,compensation_change',
        limit: 100,
      }),
    refetchInterval: 60_000,
  });

  const comp = compQuery.data;
  const pending = pendingQuery.data?.items ?? [];
  const pendingCount = pending.length;

  const isLoading = compQuery.isLoading || pendingQuery.isLoading;

  if (isLoading || !comp) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="h-4 w-32 bg-gray-100 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const monthly = comp.total_annual_cost / 12;

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-gray-900">
            Compensation
          </h3>
        </div>
        <button
          onClick={() => navigate('/hr/compensation')}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Manage
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {/* Primary metric — annual cost */}
        <div className="border border-gray-100 rounded-md p-4 bg-gradient-to-br from-gray-50 to-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Projected Annual Payroll
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-500" strokeWidth={1.75} />
          </div>
          <div className="text-3xl font-bold text-gray-900 tabular-nums">
            {comp.currency}{' '}
            {comp.total_annual_cost.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            ≈ {comp.currency}{' '}
            {monthly.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}{' '}
            / month
          </div>
        </div>

        {/* Sub-metrics */}
        <div className="grid grid-cols-2 gap-3">
          <SmallTile
            icon={Users}
            label="With Salary"
            value={comp.headcount_with_salary.toString()}
          />
          <SmallTile
            icon={DollarSign}
            label="Departments"
            value={comp.rows.length.toString()}
          />
        </div>

        {/* Pending changes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Pending Changes
              </span>
            </div>
            {pendingCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                {pendingCount}
              </span>
            )}
          </div>

          {pendingCount === 0 ? (
            <div className="border border-emerald-100 bg-emerald-50 rounded-md p-3 flex items-center gap-2">
              <Inbox className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span className="text-[11px] text-emerald-800">
                No compensation changes awaiting approval
              </span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {pending.slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/hr/approvals/${p.id}`)}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-md border border-amber-100 bg-amber-50 hover:bg-amber-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-amber-900 truncate">
                      {p.requested_by.first_name} {p.requested_by.last_name}
                    </div>
                    <div className="text-[10px] text-amber-700 truncate">
                      {p.title}
                    </div>
                  </div>
                  <ArrowRight className="w-3 h-3 text-amber-600 flex-shrink-0" />
                </button>
              ))}
              {pendingCount > 3 && (
                <button
                  onClick={() => navigate('/hr/approvals')}
                  className="w-full text-center text-[11px] font-medium text-primary hover:underline py-1"
                >
                  +{pendingCount - 3} more
                </button>
              )}
            </div>
          )}
        </div>

        {/* Department breakdown (top 3) */}
        {comp.rows.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Top Departments
            </div>
            <div className="space-y-2">
              {comp.rows.slice(0, 3).map((row) => (
                <div
                  key={row.department}
                  className="flex items-center justify-between"
                >
                  <span className="text-[12px] text-gray-700 truncate">
                    {row.department}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-900 tabular-nums flex-shrink-0 ml-2">
                    {row.currency}{' '}
                    {row.avg_base_amount.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                    <span className="text-[10px] font-normal text-gray-400 ml-1">
                      avg
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SmallTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-gray-100 rounded-md p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        <Icon className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.75} />
      </div>
      <div className="text-lg font-bold text-gray-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}