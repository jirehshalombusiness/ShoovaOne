import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Video,
  MapPin,
  Phone,
  Users,
  Plus,
  X,
  Calendar,
  Clock,
  AlertCircle,
  Save,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { format, addHours, setHours, setMinutes } from 'date-fns';
import toast from 'react-hot-toast';
import {
  meetingsService,
  type CreateMeetingPayload,
  type LocationType,
} from '@/services/meetings.service';
import { peopleService } from '@/services/people.service';
import { Avatar } from '@/components/ui/Avatar';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

// ============================================================
// HELPERS
// ============================================================

function nextRoundHour(): Date {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return addHours(now, 1);
}

function toLocalDateTimeInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

// ============================================================
// PAGE
// ============================================================

export function NewMeetingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const defaultStart = useMemo(() => nextRoundHour(), []);
  const defaultEnd = useMemo(() => addHours(defaultStart, 1), [defaultStart]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    startsAt: toLocalDateTimeInput(defaultStart),
    endsAt: toLocalDateTimeInput(defaultEnd),
    locationType: 'video' as LocationType,
    location: '',
    meetingUrl: '',
  });

  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [showAttendeePicker, setShowAttendeePicker] = useState(false);
  const [agendaTitles, setAgendaTitles] = useState<string[]>([]);
  const [agendaInput, setAgendaInput] = useState('');

  const debouncedSearch = useDebounce(attendeeSearch, 250);

  // Load people for the attendee picker
  const { data: people } = useQuery({
    queryKey: ['people', 'for-meeting-invite', debouncedSearch],
    queryFn: () =>
      peopleService.getAll({
        search: debouncedSearch || undefined,
        limit: 200,
      }),
    enabled: showAttendeePicker,
  });

  const selectedPeople = useMemo(() => {
    if (!people) return [];
    return people.filter((p) => attendeeIds.includes(p.id));
  }, [people, attendeeIds]);

  // Fallback — if the picker hasn't loaded, we still know the ids
  // but not their names. Store the ids and re-fetch as needed.
  const attendeeCount = attendeeIds.length;

  const createMutation = useMutation({
    mutationFn: (payload: CreateMeetingPayload) =>
      meetingsService.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Meeting scheduled');
      navigate(`/meetings/${data.id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to create meeting');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.startsAt) return toast.error('Start time is required');
    if (!form.endsAt) return toast.error('End time is required');

    const startsAt = new Date(form.startsAt);
    const endsAt = new Date(form.endsAt);
    if (endsAt <= startsAt) {
      return toast.error('End time must be after start time');
    }

    if (attendeeIds.length === 0) {
      return toast.error('Add at least one attendee');
    }

    if (form.locationType === 'video' && !form.meetingUrl.trim()) {
      return toast.error('Add a meeting URL (Google Meet, Zoom, etc.)');
    }

    if (form.locationType === 'in_person' && !form.location.trim()) {
      return toast.error('Add a location');
    }

    const payload: CreateMeetingPayload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      location_type: form.locationType,
      location: form.location.trim() || undefined,
      meeting_url: form.meetingUrl.trim() || undefined,
      attendee_ids: attendeeIds,
      agenda_titles: agendaTitles.length > 0 ? agendaTitles : undefined,
    };

    createMutation.mutate(payload);
  };

  const toggleAttendee = (personId: string) => {
    setAttendeeIds((prev) =>
      prev.includes(personId)
        ? prev.filter((id) => id !== personId)
        : [...prev, personId],
    );
  };

  const addAgenda = () => {
    if (!agendaInput.trim()) return;
    setAgendaTitles([...agendaTitles, agendaInput.trim()]);
    setAgendaInput('');
  };

  const filteredPeople = useMemo(() => {
    if (!people) return [];
    if (!debouncedSearch) return people.slice(0, 50);
    return people.slice(0, 100);
  }, [people, debouncedSearch]);

  return (
    <div className="max-w-3xl p-6 space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate('/meetings')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Meetings
      </button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Schedule a Meeting</h1>
        <p className="text-sm text-gray-500 mt-1">
          Everyone invited gets a notification with the details
        </p>
      </div>

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
              placeholder="e.g. Q4 Planning Session"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="What is this meeting about?"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
        </div>

        {/* When */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">When</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Starts <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setForm({ ...form, startsAt: newStart });
                  // Auto-adjust end time if it's now before start
                  if (newStart) {
                    const start = new Date(newStart);
                    const end = new Date(form.endsAt);
                    if (end <= start) {
                      const newEnd = addHours(start, 1);
                      setForm((prev) => ({
                        ...prev,
                        startsAt: newStart,
                        endsAt: toLocalDateTimeInput(newEnd),
                      }));
                    }
                  }
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Ends <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.endsAt}
                min={form.startsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {form.startsAt && form.endsAt && (
            <div className="text-[11px] text-gray-500">
              Duration: {Math.round(
                (new Date(form.endsAt).getTime() -
                  new Date(form.startsAt).getTime()) /
                  60000,
              )}{' '}
              minutes
            </div>
          )}
        </div>

        {/* Where */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Where</h2>
          </div>

          {/* Location type selector */}
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: 'video', icon: Video, label: 'Video call' },
                { value: 'in_person', icon: MapPin, label: 'In person' },
                { value: 'phone', icon: Phone, label: 'Phone' },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const active = form.locationType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setForm({ ...form, locationType: opt.value })
                  }
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-md border transition-colors',
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300',
                  )}
                >
                  <Icon
                    className={cn(
                      'w-4 h-4',
                      active ? 'text-primary' : 'text-gray-500',
                    )}
                    strokeWidth={1.75}
                  />
                  <span
                    className={cn(
                      'text-[11px] font-semibold',
                      active ? 'text-primary' : 'text-gray-700',
                    )}
                  >
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Conditional field */}
          {form.locationType === 'video' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Meeting URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={form.meetingUrl}
                onChange={(e) =>
                  setForm({ ...form, meetingUrl: e.target.value })
                }
                placeholder="https://meet.google.com/..."
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Paste a Google Meet, Zoom, Teams, or any other link
              </p>
            </div>
          )}

          {form.locationType === 'in_person' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Location <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
                placeholder="e.g. Conference Room A"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          {form.locationType === 'phone' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Phone number
              </label>
              <input
                type="tel"
                value={form.location}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
                placeholder="+233 20 123 4567"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
        </div>

        {/* Attendees */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">
                Attendees{' '}
                {attendeeCount > 0 && (
                  <span className="text-gray-500 font-normal">
                    ({attendeeCount})
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

          {/* Selected list */}
          {selectedPeople.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedPeople.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-primary/10 text-primary"
                >
                  <Avatar
                    firstName={p.first_name}
                    lastName={p.last_name}
                    imageUrl={p.profile_image_url}
                    size="xs"
                  />
                  <span className="text-[11px] font-medium">
                    {p.first_name} {p.last_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleAttendee(p.id)}
                    className="hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Picker */}
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
                          selected
                            ? 'bg-primary/5'
                            : 'hover:bg-gray-50',
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

        {/* Agenda */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">
              Agenda{' '}
              {agendaTitles.length > 0 && (
                <span className="text-gray-500 font-normal">
                  ({agendaTitles.length})
                </span>
              )}
            </h2>
          </div>

          {agendaTitles.length > 0 && (
            <div className="space-y-1">
              {agendaTitles.map((title, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-gray-50 text-[12px]"
                >
                  <span className="text-gray-700">
                    {i + 1}. {title}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAgendaTitles(agendaTitles.filter((_, idx) => idx !== i))
                    }
                    className="text-gray-400 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={agendaInput}
              onChange={(e) => setAgendaInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addAgenda();
                }
              }}
              placeholder="Add an agenda item (optional)"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={addAgenda}
              disabled={!agendaInput.trim()}
              className="px-3 py-2 bg-gray-900 text-white rounded-md text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <AlertCircle className="w-3.5 h-3.5" />
            Everyone invited gets a notification
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/meetings')}
              className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {createMutation.isPending ? 'Scheduling…' : 'Schedule Meeting'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}