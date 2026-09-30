import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { budgetService } from '../budget.service';
import type {
  Budget,
  BudgetListParams,
  BudgetStatus,
} from '../budget.types';

const statusStyles: Record<BudgetStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  closed: 'bg-purple-100 text-purple-700',
};

const statusLabels: Record<BudgetStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  active: 'Active',
  closed: 'Closed',
};

const formatAmount = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
};

const formatDate = (date: string) => {
  if (!date) return '—';

  return new Date(date).toLocaleDateString('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const BudgetsPage = () => {
  const navigate = useNavigate();

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BudgetStatus | ''>('');
  const [fiscalYear, setFiscalYear] = useState('');

  const loadBudgets = async () => {
    try {
      setLoading(true);
      setError('');

      const params: BudgetListParams = {};

      if (status) {
        params.status = status;
      }

      if (fiscalYear.trim()) {
        params.fiscal_year = fiscalYear.trim();
      }

      if (search.trim()) {
        params.search = search.trim();
      }

      const data = await budgetService.getBudgets(params);

      setBudgets(data);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to load budgets.';

      setError(
        Array.isArray(message)
          ? message.map((item) => item?.msg || String(item)).join(', ')
          : String(message),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, [status, fiscalYear]);

  const filteredBudgets = useMemo(() => {
    if (!search.trim()) {
      return budgets;
    }

    const query = search.trim().toLowerCase();

    return budgets.filter((budget) => {
      return (
        budget.name.toLowerCase().includes(query) ||
        budget.budget_number.toLowerCase().includes(query) ||
        budget.fiscal_year.toLowerCase().includes(query)
      );
    });
  }, [budgets, search]);

  const summary = useMemo(() => {
    return {
      total: budgets.length,
      draft: budgets.filter((budget) => budget.status === 'draft').length,
      submitted: budgets.filter(
        (budget) => budget.status === 'submitted',
      ).length,
      approved: budgets.filter(
        (budget) => budget.status === 'approved',
      ).length,
      active: budgets.filter((budget) => budget.status === 'active').length,
      closed: budgets.filter((budget) => budget.status === 'closed').length,
    };
  }, [budgets]);

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setFiscalYear('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>

          <p className="mt-1 text-sm text-gray-500">
            Create, manage, approve, and track organisational budgets.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/finance/budgets/new')}
          className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          <span className="mr-2 text-lg leading-none">+</span>
          New Budget
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Total
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {summary.total}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Draft
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-700">
            {summary.draft}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Submitted
          </p>
          <p className="mt-2 text-2xl font-bold text-yellow-600">
            {summary.submitted}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Approved
          </p>
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {summary.approved}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Active
          </p>
          <p className="mt-2 text-2xl font-bold text-green-600">
            {summary.active}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Closed
          </p>
          <p className="mt-2 text-2xl font-bold text-purple-600">
            {summary.closed}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label
              htmlFor="budget-search"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Search
            </label>

            <input
              id="budget-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  loadBudgets();
                }
              }}
              placeholder="Search by budget name or number..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />
          </div>

          {/* Status */}
          <div>
            <label
              htmlFor="budget-status"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Status
            </label>

            <select
              id="budget-status"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as BudgetStatus | '')
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Fiscal Year */}
          <div>
            <label
              htmlFor="budget-fiscal-year"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Fiscal Year
            </label>

            <input
              id="budget-fiscal-year"
              type="text"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              placeholder="e.g. 2026"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={loadBudgets}
            disabled={loading}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Loading...' : 'Apply Filters'}
          </button>

          {(search || status || fiscalYear) && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>

          <button
            type="button"
            onClick={loadBudgets}
            className="font-medium underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Budget Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Budget Register
              </h2>

              <p className="text-sm text-gray-500">
                {filteredBudgets.length}{' '}
                {filteredBudgets.length === 1 ? 'budget' : 'budgets'}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />

            <p className="mt-4 text-sm text-gray-500">
              Loading budgets...
            </p>
          </div>
        ) : filteredBudgets.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500">
              $
            </div>

            <h3 className="mt-4 text-base font-semibold text-gray-900">
              No budgets found
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              {search || status || fiscalYear
                ? 'Try adjusting your filters.'
                : 'Create your first budget to get started.'}
            </p>

            {!search && !status && !fiscalYear && (
              <button
                type="button"
                onClick={() => navigate('/finance/budgets/new')}
                className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Create Budget
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Budget
                  </th>

                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Fiscal Year
                  </th>

                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Period
                  </th>

                  <th className="whitespace-nowrap px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Amount
                  </th>

                  <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>

                  <th className="whitespace-nowrap px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredBudgets.map((budget) => (
                  <tr
                    key={budget.id}
                    className="transition hover:bg-gray-50"
                  >
                    {/* Budget */}
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {budget.name}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {budget.budget_number}
                        </p>
                      </div>
                    </td>

                    {/* Fiscal Year */}
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      {budget.fiscal_year}
                    </td>

                    {/* Period */}
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                      <div>
                        <p>{formatDate(budget.start_date)}</p>
                        <p className="text-xs text-gray-400">
                          to {formatDate(budget.end_date)}
                        </p>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-gray-900">
                      {formatAmount(budget.amount, budget.currency)}
                    </td>

                    {/* Status */}
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          statusStyles[budget.status]
                        }`}
                      >
                        {statusLabels[budget.status]}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/finance/budgets/${budget.id}`)
                        }
                        className="text-sm font-medium text-gray-700 hover:text-gray-900 hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetsPage;