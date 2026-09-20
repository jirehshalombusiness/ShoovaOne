import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  AlertCircle,
  File as FileIcon,
  FileImage,
  FileArchive,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { api } from '@/services/api';
import { documentService } from '@/services/document.service';
import { meService } from '@/services/me.service';
import { cn } from '@/lib/utils';

interface MeDocument {
  id: string;
  name: string;
  file_url: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
}

function getFileIcon(mimeType: string | null): React.ElementType {
  if (!mimeType) return FileIcon;
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.includes('zip') || mimeType.includes('tar')) return FileArchive;
  return FileText;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MeDocumentsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // We need our own person_id — fetch from /me/profile
  const profileQuery = useQuery({
    queryKey: ['me', 'profile'],
    queryFn: () => meService.getProfile(),
  });

  const personId = profileQuery.data?.id;

  const docsQuery = useQuery({
    queryKey: ['me', 'documents', personId],
    queryFn: async (): Promise<MeDocument[]> => {
      if (!personId) return [];
      try {
        const { data } = await api.get<MeDocument[]>(
          `/documents/person/${personId}`,
        );
        return data;
      } catch (e: any) {
        if (e?.response?.status === 404) return [];
        throw e;
      }
    },
    enabled: !!personId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'home'] });
      toast.success('Document deleted');
    },
    onError: () => toast.error('Failed to delete document'),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !personId) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await documentService.upload(file, 'person', personId);
      }
      queryClient.invalidateQueries({ queryKey: ['me', 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'home'] });
      toast.success(`${files.length} file${files.length > 1 ? 's' : ''} uploaded`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const documents = docsQuery.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">My Documents</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Contracts, IDs, certifications, and other HR documents
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !personId}
          className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800">
          Upload your CV, IDs, certifications, and documents HR requests.
        </div>
      </div>

      {docsQuery.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="border border-gray-200 rounded-lg bg-white text-center py-16">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">No documents yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Upload your first document to get started
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
          {documents.map((doc) => {
            const Icon = getFileIcon(doc.mime_type);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-gray-600" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-gray-900 hover:text-primary transition-colors truncate block"
                  >
                    {doc.name}
                  </a>
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                    <span>{formatBytes(doc.file_size_bytes)}</span>
                    <span>·</span>
                    <span>
                      {doc.created_at
                        ? format(new Date(doc.created_at), 'MMM d, yyyy')
                        : '—'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5 text-gray-600" />
                  </a>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${doc.name}"?`)) {
                        deleteMutation.mutate(doc.id);
                      }
                    }}
                    className="p-1.5 rounded hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}