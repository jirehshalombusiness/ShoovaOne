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
  description: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  end_date: string | null;
  progress: number;
  manager_id: string | null;
  manager_first_name: string | null;
  manager_last_name: string | null;
  manager_image_url: string | null;
  my_role: string;
  my_open_tasks: number;
  total_tasks: number;
  completed_tasks: number;
}

export interface MyTimesheetEntry {
  id: string;
  date: string;
  duration: number;
  description: string | null;
  project_id: string | null;
}

export interface MyTimesheet {
  id?: string;
  week_start_date: string;
  week_end_date: string;
  total_hours: number;
  expected_hours: number;
  status: string;
  entries: MyTimesheetEntry[];
}

export interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  metadata: Record<string, any> | null;
}

export const myWorkService = {
  async getSummary(): Promise<MyWorkSummary> {
    const response = await api.get<MyWorkSummary>('/my-work/summary');
    return response.data;
  },

  async getTasks(
    filter?: 'today' | 'overdue' | 'upcoming' | 'all',
    status?: string
  ): Promise<MyTask[]> {
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

  async getTimesheet(): Promise<MyTimesheet> {
    const response = await api.get<MyTimesheet>('/my-work/timesheet');
    return response.data;
  },

  async getMeetings(): Promise<any[]> {
    const response = await api.get<any[]>('/my-work/meetings');
    return response.data;
  },

  async getActivity(): Promise<ActivityItem[]> {
    const response = await api.get<ActivityItem[]>('/my-work/activity');
    return response.data;
  },
};