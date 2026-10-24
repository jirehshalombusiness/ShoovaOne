import { API_URL, api } from './api';

export type ChatConversationType = 'direct' | 'group' | 'announcement';
export type ChatConversationStatus = 'active' | 'pending' | 'rejected';

export interface ChatUser {
  id: string;
  first_name: string;
  last_name: string;
  job_title?: string | null;
  department?: string | null;
  profile_image_url?: string | null;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  body: string;
  message_type: string;
  sender: ChatUser | null;
  created_at: string;
  edited_at?: string | null;
}

export interface ChatConversation {
  id: string;
  type: ChatConversationType;
  title?: string | null;
  description?: string | null;
  status: ChatConversationStatus;
  posting_policy: 'all' | 'owner';
  created_at: string;
  created_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  last_message_at?: string | null;
  unread_count: number;
  member_count: number;
  members: ChatUser[];
  last_message?: ChatMessage | null;
  requested_members: ChatUser[];
  is_owner: boolean;
  can_post: boolean;
}

export interface ChatEvent {
  type:
    | 'message.created'
    | 'conversation.created'
    | 'conversation.updated'
    | 'conversation.removed';
  conversation_id: string;
  message?: ChatMessage;
}

interface GroupPayload {
  title: string;
  description?: string;
  requested_member_ids?: string[];
}

interface AnnouncementPayload {
  title: string;
  description?: string;
  member_ids?: string[];
}

export const chatService = {
  async getPeople(): Promise<ChatUser[]> {
    const response = await api.get<ChatUser[]>('/chat/people');
    return response.data;
  },

  async getConversations(): Promise<ChatConversation[]> {
    const response = await api.get<ChatConversation[]>('/chat/conversations');
    return response.data;
  },

  async getConversation(conversationId: string): Promise<ChatConversation> {
    const response = await api.get<ChatConversation>(
      `/chat/conversations/${conversationId}`,
    );
    return response.data;
  },

  async getMessages(
    conversationId: string,
    params?: { before?: string; limit?: number },
  ): Promise<ChatMessage[]> {
    const response = await api.get<ChatMessage[]>(
      `/chat/conversations/${conversationId}/messages`,
      { params },
    );
    return response.data;
  },

  async sendMessage(conversationId: string, body: string): Promise<ChatMessage> {
    const response = await api.post<ChatMessage>(
      `/chat/conversations/${conversationId}/messages`,
      { body },
    );
    return response.data;
  },

  async createDirect(userId: string): Promise<ChatConversation> {
    const response = await api.post<ChatConversation>('/chat/direct', {
      user_id: userId,
    });
    return response.data;
  },

  async createGroup(payload: GroupPayload): Promise<ChatConversation> {
    const response = await api.post<ChatConversation>('/chat/groups', payload);
    return response.data;
  },

  async createAnnouncement(
    payload: AnnouncementPayload,
  ): Promise<ChatConversation> {
    const response = await api.post<ChatConversation>(
      '/chat/announcements',
      payload,
    );
    return response.data;
  },

  async approveGroup(
    conversationId: string,
    memberIds: string[],
  ): Promise<ChatConversation> {
    const response = await api.post<ChatConversation>(
      `/chat/conversations/${conversationId}/approve`,
      { member_ids: memberIds },
    );
    return response.data;
  },

  async rejectGroup(conversationId: string): Promise<ChatConversation> {
    const response = await api.post<ChatConversation>(
      `/chat/conversations/${conversationId}/reject`,
    );
    return response.data;
  },

  async addMembers(
    conversationId: string,
    userIds: string[],
  ): Promise<ChatConversation> {
    const response = await api.post<ChatConversation>(
      `/chat/conversations/${conversationId}/members`,
      { user_ids: userIds },
    );
    return response.data;
  },

  async removeMember(
    conversationId: string,
    userId: string,
  ): Promise<ChatConversation> {
    const response = await api.delete<ChatConversation>(
      `/chat/conversations/${conversationId}/members/${userId}`,
    );
    return response.data;
  },

  async markRead(conversationId: string): Promise<void> {
    await api.post(`/chat/conversations/${conversationId}/read`);
  },

  async getSocketTicket(): Promise<{ ticket: string; expires_in: number }> {
    const response = await api.post<{ ticket: string; expires_in: number }>(
      '/chat/ws-ticket',
    );
    return response.data;
  },
};

export function chatSocketUrl(ticket: string): string {
  let base = API_URL.replace(/^http/, 'ws');

  if (base.startsWith('/')) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    base = `${protocol}//${window.location.host}${base}`;
  }

  return `${base.replace(/\/$/, '')}/chat/ws?token=${encodeURIComponent(ticket)}`;
}
