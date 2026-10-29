import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCcw,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { financeService } from '../finance.service';
import type {
  FundRequest,
  FundRequestReceiptVerificationPayload,
} from '../finance.types';
import { FundRequestStatusBadge } from '../components/FundRequestStatusBadge';

type Tab = 'pending' | 'closed';

function formatCurrency(amount: number, currency = 'GHS') {
  try {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return `${currency} ${Number(amount || 0).toLocaleString()}`;
  }
}

function formatDate(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getErrorMessage(error: unknown, fallback: string) {
  const detail = (
    error as { response?: { data?: { detail?: unknown } } }
  )?.response?.data?.detail;

  if (typeof detail === 'string') return detail;

  return fallback;
}

export function ReceiptVerificationPage() {
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('pending');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [receiptReference, setReceiptReference] = useState('');
  const [note, setNote] = useState('');

  const requestsQuery = useQuery({
    queryKey: ['finance', 'receipt-verification'],
    queryFn: () => financeService.listFundRequests({ limit: 250 }),
    refetchInterval: 60_000,
  });

  const requests = requestsQuery.data ?? [];

  const pending = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.status === 'disbursed' ||
          request.status === 'verification_failed'
      ),
    [requests]
  );

  const closed = useMemo(
    () => requests.filter((request) => request.status === 'verified'),
    [requests]
  );

  const pendingTotals = useMemo(() => {
    const totals = new Map<string, number>();

    pending.forEach((request) => {
      const currency = request.currency || 'GHS';
      totals.set(
        currency,
        (totals.get(currency) ?? 0) +
          Number(request.amount_disbursed || 0)
      );
    });

    return Array.from(totals.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
  }, [pending]);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['finance', 'receipt-verification'],
    });
    void queryClient.invalidateQueries({
      queryKey: ['finance', 'fund-requests'],
    });
    void queryClient.invalidateQueries({
      queryKey: ['finance', 'disbursements'],
    });
    void queryClient.invalidateQueries({
      queryKey: ['finance', 'sidebar-overview'],
    });
  };

  const verifyMutation = useMutation({
    mutationFn: ({
      request,
      payload,
    }: {
      request: FundRequest;
      payload: FundRequestReceiptVerificationPayload;
    }) => financeService.verifyFundRequestReceipt(request.id, payload),
    onSuccess: (_, { payload }) => {
      toast.success(
        payload.verified
          ? 'Receipts verified — claim closed'
          : 'Receipts returned to the requester'
      );
      setActiveId(null);
      setReceiptReference('');
      setNote('');
      invalidate();
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, 'The receipt check could not be saved.')
      ),
  });

  const openPanel = (request: FundRequest) => {
    setActiveId(request.id);
    setReceiptReference(request.receipt_reference ?? '');
    setNote('');
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <ClipboardCheck className="h-4 w-4" />
            Fund Management
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Receipt Verification
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Close the loop on paid claims. Verify that the signed
            original receipts match the approved claim before
            closing it.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void requestsQuery.refetch()}
          disabled={requestsQuery.isFetching}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCcw
            className={`h-4 w-4 ${
              requestsQuery.isFetching ? 'animate-spin' : ''
            }`}
          />
          Refresh
        </button>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
            Awaiting verification
          </p>

          <p className="mt-2 text-2xl font-semibold text-purple-800">
            {pending.length}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Paid claims with hardcopy receipts outstanding
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Paid value
          </p>

          <p className="mt-2 text-xl font-semibold text-slate-900">
            {pendingTotals.length === 0 ? (
              '—'
            ) : (
              <span className="block">
                {pendingTotals.map(([currency, total]) => (
                  <span key={currency} className="block">
                    {formatCurrency(total, currency)}
                  </span>
                ))}
              </span>
            )}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Sum of paid amounts awaiting receipts
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            Verified &amp; closed
          </p>

          <p className="mt-2 text-2xl font-semibold text-emerald-800">
            {closed.length}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Claims with receipts checked by Finance
          </p>
        </div>
      </section>

      {requestsQuery.isError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

          <div>
            <h2 className="text-sm font-semibold text-red-900">
              Verification queue could not be loaded
            </h2>

            <p className="mt-1 text-sm text-red-700">
              Check your connection and try again.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:w-fit">
        {(
          [
            { value: 'pending', label: 'Awaiting receipts', count: pending.length },
            { value: 'closed', label: 'Closed', count: closed.length },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTab(option.value)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition sm:flex-none ${
              tab === option.value
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {option.label}

            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                tab === option.value
                  ? 'bg-white/15 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {option.count}
            </span>
          </button>
        ))}
      </div>

      {requestsQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>
      ) : tab === 'pending' ? (
        pending.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No receipts outstanding
            </h3>

            <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-slate-500">
              Every paid claim has had its hardcopy receipts checked.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((request) => {
              const isActive = activeId === request.id;

              return (
                <div
                  key={request.id}
                  className="rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-400">
                          {request.request_number}
                        </span>

                        <FundRequestStatusBadge
                          status={request.status}
                        />
                      </div>

                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {request.title}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {request.requester_name?.trim() ||
                          'Unknown requester'}{' '}
                        · Paid {formatDate(request.disbursed_at)}
                        {request.receipt_reference
                          ? ` · Ref ${request.receipt_reference}`
                          : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-right">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          Paid
                        </p>

                        <p className="text-base font-semibold text-slate-900">
                          {formatCurrency(
                            request.amount_disbursed,
                            request.currency
                          )}
                        </p>
                      </div>

                      <Link
                        to={`/finance/fund-requests/${request.id}`}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        View
                      </Link>

                      <button
                        type="button"
                        onClick={() =>
                          isActive
                            ? setActiveId(null)
                            : openPanel(request)
                        }
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        {isActive ? 'Close' : 'Check receipts'}
                      </button>
                    </div>
                  </div>

                  {isActive && (
                    <div className="border-t border-purple-100 bg-purple-50/50 p-5">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
                        <div>
                          <label
                            htmlFor={`ref-${request.id}`}
                            className="mb-1.5 block text-xs font-semibold text-purple-900"
                          >
                            Receipt reference
                          </label>

                          <input
                            id={`ref-${request.id}`}
                            type="text"
                            value={receiptReference}
                            onChange={(event) =>
                              setReceiptReference(event.target.value)
                            }
                            placeholder="Hardcopy receipt number"
                            className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-purple-400"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`note-${request.id}`}
                            className="mb-1.5 block text-xs font-semibold text-purple-900"
                          >
                            Verification note
                          </label>

                          <input
                            id={`note-${request.id}`}
                            type="text"
                            value={note}
                            onChange={(event) =>
                              setNote(event.target.value)
                            }
                            placeholder="Required when returning receipts"
                            className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-purple-400"
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            verifyMutation.mutate({
                              request,
                              payload: {
                                verified: true,
                                note: note.trim() || undefined,
                                receipt_reference:
                                  receiptReference.trim() || undefined,
                              },
                            })
                          }
                          disabled={verifyMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:opacity-60"
                        >
                          {verifyMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          Verify &amp; close
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            verifyMutation.mutate({
                              request,
                              payload: {
                                verified: false,
                                note: note.trim(),
                                receipt_reference:
                                  receiptReference.trim() || undefined,
                              },
                            })
                          }
                          disabled={
                            verifyMutation.isPending || !note.trim()
                          }
                          className="inline-flex items-center gap-2 rounded-lg border border-purple-300 bg-white px-4 py-2 text-sm font-semibold text-purple-700 transition hover:bg-purple-100 disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" />
                          Return receipts
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : closed.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <ClipboardCheck className="h-6 w-6" />
          </div>

          <h3 className="mt-4 text-sm font-semibold text-slate-900">
            No verified claims yet
          </h3>

          <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-slate-500">
            Claims closed after hardcopy verification appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {closed.map((request) => (
              <li key={request.id}>
                <Link
                  to={`/finance/fund-requests/${request.id}`}
                  className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-400">
                      {request.request_number}
                    </p>

                    <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                      {request.title}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {request.requester_name?.trim() ||
                        'Unknown requester'}{' '}
                      · Verified {formatDate(request.receipt_verified_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatCurrency(
                        request.amount_disbursed,
                        request.currency
                      )}
                    </p>

                    <FundRequestStatusBadge status={request.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
