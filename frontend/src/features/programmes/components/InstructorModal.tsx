import { useState } from 'react';
import { X } from 'lucide-react';
import type { InstructorRole } from '@/services/programmes.service';
import { PersonSearchList } from './PersonSearchList';

export function InstructorModal({
  existingIds,
  isSaving,
  onClose,
  onAdd,
}: {
  existingIds: string[];
  isSaving: boolean;
  onClose: () => void;
  onAdd: (personId: string, role: InstructorRole) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [role, setRole] = useState<InstructorRole>('instructor');

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-lg w-full shadow-xl max-h-[85vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Add an instructor
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Assign someone to lead or teach this cohort
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100">
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Role
          </label>
          <div className="flex items-center gap-2">
            {(['lead', 'instructor'] as InstructorRole[]).map((value) => (
              <button
                key={value}
                onClick={() => setRole(value)}
                className={
                  role === value
                    ? 'px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-white'
                    : 'px-3 py-1.5 rounded-md text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50'
                }
              >
                {value === 'lead' ? 'Lead instructor' : 'Instructor'}
              </button>
            ))}
          </div>
        </div>

        <PersonSearchList
          excludeIds={existingIds}
          selectedIds={selectedId ? [selectedId] : []}
          onToggle={(personId) =>
            setSelectedId((prev) => (prev === personId ? null : personId))
          }
          multiple={false}
          emptyLabel="No more people to add"
        />

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedId && onAdd(selectedId, role)}
            disabled={!selectedId || isSaving}
            className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {isSaving ? 'Adding…' : 'Add instructor'}
          </button>
        </div>
      </div>
    </div>
  );
}
