import { api } from './api';

export interface Attendance {
  id: string;
  person_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  duration_minutes: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const attendanceService = {
  async getToday(): Promise<Attendance | null> {
    const response = await api.get<Attendance | null>('/attendance/today');
    return response.data;
  },

  async checkIn(notes?: string): Promise<Attendance> {
    const response = await api.post<Attendance>('/attendance/checkin', { notes });
    return response.data;
  },

  async checkOut(): Promise<Attendance> {
    const response = await api.post<Attendance>('/attendance/checkout');
    return response.data;
  },

  async getAll(params?: { person_id?: string; start_date?: string; end_date?: string }) {
    const response = await api.get<Attendance[]>('/attendance', { params });
    return response.data;
  },

  async update(id: string, data: Partial<Attendance>) {
    const response = await api.put<Attendance>(`/attendance/${id}`, data);
    return response.data;
  },
};