import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import {
  BarChart3,
  Banknote,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Landmark,
  Receipt,
  ShieldCheck,
} from 'lucide-react';

type FinanceNavItem = {
  label: string;
  path: string;
  permission: string;
  icon: React.ElementType;
};

type FinanceNavSection = {
  title: string;
  items: FinanceNavItem[];
};

const sections: FinanceNavSection[] = [
  {
    title: 'Finance',
    items: [
      {
        label: 'Overview',
        path: '/finance',
        permission: 'finance.view',
        icon: Landmark,
      },
    ],
  },
  {
    title: 'Fund Management',
    items: [
      {
        label: 'Fund Requests',
        path: '/finance/fund-requests',
        permission: 'finance.view',
        icon: FileText,
      },
      {
        label: 'Approvals',
        path: '/finance/approvals',
        permission: 'finance.approve',
        icon: FileCheck2,
      },
      {
        label: 'Disbursements',
        path: '/finance/disbursements',
        permission: 'finance.disburse',
        icon: Banknote,
      },
    ],
  },
  {
    title: 'Expenditure',
    items: [
      {
        label: 'Expenses',
        path: '/finance/expenses',
        permission: 'finance.view',
        icon: Receipt,
      },
      {
        label: 'Reimbursements',
        path: '/finance/reimbursements',
        permission: 'finance.view',
        icon: ClipboardCheck,
      },
    ],
  },
  {
    title: 'Receivables',
    items: [
      {
        label: 'Invoices',
        path: '/finance/invoices',
        permission: 'finance.view',
        icon: FileText,
      },
      {
        label: 'Payments',
        path: '/finance/payments',
        permission: 'finance.view',
        icon: Banknote,
      },
    ],
  },
  {
    title: 'Planning',
    items: [
      {
        label: 'Budgets',
        path: '/finance/budgets',
        permission: 'finance.view',
        icon: BarChart3,
      },
      {
        label: 'Allocations',
        path: '/finance/allocations',
        permission: 'finance.view',
        icon: ClipboardCheck,
      },
    ],
  },
  {
    title: 'Reporting',
    items: [
      {
        label: 'Financial Reports',
        path: '/finance/reports',
        permission: 'finance.reports',
        icon: BarChart3,
      },
      {
        label: 'Reconciliation',
        path: '/finance/reconciliation',
        permission: 'finance.reconcile',
        icon: ClipboardCheck,
      },
    ],
  },
  {
    title: 'Governance',
    items: [
      {
        label: 'Financial Audit Trail',
        path: '/finance/audit-trail',
        permission: 'finance.audit_view',
        icon: ShieldCheck,
      },
    ],
  },
];

export function FinanceLayout() {
  const { user } = useAuth();

  const permissions = user?.permissions ?? [];

  const hasPermission = (permission: string) =>
    permissions.includes(permission);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Finance navigation */}
      <aside className="w-full shrink-0 lg:w-64">
        <div className="sticky top-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Module header */}
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                <Landmark className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Module
                </p>

                <h1 className="text-lg font-semibold text-slate-900">
                  Finance
                </h1>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Financial management, expenditure, reporting, and governance.
            </p>
          </div>

          {/* Navigation */}
          <nav className="p-3">
            {sections.map((section) => {
              const visibleItems = section.items.filter((item) =>
                hasPermission(item.permission)
              );

              if (visibleItems.length === 0) {
                return null;
              }

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
                          end={item.path === '/finance'}
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

      {/* Finance page content */}
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}