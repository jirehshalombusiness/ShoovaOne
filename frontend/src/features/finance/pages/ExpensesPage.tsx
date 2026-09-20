import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';

import { expenseService } from '../expense.service';
import type { Expense, ExpenseStatus } from '../expense.types';

const STATUS_OPTIONS: Array<{
  value: ExpenseStatus;
  label: string;
}> = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid', label: 'Paid' },
  { value: 'reconciled', label: 'Reconciled' },
];

const STATUS_STYLES: Record<ExpenseStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-blue-50 text-blue-700',
  under_review: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  paid: 'bg-violet-50 text-violet-700',
  reconciled: 'bg-teal-50 text-teal-700',
};

const formatStatus = (status: ExpenseStatus) =>
  status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: currency || 'GHS',
    minimumFractionDigits: 2,
  }).format(amount);

const formatDate = (date?: string | null) => {
  if (!date) return '—';

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ExpenseStatus | ''>('');
  const [category, setCategory] = useState('');

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadExpenses = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const data = await expenseService.getExpenses({
        status: status || undefined,
        category: category || undefined,
        search: search.trim() || undefined,
        page,
        page_size: pageSize,
      });

      setExpenses(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load expenses:', err);

      const message =
        err?.response?.data?.detail ||
        'Unable to load expenses. Please try again.';

      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [status, category, page]);

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return expenses;
    }

    return expenses.filter((expense) => {
      return (
        expense.expense_number.toLowerCase().includes(query) ||
        expense.title.toLowerCase().includes(query) ||
        expense.category?.toLowerCase().includes(query) ||
        expense.vendor_name?.toLowerCase().includes(query) ||
        expense.reference?.toLowerCase().includes(query)
      );
    });
  }, [expenses, search]);

  const categories = useMemo(() => {
    const unique = new Set<string>();

    expenses.forEach((expense) => {
      if (expense.category) {
        unique.add(expense.category);
      }
    });

    return Array.from(unique).sort();
  }, [expenses]);

  const totalAmount = useMemo(
    () =>
      filteredExpenses.reduce(
        (total, expense) => total + Number(expense.amount || 0),
        0
      ),
    [filteredExpenses]
  );

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    loadExpenses();
  };

  const handleStatusChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setStatus(event.target.value as ExpenseStatus | '');
    setPage(1);
  };

  const handleCategoryChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setCategory(event.target.value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setCategory('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Finance</span>
            <span>/</span>
            <span>Expenditure</span>
            <span>/</span>
            <span className="text-slate-700">Expenses</span>
          </div>

          <div className="mt-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Expenses
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Review, track, approve and reconcile organisational
              expenditure.
            </p>
          </div>
        </div>

        <Link
          to="/finance/expenses/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          New Expense
        </Link>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 p-2">
              <FileText className="h-5 w-5 text-slate-600" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Expenses in View
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {filteredExpenses.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2">
              <FileText className="h-5 w-5 text-amber-600" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Current Page Value
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {formatAmount(
                  totalAmount,
                  filteredExpenses[0]?.currency || 'GHS'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2">
              <ArrowUpRight className="h-5 w-5 text-emerald-600" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Active Filters
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {[search, status, category].filter(Boolean).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <form
            onSubmit={handleSearchSubmit}
            className="flex min-w-0 flex-1"
          >
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search expense number, title, vendor..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>
          </form>

          <select
            value={status}
            onChange={handleStatusChange}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          >
            <option value="">All statuses</option>

            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={category}
            onChange={handleCategoryChange}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          >
            <option value="">All categories</option>

            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          {(search || status || category) && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Clear
            </button>
          )}

          <button
            type="button"
            onClick={() => loadExpenses(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing ? 'animate-spin' : ''
              }`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

          <div>
            <p className="text-sm font-medium text-red-800">
              Unable to load expenses
            </p>

            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="space-y-4 p-6">
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="h-12 animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <div className="rounded-full bg-slate-100 p-4">
              <FileText className="h-7 w-7 text-slate-500" />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No expenses found
            </h3>

            <p className="mt-1 max-w-md text-sm text-slate-500">
              {search || status || category
                ? 'Try adjusting your filters or search terms.'
                : 'There are no expense records available yet.'}
            </p>

            {search || status || category ? (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 text-sm font-medium text-slate-900 underline underline-offset-4"
              >
                Clear filters
              </button>
            ) : (
              <Link
                to="/finance/expenses/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Create first expense
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Expense
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Category
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Vendor
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Amount
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Incurred
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <div>
                          <Link
                            to={`/finance/expenses/${expense.id}`}
                            className="text-sm font-semibold text-slate-900 hover:text-slate-700"
                          >
                            {expense.title}
                          </Link>

                          <p className="mt-1 text-xs text-slate-500">
                            {expense.expense_number}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {expense.category || '—'}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {expense.vendor_name || '—'}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-semibold text-slate-900">
                          {formatAmount(
                            Number(expense.amount),
                            expense.currency
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(expense.incurred_date)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            STATUS_STYLES[expense.status]
                          }`}
                        >
                          {formatStatus(expense.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Link
                          to={`/finance/expenses/${expense.id}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
                        >
                          View
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
              <p className="text-sm text-slate-500">
                Showing {filteredExpenses.length} expense
                {filteredExpenses.length === 1 ? '' : 's'}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>

                <span className="px-2 text-sm font-medium text-slate-700">
                  Page {page}
                </span>

                <button
                  type="button"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={filteredExpenses.length < pageSize}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}