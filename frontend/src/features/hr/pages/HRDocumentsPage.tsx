import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrService } from '@/services/hr.service';
import { documentService } from '@/services/document.service';
import { useAuth } from '@/lib/auth';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  File as FileIcon,
  FileImage,
  FileArchive,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';

function getFileIcon(mimeType: string | null) {
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

export function HRDocumentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['hr', 'my-documents', user?.id],
    queryFn: async () => {
      // Get my own person_id first
      const home = await hrService.getMyHRHome();
      return documentService.list('person', home.person.id);
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'my-documents'] });
      toast.success('Document deleted');
    },
    onError: () => toast.error('Failed to delete document'),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const home = await hrService.getMyHRHome();
      for (const file of Array.from(files)) {
        await documentService.upload(file, 'person', home.person.id);
      }
      queryClient.invalidateQueries({ queryKey: ['hr', 'my-documents'] });
      toast.success(`${files.length} file${files.length > 1 ? 's' : ''} uploaded`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Personal HR documents and certifications
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800">
          Upload your CV, IDs, certifications, and any documents HR has requested.
          Documents marked with <span className="font-semibold">Required</span> must be on file.
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !documents || documents.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">No documents yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Upload your first document to get started
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Document
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
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
                  <div className="flex items-center gap-2">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-900 hover:text-primary transition-colors truncate"
                    >
                      {doc.name}
                    </a>
                    {doc.verified && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 flex-shrink-0">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5">
                    <span>{formatBytes(doc.file_size_bytes)}</span>
                    <span>·</span>
                    <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
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