import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { api } from '../../../services/api';
import { budgetService } from '../budget.service';
import type { CreateBudgetPayload } from '../budget.types';

interface Organisation {
  id: string;
  name: string;
  code?: string | null;
  status: string;
}

interface Department {
  id: string;
  organisation_id: string;
  name: string;
  code?: string | null;
  status: string;
}

interface Programme {
  id: string;
  organisation_id: string;
  department_id?: string | null;
  name: string;
  code?: string | null;
  status: string;
}

interface Project {
  id: string;
  name: string;
  code?: string | null;
  status?: string | null;
  department_id?: string | null;
  programme_id?: string | null;
  organisation_id?: string | null;
}

const getErrorMessage = (error: any): string => {
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    'Something went wrong. Please try again.'
  );
};

const NewBudgetPage = () => {
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState<CreateBudgetPayload>({
    name: '',
    description: '',
    fiscal_year: currentYear.toString(),
    start_date: `${currentYear}-01-01`,
    end_date: `${currentYear}-12-31`,
    amount: 0,
    currency: 'GHS',
    organisation_id: '',
    department_id: '',
    programme_id: '',
    project_id: '',
    notes: '',
  });

  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [loadingOrganisation, setLoadingOrganisation] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingProgrammes, setLoadingProgrammes] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  /*
   * ----------------------------------------------------------
   * SELECTED ORGANISATION
   * ----------------------------------------------------------
   *
   * Shoova currently has an organisation context already
   * configured in the system.
   *
   * We load active organisations and use the active one.
   */
  const activeOrganisation = useMemo(
    () =>
      organisations.find(
        (organisation) =>
          organisation.code === 'SHOOVA' &&
          organisation.status !== 'inactive',
      ) ||
      organisations.find(
        (organisation) => organisation.status !== 'inactive',
      ) ||
      null,
    [organisations],
  );

  /*
   * ----------------------------------------------------------
   * LOAD ORGANISATIONS
   * ----------------------------------------------------------
   */
  useEffect(() => {
    let mounted = true;

    const loadOrganisations = async () => {
      try {
        setLoadingOrganisation(true);
        setError('');

        const response = await api.get<Organisation[]>(
          '/organisation/',
          {
            params: {
              status: 'active',
            },
          },
        );

        if (mounted) {
          setOrganisations(
            Array.isArray(response.data)
              ? response.data
              : [],
          );
        }
      } catch (err) {
        console.error(
          'Failed to load organisations:',
          err,
        );

        if (mounted) {
          setOrganisations([]);
          setError(getErrorMessage(err));
        }
      } finally {
        if (mounted) {
          setLoadingOrganisation(false);
        }
      }
    };

    loadOrganisations();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * ----------------------------------------------------------
   * LOAD DEPARTMENTS
   * ----------------------------------------------------------
   */
  useEffect(() => {
    if (!activeOrganisation?.id) {
      setDepartments([]);
      return;
    }

    let mounted = true;

    const loadDepartments = async () => {
      try {
        setLoadingDepartments(true);

        const response = await api.get<Department[]>(
          `/organisation/${activeOrganisation.id}/departments`,
          {
            params: {
              status: 'active',
            },
          },
        );

        if (mounted) {
          setDepartments(
            Array.isArray(response.data)
              ? response.data
              : [],
          );
        }
      } catch (err) {
        console.error(
          'Failed to load departments:',
          err,
        );

        if (mounted) {
          setDepartments([]);
          setError(getErrorMessage(err));
        }
      } finally {
        if (mounted) {
          setLoadingDepartments(false);
        }
      }
    };

    loadDepartments();

    return () => {
      mounted = false;
    };
  }, [activeOrganisation?.id]);

  /*
   * ----------------------------------------------------------
   * LOAD PROGRAMMES
   * ----------------------------------------------------------
   *
   * Programmes depend on the selected department.
   *
   * If none exist yet, the dropdown will simply show
   * "No programmes available".
   */
  useEffect(() => {
    if (
      !activeOrganisation?.id ||
      !form.department_id
    ) {
      setProgrammes([]);
      return;
    }

    let mounted = true;

    const loadProgrammes = async () => {
      try {
        setLoadingProgrammes(true);

        const response = await api.get<Programme[]>(
          `/organisation/${activeOrganisation.id}/programmes`,
          {
            params: {
              department_id: form.department_id,
              status: 'active',
            },
          },
        );

        if (mounted) {
          setProgrammes(
            Array.isArray(response.data)
              ? response.data
              : [],
          );
        }
      } catch (err) {
        console.error(
          'Failed to load programmes:',
          err,
        );

        if (mounted) {
          setProgrammes([]);
          setError(getErrorMessage(err));
        }
      } finally {
        if (mounted) {
          setLoadingProgrammes(false);
        }
      }
    };

    loadProgrammes();

    return () => {
      mounted = false;
    };
  }, [
    activeOrganisation?.id,
    form.department_id,
  ]);

  /*
   * ----------------------------------------------------------
   * LOAD PROJECTS
   * ----------------------------------------------------------
   */
  useEffect(() => {
    let mounted = true;

    const loadProjects = async () => {
      try {
        setLoadingProjects(true);

        const response = await api.get<Project[]>(
          '/projects/',
          {
            params: {
              page: 1,
              page_size: 100,
            },
          },
        );

        if (mounted) {
          setProjects(
            Array.isArray(response.data)
              ? response.data
              : [],
          );
        }
      } catch (err) {
        console.error(
          'Failed to load projects:',
          err,
        );

        if (mounted) {
          setProjects([]);
        }
      } finally {
        if (mounted) {
          setLoadingProjects(false);
        }
      }
    };

    loadProjects();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * ----------------------------------------------------------
   * FILTER AVAILABLE PROJECTS
   * ----------------------------------------------------------
   */
  const availableProjects = useMemo(() => {
    if (!activeOrganisation?.id) {
      return [];
    }

    let filtered = projects.filter(
      (project) =>
        !project.organisation_id ||
        project.organisation_id ===
          activeOrganisation.id,
    );

    if (form.programme_id) {
      filtered = filtered.filter(
        (project) =>
          project.programme_id ===
          form.programme_id,
      );
    } else if (form.department_id) {
      filtered = filtered.filter(
        (project) =>
          project.department_id ===
          form.department_id,
      );
    }

    return filtered;
  }, [
    projects,
    activeOrganisation?.id,
    form.department_id,
    form.programme_id,
  ]);

  /*
   * ----------------------------------------------------------
   * FORM CHANGE
   * ----------------------------------------------------------
   */
  const handleChange = (
    field: keyof CreateBudgetPayload,
    value: string | number,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  /*
   * ----------------------------------------------------------
   * SUBMIT
   * ----------------------------------------------------------
   */
  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
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
      setError(
        'Start date and end date are required.',
      );
      return;
    }

    if (
      new Date(form.start_date) >
      new Date(form.end_date)
    ) {
      setError(
        'Start date cannot be after the end date.',
      );
      return;
    }

    if (!form.amount || form.amount <= 0) {
      setError(
        'Budget amount must be greater than zero.',
      );
      return;
    }

    if (!form.department_id) {
      setError(
        'Please select a department for this budget.',
      );
      return;
    }

    try {
      setSaving(true);

      /*
       * IMPORTANT:
       *
       * These values are UUIDs because they come directly
       * from the selected dropdown options.
       */
      const payload: CreateBudgetPayload = {
        name: form.name.trim(),
        description:
          form.description?.trim() || undefined,
        fiscal_year: form.fiscal_year.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        amount: Number(form.amount),
        currency: form.currency.toUpperCase(),

        organisation_id:
          activeOrganisation?.id || undefined,

        department_id:
          form.department_id || undefined,

        programme_id:
          form.programme_id || undefined,

        project_id:
          form.project_id || undefined,

        notes: form.notes?.trim() || undefined,
      };

      const budget =
        await budgetService.createBudget(payload);

      navigate(
        `/finance/budgets/${budget.id}`,
      );
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const busy =
    saving ||
    loadingOrganisation ||
    loadingDepartments ||
    loadingProgrammes ||
    loadingProjects;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() =>
              navigate('/finance/budgets')
            }
            className="mb-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            ← Back to Budgets
          </button>

          <h1 className="text-2xl font-bold text-gray-900">
            Create Budget
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Create a new budget and save it as a
            draft.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
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
                Budget Name{' '}
                <span className="text-red-500">
                  *
                </span>
              </label>

              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) =>
                  handleChange(
                    'name',
                    e.target.value,
                  )
                }
                placeholder="e.g. 2026 Restoration Programme Budget"
                disabled={busy}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50"
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
                <span className="text-red-500">
                  *
                </span>
              </label>

              <input
                id="fiscal_year"
                type="text"
                value={form.fiscal_year}
                onChange={(e) =>
                  handleChange(
                    'fiscal_year',
                    e.target.value,
                  )
                }
                placeholder="2026"
                disabled={busy}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50"
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
                <span className="text-red-500">
                  *
                </span>
              </label>

              <select
                id="currency"
                value={form.currency}
                onChange={(e) =>
                  handleChange(
                    'currency',
                    e.target.value,
                  )
                }
                disabled={busy}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50"
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
                <span className="text-red-500">
                  *
                </span>
              </label>

              <input
                id="start_date"
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  handleChange(
                    'start_date',
                    e.target.value,
                  )
                }
                disabled={busy}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50"
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
                <span className="text-red-500">
                  *
                </span>
              </label>

              <input
                id="end_date"
                type="date"
                value={form.end_date}
                onChange={(e) =>
                  handleChange(
                    'end_date',
                    e.target.value,
                  )
                }
                disabled={busy}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50"
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
                <span className="text-red-500">
                  *
                </span>
              </label>

              <input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={
                  form.amount === 0
                    ? ''
                    : form.amount
                }
                onChange={(e) =>
                  handleChange(
                    'amount',
                    e.target.value === ''
                      ? 0
                      : Number(
                          e.target.value,
                        ),
                  )
                }
                placeholder="0.00"
                disabled={busy}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50"
                required
              />
            </div>
          </div>
        </div>

        {/* Budget Allocation */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Budget Allocation
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Select the organisational area this
            budget belongs to. IDs are handled
            automatically by ShoovaOne.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Organisation */}
            <div>
              <label
                htmlFor="organisation"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Organisation
              </label>

              <div className="flex min-h-[42px] items-center rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm">
                {loadingOrganisation ? (
                  <span className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading organisation...
                  </span>
                ) : activeOrganisation ? (
                  <div>
                    <p className="font-medium text-gray-900">
                      {activeOrganisation.name}
                    </p>

                    {activeOrganisation.code && (
                      <p className="text-xs text-gray-500">
                        {activeOrganisation.code}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-red-600">
                    No active organisation available
                  </span>
                )}
              </div>
            </div>

            {/* Department */}
            <div>
              <label
                htmlFor="department_id"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Department{' '}
                <span className="text-red-500">
                  *
                </span>
              </label>

              <select
                id="department_id"
                value={form.department_id || ''}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    department_id:
                      e.target.value,
                    programme_id: '',
                    project_id: '',
                  }))
                }
                disabled={
                  busy ||
                  !activeOrganisation ||
                  departments.length === 0
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">
                  {loadingDepartments
                    ? 'Loading departments...'
                    : departments.length === 0
                      ? 'No departments available'
                      : 'Select department'}
                </option>

                {departments.map(
                  (department) => (
                    <option
                      key={department.id}
                      value={department.id}
                    >
                      {department.name}
                      {department.code
                        ? ` — ${department.code}`
                        : ''}
                    </option>
                  ),
                )}
              </select>
            </div>

            {/* Programme */}
            <div>
              <label
                htmlFor="programme_id"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Programme
              </label>

              <select
                id="programme_id"
                value={form.programme_id || ''}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    programme_id:
                      e.target.value,
                    project_id: '',
                  }))
                }
                disabled={
                  busy ||
                  !form.department_id ||
                  programmes.length === 0
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">
                  {loadingProgrammes
                    ? 'Loading programmes...'
                    : !form.department_id
                      ? 'Select a department first'
                      : programmes.length === 0
                        ? 'No programmes available'
                        : 'Select programme'}
                </option>

                {programmes.map(
                  (programme) => (
                    <option
                      key={programme.id}
                      value={programme.id}
                    >
                      {programme.name}
                      {programme.code
                        ? ` — ${programme.code}`
                        : ''}
                    </option>
                  ),
                )}
              </select>
            </div>

            {/* Project */}
            <div>
              <label
                htmlFor="project_id"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Project
              </label>

              <select
                id="project_id"
                value={form.project_id || ''}
                onChange={(e) =>
                  handleChange(
                    'project_id',
                    e.target.value,
                  )
                }
                disabled={
                  busy ||
                  !form.department_id ||
                  availableProjects.length === 0
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">
                  {loadingProjects
                    ? 'Loading projects...'
                    : !form.department_id
                      ? 'Select a department first'
                      : availableProjects.length ===
                          0
                        ? 'No matching projects available'
                        : 'Select project'}
                </option>

                {availableProjects.map(
                  (project) => (
                    <option
                      key={project.id}
                      value={project.id}
                    >
                      {project.name}
                      {project.code
                        ? ` — ${project.code}`
                        : ''}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
            You can leave Programme and Project blank
            when they have not yet been created or the
            budget applies more broadly.
          </div>
        </div>

        {/* Additional Information */}
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
                disabled={busy}
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50"
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
                disabled={busy}
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() =>
              navigate('/finance/budgets')
            }
            disabled={saving}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? 'Creating Budget...'
              : 'Create Budget'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewBudgetPage;