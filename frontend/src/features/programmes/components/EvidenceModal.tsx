import { useState } from 'react';
import { LocateFixed, Upload } from 'lucide-react';
import type {
  EvidenceCreatePayload,
  EvidenceType,
} from '@/services/learnerWorkflow.service';
import { EVIDENCE_TYPE_LABELS } from '@/services/learnerWorkflow.service';
import { Field, ModalShell, inputClass } from './JourneyModal';

const today = () => new Date().toISOString().slice(0, 10);

export function EvidenceModal({
  taskTitle,
  isSaving,
  onClose,
  onSave,
}: {
  taskTitle: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: EvidenceCreatePayload, file: File | null) => void;
}) {
  const [form, setForm] = useState({
    evidence_type: 'observation' as EvidenceType,
    file_url: '',
    field_notes: '',
    reflection: '',
    gps_lat: '',
    gps_lng: '',
    location_label: '',
    recorded_on: today(),
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const update = (patch: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        update({
          gps_lat: position.coords.latitude.toFixed(6),
          gps_lng: position.coords.longitude.toFixed(6),
        });
        setLocating(false);
      },
      () => {
        setError('Could not read the current location.');
        setLocating(false);
      },
    );
  };

  const save = () => {
    const lat = form.gps_lat.trim();
    const lng = form.gps_lng.trim();
    if ((lat === '') !== (lng === '')) {
      setError('Provide both GPS latitude and longitude, or neither.');
      return;
    }
    if (lat && (!Number.isFinite(Number(lat)) || Math.abs(Number(lat)) > 90)) {
      setError('Latitude must be between -90 and 90.');
      return;
    }
    if (lng && (!Number.isFinite(Number(lng)) || Math.abs(Number(lng)) > 180)) {
      setError('Longitude must be between -180 and 180.');
      return;
    }
    const link = form.file_url.trim();
    if (!file && link && !/^https?:\/\//.test(link)) {
      setError('The link must start with http:// or https://.');
      return;
    }
    onSave(
      {
        evidence_type: form.evidence_type,
        file_url: !file && link ? link : null,
        field_notes: form.field_notes.trim() || null,
        reflection: form.reflection.trim() || null,
        gps_lat: lat ? Number(lat) : null,
        gps_lng: lng ? Number(lng) : null,
        location_label: form.location_label.trim() || null,
        recorded_on: form.recorded_on || null,
      },
      file,
    );
  };

  return (
    <ModalShell
      title="Submit learner evidence"
      subtitle={`Evidence for ${taskTitle}`}
      onClose={onClose}
      onSave={save}
      isSaving={isSaving}
      saveLabel="Submit evidence"
      wide
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Evidence type">
            <select
              value={form.evidence_type}
              onChange={(e) =>
                update({ evidence_type: e.target.value as EvidenceType })
              }
              className={inputClass}
            >
              {Object.entries(EVIDENCE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
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

        <Field label="Upload a file (photo or document)">
          <label className="flex items-center gap-2 px-2.5 py-1.5 border border-dashed border-gray-300 rounded-md text-xs text-gray-600 cursor-pointer hover:bg-gray-50">
            <Upload className="w-3.5 h-3.5 text-gray-400" />
            <span className="truncate">
              {file ? file.name : 'Choose a file…'}
            </span>
            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </Field>

        {!file && (
          <Field label="…or paste a link">
            <input
              value={form.file_url}
              onChange={(e) => update({ file_url: e.target.value })}
              className={inputClass}
              placeholder="https://…"
            />
          </Field>
        )}

        <Field label="Field notes">
          <textarea
            value={form.field_notes}
            onChange={(e) => update({ field_notes: e.target.value })}
            rows={2}
            className={inputClass}
            placeholder="What the learner observed or produced in the field"
          />
        </Field>

        <Field label="Learner reflection">
          <textarea
            value={form.reflection}
            onChange={(e) => update({ reflection: e.target.value })}
            rows={2}
            className={inputClass}
            placeholder="What the learner says they learned"
          />
        </Field>

        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <Field label="GPS latitude">
            <input
              value={form.gps_lat}
              onChange={(e) => update({ gps_lat: e.target.value })}
              className={inputClass}
              placeholder="e.g. 5.614000"
            />
          </Field>
          <Field label="GPS longitude">
            <input
              value={form.gps_lng}
              onChange={(e) => update({ gps_lng: e.target.value })}
              className={inputClass}
              placeholder="e.g. -0.234000"
            />
          </Field>
          <button
            onClick={useMyLocation}
            disabled={locating}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-md text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            {locating ? 'Locating…' : 'Use my location'}
          </button>
        </div>

        <Field label="Location label">
          <input
            value={form.location_label}
            onChange={(e) => update({ location_label: e.target.value })}
            className={inputClass}
            placeholder="e.g. Achimota Forest, north gate"
          />
        </Field>

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </ModalShell>
  );
}