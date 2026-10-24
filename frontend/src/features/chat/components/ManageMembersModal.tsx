import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Check,
  Loader2,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import {
  chatService,
  type ChatConversation,
} from '@/services/chat.service';
import { getChatErrorMessage } from '../lib/chatError';
import { formatFullDate, getFullName } from '../lib/chatFormat';
import { ChatModalShell } from './ChatModalShell';
import { ConversationAvatar } from './ConversationAvatar';
import { MemberPicker } from './MemberPicker';

interface ManageMembersModalProps {
  open: boolean;
  onClose: () => void;
  conversation: ChatConversation | null;
  currentUserId: string;
  canManage: boolean;
  onRejected: () => void;
}

const labelClass =
  'text-[11px] font-semibold uppercase tracking-wide text-gray-500';

export function ManageMembersModal({
  open,
  onClose,
  conversation,
  currentUserId,
  canManage,
  onRejected,
}: ManageMembersModalProps) {
  const queryClient = useQueryClient();

  const [approvalIds, setApprovalIds] = useState<string[]>([]);
  const [addIds, setAddIds] = useState<string[]>([]);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const canBrowsePeople =
    open &&
    canManage &&
    !!conversation &&
    conversation.type !== 'direct' &&
    conversation.status === 'active';

  const peopleQuery = useQuery({
    queryKey: ['chat', 'people'],
    queryFn: () => chatService.getPeople(),
    enabled: canBrowsePeople || (open && canManage && conversation?.status === 'pending'),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!open) return;

    setApprovalIds(
      (conversation?.requested_members ?? [])
        .filter((person) => person.id !== currentUserId)
        .map((person) => person.id),
    );
    setAddIds([]);
    setRemoveTarget(null);
    setConfirmReject(false);
    setBusy(null);
  }, [open, conversation?.id, currentUserId]);

  const members = useMemo(() => {
    if (!conversation) return [];

    return [...conversation.members].sort((first, second) => {
      const firstOwner = first.id === conversation.created_by ? 0 : 1;
      const secondOwner = second.id === conversation.created_by ? 0 : 1;
      if (firstOwner !== secondOwner) return firstOwner - secondOwner;
      return getFullName(first).localeCompare(getFullName(second));
    });
  }, [conversation]);

  if (!conversation || conversation.type === 'direct') return null;

  const isPending = conversation.status === 'pending';
  const isAnnouncement = conversation.type === 'announcement';
  const title = conversation.title?.trim() || 'Untitled conversation';
  const creator = conversation.members.find(
    (member) => member.id === conversation.created_by,
  );
  const memberIds = conversation.members.map((member) => member.id);

  const syncConversation = (updated: ChatConversation) => {
    queryClient.setQueryData(
      ['chat', 'conversation', updated.id],
      updated,
    );
    queryClient.setQueryData<ChatConversation[]>(
      ['chat', 'conversations'],
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
    void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
  };

  const handleApprove = async () => {
    if (busy) return;

    setBusy('approve');
    try {
      const updated = await chatService.approveGroup(
        conversation.id,
        approvalIds,
      );
      syncConversation(updated);
      toast.success(`“${title}” is approved and active.`);
      onClose();
    } catch (error) {
      toast.error(
        getChatErrorMessage(error, 'Could not approve this group.'),
      );
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    if (busy) return;

    if (!confirmReject) {
      setConfirmReject(true);
      return;
    }

    setBusy('reject');
    try {
      await chatService.rejectGroup(conversation.id);
      await queryClient.invalidateQueries({
        queryKey: ['chat', 'conversations'],
      });
      queryClient.removeQueries({
        queryKey: ['chat', 'conversation', conversation.id],
      });
      queryClient.removeQueries({
        queryKey: ['chat', 'messages', conversation.id],
      });
      toast.success('Group request declined.');
      onClose();
      onRejected();
    } catch (error) {
      toast.error(
        getChatErrorMessage(error, 'Could not decline this request.'),
      );
    } finally {
      setBusy(null);
    }
  };

  const handleAddMembers = async () => {
    if (!addIds.length || busy) return;

    const count = addIds.length;
    setBusy('add');
    try {
      const updated = await chatService.addMembers(conversation.id, addIds);
      syncConversation(updated);
      setAddIds([]);
      toast.success(
        count === 1 ? 'Member added.' : `${count} members added.`,
      );
    } catch (error) {
      toast.error(
        getChatErrorMessage(error, 'Could not add those members.'),
      );
    } finally {
      setBusy(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (busy) return;

    setBusy(userId);
    try {
      const updated = await chatService.removeMember(conversation.id, userId);
      syncConversation(updated);
      setRemoveTarget(null);
      toast.success('Member removed.');
    } catch (error) {
      toast.error(
        getChatErrorMessage(error, 'Could not remove this member.'),
      );
    } finally {
      setBusy(null);
    }
  };

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  return (
    <ChatModalShell
      open={open}
      onClose={handleClose}
      title={isPending ? 'Review group request' : 'Conversation members'}
      description={
        isPending
          ? 'Approve the group and choose who joins. Only the CEO assigns members.'
          : 'Only the CEO can change who belongs to this conversation.'
      }
      icon={
        isPending ? (
          <ShieldCheck className="h-4 w-4" />
        ) : (
          <Users className="h-4 w-4" />
        )
      }
      className="sm:max-w-xl"
      footer={
        isPending ? (
          <>
            <button
              type="button"
              onClick={handleClose}
              disabled={!!busy}
              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleReject}
                disabled={!!busy}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50',
                  confirmReject
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
                )}
              >
                {busy === 'reject' && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {confirmReject ? 'Confirm decline' : 'Decline'}
              </button>

              <button
                type="button"
                onClick={handleApprove}
                disabled={!!busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                {busy === 'approve' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Approve group
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={handleClose}
            disabled={!!busy}
            className="ml-auto rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            Done
          </button>
        )
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <ConversationAvatar
            conversation={conversation}
            currentUserId={currentUserId}
            size="md"
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-semibold text-gray-900">{title}</p>

              {isPending && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                  Pending
                </span>
              )}
            </div>

            <p className="mt-0.5 text-[11px] text-gray-500">
              {isAnnouncement
                ? 'Announcement channel'
                : 'Group chat'}
              {' · '}
              {conversation.member_count}{' '}
              {conversation.member_count === 1 ? 'member' : 'members'}
              {creator && !isPending && (
                <> · Created by {getFullName(creator)}</>
              )}
            </p>

            {conversation.description && (
              <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                {conversation.description}
              </p>
            )}

            {isPending && (
              <p className="mt-1.5 text-[11px] font-medium text-gray-600">
                Requested by {creator ? getFullName(creator) : 'a team member'}
                {conversation.created_at
                  ? ` · ${formatFullDate(conversation.created_at)}`
                  : ''}
              </p>
            )}
          </div>
        </div>

        {isPending ? (
          <>
            {confirmReject && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] leading-relaxed text-red-800">
                Declining removes this request from the queue and notifies{' '}
                {creator ? getFullName(creator) : 'the requester'}. Press{' '}
                <span className="font-semibold">Confirm decline</span> again to
                proceed.
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className={labelClass}>Members to add</span>
                <span className="text-[11px] text-gray-500">
                  {approvalIds.length} selected
                </span>
              </div>

              <MemberPicker
                people={peopleQuery.data ?? []}
                selectedIds={approvalIds}
                onChange={setApprovalIds}
                excludeIds={[currentUserId, conversation.created_by ?? '']}
                loading={peopleQuery.isLoading}
                emptyLabel="No other colleagues available to add."
              />

              <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                The creator becomes the group owner and cannot be removed. You
                can change members at any time after approving.
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className={labelClass}>
                  Members ({conversation.member_count})
                </h3>

                {!canManage && (
                  <span className="text-[10px] font-medium text-gray-400">
                    CEO-managed
                  </span>
                )}
              </div>

              <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
                {members.map((member) => {
                  const isCreator = member.id === conversation.created_by;
                  const isSelf = member.id === currentUserId;
                  const name = getFullName(member);
                  const confirming = removeTarget === member.id;

                  return (
                    <li
                      key={member.id}
                      className="flex items-center gap-2.5 px-3 py-2.5"
                    >
                      <Avatar
                        firstName={member.first_name}
                        lastName={member.last_name}
                        imageUrl={member.profile_image_url}
                        size="sm"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium text-gray-900">
                            {name}
                          </span>

                          {isCreator && (
                            <span className="rounded bg-primary/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-primary">
                              Creator
                            </span>
                          )}

                          {isSelf && (
                            <span className="rounded bg-gray-100 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-gray-500">
                              You
                            </span>
                          )}
                        </div>

                        <p className="truncate text-[11px] text-gray-500">
                          {member.job_title ||
                            member.department ||
                            'Team member'}
                        </p>
                      </div>

                      {canManage && !isCreator && !isSelf && (
                        confirming ? (
                          <div className="flex flex-shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member.id)}
                              disabled={!!busy}
                              className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                            >
                              {busy === member.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                'Remove'
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setRemoveTarget(null)}
                              disabled={!!busy}
                              className="rounded-md px-2 py-1 text-[10px] font-medium text-gray-500 transition-colors hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setRemoveTarget(member.id)}
                            aria-label={`Remove ${name}`}
                            title={`Remove ${name}`}
                            className="flex-shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </button>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {canManage && (
              <div>
                <h3 className={`${labelClass} mb-1.5`}>Add people</h3>

                <MemberPicker
                  people={peopleQuery.data ?? []}
                  selectedIds={addIds}
                  onChange={setAddIds}
                  excludeIds={memberIds}
                  loading={peopleQuery.isLoading}
                  emptyLabel="Everyone is already in this conversation."
                />

                <button
                  type="button"
                  onClick={handleAddMembers}
                  disabled={!addIds.length || !!busy}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === 'add' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  {addIds.length
                    ? `Add ${addIds.length} member${
                        addIds.length === 1 ? '' : 's'
                      }`
                    : 'Add members'}
                </button>
              </div>
            )}

            {!canManage && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800">
                Only the CEO can add or remove members. Ask the CEO if someone
                needs access.
              </div>
            )}

            {isAnnouncement && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800">
                This is a read-only announcement channel. Only the CEO can post
                updates.
              </div>
            )}
          </>
        )}
      </div>
    </ChatModalShell>
  );
}
