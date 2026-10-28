import { api } from './api';

// ============================================================
// TYPES
// ============================================================

export type EventType =
  | 'general'
  | 'training'
  | 'workshop'
  | 'conference'
  | 'outreach'
  | 'fundraising'
  | 'community';

export type EventStatus = 'draft' | 'published' | 'cancelled';
export type AttendeeRole = 'attendee' | 'speaker' | 'volunteer';
export type RsvpStatus = 'pending' | 'accepted' | 'declined' | 'tentative';
export type EventWindow = 'upcoming' | 'today' | 'past' | 'all';

export interface EventPersonBrief {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  profile_image_url?: string | null;
}

export interface EventAttendee {
  id: string;
  person: EventPersonBrief;
  role: AttendeeRole;
  response: RsvpStatus;
  responded_at?: string | null;
  response_note?: string | null;
}

export interface EventSummary {
  id: string;
  title: string;
  description?: string | null;
  event_type: EventType;
  status: EventStatus;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location?: string | null;
  is_virtual: boolean;
  meeting_url?: string | null;
  organiser: EventPersonBrief;
  organisation_id?: string | null;
  organisation_name?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  programme_id?: string | null;
  programme_name?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  attendee_count: number;
  my_response?: RsvpStatus | null;
  published_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  created_at?: string | null;
}

export interface EventDetail extends EventSummary {
  attendees: EventAttendee[];
}

export interface EventListParams {
  window?: EventWindow;
  status?: EventStatus;
  event_type?: EventType;
  organisation_id?: string;
  department_id?: string;
  programme_id?: string;
  project_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateEventPayload {
  title: string;
  description?: string;
  event_type?: EventType;
  starts_at: string;
  ends_at: string;
  all_day?: boolean;
  location?: string;
  is_virtual?: boolean;
  meeting_url?: string;
  organisation_id?: string | null;
  department_id?: string | null;
  programme_id?: string | null;
  project_id?: string | null;
  attendee_ids?: string[];
  attendee_roles?: Record<string, AttendeeRole>;
}

export type UpdateEventPayload = Partial<CreateEventPayload>;

export interface RsvpResponse {
  event_id: string;
  person_id: string;
  response: RsvpStatus;
  responded_at: string;
}

// ============================================================
// SERVICE
// ============================================================

export const eventsService = {
  async list(params?: EventListParams): Promise<EventSummary[]> {
    const { data } = await api.get<EventSummary[]>('/events', { params });
    return data;
  },

  async getUpcoming(limit = 5): Promise<EventSummary[]> {
    const { data } = await api.get<EventSummary[]>('/events/upcoming', {
      params: { limit },
    });
    return data;
  },

  async get(id: string): Promise<EventDetail> {
    const { data } = await api.get<EventDetail>(`/events/${id}`);
    return data;
  },

  async create(payload: CreateEventPayload): Promise<EventDetail> {
    const { data } = await api.post<EventDetail>('/events', payload);
    return data;
  },

  async update(id: string, payload: UpdateEventPayload): Promise<EventDetail> {
    const { data } = await api.patch<EventDetail>(`/events/${id}`, payload);
    return data;
  },

  async publish(id: string): Promise<EventDetail> {
    const { data } = await api.post<EventDetail>(`/events/${id}/publish`);
    return data;
  },

  async cancel(id: string, reason?: string): Promise<EventDetail> {
    const { data } = await api.post<EventDetail>(`/events/${id}/cancel`, {
      reason,
    });
    return data;
  },

  async addAttendees(
    id: string,
    personIds: string[],
    role: AttendeeRole = 'attendee',
  ): Promise<EventDetail> {
    const { data } = await api.post<EventDetail>(`/events/${id}/attendees`, {
      person_ids: personIds,
      role,
    });
    return data;
  },

  async removeAttendee(id: string, personId: string): Promise<EventDetail> {
    const { data } = await api.delete<EventDetail>(
      `/events/${id}/attendees/${personId}`,
    );
    return data;
  },

  async rsvp(
    id: string,
    response: 'accepted' | 'declined' | 'tentative',
    note?: string,
  ): Promise<RsvpResponse> {
    const { data } = await api.post<RsvpResponse>(`/events/${id}/rsvp`, {
      response,
      note,
    });
    return data;
  },
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  general: 'General',
  training: 'Training',
  workshop: 'Workshop',
  conference: 'Conference',
  outreach: 'Outreach',
  fundraising: 'Fundraising',
  community: 'Community',
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  cancelled: 'Cancelled',
};
