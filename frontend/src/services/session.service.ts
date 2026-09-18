import { api } from './api';

export interface SessionStatus {
  has_attendance: boolean;
  attendance_id?: string;
  work_type?: string;
  check_in?: string | null;
  check_out?: string | null;
  status: string;
  session?: {
    id: string;
    started_at: string;
    last_activity_at: string;
  } | null;
  total_minutes: number;
  standard_minutes: number;
  overtime_minutes: number;
}

export const sessionService = {
  async getStatus(): Promise<SessionStatus> {
    const response = await api.get<SessionStatus>('/sessions/status');
    return response.data;
  },

  async start(): Promise<{ session_id: string; started_at: string }> {
    const response = await api.post('/sessions/start');
    return response.data;
  },

  async heartbeat(): Promise<void> {
    await api.post('/sessions/heartbeat');
  },

  async pause(): Promise<void> {
    await api.post('/sessions/pause');
  },

  async autoEnd(): Promise<void> {
    await api.post('/sessions/auto-end');
  },

  async checkout(payload: {
    task_breakdown: Array<{
      task_id: string | null;
      hours: number;
      description?: string;
    }>;
  }): Promise<any> {
    const response = await api.post('/sessions/checkout', payload);
    return response.data;
  },
};