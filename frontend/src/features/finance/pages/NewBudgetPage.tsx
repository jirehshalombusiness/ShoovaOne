import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { budgetService } from '../budget.service';
import type { CreateBudgetPayload } from '../budget.types';

const NewBudgetPage = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState<CreateBudgetPayload>({
    name: '',
    description: '',
    fiscal_year: new Date().getFullYear().toString(),
    start_date: `${new Date().getFullYear()}-01-01`,
    end_date: `${new Date().getFullYear()}-12-31`,
    amount: 0,
    currency: 'GHS',
    organisation_id: '',
    department_id: '',
    programme_id: '',
    project_id: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (
    field: keyof CreateBudgetPayload,
    value: string | number,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError('');

    if (!form.name.trim()) {
      setError('Budget name is required.');
      return;
    }

    if (!form.fiscal_year.trim()) {
      setError('Fiscal year is required.');
      return;
    }

    if (!form.start_date || !form.end_date) {
      setError('Start date and end date are required.');
      return;
    }

    if (new Date(form.start_date) > new Date(form.end_date)) {
      setError('Start date cannot be after the end date.');
      return;
    }

    if (!form.amount || form.amount <= 0) {
      setError('Budget amount must be greater than zero.');
      return;
    }

    try {
      setSaving(true);

      const payload: CreateBudgetPayload = {
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        fiscal_year: form.fiscal_year.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        amount: Number(form.amount),
        currency: form.currency.toUpperCase(),
        organisation_id: form.organisation_id || undefined,
        department_id: form.department_id || undefined,
        programme_id: form.programme_id || undefined,
        project_id: form.project_id || undefined,
        notes: form.notes?.trim() || undefined,
      };

      const budget = await budgetService.createBudget(payload);

      navigate(`/finance/budgets/${budget.id}`);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to create budget. Please try again.';

      setError(
        Array.isArray(message)
          ? message.map((item) => item?.msg || String(item)).join(', ')
          : String(message),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate('/finance/budgets')}
            className="mb-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            ← Back to Budgets
          </button>

          <h1 className="text-2xl font-bold text-gray-900">
            Create Budget
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Create a new budget and save it as a draft.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Budget Information
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Enter the basic details for this budget.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Budget Name */}
            <div className="md:col-span-2">
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Budget Name <span className="text-red-500">*</span>
              </label>

              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
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
                Fiscal Year <span className="text-red-500">*</span>
              </label>

              <input
                id="fiscal_year"
                type="text"
                value={form.fiscal_year}
                onChange={(e) =>
                  handleChange('fiscal_year', e.target.value)
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
                Currency <span className="text-red-500">*</span>
              </label>

              <select
                id="currency"
                value={form.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              >
                <option value="GHS">GHS — Ghana Cedi</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label
                htmlFor="start_date"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Start Date <span className="text-red-500">*</span>
              </label>

              <input
                id="start_date"
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  handleChange('start_date', e.target.value)
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
                End Date <span className="text-red-500">*</span>
              </label>

              <input
                id="end_date"
                type="date"
                value={form.end_date}
                onChange={(e) =>
                  handleChange('end_date', e.target.value)
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
                Budget Amount <span className="text-red-500">*</span>
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
                    e.target.value === '' ? 0 : Number(e.target.value),
                  )
                }
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                required
              />
            </div>
          </div>
        </div>

        {/* Organisational Allocation */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Budget Allocation
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Optionally associate this budget with an organisation,
            department, programme, or project.
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
                  handleChange('organisation_id', e.target.value)
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
                  handleChange('department_id', e.target.value)
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
                  handleChange('programme_id', e.target.value)
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
                  handleChange('project_id', e.target.value)
                }
                placeholder="Project ID"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
            You can leave these fields blank if the budget applies broadly.
          </div>
        </div>

        {/* Description & Notes */}
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
                  handleChange('description', e.target.value)
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
                onChange={(e) => handleChange('notes', e.target.value)}
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
            onClick={() => navigate('/finance/budgets')}
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
            {saving ? 'Creating Budget...' : 'Create Budget'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewBudgetPage;