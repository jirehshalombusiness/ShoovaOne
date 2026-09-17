import { api } from './api';

export interface AssignedTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: string | null;
  project_name: string | null;
  is_personal: boolean;
}

export interface TodayAttendance {
  date: string;
  check_in: string | null;
  check_out: string | null;
  duration_minutes: number | null;
  status: string;
  planned_task_ids: string[];
  adhoc_tasks: any[];
  assigned_tasks: AssignedTask[];
}

export interface CheckOutBreakdown {
  task_id: string | null;
  hours: number;
  completed: boolean;
  description?: string;
}

export const attendanceService = {
  async getToday(): Promise<TodayAttendance> {
    const response = await api.get<TodayAttendance>('/attendance/today');
    return response.data;
  },

  async checkIn(payload: {
    planned_task_ids: string[];
    adhoc_tasks?: { title: string; priority?: string }[];
    notes?: string;
    work_type?: string;   // NEW
  }): Promise<any> {
    const response = await api.post('/attendance/checkin', payload);
    return response.data;
  },

  async checkOut(payload: {
    task_breakdown: CheckOutBreakdown[];
    notes?: string;
  }): Promise<any> {
    const response = await api.post('/attendance/checkout', payload);
    return response.data;
  },
};