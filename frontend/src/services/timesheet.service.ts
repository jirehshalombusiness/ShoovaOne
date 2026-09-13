import { api } from './api';

export interface TimesheetEntry {
  id: string;
  timesheet_id: string;
  date: string;
  project_id: string | null;
  task_id: string | null;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  duration: number;
  description: string | null;
  is_billable: string;
  created_at: string;
  updated_at: string;
}

export interface Timesheet {
  id: string;
  person_id: string;
  week_start_date: string;
  week_end_date: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'locked';
  total_hours: number;
  expected_hours: number;
  submitted_at: string | null;
  submitted_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  entries: TimesheetEntry[];
}

export interface TimesheetEntryCreate {
  timesheet_id: string;
  date: string;
  project_id?: string;
  task_id?: string;
  start_time?: string;
  end_time?: string;
  break_minutes?: number;
  duration: number;
  description?: string;
  is_billable?: string;
}

export interface TimesheetAnalytics {
  week_start: string;
  week_end: string;
  total_hours: number;
  expected_hours: number;
  status?: string;
  daily: { date: string; hours: number }[];
  by_project: { name: string; hours: number }[];
}

export const timesheetService = {
  async getMyTimesheet(weekStart?: string): Promise<Timesheet> {
    const params = weekStart ? { week_start: weekStart } : {};
    const response = await api.get<Timesheet>('/timesheets/my', { params });
    return response.data;
  },

  async createEntry(data: TimesheetEntryCreate): Promise<TimesheetEntry> {
    const response = await api.post<TimesheetEntry>('/timesheets/entries', data);
    return response.data;
  },

  async updateEntry(id: string, data: Partial<TimesheetEntry>): Promise<TimesheetEntry> {
    const response = await api.put<TimesheetEntry>(`/timesheets/entries/${id}`, data);
    return response.data;
  },

  // Add to timesheetService:
  async getAnalytics(weekStart?: string): Promise<TimesheetAnalytics> {
    const params = weekStart ? { week_start: weekStart } : {};
    const response = await api.get<TimesheetAnalytics>('/timesheets/my/analytics', { params });
    return response.data;
  },

  async deleteEntry(id: string): Promise<void> {
    await api.delete(`/timesheets/entries/${id}`);
  },

  async submitTimesheet(timesheetId: string): Promise<Timesheet> {
    const response = await api.post<Timesheet>('/timesheets/submit', { timesheet_id: timesheetId });
    return response.data;
  },

  async getTeamTimesheets(weekStart?: string): Promise<Timesheet[]> {
    const params = weekStart ? { week_start: weekStart } : {};
    const response = await api.get<Timesheet[]>('/timesheets/team', { params });
    return response.data;
  },

  async approveTimesheet(timesheetId: string, comment?: string): Promise<Timesheet> {
    const response = await api.post<Timesheet>('/timesheets/approve', { timesheet_id: timesheetId, comment });
    return response.data;
  },

  async returnTimesheet(timesheetId: string, comment: string): Promise<Timesheet> {
    const response = await api.post<Timesheet>('/timesheets/return', { timesheet_id: timesheetId, comment });
    return response.data;
  },

  async getApprovalHistory(timesheetId: string): Promise<any[]> {
    const response = await api.get(`/timesheets/history/${timesheetId}`);
    return response.data;
  },
};