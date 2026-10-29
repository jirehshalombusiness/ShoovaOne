import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Banknote,
  CalendarRange,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Landmark,
  Plus,
  Receipt,
  Settings2,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHRAccess } from '@/hooks/useHRAccess';
import { financeService } from '../finance.service';

type FinanceNavItem = {
  label: string;
  path: string;
  exact?: boolean;
  permission: string | string[];
  icon: React.ElementType;
};

type FinanceNavSection = {
  label?: string;
  items: FinanceNavItem[];
};

const FINANCE_SECTIONS: FinanceNavSection[] = [
  {
    items: [
      {
        label: 'Overview',
        path: '/finance',
        exact: true,
        permission: 'finance.view',
        icon: Landmark,
      },
    ],
  },
  {
    label: 'Fund Management',
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
      {
        label: 'Receipt Verification',
        path: '/finance/verification',
        permission: 'finance.verify',
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: 'Expenditure',
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
    label: 'Receivables',
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
    label: 'Planning',
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
    label: 'Payroll',
    items: [
      {
        label: 'Payroll Overview',
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
        icon: Wallet,
      },
      {
        label: 'Pay Runs',
        path: '/payroll/runs',
        permission: [
          'payroll.view_all',
          'payroll.prepare',
          'payroll.review_finance',
          'payroll.approve',
        ],
        icon: CalendarRange,
      },
      {
        label: 'Payroll Disbursements',
        path: '/payroll/disbursements',
        permission: [
          'payroll.disburse',
          'payroll.review_finance',
          'payroll.approve',
        ],
        icon: Banknote,
      },
      {
        label: 'Payroll Setup',
        path: '/payroll/config',
        permission: ['payroll.config'],
        icon: Settings2,
      },
    ],
  },
  {
    label: 'Reporting',
    items: [
      {
        label: 'Financial Reports',
        path: '/finance/reports',
        permission: 'finance.reports',
        icon: BarChart3,
      },
    ],
  },
];

export function FinanceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const access = useHRAccess();

  const sections = FINANCE_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => access.has(item.permission)),
  })).filter((section) => section.items.length > 0);

  const allItems = sections.flatMap((section) => section.items);
  const canCreate = access.has('finance.view');

  const { data: overview } = useQuery({
    queryKey: ['finance', 'sidebar-overview'],
    queryFn: () => financeService.getOverview(),
    enabled: access.has('finance.view'),
    refetchInterval: 5 * 60_000,
  });

  const isActive = (item: FinanceNavItem) => {
    if (item.exact) return location.pathname === item.path;
    return (
      location.pathname === item.path ||
      location.pathname.startsWith(`${item.path}/`)
    );
  };

  const pending = overview?.pending_fund_requests ?? 0;
  const receiptsToVerify =
    overview?.fund_requests_requiring_reconciliation ?? 0;

  return (
    <div className="flex gap-6 -m-4 lg:-m-6 min-h-[calc(100vh-56px)] lg:h-[calc(100vh-56px)] lg:min-h-0 lg:overflow-hidden">
      {/* Secondary sidebar */}
      <aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0 border-r border-gray-200 bg-white">
        <div className="px-4 py-5 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900 tracking-tight">
            Finance
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Funds &amp; reporting
          </p>

          {canCreate && (
            <button
              onClick={() => navigate('/me/finance/new')}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-[12px] font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New claim
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

        {access.has('finance.view') && (
          <div className="border-t border-gray-100 p-3">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Pending Requests
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold text-gray-900 tabular-nums">
                {pending}
              </span>
              <span className="text-[10px] text-gray-500">
                awaiting approval
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  receiptsToVerify > 0 ? 'bg-amber-500' : 'bg-emerald-500',
                )}
              />
              <span
                className={cn(
                  'text-[11px] font-medium',
                  receiptsToVerify > 0 ? 'text-amber-700' : 'text-gray-500',
                )}
              >
                {receiptsToVerify > 0
                  ? `${receiptsToVerify} receipt${
                      receiptsToVerify === 1 ? '' : 's'
                    } to verify`
                  : 'All receipts verified'}
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
