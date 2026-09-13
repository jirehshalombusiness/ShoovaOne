import { api } from './api';
import { supabase } from '@/lib/supabase';

export interface DocumentItem {
  id: string;
  name: string;
  file_url: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  type: string | null;
  owner_id: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  visibility: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export const documentService = {
  async list(entityType: string, entityId: string): Promise<DocumentItem[]> {
    const response = await api.get<DocumentItem[]>(`/documents/${entityType}/${entityId}`);
    return response.data;
  },

  async upload(
    file: File,
    entityType: string,
    entityId: string
  ): Promise<DocumentItem> {
    // 1. Upload to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${entityId}/${Date.now()}-${file.name}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('project-documents')
      .upload(fileName, file, { upsert: false });

    if (uploadError) throw uploadError;

    // 2. Get public URL
    const { data: urlData } = supabase.storage
      .from('project-documents')
      .getPublicUrl(fileName);

    // 3. Register in backend
    const formData = new FormData();
    formData.append('entity_type', entityType);
    formData.append('entity_id', entityId);
    formData.append('file_url', urlData.publicUrl);
    formData.append('name', file.name);
    formData.append('file_size_bytes', String(file.size));
    formData.append('mime_type', file.type);

    const response = await api.post<DocumentItem>('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/documents/${id}`);
  },
};