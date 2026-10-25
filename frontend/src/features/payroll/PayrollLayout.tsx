import { Navigate, NavLink, Outlet } from 'react-router-dom';
import {
  BadgeDollarSign,
  Banknote,
  BarChart3,
  CalendarRange,
  Settings2,
  Users,
  Wallet,
} from 'lucide-react';
import { useHRAccess } from '@/hooks/useHRAccess';

type PayrollNavItem = {
  label: string;
  path: string;
  permission: string[];
  icon: React.ElementType;
};

type PayrollNavSection = {
  title: string;
  items: PayrollNavItem[];
};

const sections: PayrollNavSection[] = [
  {
    title: 'Payroll',
    items: [
      {
        label: 'Overview',
        path: '/payroll',
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
    title: 'Payments',
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
    title: 'Setup',
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
  const access = useHRAccess();

  const canAccessModule = sections.some((section) =>
    section.items.some((item) => access.has(item.permission)),
  );

  if (!canAccessModule) {
    return <Navigate to="/me" replace />;
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-64">
        <div className="sticky top-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                <Wallet className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Module
                </p>
                <h1 className="text-lg font-semibold text-slate-900">Payroll</h1>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Timesheets, salary calculation, statutory deductions, approvals and
              disbursement.
            </p>
          </div>

          <nav className="p-3">
            {sections.map((section) => {
              const visibleItems = section.items.filter((item) =>
                access.has(item.permission),
              );

              if (visibleItems.length === 0) return null;

              return (
                <div key={section.title} className="mb-5 last:mb-0">
                  <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {section.title}
                  </p>

                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          end={item.path === '/payroll'}
                          className={({ isActive }) =>
                            [
                              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                              isActive
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                            ].join(' ')
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <Icon
                                className={`h-4 w-4 shrink-0 ${
                                  isActive
                                    ? 'text-white'
                                    : 'text-slate-400 group-hover:text-slate-600'
                                }`}
                              />
                              <span>{item.label}</span>
                            </>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
