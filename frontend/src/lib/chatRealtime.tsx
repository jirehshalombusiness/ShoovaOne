import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import {
  chatService,
  chatSocketUrl,
  type ChatEvent,
} from '@/services/chat.service';

export type ChatConnectionStatus = 'connecting' | 'open' | 'offline';
type ChatEventListener = (event: ChatEvent) => void;

interface ChatRealtimeContextValue {
  status: ChatConnectionStatus;
  subscribe: (listener: ChatEventListener) => () => void;
}

const ChatRealtimeContext = createContext<ChatRealtimeContextValue | null>(null);

export function ChatRealtimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ChatConnectionStatus>('offline');
  const listenersRef = useRef<Set<ChatEventListener>>(new Set());

  const subscribe = useCallback((listener: ChatEventListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      queryClient.removeQueries({ queryKey: ['chat'] });
      setStatus('offline');
      return;
    }

    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let heartbeatTimer: number | null = null;
    let attempt = 0;

    const clearReconnect = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const clearHeartbeat = () => {
      if (heartbeatTimer !== null) {
        window.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      clearReconnect();
      const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
      attempt += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, delay);
    };

    const connect = async () => {
      clearReconnect();
      clearHeartbeat();
      if (disposed) return;

      setStatus((current) => (current === 'open' ? current : 'connecting'));

      try {
        const { ticket } = await chatService.getSocketTicket();
        if (disposed) return;

        const connection = new WebSocket(chatSocketUrl(ticket));
        socket = connection;

        connection.onopen = () => {
          if (disposed) {
            connection.close();
            return;
          }
          attempt = 0;
          setStatus('open');
          clearHeartbeat();
          heartbeatTimer = window.setInterval(() => {
            if (connection.readyState === WebSocket.OPEN) {
              connection.send(JSON.stringify({ type: 'ping' }));
            }
          }, 25_000);
        };

        connection.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as ChatEvent;
            if (!payload?.type) return;

            queryClient.invalidateQueries({
              queryKey: ['chat', 'conversations'],
            });
            if (payload.conversation_id) {
              queryClient.invalidateQueries({
                queryKey: ['chat', 'conversation', payload.conversation_id],
              });
            }

            listenersRef.current.forEach((listener) => {
              try {
                listener(payload);
              } catch (error) {
                console.error('Chat event handler failed:', error);
              }
            });
          } catch {
            // Ignore malformed or heartbeat frames.
          }
        };

        connection.onerror = () => {
          connection.close();
        };

        connection.onclose = () => {
          clearHeartbeat();
          if (socket === connection) {
            socket = null;
          }
          if (disposed) return;
          setStatus('offline');
          scheduleReconnect();
        };
      } catch {
        if (disposed) return;
        setStatus('offline');
        scheduleReconnect();
      }
    };

    const reconnectNow = () => {
      if (disposed) return;
      if (
        socket &&
        (socket.readyState === WebSocket.CONNECTING ||
          socket.readyState === WebSocket.OPEN)
      ) {
        return;
      }
      attempt = 0;
      void connect();
    };

    const handleOnline = () => reconnectNow();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') reconnectNow();
    };

    void connect();

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearReconnect();
      clearHeartbeat();
      if (socket) {
        socket.onclose = null;
        socket.close();
        socket = null;
      }
      setStatus('offline');
    };
  }, [user?.id, queryClient]);

  const value = useMemo(
    () => ({ status, subscribe }),
    [status, subscribe],
  );

  return (
    <ChatRealtimeContext.Provider value={value}>
      {children}
    </ChatRealtimeContext.Provider>
  );
}

export function useChatRealtime(): ChatRealtimeContextValue {
  const value = useContext(ChatRealtimeContext);
  if (!value) {
    throw new Error('useChatRealtime must be used within a ChatRealtimeProvider');
  }
  return value;
}
