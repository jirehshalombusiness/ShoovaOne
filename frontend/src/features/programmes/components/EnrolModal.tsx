import { useState } from 'react';
import { X } from 'lucide-react';
import { PersonSearchList } from './PersonSearchList';

export function EnrolModal({
  existingIds,
  isSaving,
  onClose,
  onEnrol,
}: {
  existingIds: string[];
  isSaving: boolean;
  onClose: () => void;
  onEnrol: (personIds: string[], enrolledOn?: string) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [enrolledOn, setEnrolledOn] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const toggle = (personId: string) =>
    setSelectedIds((prev) =>
      prev.includes(personId)
        ? prev.filter((id) => id !== personId)
        : [...prev, personId],
    );

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
              Enrol learners
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              People already on the cohort are hidden
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
            Enrolled on
          </label>
          <input
            type="date"
            value={enrolledOn}
            onChange={(event) => setEnrolledOn(event.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <PersonSearchList
          excludeIds={existingIds}
          selectedIds={selectedIds}
          onToggle={toggle}
          emptyLabel="No more people to enrol"
        />

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-500">
            {selectedIds.length} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                onEnrol(selectedIds, enrolledOn || undefined)
              }
              disabled={selectedIds.length === 0 || isSaving}
              className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              {isSaving
                ? 'Enrolling…'
                : `Enrol ${selectedIds.length || ''}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
