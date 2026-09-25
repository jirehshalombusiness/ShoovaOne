import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { hrService } from '@/services/hr.service';
import { Inbox, Users, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

export function ExecutiveHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Live count of pending approvals assigned to me
  const { data: approvalStats } = useQuery({
    queryKey: ['hr', 'approvals', 'stats', 'me'],
    queryFn: () => hrService.getMyApprovalStats(),
    refetchInterval: 60_000,
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const pendingCount = approvalStats?.pending ?? 0;

  return (
    <div className="border-b border-gray-200 pb-5">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        {/* Left: greeting */}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">
            Executive Overview
          </p>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5 truncate">
            {greeting}, {user?.first_name || 'there'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Here's what's happening across Shoova today.
          </p>
        </div>

        {/* Right: date + quick actions */}
        <div className="flex flex-col items-end gap-3">
          <div className="text-right">
            <p className="text-sm text-gray-700 font-medium">
              {format(new Date(), 'EEEE, d MMMM yyyy')}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Updated {format(new Date(), 'h:mm a')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/hr/approvals')}
              className="relative flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Inbox className="w-3.5 h-3.5" />
              Approvals
              {pendingCount > 0 && (
                <span className="ml-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-amber-500 text-white text-[10px] font-bold rounded-full">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => navigate('/hr/employees')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Employees
            </button>

            <button
              onClick={() => navigate('/hr/time-off')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Time Off
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}