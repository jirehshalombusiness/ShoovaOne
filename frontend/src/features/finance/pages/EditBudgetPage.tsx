import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { budgetService } from '../budget.service';
import type {
  Budget,
  UpdateBudgetPayload,
} from '../budget.types';

const formatError = (err: any, fallback: string) => {
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

const EditBudgetPage = () => {
  const { budgetId } = useParams<{ budgetId: string }>();
  const navigate = useNavigate();

  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<UpdateBudgetPayload>({
    name: '',
    description: '',
    fiscal_year: '',
    start_date: '',
    end_date: '',
    amount: 0,
    currency: 'GHS',
    organisation_id: '',
    department_id: '',
    programme_id: '',
    project_id: '',
    notes: '',
  });

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

      setForm({
        name: data.name,
        description: data.description || '',
        fiscal_year: data.fiscal_year,
        start_date: data.start_date,
        end_date: data.end_date,
        amount: Number(data.amount),
        currency: data.currency,
        organisation_id: data.organisation_id || '',
        department_id: data.department_id || '',
        programme_id: data.programme_id || '',
        project_id: data.project_id || '',
        notes: data.notes || '',
      });
    } catch (err: any) {
      setError(
        formatError(
          err,
          'Failed to load budget. Please try again.',
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudget();
  }, [budgetId]);

  const handleChange = (
    field: keyof UpdateBudgetPayload,
    value: string | number,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!budgetId || !budget) {
      setError('Budget information is unavailable.');
      return;
    }

    setError('');

    if (budget.status !== 'draft' && budget.status !== 'submitted') {
      setError(
        'Only draft or submitted budgets can be edited.',
      );
      return;
    }

    if (!form.name?.trim()) {
      setError('Budget name is required.');
      return;
    }

    if (!form.fiscal_year?.trim()) {
      setError('Fiscal year is required.');
      return;
    }

    if (!form.start_date || !form.end_date) {
      setError('Start date and end date are required.');
      return;
    }

    if (
      new Date(form.start_date) >
      new Date(form.end_date)
    ) {
      setError('Start date cannot be after the end date.');
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      setError('Budget amount must be greater than zero.');
      return;
    }

    try {
      setSaving(true);

      const payload: UpdateBudgetPayload = {
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        fiscal_year: form.fiscal_year.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        amount: Number(form.amount),
        currency: form.currency?.toUpperCase(),
        organisation_id:
          form.organisation_id?.trim() || undefined,
        department_id:
          form.department_id?.trim() || undefined,
        programme_id:
          form.programme_id?.trim() || undefined,
        project_id:
          form.project_id?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
      };

      await budgetService.updateBudget(budgetId, payload);

      navigate(`/finance/budgets/${budgetId}`);
    } catch (err: any) {
      setError(
        formatError(
          err,
          'Failed to update budget. Please try again.',
        ),
      );
    } finally {
      setSaving(false);
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

  if (!budget) {
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

          <p className="mt-1 text-sm text-red-700">
            {error || 'Budget could not be found.'}
          </p>

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

  const isEditable =
    budget.status === 'draft' ||
    budget.status === 'submitted';

  if (!isEditable) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() =>
            navigate(`/finance/budgets/${budget.id}`)
          }
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          ← Back to Budget
        </button>

        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            !
          </div>

          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            Budget cannot be edited
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            This budget is currently{' '}
            <span className="font-medium">
              {budget.status}
            </span>
            . Only draft and submitted budgets can be edited.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate(`/finance/budgets/${budget.id}`)
            }
            className="mt-5 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            View Budget
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() =>
            navigate(`/finance/budgets/${budget.id}`)
          }
          className="mb-3 text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          ← Back to Budget
        </button>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Edit Budget
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              {budget.budget_number}
            </p>
          </div>

          <span className="inline-flex w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-medium capitalize text-gray-700">
            {budget.status}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Budget Information
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Update the basic details for this budget.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Name */}
            <div className="md:col-span-2">
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Budget Name{' '}
                <span className="text-red-500">*</span>
              </label>

              <input
                id="name"
                type="text"
                value={form.name || ''}
                onChange={(e) =>
                  handleChange('name', e.target.value)
                }
                placeholder="e.g. 2026 Restoration Programme Budget"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                required
              />
            </div>

            {/* Fiscal Year */}
            <div>
              <label
                htmlFor="fiscal_year"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Fiscal Year{' '}
                <span className="text-red-500">*</span>
              </label>

              <input
                id="fiscal_year"
                type="text"
                value={form.fiscal_year || ''}
                onChange={(e) =>
                  handleChange(
                    'fiscal_year',
                    e.target.value,
                  )
                }
                placeholder="2026"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                required
              />
            </div>

            {/* Currency */}
            <div>
              <label
                htmlFor="currency"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Currency{' '}
                <span className="text-red-500">*</span>
              </label>

              <select
                id="currency"
                value={form.currency || 'GHS'}
                onChange={(e) =>
                  handleChange(
                    'currency',
                    e.target.value,
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              >
                <option value="GHS">
                  GHS — Ghana Cedi
                </option>

                <option value="USD">
                  USD — US Dollar
                </option>

                <option value="EUR">
                  EUR — Euro
                </option>

                <option value="GBP">
                  GBP — British Pound
                </option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label
                htmlFor="start_date"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Start Date{' '}
                <span className="text-red-500">*</span>
              </label>

              <input
                id="start_date"
                type="date"
                value={form.start_date || ''}
                onChange={(e) =>
                  handleChange(
                    'start_date',
                    e.target.value,
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                required
              />
            </div>

            {/* End Date */}
            <div>
              <label
                htmlFor="end_date"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                End Date{' '}
                <span className="text-red-500">*</span>
              </label>

              <input
                id="end_date"
                type="date"
                value={form.end_date || ''}
                onChange={(e) =>
                  handleChange(
                    'end_date',
                    e.target.value,
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                required
              />
            </div>

            {/* Amount */}
            <div>
              <label
                htmlFor="amount"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Budget Amount{' '}
                <span className="text-red-500">*</span>
              </label>

              <input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount || ''}
                onChange={(e) =>
                  handleChange(
                    'amount',
                    e.target.value === ''
                      ? 0
                      : Number(e.target.value),
                  )
                }
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                required
              />
            </div>
          </div>
        </div>

        {/* Allocation */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Budget Allocation
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Associate the budget with the relevant organisational
            units or project.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Organisation */}
            <div>
              <label
                htmlFor="organisation_id"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Organisation ID
              </label>

              <input
                id="organisation_id"
                type="text"
                value={form.organisation_id || ''}
                onChange={(e) =>
                  handleChange(
                    'organisation_id',
                    e.target.value,
                  )
                }
                placeholder="Organisation ID"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              />
            </div>

            {/* Department */}
            <div>
              <label
                htmlFor="department_id"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Department ID
              </label>

              <input
                id="department_id"
                type="text"
                value={form.department_id || ''}
                onChange={(e) =>
                  handleChange(
                    'department_id',
                    e.target.value,
                  )
                }
                placeholder="Department ID"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              />
            </div>

            {/* Programme */}
            <div>
              <label
                htmlFor="programme_id"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Programme ID
              </label>

              <input
                id="programme_id"
                type="text"
                value={form.programme_id || ''}
                onChange={(e) =>
                  handleChange(
                    'programme_id',
                    e.target.value,
                  )
                }
                placeholder="Programme ID"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              />
            </div>

            {/* Project */}
            <div>
              <label
                htmlFor="project_id"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Project ID
              </label>

              <input
                id="project_id"
                type="text"
                value={form.project_id || ''}
                onChange={(e) =>
                  handleChange(
                    'project_id',
                    e.target.value,
                  )
                }
                placeholder="Project ID"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>
        </div>

        {/* Description and Notes */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Additional Information
          </h2>

          <div className="mt-6 space-y-5">
            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Description
              </label>

              <textarea
                id="description"
                rows={4}
                value={form.description || ''}
                onChange={(e) =>
                  handleChange(
                    'description',
                    e.target.value,
                  )
                }
                placeholder="Describe the purpose and scope of this budget..."
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              />
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Notes
              </label>

              <textarea
                id="notes"
                rows={4}
                value={form.notes || ''}
                onChange={(e) =>
                  handleChange(
                    'notes',
                    e.target.value,
                  )
                }
                placeholder="Add any internal notes or additional information..."
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() =>
              navigate(`/finance/budgets/${budget.id}`)
            }
            disabled={saving}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditBudgetPage;