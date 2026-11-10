import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FolderPlus, Trash2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import {
  sharepointErrorMessage,
  sharepointService,
  SharePointItem,
  SharePointFolderRequest,
} from '@/services/sharepoint.service';

const fieldClass =
  'mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

function RequestForm({
  action,
  item,
  parentFolderId,
  onClose,
}: {
  action: 'create' | 'delete';
  item?: SharePointItem;
  parentFolderId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const request = useMutation({
    mutationFn: () =>
      sharepointService.createFolderRequest({
        action,
        ...(action === 'create'
          ? { folder_name: name.trim(), parent_folder_id: parentFolderId }
          : { folder_id: item!.id }),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharepoint-folder-requests'] });
      queryClient.invalidateQueries({ queryKey: ['sharepoint-my-folder-requests'] });
      toast.success('Folder request sent to the CEO for review');
      onClose();
    },
    onError: (error) => toast.error(sharepointErrorMessage(error)),
  });

  const title = action === 'create' ? 'Request a folder' : 'Request folder deletion';
  const canSubmit = reason.trim().length >= 5 && (action === 'delete' || name.trim().length > 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="folder-request-title">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          request.mutate();
        }}
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 id="folder-request-title" className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-xs text-gray-500">
          The CEO will review this request in ShoovaOne before any SharePoint change is made.
        </p>
        {action === 'create' ? (
          <label className="mt-4 block text-xs font-medium text-gray-700">
            Folder name
            <input autoFocus className={fieldClass} value={name} maxLength={255} onChange={(event) => setName(event.target.value)} />
          </label>
        ) : (
          <p className="mt-4 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-800">
            Folder: <span className="font-medium">{item?.path || item?.name}</span>
          </p>
        )}
        <label className="mt-3 block text-xs font-medium text-gray-700">
          Reason (required)
          <textarea autoFocus={action === 'delete'} className={fieldClass} rows={3} value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={!canSubmit || request.isPending} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
            {request.isPending ? 'Sending...' : 'Send request'}
          </button>
        </div>
      </form>
    </div>
  );
}

function RequestList({
  requests,
  canManage,
}: {
  requests: SharePointFolderRequest[];
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approved' | 'rejected' }) =>
      sharepointService.decideFolderRequest(id, { decision }),
    onSuccess: (request) => {
      queryClient.invalidateQueries({ queryKey: ['sharepoint-folder-requests'] });
      queryClient.invalidateQueries({ queryKey: ['sharepoint-my-folder-requests'] });
      queryClient.invalidateQueries({ queryKey: ['sharepoint-items'] });
      toast.success(`Request ${request.status}`);
    },
    onError: (error) => toast.error(sharepointErrorMessage(error)),
  });

  if (requests.length === 0) {
    return <p className="mt-3 text-sm text-gray-500">There are no folder requests to show.</p>;
  }

  return (
    <ul className="mt-3 divide-y divide-gray-100 rounded-md border border-gray-100">
      {requests.map((request) => (
        <li key={request.id} className="flex flex-wrap items-start gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="break-all text-sm font-medium text-gray-900">
              <span className="capitalize">{request.action}</span>: {request.folder_path}
            </p>
            <p className="mt-1 break-words text-xs text-gray-500">{request.reason}</p>
            <p className="mt-1 text-[11px] text-gray-400">
              {new Date(request.created_at).toLocaleString()} · <span className="capitalize">{request.status}</span>
              {request.decision_note ? ` · ${request.decision_note}` : ''}
            </p>
          </div>
          {canManage && request.status === 'pending' && (
            <div className="flex gap-1">
              <button
                type="button"
                title="Approve and perform operation"
                aria-label="Approve folder request"
                disabled={decide.isPending}
                onClick={() => {
                  if (
                    request.action === 'delete' &&
                    !window.confirm(`Approve deletion of the empty folder "${request.folder_path}"?`)
                  ) return;
                  decide.mutate({ id: request.id, decision: 'approved' });
                }}
                className="rounded p-1.5 text-green-700 hover:bg-green-50 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
              </button>
              <button type="button" title="Decline request" aria-label="Decline folder request" disabled={decide.isPending} onClick={() => decide.mutate({ id: request.id, decision: 'rejected' })} className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function RequestFolderDeleteButton({ item }: { item: SharePointItem }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Request deletion of this empty folder" aria-label={`Request deletion of ${item.name}`} className="rounded p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        <Trash2 className="h-4 w-4" />
      </button>
      {open && <RequestForm action="delete" item={item} parentFolderId={null} onClose={() => setOpen(false)} />}
    </>
  );
}

export function FolderGovernance({
  canManageFolders,
  currentFolderId,
  onFolderChanged,
}: {
  canManageFolders: boolean;
  currentFolderId: string | null;
  onFolderChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requestForm, setRequestForm] = useState(false);
  const [showQueue, setShowQueue] = useState(searchParams.get('folder-requests') === '1' && canManageFolders);
  const [showMine, setShowMine] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createReason, setCreateReason] = useState('');

  const requestsQuery = useQuery({
    queryKey: ['sharepoint-folder-requests'],
    queryFn: sharepointService.listFolderRequests,
    enabled: canManageFolders && showQueue,
    retry: false,
  });
  const mineQuery = useQuery({
    queryKey: ['sharepoint-my-folder-requests'],
    queryFn: sharepointService.listMyFolderRequests,
    enabled: showMine,
    retry: false,
  });
  const createDirectly = useMutation({
    mutationFn: () => sharepointService.createFolder(createName.trim(), currentFolderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharepoint-items'] });
      setCreateName('');
      setCreateReason('');
      toast.success('Folder created');
      onFolderChanged();
    },
    onError: (error) => toast.error(sharepointErrorMessage(error)),
  });
  const requestCreate = useMutation({
    mutationFn: () =>
      sharepointService.createFolderRequest({
        action: 'create',
        folder_name: createName.trim(),
        parent_folder_id: currentFolderId,
        reason: createReason.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharepoint-folder-requests'] });
      queryClient.invalidateQueries({ queryKey: ['sharepoint-my-folder-requests'] });
      setCreateName('');
      setCreateReason('');
      setRequestForm(false);
      toast.success('Folder request sent to the CEO for review');
    },
    onError: (error) => toast.error(sharepointErrorMessage(error)),
  });

  function toggleQueue() {
    const next = !showQueue;
    setShowQueue(next);
    if (next) {
      setSearchParams((current) => {
        current.set('folder-requests', '1');
        return current;
      }, { replace: true });
    } else {
      setSearchParams((current) => {
        current.delete('folder-requests');
        return current;
      }, { replace: true });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setRequestForm(true)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <FolderPlus className="h-4 w-4" />
          {canManageFolders ? 'Create folder' : 'Request folder'}
        </button>
        <button type="button" onClick={() => setShowMine((value) => !value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          {showMine ? 'Hide my requests' : 'My folder requests'}
        </button>
        {canManageFolders && (
          <button type="button" onClick={toggleQueue} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {showQueue ? 'Hide approval queue' : 'Folder approval queue'}
          </button>
        )}
      </div>

      {showQueue && canManageFolders && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Folder approval queue</h2>
          {requestsQuery.isLoading ? <p className="mt-3 text-sm text-gray-500">Loading requests...</p> : requestsQuery.isError ? <p className="mt-3 text-sm text-red-600">{sharepointErrorMessage(requestsQuery.error)}</p> : <RequestList requests={requestsQuery.data ?? []} canManage />}
        </section>
      )}
      {showMine && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">My folder requests</h2>
          {mineQuery.isLoading ? <p className="mt-3 text-sm text-gray-500">Loading requests...</p> : mineQuery.isError ? <p className="mt-3 text-sm text-red-600">{sharepointErrorMessage(mineQuery.error)}</p> : <RequestList requests={mineQuery.data ?? []} canManage={false} />}
        </section>
      )}

      {requestForm && (canManageFolders ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="create-folder-title">
          <form onSubmit={(event) => { event.preventDefault(); createDirectly.mutate(); }} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 id="create-folder-title" className="text-base font-semibold text-gray-900">Create SharePoint folder</h2>
            <label className="mt-4 block text-xs font-medium text-gray-700">Folder name<input autoFocus className={fieldClass} value={createName} maxLength={255} onChange={(event) => setCreateName(event.target.value)} /></label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRequestForm(false)} className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700">Cancel</button>
              <button type="submit" disabled={!createName.trim() || createDirectly.isPending} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{createDirectly.isPending ? 'Creating...' : 'Create folder'}</button>
            </div>
          </form>
        </div>
      ) : (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="create-folder-request-title">
          <form onSubmit={(event) => { event.preventDefault(); requestCreate.mutate(); }} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 id="create-folder-request-title" className="text-base font-semibold text-gray-900">Request a SharePoint folder</h2>
            <p className="mt-1 text-xs text-gray-500">A CEO must approve the request before the folder is created.</p>
            <label className="mt-4 block text-xs font-medium text-gray-700">Folder name<input autoFocus className={fieldClass} value={createName} maxLength={255} onChange={(event) => setCreateName(event.target.value)} /></label>
            <label className="mt-3 block text-xs font-medium text-gray-700">Reason (required)<textarea className={fieldClass} rows={3} value={createReason} maxLength={1000} onChange={(event) => setCreateReason(event.target.value)} /></label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRequestForm(false)} className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700">Cancel</button>
              <button type="submit" disabled={createName.trim().length === 0 || createReason.trim().length < 5 || requestCreate.isPending} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{requestCreate.isPending ? 'Sending...' : 'Send request'}</button>
            </div>
          </form>
        </div>
      ))}

      {!canManageFolders && <span className="sr-only">Folder changes require CEO approval.</span>}
    </div>
  );
}
