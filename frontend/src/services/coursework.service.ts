import { api } from './api';
import type { ProgrammePersonBrief } from './programmes.service';

// ============================================================
// Shared
// ============================================================

export interface RubricCriterion {
  id: string;
  label: string;
  points: number;
}

export type CourseworkStatus = 'draft' | 'published' | 'closed';
export type GradingStatus = 'submitted' | 'graded' | 'changes_requested';

// ============================================================
// Assignments
// ============================================================

export interface CourseAssignment {
  id: string;
  programme_id: string;
  course_id: string;
  course_title: string;
  cohort_id: string;
  cohort_name: string;
  title: string;
  instructions: string | null;
  due_on: string | null;
  points_possible: number;
  rubric: RubricCriterion[];
  allow_resubmission: boolean;
  status: CourseworkStatus;
  submitted_count: number;
  graded_count: number;
  missing_count: number;
}

export interface CourseworkPayload {
  course_id: string;
  cohort_id: string;
  title: string;
  instructions: string | null;
  due_on: string | null;
  points_possible: number;
  rubric: RubricCriterion[];
  allow_resubmission: boolean;
  status: CourseworkStatus;
}

// ============================================================
// Submissions
// ============================================================

export interface AssignmentSubmission {
  id: string;
  enrolment_id: string;
  attempt: number;
  content: string;
  submitted_at: string;
  submitted_by: ProgrammePersonBrief | null;
  score: number | null;
  feedback: string | null;
  rubric_scores: Record<string, number>;
  grading_status: GradingStatus;
  graded_by: ProgrammePersonBrief | null;
  graded_at: string | null;
  is_late: boolean;
}

export interface AssignmentLearner {
  enrolment_id: string;
  person: ProgrammePersonBrief;
  enrolment_status: string;
  submission: AssignmentSubmission | null;
  history: AssignmentSubmission[];
}

export interface AssignmentDetail {
  assignment: CourseAssignment;
  learners: AssignmentLearner[];
}

export interface GradePayload {
  score?: number | null;
  feedback?: string | null;
  rubric_scores?: Record<string, number>;
  request_resubmission?: boolean;
}

// ============================================================
// Learner view
// ============================================================

export interface LearnerCoursework {
  assignment: CourseAssignment;
  enrolment_id: string;
  programme_name: string;
  submission: AssignmentSubmission | null;
  history: AssignmentSubmission[];
}

// ============================================================
// Gradebook (matrix view) — used by ProgrammeGradebookPage
// ============================================================

export type GradebookCellStatus = 'missing' | GradingStatus;

export interface GradebookCell {
  assignment_id: string;
  submission_id: string | null;
  score: number | null;
  status: GradebookCellStatus;
  is_late: boolean;
}

export interface GradebookRow {
  enrolment_id: string;
  person: ProgrammePersonBrief;
  cohort_id: string;
  cohort_name: string;
  cells: GradebookCell[];
  earned_points: number;
  graded_points_possible: number;
  percentage: number | null;
  graded_count: number;
  assignment_count: number;

  // Aliases kept optional so ProgrammeGradebookPage's GradebookRowView
  // (which reads these names) works without modification.
  enrolment_status?: string;
  total_score?: number;
  total_possible?: number;
  assignments_graded?: number;
  assignments_total?: number;
}

/** @deprecated use GradebookResponse — kept for any caller still on the old shape. */
export interface Gradebook {
  assignments: CourseAssignment[];
  rows: GradebookRow[];
}

export interface GradebookColumn {
  assignment_id: string;
  title: string;
  course_title: string;
  cohort_name: string;
  points_possible: number;
  due_on: string | null;
  status: CourseworkStatus;
}

export interface GradebookResponse {
  programme_id: string;
  columns: GradebookColumn[];
  rows: GradebookRow[];
  total_points_possible: number;
}

// ============================================================
// Backend wire shape (what the API actually returns)
// ============================================================

interface BackendGradebookCell {
  assignment_id: string;
  submission_id: string | null;
  score: number | null;
  status: GradebookCellStatus;
  is_late: boolean;
}

interface BackendGradebookLearner {
  enrolment_id: string;
  person: ProgrammePersonBrief;
  cohort_id: string;
  cohort_name: string;
  cells: BackendGradebookCell[];
  earned_points: number;
  graded_points_possible: number;
  percentage: number | null;
  graded_count: number;
  assignment_count: number;
}

interface BackendGradebookAssignment {
  id: string;
  title: string;
  course_title: string;
  cohort_name: string;
  points_possible: number;
  due_on: string | null;
  status: CourseworkStatus;
}

interface BackendGradebookResponse {
  assignments: BackendGradebookAssignment[];
  learners: BackendGradebookLearner[];
}

// ============================================================
// Service
// ============================================================

export const courseworkService = {
  async list(programmeId: string): Promise<CourseAssignment[]> {
    const { data } = await api.get(`/programmes/${programmeId}/coursework`);
    return data;
  },

  async create(programmeId: string, payload: CourseworkPayload): Promise<CourseAssignment> {
    const { data } = await api.post(`/programmes/${programmeId}/coursework`, payload);
    return data;
  },

  async update(id: string, payload: Partial<CourseworkPayload>): Promise<CourseAssignment> {
    const { data } = await api.patch(`/programmes/coursework/${id}`, payload);
    return data;
  },

  async get(id: string): Promise<AssignmentDetail> {
    const { data } = await api.get(`/programmes/coursework/${id}`);
    return data;
  },

  async submit(id: string, enrolmentId: string, content: string): Promise<AssignmentSubmission> {
    const { data } = await api.post(`/programmes/coursework/${id}/submissions`, {
      enrolment_id: enrolmentId,
      content,
    });
    return data;
  },

  async grade(id: string, payload: GradePayload): Promise<AssignmentSubmission> {
    const { data } = await api.put(`/programmes/coursework/submissions/${id}/grade`, payload);
    return data;
  },

  /**
   * Gradebook for the whole programme — matrix layout.
   *
   * Backend returns { assignments, learners }. This adapter pivots that into
   * { programme_id, columns, rows, total_points_possible } so callers
   * (ProgrammeGradebookPage) get a column-per-assignment grid directly.
   */
  async getGradebook(programmeId: string): Promise<GradebookResponse> {
    const { data } = await api.get<BackendGradebookResponse>(
      `/programmes/${programmeId}/coursework/gradebook`,
    );

    const columns: GradebookColumn[] = data.assignments.map((a) => ({
      assignment_id: a.id,
      title: a.title,
      course_title: a.course_title,
      cohort_name: a.cohort_name,
      points_possible: a.points_possible,
      due_on: a.due_on,
      status: a.status,
    }));

    const rows: GradebookRow[] = data.learners.map((l) => ({
      enrolment_id: l.enrolment_id,
      person: l.person,
      cohort_id: l.cohort_id,
      cohort_name: l.cohort_name,
      cells: l.cells.map((c) => ({
        assignment_id: c.assignment_id,
        submission_id: c.submission_id,
        score: c.score,
        status: c.status,
        is_late: c.is_late,
      })),
      earned_points: l.earned_points,
      graded_points_possible: l.graded_points_possible,
      percentage: l.percentage,
      graded_count: l.graded_count,
      assignment_count: l.assignment_count,
      // Aliases consumed by ProgrammeGradebookPage.tsx
      enrolment_status: 'enrolled',
      total_score: l.earned_points,
      total_possible: l.graded_points_possible,
      assignments_graded: l.graded_count,
      assignments_total: l.assignment_count,
    }));

    const total_points_possible = columns.reduce(
      (sum, c) => sum + c.points_possible,
      0,
    );

    return {
      programme_id: programmeId,
      columns,
      rows,
      total_points_possible,
    };
  },

  /**
   * @deprecated legacy endpoint — the current backend serves the gradebook at
   * `/programmes/:id/coursework/gradebook` via getGradebook(). Kept only so
   * any caller still using `gradebook()` continues to compile.
   */
  async gradebook(programmeId: string): Promise<Gradebook> {
    const { data } = await api.get(`/programmes/${programmeId}/gradebook`);
    return data;
  },

  async forLearner(enrolmentId: string): Promise<LearnerCoursework[]> {
    const { data } = await api.get(`/programmes/enrolments/${enrolmentId}/coursework`);
    return data;
  },

  async mine(): Promise<LearnerCoursework[]> {
    const { data } = await api.get('/programmes/my/coursework');
    return data;
  },
};

// ============================================================
// Labels
// ============================================================

export const COURSEWORK_STATUS_LABELS: Record<CourseworkStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  closed: 'Closed',
};

export const GRADING_STATUS_LABELS: Record<GradingStatus | 'missing', string> = {
  missing: 'Not submitted',
  submitted: 'Awaiting grading',
  graded: 'Graded',
  changes_requested: 'Changes requested',
};