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
  // Project-scoped tasks
  async getByProject(
    projectId: string,
    params?: { status?: string; assignee_id?: string }
  ): Promise<Task[]> {
    const response = await api.get<Task[]>(`/projects/${projectId}/tasks`, { params });
    return response.data;
  },

  async create(projectId: string, data: Partial<Task>): Promise<Task> {
    const response = await api.post<Task>(`/projects/${projectId}/tasks`, data);
    return response.data;
  },

  // Update a project task
  async update(taskId: string, data: Partial<Task>): Promise<Task> {
    const response = await api.put<Task>(`/projects/tasks/${taskId}`, data);
    return response.data;
  },

  async delete(taskId: string): Promise<void> {
    await api.delete(`/projects/tasks/${taskId}`);
  },

  // Global task endpoints (for personal tasks)
  async getAll(params?: {
    status?: string;
    project_id?: string;
    assignee_id?: string;
  }): Promise<Task[]> {
    const response = await api.get<Task[]>('/tasks/', { params });
    return response.data;
  },

  async getById(taskId: string): Promise<Task> {
    const response = await api.get<Task>(`/tasks/${taskId}`);
    if (!response.data) {
      throw new Error('Task not found');
    }
    return response.data;
  },

  async updateStandalone(taskId: string, data: Partial<Task>): Promise<Task> {
    const response = await api.put<Task>(`/tasks/${taskId}`, data);
    return response.data;
  },

  async deleteStandalone(taskId: string): Promise<void> {
    await api.delete(`/tasks/${taskId}`);
  },
};