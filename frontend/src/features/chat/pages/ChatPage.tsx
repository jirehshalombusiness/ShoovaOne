import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  MessageSquare,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { useChatRealtime } from '@/lib/chatRealtime';
import {
  CHAT_CONVERSATIONS_KEY,
  useChatConversations,
} from '@/hooks/useChatConversations';
import {
  chatService,
  type ChatConversation,
  type ChatMessage,
} from '@/services/chat.service';
import { getChatErrorMessage } from '../lib/chatError';
import { ChatThread } from '../components/ChatThread';
import { ConversationList } from '../components/ConversationList';
import { ManageMembersModal } from '../components/ManageMembersModal';
import { NewConversationModal } from '../components/NewConversationModal';

function ThreadSkeleton() {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex animate-pulse items-center gap-3 border-b border-gray-200 px-4 py-3">
        <div className="h-10 w-10 rounded-xl bg-gray-100" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 w-40 rounded bg-gray-100" />
          <div className="h-2 w-24 rounded bg-gray-100" />
        </div>
      </div>

      <div className="flex-1 space-y-4 bg-gray-50/60 px-5 py-6">
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
                  'h-9 rounded-2xl bg-gray-200',
                  index % 2 === 0 ? 'w-52' : 'w-64',
                )}
              />
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-200 px-4 py-3">
        <div className="h-10 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    </div>
  );
}

export function ChatPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { status: wsStatus, subscribe } = useChatRealtime();

  const [composeOpen, setComposeOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [joining, setJoining] = useState(false);
  const [isVisible, setIsVisible] = useState(
    () =>
      typeof document === 'undefined' ||
      document.visibilityState === 'visible',
  );

  const markedReadRef = useRef<string | null>(null);

  const {
    data: conversations = [],
    isLoading: listLoading,
    isError: listError,
    refetch: refetchList,
  } = useChatConversations();

  const listedConversation = useMemo(
    () => conversations.find((item) => item.id === conversationId),
    [conversations, conversationId],
  );

  const detailQuery = useQuery({
    queryKey: ['chat', 'conversation', conversationId],
    queryFn: () => chatService.getConversation(conversationId!),
    enabled: !!conversationId && !listedConversation,
    staleTime: 10_000,
    retry: (failureCount, error) => {
      const status = (error as { response?: { status?: number } }).response
        ?.status;
      if (status === 403 || status === 404) return false;
      return failureCount < 2;
    },
  });

  const conversation = useMemo<ChatConversation | undefined>(() => {
    if (!conversationId) return undefined;
    if (listedConversation) return listedConversation;
    if (detailQuery.data?.id === conversationId) return detailQuery.data;
    return undefined;
  }, [conversationId, listedConversation, detailQuery.data]);

  const currentUserId = user?.id ?? '';
  const isCeo = !!user?.roles?.includes('ceo');
  const isMember = !!conversation?.members.some(
    (member) => member.id === currentUserId,
  );
  const canRead = isMember && conversation?.status === 'active';

  const messagesQuery = useQuery({
    queryKey: ['chat', 'messages', conversationId],
    queryFn: () => chatService.getMessages(conversationId!, { limit: 100 }),
    enabled: !!conversationId && canRead,
    staleTime: 5_000,
    refetchInterval: wsStatus !== 'open' ? 6_000 : false,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const messages = messagesQuery.data ?? [];
  const latestMessageId = messages.length
    ? messages[messages.length - 1].id
    : null;

  const threadError =
    !!conversationId && !conversation && detailQuery.isError;
  const threadLoading = !!conversationId && !conversation && !threadError;

  const syncConversation = useCallback(
    (updated: ChatConversation) => {
      queryClient.setQueryData(
        ['chat', 'conversation', updated.id],
        updated,
      );
      queryClient.setQueryData<ChatConversation[]>(
        CHAT_CONVERSATIONS_KEY,
        (current) =>
          current?.map((item) =>
            item.id === updated.id
              ? {
                  ...item,
                  ...updated,
                  last_message: updated.last_message ?? item.last_message,
                  last_message_at:
                    updated.last_message_at ?? item.last_message_at,
                }
              : item,
          ),
      );
    },
    [queryClient],
  );

  useEffect(() => {
    const onChange = () =>
      setIsVisible(document.visibilityState === 'visible');

    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  useEffect(() => {
    setManageOpen(false);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    return subscribe((event) => {
      if (
        event.type === 'conversation.removed' &&
        event.conversation_id === conversationId
      ) {
        toast.error('You were removed from this conversation.');
        navigate('/chat', { replace: true });
        return;
      }

      if (
        event.type === 'message.created' &&
        event.conversation_id === conversationId &&
        event.message
      ) {
        const incoming = event.message;

        queryClient.setQueryData<ChatMessage[]>(
          ['chat', 'messages', conversationId],
          (current) => {
            if (!current) return current;
            if (current.some((message) => message.id === incoming.id)) {
              return current;
            }
            return [...current, incoming];
          },
        );
      }
    });
  }, [subscribe, conversationId, navigate, queryClient]);

  useEffect(() => {
    if (!conversationId || !canRead || !isVisible || !latestMessageId) {
      return;
    }

    const key = `${conversationId}:${latestMessageId}`;
    if (markedReadRef.current === key) return;
    markedReadRef.current = key;

    let cancelled = false;

    void chatService
      .markRead(conversationId)
      .then(() => {
        if (cancelled) return;

        queryClient.setQueryData<ChatConversation[]>(
          CHAT_CONVERSATIONS_KEY,
          (current) =>
            current?.map((item) =>
              item.id === conversationId
                ? { ...item, unread_count: 0 }
                : item,
            ),
        );
        queryClient.setQueryData<ChatConversation>(
          ['chat', 'conversation', conversationId],
          (current) =>
            current ? { ...current, unread_count: 0 } : current,
        );

        void queryClient.invalidateQueries({
          queryKey: CHAT_CONVERSATIONS_KEY,
        });
      })
      .catch(() => {
        if (cancelled) return;
        if (markedReadRef.current === key) {
          markedReadRef.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    conversationId,
    canRead,
    isVisible,
    latestMessageId,
    queryClient,
  ]);

  const handleSend = useCallback(
    async (body: string): Promise<boolean> => {
      if (!conversationId || !canRead || sending) return false;

      setSending(true);
      try {
        const message = await chatService.sendMessage(conversationId, body);

        queryClient.setQueryData<ChatMessage[]>(
          ['chat', 'messages', conversationId],
          (current) => {
            if (!current) return [message];
            if (current.some((item) => item.id === message.id)) {
              return current;
            }
            return [...current, message];
          },
        );

        void queryClient.invalidateQueries({
          queryKey: CHAT_CONVERSATIONS_KEY,
        });

        return true;
      } catch (error) {
        toast.error(
          getChatErrorMessage(error, 'Your message could not be sent.'),
        );
        return false;
      } finally {
        setSending(false);
      }
    },
    [canRead, conversationId, queryClient, sending],
  );

  const handleJoin = async () => {
    if (!conversation || !currentUserId || joining) return;

    setJoining(true);
    try {
      const updated = await chatService.addMembers(conversation.id, [
        currentUserId,
      ]);
      syncConversation(updated);
      void queryClient.invalidateQueries({
        queryKey: CHAT_CONVERSATIONS_KEY,
      });
      toast.success('You joined the conversation.');
    } catch (error) {
      toast.error(
        getChatErrorMessage(error, 'Could not join this conversation.'),
      );
    } finally {
      setJoining(false);
    }
  };

  if (!user) return null;

  const accessMessage = getChatErrorMessage(
    detailQuery.error,
    'This conversation isn’t available to you.',
  );

  return (
    <>
      <div
        className={cn(
          '-mx-4 -mt-4 -mb-20 flex h-[calc(100dvh-7rem)] overflow-hidden border-t border-gray-200 bg-white',
          'lg:-mx-6 lg:-mt-6 lg:-mb-6 lg:h-[calc(100dvh-3.5rem)] lg:rounded-xl lg:border lg:border-gray-200 lg:shadow-sm',
        )}
      >
        <div
          className={cn(
            'h-full min-h-0 w-full flex-col lg:flex lg:w-[340px] lg:flex-shrink-0 lg:border-r lg:border-gray-200',
            conversationId ? 'hidden lg:flex' : 'flex',
          )}
        >
          <ConversationList
            conversations={conversations}
            isLoading={listLoading}
            isError={listError}
            onRetry={() => {
              void refetchList();
            }}
            activeId={conversationId}
            currentUserId={currentUserId}
            isCeo={isCeo}
            wsStatus={wsStatus}
            onCompose={() => setComposeOpen(true)}
          />
        </div>

        <div
          className={cn(
            'h-full min-h-0 min-w-0 flex-1 flex-col bg-white',
            conversationId ? 'flex' : 'hidden lg:flex',
          )}
        >
          {!conversationId ? (
            <div className="flex h-full flex-col items-center justify-center bg-gray-50/60 px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MessageSquare className="h-6 w-6" strokeWidth={1.75} />
              </div>

              <h2 className="mt-4 text-sm font-semibold text-gray-900">
                Your conversations live here
              </h2>

              <p className="mt-1 max-w-xs text-xs leading-relaxed text-gray-500">
                Choose a chat from the list or start a new conversation with
                your team.
              </p>

              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                <Plus className="h-3.5 w-3.5" />
                New conversation
              </button>
            </div>
          ) : threadLoading ? (
            <ThreadSkeleton />
          ) : threadError || !conversation ? (
            <div className="flex h-full flex-col items-center justify-center bg-gray-50/60 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-gray-500">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <h2 className="mt-3 text-sm font-semibold text-gray-900">
                Conversation unavailable
              </h2>

              <p className="mt-1 max-w-sm text-xs leading-relaxed text-gray-500">
                {accessMessage}
              </p>

              <button
                type="button"
                onClick={() => navigate('/chat')}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                Back to chats
              </button>
            </div>
          ) : (
            <ChatThread
              conversation={conversation}
              currentUserId={currentUserId}
              messages={messages}
              messagesLoading={
                canRead && messagesQuery.isLoading && !messages.length
              }
              messagesError={canRead && messagesQuery.isError}
              onRetryMessages={() => {
                void messagesQuery.refetch();
              }}
              isCeo={isCeo}
              isMember={isMember}
              wsStatus={wsStatus}
              sending={sending}
              joining={joining}
              onSend={handleSend}
              onBack={() => navigate('/chat')}
              onOpenManage={() => setManageOpen(true)}
              onJoin={handleJoin}
            />
          )}
        </div>
      </div>

      <NewConversationModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
      />

      <ManageMembersModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        conversation={conversation ?? null}
        currentUserId={currentUserId}
        canManage={isCeo}
        onRejected={() => {
          setManageOpen(false);
          navigate('/chat');
        }}
      />
    </>
  );
}
