import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCheck,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatConversation } from '@/services/chat.service';
import type { ChatConnectionStatus } from '@/lib/chatRealtime';
import {
  formatConversationTime,
  getConversationTitle,
  getFullName,
} from '../lib/chatFormat';
import { ConversationAvatar } from './ConversationAvatar';

type ConversationFilter = 'all' | 'unread' | 'approvals';

interface ConversationListProps {
  conversations: ChatConversation[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  activeId?: string;
  currentUserId: string;
  isCeo: boolean;
  wsStatus: ChatConnectionStatus;
  onCompose: () => void;
}

const statusCopy: Record<ChatConnectionStatus, string> = {
  open: 'Live',
  connecting: 'Connecting',
  offline: 'Polling updates',
};

const statusDot: Record<ChatConnectionStatus, string> = {
  open: 'bg-emerald-500',
  connecting: 'bg-amber-500',
  offline: 'bg-gray-300',
};

function conversationPreview(
  conversation: ChatConversation,
  currentUserId: string,
): string {
  if (conversation.status === 'pending') {
    const suggested = conversation.requested_members.length;
    return suggested
      ? `Awaiting CEO approval · ${suggested} suggested member${
          suggested === 1 ? '' : 's'
        }`
      : 'Awaiting CEO approval';
  }

  const last = conversation.last_message;
  if (last) {
    const body = last.body.replace(/\s+/g, ' ').trim();
    if (last.sender?.id === currentUserId) return `You: ${body}`;
    if (conversation.type !== 'direct' && last.sender) {
      return `${last.sender.first_name}: ${body}`;
    }
    return body;
  }

  if (conversation.type === 'announcement') {
    return conversation.description || 'Announcements from leadership';
  }
  if (conversation.type === 'group') {
    return conversation.description || 'No messages yet';
  }
  return 'Say hello';
}

export function ConversationList({
  conversations,
  isLoading,
  isError,
  onRetry,
  activeId,
  currentUserId,
  isCeo,
  wsStatus,
  onCompose,
}: ConversationListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');

  const unreadTotal = conversations.reduce(
    (total, conversation) => total + (conversation.unread_count || 0),
    0,
  );
  const pendingTotal = conversations.filter(
    (conversation) => conversation.status === 'pending',
  ).length;

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return conversations.filter((conversation) => {
      if (filter === 'unread' && conversation.unread_count === 0) return false;
      if (filter === 'approvals' && conversation.status !== 'pending') {
        return false;
      }
      if (!needle) return true;

      const haystack = [
        getConversationTitle(conversation),
        conversation.description ?? '',
        ...conversation.members.map((member) => getFullName(member)),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [conversations, filter, search]);

  const filters: { key: ConversationFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: conversations.length },
    { key: 'unread', label: 'Unread', count: unreadTotal },
    ...(isCeo
      ? [
          {
            key: 'approvals' as const,
            label: 'Approvals',
            count: pendingTotal,
          },
        ]
      : []),
  ];

  const isSearching = search.trim().length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex-shrink-0 border-b border-gray-200 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold tracking-tight text-gray-900">
              Chat
            </h1>

            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  statusDot[wsStatus],
                )}
              />
              {statusCopy[wsStatus]}
              {unreadTotal > 0 && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="font-medium text-gray-700">
                    {unreadTotal} unread
                  </span>
                </>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onCompose}
            aria-label="New conversation"
            title="New conversation"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-colors hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-8 text-[13px] text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-1">
          {filters.map((item) => {
            const active = filter === item.key;
            const showCount =
              item.key === 'approvals'
                ? item.count > 0
                : item.key === 'unread' && item.count > 0;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
                )}
              >
                {item.label}

                {showCount && (
                  <span
                    className={cn(
                      'min-w-[16px] rounded-full px-1 text-[9px] font-semibold leading-4',
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-amber-50 text-amber-700',
                    )}
                  >
                    {item.count > 99 ? '99+' : item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {isLoading ? (
          <div className="space-y-1 p-1">
            {[0, 1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="flex animate-pulse items-center gap-2.5 rounded-lg p-2.5"
              >
                <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-gray-100" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-2.5 w-2/3 rounded bg-gray-100" />
                  <div className="h-2 w-5/6 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertCircle className="h-5 w-5" />
            </div>
            <p className="mt-3 text-[13px] font-semibold text-gray-900">
              Couldn’t load chats
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
              Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Try again
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              {isSearching ? (
                <Search className="h-5 w-5" />
              ) : filter === 'unread' ? (
                <CheckCheck className="h-5 w-5" />
              ) : filter === 'approvals' ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <MessageSquare className="h-5 w-5" />
              )}
            </div>

            <p className="mt-3 text-[13px] font-semibold text-gray-900">
              {isSearching
                ? 'No matches'
                : filter === 'unread'
                  ? 'You’re all caught up'
                  : filter === 'approvals'
                    ? 'No approvals waiting'
                    : 'No conversations yet'}
            </p>

            <p className="mt-1 max-w-[220px] text-[11px] leading-relaxed text-gray-500">
              {isSearching
                ? 'Try a different name or keyword.'
                : filter === 'unread'
                  ? 'New messages will show up here when they arrive.'
                  : filter === 'approvals'
                    ? 'Group chat requests from your team will appear here.'
                    : 'Message a colleague or request a group chat to get started.'}
            </p>

            {!isSearching && filter === 'all' && (
              <button
                type="button"
                onClick={onCompose}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                <Plus className="h-3.5 w-3.5" />
                Start a conversation
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {visible.map((conversation) => {
              const active = conversation.id === activeId;
              const isPending = conversation.status === 'pending';
              const preview = conversationPreview(
                conversation,
                currentUserId,
              );
              const unread = conversation.unread_count || 0;
              const time = formatConversationTime(
                conversation.last_message_at || conversation.created_at,
              );

              return (
                <li key={conversation.id}>
                  <Link
                    to={`/chat/${conversation.id}`}
                    className={cn(
                      'flex items-start gap-2.5 rounded-lg px-2.5 py-2.5 transition-colors',
                      active
                        ? 'bg-emerald-50'
                        : 'hover:bg-gray-50',
                    )}
                  >
                    <ConversationAvatar
                      conversation={conversation}
                      currentUserId={currentUserId}
                      size="md"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-[13px]',
                            unread > 0
                              ? 'font-semibold text-gray-900'
                              : 'font-medium text-gray-800',
                          )}
                        >
                          {getConversationTitle(conversation)}
                        </span>

                        {isPending && (
                          <span className="flex-shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-amber-700">
                            Pending
                          </span>
                        )}

                        {time && (
                          <span className="flex-shrink-0 text-[10px] tabular-nums text-gray-400">
                            {time}
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-2">
                        <p
                          className={cn(
                            'min-w-0 flex-1 truncate text-[11px]',
                            unread > 0
                              ? 'font-medium text-gray-700'
                              : 'text-gray-500',
                          )}
                        >
                          {preview}
                        </p>

                        {unread > 0 && (
                          <span className="flex h-[17px] min-w-[17px] flex-shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-white">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
