import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { allocationService } from '../allocation.service';
import type {
  Allocation,
  AllocationStatus,
} from '../allocation.types';

const statusLabels: Record<AllocationStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  active: 'Active',
  closed: 'Closed',
};

const statusClasses: Record<AllocationStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-700',
};

const formatCurrency = (
  amount: number,
  currency: string,
) =>
  new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export default function AllocationsPage() {
  const navigate = useNavigate();

  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<
    AllocationStatus | ''
  >('');

  const loadAllocations = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await allocationService.getAllocations({
        search: search.trim() || undefined,
        status: status || undefined,
      });

      setAllocations(data);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          'Failed to load allocations.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllocations();
  }, [status]);

  const filteredAllocations = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return allocations;
    }

    return allocations.filter((allocation) =>
      [
        allocation.allocation_number,
        allocation.name,
        allocation.description,
        allocation.currency,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query),
        ),
    );
  }, [allocations, search]);

  const summary = useMemo(() => {
    return {
      total: allocations.length,
      draft: allocations.filter(
        (item) => item.status === 'draft',
      ).length,
      submitted: allocations.filter(
        (item) => item.status === 'submitted',
      ).length,
      approved: allocations.filter(
        (item) => item.status === 'approved',
      ).length,
      active: allocations.filter(
        (item) => item.status === 'active',
      ).length,
      closed: allocations.filter(
        (item) => item.status === 'closed',
      ).length,
    };
  }, [allocations]);

  const totalAmount = useMemo(() => {
    return allocations.reduce(
      (total, allocation) =>
        total + Number(allocation.amount || 0),
      0,
    );
  }, [allocations]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Allocations
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Distribute approved budget amounts across
            programmes, departments, projects, and
            activities.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate('/finance/allocations/new')
          }
          className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          + New Allocation
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <SummaryCard
          label="Total"
          value={summary.total}
        />

        <SummaryCard
          label="Draft"
          value={summary.draft}
        />

        <SummaryCard
          label="Submitted"
          value={summary.submitted}
        />

        <SummaryCard
          label="Approved"
          value={summary.approved}
        />

        <SummaryCard
          label="Active"
          value={summary.active}
        />

        <SummaryCard
          label="Closed"
          value={summary.closed}
        />
      </div>

      {/* Total */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-sm text-gray-500">
          Total Allocation Value
        </p>

        <p className="mt-1 text-2xl font-semibold text-gray-900">
          {formatCurrency(totalAmount, 'GHS')}
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px_auto]">
          <div>
            <label
              htmlFor="allocation-search"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Search
            </label>

            <input
              id="allocation-search"
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search allocation number or name..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
            />
          </div>

          <div>
            <label
              htmlFor="allocation-status"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Status
            </label>

            <select
              id="allocation-status"
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as
                    | AllocationStatus
                    | '',
                )
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
            >
              <option value="">All statuses</option>

              {(
                Object.keys(statusLabels) as AllocationStatus[]
              ).map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {statusLabels[item]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatus('');
              }}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 md:w-auto"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Loading allocations...
          </div>
        ) : filteredAllocations.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-gray-900">
              No allocations found
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Create an allocation to distribute an
              approved budget.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate('/finance/allocations/new')
              }
              className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Create Allocation
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <TableHeader>
                    Allocation
                  </TableHeader>

                  <TableHeader>
                    Budget
                  </TableHeader>

                  <TableHeader>
                    Amount
                  </TableHeader>

                  <TableHeader>
                    Status
                  </TableHeader>

                  <TableHeader>
                    Created
                  </TableHeader>

                  <TableHeader>
                    Action
                  </TableHeader>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredAllocations.map(
                  (allocation) => (
                    <tr
                      key={allocation.id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {allocation.name}
                          </p>

                          <p className="mt-0.5 text-xs text-gray-500">
                            {
                              allocation.allocation_number
                            }
                          </p>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <p className="text-sm text-gray-700">
                          {allocation.budget_id}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(
                            Number(
                              allocation.amount,
                            ),
                            allocation.currency,
                          )}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[allocation.status]}`}
                        >
                          {
                            statusLabels[
                              allocation.status
                            ]
                          }
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {formatDate(
                          allocation.created_at,
                        )}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/finance/allocations/${allocation.id}`,
                            )
                          }
                          className="text-sm font-medium text-gray-900 hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-1 text-2xl font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function TableHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th
      scope="col"
      className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
    >
      {children}
    </th>
  );
}