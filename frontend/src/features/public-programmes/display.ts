import { BookOpen, Briefcase, Users } from 'lucide-react';
import type { PublicProgramme } from '@/services/programmes.service';

export type Program = PublicProgramme & {
  category: string;
  title: string;
  location: string;
  duration: string;
  color: string;
  icon: typeof BookOpen;
};

const programStyle = (category: string) => {
  const normalized = category.toLowerCase();
  if (normalized.includes('entrepreneur')) {
    return { color: 'from-[#fae8d8] to-[#fbf2df]', icon: Briefcase };
  }
  if (normalized.includes('leadership') || normalized.includes('community')) {
    return { color: 'from-[#dcefe5] to-[#f1f5df]', icon: Users };
  }
  return { color: 'from-[#e1e9fa] to-[#edf3fb]', icon: BookOpen };
};

export const formatDate = (value: string | null) =>
  value
    ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Date to be confirmed';

export const formatDeadline = (value: string | null) =>
  value ? formatDate(value) : 'No closing date';

export const formatDateRange = (
  startDate: string | null,
  endDate: string | null,
) => {
  if (!startDate && !endDate) return 'Dates to be confirmed';
  if (!endDate) return `Starts ${formatDate(startDate)}`;
  if (!startDate) return `Ends ${formatDate(endDate)}`;
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
};

export const toProgram = (source: PublicProgramme): Program => {
  const category = source.department_name || 'Shoova programme';
  const firstCohort = source.cohorts[0];
  return {
    ...source,
    category,
    title: source.name,
    location:
      firstCohort?.location ||
      firstCohort?.delivery_mode.replace('_', ' ') ||
      'Location to be confirmed',
    duration: source.duration_weeks
      ? `${source.duration_weeks} weeks`
      : 'Duration to be confirmed',
    ...programStyle(category),
  };
};
