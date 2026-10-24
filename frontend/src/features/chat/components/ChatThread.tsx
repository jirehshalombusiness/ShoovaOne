import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  Clock,
  Lock,
  Megaphone,
  MessageCircle,
  Send,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import type { ChatConnectionStatus } from '@/lib/chatRealtime';
import type { ChatConversation, ChatMessage } from '@/services/chat.service';
import {
  formatDayLabel,
  formatFullDate,
  formatMessageTime,
  getConversationTitle,
  getFullName,
  isSameDay,
  parseChatDate,
} from '../lib/chatFormat';
import { ConversationAvatar } from './ConversationAvatar';

interface ChatThreadProps {
  conversation: ChatConversation;
  currentUserId: string;
  messages: ChatMessage[];
  messagesLoading: boolean;
  messagesError: boolean;
  onRetryMessages: () => void;
  isCeo: boolean;
  isMember: boolean;
  wsStatus: ChatConnectionStatus;
  sending: boolean;
  joining: boolean;
  onSend: (body: string) => Promise<boolean>;
  onBack: () => void;
  onOpenManage: () => void;
  onJoin: () => void;
}

const statusDot: Record<ChatConnectionStatus, string> = {
  open: 'bg-emerald-500',
  connecting: 'bg-amber-500',
  offline: 'bg-gray-300',
};

const statusLabel: Record<ChatConnectionStatus, string> = {
  open: 'Live connection',
  connecting: 'Connecting…',
  offline: 'Polling for new messages',
};

const toneClasses = {
  amber: 'border-amber-200 bg-amber-50 text-amber-600',
  red: 'border-red-200 bg-red-50 text-red-600',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-600',
  gray: 'border-gray-200 bg-gray-100 text-gray-500',
};

function StatePanel({
  icon,
  tone = 'gray',
  title,
  description,
  children,
}: {
  icon: ReactNode;
  tone?: keyof typeof toneClasses;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <div className="mx-auto max-w-md text-center">
        <div
          className={cn(
            'mx-auto flex h-12 w-12 items-center justify-center rounded-full border',
            toneClasses[tone],
          )}
        >
          {icon}
        </div>

        <h3 className="mt-3 text-sm font-semibold text-gray-900">{title}</h3>

        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          {description}
        </p>

        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-1 py-4">
      {[0, 1, 2, 3].map((index) => {
        const own = index === 2;

        return (
          <div
            key={index}
            className={cn(
              'flex animate-pulse items-end gap-2',
              own ? 'justify-end' : 'justify-start',
            )}
          >
            {!own && <div className="h-6 w-6 rounded-full bg-gray-200" />}

            <div
              className={cn(
                'space-y-1.5',
                own ? 'items-end' : 'items-start',
              )}
            >
              <div
                className={cn(
                  'h-2 w-20 rounded bg-gray-200',
                  own && 'ml-auto',
                )}
              />
              <div className="h-9 w-48 rounded-2xl bg-gray-200 sm:w-64" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ChatThread({
  conversation,
  currentUserId,
  messages,
  messagesLoading,
  messagesError,
  onRetryMessages,
  isCeo,
  isMember,
  wsStatus,
  sending,
  joining,
  onSend,
  onBack,
  onOpenManage,
  onJoin,
}: ChatThreadProps) {
  const [text, setText] = useState('');
  const [showJump, setShowJump] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stickRef = useRef(true);

  const isDirect = conversation.type === 'direct';
  const isAnnouncement = conversation.type === 'announcement';
  const isPending = conversation.status === 'pending';
  const isRejected = conversation.status === 'rejected';
  const isActive = conversation.status === 'active';

  const other =
    conversation.members.find((member) => member.id !== currentUserId) ??
    conversation.members[0];

  const title =
    isDirect && other
      ? getFullName(other)
      : getConversationTitle(conversation);

  const subtitle = isDirect
    ? other?.job_title || other?.department || 'Direct message'
    : `${conversation.member_count} member${
        conversation.member_count === 1 ? '' : 's'
      }${isPending ? ' · Awaiting approval' : ''}${
        isRejected ? ' · Declined' : ''
      }${isCeo && !isMember && isActive ? ' · CEO overview' : ''}`;

  const canCompose = isMember && isActive && conversation.can_post;

  useEffect(() => {
    setText('');
    stickRef.current = true;
    setShowJump(false);

    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [conversation.id]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (!stickRef.current) return;
    element.scrollTop = element.scrollHeight;
  }, [messages.length, conversation.id]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 140)}px`;
  }, [text]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior });
    stickRef.current = true;
    setShowJump(false);
  };

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;

    const distance =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    stickRef.current = distance < 80;
    setShowJump(distance > 240);
  };

  const handleSubmit = async () => {
    const body = text.trim();
    if (!body || sending) return;

    const sent = await onSend(body);
    if (sent) {
      setText('');
      stickRef.current = true;
      window.setTimeout(() => scrollToBottom('smooth'), 40);
    }
  };

  const renderMessages = () => {
    if (messagesLoading) return <MessageSkeleton />;

    if (messagesError) {
      return (
        <StatePanel
          icon={<AlertCircle className="h-5 w-5" />}
          tone="red"
          title="Couldn’t load messages"
          description="Something went wrong while fetching this conversation. Your messages are safe."
        >
          <button
            type="button"
            onClick={onRetryMessages}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Try again
          </button>
        </StatePanel>
      );
    }

    if (messages.length === 0) {
      return (
        <StatePanel
          icon={
            isAnnouncement ? (
              <Megaphone className="h-5 w-5" />
            ) : (
              <MessageCircle className="h-5 w-5" />
            )
          }
          tone={isAnnouncement ? 'amber' : 'emerald'}
          title={
            isAnnouncement
              ? isCeo
                ? 'Share the first announcement'
                : 'No announcements yet'
              : 'Start the conversation'
          }
          description={
            isAnnouncement
              ? isCeo
                ? 'Everyone added to this channel will be notified when you post.'
                : 'Updates from leadership will appear here.'
              : isDirect
                ? `Send a message to ${title}. Direct messages stay between the two of you.`
                : 'Send the first message to get the group talking.'
          }
        />
      );
    }

    return (
      <div className="mx-auto w-full max-w-3xl px-1 py-2">
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const previousDate = previous
            ? parseChatDate(previous.created_at)
            : null;
          const messageDate = parseChatDate(message.created_at);
          const dayBreak =
            !previous ||
            !isSameDay(previous.created_at, message.created_at);
          const showMeta =
            dayBreak ||
            !previous ||
            previous.sender?.id !== message.sender?.id ||
            (!!previousDate &&
              !!messageDate &&
              messageDate.getTime() - previousDate.getTime() > 5 * 60_000);

          const own = message.sender?.id === currentUserId;
          const senderName = message.sender
            ? getFullName(message.sender)
            : 'Former member';

          return (
            <Fragment key={message.id}>
              {dayBreak && (
                <div className="my-4 flex items-center gap-2 px-2">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[9px] font-medium text-gray-500">
                    {formatDayLabel(message.created_at)}
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
              )}

              <div
                className={cn(
                  'flex items-end gap-2',
                  own ? 'justify-end' : 'justify-start',
                  showMeta && !dayBreak ? 'mt-3' : 'mt-0.5',
                )}
              >
                {!own && (
                  showMeta ? (
                    <Avatar
                      firstName={message.sender?.first_name}
                      lastName={message.sender?.last_name}
                      imageUrl={message.sender?.profile_image_url}
                      size="xs"
                    />
                  ) : (
                    <span className="w-6 flex-shrink-0" />
                  )
                )}

                <div
                  className={cn(
                    'flex min-w-0 max-w-[82%] flex-col sm:max-w-[68%]',
                    own ? 'items-end' : 'items-start',
                  )}
                >
                  {showMeta && (
                    <div
                      className={cn(
                        'mb-0.5 flex items-center gap-1.5 px-1 text-[10px] text-gray-500',
                        own && 'justify-end',
                      )}
                    >
                      {!own && !isDirect && (
                        <span className="truncate font-medium text-gray-600">
                          {senderName}
                        </span>
                      )}

                      <span
                        className="tabular-nums"
                        title={formatFullDate(message.created_at)}
                      >
                        {formatMessageTime(message.created_at)}
                      </span>
                    </div>
                  )}

                  <div
                    className={cn(
                      'whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[13px] leading-relaxed shadow-sm',
                      own
                        ? 'rounded-br-md bg-primary text-white'
                        : 'rounded-bl-md border border-gray-200 bg-white text-gray-900',
                    )}
                  >
                    {message.body}
                  </div>
                </div>
              </div>
            </Fragment>
          );
        })}

        <div className="h-2" />
      </div>
    );
  };

  const renderBody = () => {
    if (isRejected) {
      return (
        <StatePanel
          icon={<XCircle className="h-5 w-5" />}
          tone="red"
          title="Group request declined"
          description={
            isCeo
              ? 'This request was declined by the CEO. It is no longer shown in the chat list.'
              : 'The CEO declined this group chat request. You can start a direct chat with the same people instead.'
          }
        >
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Back to chats
          </button>
        </StatePanel>
      );
    }

    if (isPending) {
      const requested = conversation.requested_members;

      return (
        <StatePanel
          icon={<Clock className="h-5 w-5" />}
          tone="amber"
          title={
            isCeo ? 'This group needs your approval' : 'Waiting for CEO approval'
          }
          description={
            isCeo
              ? 'Review the suggested members and approve the group to open the conversation. Only you can assign members.'
              : 'Your group request has been sent to the CEO. You’ll be notified as soon as it’s approved and members are assigned.'
          }
        >
          {isCeo ? (
            <>
              {requested.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {requested.slice(0, 5).map((person) => (
                    <span
                      key={person.id}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white py-0.5 pl-1 pr-2 text-[10px] font-medium text-gray-600"
                    >
                      <Avatar
                        firstName={person.first_name}
                        lastName={person.last_name}
                        imageUrl={person.profile_image_url}
                        size="xs"
                      />
                      {getFullName(person)}
                    </span>
                  ))}

                  {requested.length > 5 && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 text-[10px] font-medium text-gray-500">
                      +{requested.length - 5} more
                    </span>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={onOpenManage}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Review request
              </button>
            </>
          ) : (
            <p className="text-[10px] font-medium text-amber-700">
              Only the CEO can approve groups and assign members.
            </p>
          )}
        </StatePanel>
      );
    }

    if (!isMember) {
      return (
        <StatePanel
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="emerald"
          title="You can manage this conversation"
          description={
            isAnnouncement
              ? 'Join this announcement channel to read updates. As CEO you can also manage who receives it.'
              : 'Join to read and send messages. As CEO you can manage members without joining.'
          }
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onJoin}
              disabled={joining}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              {joining ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <Users className="h-3.5 w-3.5" />
              )}
              Join conversation
            </button>

            <button
              type="button"
              onClick={onOpenManage}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Manage members
            </button>
          </div>
        </StatePanel>
      );
    }

    return renderMessages();
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-gray-200 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to chats"
          className="-ml-1 flex-shrink-0 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <ConversationAvatar
          conversation={conversation}
          currentUserId={currentUserId}
          size="md"
        />

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[13px] font-semibold text-gray-900 sm:text-sm">
            {title}
          </h2>

          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] text-gray-500">
            <span
              title={statusLabel[wsStatus]}
              className={cn(
                'h-1.5 w-1.5 flex-shrink-0 rounded-full',
                statusDot[wsStatus],
              )}
            />
            <span className="truncate">
              {subtitle}
            </span>
          </p>
        </div>

        {!isDirect && (
          <button
            type="button"
            onClick={onOpenManage}
            aria-label="Members"
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {isCeo ? 'Manage' : 'Members'}
            </span>
          </button>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto overscroll-contain bg-gray-50/60 px-3 py-3 sm:px-5"
        >
          {renderBody()}
        </div>

        {showJump && (
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-gray-600 shadow-md transition-colors hover:bg-gray-50"
          >
            <ArrowDown className="h-3 w-3" />
            New messages
          </button>
        )}
      </div>

      {isMember && isActive && (
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-3 py-2.5 sm:px-5">
          {canCompose ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit();
              }}
            >
              <div className="mx-auto flex max-w-3xl items-end gap-2">
                <div className="flex min-w-0 flex-1 items-end rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 transition-colors focus-within:border-primary focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/15">
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter' &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        void handleSubmit();
                      }
                    }}
                    rows={1}
                    maxLength={4000}
                    placeholder={
                      isAnnouncement
                        ? 'Write an announcement…'
                        : 'Write a message…'
                    }
                    aria-label="Message"
                    className="max-h-[140px] min-h-[24px] w-full resize-none bg-transparent text-[13px] leading-relaxed text-gray-900 placeholder-gray-400 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!text.trim() || sending}
                  aria-label="Send message"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sending ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="mx-auto mt-1 flex max-w-3xl items-center justify-between gap-2 px-1 text-[10px] text-gray-400">
                <span className="hidden sm:inline">
                  {isAnnouncement
                    ? `Announcement to ${conversation.member_count} reader${
                        conversation.member_count === 1 ? '' : 's'
                      }`
                    : 'Enter to send · Shift + Enter for a new line'}
                </span>

                {text.length > 3600 && (
                  <span className="ml-auto tabular-nums">
                    {text.length}/4000
                  </span>
                )}
              </div>
            </form>
          ) : (
            <div className="mx-auto flex max-w-3xl items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" />

              <p className="text-[11px] leading-relaxed text-amber-800">
                <span className="font-semibold">Read-only channel.</span> Only
                the CEO can post in this announcement channel.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
