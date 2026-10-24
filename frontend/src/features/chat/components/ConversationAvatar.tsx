import { Megaphone, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import type { ChatConversation } from '@/services/chat.service';

const sizeClasses = {
  sm: { box: 'w-8 h-8 rounded-lg', icon: 'w-4 h-4', avatar: 'sm' as const },
  md: { box: 'w-10 h-10 rounded-xl', icon: 'w-5 h-5', avatar: 'md' as const },
  lg: { box: 'w-12 h-12 rounded-xl', icon: 'w-6 h-6', avatar: 'lg' as const },
};

interface ConversationAvatarProps {
  conversation: ChatConversation;
  currentUserId: string;
  size?: keyof typeof sizeClasses;
  className?: string;
}

export function ConversationAvatar({
  conversation,
  currentUserId,
  size = 'md',
  className,
}: ConversationAvatarProps) {
  const styles = sizeClasses[size];

  if (conversation.type === 'direct') {
    const other =
      conversation.members.find((member) => member.id !== currentUserId) ??
      conversation.members[0];

    return (
      <Avatar
        firstName={other?.first_name}
        lastName={other?.last_name}
        imageUrl={other?.profile_image_url}
        size={styles.avatar}
        className={className}
      />
    );
  }

  const isAnnouncement = conversation.type === 'announcement';
  const Icon = isAnnouncement ? Megaphone : Users;

  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-center',
        styles.box,
        isAnnouncement
          ? 'bg-amber-50 text-amber-600 border border-amber-100'
          : 'bg-emerald-50 text-emerald-600 border border-emerald-100',
        className,
      )}
      aria-hidden="true"
    >
      <Icon className={styles.icon} strokeWidth={1.75} />
    </div>
  );
}
