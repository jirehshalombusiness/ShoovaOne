import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  FolderKanban,
  HelpCircle,
  Layers,
  MapPin,
  Search,
  Send,
  Trash2,
  Users,
  Video,
  X,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  eventsService,
  EVENT_TYPE_LABELS,
  type EventAttendee,
} from '@/services/events.service';
import { useAuth } from '@/lib/auth';
import { useHRAccess } from '@/hooks/useHRAccess';
import { useDebounce } from '@/hooks/useDebounce';
import { peopleService } from '@/services/people.service';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const access = useHRAccess();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAddAttendees, setShowAddAttendees] = useState(false);

  const canManage = access.has('events.edit');

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['events', 'detail', id],
    queryFn: () => eventsService.get(id!),
    enabled: !!id,
    refetchInterval: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['events', 'detail', id] });
    queryClient.invalidateQueries({ queryKey: ['events', 'list'] });
    queryClient.invalidateQueries({ queryKey: ['events', 'sidebar-upcoming'] });
  };

  const publishMutation = useMutation({
    mutationFn: () => eventsService.publish(id!),
    onSuccess: () => {
      invalidate();
      toast.success('Event published');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to publish event');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => eventsService.cancel(id!, reason),
    onSuccess: () => {
      invalidate();
      setShowCancelModal(false);
      toast.success('Event cancelled');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to cancel event');
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: (response: 'accepted' | 'declined' | 'tentative') =>
      eventsService.rsvp(id!, response),
    onSuccess: (_, response) => {
      invalidate();
      toast.success(`RSVP updated: ${response}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to RSVP');
    },
  });

  const removeAttendeeMutation = useMutation({
    mutationFn: (personId: string) =>
      eventsService.removeAttendee(id!, personId),
    onSuccess: () => {
      invalidate();
      toast.success('Attendee removed');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to remove attendee');
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl p-6 space-y-4">
        <div className="h-40 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-5xl p-6">
        <button
          onClick={() => navigate('/events')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </button>
        <div className="border border-red-200 bg-red-50 rounded-lg p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-900">
              Could not load this event
            </h3>
            <p className="text-sm text-red-700 mt-1">
              {(error as Error)?.message ?? 'It may have been removed.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const starts = new Date(event.starts_at);
  const ends = new Date(event.ends_at);
  const isCancelled = event.status === 'cancelled';
  const isDraft = event.status === 'draft';
  const isPublished = event.status === 'published';

  const myAttendee = event.attendees.find(
    (a) => a.person.id === user?.person_id,
  );

  return (
    <div className="max-w-5xl p-6 space-y-5">
      <button
        onClick={() => navigate('/events')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Events
      </button>

      {/* Cancelled banner */}
      {isCancelled && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-red-900">
                This event has been cancelled
              </div>
              {event.cancelled_at && (
                <div className="text-xs text-red-700 mt-0.5">
                  {format(new Date(event.cancelled_at), 'MMM d, yyyy h:mm a')}
                </div>
              )}
              {event.cancellation_reason && (
                <div className="text-xs text-red-700 mt-1">
                  Reason: {event.cancellation_reason}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Draft banner */}
      {isDraft && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-amber-900">
              This event is still a draft
            </div>
            <p className="text-xs text-amber-700 mt-0.5">
              Only people with event management access can see it. Publish it
              to make it visible to everyone.
            </p>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-600">
                {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
              </span>
              {isDraft && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                  Draft
                </span>
              )}
              {isCancelled && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                  Cancelled
                </span>
              )}
            </div>

            <h1
              className={cn(
                'text-2xl font-bold text-gray-900 mt-2',
                isCancelled && 'line-through decoration-red-500',
              )}
            >
              {event.title}
            </h1>

            {event.description && (
              <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                {event.description}
              </p>
            )}

            <div className="flex items-center gap-5 text-sm text-gray-600 mt-4 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-gray-400" />
                {event.all_day
                  ? format(starts, 'EEEE, MMMM d, yyyy')
                  : format(starts, 'EEEE, MMMM d, yyyy')}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-gray-400" />
                {event.all_day
                  ? 'All day'
                  : `${format(starts, 'h:mm a')} – ${format(ends, 'h:mm a')}`}
              </span>
              <span className="flex items-center gap-1.5">
                {event.is_virtual ? (
                  <Video className="w-4 h-4 text-gray-400" />
                ) : (
                  <MapPin className="w-4 h-4 text-gray-400" />
                )}
                {event.is_virtual
                  ? 'Virtual event'
                  : event.location || 'Location to be confirmed'}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
              <Avatar
                firstName={event.organiser.first_name}
                lastName={event.organiser.last_name}
                imageUrl={event.organiser.profile_image_url}
                size="xs"
              />
              <span>
                Organised by{' '}
                <strong className="text-gray-700">
                  {event.organiser.first_name} {event.organiser.last_name}
                </strong>
              </span>
            </div>
          </div>

          {/* Actions */}
          {canManage && !isCancelled && (
            <div className="flex items-center gap-2 flex-wrap">
              {isDraft && (
                <button
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {publishMutation.isPending ? 'Publishing…' : 'Publish'}
                </button>
              )}

              <button
                onClick={() => navigate(`/events/${event.id}/edit`)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>

              <button
                onClick={() => setShowCancelModal(true)}
                className="px-4 py-2 border border-gray-200 text-red-700 rounded-md text-sm font-medium hover:bg-red-50 transition-colors"
              >
                Cancel Event
              </button>
            </div>
          )}
        </div>

        {event.meeting_url && !isCancelled && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Video className="w-3 h-3" />
              <span>Event link:</span>
              <a
                href={event.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-mono truncate"
              >
                {event.meeting_url}
              </a>
            </div>
          </div>
        )}
      </div>

      {/* RSVP */}
      {isPublished && myAttendee && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">
              Your Response
            </h3>
            {myAttendee.role !== 'attendee' && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-primary/10 text-primary">
                {myAttendee.role}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <RsvpButton
              label="Going"
              icon={CheckCircle2}
              active={myAttendee.response === 'accepted'}
              activeClass="bg-emerald-600 text-white border-emerald-600"
              idleClass="bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              disabled={rsvpMutation.isPending}
              onClick={() => rsvpMutation.mutate('accepted')}
            />
            <RsvpButton
              label="Maybe"
              icon={HelpCircle}
              active={myAttendee.response === 'tentative'}
              activeClass="bg-amber-600 text-white border-amber-600"
              idleClass="bg-white text-amber-700 border-amber-200 hover:bg-amber-50"
              disabled={rsvpMutation.isPending}
              onClick={() => rsvpMutation.mutate('tentative')}
            />
            <RsvpButton
              label="Can't Attend"
              icon={XCircle}
              active={myAttendee.response === 'declined'}
              activeClass="bg-red-600 text-white border-red-600"
              idleClass="bg-white text-red-700 border-red-200 hover:bg-red-50"
              disabled={rsvpMutation.isPending}
              onClick={() => rsvpMutation.mutate('declined')}
            />
          </div>
          {myAttendee.responded_at && (
            <p className="text-[11px] text-gray-400 mt-3">
              Last responded{' '}
              {format(new Date(myAttendee.responded_at), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>
      )}

      {/* Linked context */}
      {(event.organisation_name ||
        event.department_name ||
        event.programme_name ||
        event.project_name) && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Linked to
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {event.organisation_name && (
              <span className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700">
                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                {event.organisation_name}
              </span>
            )}
            {event.department_name && (
              <span className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700">
                <Layers className="w-3.5 h-3.5 text-gray-400" />
                {event.department_name}
              </span>
            )}
            {event.programme_name && (
              <span className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 text-sm text-gray-700">
                <Layers className="w-3.5 h-3.5 text-gray-400" />
                {event.programme_name}
              </span>
            )}
            {event.project_name && (
              <a
                href={`/projects/${event.project_id}`}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 transition-colors"
              >
                <FolderKanban className="w-3.5 h-3.5 text-gray-400" />
                {event.project_name}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Attendees */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">
              Attendees ({event.attendees.length})
            </h3>
          </div>
          {canManage && !isCancelled && (
            <button
              onClick={() => setShowAddAttendees(true)}
              className="text-xs font-medium text-primary hover:underline"
            >
              + Add attendees
            </button>
          )}
        </div>

        {event.attendees.length === 0 ? (
          <div className="text-center py-10">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500">No attendees yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[460px] overflow-y-auto">
            {event.attendees.map((attendee) => (
              <AttendeeRow
                key={attendee.id}
                attendee={attendee}
                isOrganiser={attendee.person.id === event.organiser.id}
                isMe={attendee.person.id === user?.person_id}
                canRemove={canManage && !isCancelled}
                isRemoving={removeAttendeeMutation.isPending}
                onRemove={() =>
                  removeAttendeeMutation.mutate(attendee.person.id)
                }
              />
            ))}
          </div>
        )}
      </div>

      {showCancelModal && (
        <CancelModal
          onClose={() => setShowCancelModal(false)}
          onConfirm={(reason) => cancelMutation.mutate(reason)}
          isPending={cancelMutation.isPending}
        />
      )}

      {showAddAttendees && (
        <AddAttendeesModal
          eventId={event.id}
          existingIds={event.attendees.map((a) => a.person.id)}
          onClose={() => setShowAddAttendees(false)}
          onAdded={() => {
            invalidate();
            setShowAddAttendees(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

function RsvpButton({
  label,
  icon: Icon,
  active,
  activeClass,
  idleClass,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof CheckCircle2;
  active: boolean;
  activeClass: string;
  idleClass: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-colors disabled:opacity-60',
        active ? activeClass : idleClass,
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function AttendeeRow({
  attendee,
  isOrganiser,
  isMe,
  canRemove,
  isRemoving,
  onRemove,
}: {
  attendee: EventAttendee;
  isOrganiser: boolean;
  isMe: boolean;
  canRemove: boolean;
  isRemoving: boolean;
  onRemove: () => void;
}) {
  const responseStyles: Record<string, string> = {
    accepted: 'bg-emerald-50 text-emerald-700',
    declined: 'bg-red-50 text-red-700',
    tentative: 'bg-amber-50 text-amber-700',
    pending: 'bg-gray-100 text-gray-600',
  };

  const ResponseIcon =
    attendee.response === 'accepted'
      ? CheckCircle2
      : attendee.response === 'declined'
        ? XCircle
        : HelpCircle;

  return (
    <div className="flex items-center gap-3 px-5 py-3 group">
      <Avatar
        firstName={attendee.person.first_name}
        lastName={attendee.person.last_name}
        imageUrl={attendee.person.profile_image_url}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-gray-900">
            {attendee.person.first_name} {attendee.person.last_name}
          </span>
          {isMe && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700">
              You
            </span>
          )}
          {isOrganiser && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-primary/10 text-primary">
              Organiser
            </span>
          )}
          {attendee.role !== 'attendee' && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-600">
              {attendee.role}
            </span>
          )}
        </div>
        {attendee.person.email && (
          <div className="text-[11px] text-gray-500 mt-0.5 truncate">
            {attendee.person.email}
          </div>
        )}
      </div>

      <span
        className={cn(
          'flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider flex-shrink-0',
          responseStyles[attendee.response] ?? responseStyles.pending,
        )}
      >
        <ResponseIcon className="w-2.5 h-2.5" />
        {attendee.response}
      </span>

      {canRemove && (
        <button
          onClick={onRemove}
          disabled={isRemoving}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity flex-shrink-0 disabled:opacity-40"
          title="Remove attendee"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function CancelModal({
  onClose,
  onConfirm,
  isPending,
}: {
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Cancel this event?
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Attendees will see it as cancelled with your reason
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5">
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Why is this event being cancelled?"
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Keep Event
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={isPending}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? 'Cancelling…' : 'Cancel Event'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddAttendeesModal({
  eventId,
  existingIds,
  onClose,
  onAdded,
}: {
  eventId: string;
  existingIds: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const debouncedSearch = useDebounce(search, 250);

  const { data: people, isLoading } = useQuery({
    queryKey: ['people', 'for-event-add', debouncedSearch],
    queryFn: () =>
      peopleService.getAll({
        search: debouncedSearch || undefined,
        limit: 200,
      }),
  });

  const existing = useMemo(() => new Set(existingIds), [existingIds]);

  const candidates = useMemo(() => {
    return (people ?? [])
      .filter((person) => !existing.has(person.id))
      .slice(0, 100);
  }, [people, existing]);

  const addMutation = useMutation({
    mutationFn: () => eventsService.addAttendees(eventId, selectedIds),
    onSuccess: (data) => {
      toast.success(
        `Added ${selectedIds.length} attendee${selectedIds.length === 1 ? '' : 's'}`,
      );
      if (data) onAdded();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to add attendees');
    },
  });

  const toggle = (personId: string) => {
    setSelectedIds((prev) =>
      prev.includes(personId)
        ? prev.filter((id) => id !== personId)
        : [...prev, personId],
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-lg w-full shadow-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Add attendees
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              People already invited are hidden
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-gray-500">
              Loading people…
            </div>
          ) : candidates.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500">
              No more people to add
            </div>
          ) : (
            candidates.map((person) => {
              const selected = selectedIds.includes(person.id);
              return (
                <button
                  key={person.id}
                  onClick={() => toggle(person.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
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
                    <div className="text-[13px] font-medium text-gray-900 truncate">
                      {person.first_name} {person.last_name}
                    </div>
                    {person.email && (
                      <div className="text-[11px] text-gray-500 truncate">
                        {person.email}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-500">
            {selectedIds.length} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={() => addMutation.mutate()}
              disabled={selectedIds.length === 0 || addMutation.isPending}
              className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              {addMutation.isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
