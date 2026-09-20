import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { HR_TABS, type NavItem } from '@/app/nav.config';
import { useHRAccess } from '@/hooks/useHRAccess';

// Which permission each HR tab requires.
// If the user lacks it, the tab is hidden.
const TAB_PERMISSIONS: Record<string, string | string[] | undefined> = {
  '/hr': undefined,
  '/hr/approvals': 'hr.view_leave',
  '/hr/employees': 'hr.view_sensitive',
  '/hr/time-off': 'hr.view_leave',
  '/hr/celebrations': 'hr.view_sensitive',
  '/hr/documents': 'hr.view_sensitive',
  '/hr/compensation': 'hr.view_compensation',
  '/hr/reports': 'hr.view_sensitive',
  '/hr/settings': 'hr.view_sensitive',
};

export function HRLayout() {
  const location = useLocation();
  const access = useHRAccess();

  // If the user has no HR permissions at all, send them home.
  if (!access.canAccessHRAdmin) {
    return <Navigate to="/me" replace />;
  }

  const visibleTabs = HR_TABS.filter((tab) => {
    const required = TAB_PERMISSIONS[tab.path];
    if (!required) return true;
    return access.has(required);
  });

  const isActive = (tab: NavItem) => {
    if (tab.exact) return location.pathname === tab.path;
    return (
      location.pathname === tab.path ||
      location.pathname.startsWith(`${tab.path}/`)
    );
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          HR Administration
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          People, employment, time off, and organisational records
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1 overflow-x-auto -mb-px">
          {visibleTabs.map((tab) => {
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

      {/* Content */}
      <div className="w-full">
        <Outlet />
      </div>
    </div>
  );
}