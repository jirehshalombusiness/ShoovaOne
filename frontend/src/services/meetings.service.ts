import { api } from './api';

// ============================================================
// TYPES
// ============================================================

export type LocationType = 'in_person' | 'video' | 'phone';
export type MeetingStatus = 'scheduled' | 'cancelled' | 'completed';
export type AttendeeResponse = 'pending' | 'accepted' | 'declined' | 'tentative';
export type AttendeeRole = 'required' | 'optional';

export interface PersonBrief {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  profile_image_url?: string | null;
}

export interface MeetingAttendee {
  id: string;
  person: PersonBrief;
  role: AttendeeRole;
  response: AttendeeResponse;
  responded_at?: string | null;
  response_note?: string | null;
}

export interface AgendaItem {
  id: string;
  title: string;
  duration_minutes?: number | null;
  position: number;
  notes?: string | null;
  completed: boolean;
}

export interface MeetingSummary {
  id: string;
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  location_type: LocationType;
  location?: string | null;
  meeting_url?: string | null;
  organizer: PersonBrief;
  status: MeetingStatus;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  attendee_count: number;
  my_response?: AttendeeResponse | null;
  project_id?: string | null;
  opportunity_id?: string | null;
}

export interface MeetingDetail extends MeetingSummary {
  attendees: MeetingAttendee[];
  agenda_items: AgendaItem[];
}

export interface MeetingListParams {
  window?: 'upcoming' | 'today' | 'week' | 'past' | 'all';
  limit?: number;
  offset?: number;
}

export interface CreateMeetingPayload {
  title: string;
  description?: string;
  starts_at: string; // ISO
  ends_at: string;   // ISO
  location_type?: LocationType;
  location?: string;
  meeting_url?: string;
  attendee_ids: string[];
  attendee_roles?: Record<string, AttendeeRole>;
  project_id?: string;
  opportunity_id?: string;
  recurrence?: string;
  agenda_titles?: string[];
}

export interface UpdateMeetingPayload {
  title?: string;
  description?: string;
  starts_at?: string;
  ends_at?: string;
  location_type?: LocationType;
  location?: string;
  meeting_url?: string;
  project_id?: string;
  opportunity_id?: string;
}

export interface RsvpPayload {
  response: 'accepted' | 'declined' | 'tentative';
  note?: string;
}

export interface AgendaCreatePayload {
  title: string;
  duration_minutes?: number;
  notes?: string;
}

export interface AgendaUpdatePayload {
  title?: string;
  duration_minutes?: number;
  notes?: string;
  completed?: boolean;
}

// ============================================================
// SERVICE
// ============================================================

export const meetingsService = {
  async list(params?: MeetingListParams): Promise<MeetingSummary[]> {
    const { data } = await api.get<MeetingSummary[]>('/meetings', { params });
    return data;
  },

  async getUpcoming(limit = 5): Promise<MeetingSummary[]> {
    const { data } = await api.get<MeetingSummary[]>('/meetings/upcoming', {
      params: { limit },
    });
    return data;
  },

  async get(id: string): Promise<MeetingDetail> {
    const { data } = await api.get<MeetingDetail>(`/meetings/${id}`);
    return data;
  },

  async create(payload: CreateMeetingPayload): Promise<MeetingDetail> {
    const { data } = await api.post<MeetingDetail>('/meetings', payload);
    return data;
  },

  async update(id: string, payload: UpdateMeetingPayload): Promise<MeetingDetail> {
    const { data } = await api.patch<MeetingDetail>(`/meetings/${id}`, payload);
    return data;
  },

  async cancel(id: string, reason?: string): Promise<MeetingDetail> {
    const { data } = await api.post<MeetingDetail>(`/meetings/${id}/cancel`, {
      reason,
    });
    return data;
  },

  async rsvp(id: string, payload: RsvpPayload): Promise<{
    attendee_id: string;
    person_id: string;
    response: string;
    responded_at: string;
  }> {
    const { data } = await api.post(`/meetings/${id}/rsvp`, payload);
    return data;
  },

  async addAgendaItem(
    meetingId: string,
    payload: AgendaCreatePayload,
  ): Promise<AgendaItem> {
    const { data } = await api.post<AgendaItem>(
      `/meetings/${meetingId}/agenda`,
      payload,
    );
    return data;
  },

  async updateAgendaItem(
    meetingId: string,
    itemId: string,
    payload: AgendaUpdatePayload,
  ): Promise<AgendaItem> {
    const { data } = await api.patch<AgendaItem>(
      `/meetings/${meetingId}/agenda/${itemId}`,
      payload,
    );
    return data;
  },

  async deleteAgendaItem(meetingId: string, itemId: string): Promise<void> {
    await api.delete(`/meetings/${meetingId}/agenda/${itemId}`);
  },
};