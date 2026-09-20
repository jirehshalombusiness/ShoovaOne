import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { FundRequestListParams, FundRequestStatus } from '../finance.types';

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
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'disbursed', label: 'Disbursed' },
  { value: 'reconciled', label: 'Reconciled' },
];

export function FundRequestFilters({
  filters,
  onFiltersChange,
}: FundRequestFiltersProps) {
  const hasActiveFilters = Boolean(filters.search || filters.status);

  const updateFilter = (
    key: keyof FundRequestListParams,
    value: string | undefined
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      page: 1,
      page_size: filters.page_size,
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* Search */}
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <input
            type="search"
            value={filters.search ?? ''}
            onChange={(event) =>
              updateFilter('search', event.target.value)
            }
            placeholder="Search request number or title..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>

        {/* Status */}
        <div className="relative w-full lg:w-52">
          <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <select
            value={filters.status ?? ''}
            onChange={(event) =>
              updateFilter(
                'status',
                event.target.value || undefined
              )
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
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
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
        </div>
      )}
    </div>
  );
}