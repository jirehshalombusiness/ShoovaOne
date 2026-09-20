import {
  ArrowUpRight,
  ChevronRight,
  FileText,
  MoreHorizontal,
} from 'lucide-react';

import type { FundRequest } from '../finance.types';
import { FundRequestStatusBadge } from './FundRequestStatusBadge';

interface FundRequestTableProps {
  requests: FundRequest[];
  loading?: boolean;
  onView: (request: FundRequest) => void;
}

function formatCurrency(
  amount: number,
  currency: string = 'GHS'
) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date?: string | null) {
  if (!date) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

function getRequesterDisplay(request: FundRequest) {
  return request.requester_id
    ? request.requester_id
    : 'Unassigned';
}

function getProjectDisplay(request: FundRequest) {
  return request.project_id
    ? request.project_id
    : 'No project assigned';
}

export function FundRequestTable({
  requests,
  loading = false,
  onView,
}: FundRequestTableProps) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden md:block">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_40px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="h-3 animate-pulse rounded bg-slate-200"
              />
            ))}
          </div>

          {[1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_40px] gap-4 border-b border-slate-100 px-5 py-5 last:border-0"
            >
              {[1, 2, 3, 4, 5, 6].map((cell) => (
                <div
                  key={cell}
                  className="h-4 animate-pulse rounded bg-slate-100"
                />
              ))}
            </div>
          ))}
        </div>

        <div className="space-y-3 p-4 md:hidden">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-lg bg-slate-100"
            />
          ))}
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <FileText className="h-6 w-6" />
        </div>

        <h3 className="mt-4 text-sm font-semibold text-slate-900">
          No fund requests found
        </h3>

        <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">
          There are no funding requests matching the current
          filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Request
              </th>

              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Requester
              </th>

              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Project
              </th>

              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Amount
              </th>

              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Required By
              </th>

              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>

              <th className="w-12 px-3 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {requests.map((request) => (
              <tr
                key={request.id}
                className="group border-b border-slate-100 transition hover:bg-slate-50/70 last:border-0"
              >
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => onView(request)}
                    className="text-left"
                  >
                    <p className="text-xs font-semibold text-slate-500">
                      {request.request_number}
                    </p>

                    <p className="mt-1 max-w-[220px] truncate text-sm font-semibold text-slate-900 group-hover:text-slate-700">
                      {request.title}
                    </p>
                  </button>
                </td>

                <td className="px-5 py-4">
                  <p
                    className="max-w-[180px] truncate text-xs font-medium text-slate-600"
                    title={request.requester_id}
                  >
                    {getRequesterDisplay(request)}
                  </p>
                </td>

                <td className="px-5 py-4">
                  <p
                    className="max-w-[180px] truncate text-xs text-slate-600"
                    title={request.project_id ?? undefined}
                  >
                    {getProjectDisplay(request)}
                  </p>
                </td>

                <td className="px-5 py-4 text-right">
                  <p className="whitespace-nowrap text-sm font-semibold text-slate-900">
                    {formatCurrency(
                      request.amount_requested,
                      request.currency
                    )}
                  </p>

                  {request.approved_amount != null && (
                    <p className="mt-0.5 whitespace-nowrap text-xs text-slate-400">
                      Approved:{' '}
                      {formatCurrency(
                        request.approved_amount,
                        request.currency
                      )}
                    </p>
                  )}
                </td>

                <td className="px-5 py-4">
                  <p className="whitespace-nowrap text-sm text-slate-600">
                    {formatDate(request.required_by_date)}
                  </p>
                </td>

                <td className="px-5 py-4">
                  <FundRequestStatusBadge
                    status={request.status}
                  />
                </td>

                <td className="px-3 py-4">
                  <button
                    type="button"
                    onClick={() => onView(request)}
                    title="View request"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-slate-100 md:hidden">
        {requests.map((request) => (
          <button
            key={request.id}
            type="button"
            onClick={() => onView(request)}
            className="block w-full p-4 text-left transition hover:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-400">
                  {request.request_number}
                </p>

                <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                  {request.title}
                </p>
              </div>

              <FundRequestStatusBadge
                status={request.status}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Requester
                </p>

                <p
                  className="mt-1 truncate text-xs text-slate-700"
                  title={request.requester_id}
                >
                  {getRequesterDisplay(request)}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Amount
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatCurrency(
                    request.amount_requested,
                    request.currency
                  )}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Project
                </p>

                <p
                  className="mt-1 truncate text-xs text-slate-700"
                  title={request.project_id ?? undefined}
                >
                  {getProjectDisplay(request)}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Required By
                </p>

                <p className="mt-1 text-sm text-slate-700">
                  {formatDate(request.required_by_date)}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-medium text-slate-500">
              <span>View request</span>

              <ArrowUpRight className="h-4 w-4" />
            </div>
          </button>
        ))}
      </div>

      {/* Table footer */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
        <p className="text-xs text-slate-500">
          Showing{' '}
          <span className="font-medium text-slate-700">
            {requests.length}
          </span>{' '}
          request{requests.length === 1 ? '' : 's'}
        </p>

        <button
          type="button"
          className="hidden items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 sm:flex"
        >
          <MoreHorizontal className="h-4 w-4" />
          More actions
        </button>
      </div>
    </div>
  );
}