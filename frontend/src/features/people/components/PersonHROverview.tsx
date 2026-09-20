import { Shield, ExternalLink, Briefcase, User, Mail, Phone, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { EmployeeDetail } from '@/services/hr.service';
import { cn } from '@/lib/utils';

interface Props {
  personId: string;
  employee: EmployeeDetail | undefined;
  isLoading: boolean;
  onViewFullRecord: () => void;
}

export function PersonHROverview({ personId, employee, isLoading, onViewFullRecord }: Props) {
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center py-12">
        <Shield className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-700">
          Could not load HR data
        </p>
      </div>
    );
  }

  const { person, contracts, leave_balances, manager, direct_reports } = employee;
  const currentContract = contracts.find((c) => c.is_current);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-gray-900">
                HR Summary
              </h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Employment overview. Full HR record at /hr/employees.
            </p>
          </div>
          <button
            onClick={onViewFullRecord}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Full HR Record
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100">
          <Stat label="Employee #" value={person.employee_number ?? '—'} />
          <Stat label="Department" value={person.department ?? '—'} />
          <Stat
            label="Employment Type"
            value={person.employment_type?.replace(/_/g, ' ') ?? '—'}
          />
          <Stat label="Status" value={person.status ?? '—'} />
        </div>
      </div>

      {/* Current contract */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Current Contract
        </h4>
        {currentContract ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Stat label="Type" value={currentContract.contract_type.replace(/_/g, ' ')} />
            <Stat label="Position" value={currentContract.position ?? '—'} />
            <Stat
              label="Started"
              value={format(new Date(currentContract.start_date), 'MMM d, yyyy')}
            />
            {currentContract.end_date && (
              <Stat
                label="Ends"
                value={format(new Date(currentContract.end_date), 'MMM d, yyyy')}
              />
            )}
            {currentContract.compensation_amount && (
              <Stat
                label="Compensation"
                value={`${currentContract.compensation_currency} ${currentContract.compensation_amount.toLocaleString()} / ${currentContract.compensation_frequency}`}
              />
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No active contract</p>
        )}
      </div>

      {/* Leave balances (top 3) */}
      {leave_balances.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Leave Balances
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {leave_balances.slice(0, 6).map((b) => (
              <div key={b.id} className="p-3 bg-gray-50 rounded-md">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: b.leave_type_color }}
                  />
                  <span className="text-[11px] text-gray-600 truncate">
                    {b.leave_type_name}
                  </span>
                </div>
                <div className="text-lg font-bold text-gray-900 tabular-nums">
                  {b.remaining_days.toFixed(1)}
                  <span className="text-xs font-normal text-gray-500 ml-1">
                    / {b.total_days.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Org context */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Reports To
          </h4>
          {manager ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center flex-shrink-0">
                {manager.first_name[0]}
                {manager.last_name[0]}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-gray-900 truncate">
                  {manager.first_name} {manager.last_name}
                </div>
                {manager.job_title && (
                  <div className="text-[11px] text-gray-500 truncate">
                    {manager.job_title}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500">No manager assigned</p>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Direct Reports ({direct_reports.length})
          </h4>
          {direct_reports.length === 0 ? (
            <p className="text-xs text-gray-500">No direct reports</p>
          ) : (
            <div className="space-y-2">
              {direct_reports.slice(0, 4).map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-[12px]">
                  <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[9px] font-semibold flex items-center justify-center flex-shrink-0">
                    {r.first_name[0]}
                    {r.last_name[0]}
                  </div>
                  <span className="text-gray-700 truncate">
                    {r.first_name} {r.last_name}
                  </span>
                </div>
              ))}
              {direct_reports.length > 4 && (
                <div className="text-[11px] text-gray-500">
                  +{direct_reports.length - 4} more
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-[13px] text-gray-900 capitalize">{value}</div>
    </div>
  );
}