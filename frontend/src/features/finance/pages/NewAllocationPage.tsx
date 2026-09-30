import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { api } from '../../../services/api';
import { allocationService } from '../allocation.service';
import { budgetService } from '../budget.service';
import type { Budget } from '../budget.types';

interface Organisation {
  id: string;
  name: string;
  code?: string | null;
  status?: string | null;
}

interface Department {
  id: string;
  name: string;
  code?: string | null;
  status?: string | null;
}

interface Programme {
  id: string;
  name: string;
  code?: string | null;
  status?: string | null;
}

interface Project {
  id: string;
  name: string;
  code?: string | null;
  status?: string | null;
  organisation_id?: string | null;
  department_id?: string | null;
  programme_id?: string | null;
}

export default function NewAllocationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const budgetIdFromQuery =
    searchParams.get('budget_id') || '';

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [organisations, setOrganisations] = useState<
    Organisation[]
  >([]);
  const [departments, setDepartments] = useState<
    Department[]
  >([]);
  const [programmes, setProgrammes] = useState<
    Programme[]
  >([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [selectedBudgetId, setSelectedBudgetId] =
    useState(budgetIdFromQuery);

  const [form, setForm] = useState({
    name: '',
    description: '',
    amount: '',
    currency: 'GHS',
    organisation_id: '',
    department_id: '',
    programme_id: '',
    project_id: '',
    notes: '',
  });

  const selectedBudget = useMemo(
    () =>
      budgets.find(
        (budget) => budget.id === selectedBudgetId,
      ),
    [budgets, selectedBudgetId],
  );

  const selectedOrganisation = useMemo(
    () =>
      organisations.find(
        (organisation) =>
          organisation.id === form.organisation_id,
      ),
    [organisations, form.organisation_id],
  );

  const remainingBudget = useMemo(() => {
    if (!selectedBudget) {
      return 0;
    }

    return Number(selectedBudget.amount);
  }, [selectedBudget]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedBudgetId) {
      return;
    }

    const budget = budgets.find(
      (item) => item.id === selectedBudgetId,
    );

    if (!budget) {
      return;
    }

    setForm((current) => ({
      ...current,
      currency: budget.currency,
      organisation_id:
        budget.organisation_id || '',
      department_id:
        budget.department_id || '',
      programme_id:
        budget.programme_id || '',
      project_id:
        budget.project_id || '',
    }));
  }, [selectedBudgetId, budgets]);

  useEffect(() => {
    if (!form.organisation_id) {
      setDepartments([]);
      setProgrammes([]);
      return;
    }

    loadOrganisationStructure(
      form.organisation_id,
    );
  }, [form.organisation_id]);

  useEffect(() => {
    if (
      !form.organisation_id ||
      !form.department_id
    ) {
      setProgrammes([]);
      return;
    }

    loadProgrammes(
      form.organisation_id,
      form.department_id,
    );
  }, [
    form.organisation_id,
    form.department_id,
  ]);

  useEffect(() => {
    loadProjects();
  }, [
    form.organisation_id,
    form.department_id,
    form.programme_id,
  ]);

  async function loadInitialData() {
    try {
      setLoading(true);
      setError('');

      const [
        budgetData,
        organisationResponse,
      ] = await Promise.all([
        budgetService.getBudgets({
          status: 'approved',
        }),
        api.get<Organisation[]>(
          '/organisation/',
          {
            params: {
              status: 'active',
            },
          },
        ),
      ]);

      setBudgets(budgetData);

      const activeOrganisations =
        organisationResponse.data || [];

      setOrganisations(activeOrganisations);

      if (
        !budgetIdFromQuery &&
        activeOrganisations.length > 0
      ) {
        const shoova =
          activeOrganisations.find(
            (organisation) =>
              organisation.code?.toUpperCase() ===
              'SHOOVA',
          );

        if (shoova) {
          setForm((current) => ({
            ...current,
            organisation_id: shoova.id,
          }));
        }
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          'Failed to load allocation data.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadOrganisationStructure(
    organisationId: string,
  ) {
    try {
      const response =
        await api.get<Department[]>(
          `/organisation/${organisationId}/departments`,
          {
            params: {
              status: 'active',
            },
          },
        );

      setDepartments(response.data || []);
    } catch {
      setDepartments([]);
    }
  }

  async function loadProgrammes(
    organisationId: string,
    departmentId: string,
  ) {
    try {
      const response =
        await api.get<Programme[]>(
          `/organisation/${organisationId}/programmes`,
          {
            params: {
              department_id: departmentId,
              status: 'active',
            },
          },
        );

      setProgrammes(response.data || []);
    } catch {
      setProgrammes([]);
    }
  }

  async function loadProjects() {
    try {
      const response = await api.get<{
        items?: Project[];
      }>('/projects/', {
        params: {
          page: 1,
          page_size: 100,
        },
      });

      const items = response.data?.items || [];

      const filtered = items.filter(
        (project) => {
          if (
            form.organisation_id &&
            project.organisation_id &&
            project.organisation_id !==
              form.organisation_id
          ) {
            return false;
          }

          if (
            form.department_id &&
            project.department_id &&
            project.department_id !==
              form.department_id
          ) {
            return false;
          }

          if (
            form.programme_id &&
            project.programme_id &&
            project.programme_id !==
              form.programme_id
          ) {
            return false;
          }

          return true;
        },
      );

      setProjects(filtered);
    } catch {
      setProjects([]);
    }
  }

  function updateField(
    field: keyof typeof form,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleBudgetChange(
    budgetId: string,
  ) {
    setSelectedBudgetId(budgetId);

    const budget = budgets.find(
      (item) => item.id === budgetId,
    );

    setForm((current) => ({
      ...current,
      currency: budget?.currency || 'GHS',
      organisation_id:
        budget?.organisation_id || '',
      department_id:
        budget?.department_id || '',
      programme_id:
        budget?.programme_id || '',
      project_id:
        budget?.project_id || '',
    }));
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError('');

    if (!selectedBudgetId) {
      setError('Please select a budget.');
      return;
    }

    if (!form.name.trim()) {
      setError('Please enter an allocation name.');
      return;
    }

    if (!form.amount) {
      setError('Please enter an allocation amount.');
      return;
    }

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(
        'Allocation amount must be greater than zero.',
      );
      return;
    }

    if (
      selectedBudget &&
      amount > Number(selectedBudget.amount)
    ) {
      setError(
        'Allocation amount cannot exceed the selected budget amount.',
      );
      return;
    }

    try {
      setSaving(true);

      const allocation =
        await allocationService.createAllocation({
          budget_id: selectedBudgetId,
          name: form.name.trim(),
          description:
            form.description.trim() || undefined,
          amount,
          currency:
            selectedBudget?.currency ||
            form.currency,
          organisation_id:
            form.organisation_id || undefined,
          department_id:
            form.department_id || undefined,
          programme_id:
            form.programme_id || undefined,
          project_id:
            form.project_id || undefined,
          notes:
            form.notes.trim() || undefined,
        });

      navigate(
        `/finance/allocations/${allocation.id}`,
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          'Failed to create allocation.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Loading allocation form...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
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

        <h1 className="mt-3 text-2xl font-semibold text-gray-900">
          New Allocation
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Allocate part of an approved budget to a
          specific department, programme, project, or
          activity.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900">
            Budget
          </h2>

          <div className="mt-5 space-y-5">
            <div>
              <label
                htmlFor="budget"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Budget
              </label>

              <select
                id="budget"
                value={selectedBudgetId}
                onChange={(event) =>
                  handleBudgetChange(
                    event.target.value,
                  )
                }
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
              >
                <option value="">
                  Select an approved budget
                </option>

                {budgets.map((budget) => (
                  <option
                    key={budget.id}
                    value={budget.id}
                  >
                    {budget.budget_number} —{' '}
                    {budget.name} —{' '}
                    {formatCurrency(
                      Number(budget.amount),
                      budget.currency,
                    )}
                  </option>
                ))}
              </select>

              {budgets.length === 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  No approved budgets are currently
                  available for allocation.
                </p>
              )}
            </div>

            {selectedBudget && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <InfoCard
                  label="Budget Amount"
                  value={formatCurrency(
                    Number(selectedBudget.amount),
                    selectedBudget.currency,
                  )}
                />

                <InfoCard
                  label="Currency"
                  value={selectedBudget.currency}
                />

                <InfoCard
                  label="Budget Status"
                  value={
                    selectedBudget.status
                  }
                />
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900">
            Allocation Details
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Allocation Name
              </label>

              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(event) =>
                  updateField(
                    'name',
                    event.target.value,
                  )
                }
                placeholder="e.g. Land Reclamation Activities"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="description"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Description
              </label>

              <textarea
                id="description"
                rows={4}
                value={form.description}
                onChange={(event) =>
                  updateField(
                    'description',
                    event.target.value,
                  )
                }
                placeholder="Describe what this allocation will fund..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
              />
            </div>

            <div>
              <label
                htmlFor="amount"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Allocation Amount
              </label>

              <input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) =>
                  updateField(
                    'amount',
                    event.target.value,
                  )
                }
                placeholder="0.00"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
              />

              {selectedBudget && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Maximum based on budget:
                  {' '}
                  {formatCurrency(
                    remainingBudget,
                    selectedBudget.currency,
                  )}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="currency"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Currency
              </label>

              <input
                id="currency"
                type="text"
                value={
                  selectedBudget?.currency ||
                  form.currency
                }
                readOnly
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-600"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900">
            Allocation Structure
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            These fields use existing Shoova records.
            You do not need to enter UUIDs manually.
          </p>

          <div className="mt-5 space-y-5">
            <div>
              <label
                htmlFor="organisation"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Organisation
              </label>

              <select
                id="organisation"
                value={form.organisation_id}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    organisation_id:
                      event.target.value,
                    department_id: '',
                    programme_id: '',
                    project_id: '',
                  }));
                }}
                disabled={Boolean(
                  selectedBudget?.organisation_id,
                )}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 disabled:bg-gray-50"
              >
                <option value="">
                  Select organisation
                </option>

                {organisations.map(
                  (organisation) => (
                    <option
                      key={organisation.id}
                      value={organisation.id}
                    >
                      {organisation.name}
                      {organisation.code
                        ? ` (${organisation.code})`
                        : ''}
                    </option>
                  ),
                )}
              </select>

              {selectedOrganisation && (
                <p className="mt-1.5 text-xs text-gray-500">
                  {selectedOrganisation.name}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="department"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Department
              </label>

              <select
                id="department"
                value={form.department_id}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    department_id:
                      event.target.value,
                    programme_id: '',
                    project_id: '',
                  }));
                }}
                disabled={
                  !form.organisation_id
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 disabled:bg-gray-50"
              >
                <option value="">
                  Select department
                </option>

                {departments.map((department) => (
                  <option
                    key={department.id}
                    value={department.id}
                  >
                    {department.name}
                    {department.code
                      ? ` (${department.code})`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="programme"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Programme
              </label>

              <select
                id="programme"
                value={form.programme_id}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    programme_id:
                      event.target.value,
                    project_id: '',
                  }));
                }}
                disabled={
                  !form.department_id
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 disabled:bg-gray-50"
              >
                <option value="">
                  {form.department_id
                    ? 'Select programme'
                    : 'Select department first'}
                </option>

                {programmes.map((programme) => (
                  <option
                    key={programme.id}
                    value={programme.id}
                  >
                    {programme.name}
                    {programme.code
                      ? ` (${programme.code})`
                      : ''}
                  </option>
                ))}
              </select>

              {form.department_id &&
                programmes.length === 0 && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    No programmes are currently
                    available for this department.
                  </p>
                )}
            </div>

            <div>
              <label
                htmlFor="project"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Project
              </label>

              <select
                id="project"
                value={form.project_id}
                onChange={(event) =>
                  updateField(
                    'project_id',
                    event.target.value,
                  )
                }
                disabled={
                  !form.organisation_id
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 disabled:bg-gray-50"
              >
                <option value="">
                  Select project
                </option>

                {projects.map((project) => (
                  <option
                    key={project.id}
                    value={project.id}
                  >
                    {project.name}
                    {project.code
                      ? ` (${project.code})`
                      : ''}
                  </option>
                ))}
              </select>

              {form.organisation_id &&
                projects.length === 0 && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    No matching projects are
                    currently available.
                  </p>
                )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900">
            Notes
          </h2>

          <div className="mt-5">
            <textarea
              id="notes"
              rows={4}
              value={form.notes}
              onChange={(event) =>
                updateField(
                  'notes',
                  event.target.value,
                )
              }
              placeholder="Add any additional notes..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() =>
              navigate('/finance/allocations')
            }
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={
              saving || budgets.length === 0
            }
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Creating...'
              : 'Create Allocation'}
          </button>
        </div>
      </form>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold capitalize text-gray-900">
        {value}
      </p>
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