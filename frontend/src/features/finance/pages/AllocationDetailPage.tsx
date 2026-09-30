import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { allocationService } from '../allocation.service';
import type {
  Allocation,
  AllocationStatus,
} from '../allocation.types';
import { budgetService } from '../budget.service';
import type { Budget } from '../budget.types';

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

export default function AllocationDetailPage() {
  const navigate = useNavigate();
  const { allocationId } = useParams<{
    allocationId: string;
  }>();

  const [allocation, setAllocation] =
    useState<Allocation | null>(null);

  const [budget, setBudget] =
    useState<Budget | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [actionLoading, setActionLoading] =
    useState(false);

  const [actionError, setActionError] =
    useState('');

  const [closureReason, setClosureReason] =
    useState('');

  const [showClosureForm, setShowClosureForm] =
    useState(false);

  useEffect(() => {
    if (!allocationId) {
      setError('Allocation ID is missing.');
      setLoading(false);
      return;
    }

    loadAllocation();
  }, [allocationId]);

  async function loadAllocation() {
    if (!allocationId) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const allocationData =
        await allocationService.getAllocation(
          allocationId,
        );

      setAllocation(allocationData);

      try {
        const budgetData =
          await budgetService.getBudget(
            allocationData.budget_id,
          );

        setBudget(budgetData);
      } catch {
        setBudget(null);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          'Failed to load allocation.',
      );
    } finally {
      setLoading(false);
    }
  }

  const amount = useMemo(() => {
    if (!allocation) {
      return '';
    }

    return formatCurrency(
      Number(allocation.amount),
      allocation.currency,
    );
  }, [allocation]);

  async function handleSubmit() {
    if (!allocation) {
      return;
    }

    try {
      setActionLoading(true);
      setActionError('');

      const updated =
        await allocationService.submitAllocation(
          allocation.id,
        );

      setAllocation(updated);
    } catch (err: any) {
      setActionError(
        err?.response?.data?.detail ||
          'Failed to submit allocation.',
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove() {
    if (!allocation) {
      return;
    }

    try {
      setActionLoading(true);
      setActionError('');

      const updated =
        await allocationService.approveAllocation(
          allocation.id,
        );

      setAllocation(updated);
    } catch (err: any) {
      setActionError(
        err?.response?.data?.detail ||
          'Failed to approve allocation.',
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleActivate() {
    if (!allocation) {
      return;
    }

    try {
      setActionLoading(true);
      setActionError('');

      const updated =
        await allocationService.activateAllocation(
          allocation.id,
        );

      setAllocation(updated);
    } catch (err: any) {
      setActionError(
        err?.response?.data?.detail ||
          'Failed to activate allocation.',
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClose() {
    if (!allocation) {
      return;
    }

    if (!closureReason.trim()) {
      setActionError(
        'Please provide a reason for closing the allocation.',
      );
      return;
    }

    try {
      setActionLoading(true);
      setActionError('');

      const updated =
        await allocationService.closeAllocation(
          allocation.id,
          {
            reason: closureReason.trim(),
          },
        );

      setAllocation(updated);
      setClosureReason('');
      setShowClosureForm(false);
    } catch (err: any) {
      setActionError(
        err?.response?.data?.detail ||
          'Failed to close allocation.',
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Loading allocation...
      </div>
    );
  }

  if (error || !allocation) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() =>
            navigate('/finance/allocations')
          }
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          ← Back to Allocations
        </button>

        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || 'Allocation not found.'}
        </div>
      </div>
    );
  }

  const canEdit =
    allocation.status === 'draft' ||
    allocation.status === 'submitted';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <button
            type="button"
            onClick={() =>
              navigate('/finance/allocations')
            }
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            ← Back to Allocations
          </button>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">
              {allocation.name}
            </h1>

            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[allocation.status]}`}
            >
              {statusLabels[allocation.status]}
            </span>
          </div>

          <p className="mt-1 text-sm text-gray-500">
            {allocation.allocation_number}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/finance/allocations/${allocation.id}/edit`,
                )
              }
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Edit
            </button>
          )}

          {allocation.status === 'draft' && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={actionLoading}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {actionLoading
                ? 'Processing...'
                : 'Submit'}
            </button>
          )}

          {allocation.status === 'submitted' && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={actionLoading}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {actionLoading
                ? 'Processing...'
                : 'Approve'}
            </button>
          )}

          {allocation.status === 'approved' && (
            <button
              type="button"
              onClick={handleActivate}
              disabled={actionLoading}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {actionLoading
                ? 'Processing...'
                : 'Activate'}
            </button>
          )}

          {allocation.status === 'active' && (
            <button
              type="button"
              onClick={() =>
                setShowClosureForm(true)
              }
              disabled={actionLoading}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Errors */}
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Closure */}
      {showClosureForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900">
            Close Allocation
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Provide a reason for closing this allocation.
          </p>

          <textarea
            value={closureReason}
            onChange={(event) =>
              setClosureReason(event.target.value)
            }
            rows={4}
            placeholder="e.g. Allocation completed and all related expenditure has been reconciled."
            className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
          />

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowClosureForm(false);
                setClosureReason('');
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleClose}
              disabled={actionLoading}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {actionLoading
                ? 'Closing...'
                : 'Close Allocation'}
            </button>
          </div>
        </div>
      )}

      {/* Allocation summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard
          label="Allocation Amount"
          value={amount}
        />

        <MetricCard
          label="Currency"
          value={allocation.currency}
        />

        <MetricCard
          label="Status"
          value={statusLabels[allocation.status]}
        />
      </div>

      {/* Budget */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">
          Parent Budget
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <DetailItem
            label="Budget Number"
            value={
              budget?.budget_number ||
              allocation.budget_id
            }
          />

          <DetailItem
            label="Budget Name"
            value={
              budget?.name ||
              'Budget information unavailable'
            }
          />

          {budget && (
            <>
              <DetailItem
                label="Budget Amount"
                value={formatCurrency(
                  Number(budget.amount),
                  budget.currency,
                )}
              />

              <DetailItem
                label="Budget Status"
                value={budget.status}
              />
            </>
          )}
        </div>
      </section>

      {/* Details */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">
          Allocation Details
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <DetailItem
            label="Name"
            value={allocation.name}
          />

          <DetailItem
            label="Amount"
            value={amount}
          />

          <DetailItem
            label="Description"
            value={
              allocation.description ||
              'No description provided.'
            }
          />

          <DetailItem
            label="Created"
            value={formatDate(
              allocation.created_at,
            )}
          />

          <DetailItem
            label="Last Updated"
            value={formatDate(
              allocation.updated_at,
            )}
          />
        </div>
      </section>

      {/* Structure */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">
          Allocation Structure
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <DetailItem
            label="Organisation"
            value={
              allocation.organisation_id ||
              'Not assigned'
            }
          />

          <DetailItem
            label="Department"
            value={
              allocation.department_id ||
              'Not assigned'
            }
          />

          <DetailItem
            label="Programme"
            value={
              allocation.programme_id ||
              'Not assigned'
            }
          />

          <DetailItem
            label="Project"
            value={
              allocation.project_id ||
              'Not assigned'
            }
          />
        </div>

        <p className="mt-5 text-xs text-gray-500">
          These IDs are stored as system references. We
          can replace them with human-readable names once
          the allocation response is expanded to include
          related entity details.
        </p>
      </section>

      {/* Notes */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">
          Notes
        </h2>

        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">
          {allocation.notes ||
            'No notes have been added.'}
        </p>
      </section>

      {/* Timeline */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900">
          Workflow Timeline
        </h2>

        <div className="mt-5 space-y-4">
          <TimelineItem
            label="Created"
            date={allocation.created_at}
            completed
          />

          <TimelineItem
            label="Submitted"
            date={allocation.submitted_at}
            completed={Boolean(
              allocation.submitted_at,
            )}
          />

          <TimelineItem
            label="Approved"
            date={allocation.approved_at}
            completed={Boolean(
              allocation.approved_at,
            )}
          />

          <TimelineItem
            label="Activated"
            date={allocation.activated_at}
            completed={Boolean(
              allocation.activated_at,
            )}
          />

          <TimelineItem
            label="Closed"
            date={allocation.closed_at}
            completed={Boolean(
              allocation.closed_at,
            )}
          />
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-2 text-xl font-semibold capitalize text-gray-900">
        {value}
      </p>
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-1 break-words text-sm text-gray-900">
        {value}
      </p>
    </div>
  );
}

function TimelineItem({
  label,
  date,
  completed,
}: {
  label: string;
  date?: string | null;
  completed: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-1 h-3 w-3 rounded-full ${
          completed
            ? 'bg-gray-900'
            : 'border-2 border-gray-300 bg-white'
        }`}
      />

      <div>
        <p
          className={`text-sm font-medium ${
            completed
              ? 'text-gray-900'
              : 'text-gray-400'
          }`}
        >
          {label}
        </p>

        <p className="mt-0.5 text-xs text-gray-500">
          {date
            ? formatDate(date)
            : `Not yet ${label.toLowerCase()}`}
        </p>
      </div>
    </div>
  );
}

function formatCurrency(
  amount: number,
  currency: string,
) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  );
}