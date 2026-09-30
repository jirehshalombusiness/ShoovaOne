import {api} from '../../services/api';
import {
  Payment,
  PaymentListParams,
  CreatePaymentPayload,
  UpdatePaymentPayload,
  CancelPaymentPayload,
} from './payment.types';

export const getPayments = async (
  params?: PaymentListParams
): Promise<Payment[]> => {
  const response = await api.get<Payment[]>('/finance/payments', {
    params,
  });

  return response.data;
};

export const getPayment = async (
  paymentId: string
): Promise<Payment> => {
  const response = await api.get<Payment>(
    `/finance/payments/${paymentId}`
  );

  return response.data;
};

export const createPayment = async (
  payload: CreatePaymentPayload
): Promise<Payment> => {
  const response = await api.post<Payment>(
    '/finance/payments',
    payload
  );

  return response.data;
};

export const updatePayment = async (
  paymentId: string,
  payload: UpdatePaymentPayload
): Promise<Payment> => {
  const response = await api.patch<Payment>(
    `/finance/payments/${paymentId}`,
    payload
  );

  return response.data;
};

export const cancelPayment = async (
  paymentId: string,
  payload: CancelPaymentPayload
): Promise<Payment> => {
  const response = await api.post<Payment>(
    `/finance/payments/${paymentId}/cancel`,
    payload
  );

  return response.data;
};