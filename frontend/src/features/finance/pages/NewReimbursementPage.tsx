import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Receipt,
  Save,
  Send,
  ShieldCheck,
} from 'lucide-react';

import { api } from '@/services/api';
import { reimbursementService } from '../reimbursement.service';

interface Organisation {
  id: string;
  name: string;
  code?: string | null;
  status?: string;
}

interface Department {
  id: string;
  organisation_id: string;
  name: string;
  code?: string | null;
  status?: string;
}

interface Programme {
  id: string;
  organisation_id: string;
  department_id?: string | null;
  name: string;
  code?: string | null;
  status?: string;
}

interface Project {
  id: string;
  name: string;
  code?: string | null;
  status?: string;
  organisation_id?: string | null;
  department_id?: string | null;
  programme_id?: string | null;
}

interface ReimbursementForm {
  title: string;
  description: string;
  category: string;
  amount: string;
  currency: string;
  incurred_date: string;
  department_id: string;
  programme_id: string;
  project_id: string;
  vendor_name: string;
  vendor_reference: string;
  payment_method: string;
}

const INITIAL_FORM: ReimbursementForm = {
  title: '',
  description: '',
  category: '',
  amount: '',
  currency: 'GHS',
  incurred_date: new Date().toISOString().split('T')[0],
  department_id: '',
  programme_id: '',
  project_id: '',
  vendor_name: '',
  vendor_reference: '',
  payment_method: '',
};

const REIMBURSEMENT_CATEGORIES = [
  'Operations',
  'Transport',
  'Travel',
  'Accommodation',
  'Supplies',
  'Equipment',
  'Utilities',
  'Professional Services',
  'Programme Activity',
  'Project Activity',
  'Staff Welfare',
  'Communications',
  'Training',
  'Other',
];

const PAYMENT_METHODS = [
  'Cash',
  'Personal Bank Transfer',
  'Personal Mobile Money',
  'Personal Card',
  'Other',
];

function getErrorMessage(error: any): string {
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    'Something went wrong. Please try again.'
  );
}

export function NewReimbursementPage() {
  const navigate = useNavigate();

  const [form, setForm] =
    useState<ReimbursementForm>(INITIAL_FORM);

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

  const [loadingOrganisationData, setLoadingOrganisationData] =
    useState(true);

  const [loadingDepartments, setLoadingDepartments] =
    useState(false);

  const [loadingProgrammes, setLoadingProgrammes] =
    useState(false);

  const [loadingProjects, setLoadingProjects] =
    useState(false);

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const activeOrganisation = useMemo(
    () =>
      organisations.find(
        (organisation) =>
          organisation.code === 'SHOOVA' &&
          organisation.status !== 'inactive'
      ) || null,
    [organisations]
  );

  const selectedDepartment = useMemo(
    () =>
      departments.find(
        (department) =>
          department.id === form.department_id
      ) || null,
    [departments, form.department_id]
  );

  useEffect(() => {
    loadOrganisationData();
  }, []);

  useEffect(() => {
    if (!activeOrganisation) {
      setDepartments([]);
      setProgrammes([]);
      setProjects([]);

      setForm((current) => ({
        ...current,
        department_id: '',
        programme_id: '',
        project_id: '',
      }));

      return;
    }

    loadDepartments(activeOrganisation.id);
    loadProjects(activeOrganisation.id);

    setForm((current) => ({
      ...current,
      department_id: '',
      programme_id: '',
      project_id: '',
    }));
  }, [activeOrganisation]);

  useEffect(() => {
    if (!activeOrganisation) {
      setProgrammes([]);
      return;
    }

    loadProgrammes(
      activeOrganisation.id,
      form.department_id || undefined
    );
  }, [activeOrganisation, form.department_id]);

  const loadOrganisationData = async () => {
    try {
      setLoadingOrganisationData(true);
      setError(null);

      const response = await api.get('/organisation/');

      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.items || [];

      setOrganisations(data);
    } catch (err) {
      console.error(
        'Failed to load organisations:',
        err
      );

      setError(getErrorMessage(err));
    } finally {
      setLoadingOrganisationData(false);
    }
  };

  const loadDepartments = async (
    organisationId: string
  ) => {
    try {
      setLoadingDepartments(true);

      const response = await api.get(
        `/organisation/${organisationId}/departments`,
        {
          params: {
            status: 'active',
          },
        }
      );

      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.items || [];

      setDepartments(data);
    } catch (err) {
      console.error(
        'Failed to load departments:',
        err
      );

      setDepartments([]);
      setError(getErrorMessage(err));
    } finally {
      setLoadingDepartments(false);
    }
  };

  const loadProgrammes = async (
    organisationId: string,
    departmentId?: string
  ) => {
    try {
      setLoadingProgrammes(true);

      const response = await api.get(
        `/organisation/${organisationId}/programmes`,
        {
          params: {
            status: 'active',
            ...(departmentId
              ? { department_id: departmentId }
              : {}),
          },
        }
      );

      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.items || [];

      setProgrammes(data);
    } catch (err) {
      console.error(
        'Failed to load programmes:',
        err
      );

      setProgrammes([]);
      setError(getErrorMessage(err));
    } finally {
      setLoadingProgrammes(false);
    }
  };

  const loadProjects = async (
    organisationId: string
  ) => {
    try {
      setLoadingProjects(true);

      const response = await api.get('/projects/', {
        params: {
          page: 1,
          page_size: 100,
        },
      });

      const raw = Array.isArray(response.data)
        ? response.data
        : response.data?.items || [];

      const organisationProjects = raw.filter(
        (project: Project) =>
          !project.organisation_id ||
          project.organisation_id === organisationId
      );

      setProjects(organisationProjects);
    } catch (err) {
      console.error(
        'Failed to load projects:',
        err
      );

      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      if (
        form.department_id &&
        project.department_id &&
        project.department_id !== form.department_id
      ) {
        return false;
      }

      if (
        form.programme_id &&
        project.programme_id &&
        project.programme_id !== form.programme_id
      ) {
        return false;
      }

      return true;
    });
  }, [
    projects,
    form.department_id,
    form.programme_id,
  ]);

  const updateField = (
    field: keyof ReimbursementForm,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError(null);
  };

  const handleDepartmentChange = (
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      department_id: value,
      programme_id: '',
      project_id: '',
    }));

    setError(null);
  };

  const handleProgrammeChange = (
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      programme_id: value,
      project_id: '',
    }));

    setError(null);
  };

  const validateForm = () => {
    if (!form.title.trim()) {
      return 'Reimbursement title is required.';
    }

    if (!form.category) {
      return 'Please select a reimbursement category.';
    }

    const amount = Number(form.amount);

    if (
      !form.amount ||
      Number.isNaN(amount) ||
      amount <= 0
    ) {
      return 'Enter a valid reimbursement amount greater than zero.';
    }

    if (!form.incurred_date) {
      return 'Expense date is required.';
    }

    if (!activeOrganisation) {
      return 'No active organisation is configured.';
    }

    if (!form.department_id) {
      return 'Please select a department.';
    }

    return null;
  };

  const createReimbursement = async () => {
    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return null;
    }

    const payload = {
      title: form.title.trim(),

      description:
        form.description.trim() || undefined,

      category: form.category,

      amount: Number(form.amount),

      currency: form.currency.toUpperCase(),

      incurred_date: form.incurred_date,

      department_id:
        form.department_id || undefined,

      programme_id:
        form.programme_id || undefined,

      project_id:
        form.project_id || undefined,

      payment_method:
        form.payment_method || undefined,

      vendor_name:
        form.vendor_name.trim() || undefined,

      vendor_reference:
        form.vendor_reference.trim() || undefined,
    };

    return reimbursementService.createReimbursement(
      payload
    );
  };

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      setError(null);

      const reimbursement =
        await createReimbursement();

      if (!reimbursement) {
        return;
      }

      navigate('/finance/reimbursements');
    } catch (err) {
      console.error(
        'Failed to create reimbursement:',
        err
      );

      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      const reimbursement =
        await createReimbursement();

      if (!reimbursement) {
        return;
      }

      await reimbursementService.submitReimbursement(
        reimbursement.id
      );

      navigate('/finance/reimbursements');
    } catch (err) {
      console.error(
        'Failed to submit reimbursement:',
        err
      );

      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const busy = saving || submitting;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              to="/finance/reimbursements"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Reimbursements
            </Link>

            <div className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-500">
              <Receipt className="h-4 w-4" />
              Expenditure
            </div>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              New Reimbursement
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Record a work-related expense that you
              personally paid and are requesting the
              organisation to reimburse.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-slate-600" />
            Finance-controlled record
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Organisation warning */}
      {!loadingOrganisationData &&
        !activeOrganisation && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-600" />

              <div>
                <h2 className="font-semibold text-amber-900">
                  Organisation structure not configured
                </h2>

                <p className="mt-1 text-sm leading-6 text-amber-800">
                  An active organisation is required
                  before a reimbursement can be assigned
                  to a department.
                </p>
              </div>
            </div>
          </div>
        )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {/* Reimbursement details */}
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2">
                <FileText className="h-5 w-5 text-slate-600" />
              </div>

              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Reimbursement Details
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Record the details of the expense you
                  personally paid.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Reimbursement Title
                <span className="text-red-500"> *</span>
              </label>

              <input
                type="text"
                value={form.title}
                onChange={(event) =>
                  updateField(
                    'title',
                    event.target.value
                  )
                }
                placeholder="e.g. Personal transport costs for field visit"
                disabled={busy}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Category
                <span className="text-red-500"> *</span>
              </label>

              <select
                value={form.category}
                onChange={(event) =>
                  updateField(
                    'category',
                    event.target.value
                  )
                }
                disabled={busy}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
              >
                <option value="">
                  Select category
                </option>

                {REIMBURSEMENT_CATEGORIES.map(
                  (category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Expense Date
                <span className="text-red-500"> *</span>
              </label>

              <div className="relative mt-2">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="date"
                  value={form.incurred_date}
                  onChange={(event) =>
                    updateField(
                      'incurred_date',
                      event.target.value
                    )
                  }
                  disabled={busy}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pl-10 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Amount
                <span className="text-red-500"> *</span>
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) =>
                  updateField(
                    'amount',
                    event.target.value
                  )
                }
                placeholder="0.00"
                disabled={busy}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Currency
              </label>

              <select
                value={form.currency}
                onChange={(event) =>
                  updateField(
                    'currency',
                    event.target.value
                  )
                }
                disabled={busy}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
              >
                <option value="GHS">
                  GHS — Ghana Cedi
                </option>

                <option value="USD">
                  USD — US Dollar
                </option>

                <option value="CAD">
                  CAD — Canadian Dollar
                </option>

                <option value="EUR">
                  EUR — Euro
                </option>
              </select>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Business Purpose / Description
              </label>

              <textarea
                rows={4}
                value={form.description}
                onChange={(event) =>
                  updateField(
                    'description',
                    event.target.value
                  )
                }
                placeholder="Explain why you incurred the expense and how it relates to Shoova's work..."
                disabled={busy}
                className="mt-2 w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
              />
            </div>
          </div>
        </section>

        {/* Organisational assignment */}
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Organisational Assignment
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Associate the reimbursement with the
                department, programme or project that
                incurred the cost.
              </p>
            </div>
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2">
            {/* Organisation */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Organisation
              </label>

              <input
                type="text"
                value={
                  activeOrganisation
                    ? `${activeOrganisation.name}${
                        activeOrganisation.code
                          ? ` (${activeOrganisation.code})`
                          : ''
                      }`
                    : ''
                }
                readOnly
                placeholder={
                  loadingOrganisationData
                    ? 'Loading organisation...'
                    : 'No active organisation'
                }
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 outline-none"
              />
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Department
                <span className="text-red-500"> *</span>
              </label>

              <select
                value={form.department_id}
                onChange={(event) =>
                  handleDepartmentChange(
                    event.target.value
                  )
                }
                disabled={
                  busy ||
                  !activeOrganisation ||
                  loadingOrganisationData
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
              >
                <option value="">
                  {loadingDepartments
                    ? 'Loading departments...'
                    : departments.length === 0
                      ? 'No departments available'
                      : 'Select department'}
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

            {/* Programme */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Programme
              </label>

              <select
                value={form.programme_id}
                onChange={(event) =>
                  handleProgrammeChange(
                    event.target.value
                  )
                }
                disabled={
                  busy ||
                  !activeOrganisation ||
                  loadingOrganisationData ||
                  loadingDepartments
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
              >
                <option value="">
                  {loadingProgrammes
                    ? 'Loading programmes...'
                    : 'No programme selected'}
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

            {/* Project */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Project
              </label>

              <select
                value={form.project_id}
                onChange={(event) =>
                  updateField(
                    'project_id',
                    event.target.value
                  )
                }
                disabled={
                  busy || loadingProjects
                }
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
              >
                <option value="">
                  {loadingProjects
                    ? 'Loading projects...'
                    : !selectedDepartment
                      ? 'Select department first'
                      : filteredProjects.length === 0
                        ? 'No matching projects'
                        : 'No project selected'}
                </option>

                {filteredProjects.map((project) => (
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
        </section>

        {/* Payment information */}
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Payment & Reference
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Capture how you personally paid and any
                supporting transaction reference.
              </p>
            </div>
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2">
            {/* Vendor */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Vendor / Payee
              </label>

              <input
                type="text"
                value={form.vendor_name}
                onChange={(event) =>
                  updateField(
                    'vendor_name',
                    event.target.value
                  )
                }
                placeholder="Vendor or service provider"
                disabled={busy}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
              />
            </div>

            {/* Reference */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Vendor / Transaction Reference
              </label>

              <input
                type="text"
                value={form.vendor_reference}
                onChange={(event) =>
                  updateField(
                    'vendor_reference',
                    event.target.value
                  )
                }
                placeholder="Receipt, invoice or transaction number"
                disabled={busy}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
              />
            </div>

            {/* Payment method */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Personal Payment Method
              </label>

              <select
                value={form.payment_method}
                onChange={(event) =>
                  updateField(
                    'payment_method',
                    event.target.value
                  )
                }
                disabled={busy}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"
              >
                <option value="">
                  Select payment method
                </option>

                {PAYMENT_METHODS.map((method) => (
                  <option
                    key={method}
                    value={method}
                  >
                    {method}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Workflow note */}
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

            <div>
              <h2 className="text-sm font-semibold text-blue-900">
                Reimbursement workflow
              </h2>

              <p className="mt-1 text-sm leading-6 text-blue-800">
                After submission, the reimbursement will
                move through review, approval, payment and
                reconciliation.
              </p>

              <p className="mt-2 text-xs font-medium text-blue-700">
                Draft → Submitted → Under Review → Approved
                → Paid → Reconciled
              </p>
            </div>
          </div>
        </section>

        {/* Actions */}
        <section className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/finance/reimbursements"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />

              {saving
                ? 'Saving...'
                : 'Save Draft'}
            </button>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />

              {submitting
                ? 'Submitting...'
                : 'Create & Submit'}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}