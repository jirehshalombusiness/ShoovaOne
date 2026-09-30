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

import { invoiceService } from '../invoice.service';

import type {
  Invoice,
  InvoiceStatus,
} from '../invoice.types';

const STATUS_OPTIONS: Array<{
  value: '' | InvoiceStatus;
  label: string;
}> = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  issued: 'bg-blue-100 text-blue-700',
  partially_paid: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

const PAGE_SIZE = 10;

function formatStatus(status: InvoiceStatus) {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatAmount(
  amount: number,
  currency: string
) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getOutstanding(invoice: Invoice) {
  return Math.max(
    0,
    invoice.amount - invoice.amount_paid
  );
}

function buildCurrencyTotals(
  invoices: Invoice[],
  selector: (invoice: Invoice) => number
) {
  return invoices.reduce<Record<string, number>>(
    (totals, invoice) => {
      const currency = invoice.currency || 'GHS';

      totals[currency] =
        (totals[currency] || 0) +
        selector(invoice);

      return totals;
    },
    {}
  );
}

function CurrencyTotals({
  totals,
  label,
}: {
  totals: Record<string, number>;
  label: string;
}) {
  const entries = Object.entries(totals);

  if (!entries.length) {
    return (
      <span className="text-sm text-slate-400">
        {label}: —
      </span>
    );
  }

  return (
    <div className="space-y-0.5">
      {entries.map(([currency, amount]) => (
        <div
          key={currency}
          className="text-sm font-semibold text-slate-900"
        >
          {formatAmount(amount, currency)}
        </div>
      ))}
    </div>
  );
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(
    []
  );
  const [statusFilter, setStatusFilter] = useState<
    '' | InvoiceStatus
  >('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await invoiceService.getInvoices({
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      });

      setInvoices(data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;

      if (Array.isArray(detail)) {
        setError(
          detail
            .map(
              (item: any) =>
                item?.msg || 'Unable to load invoices.'
            )
            .join(', ')
        );
      } else {
        setError(
          detail ||
            err?.message ||
            'Unable to load invoices.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  useEffect(() => {
    void loadInvoices();
  }, [statusFilter, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(invoices.length / PAGE_SIZE)
  );

  const paginatedInvoices = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return invoices.slice(
      start,
      start + PAGE_SIZE
    );
  }, [invoices, page]);

  const totalInvoiced = useMemo(
    () =>
      buildCurrencyTotals(
        invoices,
        (invoice) => invoice.amount
      ),
    [invoices]
  );

  const totalPaid = useMemo(
    () =>
      buildCurrencyTotals(
        invoices,
        (invoice) => invoice.amount_paid
      ),
    [invoices]
  );

  const totalOutstanding = useMemo(
    () =>
      buildCurrencyTotals(
        invoices,
        getOutstanding
      ),
    [invoices]
  );

  const pendingCount = invoices.filter(
    (invoice) =>
      invoice.status === 'issued' ||
      invoice.status === 'partially_paid' ||
      invoice.status === 'overdue'
  ).length;

  const overdueCount = invoices.filter(
    (invoice) => invoice.status === 'overdue'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-slate-700" />
            <h1 className="text-2xl font-semibold text-slate-900">
              Invoices
            </h1>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Track money owed to Shoova and manage
            outstanding receivables.
          </p>
        </div>

        <Link
          to="/finance/invoices/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          New Invoice
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Invoices in View
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {invoices.length}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {pendingCount} awaiting full payment
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Total Invoiced
          </p>

          <div className="mt-2">
            <CurrencyTotals
              totals={totalInvoiced}
              label="Total"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Total Collected
          </p>

          <div className="mt-2">
            <CurrencyTotals
              totals={totalPaid}
              label="Collected"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Outstanding
          </p>

          <div className="mt-2">
            <CurrencyTotals
              totals={totalOutstanding}
              label="Outstanding"
            />
          </div>

          <p className="mt-1 text-xs text-slate-500">
            {overdueCount} overdue
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search invoice number, customer, or title..."
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | ''
                  | InvoiceStatus
              )
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          >
            {STATUS_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void loadInvoices()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <div>
            <p className="font-medium">
              Unable to load invoices
            </p>

            <p className="mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading invoices...
            </div>
          </div>
        ) : paginatedInvoices.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
            <FileText className="h-10 w-10 text-slate-300" />

            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No invoices found
            </h3>

            <p className="mt-1 max-w-md text-sm text-slate-500">
              {search || statusFilter
                ? 'Try changing your search or status filter.'
                : 'Create your first invoice to begin tracking receivables.'}
            </p>

            {!search && !statusFilter && (
              <Link
                to="/finance/invoices/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Create Invoice
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Invoice
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Customer
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Due Date
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Amount
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Outstanding
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 bg-white">
                  {paginatedInvoices.map(
                    (invoice) => (
                      <tr
                        key={invoice.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="whitespace-nowrap px-5 py-4">
                          <Link
                            to={`/finance/invoices/${invoice.id}`}
                            className="group"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 group-hover:text-slate-700">
                                {invoice.invoice_number}
                              </span>

                              <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:text-slate-700" />
                            </div>

                            <p className="mt-1 max-w-[240px] truncate text-xs text-slate-500">
                              {invoice.title}
                            </p>
                          </Link>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-medium text-slate-900">
                            {invoice.customer_name}
                          </p>

                          {invoice.customer_email && (
                            <p className="mt-1 text-xs text-slate-500">
                              {invoice.customer_email}
                            </p>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                          {formatDate(invoice.due_date)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <p className="font-medium text-slate-900">
                            {formatAmount(
                              invoice.amount,
                              invoice.currency
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Paid:{' '}
                            {formatAmount(
                              invoice.amount_paid,
                              invoice.currency
                            )}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <span className="font-semibold text-slate-900">
                            {formatAmount(
                              getOutstanding(invoice),
                              invoice.currency
                            )}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[invoice.status]}`}
                          >
                            {formatStatus(
                              invoice.status
                            )}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <Link
                            to={`/finance/invoices/${invoice.id}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
                          >
                            View
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing{' '}
                <span className="font-medium text-slate-700">
                  {(page - 1) * PAGE_SIZE + 1}
                </span>{' '}
                to{' '}
                <span className="font-medium text-slate-700">
                  {Math.min(
                    page * PAGE_SIZE,
                    invoices.length
                  )}
                </span>{' '}
                of{' '}
                <span className="font-medium text-slate-700">
                  {invoices.length}
                </span>{' '}
                invoices
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage((current) =>
                      Math.max(1, current - 1)
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>

                <span className="px-2 text-sm text-slate-500">
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((current) =>
                      Math.min(
                        totalPages,
                        current + 1
                      )
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Workflow note */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-800">
          Invoice workflow
        </p>

        <p className="mt-1 text-sm text-slate-600">
          Draft → Issued → Partially Paid → Paid.
          Unpaid invoices become Overdue after their
          due date.
        </p>
      </div>
    </div>
  );
}