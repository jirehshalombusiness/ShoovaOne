import { api } from './api';

export interface AuditLog {
  id: string;
  actor_user_id: string | null;
  actor_person_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  description: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditPagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface AuditListResponse {
  items: AuditLog[];
  pagination: AuditPagination;
}

export interface AuditFilters {
  action?: string;
  entity_type?: string;
  actor_user_id?: string;
  entity_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export interface AuditSummary {
  total: number;
  actions: Array<{
    action: string;
    count: number;
  }>;
  entities: Array<{
    entity_type: string;
    count: number;
  }>;
}

export const auditService = {
  async getAll(
    filters: AuditFilters = {}
  ): Promise<AuditListResponse> {
    const response = await api.get('/audit', {
      params: {
        ...filters,
      },
    });

    return response.data;
  },

  async getById(id: string): Promise<AuditLog> {
    const response = await api.get(`/audit/${id}`);
    return response.data;
  },

  async getSummary(): Promise<AuditSummary> {
    const response = await api.get('/audit/stats/summary');
    return response.data;
  },
};