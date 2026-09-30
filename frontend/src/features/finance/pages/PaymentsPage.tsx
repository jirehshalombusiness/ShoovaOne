import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  Search,
  WalletCards,
} from 'lucide-react';

import { getPayments } from '../payment.service';
import {
  Payment,
  PaymentStatus,
} from '../payment.types';

const PAGE_SIZE = 10;

const statusOptions: Array<{
  value: '' | PaymentStatus;
  label: string;
}> = [
  { value: '', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const formatCurrency = (
  amount: number,
  currency: string
) => {
  try {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
};

const formatDate = (value: string) => {
  if (!value) return '—';

  return new Date(`${value}T00:00:00`).toLocaleDateString(
    'en-GH',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  );
};

const statusClasses = (status: PaymentStatus) => {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
    case 'cancelled':
      return 'bg-red-50 text-red-700 ring-1 ring-red-200';
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-gray-200';
  }
};

const statusLabel = (status: PaymentStatus) => {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
};

const getCurrencyTotals = (
  payments: Payment[]
) => {
  const totals: Record<string, number> = {};

  payments.forEach((payment) => {
    if (payment.status !== 'completed') return;

    const currency = payment.currency.toUpperCase();

    totals[currency] =
      (totals[currency] || 0) + Number(payment.amount);
  });

  return totals;
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<
    '' | PaymentStatus
  >('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const loadPayments = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await getPayments({
        search: search.trim() || undefined,
        status: status || undefined,
      });

      setPayments(data);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          'Failed to load payments.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadPayments();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [search, status]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const completedPayments = useMemo(
    () =>
      payments.filter(
        (payment) => payment.status === 'completed'
      ),
    [payments]
  );

  const cancelledPayments = useMemo(
    () =>
      payments.filter(
        (payment) => payment.status === 'cancelled'
      ),
    [payments]
  );

  const currencyTotals = useMemo(
    () => getCurrencyTotals(payments),
    [payments]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(payments.length / PAGE_SIZE)
  );

  const visiblePayments = payments.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const summaryTotal = Object.entries(
    currencyTotals
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Payments
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Track incoming payments received against
            issued invoices.
          </p>
        </div>

        <Link
          to="/finance/payments/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Record Payment
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Completed Payments
              </p>

              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {completedPayments.length}
              </p>
            </div>

            <div className="rounded-lg bg-emerald-50 p-3">
              <WalletCards className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Completed Value
              </p>

              <div className="mt-2 space-y-1">
                {summaryTotal.length > 0 ? (
                  summaryTotal.map(
                    ([currency, amount]) => (
                      <p
                        key={currency}
                        className="text-xl font-semibold text-slate-900"
                      >
                        {formatCurrency(
                          amount,
                          currency
                        )}
                      </p>
                    )
                  )
                ) : (
                  <p className="text-2xl font-semibold text-slate-900">
                    0.00
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 p-3">
              <ArrowDownToLine className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Cancelled Payments
              </p>

              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {cancelledPayments.length}
              </p>
            </div>

            <div className="rounded-lg bg-red-50 p-3">
              <WalletCards className="h-5 w-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search payment number, invoice, reference or payer..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value as
                  | ''
                  | PaymentStatus
              )
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          >
            {statusOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payment
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Invoice
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payer
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </th>

                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Amount
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Method
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
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    Loading payments...
                  </td>
                </tr>
              ) : visiblePayments.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center"
                  >
                    <div className="mx-auto max-w-sm">
                      <WalletCards className="mx-auto h-10 w-10 text-slate-300" />

                      <p className="mt-3 text-sm font-medium text-slate-700">
                        No payments found
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Record a payment against an issued
                        invoice to see it here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                visiblePayments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-5 py-4">
                      <Link
                        to={`/finance/payments/${payment.id}`}
                        className="font-medium text-slate-900 hover:text-slate-600"
                      >
                        {payment.payment_number}
                      </Link>

                      {payment.reference && (
                        <p className="mt-1 text-xs text-slate-500">
                          Ref: {payment.reference}
                        </p>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="text-sm text-slate-700">
                        Invoice
                      </span>
                      <p className="text-xs text-slate-500">
                        {payment.invoice_id}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-slate-800">
                        {payment.payer_name || '—'}
                      </p>

                      {payment.payer_email && (
                        <p className="mt-1 text-xs text-slate-500">
                          {payment.payer_email}
                        </p>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                      {formatDate(payment.payment_date)}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <span className="text-sm font-semibold text-slate-900">
                        {formatCurrency(
                          Number(payment.amount),
                          payment.currency
                        )}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm capitalize text-slate-600">
                      {payment.payment_method.replace(
                        /_/g,
                        ' '
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(
                          payment.status
                        )}`}
                      >
                        {statusLabel(payment.status)}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <Link
                        to={`/finance/payments/${payment.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && payments.length > 0 && (
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
                  payments.length
                )}
              </span>{' '}
              of{' '}
              <span className="font-medium text-slate-700">
                {payments.length}
              </span>{' '}
              payments
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() =>
                  setPage((current) =>
                    Math.max(1, current - 1)
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}