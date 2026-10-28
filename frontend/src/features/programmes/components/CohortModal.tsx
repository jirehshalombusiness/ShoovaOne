import { useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import {
  COHORT_STATUS_LABELS,
  DELIVERY_MODE_LABELS,
  type CohortStatus,
  type DeliveryMode,
} from '@/services/programmes.service';

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20';

export interface CohortFormValues {
  name: string;
  code: string | null;
  start_date: string | null;
  end_date: string | null;
  enrolment_opens_on: string | null;
  enrolment_closes_on: string | null;
  capacity: number | null;
  delivery_mode: DeliveryMode;
  location: string | null;
  status: CohortStatus;
  notes: string | null;
}

export interface CohortInitial {
  name: string;
  code: string | null;
  start_date: string | null;
  end_date: string | null;
  enrolment_opens_on?: string | null;
  enrolment_closes_on?: string | null;
  capacity: number | null;
  delivery_mode: DeliveryMode;
  location: string | null;
  status: CohortStatus;
  notes?: string | null;
}

export function CohortModal({
  initial,
  isSaving,
  onClose,
  onSave,
}: {
  initial?: CohortInitial;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: CohortFormValues) => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    code: initial?.code ?? '',
    status: (initial?.status ?? 'planned') as CohortStatus,
    deliveryMode: (initial?.delivery_mode ?? 'in_person') as DeliveryMode,
    startDate: initial?.start_date ?? '',
    endDate: initial?.end_date ?? '',
    opensOn: initial?.enrolment_opens_on ?? '',
    closesOn: initial?.enrolment_closes_on ?? '',
    capacity: initial?.capacity?.toString() ?? '',
    location: initial?.location ?? '',
    notes: initial?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = () => {
    setError(null);
    if (form.name.trim().length < 2) {
      setError('Cohort name must be at least 2 characters.');
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setError('End date cannot be before the start date.');
      return;
    }
    if (form.opensOn && form.closesOn && form.closesOn < form.opensOn) {
      setError('Enrolment close date cannot be before the open date.');
      return;
    }
    const capacity = form.capacity.trim();
    if (capacity && (!Number.isFinite(Number(capacity)) || Number(capacity) < 1)) {
      setError('Capacity must be at least 1.');
      return;
    }

    onSave({
      name: form.name.trim(),
      code: form.code.trim() || null,
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      enrolment_opens_on: form.opensOn || null,
      enrolment_closes_on: form.closesOn || null,
      capacity: capacity ? Number(capacity) : null,
      delivery_mode: form.deliveryMode,
      location: form.location.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-2xl w-full shadow-xl max-h-[90vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {initial ? 'Edit cohort' : 'New cohort'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              An intake of learners running through the curriculum
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Cohort name *
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. January 2027 Intake"
                className={inputClass}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Code
              </label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="2027-JAN"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as CohortStatus })
                }
                className={inputClass}
              >
                {(Object.keys(COHORT_STATUS_LABELS) as CohortStatus[]).map(
                  (status) => (
                    <option key={status} value={status}>
                      {COHORT_STATUS_LABELS[status]}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Delivery
              </label>
              <select
                value={form.deliveryMode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    deliveryMode: e.target.value as DeliveryMode,
                  })
                }
                className={inputClass}
              >
                {(Object.keys(DELIVERY_MODE_LABELS) as DeliveryMode[]).map(
                  (mode) => (
                    <option key={mode} value={mode}>
                      {DELIVERY_MODE_LABELS[mode]}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Capacity
              </label>
              <input
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) =>
                  setForm({ ...form, capacity: e.target.value })
                }
                placeholder="Unlimited"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Starts
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Ends
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Location
              </label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Campus or link"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Enrolment opens
              </label>
              <input
                type="date"
                value={form.opensOn}
                onChange={(e) => setForm({ ...form, opensOn: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Enrolment closes
              </label>
              <input
                type="date"
                value={form.closesOn}
                onChange={(e) => setForm({ ...form, closesOn: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {initial ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isSaving ? 'Saving…' : initial ? 'Save changes' : 'Create cohort'}
          </button>
        </div>
      </div>
    </div>
  );
}
