import { api } from './api';

export interface Organisation {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
}

export interface OrganisationListResponse {
  items: Organisation[];
  total: number;
}

export interface OrganisationCreatePayload {
  name: string;
  code?: string;
  description?: string;
}

export interface OrganisationListParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export const organisationService = {
  async list(params?: OrganisationListParams): Promise<OrganisationListResponse> {
    const { data } = await api.get<Organisation[]>('/organisation/', { params });
    // Backend returns a raw array — wrap it into a response shape
    return { items: data, total: data.length };
  },

  async getById(id: string): Promise<Organisation> {
    const { data } = await api.get<Organisation>(`/organisation/${id}`);
    return data;
  },

  async create(payload: OrganisationCreatePayload): Promise<Organisation> {
    const { data } = await api.post<Organisation>('/organisation', payload);
    return data;
  },
};
