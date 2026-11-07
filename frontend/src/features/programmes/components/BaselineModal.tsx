import { useState } from 'react';
import type {
  AffordTraining,
  BaselineItem,
  BaselinePayload,
  VulnerabilityClass,
} from '@/services/learnerWorkflow.service';
import {
  AFFORD_TRAINING_LABELS,
  VULNERABILITY_LABELS,
} from '@/services/learnerWorkflow.service';
import { Field, ModalShell, inputClass } from './JourneyModal';

const today = () => new Date().toISOString().slice(0, 10);

export function BaselineModal({
  initial,
  isSaving,
  onClose,
  onSave,
}: {
  initial: BaselineItem | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: BaselinePayload) => void;
}) {
  const [form, setForm] = useState({
    household_income_band: initial?.household_income_band ?? '',
    employment_status: initial?.employment_status ?? '',
    can_afford_training: initial?.can_afford_training ?? '',
    device_access: initial?.device_access ?? '',
    internet_access: initial?.internet_access ?? '',
    transport_constraints: initial?.transport_constraints ?? '',
    education_status: initial?.education_status ?? '',
    household_dependents: initial?.household_dependents?.toString() ?? '',
    vulnerability_class: initial?.vulnerability_class ?? '',
    notes: initial?.notes ?? '',
    recorded_on: initial?.recorded_on ?? today(),
  });

  const update = (patch: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const save = () => {
    const dependents = form.household_dependents.trim();
    onSave({
      household_income_band: form.household_income_band || null,
      employment_status: form.employment_status || null,
      can_afford_training: (form.can_afford_training || null) as AffordTraining | null,
      device_access: form.device_access || null,
      internet_access: form.internet_access || null,
      transport_constraints: form.transport_constraints.trim() || null,
      education_status: form.education_status || null,
      household_dependents: dependents ? Number(dependents) : null,
      vulnerability_class: (form.vulnerability_class || null) as VulnerabilityClass | null,
      notes: form.notes.trim() || null,
      recorded_on: form.recorded_on || null,
    });
  };

  return (
    <ModalShell
      title="Socioeconomic baseline"
      subtitle="Restricted to users with programmes.view_baseline"
      onClose={onClose}
      onSave={save}
      isSaving={isSaving}
      wide
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Household income band (monthly, GHS)">
          <select
            value={form.household_income_band}
            onChange={(e) => update({ household_income_band: e.target.value })}
            className={inputClass}
          >
            <option value="">Not recorded</option>
            <option value="below_500">Below 500</option>
            <option value="500_1000">500 – 1,000</option>
            <option value="1000_2000">1,000 – 2,000</option>
            <option value="above_2000">Above 2,000</option>
          </select>
        </Field>

        <Field label="Employment status">
          <select
            value={form.employment_status}
            onChange={(e) => update({ employment_status: e.target.value })}
            className={inputClass}
          >
            <option value="">Not recorded</option>
            <option value="unemployed">Unemployed</option>
            <option value="underemployed">Underemployed</option>
            <option value="self_employed">Self-employed</option>
            <option value="employed">Employed</option>
            <option value="student">Student</option>
          </select>
        </Field>

        <Field label="Can afford training without assistance?">
          <select
            value={form.can_afford_training}
            onChange={(e) => update({ can_afford_training: e.target.value })}
            className={inputClass}
          >
            <option value="">Not recorded</option>
            {Object.entries(AFFORD_TRAINING_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Economic vulnerability">
          <select
            value={form.vulnerability_class}
            onChange={(e) => update({ vulnerability_class: e.target.value })}
            className={inputClass}
          >
            <option value="">Not classified</option>
            {Object.entries(VULNERABILITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Device access">
          <select
            value={form.device_access}
            onChange={(e) => update({ device_access: e.target.value })}
            className={inputClass}
          >
            <option value="">Not recorded</option>
            <option value="none">None</option>
            <option value="shared">Shared device</option>
            <option value="smartphone">Own smartphone</option>
            <option value="computer">Own computer</option>
          </select>
        </Field>

        <Field label="Internet access">
          <select
            value={form.internet_access}
            onChange={(e) => update({ internet_access: e.target.value })}
            className={inputClass}
          >
            <option value="">Not recorded</option>
            <option value="none">None</option>
            <option value="limited">Limited / pay-as-you-go</option>
            <option value="reliable">Reliable</option>
          </select>
        </Field>

        <Field label="Education / training status">
          <select
            value={form.education_status}
            onChange={(e) => update({ education_status: e.target.value })}
            className={inputClass}
          >
            <option value="">Not recorded</option>
            <option value="none">No formal education</option>
            <option value="primary">Primary</option>
            <option value="jhs">JHS</option>
            <option value="shs">SHS / secondary</option>
            <option value="tertiary">Tertiary</option>
          </select>
        </Field>

        <Field label="Household dependents">
          <input
            type="number"
            min={0}
            max={50}
            value={form.household_dependents}
            onChange={(e) => update({ household_dependents: e.target.value })}
            className={inputClass}
            placeholder="0"
          />
        </Field>

        <Field label="Transport constraints" className="col-span-2">
          <input
            value={form.transport_constraints}
            onChange={(e) => update({ transport_constraints: e.target.value })}
            className={inputClass}
            placeholder="e.g. No direct transport to the field site"
          />
        </Field>

        <Field label="Notes" className="col-span-2">
          <textarea
            value={form.notes}
            onChange={(e) => update({ notes: e.target.value })}
            rows={2}
            className={inputClass}
          />
        </Field>

        <Field label="Recorded on">
          <input
            type="date"
            value={form.recorded_on}
            onChange={(e) => update({ recorded_on: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>
    </ModalShell>
  );
}