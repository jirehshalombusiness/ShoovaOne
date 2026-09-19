import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  Globe,
  Search,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { auditService, AuditLog } from '@/services/audit.service';

const ACTIONS = [
  'PERSON_CREATED',
  'PERSON_UPDATED',
  'PERSON_DELETED',
  'USER_CREATED',
  'USER_ACTIVATED',
  'USER_DEACTIVATED',
  'USER_DELETED',
  'ROLE_CHANGED',
  'PERMISSION_GRANTED',
  'PERMISSION_REVOKED',
  'ATTENDANCE_CHECKED_IN',
  'ATTENDANCE_CHECKED_OUT',
  'TIMESHEET_CREATED',
  'TIMESHEET_UPDATED',
  'TIMESHEET_DELETED',
  'TIMESHEET_SUBMITTED',
  'TIMESHEET_APPROVED',
  'TIMESHEET_REJECTED',
];

const ENTITY_TYPES = [
  'person',
  'user',
  'attendance',
  'timesheet',
];

function formatAction(action: string) {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatEntity(entity: string) {
  return entity
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-GH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getActionClass(action: string) {
  if (
    action.includes('DELETED') ||
    action.includes('REJECTED') ||
    action.includes('DEACTIVATED')
  ) {
    return 'bg-red-50 text-red-700';
  }

  if (
    action.includes('CREATED') ||
    action.includes('ACTIVATED') ||
    action.includes('GRANTED') ||
    action.includes('CHECKED_IN') ||
    action.includes('APPROVED')
  ) {
    return 'bg-green-50 text-green-700';
  }

  if (
    action.includes('UPDATED') ||
    action.includes('CHANGED') ||
    action.includes('SUBMITTED') ||
    action.includes('CHECKED_OUT')
  ) {
    return 'bg-blue-50 text-blue-700';
  }

  return 'bg-gray-100 text-gray-700';
}

function JsonBlock({
  title,
  value,
}: {
  title: string;
  value: Record<string, unknown> | null;
}) {
  if (!value || Object.keys(value).length === 0) {
    return (
      <div>
        <p className="mb-2 text-sm font-semibold text-gray-800">{title}</p>
        <p className="text-sm text-gray-500">No data recorded.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-gray-800">{title}</p>

      <pre className="max-h-64 overflow-auto rounded-lg bg-gray-50 p-4 text-xs leading-5 text-gray-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export function AuditLogsPage() {
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const auditLogs = useQuery({
    queryKey: [
      'audit-logs',
      {
        action,
        entityType,
        actorUserId,
        entityId,
        startDate,
        endDate,
        page,
        pageSize,
      },
    ],
    queryFn: () =>
      auditService.getAll({
        action: action || undefined,
        entity_type: entityType || undefined,
        actor_user_id: actorUserId || undefined,
        entity_id: entityId || undefined,
        start_date: startDate
          ? `${startDate}T00:00:00`
          : undefined,
        end_date: endDate
          ? `${endDate}T23:59:59`
          : undefined,
        page,
        page_size: pageSize,
      }),
  });

  const summary = useQuery({
    queryKey: ['audit-summary'],
    queryFn: auditService.getSummary,
  });

  const logs = auditLogs.data?.items || [];
  const pagination = auditLogs.data?.pagination;

  const clearFilters = () => {
    setAction('');
    setEntityType('');
    setActorUserId('');
    setEntityId('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const hasFilters =
    !!action ||
    !!entityType ||
    !!actorUserId ||
    !!entityId ||
    !!startDate ||
    !!endDate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Audit Logs
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Review important actions and changes made across Shoova ONE.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Activity className="h-4 w-4" />
          Read-only system history
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total audit events</p>

              <p className="mt-1 text-2xl font-bold text-gray-900">
                {summary.isLoading
                  ? '—'
                  : summary.data?.total ?? 0}
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-3">
              <Activity className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Action types recorded
              </p>

              <p className="mt-1 text-2xl font-bold text-gray-900">
                {summary.isLoading
                  ? '—'
                  : summary.data?.actions.length ?? 0}
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Entity types tracked
              </p>

              <p className="mt-1 text-2xl font-bold text-gray-900">
                {summary.isLoading
                  ? '—'
                  : summary.data?.entities.length ?? 0}
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-3">
              <Search className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-gray-900">
              <Filter className="h-4 w-4 text-primary" />
              Filter audit logs
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Narrow the history by action, entity, user, or date.
            </p>
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">All actions</option>

            {ACTIONS.map((item) => (
              <option key={item} value={item}>
                {formatAction(item)}
              </option>
            ))}
          </select>

          <select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">All entity types</option>

            {ENTITY_TYPES.map((item) => (
              <option key={item} value={item}>
                {formatEntity(item)}
              </option>
            ))}
          </select>

          <input
            value={actorUserId}
            onChange={(e) => {
              setActorUserId(e.target.value);
              setPage(1);
            }}
            placeholder="Actor user ID"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
          />

          <input
            value={entityId}
            onChange={(e) => {
              setEntityId(e.target.value);
              setPage(1);
            }}
            placeholder="Affected entity ID"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
          />

          <label className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />

            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </label>

          <label className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />

            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>
      </div>

      {/* Audit table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">
                Activity history
              </h2>

              <p className="text-xs text-gray-500">
                {pagination
                  ? `${pagination.total} event${
                      pagination.total === 1 ? '' : 's'
                    } found`
                  : 'Loading audit history...'}
              </p>
            </div>

            {auditLogs.isFetching && (
              <span className="text-xs text-gray-500">
                Updating...
              </span>
            )}
          </div>
        </div>

        {auditLogs.isLoading ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Loading audit logs...
          </div>
        ) : auditLogs.isError ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-red-600">
              Unable to load audit logs.
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Make sure your account has the audit.view permission.
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center">
            <Activity className="mx-auto h-8 w-8 text-gray-300" />

            <p className="mt-3 text-sm font-medium text-gray-700">
              No audit events found.
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Try changing or clearing your filters.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getActionClass(
                          log.action,
                        )}`}
                      >
                        {formatAction(log.action)}
                      </span>

                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                        {formatEntity(log.entity_type)}
                      </span>
                    </div>

                    <p className="mt-2 font-medium text-gray-900">
                      {log.description || 'No description provided.'}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />

                        {log.actor_name ||
                          log.actor_email ||
                          'System'}
                      </span>

                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />

                        {formatDate(log.created_at)}
                      </span>

                      {log.ip_address && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3.5 w-3.5" />

                          {log.ip_address}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedLog(log)}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Eye className="h-4 w-4" />
                    View details
                  </button>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.total_pages > 1 && (
              <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-500">
                  Page {pagination.page} of{' '}
                  {pagination.total_pages}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setPage((current) =>
                        Math.max(1, current - 1),
                      )
                    }
                    disabled={pagination.page <= 1}
                    className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>

                  <button
                    onClick={() =>
                      setPage((current) =>
                        Math.min(
                          pagination.total_pages,
                          current + 1,
                        ),
                      )
                    }
                    disabled={
                      pagination.page >=
                      pagination.total_pages
                    }
                    className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Audit details modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Audit Event
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Detailed record of this system activity.
                </p>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Action
                  </p>

                  <p className="mt-1 font-medium text-gray-900">
                    {formatAction(selectedLog.action)}
                  </p>
                </div>

                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Entity
                  </p>

                  <p className="mt-1 font-medium text-gray-900">
                    {formatEntity(selectedLog.entity_type)}
                  </p>
                </div>

                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Performed by
                  </p>

                  <p className="mt-1 font-medium text-gray-900">
                    {selectedLog.actor_name ||
                      selectedLog.actor_email ||
                      'System'}
                  </p>

                  {selectedLog.actor_email && (
                    <p className="mt-1 text-xs text-gray-500">
                      {selectedLog.actor_email}
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Date & time
                  </p>

                  <p className="mt-1 font-medium text-gray-900">
                    {formatDate(selectedLog.created_at)}
                  </p>
                </div>

                <div className="rounded-lg bg-gray-50 p-3 sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Entity ID
                  </p>

                  <p className="mt-1 break-all font-mono text-xs text-gray-700">
                    {selectedLog.entity_id}
                  </p>
                </div>

                {selectedLog.ip_address && (
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      IP address
                    </p>

                    <p className="mt-1 font-mono text-sm text-gray-700">
                      {selectedLog.ip_address}
                    </p>
                  </div>
                )}

                {selectedLog.actor_user_id && (
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Actor user ID
                    </p>

                    <p className="mt-1 break-all font-mono text-xs text-gray-700">
                      {selectedLog.actor_user_id}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-800">
                  Description
                </p>

                <div className="rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
                  {selectedLog.description ||
                    'No description provided.'}
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <JsonBlock
                  title="Previous values"
                  value={selectedLog.old_values}
                />

                <JsonBlock
                  title="New values"
                  value={selectedLog.new_values}
                />
              </div>

              {selectedLog.metadata &&
                Object.keys(selectedLog.metadata).length > 0 && (
                  <JsonBlock
                    title="Metadata"
                    value={selectedLog.metadata}
                  />
                )}

              {selectedLog.user_agent && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-gray-800">
                    User agent
                  </p>

                  <p className="break-all rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                    {selectedLog.user_agent}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-gray-100 px-5 py-4">
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}