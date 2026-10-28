import { format } from 'date-fns';

export function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value?: string | null): string | null {
  const date = parseDate(value);
  return date ? format(date, 'MMM d, yyyy') : null;
}

export function formatDateRange(
  start?: string | null,
  end?: string | null,
): string {
  const from = formatDate(start);
  const to = formatDate(end);
  if (from && to) return `${from} – ${to}`;
  return from ?? to ?? 'Dates not set';
}
