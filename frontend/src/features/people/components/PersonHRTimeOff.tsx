import { Calendar } from 'lucide-react';
import type { EmployeeDetail } from '@/services/hr.service';

interface Props {
  employee: EmployeeDetail | undefined;
  isLoading: boolean;
  canEdit: boolean;
}

export function PersonHRTimeOff({ employee, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!employee || employee.leave_balances.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
        <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-700">No leave balances</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {employee.leave_balances.map((b) => {
        const usedPct =
          b.total_days > 0 ? (b.used_days / b.total_days) * 100 : 0;
        const pendingPct =
          b.total_days > 0 ? (b.pending_days / b.total_days) * 100 : 0;

        return (
          <div key={b.id} className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: b.leave_type_color }}
              />
              <span className="text-[13px] font-medium text-gray-700">
                {b.leave_type_name}
              </span>
              <span className="text-[10px] text-gray-400 ml-auto">{b.year}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums">
              {b.remaining_days.toFixed(1)}
              <span className="text-sm font-normal text-gray-500 ml-1">left</span>
            </div>
            <div className="mt-3 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, usedPct)}%`,
                  backgroundColor: b.leave_type_color,
                }}
              />
              <div
                className="h-full bg-amber-400"
                style={{ width: `${Math.min(100, pendingPct)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1.5">
              <span>{b.used_days.toFixed(1)} used</span>
              <span>{b.total_days.toFixed(1)} total</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}