import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from jose import JWTError, jwt
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.core.security import create_access_token, get_current_active_user
from app.models.pydantic.chat import (
    AddMembersRequest,
    AnnouncementCreate,
    ChatConversationResponse,
    ChatMessageResponse,
    ChatUser,
    DirectConversationCreate,
    GroupApprovalRequest,
    GroupCreate,
    MessageCreate,
)
from app.models.sql.chat import ChatMessage, Conversation, ConversationMember
from app.models.sql.core.user import Person, User
from app.services.chat import chat_service
from app.services.chat.realtime import manager

router = APIRouter()


# ============================================
# HELPERS
# ============================================

def _ensure_ceo(user: User) -> None:
    if not chat_service.is_ceo(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the CEO can perform this action.",
        )


def _member_or_403(
    conversation: Conversation,
    user: User,
) -> ConversationMember:
    member = chat_service.get_member(conversation, user.id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this conversation.",
        )
    return member


async def _conversation_or_404(
    db: AsyncSession,
    conversation_id: str,
) -> Conversation:
    conversation = await chat_service.load_conversation(db, conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )
    return conversation


async def _validated_users(
    db: AsyncSession,
    user_ids: List[str],
    *,
    exclude: Optional[str] = None,
) -> List[str]:
    targets = list(
        dict.fromkeys(
            str(user_id)
            for user_id in user_ids
            if user_id and str(user_id) != str(exclude or "")
        )
    )
    if not targets:
        return []

    users = await chat_service.get_users_by_ids(db, targets)
    if len(users) != len(targets):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Some selected people are not active users.",
        )
    return targets


def _response_for(
    conversation: Conversation,
    viewer: User,
    *,
    unread_count: int = 0,
    last_message: Optional[ChatMessageResponse] = None,
    requested_members: Optional[List[ChatUser]] = None,
) -> ChatConversationResponse:
    return chat_service.conversation_to_response(
        conversation,
        viewer,
        is_ceo_viewer=chat_service.is_ceo(viewer),
        unread_count=unread_count,
        last_message=last_message,
        requested_members=requested_members,
    )


async def _reload_and_respond(
    db: AsyncSession,
    conversation_id: str,
    viewer: User,
) -> ChatConversationResponse:
    conversation = await _conversation_or_404(db, conversation_id)
    requested = await chat_service.requested_members_for(db, [conversation])
    return _response_for(
        conversation,
        viewer,
        requested_members=requested.get(str(conversation.id), []),
    )


# ============================================
# PEOPLE PICKER
# ============================================

@router.get("/people", response_model=List[ChatUser])
async def list_chat_people(
    search: Optional[str] = Query(None, max_length=120),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Active colleagues available for direct chats and membership."""

    query = (
        select(User)
        .join(Person, Person.id == User.person_id)
        .options(selectinload(User.person))
        .where(
            User.is_active.is_(True),
            User.id != str(current_user.id),
            Person.deleted_at.is_(None),
        )
    )

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Person.first_name.ilike(term),
                Person.last_name.ilike(term),
                User.email.ilike(term),
            )
        )

    query = query.order_by(
        Person.first_name.asc(),
        Person.last_name.asc(),
    ).limit(500)

    result = await db.execute(query)
    return [
        chat_service.chat_user_from(user)
        for user in result.scalars().all()
    ]


# ============================================
# CONVERSATIONS
# ============================================

@router.get("/conversations", response_model=List[ChatConversationResponse])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Conversations the user belongs to, plus pending groups for the CEO."""

    viewer_is_ceo = chat_service.is_ceo(current_user)

    membership = select(ConversationMember.conversation_id).where(
        ConversationMember.user_id == str(current_user.id)
    )

    visibility = [Conversation.id.in_(membership)]
    if viewer_is_ceo:
        visibility.append(
            and_(
                Conversation.type.in_(["group", "announcement"]),
                Conversation.status.in_(["active", "pending"]),
            )
        )

    result = await db.execute(
        select(Conversation)
        .options(*chat_service.conversation_options())
        .where(
            or_(*visibility),
            Conversation.status != "rejected",
        )
        .order_by(
            func.coalesce(
                Conversation.last_message_at,
                Conversation.created_at,
            ).desc()
        )
    )
    conversations = list(result.scalars().all())
    conversation_ids = [str(item.id) for item in conversations]

    unread = await chat_service.get_unread_counts(
        db,
        current_user.id,
        conversation_ids,
    )
    last_messages = await chat_service.get_last_messages(
        db,
        conversation_ids,
    )
    requested = (
        await chat_service.requested_members_for(db, conversations)
        if viewer_is_ceo
        else {}
    )

    return [
        chat_service.conversation_to_response(
            conversation,
            current_user,
            is_ceo_viewer=viewer_is_ceo,
            unread_count=unread.get(str(conversation.id), 0),
            last_message=last_messages.get(str(conversation.id)),
            requested_members=requested.get(str(conversation.id), []),
        )
        for conversation in conversations
    ]


@router.get(
    "/conversations/{conversation_id}",
    response_model=ChatConversationResponse,
)
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    conversation = await _conversation_or_404(db, conversation_id)
    viewer_is_ceo = chat_service.is_ceo(current_user)
    member = chat_service.get_member(conversation, current_user.id)

    if (
        member is None
        and not (
            viewer_is_ceo
            and conversation.type in ("group", "announcement")
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this conversation.",
        )

    unread = (
        await chat_service.get_unread_counts(
            db,
            current_user.id,
            [str(conversation.id)],
        )
        if member
        else {}
    )
    last_messages = await chat_service.get_last_messages(
        db,
        [str(conversation.id)],
    )
    requested = await chat_service.requested_members_for(db, [conversation])

    return chat_service.conversation_to_response(
        conversation,
        current_user,
        is_ceo_viewer=viewer_is_ceo,
        unread_count=unread.get(str(conversation.id), 0),
        last_message=last_messages.get(str(conversation.id)),
        requested_members=requested.get(str(conversation.id), []),
    )


# ============================================
# MESSAGES
# ============================================

@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=List[ChatMessageResponse],
)
async def list_messages(
    conversation_id: str,
    before: Optional[datetime] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    conversation = await _conversation_or_404(db, conversation_id)
    _member_or_403(conversation, current_user)

    query = (
        select(ChatMessage)
        .options(
            selectinload(ChatMessage.sender).selectinload(User.person),
        )
        .where(
            ChatMessage.conversation_id == str(conversation.id),
            ChatMessage.deleted_at.is_(None),
        )
    )
    if before:
        query = query.where(ChatMessage.created_at < before)

    result = await db.execute(
        query.order_by(ChatMessage.created_at.desc()).limit(limit)
    )
    messages = list(reversed(result.scalars().all()))
    return [chat_service.message_to_response(message) for message in messages]


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    conversation_id: str,
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    conversation = await _conversation_or_404(db, conversation_id)
    member = _member_or_403(conversation, current_user)

    if conversation.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This conversation is not active yet.",
        )

    viewer_is_ceo = chat_service.is_ceo(current_user)
    if not (
        conversation.posting_policy == "all"
        or member.role == "owner"
        or viewer_is_ceo
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the channel owner can post here.",
        )

    now = chat_service.utcnow()
    message = ChatMessage(
        id=str(uuid.uuid4()),
        conversation_id=str(conversation.id),
        sender_id=str(current_user.id),
        body=payload.body,
        message_type="text",
        created_at=now,
    )
    conversation.last_message_at = now
    db.add(message)

    member_ids = chat_service.get_member_ids(conversation)
    recipients = [uid for uid in member_ids if uid != str(current_user.id)]

    if conversation.type == "announcement":
        chat_service.add_notifications(
            db,
            recipients,
            title=f"New announcement: {conversation.title}",
            body=chat_service.message_preview(payload.body),
            notification_type="announcement",
            link=f"/chat/{conversation.id}",
        )
    elif conversation.type == "direct":
        chat_service.add_notifications(
            db,
            recipients,
            title=f"New message from {chat_service.display_name(current_user)}",
            body=chat_service.message_preview(payload.body),
            notification_type="chat",
            link=f"/chat/{conversation.id}",
        )

    await db.commit()

    response = ChatMessageResponse(
        id=str(message.id),
        conversation_id=str(conversation.id),
        body=message.body,
        message_type=message.message_type,
        sender=chat_service.chat_user_from(current_user),
        created_at=now,
    )

    await manager.broadcast(
        member_ids,
        {
            "type": "message.created",
            "conversation_id": str(conversation.id),
            "message": response.model_dump(mode="json"),
        },
    )

    return response


# ============================================
# CREATE: DIRECT / GROUP / ANNOUNCEMENT
# ============================================

@router.post(
    "/direct",
    response_model=ChatConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_direct_conversation(
    payload: DirectConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if str(payload.user_id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot start a direct chat with yourself.",
        )

    targets = await _validated_users(db, [payload.user_id])
    if not targets:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found or inactive.",
        )

    direct_key = ":".join(
        sorted([str(current_user.id), str(payload.user_id)])
    )

    existing = await db.execute(
        select(Conversation)
        .options(*chat_service.conversation_options())
        .where(Conversation.direct_key == direct_key)
    )
    conversation = existing.scalar_one_or_none()

    if conversation:
        unread = await chat_service.get_unread_counts(
            db,
            current_user.id,
            [str(conversation.id)],
        )
        last_messages = await chat_service.get_last_messages(
            db,
            [str(conversation.id)],
        )
        return chat_service.conversation_to_response(
            conversation,
            current_user,
            is_ceo_viewer=chat_service.is_ceo(current_user),
            unread_count=unread.get(str(conversation.id), 0),
            last_message=last_messages.get(str(conversation.id)),
        )

    now = chat_service.utcnow()
    conversation = Conversation(
        id=str(uuid.uuid4()),
        type="direct",
        status="active",
        posting_policy="all",
        created_by=str(current_user.id),
        created_at=now,
        updated_at=now,
        direct_key=direct_key,
    )
    conversation.members = [
        ConversationMember(
            user_id=str(current_user.id),
            role="member",
            added_by=str(current_user.id),
        ),
        ConversationMember(
            user_id=str(payload.user_id),
            role="member",
            added_by=str(current_user.id),
        ),
    ]
    db.add(conversation)
    await db.commit()

    conversation = await _conversation_or_404(db, conversation.id)

    await manager.broadcast(
        [str(current_user.id), str(payload.user_id)],
        {
            "type": "conversation.created",
            "conversation_id": str(conversation.id),
        },
    )

    return chat_service.conversation_to_response(
        conversation,
        current_user,
        is_ceo_viewer=chat_service.is_ceo(current_user),
    )


@router.post(
    "/groups",
    response_model=ChatConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_group(
    payload: GroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    requested_ids = await _validated_users(
        db,
        payload.requested_member_ids,
        exclude=str(current_user.id),
    )

    viewer_is_ceo = chat_service.is_ceo(current_user)
    now = chat_service.utcnow()

    conversation = Conversation(
        id=str(uuid.uuid4()),
        type="group",
        title=payload.title,
        description=payload.description,
        status="active" if viewer_is_ceo else "pending",
        posting_policy="all",
        created_by=str(current_user.id),
        approved_by=str(current_user.id) if viewer_is_ceo else None,
        approved_at=now if viewer_is_ceo else None,
        created_at=now,
        updated_at=now,
        requested_member_ids=[] if viewer_is_ceo else requested_ids,
    )
    conversation.members = [
        ConversationMember(
            user_id=str(current_user.id),
            role="owner",
            added_by=str(current_user.id),
        )
    ]

    if viewer_is_ceo:
        for user_id in requested_ids:
            conversation.members.append(
                ConversationMember(
                    user_id=user_id,
                    role="member",
                    added_by=str(current_user.id),
                )
            )
            chat_service.add_notifications(
                db,
                [user_id],
                title=f"Added to {payload.title}",
                body=(
                    f"{chat_service.display_name(current_user)} added you "
                    "to a group chat."
                ),
                notification_type="chat",
                link=f"/chat/{conversation.id}",
            )

        notification_targets = requested_ids
    else:
        ceo_ids = await chat_service.get_ceo_user_ids(
            db,
            exclude=str(current_user.id),
        )
        chat_service.add_notifications(
            db,
            ceo_ids,
            title="Group chat awaiting approval",
            body=(
                f"{chat_service.display_name(current_user)} requested "
                f"“{payload.title}” with {len(requested_ids)} suggested "
                "member(s)."
            ),
            notification_type="chat_approval",
            link="/chat",
        )
        notification_targets = ceo_ids

    db.add(conversation)
    await db.commit()

    conversation = await _conversation_or_404(db, conversation.id)
    member_ids = chat_service.get_member_ids(conversation)

    await manager.broadcast(
        set(member_ids) | set(notification_targets),
        {
            "type": "conversation.created",
            "conversation_id": str(conversation.id),
        },
    )

    requested = await chat_service.requested_members_for(db, [conversation])
    return _response_for(
        conversation,
        current_user,
        requested_members=requested.get(str(conversation.id), []),
    )


@router.post(
    "/announcements",
    response_model=ChatConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_announcement(
    payload: AnnouncementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _ensure_ceo(current_user)

    member_ids = await _validated_users(
        db,
        payload.member_ids,
        exclude=str(current_user.id),
    )

    now = chat_service.utcnow()
    conversation = Conversation(
        id=str(uuid.uuid4()),
        type="announcement",
        title=payload.title,
        description=payload.description,
        status="active",
        posting_policy="owner",
        created_by=str(current_user.id),
        approved_by=str(current_user.id),
        approved_at=now,
        created_at=now,
        updated_at=now,
    )
    conversation.members = [
        ConversationMember(
            user_id=str(current_user.id),
            role="owner",
            added_by=str(current_user.id),
        )
    ]
    for user_id in member_ids:
        conversation.members.append(
            ConversationMember(
                user_id=user_id,
                role="member",
                added_by=str(current_user.id),
            )
        )

    chat_service.add_notifications(
        db,
        member_ids,
        title=f"Added to {payload.title}",
        body="You were added to an announcement channel.",
        notification_type="announcement",
        link=f"/chat/{conversation.id}",
    )

    db.add(conversation)
    await db.commit()

    conversation = await _conversation_or_404(db, conversation.id)

    await manager.broadcast(
        chat_service.get_member_ids(conversation),
        {
            "type": "conversation.created",
            "conversation_id": str(conversation.id),
        },
    )

    return _response_for(conversation, current_user)


# ============================================
# APPROVAL (CEO ONLY)
# ============================================

@router.post(
    "/conversations/{conversation_id}/approve",
    response_model=ChatConversationResponse,
)
async def approve_group(
    conversation_id: str,
    payload: GroupApprovalRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _ensure_ceo(current_user)
    conversation = await _conversation_or_404(db, conversation_id)

    if conversation.type != "group":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only group chats require approval.",
        )
    if conversation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This group is not awaiting approval.",
        )

    selected = (
        payload.member_ids
        if payload.member_ids
        else list(conversation.requested_member_ids or [])
    )
    selected_ids = await _validated_users(db, selected)

    existing_ids = set(chat_service.get_member_ids(conversation))
    new_ids = [user_id for user_id in selected_ids if user_id not in existing_ids]

    for user_id in new_ids:
        conversation.members.append(
            ConversationMember(
                user_id=user_id,
                role="member",
                added_by=str(current_user.id),
            )
        )

    now = chat_service.utcnow()
    conversation.status = "active"
    conversation.approved_by = str(current_user.id)
    conversation.approved_at = now
    conversation.requested_member_ids = []

    if conversation.created_by:
        chat_service.add_notifications(
            db,
            [conversation.created_by],
            title="Group chat approved",
            body=f"Your group “{conversation.title}” has been approved.",
            notification_type="chat_approval",
            link=f"/chat/{conversation.id}",
        )

    chat_service.add_notifications(
        db,
        new_ids,
        title=f"Added to {conversation.title}",
        body=(
            f"{chat_service.display_name(current_user)} added you "
            "to a group chat."
        ),
        notification_type="chat",
        link=f"/chat/{conversation.id}",
    )

    await db.commit()
    conversation = await _conversation_or_404(db, conversation.id)

    ceo_ids = await chat_service.get_ceo_user_ids(db)
    await manager.broadcast(
        set(chat_service.get_member_ids(conversation)) | set(ceo_ids),
        {
            "type": "conversation.updated",
            "conversation_id": str(conversation.id),
        },
    )

    return _response_for(conversation, current_user)


@router.post(
    "/conversations/{conversation_id}/reject",
    response_model=ChatConversationResponse,
)
async def reject_group(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _ensure_ceo(current_user)
    conversation = await _conversation_or_404(db, conversation_id)

    if conversation.type != "group":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only group chats require approval.",
        )
    if conversation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This group is not awaiting approval.",
        )

    conversation.status = "rejected"
    conversation.approved_by = str(current_user.id)
    conversation.approved_at = chat_service.utcnow()

    if conversation.created_by:
        chat_service.add_notifications(
            db,
            [conversation.created_by],
            title="Group chat request declined",
            body=f"Your request “{conversation.title}” was declined.",
            notification_type="chat_approval",
            link="/chat",
        )

    await db.commit()
    conversation = await _conversation_or_404(db, conversation.id)

    ceo_ids = await chat_service.get_ceo_user_ids(db)
    await manager.broadcast(
        set(chat_service.get_member_ids(conversation)) | set(ceo_ids),
        {
            "type": "conversation.updated",
            "conversation_id": str(conversation.id),
        },
    )

    requested = await chat_service.requested_members_for(db, [conversation])
    return _response_for(
        conversation,
        current_user,
        requested_members=requested.get(str(conversation.id), []),
    )


# ============================================
# MEMBERSHIP (CEO ONLY)
# ============================================

@router.post(
    "/conversations/{conversation_id}/members",
    response_model=ChatConversationResponse,
)
async def add_members(
    conversation_id: str,
    payload: AddMembersRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _ensure_ceo(current_user)
    conversation = await _conversation_or_404(db, conversation_id)

    if conversation.type == "direct":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Direct chats have exactly two members.",
        )

    selected_ids = await _validated_users(db, payload.user_ids)
    existing_ids = set(chat_service.get_member_ids(conversation))
    new_ids = [user_id for user_id in selected_ids if user_id not in existing_ids]

    if not new_ids:
        return _response_for(conversation, current_user)

    for user_id in new_ids:
        conversation.members.append(
            ConversationMember(
                user_id=user_id,
                role="member",
                added_by=str(current_user.id),
            )
        )

    chat_service.add_notifications(
        db,
        new_ids,
        title=f"Added to {conversation.title or 'a conversation'}",
        body=(
            f"{chat_service.display_name(current_user)} added you "
            "to a conversation."
        ),
        notification_type="chat",
        link=f"/chat/{conversation.id}",
    )

    await db.commit()
    conversation = await _conversation_or_404(db, conversation.id)

    ceo_ids = await chat_service.get_ceo_user_ids(db)
    await manager.broadcast(
        set(chat_service.get_member_ids(conversation)) | set(ceo_ids),
        {
            "type": "conversation.updated",
            "conversation_id": str(conversation.id),
        },
    )

    return _response_for(conversation, current_user)


@router.delete(
    "/conversations/{conversation_id}/members/{user_id}",
    response_model=ChatConversationResponse,
)
async def remove_member(
    conversation_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    _ensure_ceo(current_user)
    conversation = await _conversation_or_404(db, conversation_id)

    if conversation.type == "direct":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Direct chats have exactly two members.",
        )
    if str(conversation.created_by) == str(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The conversation creator cannot be removed.",
        )
    if str(user_id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove yourself.",
        )

    member = chat_service.get_member(conversation, user_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That user is not a member of this conversation.",
        )

    conversation.members.remove(member)

    chat_service.add_notifications(
        db,
        [user_id],
        title=f"Removed from {conversation.title or 'a conversation'}",
        body=(
            f"{chat_service.display_name(current_user)} removed you "
            "from the conversation."
        ),
        notification_type="chat",
        link="/chat",
    )

    await db.commit()
    conversation = await _conversation_or_404(db, conversation.id)

    ceo_ids = await chat_service.get_ceo_user_ids(db)
    await manager.broadcast(
        set(chat_service.get_member_ids(conversation)) | set(ceo_ids),
        {
            "type": "conversation.updated",
            "conversation_id": str(conversation.id),
        },
    )
    await manager.send_to_user(
        str(user_id),
        {
            "type": "conversation.removed",
            "conversation_id": str(conversation.id),
        },
    )

    return _response_for(conversation, current_user)


# ============================================
# READ STATE
# ============================================

@router.post("/conversations/{conversation_id}/read")
async def mark_conversation_read(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    conversation = await _conversation_or_404(db, conversation_id)
    member = _member_or_403(conversation, current_user)

    member.last_read_at = chat_service.utcnow()
    await db.commit()

    return {"conversation_id": str(conversation.id), "unread_count": 0}


# ============================================
# REAL-TIME
# ============================================

@router.post("/ws-ticket")
async def create_ws_ticket(
    current_user: User = Depends(get_current_active_user),
):
    """Short-lived ticket so the long-lived JWT never appears in WS URLs."""

    ticket = create_access_token(
        data={"sub": str(current_user.id), "scope": "chat_ws"},
        expires_delta=timedelta(minutes=2),
    )
    return {"ticket": ticket, "expires_in": 120}


@router.websocket("/ws")
async def chat_socket(
    websocket: WebSocket,
    token: str = Query(...),
):
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id = payload.get("sub")
        if not user_id or payload.get("scope") != "chat_ws":
            raise JWTError("invalid chat ticket")
    except JWTError:
        await websocket.close(code=4401)
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(
                User.id == str(user_id),
                User.is_active.is_(True),
            )
        )
        user = result.scalar_one_or_none()

    if not user:
        await websocket.close(code=4401)
        return

    connection_id = str(user.id)
    await manager.connect(connection_id, websocket)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.disconnect(connection_id, websocket)
