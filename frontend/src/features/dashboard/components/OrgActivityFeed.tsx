import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { auditService, type AuditLog } from '@/services/audit.service';
import { Avatar } from '@/components/ui/Avatar';
import {
  Activity,
  UserPlus,
  UserCog,
  FileSignature,
  DollarSign,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Building2,
  FileText,
  Clock,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// Events we consider "important" for the exec dashboard.
// Everything else is filtered out.
const IMPORTANT_ACTIONS = new Set([
  'PERSON_CREATED',
  'PERSON_UPDATED',
  'PERSON_DELETED',
  'EMPLOYEE_UPDATED',
  'EMPLOYEE_TERMINATED',
  'CONTRACT_CREATED',
  'CONTRACT_RENEWED',
  'CONTRACT_TERMINATED',
  'COMPENSATION_CHANGE_REQUESTED',
  'COMPENSATION_CHANGE_APPLIED',
  'COMPENSATION_REQUEST_SUBMITTED',
  'COMPENSATION_REQUEST_HR_APPROVED',
  'COMPENSATION_REQUEST_APPROVED',
  'COMPENSATION_REQUEST_REJECTED',
  'LEAVE_REQUESTED',
  'LEAVE_APPROVED',
  'LEAVE_REJECTED',
  'APPROVAL_APPROVED',
  'APPROVAL_REJECTED',
  'APPROVAL_ESCALATED_TO_CEO',
  'USER_CREATED',
  'USER_DEACTIVATED',
  'ROLE_CHANGED',
  'PERMISSION_GRANTED',
  'PERMISSION_REVOKED',
  'DOCUMENT_VERIFIED',
  'REPORTS_TO_CHANGED',
  'HOLIDAY_CREATED',
  'LEAVE_TYPE_CREATED',
]);

type Filter = 'all' | 'people' | 'compensation' | 'approvals';

export function OrgActivityFeed() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', 'exec-feed'],
    queryFn: () =>
      auditService.getAll({
        page: 1,
        page_size: 60,
      }),
    refetchInterval: 60_000,
  });

  const events: AuditLog[] = useMemo(() => {
    if (!data?.items) return [];
    return data.items
      .filter((log) => IMPORTANT_ACTIONS.has(log.action))
      .filter((log) => {
        if (filter === 'all') return true;
        if (filter === 'people') {
          return (
            log.entity_type === 'person' ||
            log.action.startsWith('PERSON_') ||
            log.action.startsWith('EMPLOYEE_') ||
            log.action === 'REPORTS_TO_CHANGED' ||
            log.entity_type === 'user'
          );
        }
        if (filter === 'compensation') {
          return log.action.includes('COMPENSATION');
        }
        if (filter === 'approvals') {
          return (
            log.action.startsWith('APPROVAL_') ||
            log.action === 'LEAVE_APPROVED' ||
            log.action === 'LEAVE_REJECTED'
          );
        }
        return true;
      })
      .slice(0, 20);
  }, [data, filter]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-gray-900">
            Organisation Activity
          </h3>
          {events.length > 0 && (
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-semibold">
              {events.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Filter pills */}
          <div className="flex items-center gap-1">
            {(
              [
                { value: 'all', label: 'All' },
                { value: 'people', label: 'People' },
                { value: 'compensation', label: 'Pay' },
                { value: 'approvals', label: 'Approvals' },
              ] as { value: Filter; label: string }[]
            ).map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
                  filter === f.value
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => navigate('/audit')}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline ml-2"
          >
            Full log
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="p-5 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">
            No activity to show
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {filter === 'all'
              ? 'Actions across the organisation will appear here'
              : `No ${filter} activity in the recent log`}
          </p>
        </div>
         ) : (
        <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
          {events.map((log) => (
            <EventRow key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// EVENT ROW
// ============================================================

function EventRow({ log }: { log: AuditLog }) {
  const navigate = useNavigate();

  // Pick the icon based on the action
  const Icon = iconFor(log.action);

  // Colour tone based on the action
  const tone = toneFor(log.action);

  // Where should clicking this event go?
  const link = linkFor(log);

  return (
    <button
      onClick={() => link && navigate(link)}
      disabled={!link}
      className={cn(
        'w-full text-left flex items-start gap-3 px-5 py-3 transition-colors',
        link && 'hover:bg-gray-50 cursor-pointer',
        !link && 'cursor-default',
      )}
    >
      {/* Actor avatar */}
      {log.actor_name ? (
        <Avatar
          firstName={log.actor_name.split(' ')[0]}
          lastName={log.actor_name.split(' ')[1]}
          size="sm"
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Activity className="w-3 h-3 text-gray-500" />
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Action icon + label */}
          <span
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
              tone,
            )}
          >
            <Icon className="w-2.5 h-2.5" />
            {formatAction(log.action)}
          </span>

          {/* Timestamp */}
          <span className="text-[10px] text-gray-400">
            {formatDistanceToNow(new Date(log.created_at), {
              addSuffix: true,
            })}
          </span>
        </div>

        {/* Description */}
        <div className="text-[13px] text-gray-900 mt-1 truncate">
          {log.description || log.action}
        </div>

        {/* Actor */}
        {log.actor_name && (
          <div className="text-[11px] text-gray-500 mt-0.5">
            by {log.actor_name}
          </div>
        )}
      </div>
    </button>
  );
}

// ============================================================
// HELPERS
// ============================================================

function iconFor(action: string): React.ElementType {
  if (action.startsWith('PERSON_') || action.startsWith('EMPLOYEE_')) {
    return action.includes('CREATED') ? UserPlus : UserCog;
  }
  if (action.startsWith('CONTRACT_')) return FileSignature;
  if (action.startsWith('COMPENSATION_')) return DollarSign;
  if (action.startsWith('LEAVE_')) return CalendarCheck;
  if (action === 'APPROVAL_APPROVED') return CheckCircle2;
  if (action === 'APPROVAL_REJECTED') return XCircle;
  if (action.startsWith('APPROVAL_')) return Activity;
  if (action.startsWith('USER_') || action.startsWith('ROLE_')) return UserCog;
  if (action.startsWith('PERMISSION_')) return UserCog;
  if (action.startsWith('DOCUMENT_')) return FileText;
  if (action.startsWith('REPORTS_TO_')) return Building2;
  if (action.startsWith('HOLIDAY_') || action.startsWith('LEAVE_TYPE_')) {
    return CalendarCheck;
  }
  return Activity;
}

function toneFor(action: string): string {
  // Green for creations / approvals
  if (
    action.includes('CREATED') ||
    action.includes('APPROVED') ||
    action.includes('APPLIED')
  ) {
    return 'bg-emerald-50 text-emerald-700';
  }
  // Red for deletions / rejections / terminations
  if (
    action.includes('DELETED') ||
    action.includes('REJECTED') ||
    action.includes('TERMINATED') ||
    action.includes('DEACTIVATED') ||
    action.includes('REVOKED')
  ) {
    return 'bg-red-50 text-red-700';
  }
  // Amber for escalations
  if (action.includes('ESCALATED')) {
    return 'bg-amber-50 text-amber-700';
  }
  // Blue for updates / changes / requests
  if (
    action.includes('UPDATED') ||
    action.includes('CHANGED') ||
    action.includes('REQUESTED') ||
    action.includes('SUBMITTED') ||
    action.includes('GRANTED')
  ) {
    return 'bg-blue-50 text-blue-700';
  }
  // Default grey
  return 'bg-gray-100 text-gray-700';
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function linkFor(log: AuditLog): string | null {
  if (log.entity_type === 'person' || log.entity_type === 'employee_change') {
    return `/hr/employees/${log.entity_id}`;
  }
  if (log.entity_type === 'compensation_request') {
    return `/hr/compensation`;
  }
  if (log.entity_type === 'compensation_change') {
    return `/hr/compensation`;
  }
  if (log.entity_type === 'leave_request') {
    return `/hr/time-off`;
  }
  if (log.entity_type === 'document') {
    return `/hr/documents`;
  }
  if (log.entity_type === 'user') {
    return `/users`;
  }
  if (log.entity_type === 'employment_contract') {
    return `/hr/contracts`;
  }
  return null;
}