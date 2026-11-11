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
  can_manage_folders?: boolean;
  missing_settings: string[];
  error?: string;
  site?: { id: string; name: string; web_url: string };
  drive?: { id: string; name: string; web_url: string };
}

export type SharePointFolderAction = 'create' | 'delete';
export type SharePointFolderRequestStatus = 'pending' | 'approved' | 'rejected';

export interface SharePointFolderRequest {
  id: string;
  action: SharePointFolderAction;
  folder_name: string;
  folder_id: string | null;
  parent_folder_id: string | null;
  folder_path: string;
  reason: string;
  status: SharePointFolderRequestStatus;
  decision_note: string | null;
  requested_by_id: string;
  resolved_by_id: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface SharePointFolderRequestInput {
  action: SharePointFolderAction;
  folder_name?: string;
  folder_id?: string;
  parent_folder_id?: string | null;
  reason: string;
}

export interface SharePointFolderDecisionInput {
  decision: 'approved' | 'rejected';
  note?: string;
}

export interface SharePointListing {
  folder_id: string;
  query: string | null;
  items: SharePointItem[];
}

const REQUEST_TIMEOUT = 45_000;
const UPLOAD_TIMEOUT = 120_000;
const DOWNLOAD_TIMEOUT = 120_000;

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

  async upload(
    file: File,
    folderId?: string | null
  ): Promise<SharePointItem> {
    const form = new FormData();
    form.append('file', file);

    if (folderId) {
      form.append('folder_id', folderId);
    }

    const response = await api.post<SharePointItem>(
      '/integrations/sharepoint/items/upload',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: UPLOAD_TIMEOUT,
      }
    );
    return response.data;
  },

  async createFolder(
    name: string,
    parentFolderId?: string | null,
  ): Promise<SharePointItem> {
    const response = await api.post<SharePointItem>(
      '/integrations/sharepoint/items/folders',
      { name, parent_folder_id: parentFolderId || null },
      { timeout: REQUEST_TIMEOUT },
    );
    return response.data;
  },

  async deleteFolder(folderId: string): Promise<void> {
    await api.delete(
      `/integrations/sharepoint/items/folders/${encodeURIComponent(folderId)}`,
      { timeout: REQUEST_TIMEOUT },
    );
  },

  async createFolderRequest(
    input: SharePointFolderRequestInput,
  ): Promise<SharePointFolderRequest> {
    const response = await api.post<SharePointFolderRequest>(
      '/integrations/sharepoint/folder-requests',
      input,
      { timeout: REQUEST_TIMEOUT },
    );
    return response.data;
  },

  async listFolderRequests(): Promise<SharePointFolderRequest[]> {
    const response = await api.get<{ requests: SharePointFolderRequest[] }>(
      '/integrations/sharepoint/folder-requests',
      { timeout: REQUEST_TIMEOUT },
    );
    return response.data.requests;
  },

  async listMyFolderRequests(): Promise<SharePointFolderRequest[]> {
    const response = await api.get<{ requests: SharePointFolderRequest[] }>(
      '/integrations/sharepoint/folder-requests/mine',
      { timeout: REQUEST_TIMEOUT },
    );
    return response.data.requests;
  },

  async decideFolderRequest(
    requestId: string,
    input: SharePointFolderDecisionInput,
  ): Promise<SharePointFolderRequest> {
    const response = await api.post<SharePointFolderRequest>(
      `/integrations/sharepoint/folder-requests/${encodeURIComponent(requestId)}/decision`,
      input,
      { timeout: REQUEST_TIMEOUT },
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

  async download(itemId: string): Promise<Blob> {
    const response = await api.get<Blob>(
      `/integrations/sharepoint/items/${encodeURIComponent(itemId)}/content`,
      { responseType: 'blob', timeout: DOWNLOAD_TIMEOUT }
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
