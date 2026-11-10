import { useState } from 'react';
import type { CourseAssignment, CourseworkPayload, CourseworkStatus, RubricCriterion } from '@/services/coursework.service';
import type { ProgrammeDetail } from '@/services/programmes.service';
import { Field, inputClass, ModalShell } from './JourneyModal';

export function CourseAssignmentModal({ programme, initial, isSaving, onClose, onSave }: {
  programme: ProgrammeDetail;
  initial?: CourseAssignment;
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: Partial<CourseworkPayload>) => void;
}) {
  const locked = !!initial && initial.status !== 'draft';
  const [title, setTitle] = useState(initial?.title ?? '');
  const [instructions, setInstructions] = useState(initial?.instructions ?? '');
  const [courseId, setCourseId] = useState(initial?.course_id ?? '');
  const [cohortId, setCohortId] = useState(initial?.cohort_id ?? '');
  const [dueOn, setDueOn] = useState(initial?.due_on ?? '');
  const [points, setPoints] = useState(String(initial?.points_possible ?? 100));
  const [rubric, setRubric] = useState<RubricCriterion[]>(initial?.rubric ?? []);
  const [status, setStatus] = useState<CourseworkStatus>(initial?.status ?? 'draft');
  const [resubmission, setResubmission] = useState(initial?.allow_resubmission ?? true);
  const [error, setError] = useState('');
  const rubricTotal = rubric.reduce((total, criterion) => total + criterion.points, 0);

  const save = () => {
    if (!title.trim() || !courseId || !cohortId) {
      setError('Enter a title and choose a course and cohort.');
      return;
    }
    const maximum = rubric.length ? rubricTotal : Number(points);
    if (!Number.isFinite(maximum) || maximum <= 0 || rubric.some((r) => !r.label.trim() || !Number.isFinite(r.points) || r.points <= 0)) {
      setError('Points and each rubric criterion must be greater than zero; add a label for each criterion.');
      return;
    }
    const payload: Partial<CourseworkPayload> = {
      title: title.trim(), instructions: instructions.trim() || null,
      due_on: dueOn || null, allow_resubmission: resubmission, status,
    };
    if (!locked) Object.assign(payload, {
      course_id: courseId, cohort_id: cohortId, points_possible: maximum,
      rubric: rubric.map((r) => ({ ...r, label: r.label.trim() })),
    });
    onSave(payload);
  };

  return (
    <ModalShell title={initial ? 'Edit assignment' : 'Create assignment'} subtitle="Assign coursework to a course and cohort. Publish when it is ready for learners."
      onClose={isSaving ? () => {} : onClose} onSave={save} isSaving={isSaving} saveLabel={status === 'published' ? 'Save and publish' : 'Save assignment'} wide>
      <div className="space-y-4">
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <Field label="Assignment title *">
          <input aria-label="Assignment title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={inputClass} autoFocus />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Course *"><select aria-label="Assignment course" value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={locked} className={inputClass}>
            <option value="">Choose a course</option>
            {programme.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select></Field>
          <Field label="Cohort *"><select aria-label="Assignment cohort" value={cohortId} onChange={(e) => setCohortId(e.target.value)} disabled={locked} className={inputClass}>
            <option value="">Choose a cohort</option>
            {programme.cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
          </select></Field>
        </div>
        <Field label="Instructions"><textarea aria-label="Assignment instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} maxLength={20000} className={inputClass} placeholder="What learners should submit and how it will be assessed" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due date (optional)"><input aria-label="Assignment due date" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} className={inputClass} /></Field>
          <Field label={rubric.length ? 'Points (rubric total)' : 'Points possible *'}><input aria-label="Points possible" type="number" min="0.01" step="0.01" value={rubric.length ? rubricTotal : points} onChange={(e) => setPoints(e.target.value)} disabled={locked || rubric.length > 0} className={inputClass} /></Field>
        </div>
        <section className="border border-gray-200 rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-gray-800">Marking rubric (optional)</h4>
            {!locked && rubric.length < 20 && <button className="text-xs text-primary font-medium" onClick={() => setRubric([...rubric, { id: crypto.randomUUID(), label: '', points: 10 }])}>Add criterion</button>}
          </div>
          {rubric.length === 0 && <p className="text-xs text-gray-500">Grade with a single score, or add criteria for consistent marking.</p>}
          {rubric.map((criterion, index) => <div key={criterion.id} className="flex items-center gap-2">
            <input aria-label={`Criterion ${index + 1} label`} value={criterion.label} disabled={locked} maxLength={200} placeholder="Criterion" className={inputClass} onChange={(e) => setRubric(rubric.map((r) => r.id === criterion.id ? { ...r, label: e.target.value } : r))} />
            <input aria-label={`Criterion ${index + 1} points`} type="number" min="0.01" step="0.01" value={criterion.points} disabled={locked} className={`${inputClass} max-w-24`} onChange={(e) => setRubric(rubric.map((r) => r.id === criterion.id ? { ...r, points: Number(e.target.value) } : r))} />
            {!locked && <button aria-label={`Remove criterion ${index + 1}`} className="text-xs text-red-600" onClick={() => setRubric(rubric.filter((r) => r.id !== criterion.id))}>Remove</button>}
          </div>)}
          {locked && <p className="text-xs text-gray-500">Course, cohort, points and rubric are locked after publication.</p>}
        </section>
        <Field label="Availability"><select aria-label="Assignment availability" className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as CourseworkStatus)}>
          {!locked && <option value="draft">Draft — hidden from learners</option>}
          <option value="published">Published — accepts submissions</option>
          {initial && initial.status !== 'draft' && <option value="closed">Closed — grades remain visible</option>}
        </select></Field>
        <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={resubmission} onChange={(e) => setResubmission(e.target.checked)} />Allow resubmission after grading</label>
        <p className="text-[11px] text-gray-500">Requested changes always allow another attempt. Late submissions are flagged, not automatically penalised.</p>
      </div>
    </ModalShell>
  );
}
