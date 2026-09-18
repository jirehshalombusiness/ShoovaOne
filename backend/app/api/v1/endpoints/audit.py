from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_permission
from app.models.sql.audit_log import AuditLog
from app.models.sql.user import User



router = APIRouter()


@router.get(
    "",
    summary="List audit logs",
)
async def list_audit_logs(
    action: Optional[str] = Query(
        default=None,
        description="Filter by audit action, e.g. USER_CREATED",
    ),
    entity_type: Optional[str] = Query(
        default=None,
        description="Filter by entity type, e.g. user, person, timesheet",
    ),
    actor_user_id: Optional[str] = Query(
        default=None,
        description="Filter by the user who performed the action",
    ),
    entity_id: Optional[str] = Query(
        default=None,
        description="Filter by the affected entity ID",
    ),
    start_date: Optional[datetime] = Query(
        default=None,
        description="Return records created on or after this date/time",
    ),
    end_date: Optional[datetime] = Query(
        default=None,
        description="Return records created on or before this date/time",
    ),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(
        require_permission("audit.view")
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Return a paginated list of audit logs.

    Audit logs are read-only through this API.
    There are deliberately no update or delete endpoints.
    """

    query = (
        select(AuditLog)
        .options(
            selectinload(AuditLog.actor)
        )
    )

    count_query = select(
        func.count(AuditLog.id)
    )

    filters = []

    if action:
        filters.append(AuditLog.action == action)

    if entity_type:
        filters.append(
            AuditLog.entity_type == entity_type
        )

    if actor_user_id:
        filters.append(
            AuditLog.actor_user_id == actor_user_id
        )

    if entity_id:
        filters.append(
            AuditLog.entity_id == entity_id
        )

    if start_date:
        filters.append(
            AuditLog.created_at >= start_date
        )

    if end_date:
        filters.append(
            AuditLog.created_at <= end_date
        )

    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    offset = (page - 1) * page_size

    result = await db.execute(
        query
        .order_by(desc(AuditLog.created_at))
        .offset(offset)
        .limit(page_size)
    )

    logs = result.scalars().all()

    return {
        "items": [
            {
                "id": str(log.id),
                "actor_user_id": (
                    str(log.actor_user_id)
                    if log.actor_user_id
                    else None
                ),
                "actor_person_id": (
                    str(log.actor_person_id)
                    if log.actor_person_id
                    else None
                ),
                "actor_name": (
                    (
                        f"{log.actor.first_name} "
                        f"{log.actor.last_name}"
                    ).strip()
                    if log.actor
                    else None
                ),
                "actor_email": (
                    log.actor.email
                    if log.actor
                    else None
                ),
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": str(log.entity_id),
                "description": log.description,
                "old_values": log.old_values,
                "new_values": log.new_values,
                "metadata": log.metadata_,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "created_at": log.created_at,
            }
            for log in logs
        ],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (
                (total + page_size - 1) // page_size
                if total
                else 0
            ),
        },
    }


@router.get(
    "/stats/summary",
    summary="Get audit log summary",
)
async def audit_summary(
    current_user: User = Depends(
        require_permission("audit.view")
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Return a simple audit summary for dashboards.
    """

    total_result = await db.execute(
        select(func.count(AuditLog.id))
    )

    total = total_result.scalar_one()

    actions_result = await db.execute(
        select(
            AuditLog.action,
            func.count(AuditLog.id).label("count"),
        )
        .group_by(AuditLog.action)
        .order_by(desc(func.count(AuditLog.id)))
    )

    actions = [
        {
            "action": row.action,
            "count": row.count,
        }
        for row in actions_result.all()
    ]

    entities_result = await db.execute(
        select(
            AuditLog.entity_type,
            func.count(AuditLog.id).label("count"),
        )
        .group_by(AuditLog.entity_type)
        .order_by(desc(func.count(AuditLog.id)))
    )

    entities = [
        {
            "entity_type": row.entity_type,
            "count": row.count,
        }
        for row in entities_result.all()
    ]

    return {
        "total": total,
        "actions": actions,
        "entities": entities,
    }


@router.get(
    "/{audit_id}",
    summary="Get an audit log",
)
async def get_audit_log(
    audit_id: str,
    current_user: User = Depends(
        require_permission("audit.view")
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Return one audit log record.

    Audit records are immutable through this API.
    """

    result = await db.execute(
        select(AuditLog)
        .options(
            selectinload(AuditLog.actor)
        )
        .where(AuditLog.id == audit_id)
    )

    log = result.scalar_one_or_none()

    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit log not found",
        )

    return {
        "id": str(log.id),
        "actor_user_id": (
            str(log.actor_user_id)
            if log.actor_user_id
            else None
        ),
        "actor_person_id": (
            str(log.actor_person_id)
            if log.actor_person_id
            else None
        ),
        "actor_name": (
            (
                f"{log.actor.first_name} "
                f"{log.actor.last_name}"
            ).strip()
            if log.actor
            else None
        ),
        "actor_email": (
            log.actor.email
            if log.actor
            else None
        ),
        "action": log.action,
        "entity_type": log.entity_type,
        "entity_id": str(log.entity_id),
        "description": log.description,
        "old_values": log.old_values,
        "new_values": log.new_values,
        "metadata": log.metadata_,
        "ip_address": log.ip_address,
        "user_agent": log.user_agent,
        "created_at": log.created_at,
    }
   