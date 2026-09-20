import type { FundRequestStatus } from '../finance.types';

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

  under_review: {
    label: 'Under Review',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    dotClassName: 'bg-amber-500',
  },

  approved: {
    label: 'Approved',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dotClassName: 'bg-emerald-500',
  },

  rejected: {
    label: 'Rejected',
    className: 'border-red-200 bg-red-50 text-red-700',
    dotClassName: 'bg-red-500',
  },

  disbursed: {
    label: 'Disbursed',
    className: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    dotClassName: 'bg-indigo-500',
  },

  reconciled: {
    label: 'Reconciled',
    className: 'border-purple-200 bg-purple-50 text-purple-700',
    dotClassName: 'bg-purple-500',
  },
};

export function FundRequestStatusBadge({
  status,
}: FundRequestStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${config.className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${config.dotClassName}`}
      />

      {config.label}
    </span>
  );
}