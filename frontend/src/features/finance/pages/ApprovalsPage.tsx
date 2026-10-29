import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { hrService, type ApprovalSummary } from '@/services/hr.service';

import { financeService } from '../finance.service';
import type {
  FundRequest,
  FundRequestStage,
} from '../finance.types';
import {
  FundRequestStageBadge,
  FundRequestStatusBadge,
} from '../components/FundRequestStatusBadge';

type Tab = 'queue' | 'pipeline';

const STAGE_LABELS: Record<string, string> = {
  manager: 'Manager review',
  finance: 'Finance review',
  ceo: 'CEO approval',
};

const PIPELINE_ORDER: Array<'manager' | 'finance' | 'ceo'> = [
  'manager',
  'finance',
  'ceo',
];

const OPEN_STATUSES = new Set([
  'submitted',
  'manager_approved',
  'finance_approved',
]);

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

function requesterName(approval: ApprovalSummary) {
  const first = approval.requested_by.first_name ?? '';
  const last = approval.requested_by.last_name ?? '';
  return `${first} ${last}`.trim() || 'Unknown requester';
}

function getErrorMessage(error: unknown, fallback: string) {
  const detail = (
    error as { response?: { data?: { detail?: unknown } } }
  )?.response?.data?.detail;

  if (typeof detail === 'string') return detail;

  return fallback;
}

export function ApprovalsPage() {
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('queue');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [rejectMode, setRejectMode] = useState(false);

  const queueQuery = useQuery({
    queryKey: ['finance', 'approval-queue'],
    queryFn: () =>
      hrService.getApprovals({
        entity_types: 'fund_request',
        status: 'pending',
        assigned_to_me: true,
        limit: 50,
      }),
    refetchInterval: 60_000,
  });

  const registerQuery = useQuery({
    queryKey: ['finance', 'fund-requests-for-approvals'],
    queryFn: () =>
      financeService.listFundRequests({ limit: 200 }),
    refetchInterval: 60_000,
  });

  const requestsById = useMemo(() => {
    const map = new Map<string, FundRequest>();

    (registerQuery.data ?? []).forEach((request) => {
      map.set(request.id, request);
    });

    return map;
  }, [registerQuery.data]);

  const pipeline = useMemo(() => {
    const open = (registerQuery.data ?? []).filter((request) =>
      OPEN_STATUSES.has(request.status)
    );

    return PIPELINE_ORDER.map((stage) => ({
      stage,
      requests: open.filter(
        (request) => request.current_stage === stage
      ),
    }));
  }, [registerQuery.data]);

  const queue = queueQuery.data?.items ?? [];

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['finance', 'approval-queue'],
    });
    void queryClient.invalidateQueries({
      queryKey: ['finance', 'fund-requests-for-approvals'],
    });
    void queryClient.invalidateQueries({
      queryKey: ['finance', 'fund-requests'],
    });
    void queryClient.invalidateQueries({
      queryKey: ['finance', 'sidebar-overview'],
    });
  };

  const approveMutation = useMutation({
    mutationFn: (approval: ApprovalSummary) =>
      hrService.approveRequest(
        approval.id,
        note.trim() || undefined,
        approval.stage === 'finance' && approvedAmount.trim()
          ? Number(approvedAmount)
          : undefined
      ),
    onSuccess: () => {
      toast.success('Approved');
      resetDecision();
      invalidate();
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, 'The approval could not be recorded.')
      ),
  });

  const rejectMutation = useMutation({
    mutationFn: (approval: ApprovalSummary) =>
      hrService.rejectRequest(approval.id, note.trim()),
    onSuccess: () => {
      toast.success('Rejected');
      resetDecision();
      invalidate();
    },
    onError: (error) =>
      toast.error(
        getErrorMessage(error, 'The rejection could not be recorded.')
      ),
  });

  function resetDecision() {
    setActiveId(null);
    setNote('');
    setApprovedAmount('');
    setRejectMode(false);
  }

  function openDecision(approval: ApprovalSummary) {
    setActiveId(approval.id);
    setNote('');
    setRejectMode(false);

    const request = requestsById.get(approval.entity_id);
    const suggested =
      request?.approved_amount ?? request?.amount_requested;

    setApprovedAmount(
      approval.stage === 'finance' && suggested != null
        ? String(suggested)
        : ''
    );
  }

  const stats = useMemo(() => {
    const openCounts = PIPELINE_ORDER.map((stage) => ({
      stage,
      count: pipeline.find((group) => group.stage === stage)
        ?.requests.length ?? 0,
    }));

    return {
      queue: queue.length,
      openCounts,
    };
  }, [pipeline, queue.length]);

  const isLoading = queueQuery.isLoading || registerQuery.isLoading;
  const hasError = queueQuery.isError || registerQuery.isError;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <ShieldCheck className="h-4 w-4" />
            Fund Management
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Approvals
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Claims awaiting your decision, and every claim moving
            through manager, finance and CEO review.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void queueQuery.refetch();
            void registerQuery.refetch();
          }}
          disabled={isLoading}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCcw
            className={`h-4 w-4 ${
              isLoading ? 'animate-spin' : ''
            }`}
          />
          Refresh
        </button>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-900/10 bg-slate-900 p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
            My queue
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {stats.queue}
          </p>

          <p className="mt-1 text-xs text-white/60">
            Awaiting your decision
          </p>
        </div>

        {stats.openCounts.map(({ stage, count }) => (
          <div
            key={stage}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {STAGE_LABELS[stage]}
            </p>

            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {count}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Claims currently in this stage
            </p>
          </div>
        ))}
      </section>

      {hasError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

          <div>
            <h2 className="text-sm font-semibold text-red-900">
              Approvals could not be loaded
            </h2>

            <p className="mt-1 text-sm text-red-700">
              Check your connection and try again.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:w-fit">
        {(
          [
            { value: 'queue', label: 'My queue', count: stats.queue },
            {
              value: 'pipeline',
              label: 'Pipeline',
              count: pipeline.reduce(
                (total, group) => total + group.requests.length,
                0
              ),
            },
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

      {tab === 'queue' ? (
        <section>
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Assigned to you
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              These claims are waiting on your approval decision.
            </p>
          </div>

          {queueQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-28 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : queue.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>

              <h3 className="mt-4 text-sm font-semibold text-slate-900">
                You are all caught up
              </h3>

              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                No fund requests are assigned to you right now.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((approval) => {
                const request = requestsById.get(approval.entity_id);
                const isActive = activeId === approval.id;

                return (
                  <div
                    key={approval.id}
                    className="rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                          <FileCheck2 className="h-5 w-5" />
                        </span>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <FundRequestStageBadge
                              stage={
                                approval.stage as FundRequestStage
                              }
                            />

                            {approval.due_at && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                <Clock3 className="h-3 w-3" />
                                Due {formatDate(approval.due_at)}
                              </span>
                            )}
                          </div>

                          <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                            {approval.title}
                          </p>

                          <p className="mt-0.5 text-xs text-slate-500">
                            {request?.request_number ?? 'Fund request'}{' '}
                            · {requesterName(approval)}
                            {request
                              ? ` · ${formatCurrency(
                                  request.amount_requested,
                                  request.currency
                                )}`
                              : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Link
                          to={`/finance/fund-requests/${approval.entity_id}`}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Open
                        </Link>

                        <button
                          type="button"
                          onClick={() =>
                            isActive
                              ? resetDecision()
                              : openDecision(approval)
                          }
                          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                          {isActive ? 'Close' : 'Decide'}
                        </button>
                      </div>
                    </div>

                    {isActive && (
                      <div className="border-t border-slate-100 bg-slate-50/60 p-5">
                        <div className="space-y-3">
                          {approval.stage === 'finance' && (
                            <div>
                              <label
                                htmlFor={`amount-${approval.id}`}
                                className="mb-1.5 block text-xs font-semibold text-slate-600"
                              >
                                Approved amount
                                {request ? ` (${request.currency})` : ''}
                              </label>

                              <input
                                id={`amount-${approval.id}`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={approvedAmount}
                                onChange={(event) =>
                                  setApprovedAmount(event.target.value)
                                }
                                className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                              />

                              <p className="mt-1 text-[11px] text-slate-500">
                                Finance can approve less than the
                                amount requested.
                              </p>
                            </div>
                          )}

                          <textarea
                            rows={2}
                            value={note}
                            onChange={(event) =>
                              setNote(event.target.value)
                            }
                            placeholder={
                              rejectMode
                                ? 'Explain what needs to change (required)…'
                                : 'Optional note for the requester…'
                            }
                            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400"
                          />

                          <div className="flex flex-wrap items-center gap-2">
                            {!rejectMode ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    approveMutation.mutate(approval)
                                  }
                                  disabled={approveMutation.isPending}
                                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  {approveMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                  )}
                                  Approve
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setRejectMode(true)}
                                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Reject
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    rejectMutation.mutate(approval)
                                  }
                                  disabled={
                                    !note.trim() ||
                                    rejectMutation.isPending
                                  }
                                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                                >
                                  {rejectMutation.isPending && (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  )}
                                  Confirm rejection
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setRejectMode(false)}
                                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-5">
          {pipeline.map((group) => (
            <div
              key={group.stage}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
                <div className="flex items-center gap-2">
                  <FundRequestStageBadge stage={group.stage} />

                  <span className="text-xs font-medium text-slate-500">
                    {STAGE_LABELS[group.stage]}
                  </span>
                </div>

                <span className="text-xs font-semibold text-slate-500">
                  {group.requests.length} claim
                  {group.requests.length === 1 ? '' : 's'}
                </span>
              </div>

              {group.requests.length === 0 ? (
                <p className="px-5 py-6 text-xs text-slate-400">
                  No claims are at this stage.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {group.requests.map((request) => (
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
                            · Submitted {formatDate(request.submitted_at)}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCurrency(
                              request.amount_requested,
                              request.currency
                            )}
                          </p>

                          <FundRequestStatusBadge
                            status={request.status}
                          />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
