import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  Loader2,
  Receipt,
} from 'lucide-react';

import { financeService } from '../finance.service';
import { expenseService } from '../expense.service';

import type {
  FundRequest,
  FundRequestStatus,
} from '../finance.types';

import type {
  Expense,
  ExpenseStatus,
} from '../expense.types';

type ApprovalItem = {
  id: string;
  type: 'Fund Request' | 'Expense';
  reference: string;
  title: string;
  amount: number;
  currency: string;
  status: FundRequestStatus | ExpenseStatus;
  submittedAt?: string | null;
  href: string;
};

type Filter =
  | 'all'
  | 'review'
  | 'approval'
  | 'fund_requests'
  | 'expenses';

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date?: string | null) {
  if (!date) return '—';

  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'submitted':
      return 'Submitted';
    case 'under_review':
      return 'Under Review';
    default:
      return status.replace('_', ' ');
  }
}

function getStatusClasses(status: string) {
  switch (status) {
    case 'submitted':
      return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200';

    case 'under_review':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200';

    default:
      return 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200';
  }
}

function getActionLabel(status: string) {
  return status === 'submitted' ? 'Review' : 'Approve';
}

export function ApprovalsPage() {
  const [fundRequests, setFundRequests] = useState<FundRequest[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadApprovals() {
      try {
        setLoading(true);
        setError(null);

        const [
          submittedFundRequests,
          reviewFundRequests,
          submittedExpenses,
          reviewExpenses,
        ] = await Promise.all([
          financeService.getFundRequests({
            status: 'submitted',
          }),

          financeService.getFundRequests({
            status: 'under_review',
          }),

          expenseService.getExpenses({
            status: 'submitted',
          }),

          expenseService.getExpenses({
            status: 'under_review',
          }),
        ]);

        if (!mounted) return;

        setFundRequests([
          ...submittedFundRequests,
          ...reviewFundRequests,
        ]);

        setExpenses([
          ...submittedExpenses,
          ...reviewExpenses,
        ]);
      } catch (err) {
        console.error('Failed to load finance approvals:', err);

        if (mounted) {
          setError(
            'Unable to load approval items. Please try again.'
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadApprovals();

    return () => {
      mounted = false;
    };
  }, []);

  const items = useMemo<ApprovalItem[]>(() => {
    const fundItems: ApprovalItem[] = fundRequests.map((request) => ({
      id: request.id,
      type: 'Fund Request',
      reference: request.request_number,
      title: request.title,
      amount: request.amount_requested,
      currency: request.currency,
      status: request.status,
      submittedAt: request.submitted_at,
      href: `/finance/fund-requests/${request.id}`,
    }));

    const expenseItems: ApprovalItem[] = expenses.map((expense) => ({
      id: expense.id,
      type: 'Expense',
      reference: expense.expense_number,
      title: expense.title,
      amount: expense.amount,
      currency: expense.currency,
      status: expense.status,
      submittedAt: expense.submitted_at,
      href: `/finance/expenses/${expense.id}`,
    }));

    return [...fundItems, ...expenseItems].sort((a, b) => {
      const aDate = a.submittedAt
        ? new Date(a.submittedAt).getTime()
        : 0;

      const bDate = b.submittedAt
        ? new Date(b.submittedAt).getTime()
        : 0;

      return bDate - aDate;
    });
  }, [fundRequests, expenses]);

  const counts = useMemo(() => {
    const review = items.filter(
      (item) => item.status === 'submitted'
    ).length;

    const approval = items.filter(
      (item) => item.status === 'under_review'
    ).length;

    const fundRequestsCount = items.filter(
      (item) => item.type === 'Fund Request'
    ).length;

    const expensesCount = items.filter(
      (item) => item.type === 'Expense'
    ).length;

    return {
      all: items.length,
      review,
      approval,
      fundRequests: fundRequestsCount,
      expenses: expensesCount,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    switch (filter) {
      case 'review':
        return items.filter(
          (item) => item.status === 'submitted'
        );

      case 'approval':
        return items.filter(
          (item) => item.status === 'under_review'
        );

      case 'fund_requests':
        return items.filter(
          (item) => item.type === 'Fund Request'
        );

      case 'expenses':
        return items.filter(
          (item) => item.type === 'Expense'
        );

      default:
        return items;
    }
  }, [filter, items]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
            <FileCheck2 className="h-5 w-5" />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Finance
            </p>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Approvals
            </h1>
          </div>
        </div>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          Review and process fund requests and expenses requiring
          financial approval.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setFilter('review')}
          className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>

            <span className="text-xs font-medium text-slate-400">
              Needs action
            </span>
          </div>

          <p className="mt-4 text-2xl font-semibold text-slate-900">
            {counts.review}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Needs Review
          </p>
        </button>

        <button
          type="button"
          onClick={() => setFilter('approval')}
          className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
            </div>

            <span className="text-xs font-medium text-slate-400">
              Decision
            </span>
          </div>

          <p className="mt-4 text-2xl font-semibold text-slate-900">
            {counts.approval}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Needs Approval
          </p>
        </button>

        <button
          type="button"
          onClick={() => setFilter('fund_requests')}
          className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
            <ClipboardCheck className="h-5 w-5 text-slate-600" />
          </div>

          <p className="mt-4 text-2xl font-semibold text-slate-900">
            {counts.fundRequests}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Fund Requests
          </p>
        </button>

        <button
          type="button"
          onClick={() => setFilter('expenses')}
          className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
            <Receipt className="h-5 w-5 text-slate-600" />
          </div>

          <p className="mt-4 text-2xl font-semibold text-slate-900">
            {counts.expenses}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Expenses
          </p>
        </button>
      </div>

      {/* Queue */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Pending Items
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Items currently awaiting review or approval.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              {[
                ['all', 'All'],
                ['review', 'Needs Review'],
                ['approval', 'Needs Approval'],
                ['fund_requests', 'Fund Requests'],
                ['expenses', 'Expenses'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value as Filter)}
                  className={[
                    'rounded-lg px-3 py-2 text-xs font-medium transition',
                    filter === value
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading approval items...
            </div>
          </div>
        ) : error ? (
          <div className="flex min-h-[280px] items-center justify-center px-6">
            <div className="text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-red-500" />

              <p className="mt-3 text-sm font-medium text-slate-900">
                Something went wrong
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {error}
              </p>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex min-h-[280px] items-center justify-center px-6">
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />

              <p className="mt-3 text-sm font-semibold text-slate-900">
                Nothing needs your attention
              </p>

              <p className="mt-1 text-sm text-slate-500">
                There are no pending items in this queue.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Type
                  </th>

                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Reference
                  </th>

                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Description
                  </th>

                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Amount
                  </th>

                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Submitted
                  </th>

                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Status
                  </th>

                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr
                    key={`${item.type}-${item.id}`}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-2">
                        {item.type === 'Fund Request' ? (
                          <ClipboardCheck className="h-4 w-4 text-slate-400" />
                        ) : (
                          <Receipt className="h-4 w-4 text-slate-400" />
                        )}

                        <span className="text-sm font-medium text-slate-700">
                          {item.type}
                        </span>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="font-mono text-xs font-semibold text-slate-600">
                        {item.reference}
                      </span>
                    </td>

                    <td className="max-w-xs px-5 py-4">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {item.title}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <span className="text-sm font-semibold text-slate-900">
                        {formatCurrency(
                          item.amount,
                          item.currency
                        )}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="text-sm text-slate-500">
                        {formatDate(item.submittedAt)}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={[
                          'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                          getStatusClasses(item.status),
                        ].join(' ')}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <Link
                        to={item.href}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                      >
                        {getActionLabel(item.status)}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}