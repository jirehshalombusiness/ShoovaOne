import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FilePlus2,
  RefreshCcw,
  Search,
  ShieldCheck,
  AlertTriangle,

} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { financeService } from '../finance.service';
import type {
  FundRequest,
  FundRequestListParams,
} from '../finance.types';

import { FundRequestFilters } from '../components/FundRequestFilters';
import { FundRequestTable } from '../components/FundRequestTable';

function formatCurrency(amount: number, currency = 'GHS') {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function FundRequestsPage() {
  const [requests, setRequests] = useState<FundRequest[]>([]);
  const [filters, setFilters] = useState<FundRequestListParams>({
    page: 1,
    page_size: 25,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await financeService.getFundRequests(filters);

      setRequests(data);
    } catch (err) {
      console.error('Failed to load fund requests:', err);

      setError(
        'We could not load the fund requests. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const summary = useMemo(() => {
    const total = requests.length;

    const pending = requests.filter(
      (request) =>
        request.status === 'submitted' ||
        request.status === 'under_review'
    ).length;

    const approved = requests.filter(
      (request) =>
        request.status === 'approved' ||
        request.status === 'disbursed' ||
        request.status === 'reconciled'
    ).length;

    const requestedAmount = requests.reduce(
      (sum, request) => sum + Number(request.amount_requested),
      0
    );

    const approvedAmount = requests.reduce(
      (sum, request) =>
        sum + Number(request.approved_amount ?? 0),
      0
    );

    return {
      total,
      pending,
      approved,
      requestedAmount,
      approvedAmount,
    };
  }, [requests]);

  const handleFiltersChange = (
    nextFilters: FundRequestListParams
  ) => {
    setFilters({
      ...nextFilters,
      page: 1,
    });
  };

  const handleViewRequest = (request: FundRequest) => {
    navigate(`/finance/fund-requests/${request.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <ShieldCheck className="h-4 w-4" />
            Fund Management
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Fund Requests
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Manage funding requests through submission, review,
            approval, disbursement, and reconciliation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadRequests}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''
                }`}
            />

            Refresh
          </button>

          <Link
            to="/finance/fund-requests/new"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <FilePlus2 className="h-4 w-4" />
            New Fund Request
          </Link>
        </div>
      </section>

      {/* Summary */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Requests
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {summary.total}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Currently in this register
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            Pending Action
          </p>

          <p className="mt-2 text-2xl font-semibold text-amber-800">
            {summary.pending}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Submitted or under review
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            Approved
          </p>

          <p className="mt-2 text-2xl font-semibold text-emerald-800">
            {summary.approved}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Approved, disbursed, or reconciled
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Requested Value
          </p>

          <p className="mt-2 text-xl font-semibold text-slate-900">
            {formatCurrency(summary.requestedAmount)}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Approved: {formatCurrency(summary.approvedAmount)}
          </p>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <div className="flex-1">
              <h2 className="text-sm font-semibold text-red-900">
                Fund requests could not be loaded
              </h2>

              <p className="mt-1 text-sm text-red-700">
                {error}
              </p>

              <button
                type="button"
                onClick={loadRequests}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-red-800 hover:text-red-900"
              >
                <RefreshCcw className="h-4 w-4" />
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <FundRequestFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* Register heading */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Request Register
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              All funding requests available within your Finance access scope.
            </p>
          </div>

          <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
            <Search className="h-3.5 w-3.5" />
            <span>Search and filter the register</span>
          </div>
        </div>

        <FundRequestTable
          requests={requests}
          loading={loading}
          onView={handleViewRequest}
        />
      </section>
    </div>
  );
}