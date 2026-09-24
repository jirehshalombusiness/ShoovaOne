import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign,
  Plus,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  X,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { meService } from '@/services/me.service';
import { cn } from '@/lib/utils';

type StatusKind = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface CompensationRequest {
  id: string;
  requested_amount: number | null;
  currency: string;
  frequency: string;
  reason: string;
  status: StatusKind;
  created_at: string;
  decided_at: string | null;
  decision_note: string | null;
  approval_id: string | null;
}

interface CurrentCompensation {
  base_amount: number | null;
  currency: string;
  frequency: string;
  effective_from: string | null;
  is_set: boolean;
}

export function MeCompensationPage() {
  const [showRequestModal, setShowRequestModal] = useState(false);

  const currentQuery = useQuery({
    queryKey: ['me', 'compensation', 'current'],
    queryFn: () => meService.getMyCompensation(),
  });

  const requestsQuery = useQuery({
    queryKey: ['me', 'compensation', 'requests'],
    queryFn: () => meService.getMyCompensationRequests(),
  });

  const current = currentQuery.data;
  const requests = requestsQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Compensation</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Your current compensation and requests for adjustment
          </p>
        </div>
        <button
          onClick={() => setShowRequestModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Request Adjustment
        </button>
      </div>

      {/* Current compensation card */}
      <div className="border border-gray-200 rounded-lg bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-gray-900">
            Current Package
          </h3>
        </div>

        {currentQuery.isLoading ? (
          <div className="h-20 bg-gray-100 rounded animate-pulse" />
        ) : !current || !current.is_set ? (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-md">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              No compensation on file yet. Contact HR to set up your employment
              package.
            </div>
          </div>
        ) : (
          <>
            <div className="text-3xl font-bold text-gray-900 tabular-nums">
              {current.currency} {current.base_amount?.toLocaleString()}
              <span className="text-base font-normal text-gray-500 ml-2">
                / {current.frequency}
              </span>
            </div>
            {current.effective_from && (
              <div className="text-xs text-gray-500 mt-2">
                Effective from{' '}
                {format(new Date(current.effective_from), 'MMMM d, yyyy')}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-start gap-2 text-[11px] text-gray-500">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Contact HR if this information looks incorrect.
              </span>
            </div>
          </>
        )}
      </div>

      {/* Request history */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Request History
        </h3>

        {requestsQuery.isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="border border-gray-200 rounded-lg bg-white text-center py-12">
            <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">
              No compensation requests yet
            </p>
            <p className="text-xs text-gray-500 mt-1">
              If you'd like to discuss your compensation, submit a request above.
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
            {requests.map((r) => (
              <CompensationRequestRow key={r.id} request={r} />
            ))}
          </div>
        )}
      </div>

      {showRequestModal && (
        <RequestCompensationModal onClose={() => setShowRequestModal(false)} />
      )}
    </div>
  );
}

// ============================================================
// REQUEST ROW
// ============================================================

function CompensationRequestRow({ request }: { request: CompensationRequest }) {
  const statusStyles: Record<StatusKind, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  const StatusIcon =
    request.status === 'approved'
      ? CheckCircle2
      : request.status === 'rejected'
        ? XCircle
        : Clock;

  return (
    <div className="flex items-start gap-4 p-5">
      <div
        className={cn(
          'w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 border',
          statusStyles[request.status],
        )}
      >
        <StatusIcon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-semibold text-gray-900">
            {request.requested_amount
              ? `${request.currency} ${request.requested_amount.toLocaleString()} / ${request.frequency}`
              : 'Adjustment request'}
          </span>
          <span
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border',
              statusStyles[request.status],
            )}
          >
            {request.status}
          </span>
        </div>

        {request.reason && (
          <div className="text-[12px] text-gray-600 mt-2 p-2 bg-gray-50 rounded-md whitespace-pre-wrap">
            {request.reason}
          </div>
        )}

        {request.status === 'rejected' && request.decision_note && (
          <div className="flex items-start gap-1.5 mt-2 text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-md p-2">
            <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>{request.decision_note}</span>
          </div>
        )}

        <div className="text-[10px] text-gray-400 mt-2">
          Submitted{' '}
          {format(new Date(request.created_at), 'MMM d, yyyy h:mm a')}
          {request.decided_at && (
            <>
              {' · '}
              Decided{' '}
              {format(new Date(request.decided_at), 'MMM d, yyyy')}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// REQUEST MODAL
// ============================================================

function RequestCompensationModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    requested_amount: '',
    currency: 'GHS',
    frequency: 'monthly',
    reason: '',
  });

  const currentQuery = useQuery({
    queryKey: ['me', 'compensation', 'current'],
    queryFn: () => meService.getMyCompensation(),
  });

  const mutation = useMutation({
    mutationFn: () =>
      meService.requestCompensationChange({
        requested_amount: form.requested_amount
          ? Number(form.requested_amount)
          : undefined,
        currency: form.currency,
        frequency: form.frequency,
        reason: form.reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['me', 'compensation', 'requests'],
      });
      toast.success(
        'Request submitted — HR will review and forward to the CEO if approved',
      );
      onClose();
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.detail ?? 'Failed to submit request',
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reason.trim() || form.reason.trim().length < 10) {
      toast.error('Please provide a reason (at least 10 characters)');
      return;
    }
    mutation.mutate();
  };

  const current = currentQuery.data;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-lg w-full shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Request Compensation Adjustment
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              HR will review, then the CEO for final approval
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Current (read-only context) */}
          {current?.is_set && (
            <div className="p-3 bg-gray-50 rounded-md text-xs text-gray-600">
              <div className="font-semibold text-gray-700 mb-1">
                Current package
              </div>
              {current.currency} {current.base_amount?.toLocaleString()} /{' '}
              {current.frequency}
              {current.effective_from && (
                <>
                  {' · since '}
                  {format(
                    new Date(current.effective_from),
                    'MMM d, yyyy',
                  )}
                </>
              )}
            </div>
          )}

          {/* Requested amount */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Requested Amount{' '}
              <span className="text-gray-400">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.requested_amount}
                onChange={(e) =>
                  setForm({ ...form, requested_amount: e.target.value })
                }
                placeholder="5000.00"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <input
                type="text"
                maxLength={3}
                value={form.currency}
                onChange={(e) =>
                  setForm({ ...form, currency: e.target.value.toUpperCase() })
                }
                className="w-16 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-center"
              />
              <select
                value={form.frequency}
                onChange={(e) =>
                  setForm({ ...form, frequency: e.target.value })
                }
                className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="monthly">Monthly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="weekly">Weekly</option>
                <option value="annual">Annual</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Leave blank if you want to discuss without a specific figure.
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={5}
              required
              minLength={10}
              placeholder="Explain the context for this request — recent achievements, market data, scope changes, etc."
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Minimum 10 characters. Be specific — this goes to HR and the CEO.
            </p>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-md">
            <FileText className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-800">
              Compensation requests are reviewed in two stages: Head of HR
              first, then the CEO for final approval. You'll be notified of
              each decision.
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending || form.reason.trim().length < 10}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            {mutation.isPending ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}