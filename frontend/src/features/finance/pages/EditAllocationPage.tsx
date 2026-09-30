import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { api } from '../../../services/api';
import { allocationService } from '../allocation.service';
import type { Allocation } from '../allocation.types';
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

export default function EditAllocationPage() {
  const navigate = useNavigate();

  const { allocationId } = useParams<{
    allocationId: string;
  }>();

  const [allocation, setAllocation] =
    useState<Allocation | null>(null);

  const [budget, setBudget] =
    useState<Budget | null>(null);

  const [organisations, setOrganisations] = useState<
    Organisation[]
  >([]);

  const [departments, setDepartments] = useState<
    Department[]
  >([]);

  const [programmes, setProgrammes] = useState<
    Programme[]
  >([]);

  const [projects, setProjects] = useState<Project[]>(
    [],
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  const selectedOrganisation = useMemo(
    () =>
      organisations.find(
        (organisation) =>
          organisation.id ===
          form.organisation_id,
      ),
    [organisations, form.organisation_id],
  );

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

      const [
        allocationData,
        organisationResponse,
      ] = await Promise.all([
        allocationService.getAllocation(
          allocationId,
        ),
        api.get<Organisation[]>(
          '/organisation/',
          {
            params: {
              status: 'active',
            },
          },
        ),
      ]);

      setAllocation(allocationData);
      setOrganisations(
        organisationResponse.data || [],
      );

      setForm({
        name: allocationData.name || '',
        description:
          allocationData.description || '',
        amount: String(
          allocationData.amount ?? '',
        ),
        currency:
          allocationData.currency || 'GHS',
        organisation_id:
          allocationData.organisation_id || '',
        department_id:
          allocationData.department_id || '',
        programme_id:
          allocationData.programme_id || '',
        project_id:
          allocationData.project_id || '',
        notes: allocationData.notes || '',
      });

      try {
        const budgetData =
          await budgetService.getBudget(
            allocationData.budget_id,
          );

        setBudget(budgetData);
      } catch {
        setBudget(null);
      }

      if (allocationData.organisation_id) {
        await loadOrganisationStructure(
          allocationData.organisation_id,
        );
      }

      if (
        allocationData.organisation_id &&
        allocationData.department_id
      ) {
        await loadProgrammes(
          allocationData.organisation_id,
          allocationData.department_id,
        );
      }

      await loadProjects(
        allocationData.organisation_id || '',
        allocationData.department_id || '',
        allocationData.programme_id || '',
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          'Failed to load allocation.',
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

  async function loadProjects(
    organisationId: string,
    departmentId: string,
    programmeId: string,
  ) {
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
            organisationId &&
            project.organisation_id &&
            project.organisation_id !==
              organisationId
          ) {
            return false;
          }

          if (
            departmentId &&
            project.department_id &&
            project.department_id !== departmentId
          ) {
            return false;
          }

          if (
            programmeId &&
            project.programme_id &&
            project.programme_id !== programmeId
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

  async function handleOrganisationChange(
    organisationId: string,
  ) {
    setForm((current) => ({
      ...current,
      organisation_id: organisationId,
      department_id: '',
      programme_id: '',
      project_id: '',
    }));

    setDepartments([]);
    setProgrammes([]);
    setProjects([]);

    if (organisationId) {
      await loadOrganisationStructure(
        organisationId,
      );

      await loadProjects(
        organisationId,
        '',
        '',
      );
    }
  }

  async function handleDepartmentChange(
    departmentId: string,
  ) {
    setForm((current) => ({
      ...current,
      department_id: departmentId,
      programme_id: '',
      project_id: '',
    }));

    setProgrammes([]);
    setProjects([]);

    if (
      form.organisation_id &&
      departmentId
    ) {
      await loadProgrammes(
        form.organisation_id,
        departmentId,
      );

      await loadProjects(
        form.organisation_id,
        departmentId,
        '',
      );
    }
  }

  async function handleProgrammeChange(
    programmeId: string,
  ) {
    setForm((current) => ({
      ...current,
      programme_id: programmeId,
      project_id: '',
    }));

    setProjects([]);

    if (form.organisation_id) {
      await loadProjects(
        form.organisation_id,
        form.department_id,
        programmeId,
      );
    }
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!allocationId || !allocation) {
      return;
    }

    setError('');

    if (!form.name.trim()) {
      setError(
        'Please enter an allocation name.',
      );
      return;
    }

    if (!form.amount) {
      setError(
        'Please enter an allocation amount.',
      );
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
      budget &&
      amount > Number(budget.amount)
    ) {
      setError(
        'Allocation amount cannot exceed the budget amount.',
      );
      return;
    }

    try {
      setSaving(true);

      const updated =
        await allocationService.updateAllocation(
          allocationId,
          {
            name: form.name.trim(),
            description:
              form.description.trim() ||
              undefined,
            amount,
            currency:
              budget?.currency ||
              form.currency,
            organisation_id:
              form.organisation_id ||
              undefined,
            department_id:
              form.department_id ||
              undefined,
            programme_id:
              form.programme_id ||
              undefined,
            project_id:
              form.project_id ||
              undefined,
            notes:
              form.notes.trim() ||
              undefined,
          },
        );

      navigate(
        `/finance/allocations/${updated.id}`,
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          'Failed to update allocation.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Loading allocation...
      </div>
    );
  }

  if (!allocation) {
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

  if (
    allocation.status !== 'draft' &&
    allocation.status !== 'submitted'
  ) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <button
          type="button"
          onClick={() =>
            navigate(
              `/finance/allocations/${allocation.id}`,
            )
          }
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          ← Back to Allocation
        </button>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-gray-900">
            Allocation cannot be edited
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Only draft or submitted allocations can
            be edited.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <button
          type="button"
          onClick={() =>
            navigate(
              `/finance/allocations/${allocation.id}`,
            )
          }
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          ← Back to Allocation
        </button>

        <h1 className="mt-3 text-2xl font-semibold text-gray-900">
          Edit Allocation
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Update the allocation before it moves to the
          next workflow stage.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {budget && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900">
            Parent Budget
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <InfoCard
              label="Budget"
              value={`${budget.budget_number} — ${budget.name}`}
            />

            <InfoCard
              label="Budget Amount"
              value={formatCurrency(
                Number(budget.amount),
                budget.currency,
              )}
            />

            <InfoCard
              label="Budget Status"
              value={budget.status}
            />
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
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
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
              />
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
                  budget?.currency ||
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
            Select existing Shoova records. UUIDs are
            handled automatically.
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
                onChange={(event) =>
                  handleOrganisationChange(
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
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
                onChange={(event) =>
                  handleDepartmentChange(
                    event.target.value,
                  )
                }
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
                onChange={(event) =>
                  handleProgrammeChange(
                    event.target.value,
                  )
                }
                disabled={
                  !form.department_id
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 disabled:bg-gray-50"
              >
                <option value="">
                  Select programme
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
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900">
            Notes
          </h2>

          <textarea
            rows={4}
            value={form.notes}
            onChange={(event) =>
              updateField(
                'notes',
                event.target.value,
              )
            }
            placeholder="Add any additional notes..."
            className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
          />
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() =>
              navigate(
                `/finance/allocations/${allocation.id}`,
              )
            }
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Saving...'
              : 'Save Changes'}
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