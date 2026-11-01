import { useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  Home,
  Link2,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermissions } from '@/hooks/usePermissions';
import {
  sharepointErrorMessage,
  sharepointService,
  SharePointItem,
} from '@/services/sharepoint.service';

interface Crumb {
  id: string | null;
  name: string;
}

const PERMISSION_OPTIONS = [
  { value: 'finance.view', label: 'Finance records (finance.view)' },
  {
    value: 'hr.view_sensitive',
    label: 'Sensitive HR data (hr.view_sensitive)',
  },
  { value: 'payroll.view_all', label: 'Payroll records (payroll.view_all)' },
  { value: 'people.view', label: 'People directory (people.view)' },
  { value: 'crm.view', label: 'CRM records (crm.view)' },
  { value: 'projects.view', label: 'Projects (projects.view)' },
  {
    value: 'documents.manage',
    label: 'Document administrators (documents.manage)',
  },
];

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : format(date, 'MMM d, yyyy');
}

function fileIcon(item: SharePointItem) {
  const extension = item.name.split('.').pop()?.toLowerCase() ?? '';

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
    return FileImage;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
    return FileArchive;
  }
  if (['xls', 'xlsx', 'csv'].includes(extension)) {
    return FileSpreadsheet;
  }
  if (
    ['doc', 'docx', 'pdf', 'txt', 'rtf', 'ppt', 'pptx', 'md', 'odt'].includes(
      extension
    )
  ) {
    return FileText;
  }

  const mime = item.mime_type ?? '';

  if (mime.startsWith('image/')) return FileImage;
  if (mime.includes('spreadsheet') || mime.includes('excel')) {
    return FileSpreadsheet;
  }
  if (
    mime.startsWith('text/') ||
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('presentation')
  ) {
    return FileText;
  }

  return File;
}

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('documents.manage');

  const [trail, setTrail] = useState<Crumb[]>([{ id: null, name: 'Library' }]);
  const [search, setSearch] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  const [ruleTarget, setRuleTarget] = useState<SharePointItem | null>(null);
  const [rulePermission, setRulePermission] = useState(
    PERMISSION_OPTIONS[0].value
  );

  const debouncedSearch = useDebounce(search.trim(), 350);
  const searchActive = debouncedSearch.length >= 2;
  const folder = trail[trail.length - 1];

  const statusQuery = useQuery({
    queryKey: ['sharepoint-status'],
    queryFn: sharepointService.status,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const status = statusQuery.data;
  const canBrowse = statusQuery.isSuccess && status?.reachable === true;
  const driveName = status?.drive?.name ?? 'Documents';

  const itemsQuery = useQuery({
    queryKey: [
      'sharepoint-items',
      searchActive ? `search:${debouncedSearch}` : folder.id ?? 'root',
    ],
    queryFn: () =>
      sharepointService.list({
        folderId: searchActive ? null : folder.id,
        query: searchActive ? debouncedSearch : undefined,
      }),
    enabled: canBrowse,
    retry: false,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

  const items = itemsQuery.data?.items ?? [];
  const itemsError = itemsQuery.isError
    ? sharepointErrorMessage(itemsQuery.error)
    : null;
  // keepPreviousData keeps the old folder on screen while the next one loads;
  // an empty previous result must not flash "no files match" mid-search.
  const showLoading = itemsQuery.isLoading || (itemsQuery.isFetching && items.length === 0);

  const rulesQuery = useQuery({
    queryKey: ['sharepoint-rules'],
    queryFn: sharepointService.listRules,
    enabled: canManage && canBrowse,
    retry: false,
    staleTime: 30 * 1000,
  });

  const rules = rulesQuery.data ?? [];
  const ruleByPath = new Map(
    rules.map((rule) => [rule.folder_path.toLowerCase(), rule])
  );

  function exactRuleFor(item: SharePointItem) {
    if (!item.is_folder || !item.path) return undefined;
    return ruleByPath.get(item.path.toLowerCase());
  }

  // A folder inside a restricted one inherits the parent's rule.
  function inheritedRuleFor(item: SharePointItem) {
    if (!item.is_folder || !item.path) return undefined;
    const path = item.path.toLowerCase();

    return rules.find((rule) => {
      const folder = rule.folder_path.toLowerCase();
      return path === folder || path.startsWith(`${folder}/`);
    });
  }

  function openRuleDialog(item: SharePointItem) {
    const existing = exactRuleFor(item);
    setRuleTarget(item);
    setRulePermission(existing?.required_permission ?? PERMISSION_OPTIONS[0].value);
  }

  function refreshAfterRuleChange() {
    queryClient.invalidateQueries({ queryKey: ['sharepoint-rules'] });
    queryClient.invalidateQueries({ queryKey: ['sharepoint-items'] });
  }

  const saveRule = useMutation({
    mutationFn: () =>
      sharepointService.setRule(ruleTarget!.id, rulePermission),
    onSuccess: () => {
      refreshAfterRuleChange();
      setRuleTarget(null);
      toast.success('Access rule saved');
    },
    onError: (error) => toast.error(sharepointErrorMessage(error)),
  });

  const removeRule = useMutation({
    mutationFn: (ruleId: string) => sharepointService.deleteRule(ruleId),
    onSuccess: () => {
      refreshAfterRuleChange();
      setRuleTarget(null);
      toast.success('Restriction removed');
    },
    onError: (error) => toast.error(sharepointErrorMessage(error)),
  });

  const ruleTargetRule = ruleTarget ? exactRuleFor(ruleTarget) : undefined;
  const permissionOptions =
    ruleTargetRule &&
    !PERMISSION_OPTIONS.some(
      (option) => option.value === ruleTargetRule.required_permission
    )
      ? [
          ...PERMISSION_OPTIONS,
          {
            value: ruleTargetRule.required_permission,
            label: ruleTargetRule.required_permission,
          },
        ]
      : PERMISSION_OPTIONS;

  function enterFolder(item: SharePointItem) {
    setSearch('');
    setTrail((current) => [...current, { id: item.id, name: item.name }]);
  }

  function goToCrumb(index: number) {
    setSearch('');
    setTrail((current) => current.slice(0, index + 1));
  }

  async function copyLink(item: SharePointItem) {
    if (!item.web_url) return;

    try {
      await navigator.clipboard.writeText(item.web_url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Documents</h1>
          <p className="mt-1 text-sm text-gray-500">
            {status?.site?.name
              ? `${status.site.name} · ${driveName}`
              : 'Shared SharePoint library'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && canBrowse && (
            <button
              onClick={() => setManageOpen((open) => !open)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors',
                manageOpen
                  ? 'border-primary/30 bg-primary/5 text-primary'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              {manageOpen ? 'Hide access rules' : 'Manage access'}
            </button>
          )}
          {status?.drive?.web_url && (
            <a
              href={status.drive.web_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" />
              Open in SharePoint
            </a>
          )}
        </div>
      </div>

      {statusQuery.isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="h-14 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      )}

      {statusQuery.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to check the SharePoint connection. Try again shortly.
        </div>
      )}

      {status && !status.configured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                SharePoint is not connected yet
              </p>
              <p className="mt-1 text-sm text-amber-800">
                An administrator needs to finish the Microsoft 365 setup before
                this library can be browsed.
              </p>
              {status.missing_settings.length > 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  Missing: {status.missing_settings.join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {status && status.configured && !status.reachable && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-900">
                  SharePoint could not be reached
                </p>
                <p className="mt-1 break-words text-sm text-red-800">
                  {status.error ?? 'Microsoft Graph did not accept the request.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => statusQuery.refetch()}
              disabled={statusQuery.isFetching}
              className="flex-shrink-0 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {canBrowse && canManage && manageOpen && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900">
                Folder access
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Restricted folders are hidden from anyone without the
                permission. Use the shield on a folder to add or change a rule.
              </p>
            </div>
          </div>

          {rulesQuery.isLoading ? (
            <div className="mt-4 space-y-2">
              {[1, 2].map((index) => (
                <div
                  key={index}
                  className="h-10 animate-pulse rounded-md bg-gray-100"
                />
              ))}
            </div>
          ) : rulesQuery.isError ? (
            <p className="mt-4 text-sm text-red-600">
              Could not load access rules.
            </p>
          ) : rules.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              Every folder is visible to anyone with Documents access.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-gray-100 rounded-md border border-gray-100">
              {rules.map((rule) => (
                <li
                  key={rule.id}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <Lock className="h-4 w-4 flex-shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {rule.folder_path}
                    </p>
                    <p className="truncate text-[11px] text-gray-500">
                      Visible to holders of {rule.required_permission}
                    </p>
                  </div>
                  <button
                    onClick={() => removeRule.mutate(rule.id)}
                    disabled={removeRule.isPending}
                    title="Remove restriction"
                    className="rounded p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {canBrowse && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="space-y-3 border-b border-gray-200 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  maxLength={200}
                  placeholder="Search the whole library..."
                  className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-9 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    title="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => itemsQuery.refetch()}
                disabled={itemsQuery.isFetching}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw
                  className={cn('h-4 w-4', itemsQuery.isFetching && 'animate-spin')}
                />
                Refresh
              </button>
            </div>

            {!searchActive && (
              <div className="flex items-center gap-1 overflow-x-auto text-sm text-gray-500">
                {trail.map((crumb, index) => {
                  const isCurrent = index === trail.length - 1;
                  const label = index === 0 ? driveName : crumb.name;

                  return (
                    <span
                      key={crumb.id ?? 'root'}
                      className="flex flex-shrink-0 items-center gap-1"
                    >
                      {index > 0 && (
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                      )}
                      <button
                        onClick={() => goToCrumb(index)}
                        disabled={isCurrent}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors',
                          isCurrent
                            ? 'font-medium text-gray-900'
                            : 'hover:bg-gray-100 hover:text-gray-900'
                        )}
                      >
                        {index === 0 && <Home className="h-3.5 w-3.5" />}
                        {label}
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {searchActive && (
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-600">
              <span>
                {itemsQuery.isFetching
                  ? 'Searching...'
                  : `${items.length} result${items.length === 1 ? '' : 's'} for “${debouncedSearch}”`}
              </span>
              <button
                onClick={() => setSearch('')}
                className="font-medium text-primary hover:underline"
              >
                Clear search
              </button>
            </div>
          )}

          {showLoading ? (
            <div className="space-y-2 p-3 sm:p-4">
              {[1, 2, 3, 4].map((index) => (
                <div
                  key={index}
                  className="h-14 animate-pulse rounded-lg bg-gray-100"
                />
              ))}
            </div>
          ) : itemsError ? (
            <div className="px-4 py-10 text-center">
              <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-300" />
              <p className="text-sm font-medium text-gray-900">
                Could not load this folder
              </p>
              <p className="mx-auto mt-1 max-w-md break-words text-sm text-gray-500">
                {itemsError}
              </p>
              <button
                onClick={() => itemsQuery.refetch()}
                className="mt-4 inline-flex items-center gap-2 rounded-md border border-gray-200 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-14 text-center">
              {searchActive ? (
                <>
                  <Search className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                  <p className="text-sm font-medium text-gray-700">
                    No files match “{debouncedSearch}”
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Try a shorter word, or check the spelling.
                  </p>
                </>
              ) : (
                <>
                  <Folder className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                  <p className="text-sm font-medium text-gray-700">
                    This folder is empty
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Files added in SharePoint will appear here.
                  </p>
                </>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((item) => {
                const Icon = item.is_folder ? Folder : fileIcon(item);
                const restriction = inheritedRuleFor(item);
                const ownRule = exactRuleFor(item);

                const content = (
                  <>
                    <div
                      className={cn(
                        'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md',
                        item.is_folder
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {item.name}
                        </p>
                        {restriction && (
                          <span
                            title={
                              ownRule
                                ? `Visible to holders of ${restriction.required_permission}`
                                : `Inside a folder restricted to ${restriction.required_permission}`
                            }
                            className="inline-flex flex-shrink-0 items-center rounded bg-amber-50 p-0.5 text-amber-600"
                          >
                            <Lock className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {item.is_folder
                          ? `${item.child_count ?? 0} ${
                              item.child_count === 1 ? 'item' : 'items'
                            }`
                          : `${formatBytes(item.size)} · ${formatDate(
                              item.modified_at
                            )}`}
                      </p>
                    </div>
                  </>
                );

                return (
                  <li
                    key={item.id}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                  >
                    {item.is_folder ? (
                      <button
                        type="button"
                        onClick={() => enterFolder(item)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        {content}
                      </button>
                    ) : (
                      <a
                        href={item.web_url ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        {content}
                      </a>
                    )}

                    {!item.is_folder && (
                      <button
                        onClick={() => copyLink(item)}
                        title="Copy link"
                        className="rounded p-1.5 text-gray-400 opacity-100 transition hover:bg-gray-200 hover:text-gray-700 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Link2 className="h-4 w-4" />
                      </button>
                    )}

                    {canManage && item.is_folder && (
                      <button
                        onClick={() => openRuleDialog(item)}
                        title={
                          ownRule
                            ? 'Edit access rule'
                            : 'Restrict this folder'
                        }
                        className={cn(
                          'rounded p-1.5 transition',
                          ownRule
                            ? 'text-primary hover:bg-primary/10'
                            : 'text-gray-400 hover:bg-gray-200 hover:text-gray-700'
                        )}
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </button>
                    )}

                    {item.is_folder ? (
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-300" />
                    ) : (
                      <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-gray-100 px-4 py-2.5 text-[11px] text-gray-400">
            Read-only. Files open in SharePoint, where the original stays up to date.
          </div>
        </div>
      )}

      {ruleTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setRuleTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900">
                  Folder access
                </h3>
                <p className="mt-1 break-words text-sm text-gray-500">
                  {ruleTarget.path ?? ruleTarget.name}
                </p>
              </div>
              <button
                onClick={() => setRuleTarget(null)}
                title="Close"
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label
              htmlFor="rule-permission"
              className="mt-4 block text-xs font-medium text-gray-600"
            >
              Visible only to people with
            </label>
            <select
              id="rule-permission"
              value={rulePermission}
              onChange={(event) => setRulePermission(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {permissionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[11px] text-gray-400">
              Applies to this folder and everything inside it.
            </p>

            <div className="mt-5 flex items-center justify-between gap-2">
              <div>
                {ruleTargetRule && (
                  <button
                    onClick={() => removeRule.mutate(ruleTargetRule.id)}
                    disabled={removeRule.isPending}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove restriction
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRuleTarget(null)}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveRule.mutate()}
                  disabled={saveRule.isPending}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
                >
                  {saveRule.isPending ? 'Saving...' : 'Save rule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
