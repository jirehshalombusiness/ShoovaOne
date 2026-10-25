import { NavLink, Outlet, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Inbox,
  Users,
  CalendarDays,
  Award,
  FileText,
  DollarSign,
  BarChart3,
  Settings,
  Plus,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/app/nav.config';
import { useHRAccess } from '@/hooks/useHRAccess';
import { hrService } from '@/services/hr.service';

// Which permission each HR section requires.
const SECTION_PERMISSIONS: Record<string, string | string[] | undefined> = {
  '/hr': undefined,
  '/hr/approvals': 'hr.view_leave',
  '/hr/employees': 'hr.view_sensitive',
  '/hr/time-off': 'hr.view_leave',
  '/hr/timesheets': 'hr.view_sensitive',
  '/hr/celebrations': 'hr.view_sensitive',
  '/hr/documents': 'hr.view_sensitive',
  '/hr/compensation': 'hr.view_compensation',
  '/hr/reports': 'hr.view_sensitive',
  '/hr/settings': 'hr.view_sensitive',
};

interface HRSection {
  label?: string;
  items: NavItem[];
}

const HR_SECTIONS: HRSection[] = [
  {
    items: [
      { icon: LayoutDashboard, label: 'Overview', path: '/hr', exact: true },
      { icon: Inbox, label: 'Approvals', path: '/hr/approvals' },
    ],
  },
  {
    label: 'People',
    items: [
      { icon: Users, label: 'Employees', path: '/hr/employees' },
      { icon: CalendarDays, label: 'Time Off', path: '/hr/time-off' },
      { icon: Clock, label: 'Timesheets', path: '/hr/timesheets' },
      { icon: Award, label: 'Celebrations', path: '/hr/celebrations' },
    ],
  },
  {
    label: 'Records',
    items: [
      { icon: FileText, label: 'Documents', path: '/hr/documents' },
      { icon: DollarSign, label: 'Compensation', path: '/hr/compensation' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { icon: BarChart3, label: 'Reports', path: '/hr/reports' },
      { icon: Settings, label: 'Settings', path: '/hr/settings' },
    ],
  },
];

export function HRLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const access = useHRAccess();

  if (!access.canAccessHRAdmin) {
    return <Navigate to="/me" replace />;
  }

  const sections = HR_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      const required = SECTION_PERMISSIONS[item.path];
      if (!required) return true;
      return access.has(required);
    }),
  })).filter((section) => section.items.length > 0);

  const allItems = sections.flatMap((section) => section.items);

  // Live queue summary for the sidebar footer.
  const { data: overview } = useQuery({
    queryKey: ['hr', 'approvals', 'overview'],
    queryFn: () => hrService.getApprovalOverview(),
    enabled: access.canViewLeave,
    refetchInterval: 2 * 60_000,
  });

  const pending = overview?.pending ?? 0;
  const overdue = overview?.overdue ?? 0;
  const canAddEmployee = access.has('people.create');

  const isActive = (item: NavItem) => {
    if (item.exact) return location.pathname === item.path;
    return (
      location.pathname === item.path ||
      location.pathname.startsWith(`${item.path}/`)
    );
  };

  return (
    <div className="flex gap-6 -m-4 lg:-m-6 min-h-[calc(100vh-56px)] lg:h-[calc(100vh-56px)] lg:min-h-0 lg:overflow-hidden">
      {/* Secondary sidebar */}
      <aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0 border-r border-gray-200 bg-white">
        <div className="px-4 py-5 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900 tracking-tight">
            HR
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            People &amp; compliance
          </p>

          {canAddEmployee ? (
            <button
              onClick={() => navigate('/people/new')}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-[12px] font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Employee
            </button>
          ) : (
            access.canViewLeave && (
              <button
                onClick={() => navigate('/hr/approvals')}
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-[12px] font-medium hover:bg-primary-dark transition-colors"
              >
                <Inbox className="w-3.5 h-3.5" />
                Review Queue
              </button>
            )
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {sections.map((section, idx) => (
            <div key={section.label ?? 'workspace'} className={cn(idx > 0 && 'mt-4')}>
              {section.label && (
                <div className="px-3 mb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  const badge =
                    item.path === '/hr/approvals' && pending > 0
                      ? pending
                      : null;

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.exact}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors',
                        active
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                      <span className="flex-1">{item.label}</span>
                      {badge !== null && (
                        <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold tabular-nums">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {access.canViewLeave && (
          <div className="border-t border-gray-100 p-3">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Approval Queue
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold text-gray-900 tabular-nums">
                {pending}
              </span>
              <span className="text-[10px] text-gray-500">
                pending
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  overdue > 0 ? 'bg-red-500' : 'bg-emerald-500',
                )}
              />
              <span
                className={cn(
                  'text-[11px] font-medium',
                  overdue > 0 ? 'text-red-600' : 'text-gray-500',
                )}
              >
                {overdue > 0 ? `${overdue} past SLA` : 'All within SLA'}
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile nav */}
      <div className="lg:hidden fixed bottom-14 left-0 right-0 z-20 border-t border-gray-200 bg-white">
        <nav className="flex overflow-x-auto">
          {allItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                className={cn(
                  'flex-1 min-w-[72px] flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-gray-500',
                )}
              >
                <Icon className="w-4 h-4" strokeWidth={active ? 2.25 : 1.75} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <main className="flex-1 min-w-0 py-4 lg:py-6 pr-4 lg:pr-6 pb-24 lg:pb-6 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
        <Outlet />
      </main>
    </div>
  );
}
