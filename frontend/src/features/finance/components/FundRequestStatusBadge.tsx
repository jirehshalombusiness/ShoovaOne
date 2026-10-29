import type {
  FundRequestStage,
  FundRequestStatus,
} from '../finance.types';

interface FundRequestStatusBadgeProps {
  status: FundRequestStatus;
}

const statusConfig: Record<
  FundRequestStatus,
  {
    label: string;
    className: string;
    dotClassName: string;
  }
> = {
  draft: {
    label: 'Draft',
    className: 'border-slate-200 bg-slate-50 text-slate-700',
    dotClassName: 'bg-slate-400',
  },

  submitted: {
    label: 'Submitted',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
    dotClassName: 'bg-blue-500',
  },

  manager_approved: {
    label: 'Manager approved',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
    dotClassName: 'bg-sky-500',
  },

  finance_approved: {
    label: 'Finance approved',
    className: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    dotClassName: 'bg-indigo-500',
  },

  approved: {
    label: 'Ready for payment',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dotClassName: 'bg-emerald-500',
  },

  disbursed: {
    label: 'Paid — awaiting receipts',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    dotClassName: 'bg-amber-500',
  },

  verified: {
    label: 'Verified & closed',
    className: 'border-purple-200 bg-purple-50 text-purple-700',
    dotClassName: 'bg-purple-500',
  },

  verification_failed: {
    label: 'Receipts rejected',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
    dotClassName: 'bg-rose-500',
  },

  rejected: {
    label: 'Rejected',
    className: 'border-red-200 bg-red-50 text-red-700',
    dotClassName: 'bg-red-500',
  },

  cancelled: {
    label: 'Cancelled',
    className: 'border-slate-200 bg-slate-100 text-slate-500',
    dotClassName: 'bg-slate-400',
  },
};

const stageConfig: Record<
  FundRequestStage,
  { label: string; className: string }
> = {
  manager: {
    label: 'Manager review',
    className: 'bg-slate-100 text-slate-700',
  },
  finance: {
    label: 'Finance review',
    className: 'bg-blue-50 text-blue-700',
  },
  ceo: {
    label: 'CEO approval',
    className: 'bg-indigo-50 text-indigo-700',
  },
  disbursement: {
    label: 'Disbursement',
    className: 'bg-amber-50 text-amber-700',
  },
  verification: {
    label: 'Receipt verification',
    className: 'bg-purple-50 text-purple-700',
  },
  closed: {
    label: 'Closed',
    className: 'bg-emerald-50 text-emerald-700',
  },
};

export function FundRequestStatusBadge({
  status,
}: FundRequestStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${config.className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${config.dotClassName}`}
      />

      {config.label}
    </span>
  );
}

export function FundRequestStageBadge({
  stage,
}: {
  stage?: FundRequestStage | null;
}) {
  if (!stage) {
    return null;
  }

  const config = stageConfig[stage];

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  reimbursement: 'Reimbursement',
  advance: 'Advance',
};

export const STATUS_LABELS: Record<FundRequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  manager_approved: 'Manager approved',
  finance_approved: 'Finance approved',
  approved: 'Ready for payment',
  disbursed: 'Paid — awaiting receipts',
  verified: 'Verified & closed',
  verification_failed: 'Receipts rejected',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};
