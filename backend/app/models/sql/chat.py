from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class Conversation(BaseModel):
    __tablename__ = "chat_conversations"

    type = Column(String(20), nullable=False, default="direct")
    title = Column(String(200))
    description = Column(Text)
    status = Column(String(20), nullable=False, default="active")
    posting_policy = Column(String(20), nullable=False, default="all")

    created_by = Column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_by = Column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    approved_at = Column(DateTime(timezone=True))
    last_message_at = Column(DateTime(timezone=True))

    # The creator's suggested audience for a group awaiting approval.
    requested_member_ids = Column(JSON, default=list)

    # Canonical "lowId:highId" key that prevents duplicate direct threads.
    direct_key = Column(String(80), unique=True, index=True, nullable=True)

    members = relationship(
        "ConversationMember",
        back_populates="conversation",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    creator = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_chat_conversations_status", "status"),
        Index("ix_chat_conversations_last_message", "last_message_at"),
    )


class ConversationMember(BaseModel):
    __tablename__ = "chat_conversation_members"

    conversation_id = Column(
        GUID,
        ForeignKey("chat_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(20), nullable=False, default="member")
    added_by = Column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    last_read_at = Column(DateTime(timezone=True))

    conversation = relationship("Conversation", back_populates="members")
    user = relationship("User", foreign_keys=[user_id], lazy="selectin")

    __table_args__ = (
        UniqueConstraint(
            "conversation_id",
            "user_id",
            name="uq_chat_member_conversation_user",
        ),
    )


class ChatMessage(BaseModel):
    __tablename__ = "chat_messages"

    conversation_id = Column(
        GUID,
        ForeignKey("chat_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id = Column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    body = Column(Text, nullable=False)
    message_type = Column(String(20), nullable=False, default="text")
    edited_at = Column(DateTime(timezone=True))
    deleted_at = Column(DateTime(timezone=True))

    conversation = relationship("Conversation")
    sender = relationship("User", lazy="selectin")

    __table_args__ = (
        Index("ix_chat_messages_conversation_created", "conversation_id", "created_at"),
    )
