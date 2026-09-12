import { api } from './api';

export interface MyWorkSummary {
  open_tasks: number;
  tasks_due_today: number;
  overdue_tasks: number;
  timesheet_hours: number;
  timesheet_expected: number;
  timesheet_status: string;
  timesheet_week_start: string;
  timesheet_week_end: string;
  pending_approvals: number;
  meetings_today: number;
}

export interface MyTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: string | null;
  assignee_id: string | null;
  created_at: string | null;
}

export interface MyProject {
  id: string;
  name: string;
  code: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  end_date: string | null;
  is_manager: boolean;
}

export const myWorkService = {
  async getSummary(): Promise<MyWorkSummary> {
    const response = await api.get<MyWorkSummary>('/my-work/summary');
    return response.data;
  },

  async getTasks(filter?: 'today' | 'overdue' | 'upcoming' | 'all', status?: string): Promise<MyTask[]> {
    const params: Record<string, string> = {};
    if (filter) params.filter = filter;
    if (status) params.status = status;
    const response = await api.get<MyTask[]>('/my-work/tasks', { params });
    return response.data;
  },

  async getProjects(): Promise<MyProject[]> {
    const response = await api.get<MyProject[]>('/my-work/projects');
    return response.data;
  },
};