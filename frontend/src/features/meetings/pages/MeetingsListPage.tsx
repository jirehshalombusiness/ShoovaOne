import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  Clock,
  MapPin,
  Video,
  Phone,
  Building2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  User,
  Plus,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { meetingsService, type MeetingSummary } from '@/services/meetings.service';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

export function MeetingsListPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine window from URL
  const window: 'upcoming' | 'today' | 'past' =
    location.pathname === '/meetings/today'
      ? 'today'
      : location.pathname === '/meetings/past'
        ? 'past'
        : 'upcoming';

  const { data, isLoading } = useQuery({
    queryKey: ['meetings', 'list', window],
    queryFn: () => meetingsService.list({ window, limit: 200 }),
    refetchInterval: 60_000,
  });

  const meetings = data ?? [];

  // Group by date label
  const grouped = useMemo(() => {
    const groups: Record<string, MeetingSummary[]> = {};
    for (const m of meetings) {
      const d = new Date(m.starts_at);
      let label: string;
      if (isToday(d)) label = 'Today';
      else if (isTomorrow(d)) label = 'Tomorrow';
      else label = format(d, 'EEEE, MMMM d, yyyy');
      if (!groups[label]) groups[label] = [];
      groups[label].push(m);
    }
    return groups;
  }, [meetings]);

  const title =
    window === 'today'
      ? "Today's Meetings"
      : window === 'past'
        ? 'Past Meetings'
        : 'Upcoming Meetings';

  const subtitle =
    window === 'today'
      ? 'Everything scheduled for today'
      : window === 'past'
        ? 'Meetings that have already happened'
        : 'Everything coming up';

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        </div>

        <button
          onClick={() => navigate('/meetings/new')}
          className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Meeting
        </button>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <EmptyState window={window} onNew={() => navigate('/meetings/new')} />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([label, items]) => (
            <div key={label}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {label}
                </h2>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-semibold">
                  {items.length}
                </span>
              </div>

              <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100 overflow-hidden">
                {items.map((meeting) => (
                  <MeetingRow
                    key={meeting.id}
                    meeting={meeting}
                    onOpen={() => navigate(`/meetings/${meeting.id}`)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// EMPTY STATE
// ============================================================

function EmptyState({
  window,
  onNew,
}: {
  window: 'upcoming' | 'today' | 'past';
  onNew: () => void;
}) {
  const config = {
    upcoming: {
      icon: CalendarDays,
      title: 'No upcoming meetings',
      subtitle: "You're all clear. Schedule one to get started.",
      cta: 'Schedule Meeting',
    },
    today: {
      icon: Clock,
      title: 'Nothing scheduled today',
      subtitle: 'Your calendar is clear for the day.',
      cta: 'Schedule a Meeting',
    },
    past: {
      icon: CalendarDays,
      title: 'No past meetings',
      subtitle: 'Meetings you attend will appear here.',
      cta: null,
    },
  }[window];

  const Icon = config.icon;

  return (
    <div className="border border-gray-200 rounded-lg bg-white text-center py-16">
      <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-7 h-7 text-gray-300" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-gray-700">{config.title}</p>
      <p className="text-xs text-gray-500 mt-1">{config.subtitle}</p>
      {config.cta && (
        <button
          onClick={onNew}
          className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {config.cta}
        </button>
      )}
    </div>
  );
}

// ============================================================
// MEETING ROW
// ============================================================

function MeetingRow({
  meeting,
  onOpen,
}: {
  meeting: MeetingSummary;
  onOpen: () => void;
}) {
  const starts = new Date(meeting.starts_at);
  const ends = new Date(meeting.ends_at);
  const isCancelled = meeting.status === 'cancelled';
  const isFinished = meeting.status === 'completed' || isPast(ends);
  const myResponse = meeting.my_response;
  const isOrganizer = false; // Would need current user id to determine; skip for v1

  const LocationIcon =
    meeting.location_type === 'video'
      ? Video
      : meeting.location_type === 'phone'
        ? Phone
        : MapPin;

  return (
    <button
      onClick={onOpen}
      className={cn(
        'w-full flex items-start gap-4 p-4 text-left transition-colors group',
        !isCancelled && !isFinished && 'hover:bg-gray-50',
        (isCancelled || isFinished) && 'opacity-70 hover:opacity-100',
      )}
    >
      {/* Time column */}
      <div className="w-16 flex-shrink-0 text-center">
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
          {format(starts, 'HH:mm')}
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5">
          {meeting.duration_minutes}m
        </div>
      </div>

      {/* Divider */}
      <div
        className={cn(
          'w-1 self-stretch rounded-full flex-shrink-0',
          isCancelled
            ? 'bg-red-300'
            : isFinished
              ? 'bg-gray-300'
              : myResponse === 'accepted'
                ? 'bg-emerald-500'
                : myResponse === 'declined'
                  ? 'bg-red-400'
                  : myResponse === 'tentative'
                    ? 'bg-amber-400'
                    : 'bg-primary',
        )}
      />

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'text-[14px] font-semibold text-gray-900',
              isCancelled && 'line-through decoration-red-500',
            )}
          >
            {meeting.title}
          </span>

          {isCancelled && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-red-50 text-red-700">
              Cancelled
            </span>
          )}

          {!isCancelled && <ResponseBadge response={myResponse} />}
        </div>

        {meeting.description && (
          <p className="text-[12px] text-gray-600 mt-1 line-clamp-1">
            {meeting.description}
          </p>
        )}

        <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1.5 flex-wrap">
          <span className="flex items-center gap-1">
            <User className="w-2.5 h-2.5" />
            {meeting.organizer.first_name} {meeting.organizer.last_name}
          </span>

          <span className="flex items-center gap-1">
            <LocationIcon className="w-2.5 h-2.5" />
            {meeting.location_type === 'video'
              ? 'Video call'
              : meeting.location_type === 'phone'
                ? 'Phone'
                : meeting.location || 'In person'}
          </span>

          <span className="flex items-center gap-1">
            <User className="w-2.5 h-2.5" />
            {meeting.attendee_count} attendee
            {meeting.attendee_count !== 1 ? 's' : ''}
          </span>
        </div>

        {isCancelled && meeting.cancellation_reason && (
          <div className="text-[11px] text-red-700 mt-1.5 flex items-start gap-1">
            <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>{meeting.cancellation_reason}</span>
          </div>
        )}
      </div>

      {/* Join button or chevron */}
      <div className="flex-shrink-0 flex items-center gap-2 mt-1">
        {!isCancelled &&
          !isFinished &&
          meeting.meeting_url &&
          meeting.location_type === 'video' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(meeting.meeting_url!, '_blank', 'noopener');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-primary text-white rounded-md text-[11px] font-medium hover:bg-primary-dark transition-colors"
            >
              <Video className="w-3 h-3" />
              Join
            </button>
          )}

        <ChevronRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}

// ============================================================
// RESPONSE BADGE
// ============================================================

function ResponseBadge({ response }: { response?: string | null }) {
  if (!response || response === 'pending') {
    return (
      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
        <HelpCircle className="w-2.5 h-2.5" />
        Awaiting RSVP
      </span>
    );
  }

  if (response === 'accepted') {
    return (
      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-2.5 h-2.5" />
        Going
      </span>
    );
  }

  if (response === 'declined') {
    return (
      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
        <XCircle className="w-2.5 h-2.5" />
        Declined
      </span>
    );
  }

  if (response === 'tentative') {
    return (
      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
        <HelpCircle className="w-2.5 h-2.5" />
        Tentative
      </span>
    );
  }

  return null;
}