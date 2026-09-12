import { api } from './api';

export interface Task {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  assignee_first_name: string | null;
  assignee_last_name: string | null;
  assignee_image_url: string | null;
  reporter_id: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  created_at: string;
  updated_at: string;
}

export const taskService = {
  async getByProject(projectId: string, params?: { status?: string; assignee_id?: string }): Promise<Task[]> {
    const response = await api.get<Task[]>(`/projects/${projectId}/tasks`, { params });
    return response.data;
  },

  async create(projectId: string, data: Partial<Task>): Promise<Task> {
    const response = await api.post<Task>(`/projects/${projectId}/tasks`, data);
    return response.data;
  },

  async update(taskId: string, data: Partial<Task>): Promise<Task> {
    const response = await api.put<Task>(`/projects/tasks/${taskId}`, data);
    return response.data;
  },

  async delete(taskId: string): Promise<void> {
    await api.delete(`/projects/tasks/${taskId}`);
  },
};