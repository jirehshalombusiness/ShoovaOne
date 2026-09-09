import { useQuery } from '@tanstack/react-query';
import { hrService } from '@/services/hr.service';
import { Calendar, Clock } from 'lucide-react';

interface LeaveBalancesProps {
  personId: string;
}

export function LeaveBalances({ personId }: LeaveBalancesProps) {
  const { data: balances, isLoading } = useQuery({
    queryKey: ['leave-balances', personId],
    queryFn: () => hrService.getLeaveBalances(personId),
    enabled: !!personId,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-16 bg-gray-200 rounded-lg" />
      </div>
    );
  }

  if (!balances || balances.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="h-8 w-8 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No leave balances</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {balances.map((balance) => (
        <div key={balance.id} className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-gray-900 capitalize">
                {balance.leave_type.replace('_', ' ')}
              </p>
              <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">Remaining</p>
                  <p className="font-semibold text-gray-900">{balance.remaining_days} days</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Used</p>
                  <p className="font-semibold text-gray-900">{balance.used_days} days</p>
                </div>
              </div>
              <div className="w-full h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{
                    width: `${balance.total_days > 0 ? Math.min(100, (balance.used_days / balance.total_days) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {balance.total_days} days total · {balance.year}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}