import type { CohortStatus, ProgrammeStatus } from '@/services/programmes.service';
import { COHORT_STATUS_LABELS, PROGRAMME_STATUS_LABELS } from '@/services/programmes.service';
import { cn } from '@/lib/utils';

const programmeStyles: Record<ProgrammeStatus, string> = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  archived: 'bg-gray-100 text-gray-600 border-gray-200',
};

const cohortStyles: Record<CohortStatus, string> = {
  planned: 'bg-gray-100 text-gray-600 border-gray-200',
  enrolling: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  active: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const badgeClass =
  'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border';

export function ProgrammeStatusBadge({ status }: { status: ProgrammeStatus }) {
  return (
    <span className={cn(badgeClass, programmeStyles[status])}>
      {PROGRAMME_STATUS_LABELS[status]}
    </span>
  );
}

export function CohortStatusBadge({ status }: { status: CohortStatus }) {
  return (
    <span className={cn(badgeClass, cohortStyles[status])}>
      {COHORT_STATUS_LABELS[status]}
    </span>
  );
}
