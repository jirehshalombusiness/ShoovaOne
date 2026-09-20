import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Calendar,
  Plus,
  X,
  Send,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Ban,
  MapPin,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  hrService,
  type LeaveTypeAdmin,
  type PublicHolidayAdmin,
} from '@/services/hr.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { cn } from '@/lib/utils';

type Tab = 'leave-types' | 'holidays';

export function HRSettingsPage() {
  const access = useHRAccess();
  const [tab, setTab] = useState<Tab>('leave-types');

  if (!access.canEditLeave) {
    return (
      <div className="border border-gray-200 rounded-lg bg-white text-center py-20">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-gray-700">
          You don't have permission to manage HR settings
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Requires hr.edit_leave permission
        </p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'leave-types', label: 'Leave Types', icon: Settings },
    { id: 'holidays', label: 'Public Holidays', icon: Calendar },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">HR Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure leave policies and public holidays
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto -mb-px">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300',
                )}
              >
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {tab === 'leave-types' && <LeaveTypesSection />}
      {tab === 'holidays' && <HolidaysSection />}
    </div>
  );
}

// ============================================================
// LEAVE TYPES
// ============================================================

function LeaveTypesSection() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'leave-policies', 'types', 'include-inactive'],
    queryFn: () => hrService.listLeaveTypes(true),
  });

  const types = data ?? [];

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      hrService.updateLeaveType(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-policies', 'types'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-policies'] });
      toast.success('Leave type updated');
    },
    onError: () => toast.error('Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hrService.deleteLeaveType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-policies', 'types'] });
      toast.success('Leave type deleted');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to delete');
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Leave Types ({types.length})
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Leave categories available to employees
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Leave Type
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : types.length === 0 ? (
        <div className="border border-gray-200 rounded-lg bg-white text-center py-16">
          <Settings className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No leave types configured</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
          {types.map((t) => (
            <div
              key={t.id}
              className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div
                className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: `${t.color}22` }}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-semibold text-gray-900">
                    {t.name}
                  </span>
                  <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                    {t.code}
                  </span>
                  {!t.is_active && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                      <Ban className="w-2.5 h-2.5" />
                      Inactive
                    </span>
                  )}
                  {t.is_paid ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Paid
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                      Unpaid
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-600">
                  <span>{t.default_days} days default</span>
                  <span>·</span>
                  <span>{t.balances_count} active balances</span>
                  {t.requires_documentation && (
                    <>
                      <span>·</span>
                      <span className="text-amber-700">Requires docs</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() =>
                    toggleMutation.mutate({ id: t.id, is_active: !t.is_active })
                  }
                  disabled={toggleMutation.isPending}
                  className="px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  {t.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Delete "${t.name}"? Only possible if no balances exist.`,
                      )
                    ) {
                      deleteMutation.mutate(t.id);
                    }
                  }}
                  disabled={deleteMutation.isPending || t.balances_count > 0}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={t.balances_count > 0 ? 'Cannot delete — has balances' : 'Delete'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateLeaveTypeModal onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

function CreateLeaveTypeModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    code: '',
    default_days: '0',
    is_paid: true,
    requires_approval: true,
    requires_documentation: false,
    color: '#176b4d',
    is_active: true,
  });

  const mutation = useMutation({
    mutationFn: () =>
      hrService.createLeaveType({
        name: form.name,
        code: form.code.toLowerCase(),
        default_days: Number(form.default_days),
        is_paid: form.is_paid,
        requires_approval: form.requires_approval,
        requires_documentation: form.requires_documentation,
        color: form.color,
        is_active: form.is_active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-policies', 'types'] });
      toast.success('Leave type created');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to create');
    },
  });

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-md w-full shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">
            New Leave Type
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="p-5 space-y-4 overflow-y-auto"
        >
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Annual Leave"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
              placeholder="annual"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Short identifier used in system rules. Lowercase, no spaces.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Default Days
              </label>
              <input
                type="number"
                min="0"
                value={form.default_days}
                onChange={(e) =>
                  setForm({ ...form, default_days: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Color
              </label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full h-[38px] px-1 py-1 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Toggle
              label="Paid leave"
              checked={form.is_paid}
              onChange={(v) => setForm({ ...form, is_paid: v })}
            />
            <Toggle
              label="Requires approval"
              checked={form.requires_approval}
              onChange={(v) => setForm({ ...form, requires_approval: v })}
            />
            <Toggle
              label="Requires documentation"
              checked={form.requires_documentation}
              onChange={(v) => setForm({ ...form, requires_documentation: v })}
            />
            <Toggle
              label="Active"
              checked={form.is_active}
              onChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !form.name || !form.code}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {mutation.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// HOLIDAYS
// ============================================================

function HolidaysSection() {
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'leave-policies', 'holidays', year],
    queryFn: () => hrService.listHolidays(year),
  });

  const holidays = data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hrService.deleteHoliday(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['hr', 'leave-policies', 'holidays'],
      });
      toast.success('Holiday removed');
    },
    onError: () => toast.error('Failed to delete'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Public Holidays ({holidays.length})
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Excluded from working-day calculations in leave requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Holiday
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : holidays.length === 0 ? (
        <div className="border border-gray-200 rounded-lg bg-white text-center py-16">
          <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">
            No holidays for {year}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
          {holidays.map((h) => (
            <div
              key={h.id}
              className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="w-14 text-center flex-shrink-0 border border-gray-200 rounded-md overflow-hidden">
                <div className="bg-gray-50 text-[9px] font-bold text-gray-500 uppercase py-0.5">
                  {format(new Date(h.holiday_date), 'MMM')}
                </div>
                <div className="text-lg font-bold text-gray-900 py-0.5">
                  {format(new Date(h.holiday_date), 'd')}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-gray-900">
                  {h.name}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                  <MapPin className="w-3 h-3" />
                  {h.country}
                  {h.is_paid && (
                    <>
                      <span>·</span>
                      <span className="text-emerald-700">Paid</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Delete "${h.name}"?`)) {
                    deleteMutation.mutate(h.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateHolidayModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateHolidayModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    holiday_date: format(new Date(), 'yyyy-MM-dd'),
    country: 'GH',
    is_paid: true,
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: () =>
      hrService.createHoliday({
        name: form.name,
        holiday_date: form.holiday_date,
        country: form.country,
        is_paid: form.is_paid,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['hr', 'leave-policies', 'holidays'],
      });
      toast.success('Holiday added');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to add');
    },
  });

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Add Holiday</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="p-5 space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Independence Day"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.holiday_date}
                onChange={(e) =>
                  setForm({ ...form, holiday_date: e.target.value })
                }
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Country
              </label>
              <input
                type="text"
                maxLength={3}
                value={form.country}
                onChange={(e) =>
                  setForm({ ...form, country: e.target.value.toUpperCase() })
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <Toggle
            label="Paid holiday"
            checked={form.is_paid}
            onChange={(v) => setForm({ ...form, is_paid: v })}
          />
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Notes <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !form.name}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {mutation.isPending ? 'Adding…' : 'Add Holiday'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// TOGGLE
// ============================================================

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
      <span className="text-xs text-gray-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
          checked ? 'bg-primary' : 'bg-gray-200',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  );
}