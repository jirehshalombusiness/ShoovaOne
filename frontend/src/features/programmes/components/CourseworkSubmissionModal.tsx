import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { courseworkService, type CourseAssignment } from '@/services/coursework.service';
import { Field, inputClass, ModalShell } from './JourneyModal';

export function CourseworkSubmissionModal({ assignment, enrolmentId, onClose, onSaved, onBehalf = false }: {
  assignment: CourseAssignment;
  enrolmentId: string;
  onClose: () => void;
  onSaved?: () => void;
  onBehalf?: boolean;
}) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: () => courseworkService.submit(assignment.id, enrolmentId, content.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coursework'] });
      toast.success('Assignment submitted');
      onSaved?.();
      onClose();
    },
    onError: (err: any) => setError(typeof err?.response?.data?.detail === 'string' ? err.response.data.detail : 'Could not submit this assignment.'),
  });
  return (
    <ModalShell title={onBehalf ? 'Record learner submission' : 'Submit assignment'} subtitle={assignment.title}
      onClose={mutation.isPending ? () => {} : onClose} onSave={() => {
        if (!content.trim()) { setError('Enter the learner’s work before submitting.'); return; }
        mutation.mutate();
      }} isSaving={mutation.isPending} saveLabel={onBehalf ? 'Record submission' : 'Submit assignment'} wide>
      <div className="space-y-3">
        {onBehalf && <p className="text-xs text-amber-700 bg-amber-50 rounded p-3">You are recording work on behalf of this learner. Your name and the submission time will be recorded.</p>}
        {assignment.instructions && <p className="text-sm text-gray-700 whitespace-pre-wrap">{assignment.instructions}</p>}
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <Field label="Written submission *"><textarea aria-label="Written submission" className={inputClass} rows={9} value={content} onChange={(e) => setContent(e.target.value)} maxLength={20000} autoFocus placeholder="Enter the completed assignment, findings or reflection" /></Field>
        <p className="text-[11px] text-gray-500">Each attempt is retained. Submissions awaiting grading cannot be replaced.</p>
      </div>
    </ModalShell>
  );
}
