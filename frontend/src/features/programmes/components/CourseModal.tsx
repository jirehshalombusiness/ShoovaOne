import { useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import type { ProgrammeCourse } from '@/services/programmes.service';

const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20';

export interface CourseFormValues {
  code: string | null;
  title: string;
  description: string | null;
  contact_hours: number | null;
  learning_outcomes: string | null;
  is_optional: boolean;
}

export function CourseModal({
  initial,
  isSaving,
  onClose,
  onSave,
}: {
  initial?: ProgrammeCourse;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: CourseFormValues) => void;
}) {
  const [form, setForm] = useState({
    code: initial?.code ?? '',
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    contactHours: initial?.contact_hours?.toString() ?? '',
    learningOutcomes: initial?.learning_outcomes ?? '',
    isOptional: initial?.is_optional ?? false,
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
    if (form.title.trim().length < 2) {
      setError('Course title must be at least 2 characters.');
      return;
    }
    const hours = form.contactHours.trim();
    if (hours && (!Number.isFinite(Number(hours)) || Number(hours) < 0)) {
      setError('Contact hours must be zero or more.');
      return;
    }
    onSave({
      code: form.code.trim() || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      contact_hours: hours ? Number(hours) : null,
      learning_outcomes: form.learningOutcomes.trim() || null,
      is_optional: form.isOptional,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-lg w-full shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {initial ? 'Edit course' : 'Add a course'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Courses appear in the order set on the curriculum
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Course title *
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Foundations of Public Health"
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
                placeholder="PH101"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Contact hours
              </label>
              <input
                type="number"
                min={0}
                value={form.contactHours}
                onChange={(e) =>
                  setForm({ ...form, contactHours: e.target.value })
                }
                placeholder="40"
                className={inputClass}
              />
            </div>
            <label className="flex items-center gap-2 mt-6 text-sm text-gray-700 select-none">
              <input
                type="checkbox"
                checked={form.isOptional}
                onChange={(e) =>
                  setForm({ ...form, isOptional: e.target.checked })
                }
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20"
              />
              Optional course
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Course outcomes
            </label>
            <textarea
              value={form.learningOutcomes}
              onChange={(e) =>
                setForm({ ...form, learningOutcomes: e.target.value })
              }
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
            {isSaving ? 'Saving…' : initial ? 'Save changes' : 'Add course'}
          </button>
        </div>
      </div>
    </div>
  );
}
