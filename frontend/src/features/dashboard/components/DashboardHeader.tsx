import { User } from '@/types/user.types';
import { format } from 'date-fns';

interface DashboardHeaderProps {
  user: User | null;
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="border-b border-gray-200 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">
            Executive Overview
          </p>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
            {getGreeting()}, {user?.first_name || 'User'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Here's what's happening across SHOOVA today.
          </p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Last updated: {format(new Date(), 'h:mm a')}
          </p>
        </div>
      </div>
    </div>
  );
}