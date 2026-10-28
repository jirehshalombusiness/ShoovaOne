import { api } from './api';

// ============================================================
// TYPES
// ============================================================

export type ProgrammeLevel =
  | 'certificate'
  | 'diploma'
  | 'degree'
  | 'short_course'
  | 'other';

export type ProgrammeStatus = 'draft' | 'active' | 'completed' | 'archived';
export type CohortStatus =
  | 'planned'
  | 'enrolling'
  | 'active'
  | 'completed'
  | 'cancelled';
export type DeliveryMode = 'in_person' | 'online' | 'hybrid';
export type InstructorRole = 'lead' | 'instructor';
export type EnrolmentStatus = 'enrolled' | 'completed' | 'withdrawn';
export type ResultStatus = 'pending' | 'passed' | 'failed';

export interface ProgrammePersonBrief {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  profile_image_url?: string | null;
}

export interface ProgrammeCourse {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  sequence: number;
  contact_hours: number | null;
  learning_outcomes: string | null;
  is_optional: boolean;
}

export interface CohortSummary {
  id: string;
  programme_id: string;
  name: string;
  code: string | null;
  start_date: string | null;
  end_date: string | null;
  capacity: number | null;
  delivery_mode: DeliveryMode;
  location: string | null;
  status: CohortStatus;
  enrolled_count: number;
  instructor_count: number;
}

export interface ProgrammeSummary {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: ProgrammeStatus;
  level: ProgrammeLevel | null;
  duration_weeks: number | null;
  organisation_id: string;
  organisation_name: string | null;
  department_id: string | null;
  department_name: string | null;
  lead: ProgrammePersonBrief | null;
  start_date: string | null;
  end_date: string | null;
  course_count: number;
  cohort_count: number;
  learner_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProgrammeDetail extends ProgrammeSummary {
  learning_outcomes: string | null;
  courses: ProgrammeCourse[];
  cohorts: CohortSummary[];
}

export interface EnrolmentResult {
  course_id: string;
  course_title: string;
  score: number | null;
  grade: string | null;
  status: ResultStatus;
}

export interface CohortEnrolment {
  id: string;
  person: ProgrammePersonBrief;
  status: EnrolmentStatus;
  enrolled_on: string | null;
  completed_on: string | null;
  notes: string | null;
  results: EnrolmentResult[];
}

export interface CohortInstructor {
  person: ProgrammePersonBrief;
  role: InstructorRole;
}

export interface CohortDetail extends CohortSummary {
  programme_name: string;
  notes: string | null;
  enrolment_opens_on: string | null;
  enrolment_closes_on: string | null;
  courses: ProgrammeCourse[];
  instructors: CohortInstructor[];
  enrolments: CohortEnrolment[];
}

export interface ProgrammeListParams {
  status?: ProgrammeStatus;
  level?: ProgrammeLevel;
  department_id?: string;
  organisation_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ProgrammePayload {
  name: string;
  code?: string | null;
  description?: string | null;
  organisation_id?: string;
  department_id?: string | null;
  level?: ProgrammeLevel | null;
  duration_weeks?: number | null;
  learning_outcomes?: string | null;
  lead_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface CoursePayload {
  code?: string | null;
  title?: string;
  description?: string | null;
  sequence?: number;
  contact_hours?: number | null;
  learning_outcomes?: string | null;
  is_optional?: boolean;
}

export interface CohortPayload {
  name?: string;
  code?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  enrolment_opens_on?: string | null;
  enrolment_closes_on?: string | null;
  capacity?: number | null;
  delivery_mode?: DeliveryMode;
  location?: string | null;
  status?: CohortStatus;
  notes?: string | null;
}

export interface ResultPayload {
  score?: number | null;
  grade?: string | null;
  status: ResultStatus;
}

// ============================================================
// SERVICE
// ============================================================

export const programmesService = {
  async list(params?: ProgrammeListParams): Promise<ProgrammeSummary[]> {
    const { data } = await api.get<ProgrammeSummary[]>('/programmes', {
      params,
    });
    return data;
  },

  async get(id: string): Promise<ProgrammeDetail> {
    const { data } = await api.get<ProgrammeDetail>(`/programmes/${id}`);
    return data;
  },

  async create(payload: ProgrammePayload): Promise<ProgrammeDetail> {
    const { data } = await api.post<ProgrammeDetail>('/programmes', payload);
    return data;
  },

  async update(
    id: string,
    payload: Partial<ProgrammePayload>,
  ): Promise<ProgrammeDetail> {
    const { data } = await api.patch<ProgrammeDetail>(
      `/programmes/${id}`,
      payload,
    );
    return data;
  },

  async changeStatus(id: string, status: ProgrammeStatus): Promise<ProgrammeDetail> {
    const { data } = await api.post<ProgrammeDetail>(
      `/programmes/${id}/status`,
      { status },
    );
    return data;
  },

  // ---------- CURRICULUM ----------

  async addCourse(
    programmeId: string,
    payload: CoursePayload & { title: string },
  ): Promise<ProgrammeDetail> {
    const { data } = await api.post<ProgrammeDetail>(
      `/programmes/${programmeId}/courses`,
      payload,
    );
    return data;
  },

  async updateCourse(
    programmeId: string,
    courseId: string,
    payload: CoursePayload,
  ): Promise<ProgrammeDetail> {
    const { data } = await api.patch<ProgrammeDetail>(
      `/programmes/${programmeId}/courses/${courseId}`,
      payload,
    );
    return data;
  },

  async deleteCourse(
    programmeId: string,
    courseId: string,
  ): Promise<ProgrammeDetail> {
    const { data } = await api.delete<ProgrammeDetail>(
      `/programmes/${programmeId}/courses/${courseId}`,
    );
    return data;
  },

  async reorderCourses(
    programmeId: string,
    courseIds: string[],
  ): Promise<ProgrammeDetail> {
    const { data } = await api.put<ProgrammeDetail>(
      `/programmes/${programmeId}/courses/order`,
      { course_ids: courseIds },
    );
    return data;
  },

  // ---------- COHORTS ----------

  async createCohort(
    programmeId: string,
    payload: CohortPayload & { name: string },
  ): Promise<ProgrammeDetail> {
    const { data } = await api.post<ProgrammeDetail>(
      `/programmes/${programmeId}/cohorts`,
      payload,
    );
    return data;
  },

  async getCohort(cohortId: string): Promise<CohortDetail> {
    const { data } = await api.get<CohortDetail>(
      `/programmes/cohorts/${cohortId}`,
    );
    return data;
  },

  async updateCohort(
    cohortId: string,
    payload: CohortPayload,
  ): Promise<CohortDetail> {
    const { data } = await api.patch<CohortDetail>(
      `/programmes/cohorts/${cohortId}`,
      payload,
    );
    return data;
  },

  async addInstructor(
    cohortId: string,
    personId: string,
    role: InstructorRole = 'instructor',
  ): Promise<CohortDetail> {
    const { data } = await api.post<CohortDetail>(
      `/programmes/cohorts/${cohortId}/instructors`,
      { person_id: personId, role },
    );
    return data;
  },

  async removeInstructor(
    cohortId: string,
    personId: string,
  ): Promise<CohortDetail> {
    const { data } = await api.delete<CohortDetail>(
      `/programmes/cohorts/${cohortId}/instructors/${personId}`,
    );
    return data;
  },

  // ---------- ENROLMENTS ----------

  async enrol(
    cohortId: string,
    personIds: string[],
    enrolledOn?: string,
  ): Promise<CohortDetail> {
    const { data } = await api.post<CohortDetail>(
      `/programmes/cohorts/${cohortId}/enrolments`,
      { person_ids: personIds, enrolled_on: enrolledOn },
    );
    return data;
  },

  async updateEnrolment(
    enrolmentId: string,
    payload: {
      status?: EnrolmentStatus;
      completed_on?: string | null;
      notes?: string | null;
    },
  ): Promise<CohortEnrolment> {
    const { data } = await api.patch<CohortEnrolment>(
      `/programmes/enrolments/${enrolmentId}`,
      payload,
    );
    return data;
  },

  async removeEnrolment(enrolmentId: string): Promise<CohortDetail> {
    const { data } = await api.delete<CohortDetail>(
      `/programmes/enrolments/${enrolmentId}`,
    );
    return data;
  },

  // ---------- RESULTS ----------

  async recordResult(
    enrolmentId: string,
    courseId: string,
    payload: ResultPayload,
  ): Promise<CohortEnrolment> {
    const { data } = await api.put<CohortEnrolment>(
      `/programmes/enrolments/${enrolmentId}/results/${courseId}`,
      payload,
    );
    return data;
  },

  async removeResult(
    enrolmentId: string,
    courseId: string,
  ): Promise<CohortEnrolment> {
    const { data } = await api.delete<CohortEnrolment>(
      `/programmes/enrolments/${enrolmentId}/results/${courseId}`,
    );
    return data;
  },
};

// ============================================================
// LABELS
// ============================================================

export const PROGRAMME_LEVEL_LABELS: Record<ProgrammeLevel, string> = {
  certificate: 'Certificate',
  diploma: 'Diploma',
  degree: 'Degree',
  short_course: 'Short course',
  other: 'Other',
};

export const PROGRAMME_STATUS_LABELS: Record<ProgrammeStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
};

export const COHORT_STATUS_LABELS: Record<CohortStatus, string> = {
  planned: 'Planned',
  enrolling: 'Enrolling',
  active: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const DELIVERY_MODE_LABELS: Record<DeliveryMode, string> = {
  in_person: 'In person',
  online: 'Online',
  hybrid: 'Hybrid',
};
