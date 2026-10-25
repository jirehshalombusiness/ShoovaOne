import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeDollarSign,
  Banknote,
  BarChart3,
  CalendarRange,
  Plus,
  Settings2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHRAccess } from '@/hooks/useHRAccess';
import { payrollService } from './payroll.service';
import { formatMoney, formatNumber } from './payroll.utils';

type PayrollNavItem = {
  label: string;
  path: string;
  exact?: boolean;
  permission: string[];
  icon: React.ElementType;
};

type PayrollNavSection = {
  label?: string;
  items: PayrollNavItem[];
};

const PAYROLL_SECTIONS: PayrollNavSection[] = [
  {
    items: [
      {
        label: 'Overview',
        path: '/payroll',
        exact: true,
        permission: [
          'payroll.view_all',
          'payroll.prepare',
          'payroll.review_hr',
          'payroll.review_finance',
          'payroll.approve',
          'payroll.disburse',
          'payroll.reports',
        ],
        icon: BadgeDollarSign,
      },
      {
        label: 'Pay Runs',
        path: '/payroll/runs',
        permission: [
          'payroll.view_all',
          'payroll.prepare',
          'payroll.review_hr',
          'payroll.review_finance',
          'payroll.approve',
        ],
        icon: CalendarRange,
      },
      {
        label: 'Employee Pay',
        path: '/payroll/people',
        permission: ['payroll.view_all', 'payroll.prepare', 'payroll.config'],
        icon: Users,
      },
    ],
  },
  {
    label: 'Payments',
    items: [
      {
        label: 'Disbursements',
        path: '/payroll/disbursements',
        permission: [
          'payroll.view_all',
          'payroll.disburse',
          'payroll.review_finance',
          'payroll.approve',
        ],
        icon: Banknote,
      },
      {
        label: 'Reports',
        path: '/payroll/reports',
        permission: ['payroll.reports'],
        icon: BarChart3,
      },
    ],
  },
  {
    label: 'Setup',
    items: [
      {
        label: 'Configuration',
        path: '/payroll/config',
        permission: ['payroll.config'],
        icon: Settings2,
      },
    ],
  },
];

export function PayrollLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const access = useHRAccess();

  const sections = PAYROLL_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => access.has(item.permission)),
  })).filter((section) => section.items.length > 0);

  if (sections.length === 0) {
    return <Navigate to="/me" replace />;
  }

  const allItems = sections.flatMap((section) => section.items);
  const canPrepare = access.has(['payroll.prepare', 'payroll.config']);
  const canViewReports = access.has('payroll.reports');

  const { data: overview } = useQuery({
    queryKey: ['payroll', 'overview'],
    queryFn: () => payrollService.getOverview(),
    enabled: canViewReports,
    refetchInterval: 5 * 60_000,
  });

  const isActive = (item: PayrollNavItem) => {
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
            Payroll
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Salaries &amp; statutory
          </p>

          {canPrepare && (
            <button
              onClick={() => navigate('/payroll/runs')}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-[12px] font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Prepare Pay Run
            </button>
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
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {canViewReports && (
          <div className="border-t border-gray-100 p-3">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Awaiting Remittance
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold text-gray-900 tabular-nums">
                {formatNumber(overview?.pending_remittances.count ?? 0)}
              </span>
              <span className="text-[10px] text-gray-500">
                {overview?.pending_remittances.count === 1 ? 'scheme' : 'schemes'}
              </span>
            </div>
            <div className="mt-1">
              <span className="text-[11px] font-semibold text-primary tabular-nums">
                {formatMoney(overview?.pending_remittances.total ?? 0)}
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
