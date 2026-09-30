export type PaymentStatus = 'completed' | 'cancelled';

export interface Payment {
  id: string;
  payment_number: string;
  invoice_id: string;
  amount: number;
  currency: string;
  payment_date: string;
  payment_method: string;
  reference?: string | null;
  payer_name?: string | null;
  payer_email?: string | null;
  notes?: string | null;
  status: PaymentStatus;
  recorded_by_id?: string | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentPayload {
  invoice_id: string;
  amount: number;
  currency: string;
  payment_date: string;
  payment_method: string;
  reference?: string;
  payer_name?: string;
  payer_email?: string;
  notes?: string;
}

export interface UpdatePaymentPayload {
  amount?: number;
  payment_date?: string;
  payment_method?: string;
  reference?: string;
  payer_name?: string;
  payer_email?: string;
  notes?: string;
}

export interface CancelPaymentPayload {
  reason: string;
}

export interface PaymentListParams {
  invoice_id?: string;
  status?: PaymentStatus;
  search?: string;
}