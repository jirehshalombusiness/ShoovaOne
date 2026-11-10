import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { courseworkService, GRADING_STATUS_LABELS, type LearnerCoursework } from '@/services/coursework.service';
import { CourseworkSubmissionModal } from './CourseworkSubmissionModal';
import { formatDate } from '../programmeUtils';

export function LearnerCourseworkList({ enrolmentId, canSubmit = true, onBehalf = false, canReview = false }: {
  enrolmentId?: string;
  canSubmit?: boolean;
  onBehalf?: boolean;
  canReview?: boolean;
}) {
  const [submitting, setSubmitting] = useState<LearnerCoursework | null>(null);
  const { data: items = [], isLoading, error, refetch } = useQuery({
    queryKey: ['coursework', enrolmentId ? 'learner' : 'mine', enrolmentId],
    queryFn: () => enrolmentId ? courseworkService.forLearner(enrolmentId) : courseworkService.mine(),
  });
  return (
    <div className="space-y-3">
      {isLoading ? <p className="text-sm text-gray-500 p-4">Loading coursework…</p> : error ? <div role="alert" className="text-sm text-red-700 p-4">Could not load coursework. <button onClick={() => refetch()} className="underline">Retry</button></div> : items.length === 0 ? <p className="text-sm text-gray-500 p-4">No published assignments for this learner yet.</p> : items.map((item) => {
        const { assignment, submission } = item;
        const maySubmit = canSubmit && assignment.status === 'published' && (!submission || submission.grading_status === 'changes_requested' || (submission.grading_status === 'graded' && assignment.allow_resubmission));
        return <article key={`${assignment.id}-${item.enrolment_id}`} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap"><div><h3 className="text-sm font-semibold text-gray-900">{assignment.title}</h3><p className="text-xs text-gray-500 mt-1">{item.programme_name} · {assignment.course_title} · {assignment.cohort_name}</p></div><span className="text-xs font-semibold text-gray-600">{GRADING_STATUS_LABELS[submission?.grading_status ?? 'missing']}</span></div>
          <p className="text-xs text-gray-500">{assignment.points_possible} points · Due {assignment.due_on ? formatDate(assignment.due_on) : 'not set'}{assignment.status === 'closed' ? ' · Closed' : ''}{submission?.is_late ? ' · Late submission' : ''}</p>
          {assignment.instructions && <p className="text-sm text-gray-700 whitespace-pre-wrap">{assignment.instructions}</p>}
          {assignment.rubric.length > 0 && <ul className="text-xs text-gray-600 space-y-1">{assignment.rubric.map((r) => <li key={r.id}>{r.label}: {submission?.rubric_scores[r.id] != null ? `${submission.rubric_scores[r.id]} / ` : ''}{r.points} points</li>)}</ul>}
          {submission && <div className="bg-gray-50 rounded-md p-3 space-y-2"><p className="text-xs text-gray-500">Attempt {submission.attempt} · {new Date(submission.submitted_at).toLocaleString()}</p><p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{submission.content}</p>{submission.score != null && <p className="text-sm font-semibold text-primary">Score: {submission.score} / {assignment.points_possible}</p>}{submission.feedback && <p className="text-sm text-gray-700 whitespace-pre-wrap"><span className="font-semibold">Feedback: </span>{submission.feedback}</p>}{submission.graded_by && <p className="text-xs text-gray-500">Marked by {submission.graded_by.first_name} {submission.graded_by.last_name}</p>}</div>}
          {item.history.length > 1 && <details className="text-xs text-gray-600"><summary className="cursor-pointer font-medium">Previous attempts ({item.history.length - 1})</summary><div className="mt-2 space-y-3">{item.history.filter((s) => s.id !== submission?.id).map((s) => <div key={s.id} className="border-l-2 border-gray-200 pl-3"><p className="font-medium">Attempt {s.attempt} · {GRADING_STATUS_LABELS[s.grading_status]}{s.score != null ? ` · ${s.score}/${assignment.points_possible}` : ''}</p><p className="whitespace-pre-wrap mt-1 break-words">{s.content}</p>{s.feedback && <p className="whitespace-pre-wrap mt-1">Feedback: {s.feedback}</p>}</div>)}</div></details>}
          <div className="flex items-center gap-3">{maySubmit && <button onClick={() => setSubmitting(item)} className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-md">{submission ? 'Submit another attempt' : onBehalf ? 'Record submission' : 'Submit assignment'}</button>}{canReview && <Link className="text-xs font-medium text-primary" to={`/programmes/${assignment.programme_id}/assessments/${assignment.id}`}>Open grading</Link>}</div>
        </article>;
      })}
      {submitting && <CourseworkSubmissionModal assignment={submitting.assignment} enrolmentId={submitting.enrolment_id} onBehalf={onBehalf} onClose={() => setSubmitting(null)} />}
    </div>
  );
}
