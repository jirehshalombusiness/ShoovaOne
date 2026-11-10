import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import {
  courseworkService,
  COURSEWORK_STATUS_LABELS,
  GRADING_STATUS_LABELS,
  type AssignmentLearner,
  type AssignmentSubmission,
  type CourseAssignment,
} from '@/services/coursework.service';
import { Avatar } from '@/components/ui/Avatar';
import { useHRAccess } from '@/hooks/useHRAccess';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { useProgrammeWorkspace } from '../programmeWorkspace';
import { formatDate } from '../programmeUtils';
import { GradeSubmissionModal, courseworkErrorMessage } from '../components/GradeSubmissionModal';
import { CourseworkSubmissionModal } from '../components/CourseworkSubmissionModal';

type RosterFilter = '' | 'missing' | 'submitted' | 'graded' | 'changes_requested' | 'late';

function timestamp(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function attemptsFor(learner: AssignmentLearner): AssignmentSubmission[] {
  const attempts = new Map(learner.history.map((attempt) => [attempt.id, attempt]));
  if (learner.submission) attempts.set(learner.submission.id, learner.submission);
  return [...attempts.values()].sort((a, b) => b.attempt - a.attempt);
}

function recordingUnavailable(assignment: CourseAssignment, learner: AssignmentLearner, programmeStatus: string): string | null {
  if (programmeStatus !== 'active') return 'Submissions can only be recorded in an active programme.';
  if (assignment.status !== 'published') return 'Submissions can only be recorded for published assignments.';
  if (learner.enrolment_status !== 'enrolled') return 'Only currently enrolled learners can submit.';
  const latest = attemptsFor(learner)[0];
  if (latest?.grading_status === 'submitted') return 'The latest attempt is awaiting grading.';
  if (latest?.grading_status === 'graded' && !assignment.allow_resubmission) return 'Resubmission is not allowed after grading.';
  return null;
}

function SubmissionState({ submission }: { submission: AssignmentSubmission | null }) {
  const status = submission?.grading_status ?? 'missing';
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={cn(
        'rounded px-2 py-0.5 text-[11px] font-medium',
        status === 'graded' ? 'bg-emerald-50 text-emerald-700'
          : status === 'submitted' ? 'bg-blue-50 text-blue-700'
            : status === 'changes_requested' ? 'bg-amber-50 text-amber-800'
              : 'bg-gray-100 text-gray-600',
      )}>{GRADING_STATUS_LABELS[status]}</span>
      {submission?.is_late && <span className="text-[11px] font-medium text-amber-700">Late</span>}
    </span>
  );
}

function SubmissionReadOnly({ assignment, learner, submission }: {
  assignment: CourseAssignment;
  learner: AssignmentLearner;
  submission: AssignmentSubmission;
}) {
  const recordedOnBehalf = submission.submitted_by && submission.submitted_by.id !== learner.person.id;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SubmissionState submission={submission} />
        <span className="text-xs text-gray-500">Submitted {timestamp(submission.submitted_at)} · Attempt {submission.attempt}</span>
        <span className="font-semibold tabular-nums text-gray-900">{submission.score ?? '—'} / {assignment.points_possible} points</span>
      </div>
      {recordedOnBehalf && (
        <p className="text-xs text-gray-500">Recorded on behalf by {submission.submitted_by?.first_name} {submission.submitted_by?.last_name}.</p>
      )}
      <div>
        <h3 className="mb-1.5 text-xs font-semibold text-gray-700">Submission</h3>
        <div className="whitespace-pre-wrap break-words rounded-md border border-gray-200 bg-gray-50 p-4 text-gray-800">{submission.content}</div>
      </div>
      {assignment.rubric.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-xs font-semibold text-gray-700">Rubric scores</h3>
          <dl className="divide-y divide-gray-100 rounded-md border border-gray-200">
            {assignment.rubric.map((criterion) => (
              <div key={criterion.id} className="flex justify-between gap-3 px-3 py-2 text-xs">
                <dt className="text-gray-700">{criterion.label}</dt>
                <dd className="whitespace-nowrap font-medium tabular-nums text-gray-900">{submission.rubric_scores[criterion.id] ?? '—'} / {criterion.points}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <div>
        <h3 className="mb-1.5 text-xs font-semibold text-gray-700">Feedback</h3>
        <p className="whitespace-pre-wrap break-words text-sm text-gray-700">{submission.feedback || 'No feedback yet.'}</p>
        {(submission.graded_by || submission.graded_at) && (
          <p className="mt-2 text-xs text-gray-500">
            {submission.graded_by ? `Assessed by ${submission.graded_by.first_name} ${submission.graded_by.last_name}` : 'Assessment recorded'}
            {submission.graded_at ? ` · ${timestamp(submission.graded_at)}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

export function AssignmentGradingPage() {
  const { programme, canManage } = useProgrammeWorkspace();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const canAssess = useHRAccess().has('programmes.assess');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const base = `/programmes/${programme.id}`;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RosterFilter>('');
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const [grading, setGrading] = useState<{ learnerId: string; submissionId: string } | null>(null);
  const [recordLearnerId, setRecordLearnerId] = useState<string | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);

  const query = useQuery({
    queryKey: ['coursework', 'detail', assignmentId],
    queryFn: () => courseworkService.get(assignmentId!),
    enabled: !!assignmentId,
  });

  useEffect(() => {
    setSearch('');
    setStatusFilter('');
    setSelectedLearnerId(null);
    setGrading(null);
    setRecordLearnerId(null);
  }, [assignmentId, programme.id]);

  useEffect(() => {
    if (selectedLearnerId) reviewHeading.current?.focus();
  }, [selectedLearnerId]);

  const back = (
    <Link to={`${base}/assessments`} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-primary">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to assessments
    </Link>
  );

  if (!assignmentId || (query.data && query.data.assignment.programme_id !== programme.id)) {
    return <div className="space-y-5">{back}<div role="alert" className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-700">Assignment not found in this programme.</div></div>;
  }
  if (query.isLoading) {
    return <div className="space-y-5">{back}<div role="status" className="rounded-lg border border-gray-200 bg-white p-8 text-sm text-gray-500">Loading assignment and learner submissions…</div></div>;
  }
  if (query.isError || !query.data) {
    return (
      <div className="space-y-5">
        {back}
        <div role="alert" className="rounded-lg border border-red-200 bg-white p-8 text-center">
          <p className="text-sm text-red-700">{courseworkErrorMessage(query.error, 'Unable to load this assignment.')}</p>
          <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} className="mt-4 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">{query.isFetching ? 'Retrying…' : 'Retry'}</button>
        </div>
      </div>
    );
  }

  const { assignment, learners } = query.data;
  const searchTerm = search.trim().toLocaleLowerCase();
  const filteredLearners = learners.filter((learner) => {
    const person = learner.person;
    const matchesSearch = `${person.first_name} ${person.last_name} ${person.email ?? ''}`.toLocaleLowerCase().includes(searchTerm);
    const submission = learner.submission;
    const matchesStatus = !statusFilter || (statusFilter === 'late' ? !!submission?.is_late : (submission?.grading_status ?? 'missing') === statusFilter);
    return matchesSearch && matchesStatus;
  });
  const summary = [
    { label: 'Not submitted', count: learners.filter((learner) => !learner.submission).length },
    { label: 'Submitted', count: learners.filter((learner) => learner.submission?.grading_status === 'submitted').length },
    { label: 'Graded', count: learners.filter((learner) => learner.submission?.grading_status === 'graded').length },
    { label: 'Changes requested', count: learners.filter((learner) => learner.submission?.grading_status === 'changes_requested').length },
    { label: 'Late', count: learners.filter((learner) => learner.submission?.is_late).length },
  ];
  const selectedLearner = learners.find((learner) => learner.enrolment_id === selectedLearnerId);
  const selectedAttempts = selectedLearner ? attemptsFor(selectedLearner) : [];
  const selectedSubmission = selectedLearner?.submission ?? null;
  const selectedRecordingReason = selectedLearner ? recordingUnavailable(assignment, selectedLearner, programme.status) : null;
  const canGradeSelected = canAssess && selectedLearner && selectedSubmission &&
    selectedAttempts[0]?.id === selectedSubmission.id && user?.person_id !== selectedLearner.person.id;
  const gradingLearner = grading ? learners.find((learner) => learner.enrolment_id === grading.learnerId) : undefined;
  const gradingSubmission = gradingLearner && grading ? attemptsFor(gradingLearner).find((submission) => submission.id === grading.submissionId) : undefined;
  const recordLearner = learners.find((learner) => learner.enrolment_id === recordLearnerId);

  return (
    <div className="space-y-5">
      {back}
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold tracking-tight text-gray-900">{assignment.title}</h1>
            <p className="mt-1 text-sm text-gray-500">{assignment.course_title} · {assignment.cohort_name}</p>
          </div>
          <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">{COURSEWORK_STATUS_LABELS[assignment.status]}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
          <span>Due: {formatDate(assignment.due_on) ?? 'No due date'}</span>
          <span>{assignment.points_possible} points possible</span>
          <span>{assignment.allow_resubmission ? 'Resubmission allowed' : 'Resubmission only when changes are requested'}</span>
        </div>
        <div className="mt-5">
          <h2 className="text-xs font-semibold text-gray-700">Instructions</h2>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-gray-700">{assignment.instructions || 'No instructions provided.'}</p>
        </div>
        {assignment.rubric.length > 0 && (
          <div className="mt-5">
            <h2 className="text-xs font-semibold text-gray-700">Rubric</h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {assignment.rubric.map((criterion) => <li key={criterion.id} className="flex justify-between gap-3 rounded-md border border-gray-100 px-3 py-2 text-xs text-gray-700"><span>{criterion.label}</span><span className="whitespace-nowrap font-medium">{criterion.points} points</span></li>)}
            </ul>
          </div>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {summary.map((item) => <div key={item.label} className="rounded-lg border border-gray-200 bg-white p-4"><dt className="text-xs text-gray-500">{item.label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{item.count}</dd></div>)}
      </dl>

      <section className="space-y-3" aria-label="Learner submissions">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto text-base font-semibold text-gray-900">Learner roster <span className="text-sm font-normal text-gray-500">({learners.length})</span></h2>
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input aria-label="Search learners by name or email" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search learners…" className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <select aria-label="Filter submissions by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as RosterFilter)} className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">All statuses</option>
            <option value="missing">Not submitted</option>
            <option value="submitted">Submitted</option>
            <option value="graded">Graded</option>
            <option value="changes_requested">Changes requested</option>
            <option value="late">Late</option>
          </select>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Learner submissions for {assignment.title}</caption>
            <thead className="border-b border-gray-100 bg-gray-50 text-[11px] text-gray-500">
              <tr><th scope="col" className="px-5 py-3 font-medium">Learner</th><th scope="col" className="px-4 py-3 font-medium">Submission</th><th scope="col" className="px-4 py-3 font-medium">State</th><th scope="col" className="px-4 py-3 font-medium">Points</th><th scope="col" className="px-5 py-3 font-medium">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLearners.map((learner) => {
                const submission = learner.submission;
                const recordingReason = recordingUnavailable(assignment, learner, programme.status);
                const name = `${learner.person.first_name} ${learner.person.last_name}`;
                return (
                  <tr key={learner.enrolment_id} className={cn('align-top', selectedLearnerId === learner.enrolment_id && 'bg-primary/5')}>
                    <th scope="row" className="min-w-[220px] px-5 py-4 font-normal">
                      <div className="flex items-center gap-3">
                        <Avatar firstName={learner.person.first_name} lastName={learner.person.last_name} imageUrl={learner.person.profile_image_url} size="sm" />
                        <div><p className="font-semibold text-gray-900">{name}</p><p className="mt-0.5 text-xs text-gray-500">{learner.person.email ?? learner.enrolment_status}</p>{learner.enrolment_status !== 'enrolled' && <p className="mt-0.5 text-xs text-gray-500">{learner.enrolment_status}</p>}</div>
                      </div>
                    </th>
                    <td className="min-w-[190px] px-4 py-4 text-xs text-gray-500">{submission ? <><p>{timestamp(submission.submitted_at)}</p><p className="mt-1">Attempt {submission.attempt}</p></> : 'No submission yet'}</td>
                    <td className="min-w-[160px] px-4 py-4"><SubmissionState submission={submission} /></td>
                    <td className="whitespace-nowrap px-4 py-4 text-xs font-medium tabular-nums text-gray-700">{submission?.score ?? '—'} / {assignment.points_possible}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" aria-label={`${canAssess ? 'Review' : 'View'} submission for ${name}`} aria-pressed={selectedLearnerId === learner.enrolment_id} onClick={() => setSelectedLearnerId(learner.enrolment_id)} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">{canAssess ? 'Review' : 'View'}</button>
                        {canManage && !recordingReason && <button type="button" aria-label={`Record submission on behalf of ${name}`} onClick={() => setRecordLearnerId(learner.enrolment_id)} className="whitespace-nowrap rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5">Record submission</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredLearners.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-500">{learners.length === 0 ? 'No learners are enrolled in this assignment’s cohort.' : 'No learners match these filters.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {selectedLearner && (
        <section className="rounded-lg border border-gray-200 bg-white p-5" aria-label="Submission review">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 ref={reviewHeading} tabIndex={-1} className="text-base font-semibold text-gray-900 focus:outline-none">{selectedLearner.person.first_name} {selectedLearner.person.last_name} · Latest submission</h2>
            <div className="flex flex-wrap gap-2">
              {canGradeSelected && selectedSubmission && <button type="button" onClick={() => setGrading({ learnerId: selectedLearner.enrolment_id, submissionId: selectedSubmission.id })} className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-dark">{selectedSubmission.grading_status === 'graded' ? 'Edit grade' : 'Grade submission'}</button>}
              {canManage && !selectedRecordingReason && <button type="button" onClick={() => setRecordLearnerId(selectedLearner.enrolment_id)} className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/5">Record submission</button>}
              <button type="button" onClick={() => setSelectedLearnerId(null)} className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">Close review</button>
            </div>
          </div>
          {selectedSubmission ? <SubmissionReadOnly assignment={assignment} learner={selectedLearner} submission={selectedSubmission} /> : <p className="text-sm text-gray-500">This learner has not submitted any work yet.</p>}
          {canAssess && user?.person_id === selectedLearner.person.id && selectedSubmission && <p className="mt-3 text-xs text-gray-500">You cannot grade your own submission.</p>}
          {canManage && <p className="mt-4 text-xs text-gray-500">{selectedRecordingReason ?? 'Staff can record a text submission on behalf of this learner. The submitting staff member will be recorded.'}</p>}
          {selectedAttempts.length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">All attempt history ({selectedAttempts.length})</h3>
              <div className="space-y-2">
                {selectedAttempts.map((attempt) => (
                  <details key={attempt.id} className="rounded-md border border-gray-200">
                    <summary className="cursor-pointer px-3 py-3 text-xs font-medium text-gray-700">Attempt {attempt.attempt}{attempt.id === selectedSubmission?.id ? ' · Latest' : ''} · {timestamp(attempt.submitted_at)} · {GRADING_STATUS_LABELS[attempt.grading_status]}{attempt.is_late ? ' · Late' : ''} · {attempt.score ?? '—'} / {assignment.points_possible}</summary>
                    <div className="border-t border-gray-100 p-4"><SubmissionReadOnly assignment={assignment} learner={selectedLearner} submission={attempt} /></div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {gradingLearner && gradingSubmission && (
        <GradeSubmissionModal key={gradingSubmission.id} assignment={assignment} learner={gradingLearner} submission={gradingSubmission} onClose={() => setGrading(null)} />
      )}
      {canManage && recordLearner && !recordingUnavailable(assignment, recordLearner, programme.status) && (
        <CourseworkSubmissionModal key={recordLearner.enrolment_id} assignment={assignment} enrolmentId={recordLearner.enrolment_id} onBehalf onClose={() => setRecordLearnerId(null)} onSaved={() => { setRecordLearnerId(null); void queryClient.invalidateQueries({ queryKey: ['coursework'] }); }} />
      )}
    </div>
  );
}
