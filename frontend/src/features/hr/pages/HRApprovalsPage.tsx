import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Filter,
  Search,
  ChevronRight,
  CalendarDays,
  DollarSign,
  FileText,
  UserCog,
  FileSignature,
  Loader2,
} from 'lucide-react';
import { format, isBefore, differenceInHours } from 'date-fns';
import toast from 'react-hot-toast';
import {
  hrService,
  type ApprovalSummary,
} from '@/services/hr.service';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

interface HRApprovalsPageProps {
  /** Default queue: everything (HR) or only items assigned to the viewer. */
  defaultScope?: 'all' | 'mine';
  allowScopeToggle?: boolean;
  /** Detail route prefix — /hr/approvals or /me/approvals. */
  basePath?: string;
}

const ENTITY_META: Record<
  string,
  { label: string; icon: React.ElementType; tone: string }
> = {
  leave_request: {
    label: 'Leave',
    icon: CalendarDays,
    tone: 'bg-blue-50 text-blue-600',
  },
  compensation_request: {
    label: 'Compensation',
    icon: DollarSign,
    tone: 'bg-emerald-50 text-emerald-600',
  },
  compensation_change: {
    label: 'Compensation',
    icon: DollarSign,
    tone: 'bg-emerald-50 text-emerald-600',
  },
  timesheet: {
    label: 'Timesheet',
    icon: Clock,
    tone: 'bg-violet-50 text-violet-600',
  },
  document_verification: {
    label: 'Document',
    icon: FileText,
    tone: 'bg-amber-50 text-amber-600',
  },
  employee_change: {
    label: 'Employee change',
    icon: UserCog,
    tone: 'bg-rose-50 text-rose-600',
  },
  contract_renewal: {
    label: 'Contract',
    icon: FileSignature,
    tone: 'bg-indigo-50 text-indigo-600',
  },
};

const STAGE_META: Record<string, { label: string; tone: string }> = {
  manager: {
    label: 'Manager review',
    tone: 'bg-slate-100 text-slate-600',
  },
  hr: {
    label: 'HR review',
    tone: 'bg-blue-50 text-blue-700',
  },
  ceo: {
    label: 'CEO approval',
    tone: 'bg-emerald-50 text-emerald-700',
  },
  exec: {
    label: 'Executive review',
    tone: 'bg-violet-50 text-violet-700',
  },
};

function stageMeta(stage: string) {
  return STAGE_META[stage] ?? STAGE_META.manager;
}

function slaInfo(approval: ApprovalSummary) {
  if (approval.status !== 'pending' || !approval.due_at) return null;

  const due = new Date(approval.due_at);
  const overdue = isBefore(due, new Date());
  const hours = Math.abs(differenceInHours(due, new Date()));

  if (overdue) {
    return {
      label:
        hours >= 24
          ? `Overdue by ${Math.round(hours / 24)}d`
          : `Overdue by ${Math.max(hours, 1)}h`,
      tone: 'text-red-600 bg-red-50 border-red-100',
      overdue: true,
    };
  }

  return {
    label: hours < 24 ? `Due in ${Math.max(hours, 1)}h` : `Due ${format(due, 'MMM d')}`,
    tone: 'text-gray-500 bg-gray-50 border-gray-100',
    overdue: false,
  };
}

export function HRApprovalsPage({
  defaultScope = 'all',
  allowScopeToggle = false,
  basePath = '/hr/approvals',
}: HRApprovalsPageProps = {}) {
  const [scope, setScope] = useState<'all' | 'mine'>(defaultScope);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [rejectTarget, setRejectTarget] = useState<ApprovalSummary | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const queryClient = useQueryClient();

  const scopedToMe = scope === 'mine';

  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'approvals', 'list', statusFilter, typeFilter, scope],
    queryFn: () =>
      hrService.getApprovals({
        status: statusFilter,
        entity_types: typeFilter === 'all' ? undefined : typeFilter,
        assigned_to_me: scopedToMe,
        include_all_if_hr: !scopedToMe,
        limit: 200,
      }),
  });

  const { data: stats } = useQuery({
    queryKey: ['hr', 'approvals', 'counts', scope],
    queryFn: () =>
      scopedToMe
        ? hrService.getMyApprovalStats()
        : hrService.getApprovalOverview(),
    enabled: allowScopeToggle ? true : scopedToMe,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => hrService.approveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'approvals'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'home'] });
      toast.success('Approved');
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to approve';
      toast.error(detail);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      hrService.rejectRequest(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'approvals'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'home'] });
      toast.success('Rejected');
      setRejectTarget(null);
      setRejectNote('');
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to reject';
      toast.error(detail);
    },
  });

  const items = data?.items ?? [];
  const pendingCount = data?.pending ?? 0;

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.requested_by.first_name.toLowerCase().includes(q) ||
        a.requested_by.last_name.toLowerCase().includes(q) ||
        a.entity_type.toLowerCase().includes(q),
    );
  }, [items, search]);

  const statusTabs = [
    { value: 'pending', label: 'Pending', count: stats?.pending },
    { value: 'approved', label: 'Approved', count: stats?.approved },
    { value: 'rejected', label: 'Rejected', count: stats?.rejected },
    { value: 'all', label: 'All', count: undefined },
  ];

  const handleReject = () => {
    if (!rejectTarget) return;
    if (!rejectNote.trim()) {
      toast.error('A reason is required');
      return;
    }
    rejectMutation.mutate({
      id: rejectTarget.id,
      note: rejectNote.trim(),
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">
            Approvals
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {pendingCount > 0
              ? `${pendingCount} request${pendingCount === 1 ? '' : 's'} awaiting a decision`
              : 'Nothing is waiting right now'}
          </p>
        </div>

        {allowScopeToggle && (
          <div className="flex items-center rounded-md border border-gray-200 bg-white p-0.5">
            {[
              { value: 'all' as const, label: 'All requests' },
              { value: 'mine' as const, label: 'My queue' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setScope(option.value)}
                className={cn(
                  'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                  scope === option.value
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-50',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col xl:flex-row gap-3 items-start xl:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  statusFilter === tab.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={cn(
                      'px-1 rounded text-[10px] tabular-nums',
                      statusFilter === tab.value
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-gray-200" />

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All types</option>
              <option value="leave_request">Leave requests</option>
              <option value="compensation_request">Compensation requests</option>
              <option value="compensation_change">Compensation changes</option>
              <option value="timesheet">Timesheets</option>
              <option value="document_verification">Documents</option>
              <option value="employee_change">Employee changes</option>
            </select>
          </div>
        </div>

        <div className="relative w-full xl:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or title…"
            className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-gray-200 rounded-lg bg-white text-center py-20">
          <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">
            {search
              ? 'No approvals match your search'
              : statusFilter === 'pending'
                ? 'You are all caught up'
                : `No ${statusFilter} approvals`}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {statusFilter === 'pending'
              ? 'Nothing requires your decision right now'
              : 'Try a different filter'}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100 overflow-hidden">
          {filtered.map((approval) => (
            <ApprovalRow
              key={approval.id}
              approval={approval}
              basePath={basePath}
              isApproving={
                approveMutation.isPending &&
                approveMutation.variables === approval.id
              }
              onApprove={() => approveMutation.mutate(approval.id)}
              onReject={() => {
                setRejectTarget(approval);
                setRejectNote('');
              }}
            />
          ))}
        </div>
      )}

      {/* Reject dialog */}
      {rejectTarget && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setRejectTarget(null)}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">
                Reject request
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {rejectTarget.title}
              </p>
            </div>
            <div className="p-5">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Reason for rejection
              </label>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={4}
                placeholder="Tell the requester why this is being rejected…"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejectMutation.isPending || !rejectNote.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// APPROVAL ROW
// ============================================================

function ApprovalRow({
  approval,
  basePath,
  isApproving,
  onApprove,
  onReject,
}: {
  approval: ApprovalSummary;
  basePath: string;
  isApproving: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const navigate = useNavigate();

  const statusStyles: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  const entity = ENTITY_META[approval.entity_type] ?? {
    label: approval.entity_type.replace(/_/g, ' '),
    icon: FileText,
    tone: 'bg-gray-100 text-gray-600',
  };
  const EntityIcon = entity.icon;
  const stage = stageMeta(approval.stage);
  const sla = slaInfo(approval);
  const canAct = approval.status === 'pending' && approval.can_act;

  return (
    <div className="flex items-start gap-4 p-4 hover:bg-gray-50/70 transition-colors">
      <div className="relative flex-shrink-0">
        <Avatar
          firstName={approval.requested_by.first_name}
          lastName={approval.requested_by.last_name}
          imageUrl={approval.requested_by.profile_image_url}
          size="md"
        />
        <span
          className={cn(
            'absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center',
            entity.tone,
          )}
        >
          <EntityIcon className="w-2.5 h-2.5" strokeWidth={2.25} />
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate(`${basePath}/${approval.id}`)}
            className="text-[14px] font-semibold text-gray-900 hover:text-primary text-left"
          >
            {approval.title}
          </button>
          <span
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border',
              statusStyles[approval.status] ?? statusStyles.pending,
            )}
          >
            {approval.status}
          </span>
          {approval.status === 'pending' && (
            <span
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider',
                stage.tone,
              )}
            >
              {stage.label}
            </span>
          )}
          {sla?.overdue && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
              <AlertCircle className="w-3 h-3" />
              Overdue
            </span>
          )}
        </div>

        <div className="text-[12px] text-gray-600 mt-1">
          <span className="font-medium text-gray-800">
            {approval.requested_by.first_name} {approval.requested_by.last_name}
          </span>
          {approval.requested_by.job_title && (
            <span className="text-gray-500"> · {approval.requested_by.job_title}</span>
          )}
          <span className="text-gray-400"> · {entity.label}</span>
        </div>

        {approval.summary && (
          <div className="text-[12px] text-gray-500 mt-1 line-clamp-2">
            {approval.summary}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-gray-400">
          <span>{format(new Date(approval.created_at), 'MMM d, yyyy h:mm a')}</span>
          {approval.assigned_to_name && (
            <span>Assigned to {approval.assigned_to_name}</span>
          )}
          {sla && (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border',
                sla.tone,
              )}
            >
              <Clock className="w-3 h-3" />
              {sla.label}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {canAct ? (
          <>
            <button
              onClick={onApprove}
              disabled={isApproving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isApproving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              Approve
            </button>
            <button
              onClick={onReject}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              Reject
            </button>
          </>
        ) : approval.status === 'pending' ? (
          <span className="hidden sm:inline text-[11px] text-gray-400 italic">
            Awaiting {approval.assigned_to_name ?? 'approver'}
          </span>
        ) : null}
        <button
          onClick={() => navigate(`${basePath}/${approval.id}`)}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="View details"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
