import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Briefcase,
  FileText,
  Cake,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

const HR_TABS = [
  {
    icon: LayoutDashboard,
    label: 'Overview',
    path: '/hr',
    exact: true,
  },
  {
    icon: Users,
    label: 'Employees',
    path: '/hr/employees',
  },
  {
    icon: CalendarDays,
    label: 'Leave',
    path: '/hr/leave',
  },
  {
    icon: Briefcase,
    label: 'Recruitment',
    path: '/hr/recruitment',
  },
  {
    icon: FileText,
    label: 'Documents',
    path: '/hr/documents',
  },
  {
    icon: Cake,
    label: 'Celebrations',
    path: '/hr/celebrations',
  },
];

export function HRLayout() {
  const location = useLocation();

  return (
    <div className="space-y-5">
      {/* Tab Bar */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto -mb-px">
          {HR_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.exact
              ? location.pathname === tab.path
              : location.pathname.startsWith(tab.path);
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.exact}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                )}
              >
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                {tab.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Page content */}
      <Outlet />
    </div>
  );
}