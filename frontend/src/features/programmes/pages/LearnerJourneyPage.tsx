import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CalendarRange,
  Camera,
  CheckCircle2,
  ClipboardList,
  Lock,
  MapPin,
  MessageSquare,
  Plus,
  TrendingUp,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { programmesService } from '@/services/programmes.service';
import {
  ASSIGNMENT_STATUS_LABELS,
  COMPETENCY_RESULT_LABELS,
  EVIDENCE_QUALITY_LABELS,
  EVIDENCE_TYPE_LABELS,
  READINESS_LABELS,
  TASK_STATUS_LABELS,
  VULNERABILITY_LABELS,
  AFFORD_TRAINING_LABELS,
  learnerWorkflowService,
  type AssessmentCreatePayload,
  type AssignmentItem,
  type AssignmentStatus,
  type BaselinePayload,
  type EvidenceCreatePayload,
  type EvidenceItem,
  type OutcomePayload,
  type TaskCreatePayload,
  type TaskItem,
} from '@/services/learnerWorkflow.service';
import { documentService } from '@/services/document.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { formatDate } from '../programmeUtils';
import { AssignModuleModal } from '../components/AssignModuleModal';
import { AssessModal } from '../components/AssessModal';
import { BaselineModal } from '../components/BaselineModal';
import { EvidenceModal } from '../components/EvidenceModal';
import { OutcomeModal } from '../components/OutcomeModal';
import { TaskModal } from '../components/TaskModal';
import { LearnerCourseworkList } from '../components/LearnerCourseworkList';

const assignmentStyles: Record<AssignmentStatus, string> = {
  assigned: 'bg-gray-100 text-gray-600 border-gray-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  follow_up: 'bg-red-50 text-red-700 border-red-200',
};

const badgeClass =
  'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border';

function SectionHeader({
  step,
  icon,
  title,
  action,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-100">
      <div className="flex items-center gap-2.5">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
          {step}
        </span>
        {icon}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      {action}
    </div>
  );
}

function AddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
    >
      <Plus className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

export function LearnerJourneyPage() {
  const { enrolmentId } = useParams<{ enrolmentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const access = useHRAccess();
  const canManage = access.has('programmes.edit');
  const canAssess = access.has('programmes.assess');

  const [showBaseline, setShowBaseline] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [taskFor, setTaskFor] = useState<AssignmentItem | null>(null);
  const [evidenceFor, setEvidenceFor] = useState<TaskItem | null>(null);
  const [assessFor, setAssessFor] = useState<EvidenceItem | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);

  const { data: journey, isLoading, error } = useQuery({
    queryKey: ['learner-workflow', 'journey', enrolmentId],
    queryFn: () => learnerWorkflowService.getJourney(enrolmentId!),
    enabled: !!enrolmentId,
  });

  const { data: cohort } = useQuery({
    queryKey: ['programmes', 'cohort', journey?.cohort_id],
    queryFn: () => programmesService.getCohort(journey!.cohort_id),
    enabled: !!journey?.cohort_id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ['learner-workflow', 'journey', enrolmentId],
    });
    queryClient.invalidateQueries({ queryKey: ['programmes', 'cohort'] });
  };

  const onError = (fallback: string) => (err: any) =>
    toast.error(err?.response?.data?.detail ?? err?.message ?? fallback);

  const baselineMutation = useMutation({
    mutationFn: (payload: BaselinePayload) =>
      learnerWorkflowService.recordBaseline(enrolmentId!, payload),
    onSuccess: () => {
      invalidate();
      setShowBaseline(false);
      toast.success('Baseline recorded');
    },
    onError: onError('Failed to record baseline'),
  });

  const assignMutation = useMutation({
    mutationFn: (payload: {
      course_id: string;
      competency: string;
      assigned_on?: string | null;
      due_on?: string | null;
    }) => learnerWorkflowService.assignModule(enrolmentId!, payload),
    onSuccess: () => {
      invalidate();
      setShowAssign(false);
      toast.success('Module assigned');
    },
    onError: onError('Failed to assign module'),
  });

  const assignmentStatusMutation = useMutation({
    mutationFn: ({
      assignmentId,
      status,
    }: {
      assignmentId: string;
      status: AssignmentStatus;
    }) =>
      learnerWorkflowService.updateAssignment(assignmentId, { status }),
    onSuccess: () => {
      invalidate();
      toast.success('Module status updated');
    },
    onError: onError('Failed to update module'),
  });

  const taskMutation = useMutation({
    mutationFn: ({
      assignmentId,
      payload,
    }: {
      assignmentId: string;
      payload: TaskCreatePayload;
    }) => learnerWorkflowService.createTask(assignmentId, payload),
    onSuccess: () => {
      invalidate();
      setTaskFor(null);
      toast.success('Practical task assigned');
    },
    onError: onError('Failed to assign task'),
  });

  const evidenceMutation = useMutation({
    mutationFn: async ({
      taskId,
      payload,
      file,
    }: {
      taskId: string;
      payload: EvidenceCreatePayload;
      file: File | null;
    }) => {
      let documentId = payload.document_id ?? null;
      if (file && journey) {
        const doc = await documentService.upload(
          file,
          'person',
          journey.person.id,
        );
        documentId = doc.id;
      }
      return learnerWorkflowService.submitEvidence(taskId, {
        ...payload,
        document_id: documentId,
      });
    },
    onSuccess: () => {
      invalidate();
      setEvidenceFor(null);
      toast.success('Evidence submitted');
    },
    onError: onError('Failed to submit evidence'),
  });

  const assessMutation = useMutation({
    mutationFn: ({
      evidenceId,
      payload,
    }: {
      evidenceId: string;
      payload: AssessmentCreatePayload;
    }) => learnerWorkflowService.assessEvidence(evidenceId, payload),
    onSuccess: () => {
      invalidate();
      setAssessFor(null);
      toast.success('Assessment recorded');
    },
    onError: onError('Failed to record assessment'),
  });

  const outcomeMutation = useMutation({
    mutationFn: (payload: OutcomePayload) =>
      learnerWorkflowService.recordOutcome(enrolmentId!, payload),
    onSuccess: () => {
      invalidate();
      setShowOutcome(false);
      toast.success('Outcome recorded');
    },
    onError: onError('Failed to record outcome'),
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl p-6 space-y-4">
        <div className="h-40 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !journey) {
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
              Could not load this learner journey
            </h3>
            <p className="text-sm text-red-700 mt-1">
              {(error as Error)?.message ?? 'It may have been removed.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { progress } = journey;
  const readinessStyles: Record<string, string> = {
    not_started: 'bg-gray-100 text-gray-600 border-gray-200',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
    ready_for_completion: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    completed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };

  return (
    <div className="max-w-5xl p-6 space-y-5">
      <button
        onClick={() => navigate(`/programmes/cohort/${journey.cohort_id}`)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {journey.cohort_name}
      </button>

      {/* Learner header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <Avatar
            firstName={journey.person.first_name}
            lastName={journey.person.last_name}
            imageUrl={journey.person.profile_image_url}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                {journey.person.first_name} {journey.person.last_name}
              </h1>
              <span className={cn(badgeClass, 'bg-blue-50 text-blue-700 border-blue-200')}>
                {journey.status}
              </span>
              <span className={cn(badgeClass, readinessStyles[progress.readiness])}>
                {READINESS_LABELS[progress.readiness]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Learner journey ·{' '}
              <button
                onClick={() => navigate(`/programmes/${journey.programme_id}`)}
                className="text-primary hover:underline font-medium"
              >
                {journey.programme_name}
              </button>{' '}
              · {journey.cohort_name}
            </p>
            <div className="flex items-center gap-5 text-xs text-gray-500 mt-3 flex-wrap">
              {journey.person.email && <span>{journey.person.email}</span>}
              {journey.enrolled_on && (
                <span className="flex items-center gap-1.5">
                  <CalendarRange className="w-3.5 h-3.5" />
                  Enrolled {formatDate(journey.enrolled_on)}
                </span>
              )}
              {journey.completed_on && (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Completed {formatDate(journey.completed_on)}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 tabular-nums">
              {progress.competencies_completed}
              <span className="text-sm font-normal text-gray-400">
                {' '}/ {progress.assignments_total}
              </span>
            </div>
            <div className="text-[11px] text-gray-500">competencies demonstrated</div>
          </div>
        </div>
      </div>

      {(canManage || canAssess) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Course assignments & grades</h2>
          <LearnerCourseworkList enrolmentId={journey.enrolment_id} canSubmit={canManage && journey.status === 'enrolled'} onBehalf canReview />
        </section>
      )}

      {/* 1 · Profile & baseline */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <SectionHeader
          step={1}
          icon={<User className="w-4 h-4 text-gray-400" />}
          title="Profile & socioeconomic baseline"
          action={
            journey.can_view_baseline && canManage ? (
              <AddButton
                label={journey.baseline ? 'Edit baseline' : 'Record baseline'}
                onClick={() => setShowBaseline(true)}
              />
            ) : undefined
          }
        />
        <div className="px-5 py-4">
          {!journey.can_view_baseline ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Lock className="w-3.5 h-3.5" />
              Socioeconomic baseline is restricted. You see learning records only.
            </div>
          ) : !journey.baseline ? (
            <p className="text-xs text-gray-500">
              No baseline recorded yet. Capture the socioeconomic baseline at enrolment.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-xs">
              <BaselineField
                label="Household income band"
                value={journey.baseline.household_income_band?.replace(/_/g, ' ')}
              />
              <BaselineField
                label="Employment status"
                value={journey.baseline.employment_status?.replace(/_/g, ' ')}
              />
              <BaselineField
                label="Affords training"
                value={
                  journey.baseline.can_afford_training
                    ? AFFORD_TRAINING_LABELS[journey.baseline.can_afford_training]
                    : null
                }
              />
              <BaselineField
                label="Device access"
                value={journey.baseline.device_access?.replace(/_/g, ' ')}
              />
              <BaselineField
                label="Internet access"
                value={journey.baseline.internet_access}
              />
              <BaselineField
                label="Education"
                value={journey.baseline.education_status?.toUpperCase()}
              />
              <BaselineField
                label="Dependents"
                value={journey.baseline.household_dependents?.toString()}
              />
              <BaselineField
                label="Transport constraints"
                value={journey.baseline.transport_constraints}
              />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Vulnerability
                </div>
                {journey.baseline.vulnerability_class ? (
                  <span
                    className={cn(
                      badgeClass,
                      'mt-1',
                      journey.baseline.vulnerability_class === 'high'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : journey.baseline.vulnerability_class === 'moderate'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    )}
                  >
                    {VULNERABILITY_LABELS[journey.baseline.vulnerability_class]}
                  </span>
                ) : (
                  <span className="text-gray-400 text-xs">Not classified</span>
                )}
              </div>
              {journey.baseline.recorded_on && (
                <div className="col-span-2 sm:col-span-3 text-[11px] text-gray-400">
                  Recorded {formatDate(journey.baseline.recorded_on)}
                  {journey.baseline.recorded_by &&
                    ` by ${journey.baseline.recorded_by.first_name} ${journey.baseline.recorded_by.last_name}`}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2-5 · Modules with tasks, evidence, assessments */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <SectionHeader
          step={2}
          icon={<BookOpen className="w-4 h-4 text-gray-400" />}
          title="Learning modules"
          action={
            canManage ? (
              <AddButton label="Assign module" onClick={() => setShowAssign(true)} />
            ) : undefined
          }
        />
        {journey.assignments.length === 0 ? (
          <div className="text-center py-10">
            <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500">
              No modules assigned yet. Assign the first learning module to start the journey.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {journey.assignments.map((assignment) => (
              <div key={assignment.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-gray-900">
                        {assignment.course.title}
                      </span>
                      <span className={cn(badgeClass, assignmentStyles[assignment.status])}>
                        {ASSIGNMENT_STATUS_LABELS[assignment.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="font-medium text-gray-500">Competency:</span>{' '}
                      {assignment.competency}
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-gray-500 mt-1 flex-wrap">
                      {assignment.assigned_on && (
                        <span>Assigned {formatDate(assignment.assigned_on)}</span>
                      )}
                      {assignment.due_on && (
                        <span>Due {formatDate(assignment.due_on)}</span>
                      )}
                      {assignment.completed_on && (
                        <span className="text-emerald-600">
                          Completed {formatDate(assignment.completed_on)}
                        </span>
                      )}
                    </div>
                    {assignment.course.learning_outcomes && (
                      <p className="text-[11px] text-gray-500 mt-1 whitespace-pre-wrap">
                        {assignment.course.learning_outcomes}
                      </p>
                    )}
                    {assignment.next_action && (
                      <p className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 mt-2">
                        <ArrowRight className="w-3 h-3 flex-shrink-0" />
                        Next: {assignment.next_action}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={assignment.status}
                        onChange={(e) =>
                          assignmentStatusMutation.mutate({
                            assignmentId: assignment.id,
                            status: e.target.value as AssignmentStatus,
                          })
                        }
                        disabled={assignmentStatusMutation.isPending}
                        className="px-2 py-1.5 border border-gray-200 rounded-md text-[11px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      >
                        {Object.entries(ASSIGNMENT_STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <AddButton
                        label="Add task"
                        onClick={() => setTaskFor(assignment)}
                      />
                    </div>
                  )}
                </div>

                {/* 3 · Practical tasks */}
                <div className="mt-3 space-y-3">
                  {assignment.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 rounded-t-lg flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <ClipboardList className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs font-semibold text-gray-800">
                            {task.title}
                          </span>
                          <span className={cn(badgeClass, assignmentStyles[task.status])}>
                            {TASK_STATUS_LABELS[task.status]}
                          </span>
                          {task.location && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-500">
                              <MapPin className="w-3 h-3" />
                              {task.location}
                            </span>
                          )}
                          {task.due_on && (
                            <span className="text-[11px] text-gray-500">
                              Due {formatDate(task.due_on)}
                            </span>
                          )}
                        </div>
                        {canManage && (
                          <AddButton
                            label="Submit evidence"
                            onClick={() => setEvidenceFor(task)}
                          />
                        )}
                      </div>

                      <div className="px-4 py-3 space-y-2">
                        {task.instructions && (
                          <p className="text-[11px] text-gray-600 whitespace-pre-wrap">
                            <span className="font-semibold">Instructions:</span>{' '}
                            {task.instructions}
                          </p>
                        )}
                        {task.safety_requirements && (
                          <p className="text-[11px] text-amber-700 whitespace-pre-wrap">
                            <span className="font-semibold">Safety:</span>{' '}
                            {task.safety_requirements}
                          </p>
                        )}
                        {task.expected_evidence && (
                          <p className="text-[11px] text-gray-600 whitespace-pre-wrap">
                            <span className="font-semibold">Expected evidence:</span>{' '}
                            {task.expected_evidence}
                          </p>
                        )}

                        {/* 4 · Evidence */}
                        {task.evidence.length === 0 ? (
                          <p className="text-[11px] text-gray-400">
                            No evidence submitted yet.
                          </p>
                        ) : (
                          <div className="space-y-2 pt-1">
                            {task.evidence.map((evidence) => (
                              <div
                                key={evidence.id}
                                className="border border-gray-100 rounded-md px-3 py-2.5 bg-white"
                              >
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Camera className="w-3.5 h-3.5 text-gray-400" />
                                    <span className={cn(badgeClass, 'bg-gray-100 text-gray-600 border-gray-200')}>
                                      {EVIDENCE_TYPE_LABELS[evidence.evidence_type]}
                                    </span>
                                    {evidence.recorded_on && (
                                      <span className="text-[11px] text-gray-500">
                                        {formatDate(evidence.recorded_on)}
                                      </span>
                                    )}
                                    {evidence.submitted_by && (
                                      <span className="text-[11px] text-gray-400">
                                        by {evidence.submitted_by.first_name}{' '}
                                        {evidence.submitted_by.last_name}
                                      </span>
                                    )}
                                  </div>
                                  {canAssess && (
                                    <button
                                      onClick={() => setAssessFor(evidence)}
                                      className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                      Assess
                                    </button>
                                  )}
                                </div>

                                {evidence.document_name && (
                                  <p className="text-[11px] text-gray-600 mt-1.5">
                                    File: {evidence.document_name}
                                  </p>
                                )}
                                {evidence.file_url && (
                                  <a
                                    href={evidence.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] text-primary hover:underline block mt-1.5 truncate"
                                  >
                                    {evidence.file_url}
                                  </a>
                                )}
                                {evidence.field_notes && (
                                  <p className="text-[11px] text-gray-600 mt-1.5 whitespace-pre-wrap">
                                    <span className="font-semibold">Field notes:</span>{' '}
                                    {evidence.field_notes}
                                  </p>
                                )}
                                {evidence.reflection && (
                                  <p className="text-[11px] text-gray-600 mt-1 whitespace-pre-wrap">
                                    <span className="font-semibold">Reflection:</span>{' '}
                                    {evidence.reflection}
                                  </p>
                                )}
                                {evidence.gps_lat != null && evidence.gps_lng != null && (
                                  <p className="flex items-center gap-1 text-[11px] text-gray-500 mt-1">
                                    <MapPin className="w-3 h-3" />
                                    {evidence.gps_lat.toFixed(6)},{' '}
                                    {evidence.gps_lng.toFixed(6)}
                                    {evidence.location_label &&
                                      ` · ${evidence.location_label}`}
                                  </p>
                                )}

                                {/* 5 · Mentor assessments */}
                                {evidence.assessments.length > 0 && (
                                  <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">
                                    {evidence.assessments.map((assessment) => (
                                      <div
                                        key={assessment.id}
                                        className="text-[11px] bg-gray-50 rounded-md px-2.5 py-2"
                                      >
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span
                                            className={cn(
                                              badgeClass,
                                              assessment.competency_result === 'met'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : assessment.competency_result === 'partially_met'
                                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                  : 'bg-red-50 text-red-700 border-red-200',
                                            )}
                                          >
                                            {COMPETENCY_RESULT_LABELS[assessment.competency_result]}
                                          </span>
                                          <span className="font-medium text-gray-700">
                                            {assessment.mentor.first_name}{' '}
                                            {assessment.mentor.last_name}
                                          </span>
                                          {assessment.assessed_on && (
                                            <span className="text-gray-400">
                                              {formatDate(assessment.assessed_on)}
                                            </span>
                                          )}
                                          {assessment.evidence_quality && (
                                            <span className="text-gray-400">
                                              Evidence:{' '}
                                              {EVIDENCE_QUALITY_LABELS[assessment.evidence_quality]}
                                            </span>
                                          )}
                                        </div>
                                        {assessment.feedback && (
                                          <p className="text-gray-600 mt-1 whitespace-pre-wrap">
                                            {assessment.feedback}
                                          </p>
                                        )}
                                        {assessment.follow_up && (
                                          <p className="text-amber-700 mt-1 whitespace-pre-wrap">
                                            Follow-up: {assessment.follow_up}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {assignment.tasks.length === 0 && (
                    <p className="text-[11px] text-gray-400">
                      No practical task yet — add one to move from learning to practice.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6 · Progress */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <SectionHeader
          step={6}
          icon={<TrendingUp className="w-4 h-4 text-gray-400" />}
          title="Progress & readiness"
        />
        <div className="px-5 py-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Competencies
              </div>
              <div className="text-sm font-semibold text-gray-900 mt-0.5 tabular-nums">
                {progress.competencies_completed} completed ·{' '}
                {progress.competencies_pending} pending
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Readiness
              </div>
              <span className={cn(badgeClass, 'mt-1', readinessStyles[progress.readiness])}>
                {READINESS_LABELS[progress.readiness]}
              </span>
            </div>
            {progress.next_module && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Next module
                </div>
                <div className="text-sm font-medium text-gray-900 mt-0.5">
                  {progress.next_module}
                </div>
              </div>
            )}
            {progress.next_action && (
              <div className="flex-1 min-w-[200px]">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Next action
                </div>
                <div className="text-sm text-gray-700 mt-0.5">
                  {progress.next_action}
                </div>
              </div>
            )}
          </div>
          {progress.assignments_total > 0 && (
            <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{
                  width: `${
                    (progress.competencies_completed / progress.assignments_total) * 100
                  }%`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 7 · Outcome */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <SectionHeader
          step={7}
          icon={<Award className="w-4 h-4 text-gray-400" />}
          title="Outcome"
          action={
            canManage ? (
              <AddButton
                label={journey.outcome ? 'Edit outcome' : 'Record outcome'}
                onClick={() => setShowOutcome(true)}
              />
            ) : undefined
          }
        />
        <div className="px-5 py-4">
          {!journey.outcome ? (
            <p className="text-xs text-gray-500">
              No outcome recorded yet. Capture completion, outputs and next steps when the
              learner finishes.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-xs">
              <BaselineField label="Demonstrated skills" value={journey.outcome.demonstrated_skills} />
              <BaselineField label="Field outputs" value={journey.outcome.field_outputs} />
              <BaselineField label="Further training" value={journey.outcome.further_training} />
              <BaselineField
                label="Placement"
                value={journey.outcome.placement_status?.replace(/_/g, ' ')}
              />
              <BaselineField
                label="Follow-up"
                value={journey.outcome.follow_up_status?.replace(/_/g, ' ')}
              />
              <BaselineField
                label="Follow-up date"
                value={formatDate(journey.outcome.follow_up_on)}
              />
            </div>
          )}
        </div>
      </div>

      {showBaseline && (
        <BaselineModal
          initial={journey.baseline}
          isSaving={baselineMutation.isPending}
          onClose={() => setShowBaseline(false)}
          onSave={(payload) => baselineMutation.mutate(payload)}
        />
      )}

      {showAssign && (
        <AssignModuleModal
          courses={cohort?.courses ?? []}
          assignedCourseIds={journey.assignments.map((a) => a.course.id)}
          isSaving={assignMutation.isPending}
          onClose={() => setShowAssign(false)}
          onSave={(payload) => assignMutation.mutate(payload)}
        />
      )}

      {taskFor && (
        <TaskModal
          moduleTitle={taskFor.course.title}
          isSaving={taskMutation.isPending}
          onClose={() => setTaskFor(null)}
          onSave={(payload) =>
            taskMutation.mutate({ assignmentId: taskFor.id, payload })
          }
        />
      )}

      {evidenceFor && (
        <EvidenceModal
          taskTitle={evidenceFor.title}
          isSaving={evidenceMutation.isPending}
          onClose={() => setEvidenceFor(null)}
          onSave={(payload, file) =>
            evidenceMutation.mutate({ taskId: evidenceFor.id, payload, file })
          }
        />
      )}

      {assessFor && (
        <AssessModal
          isSaving={assessMutation.isPending}
          onClose={() => setAssessFor(null)}
          onSave={(payload) =>
            assessMutation.mutate({ evidenceId: assessFor.id, payload })
          }
        />
      )}

      {showOutcome && (
        <OutcomeModal
          initial={journey.outcome}
          isSaving={outcomeMutation.isPending}
          onClose={() => setShowOutcome(false)}
          onSave={(payload) => outcomeMutation.mutate(payload)}
        />
      )}
    </div>
  );
}

function BaselineField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <div className={cn('mt-0.5 capitalize', value ? 'text-gray-800' : 'text-gray-400')}>
        {value || 'Not recorded'}
      </div>
    </div>
  );
}