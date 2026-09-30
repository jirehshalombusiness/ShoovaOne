import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { api } from '../../../services/api';
import { budgetService } from '../budget.service';
import type {
  Budget,
  UpdateBudgetPayload,
} from '../budget.types';

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

const formatError = (
  error: any,
  fallback: string,
): string => {
  const message =
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    fallback;

  if (Array.isArray(message)) {
    return message
      .map(
        (item) =>
          item?.msg || String(item),
      )
      .join(', ');
  }

  return String(message);
};

const EditBudgetPage = () => {
  const { budgetId } =
    useParams<{ budgetId: string }>();

  const navigate = useNavigate();

  const [budget, setBudget] =
    useState<Budget | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [form, setForm] =
    useState<UpdateBudgetPayload>({
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

  const [organisations, setOrganisations] =
    useState<Organisation[]>([]);

  const [departments, setDepartments] =
    useState<Department[]>([]);

  const [programmes, setProgrammes] =
    useState<Programme[]>([]);

  const [projects, setProjects] =
    useState<Project[]>([]);

  const [loadingOrganisation, setLoadingOrganisation] =
    useState(true);

  const [loadingDepartments, setLoadingDepartments] =
    useState(false);

  const [loadingProgrammes, setLoadingProgrammes] =
    useState(false);

  const [loadingProjects, setLoadingProjects] =
    useState(false);

  /*
   * ----------------------------------------------------------
   * LOAD BUDGET
   * ----------------------------------------------------------
   */
  const loadBudget = async () => {
    if (!budgetId) {
      setError('Budget ID is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const data =
        await budgetService.getBudget(
          budgetId,
        );

      setBudget(data);

      setForm({
        name: data.name,
        description: data.description || '',
        fiscal_year: data.fiscal_year,
        start_date: data.start_date,
        end_date: data.end_date,
        amount: Number(data.amount),
        currency: data.currency,
        organisation_id:
          data.organisation_id || '',
        department_id:
          data.department_id || '',
        programme_id:
          data.programme_id || '',
        project_id:
          data.project_id || '',
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

        const response =
          await api.get<Organisation[]>(
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
          setError(
            formatError(
              err,
              'Failed to load organisations.',
            ),
          );
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
   * SELECTED ORGANISATION
   * ----------------------------------------------------------
   *
   * Prefer the organisation saved on the budget.
   * Otherwise fall back to the active Shoova organisation.
   */
  const activeOrganisation = useMemo(
    () =>
      organisations.find(
        (organisation) =>
          organisation.id ===
          form.organisation_id,
      ) ||
      organisations.find(
        (organisation) =>
          organisation.code === 'SHOOVA' &&
          organisation.status !== 'inactive',
      ) ||
      organisations.find(
        (organisation) =>
          organisation.status !== 'inactive',
      ) ||
      null,
    [organisations, form.organisation_id],
  );

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

        const response =
          await api.get<Department[]>(
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
          setError(
            formatError(
              err,
              'Failed to load departments.',
            ),
          );
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

        const response =
          await api.get<Programme[]>(
            `/organisation/${activeOrganisation.id}/programmes`,
            {
              params: {
                department_id:
                  form.department_id,
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
          setError(
            formatError(
              err,
              'Failed to load programmes.',
            ),
          );
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

        const response =
          await api.get<Project[]>(
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
   * FILTER PROJECTS
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
   * INITIAL LOAD
   * ----------------------------------------------------------
   */
  useEffect(() => {
    loadBudget();
  }, [budgetId]);

  /*
   * ----------------------------------------------------------
   * FORM CHANGE
   * ----------------------------------------------------------
   */
  const handleChange = (
    field: keyof UpdateBudgetPayload,
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

    if (!budgetId || !budget) {
      setError(
        'Budget information is unavailable.',
      );
      return;
    }

    setError('');

    if (
      budget.status !== 'draft' &&
      budget.status !== 'submitted'
    ) {
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

    if (
      !form.amount ||
      Number(form.amount) <= 0
    ) {
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

      const payload: UpdateBudgetPayload = {
        name: form.name.trim(),

        description:
          form.description?.trim() ||
          undefined,

        fiscal_year:
          form.fiscal_year.trim(),

        start_date: form.start_date,
        end_date: form.end_date,

        amount: Number(form.amount),

        currency:
          form.currency?.toUpperCase(),

        organisation_id:
          activeOrganisation?.id ||
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
          form.notes?.trim() ||
          undefined,
      };

      await budgetService.updateBudget(
        budgetId,
        payload,
      );

      navigate(
        `/finance/budgets/${budgetId}`,
      );
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

  /*
   * ----------------------------------------------------------
   * LOADING
   * ----------------------------------------------------------
   */
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

  /*
   * ----------------------------------------------------------
   * BUDGET NOT FOUND
   * ----------------------------------------------------------
   */
  if (!budget) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() =>
            navigate('/finance/budgets')
          }
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          ← Back to Budgets
        </button>

        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h2 className="font-semibold text-red-800">
            Unable to load budget
          </h2>

          <p className="mt-1 text-sm text-red-700">
            {error ||
              'Budget could not be found.'}
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

  /*
   * ----------------------------------------------------------
   * NON-EDITABLE BUDGET
   * ----------------------------------------------------------
   */
  if (!isEditable) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() =>
            navigate(
              `/finance/budgets/${budget.id}`,
            )
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
            . Only draft and submitted budgets
            can be edited.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate(
                `/finance/budgets/${budget.id}`,
              )
            }
            className="mt-5 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            View Budget
          </button>
        </div>
      </div>
    );
  }

  const busy =
    saving ||
    loadingOrganisation ||
    loadingDepartments ||
    loadingProgrammes ||
    loadingProjects;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() =>
            navigate(
              `/finance/budgets/${budget.id}`,
            )
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
            Update the basic details for this
            budget.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Name */}
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
                value={form.name || ''}
                onChange={(e) =>
                  handleChange(
                    'name',
                    e.target.value,
                  )
                }
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
                value={form.fiscal_year || ''}
                onChange={(e) =>
                  handleChange(
                    'fiscal_year',
                    e.target.value,
                  )
                }
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
                value={form.currency || 'GHS'}
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
                value={form.start_date || ''}
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
                value={form.end_date || ''}
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
                  form.amount
                    ? form.amount
                    : ''
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
            Programme and Project can remain blank
            when they have not yet been created or
            when they are not applicable.
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
                disabled={busy}
                placeholder="Describe the purpose and scope of this budget..."
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
                disabled={busy}
                placeholder="Add any internal notes or additional information..."
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
              navigate(
                `/finance/budgets/${budget.id}`,
              )
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
              ? 'Saving Changes...'
              : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditBudgetPage;