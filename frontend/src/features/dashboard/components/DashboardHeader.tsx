import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useHRAccess } from '@/hooks/useHRAccess';
import { myWorkService } from '@/services/mywork.service';
import { Avatar } from '@/components/ui/Avatar';
import {
  CalendarPlus,
  Clock,
  FolderPlus,
  Inbox,
  UserCircle2,
} from 'lucide-react';
import { format } from 'date-fns';

export function DashboardHeader() {
  const { user } = useAuth();
  const access = useHRAccess();
  const navigate = useNavigate();

  const { data: summary } = useQuery({
    queryKey: ['my-work', 'summary'],
    queryFn: () => myWorkService.getSummary(),
    refetchInterval: 60_000,
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const pendingApprovals = summary?.pending_approvals ?? 0;

  const actions: Array<{
    label: string;
    icon: React.ElementType;
    path: string;
    badge?: number;
  }> = [
    {
      label: 'Schedule meeting',
      icon: CalendarPlus,
      path: '/meetings/new',
    },
  ];

  if (access.has('timesheets.view')) {
    actions.push({
      label: 'Log time',
      icon: Clock,
      path: '/timesheets',
    });
  }

  if (access.has('projects.create')) {
    actions.push({
      label: 'New project',
      icon: FolderPlus,
      path: '/projects/new',
    });
  }

  actions.push({
    label: 'My HR',
    icon: UserCircle2,
    path: '/me',
  });

  actions.push({
    label: 'Approvals',
    icon: Inbox,
    path: '/me/approvals',
    badge: pendingApprovals,
  });

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-center gap-4 min-w-0">
        <Avatar
          firstName={user?.first_name}
          lastName={user?.last_name}
          imageUrl={user?.profile_image_url}
          size="xl"
          className="hidden sm:flex ring-4 ring-primary/5"
        />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">
            {user?.job_title || 'Your workspace'}
          </p>
          <h1 className="text-2xl font-bold text-gray-900 mt-0.5 truncate">
            {greeting}, {user?.first_name || 'there'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Here's your day at a glance — work, meetings and what needs you.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:items-end">
        <p className="text-sm font-medium text-gray-700">
          {format(new Date(), 'EEEE, d MMMM yyyy')}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <Icon className="w-3.5 h-3.5 text-gray-500" strokeWidth={1.75} />
                {action.label}
                {action.badge ? (
                  <span className="ml-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-amber-500 text-white text-[10px] font-bold rounded-full">
                    {action.badge > 99 ? '99+' : action.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
