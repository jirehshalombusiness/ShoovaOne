import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrService, LeaveBalance, LeaveRequest, LeaveType } from '@/services/hr.service';
import {
  Plus,
  Clock,
  Calendar,
  X,
  Send,
  CheckCircle2,
  XCircle,
  Paperclip,
} from 'lucide-react';
import { format, differenceInBusinessDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';

export function HRTimeOffPage() {
  const [showRequestModal, setShowRequestModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: balances } = useQuery({
    queryKey: ['hr', 'my-balances'],
    queryFn: () => hrService.getMyBalances(),
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ['hr', 'my-leave-requests'],
    queryFn: () => hrService.getMyLeaveRequests(),
  });

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Time Off</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your leave requests and balances
          </p>
        </div>
        <button
          onClick={() => setShowRequestModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Request Time Off
        </button>
      </div>

      {/* Balances */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Balances ({new Date().getFullYear()})
        </h2>
        {!balances || balances.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg text-center py-12">
            <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500">
              No leave balances configured yet
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {balances.map((b) => (
              <BalanceCard key={b.id} balance={b} />
            ))}
          </div>
        )}
      </div>

      {/* Requests */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          My Requests
        </h2>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !requests || requests.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg text-center py-12">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500">
              You haven't made any leave requests yet
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {requests.map((r) => (
              <RequestRow key={r.id} request={r} />
            ))}
          </div>
        )}
      </div>

      {showRequestModal && (
        <RequestLeaveModal
          onClose={() => setShowRequestModal(false)}
        />
      )}
    </div>
  );
}

function BalanceCard({ balance }: { balance: LeaveBalance }) {
  const usedPct =
    balance.total_days > 0
      ? (balance.used_days / balance.total_days) * 100
      : 0;
  const pendingPct =
    balance.total_days > 0
      ? (balance.pending_days / balance.total_days) * 100
      : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: balance.leave_type_color }}
          />
          <span className="text-[12px] font-medium text-gray-700">
            {balance.leave_type_name}
          </span>
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900 tabular-nums">
        {balance.remaining_days}
        <span className="text-sm text-gray-500 font-normal ml-1">days</span>
      </div>
      <div className="mt-3 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
        <div
          className="h-full"
          style={{
            width: `${usedPct}%`,
            backgroundColor: balance.leave_type_color,
          }}
        />
        <div
          className="h-full bg-amber-400"
          style={{ width: `${pendingPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1.5">
        <span>{balance.used_days} used</span>
        <span>{balance.total_days} total</span>
      </div>
    </div>
  );
}

function RequestRow({ request }: { request: LeaveRequest }) {
  const statusStyle: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  const StatusIcon =
    request.status === 'approved'
      ? CheckCircle2
      : request.status === 'rejected'
      ? XCircle
      : Clock;

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div
        className={cn(
          'w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 border',
          statusStyle[request.status] ?? statusStyle.pending
        )}
      >
        <StatusIcon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-gray-900">
            {request.leave_type_name}
          </span>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
              statusStyle[request.status] ?? statusStyle.pending
            )}
          >
            {request.status}
          </span>
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5">
          {format(new Date(request.start_date), 'MMM d, yyyy')} –{' '}
          {format(new Date(request.end_date), 'MMM d, yyyy')} ·{' '}
          {request.total_days} working day
          {request.total_days !== 1 ? 's' : ''}
        </div>
        {request.reason && (
          <div className="text-[10px] text-gray-400 mt-0.5 truncate">
            {request.reason}
          </div>
        )}
        {request.rejection_reason && (
          <div className="text-[10px] text-red-600 mt-0.5">
            Reason: {request.rejection_reason}
          </div>
        )}
      </div>
      <div className="text-right text-[10px] text-gray-400 flex-shrink-0">
        {request.created_at &&
          format(new Date(request.created_at), 'MMM d')}
      </div>
    </div>
  );
}

function RequestLeaveModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const { data: leaveTypes } = useQuery({
    queryKey: ['hr', 'leave-types'],
    queryFn: () => hrService.getLeaveTypes(),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => hrService.requestLeave(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'my-leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'my-balances'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'my-home'] });
      toast.success('Leave request submitted');
      onClose();
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.detail || 'Failed to submit request'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.leave_type_id || !form.start_date || !form.end_date) {
      toast.error('Please fill all required fields');
      return;
    }
    mutation.mutate({
      leave_type_id: form.leave_type_id,
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason || undefined,
    });
  };

  const daysCount =
    form.start_date && form.end_date
      ? differenceInBusinessDays(
          new Date(form.end_date),
          new Date(form.start_date)
        ) + 1
      : 0;

  const selectedType = leaveTypes?.find((t) => t.id === form.leave_type_id);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Request Time Off
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Your manager will review this request
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Leave Type <span className="text-red-500">*</span>
            </label>
            <select
              value={form.leave_type_id}
              onChange={(e) =>
                setForm({ ...form, leave_type_id: e.target.value })
              }
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Select leave type...</option>
              {leaveTypes?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.is_paid ? '' : '(unpaid)'}
                </option>
              ))}
            </select>
            {selectedType?.requires_documentation && (
              <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-amber-700">
                <Paperclip className="w-2.5 h-2.5" />
                Documentation required for this leave type
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) =>
                  setForm({ ...form, start_date: e.target.value })
                }
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.end_date}
                min={form.start_date}
                onChange={(e) =>
                  setForm({ ...form, end_date: e.target.value })
                }
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {daysCount > 0 && (
            <div className="p-2.5 bg-gray-50 rounded-md flex items-center justify-between">
              <span className="text-xs text-gray-600">Total working days</span>
              <span className="text-sm font-bold text-gray-900">
                {daysCount} day{daysCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Reason (optional)
            </label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
              placeholder="Any additional context for your request..."
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
        </form>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending || daysCount <= 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {mutation.isPending ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}