import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ArrowUpCircle,
  Filter,
  Search,
  ChevronRight,
} from 'lucide-react';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import {
  hrService,
  type ApprovalSummary,
} from '@/services/hr.service';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

export function HRApprovalsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [includeAllIfHr, setIncludeAllIfHr] = useState(true);

  const queryClient = useQueryClient();

  const queryKey = [
    'hr',
    'approvals',
    statusFilter,
    typeFilter,
    includeAllIfHr,
  ];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      hrService.getApprovals({
        status: statusFilter,
        entity_types: typeFilter === 'all' ? undefined : typeFilter,
        assigned_to_me: false,
        include_all_if_hr: includeAllIfHr,
        limit: 200,
      }),
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Approvals</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {pendingCount > 0
              ? `${pendingCount} request${pendingCount === 1 ? '' : 's'} awaiting decision`
              : 'No pending approvals'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status tabs */}
          <div className="flex items-center gap-1">
            {[
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'all', label: 'All' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  statusFilter === f.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-gray-200" />

          {/* Type filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All types</option>
              <option value="leave_request">Leave Requests</option>
              <option value="timesheet">Timesheets</option>
              <option value="compensation_change">Compensation</option>
              <option value="document_verification">Documents</option>
              <option value="employee_change">Employee Changes</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or title…"
            className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                ? "You're all caught up"
                : `No ${statusFilter} approvals`}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {statusFilter === 'pending'
              ? 'Nothing requires your decision right now'
              : 'Try a different filter'}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
          {filtered.map((approval) => (
            <ApprovalRow key={approval.id} approval={approval} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// APPROVAL ROW
// ============================================================

function ApprovalRow({ approval }: { approval: ApprovalSummary }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: () => hrService.approveRequest(approval.id),
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
    mutationFn: (note: string) => hrService.rejectRequest(approval.id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'approvals'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'home'] });
      toast.success('Rejected');
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to reject';
      toast.error(detail);
    },
  });

  const handleReject = () => {
    const note = prompt('Reason for rejection (required):');
    if (!note || !note.trim()) return;
    rejectMutation.mutate(note.trim());
  };

  const statusStyles: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  const overdue =
    approval.due_at &&
    approval.status === 'pending' &&
    isBefore(new Date(approval.due_at), new Date());

  return (
    <div className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors">
      {/* Avatar */}
      <Avatar
        firstName={approval.requested_by.first_name}
        lastName={approval.requested_by.last_name}
        imageUrl={approval.requested_by.profile_image_url}
        size="md"
      />

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate(`/hr/approvals/${approval.id}`)}
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
          {overdue && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
              <AlertCircle className="w-3 h-3" />
              Overdue
            </span>
          )}
        </div>

        <div className="text-[12px] text-gray-600 mt-1">
          Requested by{' '}
          <span className="font-medium text-gray-800">
            {approval.requested_by.first_name} {approval.requested_by.last_name}
          </span>
          {approval.requested_by.job_title && (
            <span className="text-gray-500"> · {approval.requested_by.job_title}</span>
          )}
        </div>

        {approval.summary && (
          <div className="text-[12px] text-gray-500 mt-1 line-clamp-2">
            {approval.summary}
          </div>
        )}

        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
          <span>{format(new Date(approval.created_at), 'MMM d, yyyy h:mm a')}</span>
          {approval.due_at && (
            <span className={overdue ? 'text-red-600 font-medium' : ''}>
              <Clock className="w-3 h-3 inline mr-0.5" />
              Due {format(new Date(approval.due_at), 'MMM d')}
            </span>
          )}
          {approval.escalation_level > 0 && (
            <span className="flex items-center gap-0.5">
              <ArrowUpCircle className="w-3 h-3" />
              Level {approval.escalation_level}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {approval.status === 'pending' && approval.can_act && (
          <>
            <button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approve
            </button>
            <button
              onClick={handleReject}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              Reject
            </button>
          </>
        )}
        {approval.status === 'pending' && !approval.can_act && (
          <span className="text-[11px] text-gray-400 italic">View only</span>
        )}
        <button
          onClick={() => navigate(`/hr/approvals/${approval.id}`)}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          title="View details"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}