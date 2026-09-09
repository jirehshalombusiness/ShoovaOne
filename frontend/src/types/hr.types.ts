export interface EmploymentRecord {
  id: string;
  person_id: string;
  employee_id: string;
  department: string;
  position: string;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'intern' | 'volunteer';
  start_date: string;
  end_date?: string;
  status: 'active' | 'on_leave' | 'terminated' | 'resigned';
  supervisor_id?: string;
  reports_to?: string;
  work_location?: string;
  work_email?: string;
  work_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Compensation {
  id: string;
  person_id: string;
  base_salary: number;
  currency: string;
  salary_frequency: 'monthly' | 'biweekly' | 'weekly' | 'hourly';
  allowances?: Record<string, number>;
  benefits?: string[];
  bank_name?: string;
  bank_account?: string;
  bank_branch?: string;
  effective_date: string;
  created_at: string;
  updated_at: string;
}

export interface LeaveBalance {
  id: string;
  person_id: string;
  leave_type: 'annual' | 'sick' | 'compassionate' | 'study' | 'unpaid' | 'other';
  total_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
  year: number;
  created_at: string;
  updated_at: string;
}

export interface PerformanceReview {
  id: string;
  person_id: string;
  reviewer_id: string;
  review_period_start: string;
  review_period_end: string;
  review_date: string;
  rating: number;
  strengths: string;
  areas_for_improvement: string;
  goals_achieved: string;
  future_goals: string;
  overall_rating: 'exceeds' | 'meets' | 'needs_improvement' | 'unsatisfactory';
  status: 'draft' | 'submitted' | 'reviewed' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface HRDocument {
  id: string;
  person_id: string;
  document_type: 'contract' | 'offer_letter' | 'nda' | 'performance' | 'disciplinary' | 'training' | 'other';
  title: string;
  file_url: string;
  file_name: string;
  uploaded_by: string;
  effective_date?: string;
  expiry_date?: string;
  is_confidential: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeSummary {
  total_employees: number;
  active_employees: number;
  on_leave: number;
  by_department: Record<string, number>;
  by_employment_type: Record<string, number>;
}