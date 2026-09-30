import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { budgetService } from '../budget.service';
import type { Budget, BudgetStatus } from '../budget.types';

const statusStyles: Record<BudgetStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  closed: 'bg-purple-100 text-purple-700',
};

const statusLabels: Record<BudgetStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  active: 'Active',
  closed: 'Closed',
};

const formatAmount = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
};

const formatDate = (date?: string | null) => {
  if (!date) return '—';

  return new Date(date).toLocaleDateString('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (date?: string | null) => {
  if (!date) return '—';

  return new Date(date).toLocaleString('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const BudgetDetailPage = () => {
  const { budgetId } = useParams<{ budgetId: string }>();
  const navigate = useNavigate();

  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  const [workflowNotes, setWorkflowNotes] = useState('');
  const [closeReason, setCloseReason] = useState('');

  const loadBudget = async () => {
    if (!budgetId) {
      setError('Budget ID is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const data = await budgetService.getBudget(budgetId);

      setBudget(data);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to load budget.';

      setError(
        Array.isArray(message)
          ? message.map((item) => item?.msg || String(item)).join(', ')
          : String(message),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudget();
  }, [budgetId]);

  const getErrorMessage = (err: any, fallback: string) => {
    const message =
      err?.response?.data?.detail ||
      err?.message ||
      fallback;

    if (Array.isArray(message)) {
      return message
        .map((item) => item?.msg || String(item))
        .join(', ');
    }

    return String(message);
  };

  const handleSubmit = async () => {
    if (!budgetId) return;

    try {
      setActionLoading(true);
      setError('');

      const updatedBudget = await budgetService.submitBudget(
        budgetId,
        workflowNotes.trim()
          ? { notes: workflowNotes.trim() }
          : undefined,
      );

      setBudget(updatedBudget);
      setWorkflowNotes('');
      setShowSubmitModal(false);
    } catch (err: any) {
      setError(
        getErrorMessage(
          err,
          'Failed to submit budget. Please try again.',
        ),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!budgetId) return;

    try {
      setActionLoading(true);
      setError('');

      const updatedBudget = await budgetService.approveBudget(
        budgetId,
        workflowNotes.trim()
          ? { notes: workflowNotes.trim() }
          : undefined,
      );

      setBudget(updatedBudget);
      setWorkflowNotes('');
      setShowApproveModal(false);
    } catch (err: any) {
      setError(
        getErrorMessage(
          err,
          'Failed to approve budget. Please try again.',
        ),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!budgetId) return;

    const confirmed = window.confirm(
      'Are you sure you want to activate this budget?',
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      setError('');

      const updatedBudget = await budgetService.activateBudget(budgetId);

      setBudget(updatedBudget);
    } catch (err: any) {
      setError(
        getErrorMessage(
          err,
          'Failed to activate budget. Please try again.',
        ),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    if (!budgetId) return;

    if (!closeReason.trim()) {
      setError('A closure reason is required.');
      return;
    }

    try {
      setActionLoading(true);
      setError('');

      const updatedBudget = await budgetService.closeBudget(budgetId, {
        reason: closeReason.trim(),
      });

      setBudget(updatedBudget);
      setCloseReason('');
      setShowCloseModal(false);
    } catch (err: any) {
      setError(
        getErrorMessage(
          err,
          'Failed to close budget. Please try again.',
        ),
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />

          <p className="mt-4 text-sm text-gray-500">
            Loading budget...
          </p>
        </div>
      </div>
    );
  }

  if (error && !budget) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/finance/budgets')}
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          ← Back to Budgets
        </button>

        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h2 className="font-semibold text-red-800">
            Unable to load budget
          </h2>

          <p className="mt-1 text-sm text-red-700">{error}</p>

          <button
            type="button"
            onClick={loadBudget}
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-gray-900">
          Budget not found
        </h2>

        <button
          type="button"
          onClick={() => navigate('/finance/budgets')}
          className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Back to Budgets
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate('/finance/budgets')}
            className="mb-3 text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            ← Back to Budgets
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {budget.name}
            </h1>

            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                statusStyles[budget.status]
              }`}
            >
              {statusLabels[budget.status]}
            </span>
          </div>

          <p className="mt-1 text-sm text-gray-500">
            {budget.budget_number}
          </p>
        </div>

        {/* Workflow Actions */}
        <div className="flex flex-wrap gap-2">
          {budget.status === 'draft' && (
            <>
              <button
                type="button"
                onClick={() =>
                  navigate(`/finance/budgets/${budget.id}/edit`)
                }
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Edit
              </button>

              <button
                type="button"
                onClick={() => {
                  setWorkflowNotes('');
                  setShowSubmitModal(true);
                }}
                className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
              >
                Submit for Approval
              </button>
            </>
          )}

          {budget.status === 'submitted' && (
            <button
              type="button"
              onClick={() => {
                setWorkflowNotes('');
                setShowApproveModal(true);
              }}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Approve Budget
            </button>
          )}

          {budget.status === 'approved' && (
            <button
              type="button"
              onClick={handleActivate}
              disabled={actionLoading}
              className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading ? 'Activating...' : 'Activate Budget'}
            </button>
          )}

          {budget.status === 'active' && (
            <button
              type="button"
              onClick={() => {
                setCloseReason('');
                setShowCloseModal(true);
              }}
              className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
            >
              Close Budget
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError('')}
            className="ml-4 font-medium hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">
            Budget Amount
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900">
            {formatAmount(budget.amount, budget.currency)}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Fiscal Year {budget.fiscal_year}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">
            Budget Period
          </p>

          <p className="mt-2 text-lg font-semibold text-gray-900">
            {formatDate(budget.start_date)}
          </p>

          <p className="mt-1 text-sm text-gray-500">
            to {formatDate(budget.end_date)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">
            Current Status
          </p>

          <div className="mt-3">
            <span
              className={`inline-flex rounded-full px-3 py-1.5 text-sm font-medium ${
                statusStyles[budget.status]
              }`}
            >
              {statusLabels[budget.status]}
            </span>
          </div>
        </div>
      </div>

      {/* Budget Details */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* General Information */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Budget Information
            </h2>
          </div>

          <div className="divide-y divide-gray-100">
            <div className="flex items-start justify-between gap-4 px-6 py-4">
              <span className="text-sm text-gray-500">
                Budget Number
              </span>

              <span className="text-right text-sm font-medium text-gray-900">
                {budget.budget_number}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4 px-6 py-4">
              <span className="text-sm text-gray-500">
                Fiscal Year
              </span>

              <span className="text-right text-sm font-medium text-gray-900">
                {budget.fiscal_year}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4 px-6 py-4">
              <span className="text-sm text-gray-500">
                Currency
              </span>

              <span className="text-right text-sm font-medium text-gray-900">
                {budget.currency}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4 px-6 py-4">
              <span className="text-sm text-gray-500">
                Start Date
              </span>

              <span className="text-right text-sm font-medium text-gray-900">
                {formatDate(budget.start_date)}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4 px-6 py-4">
              <span className="text-sm text-gray-500">
                End Date
              </span>

              <span className="text-right text-sm font-medium text-gray-900">
                {formatDate(budget.end_date)}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4 px-6 py-4">
              <span className="text-sm text-gray-500">
                Created
              </span>

              <span className="text-right text-sm font-medium text-gray-900">
                {formatDateTime(budget.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Allocation */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Budget Allocation
            </h2>
          </div>

          <div className="divide-y divide-gray-100">
            <div className="flex items-start justify-between gap-4 px-6 py-4">
              <span className="text-sm text-gray-500">
                Organisation
              </span>

              <span className="max-w-[60%] break-all text-right text-sm font-medium text-gray-900">
                {budget.organisation_id || 'Not specified'}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4 px-6 py-4">
              <span className="text-sm text-gray-500">
                Department
              </span>

              <span className="max-w-[60%] break-all text-right text-sm font-medium text-gray-900">
                {budget.department_id || 'Not specified'}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4 px-6 py-4">
              <span className="text-sm text-gray-500">
                Programme
              </span>

              <span className="max-w-[60%] break-all text-right text-sm font-medium text-gray-900">
                {budget.programme_id || 'Not specified'}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4 px-6 py-4">
              <span className="text-sm text-gray-500">
                Project
              </span>

              <span className="max-w-[60%] break-all text-right text-sm font-medium text-gray-900">
                {budget.project_id || 'Not specified'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Description & Notes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Description
          </h2>

          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-600">
            {budget.description || 'No description provided.'}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Notes
          </h2>

          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-600">
            {budget.notes || 'No notes provided.'}
          </p>
        </div>
      </div>

      {/* Workflow Timeline */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Workflow
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Track the budget approval and activation lifecycle.
          </p>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            {/* Created */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                  1
                </div>

                <div className="mt-2 h-full w-px bg-gray-200" />
              </div>

              <div className="pb-2">
                <p className="font-medium text-gray-900">
                  Budget Created
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {formatDateTime(budget.created_at)}
                </p>
              </div>
            </div>

            {/* Submitted */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    budget.submitted_at
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  2
                </div>

                <div className="mt-2 h-full w-px bg-gray-200" />
              </div>

              <div className="pb-2">
                <p
                  className={`font-medium ${
                    budget.submitted_at
                      ? 'text-gray-900'
                      : 'text-gray-400'
                  }`}
                >
                  Submitted for Approval
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {budget.submitted_at
                    ? formatDateTime(budget.submitted_at)
                    : 'Not yet submitted'}
                </p>
              </div>
            </div>

            {/* Approved */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    budget.approved_at
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  3
                </div>

                <div className="mt-2 h-full w-px bg-gray-200" />
              </div>

              <div className="pb-2">
                <p
                  className={`font-medium ${
                    budget.approved_at
                      ? 'text-gray-900'
                      : 'text-gray-400'
                  }`}
                >
                  Approved
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {budget.approved_at
                    ? formatDateTime(budget.approved_at)
                    : 'Not yet approved'}
                </p>
              </div>
            </div>

            {/* Activated */}
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    budget.activated_at
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  4
                </div>

                <div className="mt-2 h-full w-px bg-gray-200" />
              </div>

              <div className="pb-2">
                <p
                  className={`font-medium ${
                    budget.activated_at
                      ? 'text-gray-900'
                      : 'text-gray-400'
                  }`}
                >
                  Activated
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {budget.activated_at
                    ? formatDateTime(budget.activated_at)
                    : 'Not yet activated'}
                </p>
              </div>
            </div>

            {/* Closed */}
            <div className="flex gap-4">
              <div>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    budget.closed_at
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  5
                </div>
              </div>

              <div>
                <p
                  className={`font-medium ${
                    budget.closed_at
                      ? 'text-gray-900'
                      : 'text-gray-400'
                  }`}
                >
                  Closed
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {budget.closed_at
                    ? formatDateTime(budget.closed_at)
                    : 'Not yet closed'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Submit Budget
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Submit this budget for approval? You can add an optional
              note for the reviewer.
            </p>

            <textarea
              value={workflowNotes}
              onChange={(e) => setWorkflowNotes(e.target.value)}
              rows={4}
              placeholder="Optional submission note..."
              className="mt-4 w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                disabled={actionLoading}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={actionLoading}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
              >
                {actionLoading ? 'Submitting...' : 'Submit Budget'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Approve Budget
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Approve this budget? You can add an optional approval note.
            </p>

            <textarea
              value={workflowNotes}
              onChange={(e) => setWorkflowNotes(e.target.value)}
              rows={4}
              placeholder="Optional approval note..."
              className="mt-4 w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                disabled={actionLoading}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {actionLoading ? 'Approving...' : 'Approve Budget'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">
              Close Budget
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Closing a budget is a final workflow action. Please
              provide a reason for closing it.
            </p>

            <textarea
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              rows={4}
              placeholder="Reason for closing this budget..."
              className="mt-4 w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                disabled={actionLoading}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleClose}
                disabled={actionLoading || !closeReason.trim()}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading ? 'Closing...' : 'Close Budget'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetDetailPage;