import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  CalendarDays,
  Laptop,
  FileText,
  FileSignature,
  Users,
  Inbox,
  Briefcase,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

const PERSONAL_TABS = [
  { icon: Home, label: 'Home', path: '/hr', exact: true },
  { icon: CalendarDays, label: 'Time Off', path: '/hr/time-off' },
  { icon: Laptop, label: 'Devices', path: '/hr/devices' },
  { icon: FileSignature, label: 'Contract', path: '/hr/contract' },
  { icon: FileText, label: 'Documents', path: '/hr/documents' },
];

const ADMIN_TABS = [
  { icon: Users, label: 'Employees', path: '/hr/employees' },
  { icon: Inbox, label: 'Leave Requests', path: '/hr/leave-requests' },
  { icon: Briefcase, label: 'Recruitment', path: '/hr/recruitment' },
  { icon: BarChart3, label: 'Reports', path: '/hr/reports' },
];

export function HRLayout() {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const isAdmin = hasPermission('hr.view_sensitive');

  const renderTab = (tab: any) => {
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
  };

  return (
    <div className="space-y-5">
      {/* Personal tab bar */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto -mb-px">
          {PERSONAL_TABS.map(renderTab)}
        </nav>
      </div>

      {/* Admin sub-section */}
      {isAdmin && (
        <div className="border-b border-gray-200">
          <div className="px-1 pb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Manage
            </span>
          </div>
          <nav className="flex gap-1 overflow-x-auto -mb-px">
            {ADMIN_TABS.map(renderTab)}
          </nav>
        </div>
      )}

      <Outlet />
    </div>
  );
}