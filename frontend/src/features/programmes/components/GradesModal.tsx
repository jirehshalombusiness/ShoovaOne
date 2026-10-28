import { useState } from 'react';
import { X } from 'lucide-react';
import type {
  CohortEnrolment,
  ProgrammeCourse,
  ResultPayload,
  ResultStatus,
} from '@/services/programmes.service';
import { cn } from '@/lib/utils';

const inputClass =
  'w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary/20';

interface RowState {
  status: ResultStatus;
  score: string;
  grade: string;
}

export function GradesModal({
  courses,
  enrolment,
  isSaving,
  onClose,
  onSave,
  onRemove,
}: {
  courses: ProgrammeCourse[];
  enrolment: CohortEnrolment;
  isSaving: boolean;
  onClose: () => void;
  onSave: (courseId: string, payload: ResultPayload) => void;
  onRemove: (courseId: string) => void;
}) {
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const initial: Record<string, RowState> = {};
    for (const course of courses) {
      const existing = enrolment.results.find(
        (result) => result.course_id === course.id,
      );
      initial[course.id] = {
        status: existing?.status ?? 'pending',
        score: existing?.score?.toString() ?? '',
        grade: existing?.grade ?? '',
      };
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);

  const update = (courseId: string, patch: Partial<RowState>) =>
    setRows((prev) => ({
      ...prev,
      [courseId]: { ...prev[courseId], ...patch },
    }));

  const save = (courseId: string) => {
    setError(null);
    const row = rows[courseId];
    const score = row.score.trim();
    if (score) {
      const value = Number(score);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        setError('Scores must be between 0 and 100.');
        return;
      }
    }
    onSave(courseId, {
      status: row.status,
      score: score ? Number(score) : null,
      grade: row.grade.trim() || null,
    });
  };

  const savedCourseIds = new Set(
    enrolment.results.map((result) => result.course_id),
  );

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-2xl w-full shadow-xl max-h-[88vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Results — {enrolment.person.first_name}{' '}
              {enrolment.person.last_name}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Record a score or grade for each course
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {courses.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">
              Add courses to the curriculum before recording results.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {courses.map((course, index) => {
                const row = rows[course.id];
                const hasResult = savedCourseIds.has(course.id);

                return (
                  <div key={course.id} className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-gray-400 tabular-nums">
                        {index + 1}
                      </span>
                      <span className="text-[13px] font-medium text-gray-900">
                        {course.title}
                      </span>
                      {course.code && (
                        <span className="text-[10px] font-mono text-gray-400">
                          {course.code}
                        </span>
                      )}
                      {hasResult && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                          Recorded
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-[110px_90px_1fr_auto] gap-2 mt-2 items-center">
                      <select
                        value={row.status}
                        onChange={(event) =>
                          update(course.id, {
                            status: event.target.value as ResultStatus,
                          })
                        }
                        className={inputClass}
                      >
                        <option value="pending">Pending</option>
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                      </select>

                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={row.score}
                        onChange={(event) =>
                          update(course.id, { score: event.target.value })
                        }
                        placeholder="Score"
                        className={inputClass}
                      />

                      <input
                        value={row.grade}
                        onChange={(event) =>
                          update(course.id, { grade: event.target.value })
                        }
                        placeholder="Grade (e.g. A)"
                        className={inputClass}
                      />

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => save(course.id)}
                          disabled={isSaving}
                          className="px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
                        >
                          Save
                        </button>
                        {hasResult && (
                          <button
                            onClick={() => onRemove(course.id)}
                            disabled={isSaving}
                            className={cn(
                              'px-2 py-1.5 rounded-md text-[11px] font-medium',
                              'text-red-700 hover:bg-red-50 disabled:opacity-50',
                            )}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="mx-5 my-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
