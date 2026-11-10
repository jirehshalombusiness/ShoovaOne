import {
  PROGRAMME_LEVEL_LABELS,
  type ProgrammeDetail,
} from '@/services/programmes.service';
import { formatDate } from '../programmeUtils';

export function ProgrammeOverviewTab({
  programme,
}: {
  programme: ProgrammeDetail;
}) {
  return (
    <div className="space-y-4">
      <section className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-900">
          Learning outcomes
        </h3>
        {programme.learning_outcomes ? (
          <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
            {programme.learning_outcomes}
          </p>
        ) : (
          <p className="text-xs text-gray-500 mt-2">
            No learning outcomes recorded yet.
          </p>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-900">Details</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4">
          <Detail label="Code" value={programme.code} />
          <Detail
            label="Level"
            value={
              programme.level
                ? PROGRAMME_LEVEL_LABELS[programme.level]
                : 'Not set'
            }
          />
          <Detail
            label="Duration"
            value={
              programme.duration_weeks
                ? `${programme.duration_weeks} weeks`
                : 'Not set'
            }
          />
          <Detail
            label="Programme lead"
            value={
              programme.lead
                ? `${programme.lead.first_name} ${programme.lead.last_name}`
                : 'Not set'
            }
          />
          <Detail label="Start date" value={formatDate(programme.start_date)} />
          <Detail label="End date" value={formatDate(programme.end_date)} />
          <Detail
            label="Created"
            value={
              programme.created_at
                ? new Date(programme.created_at).toLocaleDateString()
                : null
            }
          />
          <Detail
            label="Last updated"
            value={
              programme.updated_at
                ? new Date(programme.updated_at).toLocaleDateString()
                : null
            }
          />
        </dl>
      </section>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </dt>
      <dd className="text-sm text-gray-800 mt-0.5">{value || '—'}</dd>
    </div>
  );
}
