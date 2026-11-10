import { useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  courseworkService,
  type AssignmentLearner,
  type AssignmentSubmission,
  type CourseAssignment,
  type GradePayload,
} from '@/services/coursework.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { useAuth } from '@/lib/auth';
import { Field, inputClass } from './JourneyModal';

function detailMessage(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    return value.map(detailMessage).filter(Boolean).join('; ') || null;
  }
  if (value && typeof value === 'object') {
    const detail = value as Record<string, unknown>;
    return detailMessage(detail.msg ?? detail.message ?? detail.detail);
  }
  return null;
}

// API validation details can be arrays of objects, never React children.
export function courseworkErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    return detailMessage(error.response?.data?.detail) ?? fallback;
  }
  return error instanceof Error ? error.message || fallback : fallback;
}

export function GradeSubmissionModal({
  assignment,
  learner,
  submission,
  onClose,
  onSaved,
}: {
  assignment: CourseAssignment;
  learner: AssignmentLearner;
  submission: AssignmentSubmission;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const canAssess = useHRAccess().has('programmes.assess');
  const { user } = useAuth();
  const titleId = useId();
  const errorId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(submission.score?.toString() ?? '');
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [requestChanges, setRequestChanges] = useState(false);
  const [useRubric, setUseRubric] = useState(assignment.rubric.length > 0);
  const [rubricScores, setRubricScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      assignment.rubric.map((criterion) => [
        criterion.id,
        submission.rubric_scores[criterion.id]?.toString() ?? '',
      ]),
    ),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const latest = learner.submission;
  const blockedReason = !canAssess
    ? 'You do not have permission to grade submissions.'
    : !latest || latest.id !== submission.id || learner.history.some((attempt) => attempt.attempt > submission.attempt)
      ? 'Only the latest submission can be graded. Close this window and review the latest attempt.'
      : submission.enrolment_id !== learner.enrolment_id
        ? 'This submission does not belong to the selected learner.'
        : user?.person_id === learner.person.id
          ? 'You cannot grade your own submission.'
          : null;

  const mutation = useMutation({
    mutationFn: (payload: GradePayload) => courseworkService.grade(submission.id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['coursework'] });
      toast.success(requestChanges ? 'Changes requested' : 'Grade saved');
      onSaved?.();
      onClose();
    },
    onError: (error: unknown) => {
      const message = courseworkErrorMessage(error, 'Failed to save the grade. Please try again.');
      setSaveError(message);
      toast.error(message);
    },
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const firstInput = dialogRef.current?.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), button:not(:disabled)');
    firstInput?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  const close = () => {
    if (!mutation.isPending) onClose();
  };

  const save = () => {
    if (mutation.isPending || blockedReason) return;
    setValidationError(null);
    setSaveError(null);
    const trimmedFeedback = feedback.trim();
    if (requestChanges) {
      if (!trimmedFeedback) {
        setValidationError('Explain the requested changes in the feedback.');
        return;
      }
      // A changes request must not send a score or rubric scores.
      mutation.mutate({ feedback: trimmedFeedback, request_resubmission: true });
      return;
    }

    let total = 0;
    const criterionScores: Record<string, number> = {};
    if (useRubric && assignment.rubric.length > 0) {
      for (const criterion of assignment.rubric) {
        const raw = rubricScores[criterion.id]?.trim() ?? '';
        const value = Number(raw);
        if (!raw || !Number.isFinite(value) || value < 0 || value > criterion.points) {
          setValidationError(`Enter a score between 0 and ${criterion.points} for ${criterion.label}.`);
          return;
        }
        criterionScores[criterion.id] = value;
        total += value;
      }
      total = Number(total.toFixed(10));
    } else {
      if (!score.trim()) {
        setValidationError('Enter a score before saving the grade.');
        return;
      }
      total = Number(score);
    }
    if (!Number.isFinite(total) || total < 0 || total > assignment.points_possible) {
      setValidationError(`The total score must be between 0 and ${assignment.points_possible}.`);
      return;
    }
    mutation.mutate({
      score: total,
      rubric_scores: criterionScores,
      feedback: trimmedFeedback || null,
      request_resubmission: false,
    });
  };

  const previewTotal = assignment.rubric.reduce((total, criterion) => {
    const value = Number(rubricScores[criterion.id]);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
  const error = blockedReason ?? validationError ?? saveError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={error ? errorId : undefined}
        aria-busy={mutation.isPending}
        className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            close();
          }
          if (event.key === 'Tab') {
            const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)');
            if (!controls?.length) {
              event.preventDefault();
              return;
            }
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-gray-900">Grade submission</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {learner.person.first_name} {learner.person.last_name} · Attempt {submission.attempt} · {assignment.title}
            </p>
          </div>
          <button type="button" onClick={close} disabled={mutation.isPending} aria-label="Close grading dialog" className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <fieldset disabled={mutation.isPending || !!blockedReason} className="min-w-0 space-y-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" aria-label="Request changes instead of grading" checked={requestChanges} onChange={(event) => { setRequestChanges(event.target.checked); setValidationError(null); }} className="accent-primary" />
              Request changes instead of grading
            </label>
            {requestChanges ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">The learner can submit a new attempt. No score will be recorded for this changes request.</p>
            ) : (
              <div className="space-y-3">
                {assignment.rubric.length > 0 && (
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input type="checkbox" aria-label="Use rubric criteria to calculate score" checked={useRubric} onChange={(event) => { setUseRubric(event.target.checked); setValidationError(null); }} className="accent-primary" />
                    Use rubric criteria to calculate the score
                  </label>
                )}
                {useRubric && assignment.rubric.length > 0 ? (
                  <div className="space-y-3">
                    {assignment.rubric.map((criterion) => (
                      <Field key={criterion.id} label={`${criterion.label} (maximum ${criterion.points})`}>
                        <input type="number" aria-label={`Score for ${criterion.label}`} min={0} max={criterion.points} step="any" required value={rubricScores[criterion.id] ?? ''} onChange={(event) => setRubricScores((previous) => ({ ...previous, [criterion.id]: event.target.value }))} className={inputClass} />
                      </Field>
                    ))}
                    <p className="text-sm font-semibold text-gray-900" aria-live="polite">Total: {Number(previewTotal.toFixed(10))} / {assignment.points_possible}</p>
                  </div>
                ) : (
                  <Field label={`Score (maximum ${assignment.points_possible})`}>
                    <input type="number" aria-label="Submission score" min={0} max={assignment.points_possible} step="any" required value={score} onChange={(event) => setScore(event.target.value)} className={inputClass} />
                  </Field>
                )}
              </div>
            )}
            <Field label={requestChanges ? 'Feedback (required)' : 'Feedback for the learner'}>
              <textarea aria-label="Feedback for the learner" required={requestChanges} value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={5} className={inputClass} placeholder="Describe strengths and any improvements needed" />
            </Field>
          </fieldset>
          {error && <p id={errorId} role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4">
          <button type="button" onClick={close} disabled={mutation.isPending} className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50">Cancel</button>
          {canAssess && !blockedReason && (
            <button type="button" onClick={save} disabled={mutation.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
              {mutation.isPending ? 'Saving…' : requestChanges ? 'Request changes' : 'Save grade'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
