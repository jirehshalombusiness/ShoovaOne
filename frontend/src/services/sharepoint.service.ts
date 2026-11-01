import { api } from './api';

export interface SharePointItem {
  id: string;
  name: string;
  path: string | null;
  is_folder: boolean;
  size: number | null;
  mime_type: string | null;
  web_url: string | null;
  modified_at: string | null;
  child_count: number | null;
}

export interface SharePointFolderRule {
  id: string;
  folder_id: string | null;
  folder_path: string;
  folder_name: string | null;
  required_permission: string;
  created_at: string;
  updated_at: string;
}

export interface SharePointStatus {
  configured: boolean;
  reachable: boolean;
  missing_settings: string[];
  error?: string;
  site?: { id: string; name: string; web_url: string };
  drive?: { id: string; name: string; web_url: string };
}

export interface SharePointListing {
  folder_id: string;
  query: string | null;
  items: SharePointItem[];
}

const REQUEST_TIMEOUT = 45_000;

export const sharepointService = {
  async status(): Promise<SharePointStatus> {
    const response = await api.get<SharePointStatus>(
      '/integrations/sharepoint/status',
      { timeout: REQUEST_TIMEOUT }
    );
    return response.data;
  },

  async list({
    folderId,
    query,
  }: {
    folderId?: string | null;
    query?: string;
  }): Promise<SharePointListing> {
    const params: Record<string, string> = {};

    if (query) {
      params.q = query;
    } else if (folderId) {
      params.folder_id = folderId;
    }

    const response = await api.get<SharePointListing>(
      '/integrations/sharepoint/items',
      { params, timeout: REQUEST_TIMEOUT }
    );
    return response.data;
  },

  async getItem(itemId: string): Promise<SharePointItem> {
    const response = await api.get<SharePointItem>(
      `/integrations/sharepoint/items/${encodeURIComponent(itemId)}`,
      { timeout: REQUEST_TIMEOUT }
    );
    return response.data;
  },

  async listRules(): Promise<SharePointFolderRule[]> {
    const response = await api.get<{ rules: SharePointFolderRule[] }>(
      '/integrations/sharepoint/rules',
      { timeout: REQUEST_TIMEOUT }
    );
    return response.data.rules;
  },

  async setRule(
    folderId: string,
    requiredPermission: string
  ): Promise<SharePointFolderRule> {
    const response = await api.post<SharePointFolderRule>(
      '/integrations/sharepoint/rules',
      { folder_id: folderId, required_permission: requiredPermission },
      { timeout: REQUEST_TIMEOUT }
    );
    return response.data;
  },

  async deleteRule(ruleId: string): Promise<void> {
    await api.delete(
      `/integrations/sharepoint/rules/${encodeURIComponent(ruleId)}`,
      { timeout: REQUEST_TIMEOUT }
    );
  },
};

export function sharepointErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const detail = (error as { response?: { data?: { detail?: unknown } } })
      .response?.data?.detail;

    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
  }

  return 'SharePoint did not respond. Try again in a moment.';
}
