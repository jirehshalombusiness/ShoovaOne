import type { Money } from './payroll.types';

const currencyLocales: Record<string, string> = {
  GHS: 'en-GH',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
  NGN: 'en-NG',
  KES: 'en-KE',
  ZAR: 'en-ZA',
};

export function formatMoney(value: Money | null | undefined, currency = 'GHS') {
  return new Intl.NumberFormat(currencyLocales[currency] ?? 'en-US', {
    style: 'currency',
    currency: currency || 'GHS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

export function formatNumber(value: number | string | null | undefined, digits = 0) {
  return new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value ?? 0));
}

export function formatPercent(value: Money | null | undefined) {
  return `${(Number(value ?? 0) * 100).toFixed(2)}%`;
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function titleCase(value?: string | null) {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
) {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response
    ?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  const message = (error as { message?: string })?.message;
  if (message) return message;
  return fallback;
}

const positiveStatuses = new Set(['paid', 'approved', 'verified', 'active', 'issued', 'finalized', 'reconciled']);
const warningStatuses = new Set([
  'draft',
  'pending',
  'pending_approval',
  'submitted',
  'processing',
  'partially_paid',
  'hr_approved',
  'finance_approved',
  'calculated',
  'disbursing',
  'open',
]);
const negativeStatuses = new Set(['failed', 'rejected', 'cancelled', 'held', 'reversed', 'returned']);

export function statusClasses(status?: string | null) {
  const normalized = (status ?? '').toLowerCase();
  if (positiveStatuses.has(normalized)) {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200';
  }
  if (negativeStatuses.has(normalized)) {
    return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200';
  }
  if (warningStatuses.has(normalized)) {
    return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200';
  }
  return 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200';
}

export function inputClasses() {
  return 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200';
}

export function labelClasses() {
  return 'mb-1.5 block text-xs font-semibold text-slate-700';
}
