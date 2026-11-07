import { api } from './api';
import type { ProgrammePersonBrief } from './programmes.service';

// ============================================================
// TYPES
// ============================================================

export type AssignmentStatus =
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'completed'
  | 'follow_up';

export type TaskStatus = 'assigned' | 'in_progress' | 'submitted' | 'completed';

export type EvidenceType =
  | 'photo'
  | 'document'
  | 'note'
  | 'observation'
  | 'gps'
  | 'artifact';

export type CompetencyResult = 'met' | 'partially_met' | 'not_met';
export type EvidenceQuality = 'strong' | 'adequate' | 'weak';
export type VulnerabilityClass = 'low' | 'moderate' | 'high';
export type AffordTraining = 'yes' | 'no' | 'with_assistance';
export type Readiness =
  | 'not_started'
  | 'in_progress'
  | 'ready_for_completion'
  | 'completed';

export interface CourseBrief {
  id: string;
  code: string | null;
  title: string;
  learning_outcomes: string | null;
}

export interface BaselineItem {
  household_income_band: string | null;
  employment_status: string | null;
  can_afford_training: AffordTraining | null;
  device_access: string | null;
  internet_access: string | null;
  transport_constraints: string | null;
  education_status: string | null;
  household_dependents: number | null;
  vulnerability_class: VulnerabilityClass | null;
  notes: string | null;
  recorded_by: ProgrammePersonBrief | null;
  recorded_on: string | null;
}

export interface AssessmentItem {
  id: string;
  mentor: ProgrammePersonBrief;
  assessed_on: string | null;
  competency_result: CompetencyResult;
  feedback: string | null;
  follow_up: string | null;
  evidence_quality: EvidenceQuality | null;
  created_at: string | null;
}

export interface EvidenceItem {
  id: string;
  evidence_type: EvidenceType;
  document_id: string | null;
  document_name: string | null;
  file_url: string | null;
  field_notes: string | null;
  reflection: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  location_label: string | null;
  recorded_on: string | null;
  submitted_by: ProgrammePersonBrief | null;
  assessments: AssessmentItem[];
}

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  instructions: string | null;
  safety_requirements: string | null;
  expected_evidence: string | null;
  due_on: string | null;
  status: TaskStatus;
  completed_on: string | null;
  evidence: EvidenceItem[];
}

export interface AssignmentItem {
  id: string;
  course: CourseBrief;
  competency: string;
  assigned_on: string | null;
  due_on: string | null;
  status: AssignmentStatus;
  next_action: string | null;
  completed_on: string | null;
  tasks: TaskItem[];
}

export interface OutcomeItem {
  demonstrated_skills: string | null;
  field_outputs: string | null;
  further_training: string | null;
  placement_status: string | null;
  follow_up_status: string | null;
  follow_up_on: string | null;
  notes: string | null;
}

export interface ProgressSummary {
  assignments_total: number;
  competencies_completed: number;
  competencies_pending: number;
  next_module: string | null;
  next_action: string | null;
  readiness: Readiness;
}

export interface JourneyResponse {
  enrolment_id: string;
  person: ProgrammePersonBrief;
  cohort_id: string;
  cohort_name: string;
  programme_id: string;
  programme_name: string;
  status: string;
  enrolled_on: string | null;
  completed_on: string | null;
  can_view_baseline: boolean;
  baseline: BaselineItem | null;
  assignments: AssignmentItem[];
  progress: ProgressSummary;
  outcome: OutcomeItem | null;
}

export interface BaselinePayload {
  household_income_band?: string | null;
  employment_status?: string | null;
  can_afford_training?: AffordTraining | null;
  device_access?: string | null;
  internet_access?: string | null;
  transport_constraints?: string | null;
  education_status?: string | null;
  household_dependents?: number | null;
  vulnerability_class?: VulnerabilityClass | null;
  notes?: string | null;
  recorded_on?: string | null;
}

export interface AssignmentCreatePayload {
  course_id: string;
  competency: string;
  assigned_on?: string | null;
  due_on?: string | null;
}

export interface AssignmentUpdatePayload {
  competency?: string;
  assigned_on?: string | null;
  due_on?: string | null;
  status?: AssignmentStatus;
  next_action?: string | null;
  completed_on?: string | null;
}

export interface TaskCreatePayload {
  title: string;
  description?: string | null;
  location?: string | null;
  instructions?: string | null;
  safety_requirements?: string | null;
  expected_evidence?: string | null;
  due_on?: string | null;
}

export interface TaskUpdatePayload extends Partial<TaskCreatePayload> {
  status?: TaskStatus;
  completed_on?: string | null;
}

export interface EvidenceCreatePayload {
  evidence_type: EvidenceType;
  document_id?: string | null;
  file_url?: string | null;
  field_notes?: string | null;
  reflection?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  location_label?: string | null;
  recorded_on?: string | null;
}

export interface AssessmentCreatePayload {
  competency_result: CompetencyResult;
  feedback?: string | null;
  follow_up?: string | null;
  evidence_quality?: EvidenceQuality | null;
  assessed_on?: string | null;
}

export interface OutcomePayload {
  demonstrated_skills?: string | null;
  field_outputs?: string | null;
  further_training?: string | null;
  placement_status?: string | null;
  follow_up_status?: string | null;
  follow_up_on?: string | null;
  notes?: string | null;
}

export interface FollowUpItem {
  enrolment_id: string;
  person: ProgrammePersonBrief;
  next_action: string | null;
}

export interface OverdueEvidenceItem {
  evidence_id: string;
  person: ProgrammePersonBrief;
  task_title: string;
  submitted_on: string | null;
  days_waiting: number;
}

export interface VulnerabilitySummary {
  recorded: number;
  low: number;
  moderate: number;
  high: number;
  high_percent: number | null;
}

export interface CohortDashboard {
  cohort_id: string;
  cohort_name: string;
  programme_name: string;
  active_learners: number;
  completed_learners: number;
  assignments_total: number;
  assignments_completed: number;
  module_completion_rate: number;
  competencies_demonstrated: number;
  competencies_pending: number;
  tasks_total: number;
  tasks_completed: number;
  evidence_submissions: number;
  assessments_completed: number;
  assessments_overdue: number;
  learners_needing_follow_up: FollowUpItem[];
  overdue_evidence: OverdueEvidenceItem[];
  vulnerability: VulnerabilitySummary | null;
  outcomes_recorded: number;
}

// ============================================================
// SERVICE
// ============================================================

export const learnerWorkflowService = {
  async getJourney(enrolmentId: string): Promise<JourneyResponse> {
    const { data } = await api.get<JourneyResponse>(
      `/programmes/enrolments/${enrolmentId}/journey`,
    );
    return data;
  },

  async recordBaseline(
    enrolmentId: string,
    payload: BaselinePayload,
  ): Promise<BaselineItem> {
    const { data } = await api.put<BaselineItem>(
      `/programmes/enrolments/${enrolmentId}/baseline`,
      payload,
    );
    return data;
  },

  async assignModule(
    enrolmentId: string,
    payload: AssignmentCreatePayload,
  ): Promise<AssignmentItem> {
    const { data } = await api.post<AssignmentItem>(
      `/programmes/enrolments/${enrolmentId}/assignments`,
      payload,
    );
    return data;
  },

  async updateAssignment(
    assignmentId: string,
    payload: AssignmentUpdatePayload,
  ): Promise<AssignmentItem> {
    const { data } = await api.patch<AssignmentItem>(
      `/programmes/assignments/${assignmentId}`,
      payload,
    );
    return data;
  },

  async createTask(
    assignmentId: string,
    payload: TaskCreatePayload,
  ): Promise<TaskItem> {
    const { data } = await api.post<TaskItem>(
      `/programmes/assignments/${assignmentId}/tasks`,
      payload,
    );
    return data;
  },

  async updateTask(
    taskId: string,
    payload: TaskUpdatePayload,
  ): Promise<TaskItem> {
    const { data } = await api.patch<TaskItem>(
      `/programmes/tasks/${taskId}`,
      payload,
    );
    return data;
  },

  async submitEvidence(
    taskId: string,
    payload: EvidenceCreatePayload,
  ): Promise<EvidenceItem> {
    const { data } = await api.post<EvidenceItem>(
      `/programmes/tasks/${taskId}/evidence`,
      payload,
    );
    return data;
  },

  async assessEvidence(
    evidenceId: string,
    payload: AssessmentCreatePayload,
  ): Promise<AssessmentItem> {
    const { data } = await api.post<AssessmentItem>(
      `/programmes/evidence/${evidenceId}/assessments`,
      payload,
    );
    return data;
  },

  async recordOutcome(
    enrolmentId: string,
    payload: OutcomePayload,
  ): Promise<OutcomeItem> {
    const { data } = await api.put<OutcomeItem>(
      `/programmes/enrolments/${enrolmentId}/outcome`,
      payload,
    );
    return data;
  },

  async getCohortDashboard(cohortId: string): Promise<CohortDashboard> {
    const { data } = await api.get<CohortDashboard>(
      `/programmes/cohorts/${cohortId}/dashboard`,
    );
    return data;
  },
};

// ============================================================
// LABELS
// ============================================================

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  assigned: 'Assigned',
  in_progress: 'In progress',
  submitted: 'Evidence submitted',
  completed: 'Completed',
  follow_up: 'Needs follow-up',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  assigned: 'Assigned',
  in_progress: 'In progress',
  submitted: 'Evidence submitted',
  completed: 'Completed',
};

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  photo: 'Photo',
  document: 'Document',
  note: 'Field note',
  observation: 'Observation',
  gps: 'GPS / GIS',
  artifact: 'Competency artifact',
};

export const COMPETENCY_RESULT_LABELS: Record<CompetencyResult, string> = {
  met: 'Competency met',
  partially_met: 'Partially met',
  not_met: 'Not yet met',
};

export const EVIDENCE_QUALITY_LABELS: Record<EvidenceQuality, string> = {
  strong: 'Strong',
  adequate: 'Adequate',
  weak: 'Weak',
};

export const VULNERABILITY_LABELS: Record<VulnerabilityClass, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
};

export const AFFORD_TRAINING_LABELS: Record<AffordTraining, string> = {
  yes: 'Yes, without assistance',
  no: 'No',
  with_assistance: 'Only with assistance',
};

export const READINESS_LABELS: Record<Readiness, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  ready_for_completion: 'Ready for completion',
  completed: 'Completed',
};