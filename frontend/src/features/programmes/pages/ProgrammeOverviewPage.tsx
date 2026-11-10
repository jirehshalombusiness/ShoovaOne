import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  Circle,
  GraduationCap,
  Layers,
  Users,
} from 'lucide-react';
import {
  PROGRAMME_LEVEL_LABELS,
  type ProgrammeLevel,
} from '@/services/programmes.service';
import { cn } from '@/lib/utils';
import { ProgrammeOverviewTab } from '../components/ProgrammeOverviewTab';
import { useProgrammeWorkspace } from '../programmeWorkspace';
import { formatDateRange } from '../programmeUtils';

export function ProgrammeOverviewPage() {
  const navigate = useNavigate();
  const { programme, canManage, changeStatus, isChangingStatus } =
    useProgrammeWorkspace();

  const isDraft = programme.status === 'draft';
  const base = `/programmes/${programme.id}`;

  const steps = [
    {
      label: 'Build the curriculum',
      detail: 'Add the courses a learner must complete',
      done: programme.course_count > 0,
      path: `${base}/curriculum`,
      icon: BookOpen,
    },
    {
      label: 'Create an intake',
      detail: 'Set up a cohort with dates and capacity',
      done: programme.cohort_count > 0,
      path: `${base}/cohorts`,
      icon: Layers,
    },
    {
      label: 'Enrol learners',
      detail: 'Add student records to the cohort',
      done: programme.learner_count > 0,
      path: `${base}/learners`,
      icon: Users,
    },
  ];
  const allDone = steps.every((step) => step.done);

  return (
    <div className="space-y-5">
      {isDraft && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-amber-900">
              This programme is still a draft
            </div>
            <p className="text-xs text-amber-700 mt-0.5">
              Only programme managers can see it. Build the curriculum and
              cohorts, then activate it when ready.
            </p>
          </div>
        </div>
      )}

      {programme.status === 'archived' && (
        <div className="border border-gray-200 bg-gray-50 rounded-lg p-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-gray-800">
              This programme is archived
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              It stays visible for records but is closed to new cohorts.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5" />
            {programme.level
              ? PROGRAMME_LEVEL_LABELS[programme.level as ProgrammeLevel]
              : 'Level not set'}
          </span>
          <span className="w-1 h-1 rounded-full bg-gray-300" />
          <span className="flex items-center gap-1.5">
            <CalendarRange className="w-3.5 h-3.5" />
            {formatDateRange(programme.start_date, programme.end_date)}
          </span>
          {programme.duration_weeks && (
            <>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span>{programme.duration_weeks} weeks</span>
            </>
          )}
        </div>

        {programme.description && (
          <p className="text-sm text-gray-700 mt-3 max-w-3xl whitespace-pre-wrap">
            {programme.description}
          </p>
        )}

        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-gray-100">
          <Stat icon={BookOpen} label="Courses" value={programme.course_count} />
          <Stat icon={Layers} label="Cohorts" value={programme.cohort_count} />
          <Stat icon={Users} label="Learners" value={programme.learner_count} />
        </div>
      </div>

      {isDraft && canManage && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Getting started
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Three steps before this programme goes live
              </p>
            </div>
            {allDone && (
              <button
                onClick={() => changeStatus('active')}
                disabled={isChangingStatus}
                className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                {isChangingStatus ? 'Activating…' : 'Activate programme'}
              </button>
            )}
          </div>

          <div className="mt-4 space-y-1">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <button
                  key={step.label}
                  onClick={() => navigate(step.path)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-gray-50 text-left transition-colors"
                >
                  {step.done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  )}
                  <div
                    className={cn(
                      'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0',
                      step.done ? 'bg-emerald-50' : 'bg-gray-50',
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4',
                        step.done ? 'text-emerald-600' : 'text-gray-400',
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'text-[13px] font-medium',
                        step.done ? 'text-gray-500 line-through' : 'text-gray-900',
                      )}
                    >
                      {step.label}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {step.detail}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ProgrammeOverviewTab programme={programme} />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-md bg-gray-50 flex items-center justify-center">
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div>
        <div className="text-lg font-semibold text-gray-900 tabular-nums leading-none">
          {value}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
      </div>
    </div>
  );
}