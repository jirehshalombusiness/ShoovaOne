import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  HelpCircle,
  History,
  MapPin,
  Plus,
  Search,
  Users,
  Video,
  XCircle,
} from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import {
  eventsService,
  EVENT_TYPE_LABELS,
  type EventSummary,
  type EventType,
  type EventWindow,
} from '@/services/events.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

type ViewMode = 'upcoming' | 'today' | 'past' | 'drafts';

export function EventsListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const access = useHRAccess();

  const view: ViewMode =
    location.pathname === '/events/today'
      ? 'today'
      : location.pathname === '/events/past'
        ? 'past'
        : location.pathname === '/events/drafts'
          ? 'drafts'
          : 'upcoming';

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<EventType | ''>('');

  const window: EventWindow =
    view === 'today' ? 'today' : view === 'past' ? 'past' : view === 'drafts' ? 'all' : 'upcoming';

  const { data, isLoading } = useQuery({
    queryKey: ['events', 'list', view, search, typeFilter],
    queryFn: () =>
      eventsService.list({
        window,
        status: view === 'drafts' ? 'draft' : undefined,
        event_type: typeFilter || undefined,
        search: search.trim() || undefined,
        limit: 200,
      }),
    refetchInterval: 60_000,
  });

  const events = data ?? [];

  const grouped = useMemo(() => {
    const groups: Record<string, EventSummary[]> = {};
    for (const event of events) {
      const d = new Date(event.starts_at);
      let label: string;
      if (event.all_day) {
        label = isToday(d)
          ? 'Today'
          : isTomorrow(d)
            ? 'Tomorrow'
            : format(d, 'EEEE, MMMM d, yyyy');
      } else {
        label = isToday(d)
          ? 'Today'
          : isTomorrow(d)
            ? 'Tomorrow'
            : format(d, 'EEEE, MMMM d, yyyy');
      }
      if (!groups[label]) groups[label] = [];
      groups[label].push(event);
    }
    return groups;
  }, [events]);

  const title =
    view === 'today'
      ? "Today's Events"
      : view === 'past'
        ? 'Past Events'
        : view === 'drafts'
          ? 'Draft Events'
          : 'Upcoming Events';

  const subtitle =
    view === 'today'
      ? 'Everything happening today'
      : view === 'past'
        ? 'Events that have already taken place'
        : view === 'drafts'
          ? 'Unpublished events only you can see'
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

        {access.has('events.create') && (
          <button
            onClick={() => navigate('/events/new')}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Event
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as EventType | '')}
          className="px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All types</option>
          {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((type) => (
            <option key={type} value={type}>
              {EVENT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState view={view} onNew={() => navigate('/events/new')} />
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
                {items.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    onOpen={() => navigate(`/events/${event.id}`)}
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
  view,
  onNew,
}: {
  view: ViewMode;
  onNew: () => void;
}) {
  const config = {
    upcoming: {
      icon: CalendarDays,
      title: 'No upcoming events',
      subtitle: 'Nothing on the calendar yet.',
      cta: 'Create Event',
    },
    today: {
      icon: Clock,
      title: 'Nothing happening today',
      subtitle: 'Your day is clear.',
      cta: 'Create Event',
    },
    past: {
      icon: History,
      title: 'No past events',
      subtitle: 'Events that have ended will appear here.',
      cta: null,
    },
    drafts: {
      icon: FileText,
      title: 'No drafts',
      subtitle: 'Events saved as drafts appear here until published.',
      cta: null,
    },
  }[view];

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
// EVENT ROW
// ============================================================

function EventRow({
  event,
  onOpen,
}: {
  event: EventSummary;
  onOpen: () => void;
}) {
  const starts = new Date(event.starts_at);
  const ends = new Date(event.ends_at);
  const isCancelled = event.status === 'cancelled';
  const isDraft = event.status === 'draft';

  const linkedContext = [
    event.programme_name,
    event.department_name,
    event.project_name,
    event.organisation_name,
  ].filter(Boolean);

  return (
    <button
      onClick={onOpen}
      className={cn(
        'w-full flex items-start gap-4 p-4 text-left transition-colors group',
        !isCancelled && 'hover:bg-gray-50',
        isCancelled && 'opacity-70 hover:opacity-100',
      )}
    >
      {/* Date/time column */}
      <div className="w-16 flex-shrink-0 text-center">
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
          {format(starts, 'MMM d')}
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5">
          {event.all_day ? 'All day' : format(starts, 'HH:mm')}
        </div>
      </div>

      {/* Accent */}
      <div
        className={cn(
          'w-1 self-stretch rounded-full flex-shrink-0',
          isCancelled
            ? 'bg-red-300'
            : isDraft
              ? 'bg-gray-300'
              : event.my_response === 'accepted'
                ? 'bg-emerald-500'
                : event.my_response === 'declined'
                  ? 'bg-red-400'
                  : event.my_response === 'tentative'
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
            {event.title}
          </span>

          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-600">
            {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
          </span>

          {isDraft && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
              Draft
            </span>
          )}

          {isCancelled && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-red-50 text-red-700">
              Cancelled
            </span>
          )}

          {!isCancelled && !isDraft && (
            <ResponseBadge response={event.my_response} />
          )}
        </div>

        {event.description && (
          <p className="text-[12px] text-gray-600 mt-1 line-clamp-1">
            {event.description}
          </p>
        )}

        <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1.5 flex-wrap">
          <span className="flex items-center gap-1">
            <Avatar
              firstName={event.organiser.first_name}
              lastName={event.organiser.last_name}
              imageUrl={event.organiser.profile_image_url}
              size="xs"
            />
            {event.organiser.first_name} {event.organiser.last_name}
          </span>

          <span className="flex items-center gap-1">
            {event.is_virtual ? (
              <Video className="w-2.5 h-2.5" />
            ) : (
              <MapPin className="w-2.5 h-2.5" />
            )}
            {event.is_virtual ? 'Virtual' : event.location || 'Location TBC'}
          </span>

          {!event.all_day && (
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {format(starts, 'h:mm a')} – {format(ends, 'h:mm a')}
            </span>
          )}

          <span className="flex items-center gap-1">
            <Users className="w-2.5 h-2.5" />
            {event.attendee_count} attendee
            {event.attendee_count !== 1 ? 's' : ''}
          </span>

          {linkedContext.length > 0 && (
            <span className="text-gray-400 truncate">
              {linkedContext.join(' · ')}
            </span>
          )}
        </div>

        {isCancelled && event.cancellation_reason && (
          <div className="text-[11px] text-red-700 mt-1.5 flex items-start gap-1">
            <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>{event.cancellation_reason}</span>
          </div>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
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

  return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
      <HelpCircle className="w-2.5 h-2.5" />
      Tentative
    </span>
  );
}
