import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import {
  LayoutDashboard,
  GitBranch,
  Building2,
  Users,
  TrendingUp,
} from 'lucide-react';

const CRM_TABS = [
  { icon: LayoutDashboard, label: 'Overview', path: '/crm', exact: true },
  { icon: GitBranch, label: 'Pipeline', path: '/crm/pipeline' },
  { icon: Building2, label: 'Organisations', path: '/crm/organisations' },
  { icon: Users, label: 'Contacts', path: '/crm/contacts' },
  { icon: TrendingUp, label: 'Reports', path: '/crm/reports' },
];

export function CrmLayout() {
  const location = useLocation();
  const { hasPermission } = usePermissions();

  if (!hasPermission('crm.view')) {
    return <Navigate to="/dashboard" replace />;
  }

  const isActive = (tab: typeof CRM_TABS[0]) => {
    if (tab.exact) return location.pathname === tab.path;
    return (
      location.pathname === tab.path ||
      location.pathname.startsWith(`${tab.path}/`)
    );
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          CRM
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Partnerships, grants, and funding pipeline
        </p>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1 overflow-x-auto -mb-px">
          {CRM_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab);
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.exact}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium',
                  'transition-colors border-b-2 whitespace-nowrap',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300',
                )}
              >
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                {tab.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="w-full">
        <Outlet />
      </div>
    </div>
  );
}
