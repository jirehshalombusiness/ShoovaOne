from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, update
from typing import List
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.sql.core.notification import Notification
from app.models.pydantic.core.notification import NotificationResponse, NotificationCreate
from app.services.core.permission_service import PermissionService

router = APIRouter()


@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Get notifications for the current user, newest first."""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/unread", response_model=dict)
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Get unread notification count."""
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    return {"count": result.scalar() or 0}


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
    """
    Create a notification for yourself, or for another user if you
    administer users. System-generated notifications use the service
    layer directly, so this endpoint must not allow arbitrary targeting.
    """
    if str(notification_data.user_id) != str(current_user.id):
        allowed = await PermissionService.has_permission(
            db, current_user.id, "users.manage"
        )
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only create notifications for yourself",
            )

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