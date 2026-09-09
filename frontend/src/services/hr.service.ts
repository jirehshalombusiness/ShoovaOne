import { api } from './api';
import { 
  EmploymentRecord, 
  Compensation, 
  LeaveBalance, 
  PerformanceReview, 
  HRDocument,
  EmployeeSummary 
} from '@/types/hr.types';

export const hrService = {
  // Employment Records
  async getEmployment(personId: string): Promise<EmploymentRecord[]> {
    const response = await api.get<EmploymentRecord[]>(`/hr/employment/${personId}`);
    return response.data;
  },

  async createEmployment(data: Partial<EmploymentRecord>): Promise<EmploymentRecord> {
    const response = await api.post<EmploymentRecord>('/hr/employment', data);
    return response.data;
  },

  async updateEmployment(id: string, data: Partial<EmploymentRecord>): Promise<EmploymentRecord> {
    const response = await api.put<EmploymentRecord>(`/hr/employment/${id}`, data);
    return response.data;
  },

  // Compensation
  async getCompensation(personId: string): Promise<Compensation[]> {
    const response = await api.get<Compensation[]>(`/hr/compensation/${personId}`);
    return response.data;
  },

  async createCompensation(data: Partial<Compensation>): Promise<Compensation> {
    const response = await api.post<Compensation>('/hr/compensation', data);
    return response.data;
  },

  // Leave Balances
  async getLeaveBalances(personId: string): Promise<LeaveBalance[]> {
    const response = await api.get<LeaveBalance[]>(`/hr/leave-balances/${personId}`);
    return response.data;
  },

  // Performance Reviews
  async getPerformanceReviews(personId: string): Promise<PerformanceReview[]> {
    const response = await api.get<PerformanceReview[]>(`/hr/performance/${personId}`);
    return response.data;
  },

  async createPerformanceReview(data: Partial<PerformanceReview>): Promise<PerformanceReview> {
    const response = await api.post<PerformanceReview>('/hr/performance', data);
    return response.data;
  },

  // HR Documents
  async getHRDocuments(personId: string): Promise<HRDocument[]> {
    const response = await api.get<HRDocument[]>(`/hr/documents/${personId}`);
    return response.data;
  },

  async uploadHRDocument(data: FormData): Promise<HRDocument> {
    const response = await api.post<HRDocument>('/hr/documents', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Summary
  async getSummary(): Promise<EmployeeSummary> {
    const response = await api.get<EmployeeSummary>('/hr/summary');
    return response.data;
  },
};