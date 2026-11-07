import { useState } from 'react';
import type {
  AssessmentCreatePayload,
  CompetencyResult,
  EvidenceQuality,
} from '@/services/learnerWorkflow.service';
import {
  COMPETENCY_RESULT_LABELS,
  EVIDENCE_QUALITY_LABELS,
} from '@/services/learnerWorkflow.service';
import { Field, ModalShell, inputClass } from './JourneyModal';

const today = () => new Date().toISOString().slice(0, 10);

export function AssessModal({
  isSaving,
  onClose,
  onSave,
}: {
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: AssessmentCreatePayload) => void;
}) {
  const [form, setForm] = useState({
    competency_result: 'met' as CompetencyResult,
    evidence_quality: 'adequate' as EvidenceQuality,
    feedback: '',
    follow_up: '',
    assessed_on: today(),
  });

  const update = (patch: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const save = () => {
    onSave({
      competency_result: form.competency_result,
      evidence_quality: form.evidence_quality,
      feedback: form.feedback.trim() || null,
      follow_up: form.follow_up.trim() || null,
      assessed_on: form.assessed_on || null,
    });
  };

  return (
    <ModalShell
      title="Mentor assessment"
      subtitle="“Competency met” completes the module; any other result moves the learner to follow-up"
      onClose={onClose}
      onSave={save}
      isSaving={isSaving}
      saveLabel="Record assessment"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Competency result">
            <select
              value={form.competency_result}
              onChange={(e) =>
                update({ competency_result: e.target.value as CompetencyResult })
              }
              className={inputClass}
            >
              {Object.entries(COMPETENCY_RESULT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Evidence quality">
            <select
              value={form.evidence_quality}
              onChange={(e) =>
                update({ evidence_quality: e.target.value as EvidenceQuality })
              }
              className={inputClass}
            >
              {Object.entries(EVIDENCE_QUALITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Feedback for the learner">
          <textarea
            value={form.feedback}
            onChange={(e) => update({ feedback: e.target.value })}
            rows={3}
            className={inputClass}
            placeholder="What was done well, what could be stronger"
          />
        </Field>

        <Field label="Remediation / follow-up actions">
          <textarea
            value={form.follow_up}
            onChange={(e) => update({ follow_up: e.target.value })}
            rows={2}
            className={inputClass}
            placeholder="Shown as the learner's next action when the competency is not yet met"
          />
        </Field>

        <Field label="Assessed on">
          <input
            type="date"
            value={form.assessed_on}
            onChange={(e) => update({ assessed_on: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>
    </ModalShell>
  );
}