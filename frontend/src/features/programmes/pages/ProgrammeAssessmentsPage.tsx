import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { courseworkService, COURSEWORK_STATUS_LABELS, type CourseAssignment, type CourseworkPayload } from '@/services/coursework.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { useProgrammeWorkspace } from '../programmeWorkspace';
import { CourseAssignmentModal } from '../components/CourseAssignmentModal';
import { formatDate } from '../programmeUtils';

export function ProgrammeAssessmentsPage() {
  const { programme, canManage } = useProgrammeWorkspace();
  const access = useHRAccess();
  const canReview = canManage || access.has('programmes.assess');
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<CourseAssignment | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [status, setStatus] = useState('');
  const { data: assignments = [], isLoading, error, refetch } = useQuery({
    queryKey: ['coursework', 'list', programme.id],
    queryFn: () => courseworkService.list(programme.id),
  });
  const save = useMutation({
    mutationFn: (payload: Partial<CourseworkPayload>) => modal && modal !== 'new'
      ? courseworkService.update(modal.id, payload)
      : courseworkService.create(programme.id, payload as CourseworkPayload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coursework'] });
      setModal(null);
      toast.success('Assignment saved');
    },
    onError: (err: any) => toast.error(typeof err?.response?.data?.detail === 'string' ? err.response.data.detail : 'Could not save this assignment. Check the required fields.'),
  });
  const filtered = assignments.filter((a) => (!courseId || a.course_id === courseId) && (!cohortId || a.cohort_id === cohortId)
    && (!status || a.status === status) && `${a.title} ${a.course_title}`.toLowerCase().includes(search.toLowerCase()));
  const selectClass = 'px-3 py-2 text-xs border border-gray-200 rounded-md bg-white';
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="text-xl font-bold text-gray-900">Assessments</h1><p className="text-sm text-gray-500 mt-1">Course assignments, submissions and marking</p></div>
        {canManage && <button onClick={() => setModal('new')} disabled={!programme.courses.length || !programme.cohorts.length} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-white px-3 py-2 text-xs font-medium disabled:opacity-50"><Plus className="w-4 h-4" />Create assignment</button>}
      </div>
      {canManage && (!programme.courses.length || !programme.cohorts.length) && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-md">Add a course in Curriculum and a cohort in Cohorts before creating assignments.</p>}
      <div className="flex gap-2 flex-wrap">
        <input aria-label="Search assignments" placeholder="Search assignments…" value={search} onChange={(e) => setSearch(e.target.value)} className={`${selectClass} flex-1 min-w-40`} />
        <select aria-label="Filter assignments by course" value={courseId} onChange={(e) => setCourseId(e.target.value)} className={selectClass}><option value="">All courses</option>{programme.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
        <select aria-label="Filter assignments by cohort" value={cohortId} onChange={(e) => setCohortId(e.target.value)} className={selectClass}><option value="">All cohorts</option>{programme.cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select aria-label="Filter assignment availability" value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}><option value="">All statuses</option>{Object.entries(COURSEWORK_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      </div>
      {isLoading ? <p className="text-sm text-gray-500">Loading assignments…</p> : error ? <div role="alert" className="text-sm text-red-700">Could not load assignments. <button className="underline" onClick={() => refetch()}>Retry</button></div> : filtered.length === 0 ? <div className="bg-white border border-gray-200 rounded-lg py-12 text-center"><ClipboardCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-700">{assignments.length ? 'No assignments match these filters' : 'No assignments yet'}</p><p className="text-xs text-gray-500 mt-1">{assignments.length ? 'Try widening your search.' : 'Create an assignment, publish it, then review learner submissions.'}</p></div> : (
        <div className="space-y-3">{filtered.map((assignment) => <article key={assignment.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3"><div><span className="text-[10px] uppercase tracking-wide font-semibold text-gray-500">{COURSEWORK_STATUS_LABELS[assignment.status]}</span><h2 className="text-sm font-semibold text-gray-900 mt-1">{assignment.title}</h2><p className="text-xs text-gray-500 mt-1">{assignment.course_title} · {assignment.cohort_name}</p></div>{canManage && <button className="text-xs text-primary font-medium" onClick={() => setModal(assignment)}>Edit assignment</button>}</div>
          {assignment.instructions && <p className="mt-2 text-xs text-gray-600 line-clamp-2">{assignment.instructions}</p>}
          <div className="flex items-center gap-x-4 gap-y-2 flex-wrap mt-3 text-xs text-gray-500"><span>{assignment.points_possible} points</span><span>Due {assignment.due_on ? formatDate(assignment.due_on) : 'not set'}</span>{assignment.rubric.length > 0 && <span>{assignment.rubric.length} rubric criteria</span>}{canReview && <><span>{assignment.submitted_count} submitted</span><span>{assignment.graded_count} graded</span><span>{assignment.missing_count} not submitted</span></>}{canReview && <Link className="text-primary font-medium ml-auto" to={`/programmes/${programme.id}/assessments/${assignment.id}`}>Review submissions</Link>}</div>
        </article>)}</div>
      )}
      {modal && <CourseAssignmentModal programme={programme} initial={modal === 'new' ? undefined : modal} isSaving={save.isPending} onClose={() => setModal(null)} onSave={(payload) => save.mutate(payload)} />}
    </div>
  );
}
