import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ME_TABS, type NavItem } from '@/app/nav.config';

export function MeLayout() {
  const location = useLocation();

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
          My HR
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Your employment, time off, documents, and personal details
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1 overflow-x-auto -mb-px">
          {ME_TABS.map((tab) => {
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