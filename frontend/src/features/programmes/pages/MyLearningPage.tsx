import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, CalendarDays, Printer } from 'lucide-react';
import { courseworkService, GRADING_STATUS_LABELS } from '@/services/coursework.service';
import { programmesService } from '@/services/programmes.service';
import { LearnerCourseworkList } from '../components/LearnerCourseworkList';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(`${value}T00:00:00`)) : '—';
}

function formatScore(value: number | null) {
  return value == null ? '—' : `${Number.isInteger(value) ? value : value.toFixed(1)} / 100`;
}

function statusStyle(status: string) {
  if (status === 'passed' || status === 'completed' || status === 'graded') {
    return 'bg-emerald-50 text-emerald-700';
  }
  if (status === 'failed' || status === 'withdrawn' || status === 'changes_requested') {
    return 'bg-rose-50 text-rose-700';
  }
  if (status === 'submitted') return 'bg-blue-50 text-blue-700';
  return 'bg-amber-50 text-amber-700';
}

export function MyLearningPage() {
  const performanceQuery = useQuery({
    queryKey: ['programmes', 'my-academic-performance'],
    queryFn: () => programmesService.myAcademicPerformance(),
  });
  const courseworkQuery = useQuery({
    queryKey: ['coursework', 'mine', undefined],
    queryFn: () => courseworkService.mine(),
  });

  const report = performanceQuery.data;
  const enrolments = report?.enrolments ?? [];
  const courses = enrolments.flatMap((enrolment) => enrolment.courses);
  const markedCourses = courses.filter((course) => course.score != null);
  const averageScore = markedCourses.length
    ? markedCourses.reduce((total, course) => total + course.score!, 0) / markedCourses.length
    : null;
  const assignments = courseworkQuery.data ?? [];
  const gradedAssignments = assignments.filter(
    (item) => item.submission?.grading_status === 'graded',
  );
  const courseworkPoints = gradedAssignments.reduce(
    (total, item) => total + (item.submission?.score ?? 0),
    0,
  );
  const courseworkPossible = gradedAssignments.reduce(
    (total, item) => total + item.assignment.points_possible,
    0,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          html, body { background: #fff !important; color: #111827 !important; }
          body * { visibility: hidden !important; }
          #academic-performance-report,
          #academic-performance-report * { visibility: visible !important; }
          #academic-performance-report {
            position: fixed !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .no-print { display: none !important; }
          .report-section, tr { break-inside: avoid; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #d1d5db; padding: 7px 5px; text-align: left; }
          thead { display: table-header-group; }
          .report-page-break { break-before: page; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <header className="flex flex-wrap items-end justify-between gap-4 no-print">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Student portal</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">My Learning</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track your academic results and coursework in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!report || performanceQuery.isLoading || courseworkQuery.isLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </button>
      </header>

      {performanceQuery.isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Loading your academic record…
        </div>
      ) : performanceQuery.isError || !report ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-700">
          <p>We could not load your academic record.</p>
          <button
            type="button"
            onClick={() => void performanceQuery.refetch()}
            disabled={performanceQuery.isFetching}
            className="mt-3 font-semibold underline disabled:opacity-50"
          >
            {performanceQuery.isFetching ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      ) : (
        <>
          <section
            id="academic-performance-report"
            className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8"
          >
            <div className="report-section flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Shoova One</p>
                <h2 className="mt-2 text-2xl font-bold text-gray-900">Academic Performance Report</h2>
                <p className="mt-1 text-sm text-gray-600">
                  {report.student.first_name} {report.student.last_name}
                </p>
                {report.student.email && (
                  <p className="text-sm text-gray-500">{report.student.email}</p>
                )}
              </div>
              <div className="text-sm text-gray-500">
                <p>Generated {dateFormatter.format(new Date(report.generated_at))}</p>
                <p>{enrolments.length} programme{enrolments.length === 1 ? '' : 's'} on record</p>
              </div>
            </div>

            <div className="report-section grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                icon={<BookOpen className="h-4 w-4" />}
                label="Courses"
                value={`${markedCourses.length} / ${courses.length}`}
                detail="with recorded scores"
              />
              <SummaryCard
                icon={<Award className="h-4 w-4" />}
                label="Average course score"
                value={averageScore == null ? '—' : `${averageScore.toFixed(1)}%`}
                detail="across scored courses"
              />
              <SummaryCard
                icon={<CalendarDays className="h-4 w-4" />}
                label="Coursework graded"
                value={courseworkQuery.isLoading ? '…' : `${gradedAssignments.length} / ${assignments.length}`}
                detail="published assignments"
              />
              <SummaryCard
                icon={<Award className="h-4 w-4" />}
                label="Coursework points"
                value={courseworkQuery.isLoading ? '…' : courseworkPossible ? `${courseworkPoints} / ${courseworkPossible}` : '—'}
                detail="graded submissions only"
              />
            </div>

            {enrolments.length === 0 ? (
              <div className="report-section rounded-lg border border-dashed border-gray-300 p-8 text-center">
                <BookOpen className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-3 font-medium text-gray-800">No programme enrolments found</p>
                <p className="mt-1 text-sm text-gray-500">
                  Your academic results will appear here when you are enrolled in a programme.
                </p>
              </div>
            ) : enrolments.map((enrolment) => {
              const coursework = assignments.filter(
                (item) => item.enrolment_id === enrolment.enrolment_id,
              );
              return (
                <section key={enrolment.enrolment_id} className="report-section space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{enrolment.programme_name}</h3>
                      <p className="text-sm text-gray-500">{enrolment.cohort_name}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle(enrolment.status)}`}>
                      {enrolment.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                    <span>Enrolled: {formatDate(enrolment.enrolled_on)}</span>
                    <span>Completed: {formatDate(enrolment.completed_on)}</span>
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-gray-800">Course results</h4>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                          <tr>
                            <th className="px-3 py-2">Course</th>
                            <th className="px-3 py-2">Score</th>
                            <th className="px-3 py-2">Grade</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {enrolment.courses.map((course) => (
                            <tr key={course.course_id}>
                              <td className="px-3 py-2.5">
                                <span className="font-medium text-gray-800">{course.course_title}</span>
                                {course.course_code && (
                                  <span className="ml-2 text-xs text-gray-500">{course.course_code}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 tabular-nums text-gray-700">{formatScore(course.score)}</td>
                              <td className="px-3 py-2.5 text-gray-700">{course.grade || '—'}</td>
                              <td className="px-3 py-2.5">
                                <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${statusStyle(course.status)}`}>
                                  {course.status.replaceAll('_', ' ')}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {enrolment.courses.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-3 py-5 text-center text-sm text-gray-500">
                                No courses have been added to this programme yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {coursework.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-gray-800">Coursework results</h4>
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                              <th className="px-3 py-2">Assignment</th>
                              <th className="px-3 py-2">Course</th>
                              <th className="px-3 py-2">Score</th>
                              <th className="px-3 py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {coursework.map((item) => (
                              <tr key={item.assignment.id}>
                                <td className="px-3 py-2.5 font-medium text-gray-800">{item.assignment.title}</td>
                                <td className="px-3 py-2.5 text-gray-700">{item.assignment.course_title}</td>
                                <td className="px-3 py-2.5 tabular-nums text-gray-700">
                                  {item.submission?.score == null
                                    ? '—'
                                    : `${item.submission.score} / ${item.assignment.points_possible}`}
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusStyle(item.submission?.grading_status ?? 'missing')}`}>
                                    {GRADING_STATUS_LABELS[item.submission?.grading_status ?? 'missing']}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}

            {courseworkQuery.isError && (
              <p className="text-sm text-amber-700">
                Coursework scores are temporarily unavailable. Retry the page to include them in your report.
              </p>
            )}
            <p className="border-t border-gray-200 pt-4 text-xs text-gray-500">
              This report reflects academic records available at the time it was generated.
            </p>
          </section>

          <section className="no-print space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Assignments and feedback</h2>
              <p className="mt-1 text-sm text-gray-500">
                Review submissions, instructor feedback, and upcoming coursework.
              </p>
            </div>
            <LearnerCourseworkList />
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs text-gray-500">{detail}</p>
    </div>
  );
}
