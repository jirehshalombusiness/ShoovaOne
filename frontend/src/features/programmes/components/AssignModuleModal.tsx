import { useState } from 'react';
import type { ProgrammeCourse } from '@/services/programmes.service';
import type { AssignmentCreatePayload } from '@/services/learnerWorkflow.service';
import { Field, ModalShell, inputClass } from './JourneyModal';

const today = () => new Date().toISOString().slice(0, 10);

export function AssignModuleModal({
  courses,
  assignedCourseIds,
  isSaving,
  onClose,
  onSave,
}: {
  courses: ProgrammeCourse[];
  assignedCourseIds: string[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: AssignmentCreatePayload) => void;
}) {
  const available = courses.filter(
    (course) => !assignedCourseIds.includes(course.id),
  );
  const [courseId, setCourseId] = useState(available[0]?.id ?? '');
  const [competency, setCompetency] = useState('');
  const [assignedOn, setAssignedOn] = useState(today());
  const [dueOn, setDueOn] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!courseId) {
      setError('Choose a module from the curriculum.');
      return;
    }
    if (competency.trim().length < 2) {
      setError('Describe the expected competency.');
      return;
    }
    onSave({
      course_id: courseId,
      competency: competency.trim(),
      assigned_on: assignedOn || null,
      due_on: dueOn || null,
    });
  };

  return (
    <ModalShell
      title="Assign learning module"
      subtitle="The learner must demonstrate this competency to complete the module"
      onClose={onClose}
      onSave={save}
      isSaving={isSaving}
      saveLabel="Assign"
    >
      <div className="space-y-3">
        <Field label="Module (from the programme curriculum)">
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className={inputClass}
          >
            {available.length === 0 && (
              <option value="">All curriculum modules assigned</option>
            )}
            {available.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Expected competency">
          <textarea
            value={competency}
            onChange={(e) => setCompetency(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="e.g. Conduct a site environmental observation and record located evidence"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Assigned on">
            <input
              type="date"
              value={assignedOn}
              onChange={(e) => setAssignedOn(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Due on">
            <input
              type="date"
              value={dueOn}
              onChange={(e) => setDueOn(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </ModalShell>
  );
}