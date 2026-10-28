import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { eventsService, type EventSummary } from '@/services/events.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import {
  CalendarDays,
  CalendarPlus,
  Clock,
  FileText,
  History,
  Plus,
} from 'lucide-react';

export function EventsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const access = useHRAccess();

  const canCreate = access.has('events.create');
  const canManage = access.has('events.edit');

  const { data: upcomingEvents } = useQuery<EventSummary[]>({
    queryKey: ['events', 'sidebar-upcoming'],
    queryFn: () => eventsService.list({ window: 'upcoming', limit: 50 }),
    refetchInterval: 2 * 60_000,
  });

  const sections = [
    {
      items: [
        { icon: CalendarDays, label: 'Upcoming', path: '/events', exact: true },
        { icon: Clock, label: 'Today', path: '/events/today' },
        { icon: History, label: 'Past', path: '/events/past' },
        ...(canManage
          ? [{ icon: FileText, label: 'Drafts', path: '/events/drafts' }]
          : []),
      ],
    },
  ];

  const upcomingCount = upcomingEvents?.length ?? 0;

  return (
    <div className="flex gap-6 min-h-[calc(100vh-56px)]">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0 border-r border-gray-200 bg-white -ml-6 pl-4 pr-2">
        <div className="py-5 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900 tracking-tight">
            Events
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Organise & attend
          </p>

          {canCreate && (
            <button
              onClick={() => navigate('/events/new')}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-[12px] font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Event
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 pr-2">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active =
                  location.pathname === item.path ||
                  (item.path !== '/events' &&
                    location.pathname.startsWith(`${item.path}/`));

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
                    {item.path === '/events' && upcomingCount > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-white tabular-nums flex-shrink-0">
                        {upcomingCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-gray-100 py-3 pr-2">
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <CalendarPlus className="w-3.5 h-3.5" />
            <span>RSVP from any event</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
