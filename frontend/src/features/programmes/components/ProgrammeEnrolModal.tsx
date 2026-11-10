import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { programmesService } from '@/services/programmes.service';
import { ProgrammePicker } from './ProgrammePicker';
import { PersonSearchList } from './PersonSearchList';

export function ProgrammeEnrolModal({
  initialProgrammeId = '',
  onClose,
}: {
  initialProgrammeId?: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [programmeId, setProgrammeId] = useState(initialProgrammeId);
  const [cohortId, setCohortId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [enrolledOn, setEnrolledOn] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const { data: programme, isLoading } = useQuery({
    queryKey: ['programmes', 'detail', programmeId],
    queryFn: () => programmesService.get(programmeId),
    enabled: !!programmeId,
  });

  const openCohorts = useMemo(
    () =>
      (programme?.cohorts ?? []).filter(
        (cohort) =>
          cohort.status !== 'completed' && cohort.status !== 'cancelled',
      ),
    [programme],
  );

  const cohort = openCohorts.find((item) => item.id === cohortId) ?? null;

  const { data: cohortDetail } = useQuery({
    queryKey: ['programmes', 'cohort', cohortId],
    queryFn: () => programmesService.getCohort(cohortId),
    enabled: !!cohortId,
  });

  const existingIds = useMemo(
    () => (cohortDetail?.enrolments ?? []).map((item) => item.person.id),
    [cohortDetail],
  );

  const enrolMutation = useMutation({
    mutationFn: () =>
      programmesService.enrol(cohortId, selectedIds, enrolledOn || undefined),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['programmes'] });
      toast.success(
        `Enrolled ${selectedIds.length} learner${
          selectedIds.length === 1 ? '' : 's'
        } · ${data.enrolled_count} on the cohort`,
      );
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to enrol learners');
    },
  });

  const toggle = (personId: string) =>
    setSelectedIds((prev) =>
      prev.includes(personId)
        ? prev.filter((id) => id !== personId)
        : [...prev, personId],
    );

  const pickProgramme = (id: string) => {
    setProgrammeId(id);
    setCohortId('');
    setSelectedIds([]);
  };

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
              Enrol a learner
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Pick a programme and intake, then choose people
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-3 space-y-3 border-b border-gray-100">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Programme
            </label>
            <ProgrammePicker value={programmeId} onChange={pickProgramme} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Cohort
            </label>
            <select
              value={cohortId}
              onChange={(event) => {
                setCohortId(event.target.value);
                setSelectedIds([]);
              }}
              disabled={!programmeId || isLoading || openCohorts.length === 0}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">
                {!programmeId
                  ? 'Select a programme first'
                  : isLoading
                    ? 'Loading cohorts…'
                    : openCohorts.length === 0
                      ? 'No open cohorts — create one first'
                      : 'Select a cohort'}
              </option>
              {openCohorts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.enrolled_count}
                  {item.capacity ? `/${item.capacity}` : ''} enrolled
                </option>
              ))}
            </select>
          </div>

          <div>
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
        </div>

        {cohort ? (
          <PersonSearchList
            excludeIds={existingIds}
            selectedIds={selectedIds}
            onToggle={toggle}
            emptyLabel="No more people to enrol"
          />
        ) : (
          <div className="flex-1 min-h-[200px] flex items-center justify-center px-6 text-center">
            <p className="text-xs text-gray-500">
              Choose a programme and an open cohort to search for people.
            </p>
          </div>
        )}

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
              onClick={() => enrolMutation.mutate()}
              disabled={
                selectedIds.length === 0 ||
                !cohortId ||
                enrolMutation.isPending
              }
              className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              {enrolMutation.isPending
                ? 'Enrolling…'
                : `Enrol ${selectedIds.length || ''}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}