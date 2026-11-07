import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Route,
  ShieldAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { learnerWorkflowService } from '@/services/learnerWorkflow.service';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate } from '../programmeUtils';

export function CohortDashboardPage() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const navigate = useNavigate();

  const {
    data: dashboard,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['learner-workflow', 'dashboard', cohortId],
    queryFn: () => learnerWorkflowService.getCohortDashboard(cohortId!),
    enabled: !!cohortId,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl p-6 space-y-4">
        <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="max-w-5xl p-6">
        <button
          onClick={() => navigate('/programmes')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Programmes
        </button>
        <div className="border border-red-200 bg-red-50 rounded-lg p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-900">
              Could not load this dashboard
            </h3>
            <p className="text-sm text-red-700 mt-1">
              {(error as Error)?.message ?? 'The cohort may have been removed.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const vulnerability = dashboard.vulnerability;

  return (
    <div className="max-w-5xl p-6 space-y-5">
      <button
        onClick={() => navigate(`/programmes/cohorts/${dashboard.cohort_id}`)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {dashboard.cohort_name}
      </button>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {dashboard.cohort_name}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Learner workflow dashboard · {dashboard.programme_name}
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={Users}
          label="Active learners"
          value={dashboard.active_learners}
          sub={`${dashboard.completed_learners} completed`}
        />
        <MetricCard
          icon={BookOpen}
          label="Module completion"
          value={`${Math.round(dashboard.module_completion_rate)}%`}
          sub={`${dashboard.assignments_completed} of ${dashboard.assignments_total} modules`}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Competencies met"
          value={dashboard.competencies_demonstrated}
          sub={`${dashboard.competencies_pending} pending`}
        />
        <MetricCard
          icon={ClipboardList}
          label="Field tasks completed"
          value={dashboard.tasks_completed}
          sub={`of ${dashboard.tasks_total} assigned`}
        />
        <MetricCard
          icon={Camera}
          label="Evidence submissions"
          value={dashboard.evidence_submissions}
        />
        <MetricCard
          icon={ClipboardCheck}
          label="Assessments completed"
          value={dashboard.assessments_completed}
          sub={
            dashboard.assessments_overdue > 0
              ? `${dashboard.assessments_overdue} overdue`
              : 'None overdue'
          }
          alert={dashboard.assessments_overdue > 0}
        />
        <MetricCard
          icon={Award}
          label="Outcomes recorded"
          value={dashboard.outcomes_recorded}
          sub={`of ${dashboard.active_learners + dashboard.completed_learners} learners`}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Needing follow-up"
          value={dashboard.learners_needing_follow_up.length}
          alert={dashboard.learners_needing_follow_up.length > 0}
        />
      </div>

      {/* Vulnerability — only returned to users with programmes.view_baseline */}
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
                  <div className="text-[11px] text-gray-500">baselines recorded</div>
                </div>
                <VulnerabilityStat label="Low" count={vulnerability.low} className="text-emerald-700" />
                <VulnerabilityStat label="Moderate" count={vulnerability.moderate} className="text-amber-700" />
                <VulnerabilityStat label="High" count={vulnerability.high} className="text-red-700" />
                {vulnerability.high_percent !== null && (
                  <div className="ml-auto text-right">
                    <div className="text-xl font-bold text-red-700">
                      {Math.round(vulnerability.high_percent)}%
                    </div>
                    <div className="text-[11px] text-gray-500">
                      of active learners highly vulnerable
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Follow-up queue */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Route className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">
            Learners needing follow-up ({dashboard.learners_needing_follow_up.length})
          </h3>
        </div>
        {dashboard.learners_needing_follow_up.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs text-gray-500">No follow-up actions outstanding</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {dashboard.learners_needing_follow_up.map((item) => (
              <div key={item.enrolment_id} className="flex items-center gap-3 px-5 py-3">
                <Avatar
                  firstName={item.person.first_name}
                  lastName={item.person.last_name}
                  imageUrl={item.person.profile_image_url}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-gray-900">
                    {item.person.first_name} {item.person.last_name}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {item.next_action ?? 'Review learner journey'}
                  </div>
                </div>
                <button
                  onClick={() =>
                    navigate(`/programmes/enrolments/${item.enrolment_id}/journey`)
                  }
                  className="px-2.5 py-1.5 rounded-md text-[11px] font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex-shrink-0"
                >
                  Open journey
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overdue evidence */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Clock className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">
            Evidence awaiting assessment ({dashboard.overdue_evidence.length})
          </h3>
          <span className="text-[10px] text-gray-400 ml-auto">
            Submitted over 7 days ago
          </span>
        </div>
        {dashboard.overdue_evidence.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardCheck className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs text-gray-500">
              No evidence waiting longer than 7 days
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {dashboard.overdue_evidence.map((item) => (
              <div key={item.evidence_id} className="flex items-center gap-3 px-5 py-3">
                <Avatar
                  firstName={item.person.first_name}
                  lastName={item.person.last_name}
                  imageUrl={item.person.profile_image_url}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-gray-900">
                    {item.person.first_name} {item.person.last_name}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {item.task_title}
                    {item.submitted_on && ` · submitted ${formatDate(item.submitted_on)}`}
                  </div>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border bg-red-50 text-red-700 border-red-200 flex-shrink-0">
                  {item.days_waiting} days waiting
                </span>
              </div>
            ))}
          </div>
        )}
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
        <div className={`text-[11px] mt-0.5 ${alert ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
          {sub}
        </div>
      )}
    </div>
  );
}

function VulnerabilityStat({
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
      <div className={`text-xl font-bold ${className}`}>{count}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  );
}