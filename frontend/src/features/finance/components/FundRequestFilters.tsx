import { Search, SlidersHorizontal, X } from 'lucide-react';

import type {
  FundRequestListParams,
  FundRequestStage,
  FundRequestStatus,
  FundRequestType,
} from '../finance.types';

interface FundRequestFiltersProps {
  filters: FundRequestListParams;
  onFiltersChange: (filters: FundRequestListParams) => void;
}

const statusOptions: {
  value: FundRequestStatus;
  label: string;
}[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'manager_approved', label: 'Manager approved' },
  { value: 'finance_approved', label: 'Finance approved' },
  { value: 'approved', label: 'Ready for payment' },
  { value: 'disbursed', label: 'Paid — awaiting receipts' },
  { value: 'verified', label: 'Verified & closed' },
  { value: 'verification_failed', label: 'Receipts rejected' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const stageOptions: {
  value: FundRequestStage;
  label: string;
}[] = [
  { value: 'manager', label: 'Manager review' },
  { value: 'finance', label: 'Finance review' },
  { value: 'ceo', label: 'CEO approval' },
  { value: 'disbursement', label: 'Disbursement' },
  { value: 'verification', label: 'Receipt verification' },
  { value: 'closed', label: 'Closed' },
];

const typeOptions: {
  value: FundRequestType;
  label: string;
}[] = [
  { value: 'reimbursement', label: 'Reimbursement' },
  { value: 'advance', label: 'Advance' },
];

export function FundRequestFilters({
  filters,
  onFiltersChange,
}: FundRequestFiltersProps) {
  const hasActiveFilters = Boolean(
    filters.search ||
      filters.status ||
      filters.stage ||
      filters.request_type
  );

  const updateFilter = (
    key: keyof FundRequestListParams,
    value: string | undefined
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
      offset: 0,
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      limit: filters.limit,
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_190px_190px_180px_auto] lg:items-center">
        {/* Search */}
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <input
            type="search"
            value={filters.search ?? ''}
            onChange={(event) =>
              updateFilter('search', event.target.value)
            }
            placeholder="Search request number, title or requester..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>

        {/* Status */}
        <div className="relative">
          <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <select
            value={filters.status ?? ''}
            onChange={(event) =>
              updateFilter('status', event.target.value || undefined)
            }
            className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-10 pr-8 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          >
            <option value="">All statuses</option>

            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {/* Stage */}
        <div>
          <select
            value={filters.stage ?? ''}
            onChange={(event) =>
              updateFilter('stage', event.target.value || undefined)
            }
            className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          >
            <option value="">All stages</option>

            {stageOptions.map((stage) => (
              <option key={stage.value} value={stage.value}>
                {stage.label}
              </option>
            ))}
          </select>
        </div>

        {/* Type */}
        <div>
          <select
            value={filters.request_type ?? ''}
            onChange={(event) =>
              updateFilter(
                'request_type',
                event.target.value || undefined
              )
            }
            className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          >
            <option value="">All types</option>

            {typeOptions.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>

      {hasActiveFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">
            Filters active
          </span>

          {filters.search && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1">
              Search: {filters.search}
            </span>
          )}

          {filters.status && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1">
              Status:{' '}
              {
                statusOptions.find(
                  (option) => option.value === filters.status
                )?.label
              }
            </span>
          )}

          {filters.stage && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1">
              Stage:{' '}
              {
                stageOptions.find(
                  (option) => option.value === filters.stage
                )?.label
              }
            </span>
          )}

          {filters.request_type && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1">
              Type:{' '}
              {
                typeOptions.find(
                  (option) =>
                    option.value === filters.request_type
                )?.label
              }
            </span>
          )}
        </div>
      )}
    </div>
  );
}
