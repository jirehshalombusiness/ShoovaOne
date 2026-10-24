import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { chatService } from '@/services/chat.service';

export const CHAT_CONVERSATIONS_KEY = ['chat', 'conversations'] as const;

export function useChatConversations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: CHAT_CONVERSATIONS_KEY,
    queryFn: () => chatService.getConversations(),
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useChatUnread() {
  const { data } = useChatConversations();

  return (data ?? []).reduce(
    (total, conversation) => total + (conversation.unread_count || 0),
    0,
  );
}
