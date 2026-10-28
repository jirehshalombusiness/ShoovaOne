import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import {
  PROGRAMME_LEVEL_LABELS,
  type ProgrammeDetail,
  type ProgrammeLevel,
  type ProgrammePayload,
  type ProgrammePersonBrief,
} from '@/services/programmes.service';
import { organisationService } from '@/services/organisation.service';
import { peopleService } from '@/services/people.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { useDebounce } from '@/hooks/useDebounce';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20';

interface ProgrammeFormProps {
  mode: 'create' | 'edit';
  initial?: ProgrammeDetail;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (payload: ProgrammePayload) => void;
  onCancel: () => void;
}

export function ProgrammeForm({
  mode,
  initial,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: ProgrammeFormProps) {
  const access = useHRAccess();
  const canPickOrganisation = access.has('organisation.view');
  const canPickPeople = access.has('people.view');

  const [form, setForm] = useState({
    name: initial?.name ?? '',
    code: initial?.code ?? '',
    description: initial?.description ?? '',
    organisationId: initial?.organisation_id ?? '',
    departmentId: initial?.department_id ?? '',
    level: (initial?.level ?? '') as ProgrammeLevel | '',
    durationWeeks: initial?.duration_weeks?.toString() ?? '',
    startDate: initial?.start_date ?? '',
    endDate: initial?.end_date ?? '',
    learningOutcomes: initial?.learning_outcomes ?? '',
  });

  const [lead, setLead] = useState<ProgrammePersonBrief | null>(
    initial?.lead ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const { data: organisations } = useQuery({
    queryKey: ['organisation', 'programme-form'],
    queryFn: () => organisationService.list({ limit: 100 }),
    enabled: canPickOrganisation && mode === 'create',
  });

  useEffect(() => {
    if (mode !== 'create') return;
    if (!form.organisationId && organisations?.items.length === 1) {
      setForm((prev) => ({
        ...prev,
        organisationId: organisations.items[0].id,
      }));
    }
  }, [mode, organisations, form.organisationId]);

  const { data: departments } = useQuery({
    queryKey: ['organisation', 'departments', form.organisationId],
    queryFn: () => organisationService.listDepartments(form.organisationId),
    enabled: canPickOrganisation && !!form.organisationId,
  });

  const update = (patch: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = () => {
    setError(null);

    if (form.name.trim().length < 2) {
      setError('Programme name must be at least 2 characters.');
      return;
    }
    if (mode === 'create' && !form.organisationId) {
      setError('Choose the organisation that owns this programme.');
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setError('End date cannot be before the start date.');
      return;
    }

    const duration = form.durationWeeks.trim();
    if (duration && (!Number.isFinite(Number(duration)) || Number(duration) < 1)) {
      setError('Duration must be a positive number of weeks.');
      return;
    }

    const payload: ProgrammePayload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      description: form.description.trim() || null,
      department_id: form.departmentId || null,
      level: form.level || null,
      duration_weeks: duration ? Number(duration) : null,
      learning_outcomes: form.learningOutcomes.trim() || null,
      lead_id: lead?.id ?? null,
      start_date: form.startDate || null,
      end_date: form.endDate || null,
    };

    if (mode === 'create') {
      payload.organisation_id = form.organisationId;
    }

    onSubmit(payload);
  };

  return (
    <div className="space-y-5">
      <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Programme details
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            What learners see when they browse the catalogue
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Programme name *
            </label>
            <input
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g. Certificate in Community Health"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Code
            </label>
            <input
              value={form.code}
              onChange={(e) => update({ code: e.target.value })}
              placeholder="CCH-01"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Level
            </label>
            <select
              value={form.level}
              onChange={(e) =>
                update({ level: e.target.value as ProgrammeLevel | '' })
              }
              className={inputClass}
            >
              <option value="">Not set</option>
              {(Object.keys(PROGRAMME_LEVEL_LABELS) as ProgrammeLevel[]).map(
                (level) => (
                  <option key={level} value={level}>
                    {PROGRAMME_LEVEL_LABELS[level]}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Duration (weeks)
            </label>
            <input
              type="number"
              min={1}
              max={520}
              value={form.durationWeeks}
              onChange={(e) => update({ durationWeeks: e.target.value })}
              placeholder="12"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Programme lead
            </label>
            {canPickPeople ? (
              <LeadPicker value={lead} onChange={setLead} />
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500 border border-gray-100 rounded-md bg-gray-50">
                {lead ? `${lead.first_name} ${lead.last_name}` : 'Not set'}
              </div>
            )}
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              rows={3}
              placeholder="A short summary of the programme"
              className={cn(inputClass, 'resize-none')}
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Learning outcomes
            </label>
            <textarea
              value={form.learningOutcomes}
              onChange={(e) => update({ learningOutcomes: e.target.value })}
              rows={3}
              placeholder="What graduates will be able to do"
              className={cn(inputClass, 'resize-none')}
            />
          </div>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Placement and dates
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Where the programme sits and when it runs
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Organisation *
            </label>
            {mode === 'edit' ? (
              <div className="px-3 py-2 text-sm text-gray-700 border border-gray-100 rounded-md bg-gray-50">
                {initial?.organisation_name ?? initial?.organisation_id}
              </div>
            ) : canPickOrganisation ? (
              <select
                value={form.organisationId}
                onChange={(e) =>
                  update({ organisationId: e.target.value, departmentId: '' })
                }
                className={inputClass}
              >
                <option value="">Select an organisation</option>
                {(organisations?.items ?? []).map((organisation) => (
                  <option key={organisation.id} value={organisation.id}>
                    {organisation.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500 border border-gray-100 rounded-md bg-gray-50">
                Your organisation
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Department
            </label>
            <select
              value={form.departmentId}
              onChange={(e) => update({ departmentId: e.target.value })}
              disabled={!form.organisationId || !canPickOrganisation}
              className={cn(
                inputClass,
                'disabled:bg-gray-50 disabled:text-gray-400',
              )}
            >
              <option value="">None</option>
              {(departments ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Start date
            </label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => update({ startDate: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              End date
            </label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => update({ endDate: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// LEAD PICKER
// ============================================================

function LeadPicker({
  value,
  onChange,
}: {
  value: ProgrammePersonBrief | null;
  onChange: (person: ProgrammePersonBrief | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 250);

  const { data: people, isLoading } = useQuery({
    queryKey: ['people', 'programme-lead', debouncedSearch],
    queryFn: () =>
      peopleService.getAll({
        search: debouncedSearch || undefined,
        limit: 25,
      }),
    enabled: open,
  });

  const results = useMemo(() => (people ?? []).slice(0, 25), [people]);

  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-md h-[38px]">
        <Avatar
          firstName={value.first_name}
          lastName={value.last_name}
          imageUrl={value.profile_image_url}
          size="xs"
        />
        <span className="text-sm text-gray-900 truncate flex-1">
          {value.first_name} {value.last_name}
        </span>
        <button
          onClick={() => onChange(null)}
          className="text-gray-400 hover:text-gray-700"
          title="Clear lead"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search people…"
        className={cn(inputClass, 'pl-9')}
      />

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="px-3 py-2 text-xs text-gray-500">Loading…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500">No people found</div>
          ) : (
            results.map((person) => (
              <button
                key={person.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange({
                    id: person.id,
                    first_name: person.first_name,
                    last_name: person.last_name,
                    email: person.email,
                    profile_image_url: person.profile_image_url,
                  });
                  setSearch('');
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
              >
                <Avatar
                  firstName={person.first_name}
                  lastName={person.last_name}
                  imageUrl={person.profile_image_url}
                  size="xs"
                />
                <div className="min-w-0">
                  <div className="text-[13px] text-gray-900 truncate">
                    {person.first_name} {person.last_name}
                  </div>
                  {person.email && (
                    <div className="text-[11px] text-gray-500 truncate">
                      {person.email}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
