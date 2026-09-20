import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign,
  Search,
  Plus,
  X,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Lock,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { hrService, type CompensationItem } from '@/services/hr.service';
import { peopleService } from '@/services/people.service';
import { Avatar } from '@/components/ui/Avatar';
import { useDebounce } from '@/hooks/useDebounce';
import { useHRAccess } from '@/hooks/useHRAccess';
import { cn } from '@/lib/utils';

export function HRCompensationPage() {
  const access = useHRAccess();
  const [search, setSearch] = useState('');
  const [currentOnly, setCurrentOnly] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const compQuery = useQuery({
    queryKey: ['hr', 'compensation', currentOnly],
    queryFn: () =>
      hrService.listCompensation({
        current_only: currentOnly,
        limit: 500,
      }),
  });

  const items = compQuery.data?.items ?? [];

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return items;
    const q = debouncedSearch.toLowerCase();
    return items.filter(
      (c) =>
        c.person.first_name.toLowerCase().includes(q) ||
        c.person.last_name.toLowerCase().includes(q) ||
        c.person.department?.toLowerCase().includes(q),
    );
  }, [items, debouncedSearch]);

  const totals = useMemo(() => {
    let monthly = 0;
    let currency = 'GHS';
    for (const c of filtered) {
      const amt = c.base_amount;
      const freq = (c.frequency || 'monthly').toLowerCase();
      if (freq === 'annual') monthly += amt / 12;
      else if (freq === 'biweekly') monthly += (amt * 26) / 12;
      else if (freq === 'weekly') monthly += (amt * 52) / 12;
      else if (freq === 'hourly') monthly += amt * 160;
      else monthly += amt;
      currency = c.currency;
    }
    return { monthly, annual: monthly * 12, currency };
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Compensation</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Salary records and pending adjustments · changes require director approval
          </p>
        </div>
        {access.canEditCompensation && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Request Change
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-gray-200 rounded-lg bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Tracked Employees
            </span>
            <TrendingUp className="w-4 h-4 text-primary" strokeWidth={1.75} />
          </div>
          <div className="text-3xl font-bold text-gray-900 tabular-nums">
            {filtered.length}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">with compensation records</div>
        </div>

        <div className="border border-gray-200 rounded-lg bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Monthly Payroll
            </span>
            <DollarSign className="w-4 h-4 text-emerald-500" strokeWidth={1.75} />
          </div>
          <div className="text-3xl font-bold text-gray-900 tabular-nums">
            {totals.currency} {totals.monthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">across tracked employees</div>
        </div>

        <div className="border border-gray-200 rounded-lg bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Annual Cost
            </span>
            <DollarSign className="w-4 h-4 text-blue-500" strokeWidth={1.75} />
          </div>
          <div className="text-3xl font-bold text-gray-900 tabular-nums">
            {totals.currency} {totals.annual.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">projected</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentOnly(true)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              currentOnly
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            Current only
          </button>
          <button
            onClick={() => setCurrentOnly(false)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              !currentOnly
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            Full history
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee or department…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* Table */}
      {compQuery.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-gray-200 rounded-lg bg-white text-center py-16">
          <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">
            {search
              ? 'No compensation records match your search'
              : 'No compensation records yet'}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="hidden lg:grid grid-cols-[minmax(220px,2fr)_minmax(160px,1fr)_minmax(160px,1fr)_minmax(140px,1fr)_minmax(180px,1.2fr)] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            <div>Employee</div>
            <div>Amount</div>
            <div>Frequency</div>
            <div>Effective From</div>
            <div>Status</div>
          </div>
          <div className="divide-y divide-gray-100">
            {filtered.map((c) => (
              <CompRow key={c.id} item={c} />
            ))}
          </div>
        </div>
      )}

      {showAddModal && (
        <RequestCompChangeModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}

function CompRow({ item }: { item: CompensationItem }) {
  const freqLabel = item.frequency.replace(/_/g, ' ');
  const isPending = !item.approved_at;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,2fr)_minmax(160px,1fr)_minmax(160px,1fr)_minmax(140px,1fr)_minmax(180px,1.2fr)] gap-4 px-5 py-3 items-center hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar
          firstName={item.person.first_name}
          lastName={item.person.last_name}
          imageUrl={item.person.profile_image_url}
          size="sm"
        />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-gray-900 truncate">
            {item.person.first_name} {item.person.last_name}
          </div>
          {item.person.job_title && (
            <div className="text-[11px] text-gray-500 truncate">
              {item.person.job_title}
            </div>
          )}
        </div>
      </div>

      <div className="text-[14px] font-semibold text-gray-900 tabular-nums">
        {item.currency} {item.base_amount.toLocaleString()}
      </div>

      <div className="text-[12px] text-gray-600 capitalize">{freqLabel}</div>

      <div className="text-[12px] text-gray-700">
        {format(new Date(item.effective_from), 'MMM d, yyyy')}
      </div>

      <div>
        {isPending ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-2.5 h-2.5" />
            Pending approval
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Approved
          </span>
        )}
      </div>
    </div>
  );
}

function RequestCompChangeModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    person_id: '',
    base_amount: '',
    currency: 'GHS',
    frequency: 'monthly',
    effective_from: format(new Date(), 'yyyy-MM-dd'),
    reason: '',
    notes: '',
  });

  const peopleQuery = useQuery({
    queryKey: ['people', 'for-compensation'],
    queryFn: () => peopleService.getAll({ limit: 500, status: 'active' }),
  });

  const mutation = useMutation({
    mutationFn: () =>
      hrService.createCompensation({
        person_id: form.person_id,
        base_amount: Number(form.base_amount),
        currency: form.currency,
        frequency: form.frequency,
        effective_from: form.effective_from,
        reason: form.reason || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'compensation'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'approvals'] });
      toast.success('Compensation change submitted for approval');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to submit change');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.person_id || !form.base_amount) {
      toast.error('Employee and amount are required');
      return;
    }
    mutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-lg w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Request Compensation Change
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Requires director-level approval
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Employee <span className="text-red-500">*</span>
            </label>
            <select
              value={form.person_id}
              onChange={(e) => setForm({ ...form, person_id: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select employee…</option>
              {(peopleQuery.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                  {p.job_title ? ` — ${p.job_title}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.base_amount}
                onChange={(e) => setForm({ ...form, base_amount: e.target.value })}
                required
                placeholder="5000.00"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Currency
              </label>
              <input
                type="text"
                maxLength={3}
                value={form.currency}
                onChange={(e) =>
                  setForm({ ...form, currency: e.target.value.toUpperCase() })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Frequency
              </label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="monthly">Monthly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="weekly">Weekly</option>
                <option value="annual">Annual</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Effective From <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.effective_from}
                onChange={(e) =>
                  setForm({ ...form, effective_from: e.target.value })
                }
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Reason
            </label>
            <select
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Select reason…</option>
              <option value="hire">New hire</option>
              <option value="promotion">Promotion</option>
              <option value="annual_review">Annual review</option>
              <option value="adjustment">Market adjustment</option>
              <option value="correction">Correction</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Notes <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              placeholder="Context for the approver…"
            />
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-md">
            <Lock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-800">
              This change will be routed to the executive team for approval
              before taking effect.
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !form.person_id || !form.base_amount}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {mutation.isPending ? 'Submitting…' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}