import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Video,
  Phone,
  User,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Plus,
  X,
  AlertCircle,
  Pencil,
  Check,
  Trash2,
  ExternalLink,
  FileText,
  Briefcase,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  meetingsService,
  type MeetingDetail,
  type MeetingAttendee,
} from '@/services/meetings.service';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

export function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAgendaForm, setShowAgendaForm] = useState(false);
  const [agendaTitle, setAgendaTitle] = useState('');
  const [agendaDuration, setAgendaDuration] = useState('');
  const [agendaNotes, setAgendaNotes] = useState('');

  const { data: meeting, isLoading, error } = useQuery({
    queryKey: ['meetings', 'detail', id],
    queryFn: () => meetingsService.get(id!),
    enabled: !!id,
    refetchInterval: 60_000,
  });

  const rsvpMutation = useMutation({
    mutationFn: (response: 'accepted' | 'declined' | 'tentative') =>
      meetingsService.rsvp(id!, { response }),
    onSuccess: (_, response) => {
      queryClient.invalidateQueries({ queryKey: ['meetings', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['meetings', 'list'] });
      toast.success(`RSVP updated: ${response}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to RSVP');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => meetingsService.cancel(id!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['meetings', 'list'] });
      setShowCancelModal(false);
      toast.success('Meeting cancelled');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to cancel');
    },
  });

  const addAgendaMutation = useMutation({
    mutationFn: () =>
      meetingsService.addAgendaItem(id!, {
        title: agendaTitle,
        duration_minutes: agendaDuration ? Number(agendaDuration) : undefined,
        notes: agendaNotes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings', 'detail', id] });
      setAgendaTitle('');
      setAgendaDuration('');
      setAgendaNotes('');
      setShowAgendaForm(false);
      toast.success('Agenda item added');
    },
    onError: () => toast.error('Failed to add agenda item'),
  });

  const toggleAgendaMutation = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) =>
      meetingsService.updateAgendaItem(id!, itemId, { completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings', 'detail', id] });
    },
  });

  const deleteAgendaMutation = useMutation({
    mutationFn: (itemId: string) => meetingsService.deleteAgendaItem(id!, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings', 'detail', id] });
      toast.success('Agenda item deleted');
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

  if (error || !meeting) {
    return (
      <div className="max-w-5xl p-6">
        <button
          onClick={() => navigate('/meetings')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Meetings
        </button>
        <div className="border border-red-200 bg-red-50 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-900">
                Could not load this meeting
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {(error as Error)?.message ?? 'It may have been deleted.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isOrganizer = user?.id === meeting.organizer.id;
  const isCancelled = meeting.status === 'cancelled';
  const isFinished = meeting.status === 'completed';
  const starts = new Date(meeting.starts_at);
  const ends = new Date(meeting.ends_at);
  const myAttendee = meeting.attendees.find((a) => a.person.id === user?.id);

  const LocationIcon =
    meeting.location_type === 'video'
      ? Video
      : meeting.location_type === 'phone'
        ? Phone
        : MapPin;

  return (
    <div className="max-w-5xl p-6 space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate('/meetings')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Meetings
      </button>

      {/* Cancelled banner */}
      {isCancelled && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-red-900">
                This meeting has been cancelled
              </div>
              {meeting.cancelled_at && (
                <div className="text-xs text-red-700 mt-0.5">
                  {format(new Date(meeting.cancelled_at), 'MMM d, yyyy h:mm a')}
                </div>
              )}
              {meeting.cancellation_reason && (
                <div className="text-xs text-red-700 mt-1">
                  Reason: {meeting.cancellation_reason}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1
              className={cn(
                'text-2xl font-bold text-gray-900',
                isCancelled && 'line-through decoration-red-500',
              )}
            >
              {meeting.title}
            </h1>

            {meeting.description && (
              <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                {meeting.description}
              </p>
            )}

            <div className="flex items-center gap-5 text-sm text-gray-600 mt-4 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-gray-400" />
                {format(starts, 'EEEE, MMMM d, yyyy')}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-gray-400" />
                {format(starts, 'h:mm a')} – {format(ends, 'h:mm a')}
                <span className="text-gray-400">·</span>
                {meeting.duration_minutes}m
              </span>
              <span className="flex items-center gap-1.5">
                <LocationIcon className="w-4 h-4 text-gray-400" />
                {meeting.location_type === 'video'
                  ? 'Video call'
                  : meeting.location_type === 'phone'
                    ? meeting.location || 'Phone'
                    : meeting.location || 'In person'}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
              <Avatar
                firstName={meeting.organizer.first_name}
                lastName={meeting.organizer.last_name}
                imageUrl={meeting.organizer.profile_image_url}
                size="xs"
              />
              <span>
                Organized by{' '}
                <strong className="text-gray-700">
                  {meeting.organizer.first_name} {meeting.organizer.last_name}
                </strong>
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {!isCancelled && !isFinished && meeting.meeting_url && (
              <a
                href={meeting.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                <Video className="w-4 h-4" />
                Join Meeting
              </a>
            )}

            {isOrganizer && !isCancelled && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-4 py-2 border border-gray-200 text-red-700 rounded-md text-sm font-medium hover:bg-red-50 transition-colors"
              >
                Cancel Meeting
              </button>
            )}
          </div>
        </div>

        {/* Join URL display */}
        {meeting.meeting_url && !isCancelled && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <ExternalLink className="w-3 h-3" />
              <span>Meeting link:</span>
              <a
                href={meeting.meeting_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-mono truncate"
              >
                {meeting.meeting_url}
              </a>
            </div>
          </div>
        )}
      </div>

      {/* RSVP section for attendees */}
      {!isOrganizer && !isCancelled && !isFinished && myAttendee && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">
              Your Response
            </h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => rsvpMutation.mutate('accepted')}
              disabled={rsvpMutation.isPending}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-colors',
                myAttendee.response === 'accepted'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50',
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
              Going
            </button>
            <button
              onClick={() => rsvpMutation.mutate('tentative')}
              disabled={rsvpMutation.isPending}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-colors',
                myAttendee.response === 'tentative'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50',
              )}
            >
              <HelpCircle className="w-4 h-4" />
              Maybe
            </button>
            <button
              onClick={() => rsvpMutation.mutate('declined')}
              disabled={rsvpMutation.isPending}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-colors',
                myAttendee.response === 'declined'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-red-700 border-red-200 hover:bg-red-50',
              )}
            >
              <XCircle className="w-4 h-4" />
              Can't Attend
            </button>
          </div>
        </div>
      )}

      {/* Two-column: Attendees + Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Attendees */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Users className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">
              Attendees ({meeting.attendees.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {meeting.attendees.map((att) => (
              <AttendeeRow
                key={att.id}
                attendee={att}
                isOrganizer={att.person.id === meeting.organizer.id}
                isMe={att.person.id === user?.id}
              />
            ))}
          </div>
        </div>

        {/* Agenda */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">
                Agenda ({meeting.agenda_items.length})
              </h3>
            </div>
            {isOrganizer && !isCancelled && (
              <button
                onClick={() => setShowAgendaForm((v) => !v)}
                className="text-xs font-medium text-primary hover:underline"
              >
                {showAgendaForm ? 'Cancel' : '+ Add item'}
              </button>
            )}
          </div>

          {/* Add form */}
          {showAgendaForm && isOrganizer && (
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 space-y-2">
              <input
                type="text"
                value={agendaTitle}
                onChange={(e) => setAgendaTitle(e.target.value)}
                placeholder="Agenda item title"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="600"
                  value={agendaDuration}
                  onChange={(e) => setAgendaDuration(e.target.value)}
                  placeholder="Duration (min)"
                  className="w-32 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  type="text"
                  value={agendaNotes}
                  onChange={(e) => setAgendaNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                onClick={() => addAgendaMutation.mutate()}
                disabled={!agendaTitle.trim() || addAgendaMutation.isPending}
                className="w-full px-3 py-2 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark disabled:opacity-50"
              >
                {addAgendaMutation.isPending ? 'Adding…' : 'Add Item'}
              </button>
            </div>
          )}

          {meeting.agenda_items.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">No agenda items yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
              {meeting.agenda_items.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 px-5 py-3 group"
                >
                  <button
                    onClick={() =>
                      isOrganizer &&
                      toggleAgendaMutation.mutate({
                        itemId: item.id,
                        completed: !item.completed,
                      })
                    }
                    disabled={!isOrganizer}
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                      item.completed
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-gray-300 hover:border-emerald-500',
                      !isOrganizer && 'cursor-default',
                    )}
                  >
                    {item.completed && (
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'text-sm font-medium',
                        item.completed
                          ? 'text-gray-400 line-through'
                          : 'text-gray-900',
                      )}
                    >
                      {idx + 1}. {item.title}
                    </div>
                    {item.notes && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {item.notes}
                      </div>
                    )}
                    {item.duration_minutes && (
                      <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {item.duration_minutes}m
                      </div>
                    )}
                  </div>

                  {isOrganizer && (
                    <button
                      onClick={() => deleteAgendaMutation.mutate(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Linked context */}
      {(meeting.project_id || meeting.opportunity_id) && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Related to
          </h3>
          <div className="flex items-center gap-3 flex-wrap">
            {meeting.project_id && (
              <a
                href={`/projects/${meeting.project_id}`}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors text-sm"
              >
                <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                Project
              </a>
            )}
            {meeting.opportunity_id && (
              <a
                href={`/crm/opportunities/${meeting.opportunity_id}`}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors text-sm"
              >
                <FileText className="w-3.5 h-3.5 text-gray-400" />
                CRM Opportunity
              </a>
            )}
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {showCancelModal && (
        <CancelModal
          onClose={() => setShowCancelModal(false)}
          onConfirm={(reason) => cancelMutation.mutate(reason)}
          isPending={cancelMutation.isPending}
        />
      )}
    </div>
  );
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

function AttendeeRow({
  attendee,
  isOrganizer,
  isMe,
}: {
  attendee: MeetingAttendee;
  isOrganizer: boolean;
  isMe: boolean;
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
    <div className="flex items-center gap-3 px-5 py-3">
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
          {isOrganizer && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-primary/10 text-primary">
              Organizer
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
              Cancel this meeting?
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              All attendees will be notified
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
            placeholder="Why is this meeting being cancelled?"
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Keep Meeting
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={isPending}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? 'Cancelling…' : 'Cancel Meeting'}
          </button>
        </div>
      </div>
    </div>
  );
}