import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Mail,
  User,
  WalletCards,
} from 'lucide-react';

import { invoiceService } from '../invoice.service';
import {
  cancelPayment,
  getPayment,
} from '../payment.service';
import {
  Payment,
  PaymentStatus,
} from '../payment.types';
import { Invoice } from '../invoice.types';

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

const formatDate = (value?: string | null) => {
  if (!value) return '—';

  const date = new Date(
    value.includes('T')
      ? value
      : `${value}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (
  value?: string | null
) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusClasses = (
  status: PaymentStatus
) => {
  if (status === 'completed') {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  }

  return 'bg-red-50 text-red-700 ring-1 ring-red-200';
};

const statusLabel = (
  status: PaymentStatus
) => {
  if (status === 'completed') {
    return 'Completed';
  }

  return 'Cancelled';
};

export default function PaymentDetailPage() {
  const { paymentId } = useParams<{
    paymentId: string;
  }>();

  const navigate = useNavigate();

  const [payment, setPayment] =
    useState<Payment | null>(null);

  const [invoice, setInvoice] =
    useState<Invoice | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCancelForm, setShowCancelForm] =
    useState(false);

  const [cancelReason, setCancelReason] =
    useState('');

  const [cancelling, setCancelling] =
    useState(false);

  const loadPayment = async () => {
    if (!paymentId) {
      setError('Payment ID is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const paymentData =
        await getPayment(paymentId);

      setPayment(paymentData);

      try {
        const invoiceData =
          await invoiceService.getInvoice(
            paymentData.invoice_id
          );

        setInvoice(invoiceData);
      } catch {
        // Payment can still be displayed if the
        // related invoice cannot be loaded.
        setInvoice(null);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          'Failed to load payment.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayment();
  }, [paymentId]);

  const handleCancel = async () => {
    if (!paymentId) return;

    if (cancelReason.trim().length < 3) {
      setError(
        'Please provide a cancellation reason.'
      );
      return;
    }

    try {
      setCancelling(true);
      setError('');

      const updatedPayment =
        await cancelPayment(paymentId, {
          reason: cancelReason.trim(),
        });

      setPayment(updatedPayment);
      setShowCancelForm(false);
      setCancelReason('');

      if (invoice) {
        try {
          const updatedInvoice =
            await invoiceService.getInvoice(
              invoice.id
            );

          setInvoice(updatedInvoice);
        } catch {
          // Keep the existing invoice information.
        }
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          'Failed to cancel payment.'
      );
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm text-slate-500">
          Loading payment...
        </p>
      </div>
    );
  }

  if (error && !payment) {
    return (
      <div className="space-y-4">
        <Link
          to="/finance/payments"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Payments
        </Link>

        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="space-y-4">
        <Link
          to="/finance/payments"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Payments
        </Link>

        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">
            Payment not found.
          </p>
        </div>
      </div>
    );
  }

  const isCompleted =
    payment.status === 'completed';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/finance/payments"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900">
                {payment.payment_number}
              </h1>

              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(
                  payment.status
                )}`}
              >
                {statusLabel(payment.status)}
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Payment recorded on{' '}
              {formatDate(payment.payment_date)}
            </p>
          </div>
        </div>

        {isCompleted && (
          <button
            type="button"
            onClick={() =>
              setShowCancelForm(
                (current) => !current
              )
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
          >
            <Ban className="h-4 w-4" />
            Cancel Payment
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Cancel form */}
      {showCancelForm && isCompleted && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="font-semibold text-red-900">
            Cancel Payment
          </h2>

          <p className="mt-1 text-sm text-red-700">
            Cancelling this payment will remove it from
            the invoice's paid amount and recalculate the
            invoice balance.
          </p>

          <div className="mt-4">
            <label
              htmlFor="cancelReason"
              className="mb-1.5 block text-sm font-medium text-red-900"
            >
              Cancellation Reason
            </label>

            <textarea
              id="cancelReason"
              value={cancelReason}
              onChange={(event) =>
                setCancelReason(
                  event.target.value
                )
              }
              rows={3}
              placeholder="Explain why this payment is being cancelled..."
              className="w-full rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200"
            />
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowCancelForm(false);
                setCancelReason('');
              }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Keep Payment
            </button>

            <button
              type="button"
              disabled={cancelling}
              onClick={handleCancel}
              className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelling
                ? 'Cancelling...'
                : 'Confirm Cancellation'}
            </button>
          </div>
        </div>
      )}

      {/* Payment summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-3">
              <CircleDollarSign className="h-5 w-5 text-emerald-600" />
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Payment Amount
              </p>

              <p className="mt-1 text-xl font-semibold text-slate-900">
                {formatCurrency(
                  Number(payment.amount),
                  payment.currency
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-3">
              <CalendarDays className="h-5 w-5 text-blue-600" />
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Payment Date
              </p>

              <p className="mt-1 font-semibold text-slate-900">
                {formatDate(
                  payment.payment_date
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-50 p-3">
              <WalletCards className="h-5 w-5 text-violet-600" />
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Payment Method
              </p>

              <p className="mt-1 font-semibold capitalize text-slate-900">
                {payment.payment_method.replace(
                  /_/g,
                  ' '
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice information */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-slate-600" />

            <div>
              <h2 className="font-semibold text-slate-900">
                Invoice Information
              </h2>

              <p className="text-sm text-slate-500">
                Invoice associated with this payment.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Invoice Number
            </p>

            {invoice ? (
              <Link
                to={`/finance/invoices/${invoice.id}`}
                className="mt-1 inline-block font-semibold text-slate-900 hover:text-slate-600"
              >
                {invoice.invoice_number}
              </Link>
            ) : (
              <p className="mt-1 font-semibold text-slate-900">
                {payment.invoice_id}
              </p>
            )}
          </div>

          {invoice && (
            <>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Customer
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {invoice.customer_name}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Invoice Amount
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {formatCurrency(
                    Number(invoice.amount),
                    invoice.currency
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Invoice Status
                </p>

                <p className="mt-1 font-semibold capitalize text-slate-900">
                  {invoice.status.replace(
                    /_/g,
                    ' '
                  )}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Payer information */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-slate-600" />

            <div>
              <h2 className="font-semibold text-slate-900">
                Payer Information
              </h2>

              <p className="text-sm text-slate-500">
                Information recorded with the payment.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Payer Name
            </p>

            <p className="mt-1 font-medium text-slate-900">
              {payment.payer_name || '—'}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Payer Email
            </p>

            {payment.payer_email ? (
              <a
                href={`mailto:${payment.payer_email}`}
                className="mt-1 inline-flex items-center gap-2 font-medium text-slate-900 hover:text-slate-600"
              >
                <Mail className="h-4 w-4" />
                {payment.payer_email}
              </a>
            ) : (
              <p className="mt-1 font-medium text-slate-900">
                —
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Payment Reference
            </p>

            <p className="mt-1 font-medium text-slate-900">
              {payment.reference || '—'}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Recorded At
            </p>

            <p className="mt-1 font-medium text-slate-900">
              {formatDateTime(
                payment.recorded_at
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Notes */}
      {payment.notes && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">
            Notes
          </h2>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {payment.notes}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-5">
        <Link
          to="/finance/payments"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Payments
        </Link>

        {isCompleted && (
          <div className="inline-flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Payment completed
          </div>
        )}
      </div>
    </div>
  );
}