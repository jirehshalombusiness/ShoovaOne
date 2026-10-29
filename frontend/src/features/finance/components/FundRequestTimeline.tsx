import {
  CheckCircle2,
  Circle,
  Clock3,
  SkipForward,
  XCircle,
} from 'lucide-react';

import type {
  FundRequestApprovalRecord,
  FundRequestDetail,
  FundRequestStage,
} from '../finance.types';

type StepState =
  | 'done'
  | 'current'
  | 'upcoming'
  | 'skipped'
  | 'rejected'
  | 'cancelled';

interface TimelineStep {
  key: 'submitted' | FundRequestStage;
  title: string;
  description: string;
  state: StepState;
  meta?: string | null;
  note?: string | null;
}

interface FundRequestTimelineProps {
  request: FundRequestDetail;
}

const STAGE_ORDER: FundRequestStage[] = [
  'manager',
  'finance',
  'ceo',
  'disbursement',
  'verification',
  'closed',
];

function formatDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return `${currency} ${Number(amount || 0).toLocaleString()}`;
  }
}

function stageIndex(stage?: FundRequestStage | null) {
  if (!stage) return -1;
  return STAGE_ORDER.indexOf(stage);
}

function latestFor(
  approvals: FundRequestApprovalRecord[],
  predicate: (approval: FundRequestApprovalRecord) => boolean
) {
  const matches = approvals
    .filter(predicate)
    .sort((a, b) => {
      const aTime = a.decided_at ? Date.parse(a.decided_at) : 0;
      const bTime = b.decided_at ? Date.parse(b.decided_at) : 0;
      return bTime - aTime;
    });

  return matches[0];
}

function decisionFor(
  approvals: FundRequestApprovalRecord[],
  stage: FundRequestStage
) {
  return latestFor(approvals, (approval) => approval.stage === stage);
}

function currentStepIndex(request: FundRequestDetail): number {
  switch (request.status) {
    case 'draft':
      return -1;
    case 'submitted':
      return 1;
    case 'manager_approved':
      return 2;
    case 'finance_approved':
      return 3;
    case 'approved':
      return 4;
    case 'disbursed':
    case 'verification_failed':
      return 5;
    case 'verified':
      return 6;
    case 'rejected': {
      const rejected = latestFor(
        request.approvals,
        (approval) => approval.decision === 'rejected'
      );

      const index = stageIndex(rejected?.stage ?? request.current_stage);

      return index >= 0 ? index + 1 : -1;
    }
    case 'cancelled':
      return -1;
    default:
      return -1;
  }
}

function paidStageDone(request: FundRequestDetail) {
  return Boolean(request.disbursed_at) || request.amount_disbursed > 0;
}

export function FundRequestTimeline({
  request,
}: FundRequestTimelineProps) {
  const currentIndex = currentStepIndex(request);
  const rejected = request.status === 'rejected';
  const cancelled = request.status === 'cancelled';

  const managerDecision = decisionFor(request.approvals, 'manager');
  const financeDecision = decisionFor(request.approvals, 'finance');
  const ceoDecision = decisionFor(request.approvals, 'ceo');

  const managerDone = Boolean(
    request.manager_decided_at || managerDecision
  );
  const financeDone = Boolean(
    request.finance_decided_at || financeDecision
  );
  const ceoDone = Boolean(request.ceo_decided_at || ceoDecision);

  const resolveStageState = (
    index: number,
    done: boolean
  ): StepState => {
    if (done) {
      return 'done';
    }

    if (cancelled) {
      return currentIndex >= index ? 'done' : 'cancelled';
    }

    if (rejected && index === currentIndex) {
      return 'rejected';
    }

    if (index < currentIndex) {
      return 'skipped';
    }

    if (index === currentIndex) {
      return 'current';
    }

    return 'upcoming';
  };

  const submittedState: StepState = request.submitted_at
    ? 'done'
    : cancelled
      ? 'cancelled'
      : 'upcoming';

  const steps: TimelineStep[] = [
    {
      key: 'submitted',
      title: 'Claim submitted',
      description:
        request.requester_name?.trim() || 'Submitted for approval',
      state: submittedState,
      meta: formatDate(request.submitted_at),
    },
    {
      key: 'manager',
      title: 'Manager review',
      description: managerDone
        ? managerDecision?.actor_name
          ? `Reviewed by ${managerDecision.actor_name}`
          : 'Manager approved the claim'
        : 'Your line manager confirms the claim is valid.',
      state: resolveStageState(1, managerDone),
      meta: formatDate(request.manager_decided_at),
      note: request.manager_decision_note ?? managerDecision?.note ?? null,
    },
    {
      key: 'finance',
      title: 'Finance review',
      description: financeDone
        ? financeDecision?.actor_name
          ? `Reviewed by ${financeDecision.actor_name}`
          : 'Finance approved the claim'
        : 'Finance checks the amounts and supporting documents.',
      state: resolveStageState(2, financeDone),
      meta: formatDate(request.finance_decided_at),
      note:
        request.finance_decision_note ??
        financeDecision?.note ??
        null,
    },
    {
      key: 'ceo',
      title: 'CEO approval',
      description: ceoDone
        ? ceoDecision?.actor_name
          ? `Approved by ${ceoDecision.actor_name}`
          : 'Executive approval recorded'
        : 'Final executive approval before payment.',
      state: resolveStageState(3, ceoDone),
      meta: formatDate(request.ceo_decided_at),
      note: request.ceo_decision_note ?? ceoDecision?.note ?? null,
    },
    {
      key: 'disbursement',
      title: 'Payment',
      description: paidStageDone(request)
        ? `Paid by Finance: ${formatCurrency(
            request.amount_disbursed,
            request.currency
          )}`
        : 'Finance releases the approved amount.',
      state: resolveStageState(4, paidStageDone(request)),
      meta: formatDate(request.disbursed_at),
      note: request.disbursement_notes ?? null,
    },
    {
      key: 'verification',
      title: 'Receipt verification',
      description:
        request.status === 'verified'
          ? 'Signed hardcopy receipts verified and claim closed.'
          : request.status === 'verification_failed'
            ? 'Finance returned the receipts. Resubmit the signed originals.'
            : 'Hand the signed hardcopy receipts to Finance.',
      state:
        request.status === 'verified'
          ? 'done'
          : request.status === 'verification_failed'
            ? 'rejected'
            : resolveStageState(5, false),
      meta: formatDate(request.receipt_verified_at),
      note: request.receipt_verification_note ?? null,
    },
  ];

  const currentStep = steps.find((step) => step.state === 'current');

  return (
    <div>
      <ol className="space-y-0">
        {steps.map((step, index) => (
          <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
            {index < steps.length - 1 && (
              <span
                aria-hidden
                className={`absolute left-[13px] top-7 h-full w-px ${
                  step.state === 'done'
                    ? 'bg-emerald-200'
                    : 'bg-slate-200'
                }`}
              />
            )}

            <StepIcon state={step.state} />

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={`text-sm font-semibold ${
                    step.state === 'upcoming'
                      ? 'text-slate-400'
                      : step.state === 'skipped' ||
                          step.state === 'cancelled'
                        ? 'text-slate-500'
                        : 'text-slate-900'
                  }`}
                >
                  {step.title}
                </p>

                {step.state === 'skipped' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <SkipForward className="h-3 w-3" />
                    Skipped
                  </span>
                )}

                {step.state === 'rejected' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                    <XCircle className="h-3 w-3" />
                    Not approved
                  </span>
                )}

                {step.meta && (
                  <span className="text-[11px] text-slate-400">
                    {step.meta}
                  </span>
                )}
              </div>

              <p
                className={`mt-0.5 text-xs leading-5 ${
                  step.state === 'upcoming'
                    ? 'text-slate-400'
                    : 'text-slate-500'
                }`}
              >
                {step.description}
              </p>

              {step.note && (
                <p className="mt-1 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs leading-5 text-slate-600">
                  {step.note}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {currentStep && request.next_approver_name && (
        <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Waiting on{' '}
          <span className="font-semibold">
            {request.next_approver_name}
          </span>
          {request.current_stage === 'finance'
            ? ' to review the claim.'
            : request.current_stage === 'ceo'
              ? ' for executive approval.'
              : ' to approve the claim.'}
        </div>
      )}

      {rejected && request.rejection_reason && (
        <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span className="font-semibold">Reason: </span>
          {request.rejection_reason}
        </div>
      )}
    </div>
  );
}

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') {
    return (
      <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 className="h-5 w-5" />
      </span>
    );
  }

  if (state === 'rejected') {
    return (
      <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
        <XCircle className="h-5 w-5" />
      </span>
    );
  }

  if (state === 'current') {
    return (
      <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-4 ring-blue-50">
        <Clock3 className="h-4 w-4" />
      </span>
    );
  }

  if (state === 'skipped') {
    return (
      <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <SkipForward className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-slate-300">
      <Circle className="h-5 w-5" />
    </span>
  );
}
