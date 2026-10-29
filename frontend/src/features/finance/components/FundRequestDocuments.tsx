import { useRef, useState } from 'react';
import {
  AlertCircle,
  FileText,
  Loader2,
  UploadCloud,
} from 'lucide-react';

import { documentService } from '@/services/document.service';

import type { FundRequestDocument } from '../finance.types';

interface FundRequestDocumentsProps {
  requestId: string;
  documents: FundRequestDocument[];
  canUpload?: boolean;
  emptyMessage?: string;
  onUploaded?: () => void;
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function fileLabel(name: string) {
  return name.replace(/\.[^.]+$/, '');
}

export function FundRequestDocuments({
  requestId,
  documents,
  canUpload = false,
  emptyMessage = 'No supporting documents attached yet.',
  onUploaded,
}: FundRequestDocumentsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!files.length) return;

    const tooLarge = files.find(
      (file) => file.size > 10 * 1024 * 1024
    );

    if (tooLarge) {
      setError('Each file must be 10 MB or smaller.');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      for (const file of files) {
        await documentService.upload(
          file,
          'fund_request',
          requestId
        );
      }

      onUploaded?.();
    } catch (uploadError) {
      console.error('Failed to upload document:', uploadError);
      setError(
        'The document could not be uploaded. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {documents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <a
                href={document.file_url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <FileText className="h-4 w-4" />
                </span>

                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800 hover:text-slate-950">
                    {fileLabel(document.name)}
                  </span>

                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    {document.file_size_bytes ? (
                      <span>{formatBytes(document.file_size_bytes)}</span>
                    ) : null}

                    {document.created_at && (
                      <span>{formatDate(document.created_at)}</span>
                    )}

                    {document.category && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-500">
                        {document.category}
                      </span>
                    )}
                  </span>
                </span>
              </a>

              <a
                href={document.file_url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-900"
              >
                Open
              </a>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {canUpload && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            {uploading ? 'Uploading…' : 'Add document'}
          </button>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={handleUpload}
            className="sr-only"
          />
        </>
      )}
    </div>
  );
}
