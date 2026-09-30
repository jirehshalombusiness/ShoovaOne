import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  Calendar,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Printer,
  RefreshCw,
  Send,
} from 'lucide-react';

import { invoiceService } from '../invoice.service';

import type {
  Invoice,
  InvoiceStatus,
} from '../invoice.types';

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  issued: 'bg-blue-100 text-blue-700',
  partially_paid: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

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

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
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

function getErrorMessage(error: any) {
  const detail = error?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail
      .map(
        (item: any) =>
          item?.msg || 'Validation error'
      )
      .join(', ');
  }

  return (
    detail ||
    error?.response?.data?.message ||
    error?.message ||
    'Unable to complete the invoice action.'
  );
}

function getTimeline(invoice: Invoice) {
  return [
    {
      label: 'Created',
      date: invoice.created_at,
      completed: true,
    },
    {
      label: 'Issued',
      date: invoice.issued_at,
      completed:
        invoice.status !== 'draft' &&
        invoice.status !== 'cancelled',
    },
    {
      label: 'Paid',
      date: invoice.paid_at,
      completed: invoice.status === 'paid',
    },
  ];
}

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{
    invoiceId: string;
  }>();

  const [invoice, setInvoice] =
    useState<Invoice | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] =
    useState(false);
  const [error, setError] = useState('');

  const [showCancelForm, setShowCancelForm] =
    useState(false);
  const [cancellationReason, setCancellationReason] =
    useState('');

  const loadInvoice = async () => {
    if (!invoiceId) {
      setError('Invoice ID is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const data =
        await invoiceService.getInvoice(invoiceId);

      setInvoice(data);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInvoice();
  }, [invoiceId]);

  const outstanding = useMemo(
    () =>
      invoice
        ? getOutstanding(invoice)
        : 0,
    [invoice]
  );

  const canIssue =
    invoice?.status === 'draft';

  const canCancel =
    invoice &&
    invoice.status !== 'paid' &&
    invoice.status !== 'cancelled' &&
    invoice.amount_paid === 0;

  const handleIssue = async () => {
    if (!invoice) return;

    try {
      setActionLoading(true);
      setError('');

      const updated =
        await invoiceService.issueInvoice(
          invoice.id
        );

      setInvoice(updated);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!invoice) return;

    if (cancellationReason.trim().length < 3) {
      setError(
        'Please provide a cancellation reason.'
      );
      return;
    }

    try {
      setActionLoading(true);
      setError('');

      const updated =
        await invoiceService.cancelInvoice(
          invoice.id,
          cancellationReason.trim()
        );

      setInvoice(updated);
      setShowCancelForm(false);
      setCancellationReason('');
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading invoice...
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-4">
        <Link
          to="/finance/invoices"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Invoices
        </Link>

        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error || 'Invoice not found.'}
        </div>
      </div>
    );
  }

  const timeline = getTimeline(invoice);

  return (
    <>
      {/* Screen-only invoice management page */}
      <div className="invoice-screen space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              to="/finance/invoices"
              className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Invoices
            </Link>

            <div className="flex items-center gap-3">
              <FileText className="h-7 w-7 text-slate-700" />

              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  {invoice.invoice_number}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {invoice.title}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1.5 text-xs font-medium ${STATUS_STYLES[invoice.status]}`}
            >
              {formatStatus(invoice.status)}
            </span>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>

            {canIssue && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void handleIssue()}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {actionLoading ? 'Issuing...' : 'Issue Invoice'}
              </button>
            )}

            {canCancel && (
              <button
                type="button"
                onClick={() => setShowCancelForm(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <Ban className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Invoice action failed</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {showCancelForm && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <h2 className="font-semibold text-red-900">Cancel Invoice</h2>
            <p className="mt-1 text-sm text-red-700">
              This invoice has no recorded payment and can be cancelled.
            </p>

            <textarea
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
              rows={3}
              placeholder="Enter cancellation reason..."
              className="mt-4 w-full rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200"
            />

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCancelForm(false);
                  setCancellationReason('');
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Keep Invoice
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void handleCancel()}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Invoice Amount</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatAmount(invoice.amount, invoice.currency)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Amount Paid</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-700">
              {formatAmount(invoice.amount_paid, invoice.currency)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Outstanding</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatAmount(outstanding, invoice.currency)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="font-semibold text-slate-900">
                  Invoice Information
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Invoice Number
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    {invoice.invoice_number}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Title
                  </p>
                  <p className="mt-1 font-medium text-slate-900">
                    {invoice.title}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Issue Date
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(invoice.issue_date)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Due Date
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(invoice.due_date)}
                  </p>
                </div>

                <div className="md:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Description
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {invoice.description || '—'}
                  </p>
                </div>

                {invoice.notes && (
                  <div className="md:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Notes
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {invoice.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="font-semibold text-slate-900">Bill To</h2>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <p className="font-semibold text-slate-900">
                  {invoice.customer_name}
                </p>
              </div>

              {invoice.customer_email && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Email
                  </p>
                  <p className="mt-1 break-all text-sm text-slate-700">
                    {invoice.customer_email}
                  </p>
                </div>
              )}

              {invoice.customer_phone && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Phone
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {invoice.customer_phone}
                  </p>
                </div>
              )}

              {invoice.customer_address && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Address
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {invoice.customer_address}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="font-semibold text-slate-900">Workflow</h2>
            </div>

            <div className="space-y-5 p-6">
              {timeline.map((item, index) => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    {item.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Clock3 className="h-5 w-5 text-slate-300" />
                    )}

                    {index < timeline.length - 1 && (
                      <div className="mt-1 h-8 w-px bg-slate-200" />
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatDateTime(item.date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="font-semibold text-slate-900">
                Record Information
              </h2>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Created
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {formatDateTime(invoice.created_at)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Last Updated
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {formatDateTime(invoice.updated_at)}
                </p>
              </div>

              {invoice.cancelled_at && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Cancelled
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {formatDateTime(invoice.cancelled_at)}
                  </p>

                  {invoice.cancellation_reason && (
                    <p className="mt-2 text-sm text-red-700">
                      {invoice.cancellation_reason}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                <Calendar className="h-4 w-4 shrink-0" />
                Outstanding:
                <span className="font-semibold text-slate-900">
                  {formatAmount(outstanding, invoice.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print-only standard invoice */}
      <div className="invoice-print">
        <div className="print-invoice">
          <header className="print-invoice__header">
            <div className="print-company">
              <div className="print-company__name">SHOOVA INITIATIVE</div>
              <div className="print-company__tagline">
                Restoration • Education • Research
              </div>
            </div>

            <div className="print-invoice__title-block">
              <h1>INVOICE</h1>
              <p>{invoice.invoice_number}</p>
            </div>
          </header>

          <section className="print-meta">
            <div className="print-section">
              <div className="print-label">BILL TO</div>
              <div className="print-customer-name">
                {invoice.customer_name}
              </div>

              {invoice.customer_address && (
                <div className="print-muted print-address">
                  {invoice.customer_address}
                </div>
              )}

              {invoice.customer_email && (
                <div className="print-muted">{invoice.customer_email}</div>
              )}

              {invoice.customer_phone && (
                <div className="print-muted">{invoice.customer_phone}</div>
              )}
            </div>

            <div className="print-invoice-details">
              <div className="print-detail-row">
                <span>Invoice #</span>
                <strong>{invoice.invoice_number}</strong>
              </div>
              <div className="print-detail-row">
                <span>Issue Date</span>
                <strong>{formatDate(invoice.issue_date)}</strong>
              </div>
              <div className="print-detail-row">
                <span>Due Date</span>
                <strong>{formatDate(invoice.due_date)}</strong>
              </div>
              <div className="print-detail-row">
                <span>Status</span>
                <strong>{formatStatus(invoice.status)}</strong>
              </div>
            </div>
          </section>

          <section className="print-items">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="print-amount-column">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className="print-item-title">{invoice.title}</div>
                    {invoice.description && (
                      <div className="print-item-description">
                        {invoice.description}
                      </div>
                    )}
                  </td>
                  <td className="print-amount-column print-item-amount">
                    {formatAmount(invoice.amount, invoice.currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="print-totals">
            <div className="print-total-row">
              <span>Subtotal</span>
              <strong>
                {formatAmount(invoice.amount, invoice.currency)}
              </strong>
            </div>

            <div className="print-total-row">
              <span>Amount Paid</span>
              <strong>
                {formatAmount(invoice.amount_paid, invoice.currency)}
              </strong>
            </div>

            <div className="print-total-row print-total-row--outstanding">
              <span>Amount Due</span>
              <strong>
                {formatAmount(outstanding, invoice.currency)}
              </strong>
            </div>
          </section>

          {invoice.notes && (
            <section className="print-notes">
              <div className="print-label">NOTES</div>
              <p>{invoice.notes}</p>
            </section>
          )}

          <footer className="print-footer">
            <div>
              <strong>Thank you for your partnership with Shoova Initiative.</strong>
              <p>Generated from ShoovaOne Finance.</p>
            </div>
          </footer>
        </div>
      </div>

      <style>{`
        .invoice-print {
          display: none;
        }

        .print-invoice {
          box-sizing: border-box;
          width: 100%;
          max-width: 190mm;
          margin: 0 auto;
          padding: 0;
          background: #ffffff;
          color: #111827;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10.5pt;
          line-height: 1.45;
        }

        .print-invoice__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding-bottom: 18px;
          border-bottom: 2px solid #111827;
        }

        .print-company__name {
          font-size: 21pt;
          font-weight: 800;
          letter-spacing: 0.02em;
        }

        .print-company__tagline {
          margin-top: 4px;
          color: #64748b;
          font-size: 9pt;
        }

        .print-invoice__title-block {
          text-align: right;
        }

        .print-invoice__title-block h1 {
          margin: 0;
          font-size: 25pt;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .print-invoice__title-block p {
          margin: 5px 0 0;
          font-size: 9.5pt;
          font-weight: 700;
        }

        .print-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 35px;
          margin-top: 26px;
        }

        .print-label {
          margin-bottom: 7px;
          color: #64748b;
          font-size: 8pt;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .print-customer-name {
          margin-bottom: 4px;
          font-size: 11pt;
          font-weight: 700;
        }

        .print-muted {
          color: #475569;
          font-size: 9.5pt;
        }

        .print-address {
          white-space: pre-wrap;
          margin-bottom: 3px;
        }

        .print-invoice-details {
          width: 100%;
          max-width: 280px;
          margin-left: auto;
        }

        .print-detail-row {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 4px 0;
          border-bottom: 1px solid #e5e7eb;
          font-size: 9.5pt;
        }

        .print-detail-row span {
          color: #64748b;
        }

        .print-detail-row strong {
          text-align: right;
          font-weight: 700;
        }

        .print-items {
          margin-top: 30px;
        }

        .print-items table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .print-items th {
          padding: 9px 10px;
          background: #f1f5f9;
          border-top: 1px solid #cbd5e1;
          border-bottom: 1px solid #cbd5e1;
          color: #334155;
          font-size: 8.5pt;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-align: left;
          text-transform: uppercase;
        }

        .print-items td {
          padding: 14px 10px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: top;
        }

        .print-amount-column {
          width: 155px;
          text-align: right !important;
        }

        .print-item-title {
          font-size: 10.5pt;
          font-weight: 700;
        }

        .print-item-description {
          margin-top: 4px;
          color: #64748b;
          font-size: 9.5pt;
          white-space: pre-wrap;
        }

        .print-item-amount {
          font-weight: 700;
          white-space: nowrap;
        }

        .print-totals {
          width: 310px;
          margin: 20px 0 0 auto;
        }

        .print-total-row {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 7px 0;
          border-bottom: 1px solid #e5e7eb;
          font-size: 9.5pt;
        }

        .print-total-row strong {
          white-space: nowrap;
        }

        .print-total-row--outstanding {
          margin-top: 4px;
          padding: 11px 12px;
          border: 1px solid #111827;
          background: #f8fafc;
          font-size: 11pt;
          font-weight: 800;
        }

        .print-notes {
          margin-top: 28px;
          padding-top: 13px;
          border-top: 1px solid #cbd5e1;
        }

        .print-notes p {
          margin: 0;
          color: #475569;
          font-size: 9.5pt;
          white-space: pre-wrap;
        }

        .print-footer {
          margin-top: 42px;
          padding-top: 13px;
          border-top: 1px solid #cbd5e1;
          color: #475569;
          font-size: 8.5pt;
        }

        .print-footer strong {
          color: #334155;
        }

        .print-footer p {
          margin: 3px 0 0;
          color: #94a3b8;
        }

        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          html,
          body {
            width: 210mm;
            min-height: 297mm;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .invoice-screen {
            display: none !important;
          }

          .invoice-print {
            display: block !important;
            width: 100%;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-invoice {
            max-width: none;
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
