import { useMemo, useState } from 'react';
import { FileText, Info, X } from 'lucide-react';

const ENTITIES = ['SHARED', 'US', 'GH'] as const;
const FUNCTIONS = [
  'Governance',
  'Finance',
  'Development',
  'Implementation',
  'HR',
  'Systems',
  'Performance',
] as const;
const STATUSES = ['Draft', 'Review', 'Approved', 'Archived'] as const;

function cleanToken(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function todayIso() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function DocumentNamingAssistant({
  file,
  onClose,
  onUpload,
}: {
  file: File;
  onClose: () => void;
  onUpload: (file: File) => void;
}) {
  const extensionIndex = file.name.lastIndexOf('.');
  const extension = extensionIndex > 0 ? file.name.slice(extensionIndex) : '';
  const originalSubject = extension
    ? file.name.slice(0, extensionIndex)
    : file.name;
  const [entity, setEntity] = useState<(typeof ENTITIES)[number]>('SHARED');
  const [functionalArea, setFunctionalArea] =
    useState<(typeof FUNCTIONS)[number]>('Systems');
  const [documentType, setDocumentType] = useState('Procedure');
  const [subject, setSubject] = useState(originalSubject);
  const [documentDate, setDocumentDate] = useState(todayIso);
  const [version, setVersion] = useState('V0.1');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('Draft');
  const [useSuggestedName, setUseSuggestedName] = useState(true);

  const suggestedName = useMemo(() => {
    const parts = [
      entity,
      cleanToken(functionalArea),
      cleanToken(documentType),
      cleanToken(subject),
      documentDate,
      version.trim(),
      status,
    ].filter(Boolean);
    return `${parts.join('_')}${extension}`;
  }, [entity, functionalArea, documentType, subject, documentDate, version, status, extension]);

  const inputClass =
    'mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-naming-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <h2 id="document-naming-title" className="text-base font-semibold text-gray-900">
                Document naming guide
              </h2>
              <p className="mt-1 break-all text-xs text-gray-500">Selected file: {file.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close naming guide">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="mt-4 flex gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
          <Info className="h-4 w-4 shrink-0" />
          <p>
            Suggested format: <span className="font-semibold">Entity_Function_DocumentType_Subject_YYYY-MM-DD_Version_Status</span>.
            This is guidance only—you can keep the original file name.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-gray-700">
            Entity
            <select className={inputClass} value={entity} onChange={(event) => setEntity(event.target.value as typeof entity)}>
              {ENTITIES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-700">
            Function
            <select className={inputClass} value={functionalArea} onChange={(event) => setFunctionalArea(event.target.value as typeof functionalArea)}>
              {FUNCTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-700">
            Document type
            <input className={inputClass} value={documentType} maxLength={40} onChange={(event) => setDocumentType(event.target.value)} />
          </label>
          <label className="text-xs font-medium text-gray-700">
            Subject
            <input className={inputClass} value={subject} maxLength={80} onChange={(event) => setSubject(event.target.value)} />
          </label>
          <label className="text-xs font-medium text-gray-700">
            Document date
            <input type="date" className={inputClass} value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
          </label>
          <label className="text-xs font-medium text-gray-700">
            Version
            <input className={inputClass} value={version} maxLength={10} onChange={(event) => setVersion(event.target.value)} placeholder="V0.1" />
          </label>
          <label className="text-xs font-medium text-gray-700 sm:col-span-2">
            Approval status
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
              {STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Suggested file name</p>
          <p className="mt-1 break-all font-mono text-xs text-gray-800">{suggestedName}</p>
          <label className="mt-3 flex items-start gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={useSuggestedName}
              onChange={(event) => setUseSuggestedName(event.target.checked)}
              className="mt-0.5 accent-primary"
            />
            Use the suggested name for this upload
          </label>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const nextFile = useSuggestedName && suggestedName !== file.name
                ? new File([file], suggestedName, { type: file.type, lastModified: file.lastModified })
                : file;
              onUpload(nextFile);
            }}
            disabled={!subject.trim() || !documentType.trim() || !documentDate || !version.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to upload
          </button>
        </div>
      </div>
    </div>
  );
}
