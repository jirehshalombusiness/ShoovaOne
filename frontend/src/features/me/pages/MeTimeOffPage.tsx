import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Clock,
  CalendarDays,
  X,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Ban,
} from 'lucide-react';
import {
  format,
  differenceInBusinessDays,
  isBefore,
  startOfDay,
} from 'date-fns';
import toast from 'react-hot-toast';
import { meService, type MeBalance, type MeLeaveRequest } from '@/services/me.service';
import { cn } from '@/lib/utils';

// ============================================================
// PAGE
// ============================================================

export function MeTimeOffPage() {
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const balancesQuery = useQuery({
    queryKey: ['me', 'time-off', 'balances'],
    queryFn: () => meService.getBalances(),
  });

  const requestsQuery = useQuery({
    queryKey: ['me', 'time-off', 'requests'],
    queryFn: () => meService.getLeaveRequests(),
  });

  const balances = balancesQuery.data ?? [];
  const requests = requestsQuery.data ?? [];

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  const counts = useMemo(
    () => ({
      all: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      rejected: requests.filter((r) => r.status === 'rejected').length,
      cancelled: requests.filter((r) => r.status === 'cancelled').length,
    }),
    [requests],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Time Off</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Your leave balances and request history
          </p>
        </div>
        <button
          onClick={() => setShowRequestModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Request Time Off
        </button>
      </div>

      {/* Balances */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Balances · {new Date().getFullYear()}
        </h3>
        {balancesQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : balances.length === 0 ? (
          <div className="border border-gray-200 rounded-lg bg-white text-center py-12">
            <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">
              No leave balances configured
            </p>
            <p className="text-xs text-gray-500 mt-1">
              HR has not set up your leave allocation for this year yet
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
        <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            My Requests
          </h3>
          <div className="flex items-center gap-1">
            {[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'pending', label: 'Pending', count: counts.pending },
              { value: 'approved', label: 'Approved', count: counts.approved },
              { value: 'rejected', label: 'Rejected', count: counts.rejected },
              { value: 'cancelled', label: 'Cancelled', count: counts.cancelled },
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
                {f.count > 0 && (
                  <span
                    className={cn(
                      'ml-1.5 tabular-nums',
                      statusFilter === f.value ? 'opacity-80' : 'text-gray-400',
                    )}
                  >
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {requestsQuery.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="border border-gray-200 rounded-lg bg-white text-center py-12">
            <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">
              {requests.length === 0
                ? "You haven't made any leave requests yet"
                : `No ${statusFilter} requests`}
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
            {filteredRequests.map((r) => (
              <RequestRow key={r.id} request={r} />
            ))}
          </div>
        )}
      </div>

      {showRequestModal && (
        <RequestLeaveModal onClose={() => setShowRequestModal(false)} />
      )}
    </div>
  );
}

// ============================================================
// BALANCE CARD
// ============================================================

function BalanceCard({ balance }: { balance: MeBalance }) {
  const usedPct =
    balance.total_days > 0
      ? Math.min(100, (balance.used_days / balance.total_days) * 100)
      : 0;
  const pendingPct =
    balance.total_days > 0
      ? Math.min(100, (balance.pending_days / balance.total_days) * 100)
      : 0;

  return (
    <div className="border border-gray-200 rounded-lg bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: balance.leave_type_color }}
        />
        <span className="text-[13px] font-medium text-gray-700 truncate">
          {balance.leave_type_name}
        </span>
        {!balance.is_paid && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-600">
            Unpaid
          </span>
        )}
      </div>

      <div className="text-2xl font-bold text-gray-900 tabular-nums">
        {balance.remaining_days.toFixed(1)}
        <span className="text-sm text-gray-500 font-normal ml-1">days left</span>
      </div>

      <div className="mt-3 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
        <div
          className="h-full transition-all"
          style={{
            width: `${usedPct}%`,
            backgroundColor: balance.leave_type_color,
          }}
        />
        <div
          className="h-full bg-amber-400 transition-all"
          style={{ width: `${pendingPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1.5">
        <span>
          {balance.used_days.toFixed(1)} used
          {balance.pending_days > 0 && ` · ${balance.pending_days.toFixed(1)} pending`}
        </span>
        <span>{balance.total_days.toFixed(1)} total</span>
      </div>
    </div>
  );
}

// ============================================================
// REQUEST ROW
// ============================================================

function RequestRow({ request }: { request: MeLeaveRequest }) {
  const queryClient = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: () => meService.cancelLeaveRequest(request.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'time-off'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'home'] });
      toast.success('Leave request cancelled');
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to cancel request';
      toast.error(detail);
    },
  });

  const statusStyles: Record<string, string> = {
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
        : request.status === 'cancelled'
          ? Ban
          : Clock;

  return (
    <div className="flex items-start gap-4 p-4">
      <div
        className={cn(
          'w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 border',
          statusStyles[request.status] ?? statusStyles.pending,
        )}
      >
        <StatusIcon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-semibold text-gray-900">
            {request.leave_type_name}
          </span>
          <span
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border',
              statusStyles[request.status] ?? statusStyles.pending,
            )}
          >
            {request.status}
          </span>
        </div>

        <div className="text-[12px] text-gray-600 mt-1">
          {format(new Date(request.start_date), 'MMM d, yyyy')} –{' '}
          {format(new Date(request.end_date), 'MMM d, yyyy')}
          {' · '}
          {request.total_days} working day{request.total_days !== 1 ? 's' : ''}
        </div>

        {request.reason && (
          <div className="text-[12px] text-gray-500 mt-1.5 p-2 bg-gray-50 rounded-md line-clamp-2">
            {request.reason}
          </div>
        )}

        {request.status === 'rejected' && request.rejection_reason && (
          <div className="flex items-start gap-1.5 mt-2 text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-md p-2">
            <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>{request.rejection_reason}</span>
          </div>
        )}

        <div className="text-[10px] text-gray-400 mt-2">
          Requested {format(new Date(request.created_at), 'MMM d, yyyy')}
        </div>
      </div>

      {request.status === 'pending' && (
        <button
          onClick={() => {
            if (confirm('Cancel this leave request?')) {
              cancelMutation.mutate();
            }
          }}
          disabled={cancelMutation.isPending}
          className="px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {cancelMutation.isPending ? 'Cancelling…' : 'Cancel'}
        </button>
      )}
    </div>
  );
}

// ============================================================
// REQUEST MODAL
// ============================================================

function RequestLeaveModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const typesQuery = useQuery({
    queryKey: ['me', 'time-off', 'types'],
    queryFn: () => meService.getLeaveTypes(),
  });

  const balancesQuery = useQuery({
    queryKey: ['me', 'time-off', 'balances'],
    queryFn: () => meService.getBalances(),
  });

  const leaveTypes = typesQuery.data ?? [];
  const balances = balancesQuery.data ?? [];

  const selectedType = leaveTypes.find((t) => t.id === form.leave_type_id);
  const selectedBalance = balances.find((b) => b.leave_type_id === form.leave_type_id);

  const daysCount = useMemo(() => {
    if (!form.start_date || !form.end_date) return 0;
    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    if (isBefore(end, start)) return 0;
    if (isBefore(end, startOfDay(new Date()))) return 0;
    const diff = differenceInBusinessDays(end, start) + 1;
    return diff > 0 ? diff : 0;
  }, [form.start_date, form.end_date]);

  const mutation = useMutation({
    mutationFn: () =>
      meService.createLeaveRequest({
        leave_type_id: form.leave_type_id,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'time-off'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'home'] });
      toast.success('Leave request submitted');
      onClose();
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to submit request';
      toast.error(detail);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.leave_type_id || !form.start_date || !form.end_date) {
      toast.error('Please fill all required fields');
      return;
    }
    if (daysCount <= 0) {
      toast.error('Please select a valid date range');
      return;
    }
    if (
      selectedBalance &&
      daysCount > selectedBalance.remaining_days
    ) {
      toast.error(
        `Only ${selectedBalance.remaining_days.toFixed(1)} days remaining for this leave type`,
      );
      return;
    }
    mutation.mutate();
  };

  const needsDocs = selectedType?.requires_documentation ?? false;
  const docsBlocked = needsDocs; // we don't have attachment UI yet

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
              Request Time Off
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Your manager will review this request
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Leave type */}
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
              <option value="">Select leave type…</option>
              {leaveTypes.map((t) => {
                const balance = balances.find((b) => b.leave_type_id === t.id);
                const suffix = balance
                  ? ` — ${balance.remaining_days.toFixed(1)} days left`
                  : t.is_paid
                    ? ''
                    : ' (unpaid)';
                return (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {suffix}
                  </option>
                );
              })}
            </select>

            {selectedType?.requires_documentation && (
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-700">
                <FileText className="w-3 h-3" />
                Documentation required for this leave type
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.start_date}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) =>
                  setForm({ ...form, start_date: e.target.value })
                }
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.end_date}
                min={form.start_date || format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {/* Days summary */}
          {daysCount > 0 && (
            <div className="p-3 bg-gray-50 rounded-md flex items-center justify-between">
              <span className="text-xs text-gray-600">
                Working days
                {selectedBalance && (
                  <span className="text-gray-400">
                    {' '}
                    · {selectedBalance.remaining_days.toFixed(1)} available
                  </span>
                )}
              </span>
              <span className="text-sm font-bold text-gray-900">
                {daysCount} day{daysCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Reason <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
              placeholder="Any additional context for your manager…"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>

          {docsBlocked && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                This leave type requires supporting documentation. Please
                contact HR to attach it after submitting.
              </div>
            </div>
          )}
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
            disabled={mutation.isPending || daysCount <= 0}
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