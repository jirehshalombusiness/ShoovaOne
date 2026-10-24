import { format, isThisYear, isToday, isYesterday } from 'date-fns';
import type { ChatConversation, ChatUser } from '@/services/chat.service';

export function parseChatDate(value?: string | null): Date | null {
  if (!value) return null;

  const hasZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
  const normalized = hasZone
    ? value
    : `${value.includes(' ') ? value.replace(' ', 'T') : value}Z`;

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatConversationTime(value?: string | null): string {
  const date = parseChatDate(value);
  if (!date) return '';

  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  if (isThisYear(date)) return format(date, 'd MMM');
  return format(date, 'd MMM yyyy');
}

export function formatDayLabel(value?: string | null): string {
  const date = parseChatDate(value);
  if (!date) return '';

  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisYear(date)) return format(date, 'EEEE, d MMM');
  return format(date, 'd MMM yyyy');
}

export function formatMessageTime(value?: string | null): string {
  const date = parseChatDate(value);
  return date ? format(date, 'HH:mm') : '';
}

export function formatFullDate(value?: string | null): string {
  const date = parseChatDate(value);
  return date ? format(date, 'd MMM yyyy, HH:mm') : '';
}

export function getFullName(
  user?: Pick<ChatUser, 'first_name' | 'last_name'> | null,
): string {
  if (!user) return 'Unknown';
  return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || 'Unknown';
}

export function getConversationTitle(conversation: ChatConversation): string {
  const title = conversation.title?.trim();
  if (title) return title;
  if (conversation.type === 'group') return 'Group chat';
  if (conversation.type === 'announcement') return 'Announcement';
  return 'Direct message';
}

export function isSameDay(first?: string | null, second?: string | null): boolean {
  const a = parseChatDate(first);
  const b = parseChatDate(second);
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
