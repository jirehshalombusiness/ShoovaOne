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
}

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
   * Gradebook for the whole programme — matrix layout (columns = assignments,
   * rows = learners). Feeds ProgrammeGradebookPage.
   */
  async getGradebook(programmeId: string): Promise<GradebookResponse> {
    const { data } = await api.get<GradebookResponse>(
      `/programmes/${programmeId}/coursework/gradebook`,
    );
    return data;
  },

  /**
   * LEGACY — same shape as before, distinct endpoint, still used by any
   * caller that depends on { assignments, rows }. Remove once no page
   * uses it.
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