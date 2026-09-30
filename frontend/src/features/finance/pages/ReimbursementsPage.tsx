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

import { reimbursementService } from '../reimbursement.service';

import type {
  Reimbursement,
  ReimbursementStatus,
} from '../reimbursement.types';

const STATUS_OPTIONS: Array<{
  value: ReimbursementStatus;
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

const STATUS_STYLES: Record<ReimbursementStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-blue-50 text-blue-700',
  under_review: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  paid: 'bg-violet-50 text-violet-700',
  reconciled: 'bg-teal-50 text-teal-700',
};

const formatStatus = (status: ReimbursementStatus) =>
  status
    .split('_')
    .map(
      (word) => word.charAt(0).toUpperCase() + word.slice(1)
    )
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

export default function ReimbursementsPage() {
  const [reimbursements, setReimbursements] = useState<
    Reimbursement[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<
    ReimbursementStatus | ''
  >('');

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const loadReimbursements = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const data =
        await reimbursementService.getReimbursements({
          status: status || undefined,
          search: search.trim() || undefined,
          page,
          page_size: pageSize,
        });

      setReimbursements(
        Array.isArray(data) ? data : []
      );
    } catch (err: any) {
      console.error(
        'Failed to load reimbursements:',
        err
      );

      const message =
        err?.response?.data?.detail ||
        'Unable to load reimbursements. Please try again.';

      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReimbursements();
  }, [status, page]);

  const filteredReimbursements = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return reimbursements;
    }

    return reimbursements.filter((reimbursement) => {
      return (
        reimbursement.reimbursement_number
          .toLowerCase()
          .includes(query) ||
        reimbursement.title
          .toLowerCase()
          .includes(query) ||
        reimbursement.category
          ?.toLowerCase()
          .includes(query) ||
        reimbursement.vendor_name
          ?.toLowerCase()
          .includes(query)
      );
    });
  }, [reimbursements, search]);

  const totalCount = filteredReimbursements.length;

  const pendingCount = useMemo(() => {
    return filteredReimbursements.filter(
      (reimbursement) =>
        reimbursement.status === 'submitted' ||
        reimbursement.status === 'under_review' ||
        reimbursement.status === 'approved'
    ).length;
  }, [filteredReimbursements]);

  const currencyTotals = useMemo(() => {
    const totals: Record<string, number> = {};

    filteredReimbursements.forEach((reimbursement) => {
      const currency = reimbursement.currency || 'GHS';

      totals[currency] =
        (totals[currency] || 0) +
        Number(reimbursement.amount || 0);
    });

    return totals;
  }, [filteredReimbursements]);

  const currencySummary = Object.entries(
    currencyTotals
  )
    .map(
      ([currency, amount]) =>
        `${formatAmount(amount, currency)}`
    )
    .join(' · ');

  const handleSearchSubmit = (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    setPage(1);
    loadReimbursements();
  };

  const handleStatusChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setStatus(
      event.target.value as ReimbursementStatus | ''
    );
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('');
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
            <span className="text-slate-700">
              Reimbursements
            </span>
          </div>

          <div className="mt-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Reimbursements
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage employee expenses paid personally and
              submitted for organisational reimbursement.
            </p>
          </div>
        </div>

        <Link
          to="/finance/reimbursements/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          New Reimbursement
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 p-2">
              <FileText className="h-5 w-5 text-slate-600" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Reimbursements in View
              </p>

              <p className="mt-1 text-xl font-semibold text-slate-900">
                {totalCount}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2">
              <FileText className="h-5 w-5 text-amber-600" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Pending Workflow
              </p>

              <p className="mt-1 text-xl font-semibold text-slate-900">
                {pendingCount}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2">
              <ArrowUpRight className="h-5 w-5 text-emerald-600" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Value in View
              </p>

              <p
                className="mt-1 truncate text-sm font-semibold text-slate-900"
                title={currencySummary || 'No value'}
              >
                {currencySummary || '—'}
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
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search reimbursement number, title, vendor..."
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
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>

          {(search || status) && (
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
            onClick={() => loadReimbursements(true)}
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
              Unable to load reimbursements
            </p>

            <p className="mt-1 text-sm text-red-700">
              {error}
            </p>
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
        ) : filteredReimbursements.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <div className="rounded-full bg-slate-100 p-4">
              <FileText className="h-7 w-7 text-slate-500" />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No reimbursements found
            </h3>

            <p className="mt-1 max-w-md text-sm text-slate-500">
              {search || status
                ? 'Try adjusting your filters or search terms.'
                : 'There are no reimbursement records available yet.'}
            </p>

            {search || status ? (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 text-sm font-medium text-slate-900 underline underline-offset-4"
              >
                Clear filters
              </button>
            ) : (
              <Link
                to="/finance/reimbursements/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Create first reimbursement
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reimbursement
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
                  {filteredReimbursements.map(
                    (reimbursement) => (
                      <tr
                        key={reimbursement.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <div>
                            <Link
                              to={`/finance/reimbursements/${reimbursement.id}`}
                              className="text-sm font-semibold text-slate-900 hover:text-slate-700"
                            >
                              {reimbursement.title}
                            </Link>

                            <p className="mt-1 text-xs text-slate-500">
                              {
                                reimbursement.reimbursement_number
                              }
                            </p>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {reimbursement.category || '—'}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {reimbursement.vendor_name || '—'}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <span className="text-sm font-semibold text-slate-900">
                            {formatAmount(
                              Number(reimbursement.amount),
                              reimbursement.currency
                            )}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatDate(
                            reimbursement.incurred_date
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              STATUS_STYLES[
                                reimbursement.status
                              ]
                            }`}
                          >
                            {formatStatus(
                              reimbursement.status
                            )}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <Link
                            to={`/finance/reimbursements/${reimbursement.id}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
                          >
                            View
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
              <p className="text-sm text-slate-500">
                Showing {filteredReimbursements.length}{' '}
                reimbursement
                {filteredReimbursements.length === 1
                  ? ''
                  : 's'}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) =>
                      Math.max(1, current - 1)
                    )
                  }
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
                  onClick={() =>
                    setPage((current) => current + 1)
                  }
                  disabled={
                    filteredReimbursements.length <
                    pageSize
                  }
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