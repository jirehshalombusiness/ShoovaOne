export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export interface Invoice {
  id: string;
  invoice_number: string;

  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;

  title: string;
  description?: string | null;

  amount: number;
  amount_paid: number;
  currency: string;

  issue_date: string;
  due_date: string;

  status: InvoiceStatus;

  project_id?: string | null;
  programme_id?: string | null;
  department_id?: string | null;

  notes?: string | null;

  issued_at?: string | null;
  paid_at?: string | null;
  cancelled_at?: string | null;

  cancellation_reason?: string | null;

  created_by_id?: string | null;

  created_at: string;
  updated_at: string;
}

export interface CreateInvoicePayload {
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;

  title: string;
  description?: string;

  amount: number;
  currency: string;

  issue_date: string;
  due_date: string;

  project_id?: string;
  programme_id?: string;
  department_id?: string;

  notes?: string;
}

export interface UpdateInvoicePayload {
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;

  title?: string;
  description?: string;

  amount?: number;
  currency?: string;

  issue_date?: string;
  due_date?: string;

  project_id?: string;
  programme_id?: string;
  department_id?: string;

  notes?: string;
}

export interface InvoiceListParams {
  status?: InvoiceStatus;
  search?: string;
}