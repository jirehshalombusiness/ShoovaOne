import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  FileText,
  Save,
  Send,
} from 'lucide-react';

import { api } from '../../../services/api';
import { invoiceService } from '../invoice.service';

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
  organisation_id?: string | null;
  status?: string | null;
}

interface Programme {
  id: string;
  name: string;
  code?: string | null;
  organisation_id?: string | null;
  status?: string | null;
}

interface Project {
  id: string;
  name: string;
  code?: string | null;
  organisation_id?: string | null;
  status?: string | null;
}

const CURRENCIES = ['GHS', 'USD', 'EUR', 'GBP'];

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getErrorMessage(error: any) {
  const detail = error?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item: any) => item?.msg || 'Validation error')
      .join(', ');
  }

  return (
    detail ||
    error?.response?.data?.message ||
    error?.message ||
    'Unable to create invoice.'
  );
}

export default function NewInvoicePage() {
  const navigate = useNavigate();

  const today = useMemo(
    () => toDateInputValue(new Date()),
    []
  );

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('GHS');

  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState('');

  const [departmentId, setDepartmentId] = useState('');
  const [programmeId, setProgrammeId] = useState('');
  const [projectId, setProjectId] = useState('');

  const [notes, setNotes] = useState('');

  const [organisation, setOrganisation] =
    useState<Organisation | null>(null);
  const [departments, setDepartments] = useState<
    Department[]
  >([]);
  const [programmes, setProgrammes] = useState<
    Programme[]
  >([]);
  const [projects, setProjects] = useState<Project[]>(
    []
  );

  const [loadingReferences, setLoadingReferences] =
    useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadReferences = async () => {
      try {
        setLoadingReferences(true);
        setError('');

        const organisationResponse =
          await api.get<Organisation[]>(
            '/organisation/'
          );

        const organisations =
          organisationResponse.data || [];

        const selectedOrganisation =
          organisations.find(
            (item) =>
              item.code?.toUpperCase() === 'SHOOVA' &&
              item.status?.toLowerCase() !== 'inactive'
          ) ||
          organisations.find(
            (item) =>
              item.status?.toLowerCase() !== 'inactive'
          ) ||
          null;

        setOrganisation(selectedOrganisation);

        if (selectedOrganisation) {
          const [
            departmentsResponse,
            programmesResponse,
          ] = await Promise.all([
            api.get<Department[]>(
              `/organisation/${selectedOrganisation.id}/departments`
            ),
            api.get<Programme[]>(
              `/organisation/${selectedOrganisation.id}/programmes`
            ),
          ]);

          setDepartments(
            departmentsResponse.data || []
          );

          setProgrammes(
            programmesResponse.data || []
          );
        }

        const projectsResponse = await api.get<{
          items?: Project[];
        }>('/projects/', {
          params: {
            page: 1,
            page_size: 100,
          },
        });

        const projectItems =
          projectsResponse.data?.items || [];

        setProjects(
          selectedOrganisation
            ? projectItems.filter(
                (project) =>
                  !project.organisation_id ||
                  project.organisation_id ===
                    selectedOrganisation.id
              )
            : projectItems
        );
      } catch (err: any) {
        setError(
          getErrorMessage(err) ||
            'Unable to load invoice reference data.'
        );
      } finally {
        setLoadingReferences(false);
      }
    };

    void loadReferences();
  }, []);

  const numericAmount = Number(amount) || 0;

  const isValid =
    customerName.trim().length >= 2 &&
    title.trim().length >= 3 &&
    numericAmount > 0 &&
    issueDate &&
    dueDate &&
    dueDate >= issueDate &&
    Boolean(organisation) &&
    Boolean(departmentId);

  const createPayload = () => ({
    customer_name: customerName.trim(),
    customer_email:
      customerEmail.trim() || undefined,
    customer_phone:
      customerPhone.trim() || undefined,
    customer_address:
      customerAddress.trim() || undefined,

    title: title.trim(),
    description:
      description.trim() || undefined,

    amount: numericAmount,
    currency,

    issue_date: issueDate,
    due_date: dueDate,

    project_id: projectId || undefined,
    programme_id: programmeId || undefined,
    department_id: departmentId || undefined,

    notes: notes.trim() || undefined,
  });

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
    issueAfterCreate: boolean
  ) => {
    event.preventDefault();

    if (!isValid) {
      setError(
        'Please complete all required fields and make sure the due date is not before the issue date.'
      );
      return;
    }

    try {
      setSaving(true);
      setError('');

      const invoice =
        await invoiceService.createInvoice(
          createPayload()
        );

      if (issueAfterCreate) {
        await invoiceService.issueInvoice(
          invoice.id
        );
      }

      navigate(
        `/finance/invoices/${invoice.id}`
      );
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/finance/invoices"
            className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Invoices
          </Link>

          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-slate-700" />

            <h1 className="text-2xl font-semibold text-slate-900">
              New Invoice
            </h1>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Create a receivable invoice for a customer,
            partner, donor, or organization.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <div>
            <p className="font-medium">
              Unable to create invoice
            </p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      )}

      <form
        onSubmit={(event) =>
          void handleSubmit(event, false)
        }
        className="space-y-6"
      >
        {/* Customer */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">
              Customer / Bill To
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Enter the person or organization that owes
              Shoova.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Customer Name *
              </label>

              <input
                value={customerName}
                onChange={(event) =>
                  setCustomerName(event.target.value)
                }
                placeholder="e.g. ABC Organization"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>

              <input
                type="email"
                value={customerEmail}
                onChange={(event) =>
                  setCustomerEmail(event.target.value)
                }
                placeholder="accounts@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Phone
              </label>

              <input
                value={customerPhone}
                onChange={(event) =>
                  setCustomerPhone(event.target.value)
                }
                placeholder="+233..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Billing Address
              </label>

              <textarea
                value={customerAddress}
                onChange={(event) =>
                  setCustomerAddress(
                    event.target.value
                  )
                }
                rows={3}
                placeholder="Customer billing address"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>
          </div>
        </section>

        {/* Invoice details */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">
              Invoice Details
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Define what the customer is being billed
              for.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Invoice Title *
              </label>

              <input
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="e.g. Environmental Leadership Training"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Description
              </label>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                rows={4}
                placeholder="Describe the goods, services, programme activity, or other reason for the invoice."
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Amount *
              </label>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) =>
                  setAmount(event.target.value)
                }
                placeholder="0.00"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />

              {numericAmount > 0 && (
                <p className="mt-1.5 text-xs text-slate-500">
                  {formatCurrency(
                    numericAmount,
                    currency
                  )}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Currency *
              </label>

              <select
                value={currency}
                onChange={(event) =>
                  setCurrency(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                {CURRENCIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Issue Date *
              </label>

              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="date"
                  value={issueDate}
                  onChange={(event) =>
                    setIssueDate(event.target.value)
                  }
                  required
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Due Date *
              </label>

              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="date"
                  min={issueDate}
                  value={dueDate}
                  onChange={(event) =>
                    setDueDate(event.target.value)
                  }
                  required
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              {issueDate &&
                dueDate &&
                dueDate < issueDate && (
                  <p className="mt-1.5 text-xs text-red-600">
                    Due date cannot be before the issue
                    date.
                  </p>
                )}
            </div>
          </div>
        </section>

        {/* Organisation context */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">
              Organisation Context
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Link the invoice to the responsible
              department, programme, or project.
            </p>
          </div>

          {loadingReferences ? (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              <Calendar className="h-4 w-4 animate-pulse" />
              Loading organisation information...
            </div>
          ) : (
            <>
              <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Organisation
                </p>

                <p className="mt-1 font-medium text-slate-900">
                  {organisation?.name ||
                    'No active organisation found'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Department *
                  </label>

                  <select
                    value={departmentId}
                    onChange={(event) =>
                      setDepartmentId(
                        event.target.value
                      )
                    }
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
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
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Programme
                  </label>

                  <select
                    value={programmeId}
                    onChange={(event) =>
                      setProgrammeId(
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
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
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Project
                  </label>

                  <select
                    value={projectId}
                    onChange={(event) =>
                      setProjectId(
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
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
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Notes */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Invoice Notes
          </label>

          <textarea
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            rows={4}
            placeholder="Payment instructions, terms, or other notes to appear on the invoice."
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </section>

        {/* Preview summary */}
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">
                Invoice Summary
              </p>

              <p className="mt-1 text-xs text-slate-500">
                The invoice will be created as a draft
                unless you choose Create &amp; Issue.
              </p>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-xs text-slate-500">
                Total
              </p>

              <p className="text-2xl font-semibold text-slate-900">
                {formatCurrency(
                  numericAmount,
                  currency
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-end">
          <Link
            to="/finance/invoices"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={saving || loadingReferences}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving
              ? 'Saving...'
              : 'Save Draft'}
          </button>

          <button
            type="button"
            disabled={
              saving ||
              loadingReferences ||
              !isValid
            }
            onClick={(event) =>
              void handleSubmit(
                event as unknown as FormEvent<HTMLFormElement>,
                true
              )
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {saving
              ? 'Creating...'
              : 'Create & Issue'}
          </button>
        </div>
      </form>
    </div>
  );
}