import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { hrService, type ApprovalSummary } from '@/services/hr.service';
import { Avatar } from '@/components/ui/Avatar';
import { Inbox, ArrowRight, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import { format, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';

export function ExecutiveApprovalsQueue() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'approvals', 'ceo-queue'],
    queryFn: () =>
      hrService.getApprovals({
        status: 'pending',
        assigned_to_me: true,
        limit: 5,
      }),
    refetchInterval: 60_000,
  });

  const items = data?.items ?? [];
  const pendingCount = data?.pending ?? 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Inbox className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-gray-900">
            Awaiting My Decision
          </h3>
          {pendingCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
              {pendingCount}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/hr/approvals')}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Open inbox
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="p-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-md animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-14">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
            <Inbox className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
          </div>
          <p className="text-sm font-medium text-gray-700">
            Nothing needs your decision
          </p>
          <p className="text-xs text-gray-500 mt-1">
            You're all caught up
          </p>
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
          {items.map((item) => (
            <ApprovalRow
              key={item.id}
              approval={item}
              onOpen={() => navigate(`/hr/approvals/${item.id}`)}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      {items.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button
            onClick={() => navigate('/hr/approvals')}
            className="w-full flex items-center justify-center gap-2 text-xs font-medium text-primary hover:text-primary-dark transition-colors"
          >
            View all approvals
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ROW
// ============================================================

function ApprovalRow({
  approval,
  onOpen,
}: {
  approval: ApprovalSummary;
  onOpen: () => void;
}) {
  const overdue =
    approval.due_at &&
    isBefore(new Date(approval.due_at), new Date());

  const typeLabel: Record<string, string> = {
    leave_request: 'Leave',
    timesheet: 'Timesheet',
    compensation_request: 'Compensation',
    compensation_change: 'Compensation',
    document_verification: 'Document',
    employee_change: 'Employee Change',
    profile_change: 'Profile',
    contract_renewal: 'Contract',
  };

  const typeStyles: Record<string, string> = {
    leave_request: 'bg-blue-50 text-blue-700',
    timesheet: 'bg-purple-50 text-purple-700',
    compensation_request: 'bg-emerald-50 text-emerald-700',
    compensation_change: 'bg-emerald-50 text-emerald-700',
    document_verification: 'bg-amber-50 text-amber-700',
    employee_change: 'bg-orange-50 text-orange-700',
    profile_change: 'bg-gray-100 text-gray-700',
    contract_renewal: 'bg-pink-50 text-pink-700',
  };

  return (
    <button
      onClick={onOpen}
      className="w-full flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left group"
    >
      <Avatar
        firstName={approval.requested_by.first_name}
        lastName={approval.requested_by.last_name}
        imageUrl={approval.requested_by.profile_image_url}
        size="md"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-gray-900 truncate">
            {approval.requested_by.first_name} {approval.requested_by.last_name}
          </span>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
              typeStyles[approval.entity_type] ?? 'bg-gray-100 text-gray-700',
            )}
          >
            {typeLabel[approval.entity_type] ?? approval.entity_type}
          </span>
          {overdue && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
              <AlertCircle className="w-2.5 h-2.5" />
              Overdue
            </span>
          )}
        </div>

        <div className="text-[12px] text-gray-700 mt-0.5 truncate">
          {approval.title}
        </div>

        {approval.summary && (
          <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
            {approval.summary}
          </div>
        )}

        {approval.due_at && (
          <div
            className={cn(
              'flex items-center gap-1 text-[10px] mt-1',
              overdue ? 'text-red-600 font-medium' : 'text-gray-400',
            )}
          >
            <Clock className="w-2.5 h-2.5" />
            Due {format(new Date(approval.due_at), 'MMM d, h:mm a')}
          </div>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-3" />
    </button>
  );
}