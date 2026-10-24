import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { meetingsService, type MeetingSummary } from '@/services/meetings.service';
import {
  CalendarDays,
  Clock,
  History,
  Plus,
  Video,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

const MEETING_SECTIONS = [
  {
    items: [
      { icon: CalendarDays, label: 'Upcoming', path: '/meetings', exact: true },
      { icon: Clock, label: 'Today', path: '/meetings/today' },
      { icon: History, label: 'Past', path: '/meetings/past' },
    ],
  },
];

export function MeetingsLayout() {
  const location = useLocation();

  // Sidebar count — upcoming meetings in the next 7 days
  const { data: weekMeetings } = useQuery<MeetingSummary[]>({
    queryKey: ['meetings', 'sidebar-week'],
    queryFn: () => meetingsService.list({ window: 'week', limit: 50 }),
    refetchInterval: 2 * 60_000,
  });

  const isActive = (item: (typeof MEETING_SECTIONS)[0]['items'][0]) => {
    if ('exact' in item && item.exact) {
      return location.pathname === item.path;
    }
    return (
      location.pathname === item.path ||
      location.pathname.startsWith(`${item.path}/`)
    );
  };

  const upcomingCount = weekMeetings?.length ?? 0;

  const { hasPermission } = usePermissions();

  if (!hasPermission('meetings.view')) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex gap-6 min-h-[calc(100vh-56px)]">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0 border-r border-gray-200 bg-white -ml-6 pl-4 pr-2">
        <div className="py-5 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900 tracking-tight">
            Meetings
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Schedule & join
          </p>

          <button
            onClick={() => window.location.assign('/meetings/new')}
            className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-[12px] font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Meeting
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 pr-2">
          {MEETING_SECTIONS.map((section, idx) => (
            <div key={idx}>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={'exact' in item ? item.exact : undefined}
                      className={cn(
                        'flex items-center justify-between gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors',
                        active
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className="w-4 h-4 flex-shrink-0"
                          strokeWidth={1.75}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.path === '/meetings' && upcomingCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-white tabular-nums flex-shrink-0">
                          {upcomingCount}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 py-3 pr-2">
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Video className="w-3.5 h-3.5" />
            <span>Video via Meet / Zoom</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}