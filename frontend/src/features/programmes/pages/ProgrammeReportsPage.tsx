import { useQueries } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Layers,
  ShieldAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  learnerWorkflowService,
  type CohortDashboard,
} from '@/services/learnerWorkflow.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { cn } from '@/lib/utils';
import { useProgrammeWorkspace } from '../programmeWorkspace';

export function ProgrammeReportsPage() {
  const navigate = useNavigate();
  const access = useHRAccess();
  const { programme } = useProgrammeWorkspace();
  const canViewBaseline = access.has('programmes.view_baseline');
  const cohorts = programme.cohorts;

  const results = useQueries({
    queries: cohorts.map((cohort) => ({
      queryKey: ['learner-workflow', 'dashboard', cohort.id],
      queryFn: () => learnerWorkflowService.getCohortDashboard(cohort.id),
      refetchInterval: 60_000,
    })),
  });

  const isLoading = results.some((result) => result.isLoading);
  const dashboards = results
    .map((result) => result.data)
    .filter((data): data is CohortDashboard => !!data);

  const sum = (key: keyof CohortDashboard) =>
    dashboards.reduce((total, dashboard) => {
      const value = dashboard[key];
      return total + (typeof value === 'number' ? value : 0);
    }, 0);

  const assignmentsTotal = sum('assignments_total');
  const assignmentsCompleted = sum('assignments_completed');
  const completionRate = assignmentsTotal
    ? Math.round((assignmentsCompleted / assignmentsTotal) * 100)
    : 0;
  const activeLearners = sum('active_learners');
  const completedLearners = sum('completed_learners');
  const assessmentsOverdue = sum('assessments_overdue');
  const followUps = dashboards.reduce(
    (total, dashboard) => total + dashboard.learners_needing_follow_up.length,
    0,
  );

  const vulnerability = canViewBaseline
    ? dashboards.reduce(
        (acc, dashboard) => {
          const v = dashboard.vulnerability;
          if (!v) return acc;
          return {
            recorded: acc.recorded + v.recorded,
            low: acc.low + v.low,
            moderate: acc.moderate + v.moderate,
            high: acc.high + v.high,
          };
        },
        { recorded: 0, low: 0, moderate: 0, high: 0 },
      )
    : null;

  if (cohorts.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
        <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
          <BarChart3 className="w-6 h-6 text-gray-300" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-medium text-gray-700">No reports yet</p>
        <p className="text-xs text-gray-500 mt-1">
          Create a cohort and enrol learners to start tracking progress.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 tracking-tight">
          Programme reports
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Progress across {cohorts.length} cohort{cohorts.length === 1 ? '' : 's'}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            icon={Users}
            label="Active learners"
            value={activeLearners}
            sub={`${completedLearners} completed`}
          />
          <MetricCard
            icon={BookOpen}
            label="Module completion"
            value={`${completionRate}%`}
            sub={`${assignmentsCompleted} of ${assignmentsTotal} modules`}
          />
          <MetricCard
            icon={CheckCircle2}
            label="Competencies met"
            value={sum('competencies_demonstrated')}
            sub={`${sum('competencies_pending')} pending`}
          />
          <MetricCard
            icon={ClipboardList}
            label="Field tasks completed"
            value={sum('tasks_completed')}
            sub={`of ${sum('tasks_total')} assigned`}
          />
          <MetricCard
            icon={Camera}
            label="Evidence submissions"
            value={sum('evidence_submissions')}
          />
          <MetricCard
            icon={ClipboardCheck}
            label="Assessments completed"
            value={sum('assessments_completed')}
            sub={
              assessmentsOverdue > 0
                ? `${assessmentsOverdue} overdue`
                : 'None overdue'
            }
            alert={assessmentsOverdue > 0}
          />
          <MetricCard
            icon={Award}
            label="Outcomes recorded"
            value={sum('outcomes_recorded')}
            sub={`of ${activeLearners + completedLearners} learners`}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Needing follow-up"
            value={followUps}
            alert={followUps > 0}
          />
        </div>
      )}

      {vulnerability && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <ShieldAlert className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">
              Vulnerability profile
            </h3>
            <span className="text-[10px] text-gray-400 ml-auto">
              Restricted · baseline viewers only
            </span>
          </div>
          <div className="px-5 py-4">
            {vulnerability.recorded === 0 ? (
              <p className="text-xs text-gray-500">
                No baseline data recorded yet.
              </p>
            ) : (
              <div className="flex items-center gap-6 flex-wrap">
                <div>
                  <div className="text-xl font-bold text-gray-900">
                    {vulnerability.recorded}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    baselines recorded
                  </div>
                </div>
                <VStat label="Low" count={vulnerability.low} className="text-emerald-700" />
                <VStat label="Moderate" count={vulnerability.moderate} className="text-amber-700" />
                <VStat label="High" count={vulnerability.high} className="text-red-700" />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Layers className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">
            Cohort breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                <th className="text-left px-5 py-2.5">Cohort</th>
                <th className="text-right px-3 py-2.5">Learners</th>
                <th className="text-right px-3 py-2.5">Modules</th>
                <th className="text-right px-3 py-2.5">Competencies</th>
                <th className="text-right px-3 py-2.5">Evidence</th>
                <th className="text-right px-5 py-2.5">Outcomes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cohorts.map((cohort, index) => {
                const dashboard = dashboards.find(
                  (item) => item.cohort_id === cohort.id,
                );
                const rate = dashboard?.assignments_total
                  ? Math.round(
                      (dashboard.assignments_completed /
                        dashboard.assignments_total) *
                        100,
                    )
                  : 0;
                return (
                  <tr
                    key={cohort.id}
                    onClick={() =>
                      navigate(`/programmes/cohort/${cohort.id}/dashboard`)
                    }
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="text-[13px] font-medium text-gray-900">
                        {cohort.name}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {dashboard
                          ? `${dashboard.active_learners} active · ${dashboard.completed_learners} completed`
                          : 'Loading…'}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                      {cohort.enrolled_count}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {dashboard ? (
                        <span
                          className={cn(
                            'font-medium',
                            rate >= 100 ? 'text-emerald-600' : 'text-gray-700',
                          )}
                        >
                          {rate}%
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                      {dashboard?.competencies_demonstrated ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                      {dashboard?.evidence_submissions ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">
                      {dashboard?.outcomes_recorded ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  alert = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-1.5 text-gray-400">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-xl font-bold text-gray-900 mt-1.5">{value}</div>
      {sub && (
        <div
          className={cn(
            'text-[11px] mt-0.5',
            alert ? 'text-red-600 font-medium' : 'text-gray-500',
          )}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function VStat({
  label,
  count,
  className,
}: {
  label: string;
  count: number;
  className: string;
}) {
  return (
    <div>
      <div className={cn('text-xl font-bold', className)}>{count}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  );
}