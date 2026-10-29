import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  FileCheck2,
  FileText,
  Loader2,
  Paperclip,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from 'lucide-react';

import { useHRAccess } from '@/hooks/useHRAccess';
import { api } from '@/services/api';
import { documentService } from '@/services/document.service';

import { financeService } from '../finance.service';
import type {
  FundRequest,
  FundRequestDetail,
  FundRequestDocument,
  FundRequestType,
} from '../finance.types';

interface Organisation {
  id: string;
  name: string;
  code?: string | null;
  status: string;
}

interface Department {
  id: string;
  name: string;
  code?: string | null;
  status: string;
}

interface Programme {
  id: string;
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

interface FundRequestFormProps {
  initial?: FundRequestDetail | null;
  onSaved: (request: FundRequest, submitted: boolean) => void;
  onCancel: () => void;
}

interface FormState {
  request_type: FundRequestType;
  title: string;
  description: string;
  justification: string;
  expense_date: string;
  department_id: string;
  programme_id: string;
  project_id: string;
  amount_requested: string;
  currency: string;
  required_by_date: string;
}

const emptyForm: FormState = {
  request_type: 'reimbursement',
  title: '',
  description: '',
  justification: '',
  expense_date: '',
  department_id: '',
  programme_id: '',
  project_id: '',
  amount_requested: '',
  currency: 'GHS',
  required_by_date: '',
};

const MAX_FILE_MB = 10;

function getErrorMessage(error: unknown) {
  const detail = (
    error as { response?: { data?: { detail?: unknown } } }
  )?.response?.data?.detail;

  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === 'object' && item && 'msg' in item
          ? String((item as { msg: unknown }).msg)
          : String(item)
      )
      .join(' ');
  }

  return (
    (error as { message?: string })?.message ||
    'We could not save the fund request. Please try again.'
  );
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FundRequestForm({
  initial,
  onSaved,
  onCancel,
}: FundRequestFormProps) {
  const isEdit = Boolean(initial);

  const access = useHRAccess();
  const canPickOrganisation = access.has('organisation.view');
  const canPickProjects = access.has('projects.view');
  const canClassify = canPickOrganisation || canPickProjects;

  const [form, setForm] = useState<FormState>(() =>
    initial
      ? {
          request_type: initial.request_type,
          title: initial.title,
          description: initial.description ?? '',
          justification: initial.justification ?? '',
          expense_date: toDateInput(initial.expense_date),
          department_id: initial.department_id ?? '',
          programme_id: initial.programme_id ?? '',
          project_id: initial.project_id ?? '',
          amount_requested: String(
            Number(initial.amount_requested ?? 0)
          ),
          currency: initial.currency,
          required_by_date: toDateInput(
            initial.required_by_date
          ),
        }
      : emptyForm
  );

  const [organisation, setOrganisation] =
    useState<Organisation | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [existingDocuments, setExistingDocuments] = useState<
    FundRequestDocument[]
  >(initial?.documents ?? []);

  const [newFiles, setNewFiles] = useState<File[]>([]);

  const [loadingLookups, setLoadingLookups] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReimbursement = form.request_type === 'reimbursement';
  const totalDocuments =
    existingDocuments.length + newFiles.length;

  const busy = saving || submitting || loadingLookups;

  // ---------------------------------------------------------
  // Lookups
  // ---------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    async function loadLookups() {
      try {
        setLoadingLookups(true);

        if (!canPickOrganisation && !canPickProjects) {
          return;
        }

        const [orgResult, projectResult] = await Promise.allSettled([
          canPickOrganisation
            ? api.get<Organisation[]>('/organisation/', {
                params: { status: 'active' },
              })
            : Promise.resolve(null),
          canPickProjects
            ? api.get<Project[]>('/projects/', {
                params: { page: 1, page_size: 100 },
              })
            : Promise.resolve(null),
        ]);

        if (!mounted) return;

        const activeOrganisation =
          orgResult.status === 'fulfilled'
            ? (orgResult.value?.data[0] ?? null)
            : null;

        setOrganisation(activeOrganisation);

        if (projectResult.status === 'fulfilled') {
          setProjects(projectResult.value?.data ?? []);
        }

        if (activeOrganisation) {
          const [deptResult, programmeResult] =
            await Promise.allSettled([
              api.get<Department[]>(
                `/organisation/${activeOrganisation.id}/departments`,
                { params: { status: 'active' } }
              ),
              api.get<Programme[]>(
                `/organisation/${activeOrganisation.id}/programmes`,
                { params: { status: 'active' } }
              ),
            ]);

          if (!mounted) return;

          if (deptResult.status === 'fulfilled') {
            setDepartments(deptResult.value.data);
          }

          if (programmeResult.status === 'fulfilled') {
            setProgrammes(programmeResult.value.data);
          }
        }
      } finally {
        if (mounted) setLoadingLookups(false);
      }
    }

    loadLookups();

    return () => {
      mounted = false;
    };
  }, [canPickOrganisation, canPickProjects]);

  const availableProjects = useMemo(() => {
    let filtered = projects;

    if (organisation?.id) {
      filtered = filtered.filter(
        (project) =>
          !project.organisation_id ||
          project.organisation_id === organisation.id
      );
    }

    if (form.programme_id) {
      return filtered.filter(
        (project) => project.programme_id === form.programme_id
      );
    }

    if (form.department_id) {
      return filtered.filter(
        (project) =>
          project.department_id === form.department_id
      );
    }

    return filtered;
  }, [
    projects,
    organisation?.id,
    form.department_id,
    form.programme_id,
  ]);

  const updateField = <K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  // ---------------------------------------------------------
  // Files
  // ---------------------------------------------------------

  const handleFilesSelected = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!selected.length) return;

    const tooLarge = selected.filter(
      (file) => file.size > MAX_FILE_MB * 1024 * 1024
    );

    if (tooLarge.length) {
      setError(
        `Each file must be ${MAX_FILE_MB} MB or smaller.`
      );
    }

    const accepted = selected.filter(
      (file) => file.size <= MAX_FILE_MB * 1024 * 1024
    );

    setNewFiles((current) => [...current, ...accepted]);
  };

  const removeNewFile = (index: number) => {
    setNewFiles((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  // ---------------------------------------------------------
  // Validate + save
  // ---------------------------------------------------------

  const validate = () => {
    if (form.title.trim().length < 3) {
      return 'Give the claim a title of at least 3 characters.';
    }

    if (
      !form.amount_requested ||
      Number(form.amount_requested) <= 0
    ) {
      return 'The claim amount must be greater than zero.';
    }

    if (isReimbursement && !form.expense_date) {
      return 'Record the date you spent the money.';
    }

    if (form.currency.trim().length !== 3) {
      return 'Select a valid three-letter currency.';
    }

    return null;
  };

  const buildPayload = () => ({
    request_type: form.request_type,
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    justification: form.justification.trim() || undefined,
    expense_date: isReimbursement
      ? form.expense_date
      : form.expense_date || undefined,
    department_id: form.department_id || undefined,
    programme_id: form.programme_id || undefined,
    project_id: form.project_id || undefined,
    amount_requested: Number(form.amount_requested),
    currency: form.currency.toUpperCase(),
    required_by_date: form.required_by_date || undefined,
  });

  const uploadFiles = async (requestId: string) => {
    for (const file of newFiles) {
      await documentService.upload(file, 'fund_request', requestId);
    }
  };

  const persist = async (submitAfterSave: boolean) => {
    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (submitAfterSave && totalDocuments === 0) {
      setError(
        'Attach at least one supporting document (receipt, invoice or quotation) before submitting.'
      );
      return;
    }

    try {
      if (submitAfterSave) {
        setSubmitting(true);
      } else {
        setSaving(true);
      }

      setError(null);

      const payload = buildPayload();

      let record: FundRequest;

      if (initial) {
        record = await financeService.updateMyFundRequest(
          initial.id,
          payload
        );
      } else {
        record = await financeService.createMyFundRequest(payload);
      }

      if (newFiles.length) {
        try {
          await uploadFiles(record.id);
        } catch (uploadError) {
          console.error('Document upload failed:', uploadError);

          throw new Error(
            'The claim was saved, but one or more documents could not be uploaded. Open the claim to retry the upload.'
          );
        }
      }

      if (submitAfterSave) {
        record = await financeService.submitMyFundRequest(record.id);
      }

      onSaved(record, submitAfterSave);
    } catch (err) {
      console.error('Failed to save fund request:', err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------
  // Render
  // ---------------------------------------------------------

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void persist(true);
      }}
      className="space-y-6"
    >
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

            <div>
              <h2 className="text-sm font-semibold text-red-900">
                Claim could not be processed
              </h2>

              <p className="mt-1 text-sm text-red-700">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* Claim type + details */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-base font-semibold text-slate-900">
                Claim Details
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Explain what you paid for, or what you need in
                advance, and why.
              </p>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Claim type
                </span>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      {
                        value: 'reimbursement',
                        title: 'Reimbursement',
                        description:
                          'I already spent my own money and need it back.',
                      },
                      {
                        value: 'advance',
                        title: 'Advance',
                        description:
                          'I need funds before the expense happens.',
                      },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        updateField(
                          'request_type',
                          option.value
                        )
                      }
                      className={`rounded-lg border p-4 text-left transition ${
                        form.request_type === option.value
                          ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {option.title}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {option.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="title"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Title
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <input
                  id="title"
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    updateField('title', event.target.value)
                  }
                  placeholder="e.g. Taxi fare for donor site visit"
                  disabled={busy}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  What was the money used for?
                </label>

                <textarea
                  id="description"
                  rows={4}
                  value={form.description}
                  onChange={(event) =>
                    updateField(
                      'description',
                      event.target.value
                    )
                  }
                  placeholder="Describe the expense, activity or purchase."
                  disabled={busy}
                  className="w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label
                  htmlFor="justification"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Why should Shoova cover it?
                </label>

                <textarea
                  id="justification"
                  rows={3}
                  value={form.justification}
                  onChange={(event) =>
                    updateField(
                      'justification',
                      event.target.value
                    )
                  }
                  placeholder="Explain the business need and expected outcome."
                  disabled={busy}
                  className="w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                />
              </div>
            </div>
          </section>

          {/* Financials */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-base font-semibold text-slate-900">
                Amount & Dates
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="amount_requested"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Amount
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <input
                  id="amount_requested"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount_requested}
                  onChange={(event) =>
                    updateField(
                      'amount_requested',
                      event.target.value
                    )
                  }
                  placeholder="0.00"
                  disabled={busy}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label
                  htmlFor="currency"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Currency
                </label>

                <select
                  id="currency"
                  value={form.currency}
                  onChange={(event) =>
                    updateField('currency', event.target.value)
                  }
                  disabled={busy}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                >
                  <option value="GHS">GHS — Ghana Cedi</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="expense_date"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  {isReimbursement
                    ? 'Date money was spent'
                    : 'Planned spend date'}

                  {isReimbursement && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                </label>

                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    id="expense_date"
                    type="date"
                    value={form.expense_date}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(event) =>
                      updateField(
                        'expense_date',
                        event.target.value
                      )
                    }
                    disabled={busy}
                    className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="required_by_date"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Needed by
                </label>

                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    id="required_by_date"
                    type="date"
                    value={form.required_by_date}
                    onChange={(event) =>
                      updateField(
                        'required_by_date',
                        event.target.value
                      )
                    }
                    disabled={busy}
                    className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Classification */}
          {canClassify && (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-base font-semibold text-slate-900">
                Classification
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Optional. Link the claim to a department,
                programme or project when it belongs to one.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="department_id"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Department
                </label>

                <select
                  id="department_id"
                  value={form.department_id}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      department_id: event.target.value,
                      programme_id: '',
                      project_id: '',
                    }));
                  }}
                  disabled={busy || departments.length === 0}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">
                    {loadingLookups
                      ? 'Loading departments...'
                      : 'No department'}
                  </option>

                  {departments.map((department) => (
                    <option
                      key={department.id}
                      value={department.id}
                    >
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="programme_id"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Programme
                </label>

                <select
                  id="programme_id"
                  value={form.programme_id}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      programme_id: event.target.value,
                      project_id: '',
                    }));
                  }}
                  disabled={busy || programmes.length === 0}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">
                    {loadingLookups
                      ? 'Loading programmes...'
                      : 'No programme'}
                  </option>

                  {programmes.map((programme) => (
                    <option
                      key={programme.id}
                      value={programme.id}
                    >
                      {programme.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="project_id"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Project
                </label>

                <select
                  id="project_id"
                  value={form.project_id}
                  onChange={(event) =>
                    updateField('project_id', event.target.value)
                  }
                  disabled={busy || availableProjects.length === 0}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">
                    {availableProjects.length === 0
                      ? 'No matching projects'
                      : 'No project'}
                  </option>

                  {availableProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>
          )}

          {/* Documents */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <Paperclip className="h-4 w-4" />
                </div>

                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Supporting Documents
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Receipts, invoices or quotations. At least one
                    document is required before the claim can be
                    submitted.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-6">
              {existingDocuments.length > 0 && (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {existingDocuments.map((document) => (
                    <div
                      key={document.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <a
                        href={document.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-w-0 items-center gap-3 text-sm font-medium text-slate-700 hover:text-slate-950"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-slate-400" />

                        <span className="truncate">
                          {document.name}
                        </span>
                      </a>

                      <span className="shrink-0 text-xs text-slate-400">
                        {formatBytes(document.file_size_bytes)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {newFiles.length > 0 && (
                <div className="divide-y divide-slate-100 rounded-lg border border-dashed border-slate-300 bg-slate-50">
                  {newFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <UploadCloud className="h-4 w-4 shrink-0 text-emerald-600" />

                        <span className="truncate text-sm text-slate-700">
                          {file.name}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-slate-400">
                          {formatBytes(file.size)}
                        </span>

                        <button
                          type="button"
                          onClick={() => removeNewFile(index)}
                          className="rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-red-600"
                          title="Remove file"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50">
                <UploadCloud className="h-4 w-4" />
                Add receipt, invoice or quotation
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={handleFilesSelected}
                  className="sr-only"
                />
              </label>

              <p className="text-xs text-slate-500">
                PDF or image files, up to {MAX_FILE_MB} MB each.
                {totalDocuments > 0 && (
                  <span className="ml-1 font-medium text-slate-700">
                    {totalDocuments} document
                    {totalDocuments === 1 ? '' : 's'} attached.
                  </span>
                )}
              </p>
            </div>
          </section>
        </div>

        {/* Side panel */}
        <aside className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <ShieldCheck className="h-5 w-5 text-slate-700" />
              </div>

              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Approval chain
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Every claim follows the same controlled chain.
                </p>
              </div>
            </div>

            <ol className="mt-5 space-y-3">
              {[
                'Your manager',
                'Finance review',
                'CEO approval',
                'Finance pays out',
                'Hand in signed receipts',
              ].map((step, index) => (
                <li
                  key={step}
                  className="flex items-center gap-3"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                    {index + 1}
                  </span>

                  <span className="text-sm text-slate-600">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-xl border border-amber-100 bg-amber-50/60 p-6">
            <h2 className="text-sm font-semibold text-amber-950">
              Hardcopy verification
            </h2>

            <p className="mt-2 text-xs leading-5 text-amber-800">
              After payment, hand the original signed receipts to
              Finance. The claim stays open until Finance verifies
              the hardcopy documents.
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <FileCheck2 className="mt-0.5 h-4 w-4 text-slate-500" />

              <p className="text-xs leading-5 text-slate-500">
                The requester can never approve their own claim,
                and the person paying it out must be a different
                person.
              </p>
            </div>
          </section>
        </aside>
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
        >
          Cancel
        </button>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void persist(false)}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}

            {isEdit ? 'Save changes' : 'Save draft'}
          </button>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}

            Submit for approval
          </button>
        </div>
      </div>
    </form>
  );
}
