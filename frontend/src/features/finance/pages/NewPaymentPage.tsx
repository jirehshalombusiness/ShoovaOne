import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CircleDollarSign,
  Save,
} from 'lucide-react';

import { invoiceService} from '../invoice.service';
import { Invoice } from '../invoice.types';
import { createPayment } from '../payment.service';

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

const today = () => {
  const date = new Date();

  return date.toISOString().split('T')[0];
};

export default function NewPaymentPage() {
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] =
    useState(true);

  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] =
    useState(today());
  const [paymentMethod, setPaymentMethod] =
    useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadInvoices = async () => {
      try {
        setLoadingInvoices(true);
        setError('');

        const [issued, partiallyPaid, overdue] =
          await Promise.all([
            invoiceService.getInvoices({
              status: 'issued',
            }),
            invoiceService.getInvoices({
              status: 'partially_paid',
            }),
            invoiceService.getInvoices({
              status: 'overdue',
            }),
          ]);

        const invoiceMap = new Map<
          string,
          Invoice
        >();

        [
          ...issued,
          ...partiallyPaid,
          ...overdue,
        ].forEach((invoice) => {
          invoiceMap.set(invoice.id, invoice);
        });

        const availableInvoices = Array.from(
          invoiceMap.values()
        ).filter(
          (invoice) =>
            invoice.status !== 'cancelled' &&
            invoice.status !== 'paid' &&
            Number(invoice.amount) >
              Number(invoice.amount_paid || 0)
        );

        setInvoices(availableInvoices);
      } catch (err: any) {
        setError(
          err?.response?.data?.detail ||
            'Failed to load available invoices.'
        );
      } finally {
        setLoadingInvoices(false);
      }
    };

    loadInvoices();
  }, []);

  const selectedInvoice = useMemo(
    () =>
      invoices.find(
        (invoice) => invoice.id === invoiceId
      ) || null,
    [invoices, invoiceId]
  );

  const outstandingAmount = selectedInvoice
    ? Math.max(
        0,
        Number(selectedInvoice.amount) -
          Number(selectedInvoice.amount_paid || 0)
      )
    : 0;

  const currency =
    selectedInvoice?.currency || 'GHS';

  const handleInvoiceChange = (
    value: string
  ) => {
    setInvoiceId(value);
    setAmount('');

    const invoice = invoices.find(
      (item) => item.id === value
    );

    if (invoice) {
      setPayerName(invoice.customer_name);
      setPayerEmail(
        invoice.customer_email || ''
      );
    } else {
      setPayerName('');
      setPayerEmail('');
    }
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError('');

    if (!selectedInvoice) {
      setError('Please select an invoice.');
      return;
    }

    const paymentAmount = Number(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      setError(
        'Please enter a valid payment amount.'
      );
      return;
    }

    if (paymentAmount > outstandingAmount) {
      setError(
        `Payment cannot exceed the outstanding balance of ${formatCurrency(
          outstandingAmount,
          currency
        )}.`
      );
      return;
    }

    try {
      setSaving(true);

      const payment = await createPayment({
        invoice_id: selectedInvoice.id,
        amount: paymentAmount,
        currency: selectedInvoice.currency,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference: reference.trim() || undefined,
        payer_name:
          payerName.trim() || undefined,
        payer_email:
          payerEmail.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      navigate(
        `/finance/payments/${payment.id}`
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          'Failed to record payment.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/finance/payments"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Record Payment
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Record a payment received against an
            issued invoice.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {/* Invoice selection */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 p-2">
              <CircleDollarSign className="h-5 w-5 text-slate-700" />
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">
                Payment Information
              </h2>

              <p className="text-sm text-slate-500">
                Select the invoice this payment belongs
                to.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label
                htmlFor="invoice"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Invoice
              </label>

              <select
                id="invoice"
                value={invoiceId}
                onChange={(event) =>
                  handleInvoiceChange(
                    event.target.value
                  )
                }
                disabled={loadingInvoices}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
              >
                <option value="">
                  {loadingInvoices
                    ? 'Loading invoices...'
                    : 'Select an invoice'}
                </option>

                {invoices.map((invoice) => {
                  const outstanding =
                    Number(invoice.amount) -
                    Number(invoice.amount_paid || 0);

                  return (
                    <option
                      key={invoice.id}
                      value={invoice.id}
                    >
                      {invoice.invoice_number} —{' '}
                      {invoice.customer_name} —{' '}
                      {formatCurrency(
                        outstanding,
                        invoice.currency
                      )}{' '}
                      outstanding
                    </option>
                  );
                })}
              </select>

              {!loadingInvoices &&
                invoices.length === 0 && (
                  <p className="mt-2 text-sm text-slate-500">
                    There are currently no invoices with
                    an outstanding balance.
                  </p>
                )}
            </div>

            {selectedInvoice && (
              <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Invoice
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {selectedInvoice.invoice_number}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Customer
                  </p>

                  <p className="mt-1 font-semibold text-slate-900">
                    {selectedInvoice.customer_name}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Outstanding
                  </p>

                  <p className="mt-1 font-semibold text-emerald-700">
                    {formatCurrency(
                      outstandingAmount,
                      currency
                    )}
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="amount"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Payment Amount
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    {currency}
                  </span>

                  <input
                    id="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={
                      selectedInvoice
                        ? outstandingAmount
                        : undefined
                    }
                    value={amount}
                    onChange={(event) =>
                      setAmount(event.target.value)
                    }
                    placeholder="0.00"
                    required
                    disabled={!selectedInvoice}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-16 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                  />
                </div>

                {selectedInvoice && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Maximum payment:{' '}
                    {formatCurrency(
                      outstandingAmount,
                      currency
                    )}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="paymentDate"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Payment Date
                </label>

                <input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(event) =>
                    setPaymentDate(
                      event.target.value
                    )
                  }
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label
                  htmlFor="paymentMethod"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Payment Method
                </label>

                <select
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(
                      event.target.value
                    )
                  }
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="bank_transfer">
                    Bank Transfer
                  </option>
                  <option value="mobile_money">
                    Mobile Money
                  </option>
                  <option value="cash">
                    Cash
                  </option>
                  <option value="cheque">
                    Cheque
                  </option>
                  <option value="card">
                    Card
                  </option>
                  <option value="other">
                    Other
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="reference"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Payment Reference
                </label>

                <input
                  id="reference"
                  type="text"
                  value={reference}
                  onChange={(event) =>
                    setReference(
                      event.target.value
                    )
                  }
                  placeholder="Transaction/reference number"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Payer */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">
            Payer Information
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Confirm who made the payment.
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="payerName"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Payer Name
              </label>

              <input
                id="payerName"
                type="text"
                value={payerName}
                onChange={(event) =>
                  setPayerName(event.target.value)
                }
                placeholder="Name of payer"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label
                htmlFor="payerEmail"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Payer Email
              </label>

              <input
                id="payerEmail"
                type="email"
                value={payerEmail}
                onChange={(event) =>
                  setPayerEmail(event.target.value)
                }
                placeholder="payer@example.com"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="notes"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Notes
              </label>

              <textarea
                id="notes"
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                rows={4}
                placeholder="Additional payment notes..."
                className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            to="/finance/payments"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={
              saving ||
              loadingInvoices ||
              !selectedInvoice
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />

            {saving
              ? 'Recording Payment...'
              : 'Record Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}