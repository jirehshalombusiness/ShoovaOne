from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Sequence, Set

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.pydantic.chat import (
    ChatConversationResponse,
    ChatMessageResponse,
    ChatUser,
)
from app.models.sql.chat import ChatMessage, Conversation, ConversationMember
from app.models.sql.core.notification import Notification
from app.models.sql.core.role import Role, user_roles
from app.models.sql.core.user import User


def is_ceo(user: User) -> bool:
    return any((role.name or "").lower() == "ceo" for role in user.roles)


async def get_ceo_user_ids(
    db: AsyncSession,
    exclude: Optional[str] = None,
) -> List[str]:
    result = await db.execute(
        select(User.id)
        .join(user_roles, user_roles.c.user_id == User.id)
        .join(Role, Role.id == user_roles.c.role_id)
        .where(
            func.lower(Role.name) == "ceo",
            User.is_active.is_(True),
        )
    )
    ids = [str(user_id) for user_id in result.scalars().all()]
    if exclude:
        ids = [user_id for user_id in ids if user_id != str(exclude)]
    return list(dict.fromkeys(ids))


def get_member(
    conversation: Conversation,
    user_id: str,
) -> Optional[ConversationMember]:
    target = str(user_id)
    return next(
        (
            member
            for member in conversation.members
            if str(member.user_id) == target
        ),
        None,
    )


def get_member_ids(conversation: Conversation) -> List[str]:
    return [str(member.user_id) for member in conversation.members]


def chat_user_from(user: User) -> ChatUser:
    person = user.person
    if person:
        first_name = person.first_name or ""
        last_name = person.last_name or ""
        job_title = person.job_title
        department = person.department
        profile_image_url = person.profile_image_url
    else:
        local_part = (user.email or "User").split("@")[0]
        first_name = local_part
        last_name = ""
        job_title = None
        department = None
        profile_image_url = None

    return ChatUser(
        id=str(user.id),
        first_name=first_name,
        last_name=last_name,
        job_title=job_title,
        department=department,
        profile_image_url=profile_image_url,
    )


def display_name(user: User) -> str:
    person = user.person
    if person:
        name = f"{person.first_name or ''} {person.last_name or ''}".strip()
        if name:
            return name
    return (user.email or "Someone").split("@")[0]


def message_to_response(message: ChatMessage) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=str(message.id),
        conversation_id=str(message.conversation_id),
        body=message.body,
        message_type=message.message_type or "text",
        sender=chat_user_from(message.sender) if message.sender else None,
        created_at=message.created_at,
        edited_at=message.edited_at,
    )


def conversation_options():
    return (
        selectinload(Conversation.members)
        .selectinload(ConversationMember.user)
        .selectinload(User.person),
        selectinload(Conversation.creator).selectinload(User.person),
    )


def conversation_to_response(
    conversation: Conversation,
    viewer: User,
    *,
    is_ceo_viewer: bool = False,
    unread_count: int = 0,
    last_message: Optional[ChatMessageResponse] = None,
    requested_members: Optional[List[ChatUser]] = None,
) -> ChatConversationResponse:
    member = get_member(conversation, viewer.id)
    is_owner = bool(member and member.role == "owner")
    members = [
        chat_user_from(member_row.user)
        for member_row in conversation.members
        if member_row.user
    ]

    title = conversation.title
    if conversation.type == "direct":
        others = [user for user in members if user.id != str(viewer.id)]
        if others:
            title = f"{others[0].first_name} {others[0].last_name}".strip()
        else:
            title = title or "Direct message"

    can_post = (
        conversation.status == "active"
        and member is not None
        and (
            conversation.posting_policy == "all"
            or is_owner
            or is_ceo_viewer
        )
    )

    return ChatConversationResponse(
        id=str(conversation.id),
        type=conversation.type,
        title=title,
        description=conversation.description,
        status=conversation.status,
        posting_policy=conversation.posting_policy,
        created_at=conversation.created_at,
        created_by=(
            str(conversation.created_by) if conversation.created_by else None
        ),
        approved_by=(
            str(conversation.approved_by) if conversation.approved_by else None
        ),
        approved_at=conversation.approved_at,
        last_message_at=conversation.last_message_at,
        unread_count=unread_count,
        member_count=len(members),
        members=members,
        last_message=last_message,
        requested_members=requested_members or [],
        is_owner=is_owner,
        can_post=can_post,
    )


async def load_conversation(
    db: AsyncSession,
    conversation_id: str,
) -> Optional[Conversation]:
    result = await db.execute(
        select(Conversation)
        .options(*conversation_options())
        .where(Conversation.id == str(conversation_id))
    )
    return result.scalar_one_or_none()


async def get_users_by_ids(
    db: AsyncSession,
    user_ids: Iterable[str],
    *,
    active_only: bool = True,
) -> Dict[str, User]:
    ids = {str(user_id) for user_id in user_ids if user_id}
    if not ids:
        return {}

    query = select(User).where(User.id.in_(ids))
    if active_only:
        query = query.where(User.is_active.is_(True))

    result = await db.execute(query)
    return {str(user.id): user for user in result.scalars().all()}


async def get_unread_counts(
    db: AsyncSession,
    viewer_id: str,
    conversation_ids: Sequence[str],
) -> Dict[str, int]:
    if not conversation_ids:
        return {}

    result = await db.execute(
        select(
            ChatMessage.conversation_id,
            func.count(ChatMessage.id),
        )
        .join(
            ConversationMember,
            and_(
                ConversationMember.conversation_id
                == ChatMessage.conversation_id,
                ConversationMember.user_id == str(viewer_id),
            ),
        )
        .where(
            ChatMessage.conversation_id.in_(conversation_ids),
            ChatMessage.deleted_at.is_(None),
            or_(
                ChatMessage.sender_id.is_(None),
                ChatMessage.sender_id != str(viewer_id),
            ),
            or_(
                ConversationMember.last_read_at.is_(None),
                ChatMessage.created_at > ConversationMember.last_read_at,
            ),
        )
        .group_by(ChatMessage.conversation_id)
    )

    return {
        str(conversation_id): int(count)
        for conversation_id, count in result.all()
    }


async def get_last_messages(
    db: AsyncSession,
    conversation_ids: Sequence[str],
) -> Dict[str, ChatMessageResponse]:
    if not conversation_ids:
        return {}

    ranked = (
        select(
            ChatMessage.id.label("message_id"),
            func.row_number()
            .over(
                partition_by=ChatMessage.conversation_id,
                order_by=ChatMessage.created_at.desc(),
            )
            .label("position"),
        )
        .where(
            ChatMessage.conversation_id.in_(conversation_ids),
            ChatMessage.deleted_at.is_(None),
        )
        .subquery()
    )

    result = await db.execute(
        select(ChatMessage)
        .join(ranked, ranked.c.message_id == ChatMessage.id)
        .where(ranked.c.position == 1)
        .options(
            selectinload(ChatMessage.sender).selectinload(User.person),
        )
    )

    return {
        str(message.conversation_id): message_to_response(message)
        for message in result.scalars().all()
    }


async def requested_members_for(
    db: AsyncSession,
    conversations: Sequence[Conversation],
) -> Dict[str, List[ChatUser]]:
    ids: Set[str] = set()
    for conversation in conversations:
        for user_id in conversation.requested_member_ids or []:
            ids.add(str(user_id))

    users = await get_users_by_ids(db, ids)
    by_id = {user_id: chat_user_from(user) for user_id, user in users.items()}

    mapping: Dict[str, List[ChatUser]] = {}
    for conversation in conversations:
        mapping[str(conversation.id)] = [
            by_id[user_id]
            for user_id in (conversation.requested_member_ids or [])
            if str(user_id) in by_id
        ]
    return mapping


def add_notifications(
    db: AsyncSession,
    user_ids: Iterable[str],
    *,
    title: str,
    body: Optional[str] = None,
    notification_type: str = "chat",
    link: Optional[str] = None,
) -> List[str]:
    targets = list(dict.fromkeys(str(user_id) for user_id in user_ids if user_id))
    for user_id in targets:
        db.add(
            Notification(
                user_id=user_id,
                title=title,
                body=body,
                type=notification_type,
                link=link,
            )
        )
    return targets


def message_preview(body: str, limit: int = 140) -> str:
    cleaned = " ".join((body or "").split())
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[: limit - 1]}…"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
