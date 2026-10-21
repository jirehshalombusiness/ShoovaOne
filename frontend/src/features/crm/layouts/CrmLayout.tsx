import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { crmService } from '@/services/crm.service';
import {
  LayoutDashboard,
  GitBranch,
  Building2,
  Users,
  TrendingUp,
  Plus,
  ChevronRight,
} from 'lucide-react';

const CRM_SECTIONS = [
  {
    items: [
      { icon: LayoutDashboard, label: 'Overview', path: '/crm', exact: true },
      { icon: GitBranch, label: 'Pipeline', path: '/crm/pipeline' },
    ],
  },
  {
    label: 'Directory',
    items: [
      { icon: Building2, label: 'Organisations', path: '/crm/organisations' },
      { icon: Users, label: 'Contacts', path: '/crm/contacts' },
    ],
  },
  {
    label: 'Analysis',
    items: [{ icon: TrendingUp, label: 'Reports', path: '/crm/reports' }],
  },
];

export function CrmLayout() {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('crm.create');

  if (!hasPermission('crm.view')) {
    return <Navigate to="/dashboard" replace />;
  }

  // Live pipeline summary — shows at the bottom of the sidebar
  const { data } = useQuery({
    queryKey: ['crm', 'sidebar-stats'],
    queryFn: () => crmService.listOpportunities({ open_only: true, limit: 500 }),
    refetchInterval: 5 * 60_000,
  });

  const isActive = (item: (typeof CRM_SECTIONS)[0]['items'][0]) => {
    if ('exact' in item && item.exact) {
      return location.pathname === item.path;
    }
    return (
      location.pathname === item.path ||
      location.pathname.startsWith(`${item.path}/`)
    );
  };

  const openCount = data?.open_count ?? 0;
  const openValue = data?.open_value ?? 0;

  return (
    <div className="flex gap-6 -m-4 lg:-m-6 min-h-[calc(100vh-56px)]">
      {/* Secondary sidebar */}
      <aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0 border-r border-gray-200 bg-white">
        {/* Brand / header */}
        <div className="px-4 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-gray-900 tracking-tight">
                CRM
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Pipeline & partnerships
              </p>
            </div>
          </div>

          {/* Quick create */}
          {canCreate && (
            <button
              onClick={() => window.location.assign('/crm/opportunities/new')}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-[12px] font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Opportunity
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {CRM_SECTIONS.map((section, idx) => (
            <div key={idx} className={cn(idx > 0 && 'mt-4')}>
              {section.label && (
                <div className="px-3 mb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={'exact' in item ? Boolean(item.exact) : undefined}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors',
                        active
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Live stats footer */}
        <div className="border-t border-gray-100 p-3">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Open Pipeline
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-gray-900 tabular-nums">
              {openCount}
            </span>
            <span className="text-[10px] text-gray-500">opportunities</span>
          </div>
          <div className="mt-1">
            <span className="text-[11px] font-semibold text-primary tabular-nums">
              GHS{' '}
              {openValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile nav — horizontal, only shows on small screens */}
      <div className="lg:hidden fixed bottom-14 left-0 right-0 z-20 border-t border-gray-200 bg-white">
        <nav className="flex overflow-x-auto">
          {CRM_SECTIONS.flatMap((s) => s.items).map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={'exact' in item ? Boolean(item.exact) : undefined}
                className={cn(
                  'flex-1 min-w-[72px] flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-gray-500',
                )}
              >
                <Icon
                  className="w-4 h-4"
                  strokeWidth={active ? 2.25 : 1.75}
                />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <main className="flex-1 min-w-0 py-4 lg:py-6 pr-4 lg:pr-6 pb-24 lg:pb-6">
        <Outlet />
      </main>
    </div>
  );
}