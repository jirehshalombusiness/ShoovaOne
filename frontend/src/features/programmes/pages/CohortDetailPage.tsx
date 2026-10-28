import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CalendarRange,
  ClipboardList,
  MapPin,
  Plus,
  Trash2,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DELIVERY_MODE_LABELS,
  programmesService,
  type CohortEnrolment,
  type EnrolmentStatus,
  type ResultPayload,
} from '@/services/programmes.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { CohortStatusBadge } from '../components/ProgrammeBadges';
import {
  CohortModal,
  type CohortFormValues,
} from '../components/CohortModal';
import { EnrolModal } from '../components/EnrolModal';
import { InstructorModal } from '../components/InstructorModal';
import { GradesModal } from '../components/GradesModal';
import { formatDate, formatDateRange } from '../programmeUtils';

export function CohortDetailPage() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const access = useHRAccess();
  const canManage = access.has('programmes.edit');

  const [showEdit, setShowEdit] = useState(false);
  const [showEnrol, setShowEnrol] = useState(false);
  const [showInstructor, setShowInstructor] = useState(false);
  const [gradingEnrolment, setGradingEnrolment] =
    useState<CohortEnrolment | null>(null);

  const { data: cohort, isLoading, error } = useQuery({
    queryKey: ['programmes', 'cohort', cohortId],
    queryFn: () => programmesService.getCohort(cohortId!),
    enabled: !!cohortId,
    refetchInterval: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['programmes', 'cohort', cohortId] });
    queryClient.invalidateQueries({ queryKey: ['programmes', 'detail'] });
    queryClient.invalidateQueries({ queryKey: ['programmes', 'list'] });
  };

  const updateMutation = useMutation({
    mutationFn: (values: CohortFormValues) =>
      programmesService.updateCohort(cohortId!, values),
    onSuccess: () => {
      invalidate();
      setShowEdit(false);
      toast.success('Cohort updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to update cohort');
    },
  });

  const enrolMutation = useMutation({
    mutationFn: ({
      personIds,
      enrolledOn,
    }: {
      personIds: string[];
      enrolledOn?: string;
    }) => programmesService.enrol(cohortId!, personIds, enrolledOn),
    onSuccess: (data) => {
      invalidate();
      setShowEnrol(false);
      toast.success(
        `Cohort now has ${data.enrolled_count} learner${
          data.enrolled_count === 1 ? '' : 's'
        }`,
      );
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to enrol learners');
    },
  });

  const addInstructorMutation = useMutation({
    mutationFn: ({ personId, role }: { personId: string; role: 'lead' | 'instructor' }) =>
      programmesService.addInstructor(cohortId!, personId, role),
    onSuccess: () => {
      invalidate();
      setShowInstructor(false);
      toast.success('Instructor added');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to add instructor');
    },
  });

  const removeInstructorMutation = useMutation({
    mutationFn: (personId: string) =>
      programmesService.removeInstructor(cohortId!, personId),
    onSuccess: () => {
      invalidate();
      toast.success('Instructor removed');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to remove instructor');
    },
  });

  const updateEnrolmentMutation = useMutation({
    mutationFn: ({
      enrolmentId,
      status,
    }: {
      enrolmentId: string;
      status: EnrolmentStatus;
    }) => programmesService.updateEnrolment(enrolmentId, { status }),
    onSuccess: () => {
      invalidate();
      toast.success('Enrolment updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to update enrolment');
    },
  });

  const removeEnrolmentMutation = useMutation({
    mutationFn: (enrolmentId: string) =>
      programmesService.removeEnrolment(enrolmentId),
    onSuccess: () => {
      invalidate();
      toast.success('Learner removed from cohort');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to remove learner');
    },
  });

  const resultMutation = useMutation({
    mutationFn: ({
      enrolmentId,
      courseId,
      payload,
    }: {
      enrolmentId: string;
      courseId: string;
      payload: ResultPayload;
    }) => programmesService.recordResult(enrolmentId, courseId, payload),
    onSuccess: (updated) => {
      invalidate();
      setGradingEnrolment((current) =>
        current && current.id === updated.id ? updated : current,
      );
      toast.success('Result saved');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to save result');
    },
  });

  const removeResultMutation = useMutation({
    mutationFn: ({
      enrolmentId,
      courseId,
    }: {
      enrolmentId: string;
      courseId: string;
    }) => programmesService.removeResult(enrolmentId, courseId),
    onSuccess: (updated) => {
      invalidate();
      setGradingEnrolment((current) =>
        current && current.id === updated.id ? updated : current,
      );
      toast.success('Result cleared');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to clear result');
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl p-6 space-y-4">
        <div className="h-40 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !cohort) {
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
              Could not load this cohort
            </h3>
            <p className="text-sm text-red-700 mt-1">
              {(error as Error)?.message ?? 'It may have been removed.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const closed = cohort.status === 'completed' || cohort.status === 'cancelled';
  const isSavingAny =
    resultMutation.isPending || removeResultMutation.isPending;

  return (
    <div className="max-w-5xl p-6 space-y-5">
      <button
        onClick={() =>
          navigate(`/programmes/${cohort.programme_id}?tab=cohorts`)
        }
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {cohort.programme_name}
      </button>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CohortStatusBadge status={cohort.status} />
              {cohort.code && (
                <span className="text-[11px] font-mono text-gray-500">
                  {cohort.code}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mt-2">
              {cohort.name}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Cohort of{' '}
              <button
                onClick={() =>
                  navigate(`/programmes/${cohort.programme_id}`)
                }
                className="text-primary hover:underline font-medium"
              >
                {cohort.programme_name}
              </button>
            </p>

            <div className="flex items-center gap-5 text-xs text-gray-500 mt-4 flex-wrap">
              <span className="flex items-center gap-1.5">
                <CalendarRange className="w-3.5 h-3.5" />
                {formatDateRange(cohort.start_date, cohort.end_date)}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {cohort.enrolled_count}
                {cohort.capacity ? ` / ${cohort.capacity}` : ''} learners
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {cohort.location ||
                  DELIVERY_MODE_LABELS[cohort.delivery_mode]}
              </span>
            </div>

            {cohort.notes && (
              <p className="text-xs text-gray-600 mt-3 whitespace-pre-wrap">
                {cohort.notes}
              </p>
            )}
          </div>

          {canManage && (
            <button
              onClick={() => setShowEdit(true)}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Edit cohort
            </button>
          )}
        </div>

        {!cohort.courses.length && (
          <div className="mt-4 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <BookOpen className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              This programme has no courses yet, so results cannot be recorded.
              Add courses in the Curriculum tab first.
            </span>
          </div>
        )}
      </div>

      {/* Instructors */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <UsersRound className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">
              Instructors ({cohort.instructors.length})
            </h3>
          </div>
          {canManage && (
            <button
              onClick={() => setShowInstructor(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add instructor
            </button>
          )}
        </div>

        {cohort.instructors.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-gray-500">No instructors assigned yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {cohort.instructors.map((instructor) => (
              <div
                key={instructor.person.id}
                className="flex items-center gap-3 px-5 py-3 group"
              >
                <Avatar
                  firstName={instructor.person.first_name}
                  lastName={instructor.person.last_name}
                  imageUrl={instructor.person.profile_image_url}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-gray-900">
                    {instructor.person.first_name}{' '}
                    {instructor.person.last_name}
                  </div>
                  {instructor.person.email && (
                    <div className="text-[11px] text-gray-500 truncate">
                      {instructor.person.email}
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
                    instructor.role === 'lead'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-gray-100 text-gray-600',
                  )}
                >
                  {instructor.role}
                </span>
                {canManage && (
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove ${instructor.person.first_name} from this cohort?`,
                        )
                      ) {
                        removeInstructorMutation.mutate(instructor.person.id);
                      }
                    }}
                    disabled={removeInstructorMutation.isPending}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity"
                    title="Remove instructor"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Learners */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">
                Learners ({cohort.enrolments.length})
              </h3>
            </div>
            {cohort.capacity && (
              <p className="text-[11px] text-gray-500 mt-0.5 ml-6">
                {cohort.enrolled_count} of {cohort.capacity} places filled
              </p>
            )}
          </div>
          {canManage && !closed && (
            <button
              onClick={() => setShowEnrol(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Enrol learners
            </button>
          )}
        </div>

        {cohort.enrolments.length === 0 ? (
          <div className="text-center py-10">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-500">No learners enrolled yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {cohort.enrolments.map((enrolment) => (
              <LearnerRow
                key={enrolment.id}
                enrolment={enrolment}
                courseCount={cohort.courses.length}
                canManage={canManage}
                isUpdating={updateEnrolmentMutation.isPending}
                isRemoving={removeEnrolmentMutation.isPending}
                onStatusChange={(status) =>
                  updateEnrolmentMutation.mutate({
                    enrolmentId: enrolment.id,
                    status,
                  })
                }
                onGrades={() => setGradingEnrolment(enrolment)}
                onRemove={() => {
                  if (
                    window.confirm(
                      `Remove ${enrolment.person.first_name} from this cohort?`,
                    )
                  ) {
                    removeEnrolmentMutation.mutate(enrolment.id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {showEdit && (
        <CohortModal
          initial={{
            name: cohort.name,
            code: cohort.code,
            start_date: cohort.start_date,
            end_date: cohort.end_date,
            enrolment_opens_on: cohort.enrolment_opens_on,
            enrolment_closes_on: cohort.enrolment_closes_on,
            capacity: cohort.capacity,
            delivery_mode: cohort.delivery_mode,
            location: cohort.location,
            status: cohort.status,
            notes: cohort.notes,
          }}
          isSaving={updateMutation.isPending}
          onClose={() => setShowEdit(false)}
          onSave={(values) => updateMutation.mutate(values)}
        />
      )}

      {showEnrol && (
        <EnrolModal
          existingIds={cohort.enrolments.map((item) => item.person.id)}
          isSaving={enrolMutation.isPending}
          onClose={() => setShowEnrol(false)}
          onEnrol={(personIds, enrolledOn) =>
            enrolMutation.mutate({ personIds, enrolledOn })
          }
        />
      )}

      {showInstructor && (
        <InstructorModal
          existingIds={cohort.instructors.map((item) => item.person.id)}
          isSaving={addInstructorMutation.isPending}
          onClose={() => setShowInstructor(false)}
          onAdd={(personId, role) =>
            addInstructorMutation.mutate({ personId, role })
          }
        />
      )}

      {gradingEnrolment && (
        <GradesModal
          courses={cohort.courses}
          enrolment={gradingEnrolment}
          isSaving={isSavingAny}
          onClose={() => setGradingEnrolment(null)}
          onSave={(courseId, payload) =>
            resultMutation.mutate({
              enrolmentId: gradingEnrolment.id,
              courseId,
              payload,
            })
          }
          onRemove={(courseId) =>
            removeResultMutation.mutate({
              enrolmentId: gradingEnrolment.id,
              courseId,
            })
          }
        />
      )}
    </div>
  );
}

function LearnerRow({
  enrolment,
  courseCount,
  canManage,
  isUpdating,
  isRemoving,
  onStatusChange,
  onGrades,
  onRemove,
}: {
  enrolment: CohortEnrolment;
  courseCount: number;
  canManage: boolean;
  isUpdating: boolean;
  isRemoving: boolean;
  onStatusChange: (status: EnrolmentStatus) => void;
  onGrades: () => void;
  onRemove: () => void;
}) {
  const statusStyles: Record<EnrolmentStatus, string> = {
    enrolled: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    withdrawn: 'bg-red-50 text-red-700 border-red-200',
  };

  const passed = enrolment.results.filter(
    (result) => result.status === 'passed',
  ).length;

  return (
    <div className="flex items-center gap-3 px-5 py-3 group">
      <Avatar
        firstName={enrolment.person.first_name}
        lastName={enrolment.person.last_name}
        imageUrl={enrolment.person.profile_image_url}
        size="sm"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-gray-900">
            {enrolment.person.first_name} {enrolment.person.last_name}
          </span>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border',
              statusStyles[enrolment.status],
            )}
          >
            {enrolment.status}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5 flex-wrap">
          {enrolment.person.email && (
            <span className="truncate">{enrolment.person.email}</span>
          )}
          {enrolment.enrolled_on && (
            <span>Enrolled {formatDate(enrolment.enrolled_on)}</span>
          )}
          {enrolment.completed_on && (
            <span>Completed {formatDate(enrolment.completed_on)}</span>
          )}
          <span className="flex items-center gap-1">
            <ClipboardList className="w-3 h-3" />
            {passed}/{courseCount} passed
          </span>
        </div>
      </div>

      {canManage && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onGrades}
            className="px-2.5 py-1.5 rounded-md text-[11px] font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Results
          </button>

          <select
            value={enrolment.status}
            onChange={(event) =>
              onStatusChange(event.target.value as EnrolmentStatus)
            }
            disabled={isUpdating}
            className="px-2 py-1.5 border border-gray-200 rounded-md text-[11px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          >
            <option value="enrolled">Enrolled</option>
            <option value="completed">Completed</option>
            <option value="withdrawn">Withdrawn</option>
          </select>

          <button
            onClick={onRemove}
            disabled={isRemoving}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity disabled:opacity-40"
            title="Remove learner"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
