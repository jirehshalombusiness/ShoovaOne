import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  Save,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { api } from '../../../services/api';

import {
  financeService,
  type CreateFundRequestPayload,
} from '../finance.service';


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


function getErrorMessage(error: any) {
  return (
    error?.response?.data?.detail ||
    'We could not save the fund request. Please try again.'
  );
}


export function NewFundRequestPage() {
  const navigate = useNavigate();

  const [form, setForm] =
    useState<CreateFundRequestPayload>({
      title: '',
      description: '',
      justification: '',
      amount_requested: 0,
      currency: 'GHS',
      required_by_date: '',
      department_id: '',
      programme_id: '',
      project_id: '',
    });

  const [organisation, setOrganisation] =
    useState<Organisation | null>(null);

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

  const [organisationError, setOrganisationError] =
    useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] =
    useState<string | null>(null);


  /*
   * ----------------------------------------------------------
   * FORM HELPERS
   * ----------------------------------------------------------
   */

  const updateField = (
    field: keyof CreateFundRequestPayload,
    value: string | number
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };


  /*
   * ----------------------------------------------------------
   * LOAD ORGANISATION
   * ----------------------------------------------------------
   *
   * Shoova ONE currently has one organisation context.
   * We therefore load the active organisation and use it
   * as the parent for departments and programmes.
   */

  useEffect(() => {
    let mounted = true;

    const loadOrganisation = async () => {
      try {
        setLoadingOrganisation(true);
        setOrganisationError(null);

        const response = await api.get<Organisation[]>(
          '/organisation/',
          {
            params: {
              status: 'active',
            },
          }
        );

        if (!mounted) {
          return;
        }

        const activeOrganisation =
          response.data[0] ?? null;

        setOrganisation(activeOrganisation);

        if (!activeOrganisation) {
          setOrganisationError(
            'No active organisation has been configured yet.'
          );
        }
      } catch (err) {
        console.error(
          'Failed to load organisation:',
          err
        );

        if (mounted) {
          setOrganisationError(
            getErrorMessage(err)
          );
        }
      } finally {
        if (mounted) {
          setLoadingOrganisation(false);
        }
      }
    };

    loadOrganisation();

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
    if (!organisation?.id) {
      setDepartments([]);
      return;
    }

    let mounted = true;

    const loadDepartments = async () => {
      try {
        setLoadingDepartments(true);

        const response = await api.get<Department[]>(
          `/organisation/${organisation.id}/departments`,
          {
            params: {
              status: 'active',
            },
          }
        );

        if (mounted) {
          setDepartments(response.data);
        }
      } catch (err) {
        console.error(
          'Failed to load departments:',
          err
        );

        if (mounted) {
          setDepartments([]);
          setError(
            getErrorMessage(err)
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
  }, [organisation?.id]);


  /*
   * ----------------------------------------------------------
   * LOAD PROGRAMMES
   * ----------------------------------------------------------
   */

  useEffect(() => {
    if (
      !organisation?.id ||
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
          `/organisation/${organisation.id}/programmes`,
          {
            params: {
              department_id:
                form.department_id,
              status: 'active',
            },
          }
        );

        if (mounted) {
          setProgrammes(response.data);
        }
      } catch (err) {
        console.error(
          'Failed to load programmes:',
          err
        );

        if (mounted) {
          setProgrammes([]);
          setError(
            getErrorMessage(err)
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
    organisation?.id,
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
          }
        );

        if (mounted) {
          setProjects(response.data);
        }
      } catch (err) {
        console.error(
          'Failed to load projects:',
          err
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
   * PROJECT FILTERING
   * ----------------------------------------------------------
   *
   * If a programme is selected, projects belonging to that
   * programme are shown.
   *
   * Otherwise, projects belonging to the selected department
   * are shown.
   */

  const availableProjects = useMemo(() => {
    if (!organisation?.id) {
      return [];
    }

    let filtered = projects.filter(
      (project) =>
        !project.organisation_id ||
        project.organisation_id === organisation.id
    );

    if (form.programme_id) {
      filtered = filtered.filter(
        (project) =>
          project.programme_id ===
          form.programme_id
      );
    } else if (form.department_id) {
      filtered = filtered.filter(
        (project) =>
          project.department_id ===
          form.department_id
      );
    }

    return filtered;
  }, [
    projects,
    organisation?.id,
    form.department_id,
    form.programme_id,
  ]);


  /*
   * ----------------------------------------------------------
   * VALIDATION
   * ----------------------------------------------------------
   */

  const validate = () => {
    if (!form.title.trim()) {
      return 'Please provide a title for the fund request.';
    }

    if (form.title.trim().length < 3) {
      return 'The request title must be at least 3 characters.';
    }

    if (!form.department_id) {
      return 'Please select the department responsible for this request.';
    }

    if (
      form.amount_requested === undefined ||
      form.amount_requested === null ||
      form.amount_requested <= 0
    ) {
      return 'The requested amount must be greater than zero.';
    }

    return null;
  };


  /*
   * ----------------------------------------------------------
   * CREATE FUND REQUEST
   * ----------------------------------------------------------
   */

  const createRequest = async () => {
    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return null;
    }

    const payload: CreateFundRequestPayload = {
      title: form.title.trim(),

      description:
        form.description?.trim() ||
        undefined,

      justification:
        form.justification?.trim() ||
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

      amount_requested:
        Number(form.amount_requested),

      currency:
        form.currency.toUpperCase(),

      required_by_date:
        form.required_by_date ||
        undefined,
    };

    return financeService.createFundRequest(
      payload
    );
  };


  /*
   * ----------------------------------------------------------
   * SAVE DRAFT
   * ----------------------------------------------------------
   */

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      setError(null);

      const request = await createRequest();

      if (!request) {
        return;
      }

      navigate('/finance/fund-requests');
    } catch (err) {
      console.error(
        'Failed to save fund request:',
        err
      );

      setError(
        getErrorMessage(err)
      );
    } finally {
      setSaving(false);
    }
  };


  /*
   * ----------------------------------------------------------
   * SUBMIT REQUEST
   * ----------------------------------------------------------
   */

  const handleSubmit = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      const request = await createRequest();

      if (!request) {
        return;
      }

      await financeService.submitFundRequest(
        request.id
      );

      navigate('/finance/fund-requests');
    } catch (err) {
      console.error(
        'Failed to submit fund request:',
        err
      );

      setError(
        getErrorMessage(err)
      );
    } finally {
      setSubmitting(false);
    }
  };


  const busy =
    saving ||
    submitting ||
    loadingOrganisation ||
    loadingDepartments ||
    loadingProgrammes ||
    loadingProjects;


  /*
   * ----------------------------------------------------------
   * RENDER
   * ----------------------------------------------------------
   */

  return (
    <div className="space-y-6">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <section className="border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to="/finance/fund-requests"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Fund Requests
            </Link>

            <div className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-500">
              <ShieldCheck className="h-4 w-4" />
              Fund Management
            </div>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              New Fund Request
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Submit a formal funding request for an
              organisational, programme, project, or
              operational need.
            </p>
          </div>
        </div>
      </section>


      {/* =====================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100">
              <FileText className="h-5 w-5 text-red-700" />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-red-900">
                Request could not be processed
              </h2>

              <p className="mt-1 text-sm text-red-700">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}


      {/* =====================================================
          FORM
      ====================================================== */}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">

          {/* =================================================
              MAIN FORM
          ================================================== */}

          <div className="space-y-6">

            {/* ===============================================
                REQUEST DETAILS
            ================================================ */}

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-base font-semibold text-slate-900">
                  Request Details
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Describe what funding is required and why
                  it is needed.
                </p>
              </div>

              <div className="space-y-5 p-6">

                {/* Title */}

                <div>
                  <label
                    htmlFor="title"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Request Title
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    id="title"
                    type="text"
                    value={form.title}
                    onChange={(event) =>
                      updateField(
                        'title',
                        event.target.value
                      )
                    }
                    placeholder="e.g. Staff Capacity Building Workshop"
                    disabled={busy}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                  />
                </div>


                {/* Description */}

                <div>
                  <label
                    htmlFor="description"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Description
                  </label>

                  <textarea
                    id="description"
                    rows={5}
                    value={form.description}
                    onChange={(event) =>
                      updateField(
                        'description',
                        event.target.value
                      )
                    }
                    placeholder="Describe the activity, purchase, service, or operational need."
                    disabled={busy}
                    className="w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                  />
                </div>


                {/* Justification */}

                <div>
                  <label
                    htmlFor="justification"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Business Justification
                  </label>

                  <textarea
                    id="justification"
                    rows={5}
                    value={form.justification}
                    onChange={(event) =>
                      updateField(
                        'justification',
                        event.target.value
                      )
                    }
                    placeholder="Explain why the organisation needs this funding and the expected outcome."
                    disabled={busy}
                    className="w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                  />
                </div>

              </div>
            </section>


            {/* ===============================================
                ORGANISATIONAL ASSIGNMENT
            ================================================ */}

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">

              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex items-start justify-between gap-4">

                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Organisational Assignment
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Associate this request with the organisational
                      unit, programme, and project responsible for
                      the expenditure.
                    </p>
                  </div>

                  <div className="hidden rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 sm:block">
                    Financial classification
                  </div>

                </div>
              </div>


              <div className="space-y-5 p-6">

                {/* Organisation */}

                <div>
                  <label
                    htmlFor="organisation"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Organisation
                  </label>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    {loadingOrganisation ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading organisation...
                      </div>
                    ) : organisation ? (
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {organisation.name}
                        </p>

                        {organisation.code && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {organisation.code}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-amber-700">
                        No active organisation has been configured.
                      </p>
                    )}
                  </div>

                  {organisationError && (
                    <p className="mt-2 text-xs text-amber-700">
                      {organisationError}
                    </p>
                  )}
                </div>


                {/* Department */}

                <div>
                  <label
                    htmlFor="department_id"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Department
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <select
                    id="department_id"
                    value={form.department_id || ''}
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
                      busy ||
                      !organisation ||
                      departments.length === 0
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
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
                      )
                    )}
                  </select>
                </div>


                {/* Programme */}

                <div>
                  <label
                    htmlFor="programme_id"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Programme
                  </label>

                  <select
                    id="programme_id"
                    value={form.programme_id || ''}
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        programme_id:
                          event.target.value,
                        project_id: '',
                      }));
                    }}
                    disabled={
                      busy ||
                      !form.department_id ||
                      programmes.length === 0
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
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
                      )
                    )}
                  </select>
                </div>


                {/* Project */}

                <div>
                  <label
                    htmlFor="project_id"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Project
                  </label>

                  <select
                    id="project_id"
                    value={form.project_id || ''}
                    onChange={(event) =>
                      updateField(
                        'project_id',
                        event.target.value
                      )
                    }
                    disabled={
                      busy ||
                      !form.department_id ||
                      availableProjects.length === 0
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">
                      {loadingProjects
                        ? 'Loading projects...'
                        : !form.department_id
                          ? 'Select a department first'
                          : availableProjects.length === 0
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
                      )
                    )}
                  </select>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Select a project when the requested
                    funds are tied to a specific project.
                  </p>
                </div>

              </div>
            </section>


            {/* ===============================================
                FINANCIAL INFORMATION
            ================================================ */}

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">

              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-base font-semibold text-slate-900">
                  Financial Requirement
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Specify the amount required and when the
                  funds are needed.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">

                {/* Amount */}

                <div>
                  <label
                    htmlFor="amount_requested"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Amount Requested
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <input
                    id="amount_requested"
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.amount_requested === 0
                        ? ''
                        : form.amount_requested
                    }
                    onChange={(event) =>
                      updateField(
                        'amount_requested',
                        Number(
                          event.target.value
                        )
                      )
                    }
                    placeholder="0.00"
                    disabled={busy}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                  />
                </div>


                {/* Currency */}

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
                      updateField(
                        'currency',
                        event.target.value
                      )
                    }
                    disabled={busy}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
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


                {/* Required By */}

                <div className="sm:col-span-2">
                  <label
                    htmlFor="required_by_date"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Required By
                  </label>

                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      id="required_by_date"
                      type="date"
                      value={
                        form.required_by_date
                      }
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

          </div>


          {/* =================================================
              SIDE PANEL
          ================================================== */}

          <aside className="space-y-6">

            {/* Approval Workflow */}

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <ShieldCheck className="h-5 w-5 text-slate-700" />
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Approval Workflow
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Once submitted, the request enters the
                    Finance workflow for review and approval.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  'Draft',
                  'Submitted',
                  'Under Review',
                  'Approved',
                  'Disbursed',
                  'Reconciled',
                ].map((step, index) => (
                  <div
                    key={step}
                    className="flex items-center gap-3"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                      {index + 1}
                    </div>

                    <span className="text-sm text-slate-600">
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </section>


            {/* Before submitting */}

            <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-6">
              <h2 className="text-sm font-semibold text-blue-950">
                Before submitting
              </h2>

              <ul className="mt-3 space-y-2 text-xs leading-5 text-blue-800">
                <li>
                  • Confirm the requested amount.
                </li>

                <li>
                  • Select the correct department.
                </li>

                <li>
                  • Associate a programme or project
                  where applicable.
                </li>

                <li>
                  • Provide a clear business justification.
                </li>

                <li>
                  • Ensure the required date is realistic.
                </li>

                <li>
                  • Supporting documentation should be
                  available where required.
                </li>
              </ul>
            </section>


            {/* Organisational status */}

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <CheckCircle2 className="h-4 w-4 text-slate-700" />
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Classification
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Department is required for financial
                    accountability. Programme and project
                    assignment are used when applicable.
                  </p>
                </div>
              </div>
            </section>

          </aside>

        </div>


        {/* ===================================================
            ACTIONS
        ==================================================== */}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">

          <Link
            to="/finance/fund-requests"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Cancel
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row">

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}

              Save Draft
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

              Submit Request
            </button>

          </div>
        </div>

      </form>
    </div>
  );
}