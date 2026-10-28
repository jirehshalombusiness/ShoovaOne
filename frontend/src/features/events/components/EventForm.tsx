import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Link2,
  MapPin,
  Save,
  Search,
  Users,
  X,
} from 'lucide-react';
import { addHours } from 'date-fns';
import toast from 'react-hot-toast';
import {
  EVENT_TYPE_LABELS,
  type CreateEventPayload,
  type EventDetail,
  type EventType,
} from '@/services/events.service';
import { peopleService } from '@/services/people.service';
import { organisationService } from '@/services/organisation.service';
import { projectService } from '@/services/project.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { useDebounce } from '@/hooks/useDebounce';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

// ============================================================
// HELPERS
// ============================================================

function nextRoundHour(): Date {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return addHours(now, 1);
}

function toLocalDateTime(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function isoToLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : toLocalDateTime(d);
}

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20';

// ============================================================
// COMPONENT
// ============================================================

interface EventFormProps {
  initial?: EventDetail;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (payload: CreateEventPayload) => void;
  onCancel: () => void;
}

export function EventForm({
  initial,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: EventFormProps) {
  const access = useHRAccess();

  const defaultStart = useMemo(() => nextRoundHour(), []);
  const defaultEnd = useMemo(() => addHours(defaultStart, 1), [defaultStart]);

  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    eventType: (initial?.event_type ?? 'general') as EventType,
    allDay: initial?.all_day ?? false,
    startsAt: initial
      ? isoToLocalInput(initial.starts_at)
      : toLocalDateTime(defaultStart),
    endsAt: initial
      ? isoToLocalInput(initial.ends_at)
      : toLocalDateTime(defaultEnd),
    location: initial?.location ?? '',
    isVirtual: initial?.is_virtual ?? false,
    meetingUrl: initial?.meeting_url ?? '',
    organisationId: initial?.organisation_id ?? '',
    departmentId: initial?.department_id ?? '',
    programmeId: initial?.programme_id ?? '',
    projectId: initial?.project_id ?? '',
  });

  const [attendeeIds, setAttendeeIds] = useState<string[]>(
    initial?.attendees.map((a) => a.person.id) ?? [],
  );
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [showAttendeePicker, setShowAttendeePicker] = useState(false);

  const debouncedSearch = useDebounce(attendeeSearch, 250);
  const canPickPeople = access.has('people.view');
  const canPickProjects = access.has('projects.view');
  const canPickOrganisation = access.has('organisation.view');

  const { data: people } = useQuery({
    queryKey: ['people', 'for-event-invite', debouncedSearch],
    queryFn: () =>
      peopleService.getAll({
        search: debouncedSearch || undefined,
        limit: 200,
      }),
    enabled: canPickPeople && showAttendeePicker,
  });

  const { data: organisations } = useQuery({
    queryKey: ['organisation', 'event-form'],
    queryFn: () => organisationService.list({ limit: 100 }),
    enabled: canPickOrganisation,
  });

  const { data: departments } = useQuery({
    queryKey: ['organisation', 'departments', form.organisationId],
    queryFn: () => organisationService.listDepartments(form.organisationId),
    enabled: canPickOrganisation && !!form.organisationId,
  });

  const { data: programmes } = useQuery({
    queryKey: ['organisation', 'programmes', form.organisationId],
    queryFn: () => organisationService.listProgrammes(form.organisationId),
    enabled: canPickOrganisation && !!form.organisationId,
  });

  const { data: projects } = useQuery({
    queryKey: ['projects', 'event-form'],
    queryFn: () => projectService.getAll(),
    enabled: canPickProjects,
  });

  // People already resolved through the initial payload (edit mode)
  const knownPeople = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        first_name: string;
        last_name: string;
        email?: string | null;
        profile_image_url?: string | null;
      }
    >();
    for (const person of people ?? []) map.set(person.id, person);
    for (const attendee of initial?.attendees ?? []) {
      map.set(attendee.person.id, attendee.person);
    }
    return map;
  }, [people, initial]);

  const selectedPeople = useMemo(
    () =>
      attendeeIds
        .map((id) => knownPeople.get(id))
        .filter((p): p is NonNullable<typeof p> => !!p),
    [attendeeIds, knownPeople],
  );

  const filteredPeople = useMemo(() => {
    if (!people) return [];
    return people.slice(0, 100);
  }, [people]);

  const toggleAttendee = (personId: string) => {
    setAttendeeIds((prev) =>
      prev.includes(personId)
        ? prev.filter((id) => id !== personId)
        : [...prev, personId],
    );
  };

  const handleAllDay = (checked: boolean) => {
    if (checked) {
      const startDate = form.startsAt.slice(0, 10) || toLocalDateTime(new Date()).slice(0, 10);
      const endDate = form.endsAt.slice(0, 10) || startDate;
      setForm({
        ...form,
        allDay: true,
        startsAt: `${startDate}T00:00`,
        endsAt: `${endDate}T23:59`,
      });
    } else {
      setForm({ ...form, allDay: false });
    }
  };

  const handleOrganisationChange = (value: string) => {
    setForm({
      ...form,
      organisationId: value,
      departmentId: '',
      programmeId: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.startsAt) return toast.error('Start time is required');
    if (!form.endsAt) return toast.error('End time is required');

    const startsAt = new Date(form.startsAt);
    const endsAt = new Date(form.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return toast.error('Enter valid start and end times');
    }
    if (endsAt <= startsAt) {
      return toast.error('End time must be after start time');
    }
    if (form.isVirtual && !form.meetingUrl.trim()) {
      return toast.error('Add a meeting link for a virtual event');
    }

    const payload: CreateEventPayload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      event_type: form.eventType,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      all_day: form.allDay,
      location: form.location.trim() || undefined,
      is_virtual: form.isVirtual,
      meeting_url: form.meetingUrl.trim() || undefined,
      organisation_id: form.organisationId || null,
      department_id: form.departmentId || null,
      programme_id: form.programmeId || null,
      project_id: form.projectId || null,
      attendee_ids: attendeeIds,
    };

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Basic */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Community Outreach Day"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Event type
            </label>
            <select
              value={form.eventType}
              onChange={(e) =>
                setForm({ ...form, eventType: e.target.value as EventType })
              }
              className={inputClass}
            >
              {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((type) => (
                <option key={type} value={type}>
                  {EVENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="What is this event about?"
            className={cn(inputClass, 'resize-none')}
          />
        </div>
      </div>

      {/* When */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">When</h2>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => handleAllDay(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary/20"
            />
            All day
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Starts <span className="text-red-500">*</span>
            </label>
            <input
              type={form.allDay ? 'date' : 'datetime-local'}
              value={form.allDay ? form.startsAt.slice(0, 10) : form.startsAt}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                if (form.allDay) {
                  setForm({ ...form, startsAt: `${value}T00:00` });
                } else {
                  setForm({ ...form, startsAt: value });
                }
              }}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Ends <span className="text-red-500">*</span>
            </label>
            <input
              type={form.allDay ? 'date' : 'datetime-local'}
              value={form.allDay ? form.endsAt.slice(0, 10) : form.endsAt}
              min={
                form.allDay
                  ? form.startsAt.slice(0, 10)
                  : form.startsAt || undefined
              }
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                if (form.allDay) {
                  setForm({ ...form, endsAt: `${value}T23:59` });
                } else {
                  setForm({ ...form, endsAt: value });
                }
              }}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Where */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Where</h2>
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={form.isVirtual}
            onChange={(e) =>
              setForm({ ...form, isVirtual: e.target.checked })
            }
            className="rounded border-gray-300 text-primary focus:ring-primary/20"
          />
          This is a virtual event
        </label>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Location
          </label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="e.g. Accra Community Centre"
            className={inputClass}
          />
        </div>

        {form.isVirtual && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Meeting link <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={form.meetingUrl}
              onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })}
              placeholder="https://meet.google.com/..."
              className={cn(inputClass, 'font-mono')}
            />
          </div>
        )}
      </div>

      {/* Links */}
      {(canPickOrganisation || canPickProjects) && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">
              Linked to <span className="text-gray-400 font-normal">(optional)</span>
            </h2>
          </div>

          {canPickOrganisation && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Organisation
                  </label>
                  <select
                    value={form.organisationId}
                    onChange={(e) => handleOrganisationChange(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">None</option>
                    {(organisations?.items ?? []).map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Department
                  </label>
                  <select
                    value={form.departmentId}
                    onChange={(e) =>
                      setForm({ ...form, departmentId: e.target.value })
                    }
                    disabled={!form.organisationId}
                    className={cn(inputClass, 'disabled:bg-gray-50 disabled:text-gray-400')}
                  >
                    <option value="">None</option>
                    {(departments ?? []).map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Programme
                  </label>
                  <select
                    value={form.programmeId}
                    onChange={(e) =>
                      setForm({ ...form, programmeId: e.target.value })
                    }
                    disabled={!form.organisationId}
                    className={cn(inputClass, 'disabled:bg-gray-50 disabled:text-gray-400')}
                  >
                    <option value="">None</option>
                    {(programmes ?? []).map((programme) => (
                      <option key={programme.id} value={programme.id}>
                        {programme.name}
                      </option>
                    ))}
                  </select>
                </div>

                {canPickProjects && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Project
                    </label>
                    <select
                      value={form.projectId}
                      onChange={(e) =>
                        setForm({ ...form, projectId: e.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">None</option>
                      {(projects ?? []).map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </>
          )}

          {!canPickOrganisation && canPickProjects && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Project
              </label>
              <select
                value={form.projectId}
                onChange={(e) =>
                  setForm({ ...form, projectId: e.target.value })
                }
                className={inputClass}
              >
                <option value="">None</option>
                {(projects ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Attendees */}
      {canPickPeople && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">
                Attendees{' '}
                {attendeeIds.length > 0 && (
                  <span className="text-gray-500 font-normal">
                    ({attendeeIds.length})
                  </span>
                )}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowAttendeePicker((v) => !v)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {showAttendeePicker ? 'Done' : '+ Add attendees'}
            </button>
          </div>

          {selectedPeople.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedPeople.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-primary/10 text-primary"
                >
                  <Avatar
                    firstName={person.first_name}
                    lastName={person.last_name}
                    imageUrl={person.profile_image_url ?? null}
                    size="xs"
                  />
                  <span className="text-[11px] font-medium">
                    {person.first_name} {person.last_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleAttendee(person.id)}
                    className="hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAttendeePicker && (
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={attendeeSearch}
                    onChange={(e) => setAttendeeSearch(e.target.value)}
                    placeholder="Search people…"
                    className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                {filteredPeople.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-500">
                    No people found
                  </div>
                ) : (
                  filteredPeople.map((person) => {
                    const selected = attendeeIds.includes(person.id);
                    return (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => toggleAttendee(person.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                          selected ? 'bg-primary/5' : 'hover:bg-gray-50',
                        )}
                      >
                        <div
                          className={cn(
                            'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0',
                            selected
                              ? 'bg-primary border-primary'
                              : 'border-gray-300',
                          )}
                        >
                          {selected && (
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <Avatar
                          firstName={person.first_name}
                          lastName={person.last_name}
                          imageUrl={person.profile_image_url}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium text-gray-900 truncate">
                            {person.first_name} {person.last_name}
                          </div>
                          {person.email && (
                            <div className="text-[10px] text-gray-500 truncate">
                              {person.email}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <AlertCircle className="w-3.5 h-3.5" />
          {initial
            ? 'Changes are saved to the event immediately'
            : 'The event is saved as a draft until you publish it'}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
