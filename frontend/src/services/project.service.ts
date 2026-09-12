import { api } from './api';

export interface ProjectMember {
  id: string;
  project_id: string;
  person_id: string;
  role: string;
  joined_at: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_image_url: string | null;
}

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  status: string;
  position: number;
}

export interface Project {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  end_date: string | null;
  manager_id: string | null;
  department_id: string | null;
  programme_id: string | null;
  organisation_id: string | null;
  budget: number | null;
  actual_cost: number | null;
  progress: number;
  created_at: string;
  updated_at: string;
  manager_first_name: string | null;
  manager_last_name: string | null;
  manager_image_url: string | null;
  task_count: number;
  completed_task_count: number;
  member_count: number;
  members: ProjectMember[];
  milestones: Milestone[];
}

export const projectService = {
  async getAll(params?: {
    status?: string;
    priority?: string;
    search?: string;
    manager_id?: string;
  }): Promise<Project[]> {
    const response = await api.get<Project[]>('/projects', { params });
    return response.data;
  },

  async getById(id: string): Promise<Project> {
    const response = await api.get<Project>(`/projects/${id}`);
    return response.data;
  },

  async create(data: Partial<Project>): Promise<Project> {
    const response = await api.post<Project>('/projects', data);
    return response.data;
  },

  async update(id: string, data: Partial<Project>): Promise<Project> {
    const response = await api.put<Project>(`/projects/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/projects/${id}`);
  },

  async getStats(id: string): Promise<ProjectStats> {
    const response = await api.get<ProjectStats>(`/projects/${id}/stats`);
    return response.data;
  },


  // Milestones
  async createMilestone(projectId: string, data: Partial<Milestone>): Promise<Milestone> {
    const response = await api.post<Milestone>(
      `/projects/${projectId}/milestones`,
      data
    );
    return response.data;
  },

  async updateMilestone(id: string, data: Partial<Milestone>): Promise<Milestone> {
    const response = await api.put<Milestone>(`/projects/milestones/${id}`, data);
    return response.data;
  },

  async deleteMilestone(id: string): Promise<void> {
    await api.delete(`/projects/milestones/${id}`);
  },

  // Members
  async addMember(projectId: string, personId: string, role = 'member'): Promise<ProjectMember> {
    const response = await api.post<ProjectMember>(`/projects/${projectId}/members`, {
      project_id: projectId,
      person_id: personId,
      role,
    });
    return response.data;
  },

  async removeMember(memberId: string): Promise<void> {
    await api.delete(`/projects/members/${memberId}`);
  },
};

export interface ProjectStats {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  member_count: number;
  total_milestones: number;
  completed_milestones: number;
  total_hours: number;
}

