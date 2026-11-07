import { useState } from 'react';
import type { TaskCreatePayload } from '@/services/learnerWorkflow.service';
import { Field, ModalShell, inputClass } from './JourneyModal';

export function TaskModal({
  moduleTitle,
  isSaving,
  onClose,
  onSave,
}: {
  moduleTitle: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: TaskCreatePayload) => void;
}) {
  const [form, setForm] = useState({
    title: '',
    location: '',
    due_on: '',
    description: '',
    instructions: '',
    safety_requirements: '',
    expected_evidence: '',
  });
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const save = () => {
    if (form.title.trim().length < 2) {
      setError('Give the task a title.');
      return;
    }
    onSave({
      title: form.title.trim(),
      location: form.location.trim() || null,
      due_on: form.due_on || null,
      description: form.description.trim() || null,
      instructions: form.instructions.trim() || null,
      safety_requirements: form.safety_requirements.trim() || null,
      expected_evidence: form.expected_evidence.trim() || null,
    });
  };

  return (
    <ModalShell
      title="Assign practical task"
      subtitle={`Field or practical work for ${moduleTitle}`}
      onClose={onClose}
      onSave={save}
      isSaving={isSaving}
      saveLabel="Assign task"
      wide
    >
      <div className="space-y-3">
        <Field label="Task title">
          <input
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            className={inputClass}
            placeholder="e.g. Site observation walk"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Location">
            <input
              value={form.location}
              onChange={(e) => update({ location: e.target.value })}
              className={inputClass}
              placeholder="e.g. Achimota Forest"
            />
          </Field>
          <Field label="Due on">
            <input
              type="date"
              value={form.due_on}
              onChange={(e) => update({ due_on: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            rows={2}
            className={inputClass}
          />
        </Field>

        <Field label="Instructions">
          <textarea
            value={form.instructions}
            onChange={(e) => update({ instructions: e.target.value })}
            rows={2}
            className={inputClass}
            placeholder="Step-by-step guidance for the learner"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Safety requirements">
            <textarea
              value={form.safety_requirements}
              onChange={(e) => update({ safety_requirements: e.target.value })}
              rows={2}
              className={inputClass}
              placeholder="e.g. Work in pairs, wear closed shoes"
            />
          </Field>
          <Field label="Expected evidence">
            <textarea
              value={form.expected_evidence}
              onChange={(e) => update({ expected_evidence: e.target.value })}
              rows={2}
              className={inputClass}
              placeholder="e.g. Photos, GPS coordinates, short reflection"
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