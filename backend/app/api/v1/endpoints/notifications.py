from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.sql.notification import Notification
from app.models.pydantic.notification import NotificationResponse, NotificationCreate

router = APIRouter()


@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Get all notifications for the current user."""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()


@router.get("/unread", response_model=dict)
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Get unread notification count."""
    result = await db.execute(
        select(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        )
    )
    notifications = result.scalars().all()
    return {"count": len(notifications)}


@router.put("/{notification_id}/read", response_model=dict)
async def mark_as_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Mark a notification as read."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = True
    notification.read_at = datetime.now()
    await db.commit()
    
    return {"message": "Notification marked as read"}


@router.put("/read-all", response_model=dict)
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Mark all notifications as read."""
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        )
        .values(is_read=True, read_at=datetime.now())
    )
    await db.commit()
    return {"message": "All notifications marked as read"}


@router.post("/", response_model=NotificationResponse)
async def create_notification(
    notification_data: NotificationCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Create a notification for a user."""
    import uuid
    notification = Notification(
        id=str(uuid.uuid4()),
        user_id=notification_data.user_id,
        title=notification_data.title,
        body=notification_data.body,
        type=notification_data.type,
        link=notification_data.link,
        extra_data=notification_data.extra_data,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification