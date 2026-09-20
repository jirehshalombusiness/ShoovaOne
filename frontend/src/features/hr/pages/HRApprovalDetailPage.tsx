import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ArrowUpCircle,
  MessageSquare,
  Clock,
  AlertCircle,
  Send,
  Lock,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { hrService, type ApprovalComment } from '@/services/hr.service';
import { Avatar } from '@/components/ui/Avatar';
import { useHRAccess } from '@/hooks/useHRAccess';
import { cn } from '@/lib/utils';

export function HRApprovalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const access = useHRAccess();

  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const { data: approval, isLoading, error } = useQuery({
    queryKey: ['hr', 'approval', id],
    queryFn: () => hrService.getApproval(id!),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => hrService.approveRequest(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'approval', id] });
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
    mutationFn: (note: string) => hrService.rejectRequest(id!, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'approval', id] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'approvals'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'home'] });
      toast.success('Rejected');
      setShowRejectModal(false);
      setRejectNote('');
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to reject';
      toast.error(detail);
    },
  });

  const escalateMutation = useMutation({
    mutationFn: () => hrService.escalateRequest(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'approval', id] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'approvals'] });
      toast.success('Escalated to next level');
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to escalate';
      toast.error(detail);
    },
  });

  const commentMutation = useMutation({
    mutationFn: () =>
      hrService.addApprovalComment(id!, {
        body: commentText.trim(),
        is_internal: isInternal,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'approval', id] });
      setCommentText('');
      setIsInternal(false);
      toast.success('Comment added');
    },
    onError: () => toast.error('Failed to add comment'),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !approval) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/hr/approvals')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to inbox
        </button>
        <div className="border border-red-200 bg-red-50 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-900">
                Could not load this approval
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {(error as Error)?.message ?? 'The request may have been deleted.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusStyles: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  const canAct = approval.status === 'pending' && approval.can_act;

  return (
    <div className="space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate('/hr/approvals')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to inbox
      </button>

      {/* Header card */}
      <div className="border border-gray-200 rounded-lg bg-white p-6">
        <div className="flex items-start gap-4">
          <Avatar
            firstName={approval.requested_by.first_name}
            lastName={approval.requested_by.last_name}
            imageUrl={approval.requested_by.profile_image_url}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-gray-900">{approval.title}</h1>
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border',
                  statusStyles[approval.status] ?? statusStyles.pending,
                )}
              >
                {approval.status}
              </span>
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Requested by{' '}
              <span className="font-medium text-gray-900">
                {approval.requested_by.first_name} {approval.requested_by.last_name}
              </span>
              {approval.requested_by.job_title && (
                <span className="text-gray-500">
                  {' '}
                  · {approval.requested_by.job_title}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Submitted {format(new Date(approval.created_at), 'MMM d, yyyy h:mm a')}
              </span>
              {approval.due_at && approval.status === 'pending' && (
                <span className="flex items-center gap-1 text-amber-700">
                  <Clock className="w-3 h-3" />
                  Due {format(new Date(approval.due_at), 'MMM d, yyyy h:mm a')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Decision info */}
        {approval.status !== 'pending' && approval.decided_at && (
          <div
            className={cn(
              'mt-5 p-4 rounded-md border',
              approval.status === 'approved'
                ? 'bg-emerald-50 border-emerald-100'
                : 'bg-red-50 border-red-100',
            )}
          >
            <div className="flex items-start gap-2">
              {approval.status === 'approved' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div
                  className={cn(
                    'text-sm font-semibold',
                    approval.status === 'approved'
                      ? 'text-emerald-900'
                      : 'text-red-900',
                  )}
                >
                  {approval.status === 'approved' ? 'Approved' : 'Rejected'} by{' '}
                  {approval.decided_by_name ?? 'Unknown'}
                </div>
                <div className="text-[11px] text-gray-600 mt-0.5">
                  {format(new Date(approval.decided_at), 'MMM d, yyyy h:mm a')}
                </div>
                {approval.decision_note && (
                  <div className="text-[12px] text-gray-700 mt-2 p-2 bg-white/60 rounded">
                    {approval.decision_note}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        {approval.summary && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Details
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {approval.summary}
            </p>
          </div>
        )}

        {/* Leave-specific detail */}
        {approval.detail?.kind === 'leave_request' && approval.detail.payload && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Leave Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500 text-xs">Leave Type</div>
                <div className="font-medium text-gray-900 mt-0.5">
                  {(approval.detail.payload as any).leave_type_name ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Total Days</div>
                <div className="font-medium text-gray-900 mt-0.5">
                  {(approval.detail.payload as any).total_days ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Start Date</div>
                <div className="font-medium text-gray-900 mt-0.5">
                  {(approval.detail.payload as any).start_date ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">End Date</div>
                <div className="font-medium text-gray-900 mt-0.5">
                  {(approval.detail.payload as any).end_date ?? '—'}
                </div>
              </div>
              {(approval.detail.payload as any).reason && (
                <div className="col-span-2">
                  <div className="text-gray-500 text-xs">Reason</div>
                  <div className="text-gray-900 mt-0.5 whitespace-pre-wrap">
                    {(approval.detail.payload as any).reason}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {canAct && (
          <div className="mt-5 pt-5 border-t border-gray-100 flex flex-wrap items-center gap-2">
            <button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {approveMutation.isPending ? 'Approving…' : 'Approve'}
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-red-200 bg-white text-red-700 rounded-md text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
            {approval.escalation_level < 2 && (
              <button
                onClick={() => escalateMutation.mutate()}
                disabled={escalateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 ml-auto"
              >
                <ArrowUpCircle className="w-4 h-4" />
                Escalate
              </button>
            )}
          </div>
        )}
      </div>

      {/* Comments thread */}
      <div className="border border-gray-200 rounded-lg bg-white">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">
            Discussion ({approval.comments.length})
          </h3>
        </div>

        {/* Comments list */}
        <div className="divide-y divide-gray-100">
          {approval.comments.length === 0 ? (
            <div className="text-center py-10">
              <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">
                No comments yet
              </p>
            </div>
          ) : (
            approval.comments.map((c) => (
              <CommentRow key={c.id} comment={c} />
            ))
          )}
        </div>

        {/* Add comment */}
        <div className="p-5 border-t border-gray-100">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-1">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={2}
                placeholder="Add a comment…"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                {access.isHRApprover ? (
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Lock className="w-3 h-3" />
                    Internal only (hidden from requester)
                  </label>
                ) : (
                  <div />
                )}
                <button
                  onClick={() => commentMutation.mutate()}
                  disabled={!commentText.trim() || commentMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  {commentMutation.isPending ? 'Posting…' : 'Comment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowRejectModal(false)}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">
                Reject this request
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Provide a reason for the requester
              </p>
            </div>
            <div className="p-5">
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={4}
                placeholder="Explain why this request is being rejected…"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!rejectNote.trim()) {
                    toast.error('A reason is required');
                    return;
                  }
                  rejectMutation.mutate(rejectNote.trim());
                }}
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
// COMMENT ROW
// ============================================================

function CommentRow({ comment }: { comment: ApprovalComment }) {
  return (
    <div className="flex items-start gap-3 p-5">
      <Avatar
        firstName={comment.author_name?.split(' ')[0]}
        lastName={comment.author_name?.split(' ')[1]}
        imageUrl={comment.author_image}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-gray-900">
            {comment.author_name}
          </span>
          {comment.is_internal && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
              <Lock className="w-2.5 h-2.5" />
              Internal
            </span>
          )}
          <span className="text-[10px] text-gray-400">
            {format(new Date(comment.created_at), 'MMM d, h:mm a')}
          </span>
        </div>
        <p className="text-[13px] text-gray-700 mt-1 whitespace-pre-wrap">
          {comment.body}
        </p>
      </div>
    </div>
  );
}