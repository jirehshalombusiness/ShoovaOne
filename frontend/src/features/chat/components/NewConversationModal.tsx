import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Loader2,
  Megaphone,
  MessageSquare,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import {
  chatService,
  type ChatConversation,
} from '@/services/chat.service';
import { getChatErrorMessage } from '../lib/chatError';
import { getFullName } from '../lib/chatFormat';
import { ChatModalShell } from './ChatModalShell';
import { MemberPicker } from './MemberPicker';

type Mode = 'direct' | 'group' | 'announcement';

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15';

const labelClass = 'mb-1.5 block text-xs font-medium text-gray-700';

interface NewConversationModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewConversationModal({
  open,
  onClose,
}: NewConversationModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isCeo = !!user?.roles?.includes('ceo');

  const [mode, setMode] = useState<Mode>('direct');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const peopleQuery = useQuery({
    queryKey: ['chat', 'people'],
    queryFn: () => chatService.getPeople(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!open) return;

    setMode('direct');
    setTitle('');
    setDescription('');
    setSelectedIds([]);
    setSubmitting(false);
  }, [open]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setTitle('');
    setDescription('');
    setSelectedIds([]);
  };

  const finish = async (conversation: ChatConversation, message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    toast.success(message);
    onClose();
    navigate(`/chat/${conversation.id}`);
  };

  const handleSubmit = async () => {
    if (submitting) return;

    if (mode === 'direct') {
      if (!selectedIds[0]) {
        toast.error('Choose a colleague to message.');
        return;
      }

      setSubmitting(true);
      try {
        const conversation = await chatService.createDirect(selectedIds[0]);
        const target = peopleQuery.data?.find(
          (person) => person.id === selectedIds[0],
        );
        await finish(
          conversation,
          target ? `Chat with ${getFullName(target)} opened.` : 'Chat opened.',
        );
      } catch (error) {
        toast.error(getChatErrorMessage(error, 'Could not start the chat.'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (title.trim().length < 2) {
      toast.error('Give the conversation a name of at least 2 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'group') {
        const conversation = await chatService.createGroup({
          title: title.trim(),
          description: description.trim() || undefined,
          requested_member_ids: selectedIds,
        });
        await finish(
          conversation,
          conversation.status === 'pending'
            ? 'Request sent to the CEO for approval.'
            : 'Group chat created.',
        );
      } else {
        const conversation = await chatService.createAnnouncement({
          title: title.trim(),
          description: description.trim() || undefined,
          member_ids: selectedIds,
        });
        await finish(conversation, 'Announcement channel created.');
      }
    } catch (error) {
      toast.error(
        getChatErrorMessage(error, 'Could not create the conversation.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel =
    mode === 'direct'
      ? 'Start chat'
      : mode === 'group'
        ? isCeo
          ? 'Create group'
          : 'Request group'
        : 'Create channel';

  const canSubmit =
    !submitting &&
    (mode === 'direct'
      ? selectedIds.length === 1
      : title.trim().length >= 2);

  return (
    <ChatModalShell
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title="New conversation"
      description="Direct messages are instant. Group chats need CEO approval."
      icon={<Plus className="h-4 w-4" />}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitLabel}
          </button>
        </>
      }
    >
      <div
        className={cn(
          'mb-4 grid gap-1 rounded-lg bg-gray-100 p-1',
          isCeo ? 'grid-cols-3' : 'grid-cols-2',
        )}
      >
        {[
          { key: 'direct' as const, label: 'Direct', icon: MessageSquare },
          { key: 'group' as const, label: 'Group', icon: Users },
          ...(isCeo
            ? [
                {
                  key: 'announcement' as const,
                  label: 'Announce',
                  icon: Megaphone,
                },
              ]
            : []),
        ].map((tab) => {
          const Icon = tab.icon;
          const active = mode === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => switchMode(tab.key)}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors',
                active
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800',
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {mode === 'direct' && (
        <div className="space-y-3">
          <div>
            <span className={labelClass}>Message a colleague</span>
            <MemberPicker
              people={peopleQuery.data ?? []}
              selectedIds={selectedIds}
              onChange={setSelectedIds}
              multiple={false}
              loading={peopleQuery.isLoading}
              emptyLabel="No colleagues available."
            />
          </div>

          <p className="text-[11px] leading-relaxed text-gray-500">
            Direct messages are private between you and the other person.
          </p>
        </div>
      )}

      {(mode === 'group' || mode === 'announcement') && (
        <div className="space-y-3">
          <div>
            <label className={labelClass} htmlFor="chat-title">
              {mode === 'group' ? 'Group name' : 'Channel name'}
            </label>
            <input
              id="chat-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder={
                mode === 'group'
                  ? 'e.g. Project Falcon launch'
                  : 'e.g. Company-wide updates'
              }
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="chat-description">
              Description <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              id="chat-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="What is this conversation for?"
              className={cn(inputClass, 'resize-none')}
            />
          </div>

          <div>
            <span className={labelClass}>
              {mode === 'group'
                ? 'Suggested members'
                : 'Who should receive this channel?'}
            </span>
            <MemberPicker
              people={peopleQuery.data ?? []}
              selectedIds={selectedIds}
              onChange={setSelectedIds}
              loading={peopleQuery.isLoading}
              emptyLabel="No colleagues available."
            />
          </div>

          {mode === 'group' ? (
            isCeo ? (
              <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <Users className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                <p className="text-[11px] leading-relaxed text-emerald-800">
                  As CEO, your group is approved immediately. Add or remove
                  members anytime from the conversation.
                </p>
              </div>
            ) : (
              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Group chats must be approved by the CEO. Your suggestions are
                  sent with the request — only the CEO assigns final members.
                </p>
              </div>
            )
          ) : (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <Megaphone className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
              <p className="text-[11px] leading-relaxed text-amber-800">
                Only you can post in an announcement channel. Readers will see
                it in their chat list and receive a notification.
              </p>
            </div>
          )}
        </div>
      )}
    </ChatModalShell>
  );
}
