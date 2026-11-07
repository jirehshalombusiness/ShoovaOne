import { useState } from 'react';
import type {
  OutcomeItem,
  OutcomePayload,
} from '@/services/learnerWorkflow.service';
import { Field, ModalShell, inputClass } from './JourneyModal';

export function OutcomeModal({
  initial,
  isSaving,
  onClose,
  onSave,
}: {
  initial: OutcomeItem | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: OutcomePayload) => void;
}) {
  const [form, setForm] = useState({
    demonstrated_skills: initial?.demonstrated_skills ?? '',
    field_outputs: initial?.field_outputs ?? '',
    further_training: initial?.further_training ?? '',
    placement_status: initial?.placement_status ?? '',
    follow_up_status: initial?.follow_up_status ?? '',
    follow_up_on: initial?.follow_up_on ?? '',
    notes: initial?.notes ?? '',
  });

  const update = (patch: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const save = () => {
    onSave({
      demonstrated_skills: form.demonstrated_skills.trim() || null,
      field_outputs: form.field_outputs.trim() || null,
      further_training: form.further_training.trim() || null,
      placement_status: form.placement_status || null,
      follow_up_status: form.follow_up_status || null,
      follow_up_on: form.follow_up_on || null,
      notes: form.notes.trim() || null,
    });
  };

  return (
    <ModalShell
      title="Learner outcome"
      subtitle="Completion, outputs and what happens next — feeds program reporting"
      onClose={onClose}
      onSave={save}
      isSaving={isSaving}
      wide
    >
      <div className="space-y-3">
        <Field label="Demonstrated skills">
          <textarea
            value={form.demonstrated_skills}
            onChange={(e) => update({ demonstrated_skills: e.target.value })}
            rows={2}
            className={inputClass}
            placeholder="Competencies the learner has proven"
          />
        </Field>

        <Field label="Field outputs">
          <textarea
            value={form.field_outputs}
            onChange={(e) => update({ field_outputs: e.target.value })}
            rows={2}
            className={inputClass}
            placeholder="e.g. Site observation report, mapped drainage points"
          />
        </Field>

        <Field label="Further training">
          <textarea
            value={form.further_training}
            onChange={(e) => update({ further_training: e.target.value })}
            rows={2}
            className={inputClass}
            placeholder="Recommended next module or programme"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Placement / employment status">
            <select
              value={form.placement_status}
              onChange={(e) => update({ placement_status: e.target.value })}
              className={inputClass}
            >
              <option value="">Not recorded</option>
              <option value="not_applicable">Not applicable</option>
              <option value="seeking">Seeking placement</option>
              <option value="placed">Placed</option>
              <option value="employed">Employed</option>
              <option value="self_employed">Self-employed</option>
            </select>
          </Field>
          <Field label="Follow-up status">
            <select
              value={form.follow_up_status}
              onChange={(e) => update({ follow_up_status: e.target.value })}
              className={inputClass}
            >
              <option value="">Not recorded</option>
              <option value="none">No follow-up needed</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Follow-up date">
            <input
              type="date"
              value={form.follow_up_on}
              onChange={(e) => update({ follow_up_on: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => update({ notes: e.target.value })}
            rows={2}
            className={inputClass}
          />
        </Field>
      </div>
    </ModalShell>
  );
}