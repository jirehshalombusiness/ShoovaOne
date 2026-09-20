from datetime import datetime, timezone
from typing import List, Optional
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_active_user, require_permission, Permissions
from app.models.sql.approval import ApprovalRequest, ApprovalComment
from app.models.sql.user import User, Person
from app.services import approval_service
from app.services import leave_service
from app.services.audit_service import AuditService


router = APIRouter()


# ============================================================
# ENUMS
# ============================================================

class ApprovalStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"


class ApprovalPriority(str, Enum):
    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"


# ============================================================
# SCHEMAS
# ============================================================

class ApprovalRequesterInfo(BaseModel):
    id: str
    first_name: str
    last_name: str
    profile_image_url: Optional[str] = None
    job_title: Optional[str] = None


class ApprovalDetailLink(BaseModel):
    """
    Optional deep-link to the underlying entity.
    Populated when we can enrich the request (e.g. leave detail).
    """
    kind: str
    payload: Optional[dict] = None


class ApprovalCommentResponse(BaseModel):
    id: str
    author_id: str
    author_name: str
    author_image: Optional[str] = None
    body: str
    is_internal: bool
    created_at: str


class ApprovalSummary(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    title: str
    summary: Optional[str] = None
    status: str
    priority: str
    escalation_level: int
    due_at: Optional[str] = None
    escalated_at: Optional[str] = None
    created_at: str
    requested_by: ApprovalRequesterInfo
    assigned_to_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    decided_at: Optional[str] = None
    decided_by_id: Optional[str] = None
    decided_by_name: Optional[str] = None
    decision_note: Optional[str] = None
    can_act: bool = False


class ApprovalDetail(ApprovalSummary):
    comments: List[ApprovalCommentResponse] = []
    detail: Optional[ApprovalDetailLink] = None


class ApprovalListResponse(BaseModel):
    items: List[ApprovalSummary]
    total: int
    pending: int


class ApprovalStats(BaseModel):
    pending: int
    approved: int
    rejected: int
    cancelled: int
    overdue: int
    by_type: dict


class ApprovalDecisionRequest(BaseModel):
    note: Optional[str] = Field(None, max_length=2000)


class ApprovalRejectRequest(BaseModel):
    note: str = Field(..., min_length=1, max_length=2000)


class ApprovalCommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)
    is_internal: bool = False


# ============================================================
# HELPERS
# ============================================================

def _iso(d) -> Optional[str]:
    if d is None:
        return None
    return d.isoformat()


def _person_name(p: Optional[Person]) -> str:
    if not p:
        return "Unknown"
    return f"{p.first_name} {p.last_name}".strip()


async def _enrich_leave_detail(
    db: AsyncSession,
    request: ApprovalRequest,
) -> Optional[ApprovalDetailLink]:
    """
    If the request is for a leave request, pull the actual leave data.
    """
    if request.entity_type != "leave_request":
        return None

    from app.models.sql.leave import LeaveRequest

    result = await db.execute(
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.leave_type))
        .where(LeaveRequest.id == request.entity_id)
    )
    leave = result.scalar_one_or_none()

    if not leave:
        return None

    return ApprovalDetailLink(
        kind="leave_request",
        payload={
            "leave_type_name": leave.leave_type.name if leave.leave_type else None,
            "leave_type_color": leave.leave_type.color if leave.leave_type else None,
            "start_date": leave.start_date.isoformat(),
            "end_date": leave.end_date.isoformat(),
            "total_days": float(leave.total_days),
            "reason": leave.reason,
            "leave_status": leave.status,
        },
    )


async def _to_summary(
    db: AsyncSession,
    request: ApprovalRequest,
    *,
    actor_person_id: Optional[str],
) -> ApprovalSummary:
    can_act = False
    if actor_person_id:
        can_act = await approval_service.can_act_on(
            db,
            actor_person_id=actor_person_id,
            request=request,
        )

    return ApprovalSummary(
        id=request.id,
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        title=request.title,
        summary=request.summary,
        status=request.status,
        priority=request.priority,
        escalation_level=request.escalation_level,
        due_at=_iso(request.due_at),
        escalated_at=_iso(request.escalated_at),
        created_at=_iso(request.created_at) or "",
        requested_by=ApprovalRequesterInfo(
            id=request.requested_by_id,
            first_name=request.requested_by.first_name if request.requested_by else "",
            last_name=request.requested_by.last_name if request.requested_by else "",
            profile_image_url=(
                request.requested_by.profile_image_url if request.requested_by else None
            ),
            job_title=request.requested_by.job_title if request.requested_by else None,
        ),
        assigned_to_id=request.assigned_to_id,
        assigned_to_name=_person_name(request.assigned_to),
        decided_at=_iso(request.decided_at),
        decided_by_id=request.decided_by_id,
        decided_by_name=_person_name(request.decided_by),
        decision_note=request.decision_note,
        can_act=can_act,
    )


async def _to_detail(
    db: AsyncSession,
    request: ApprovalRequest,
    *,
    actor_person_id: Optional[str],
) -> ApprovalDetail:
    summary = await _to_summary(db, request, actor_person_id=actor_person_id)

    comments: List[ApprovalCommentResponse] = []
    for c in request.comments or []:
        comments.append(
            ApprovalCommentResponse(
                id=c.id,
                author_id=c.author_person_id,
                author_name=_person_name(c.author),
                author_image=c.author.profile_image_url if c.author else None,
                body=c.body,
                is_internal=c.is_internal,
                created_at=_iso(c.created_at) or "",
            )
        )

    detail = await _enrich_leave_detail(db, request)

    return ApprovalDetail(
        **summary.model_dump(),
        comments=comments,
        detail=detail,
    )


# ============================================================
# READ — INBOX
# ============================================================

@router.get("", response_model=ApprovalListResponse)
async def list_inbox(
    status_filter: Optional[str] = Query("pending", alias="status"),
    entity_types: Optional[str] = Query(None, description="Comma-separated"),
    assigned_to_me: bool = Query(True),
    include_all_if_hr: bool = Query(
        False,
        description=(
            "If true and the actor has HR approver role, returns all "
            "pending requests, not just ones assigned to them."
        ),
    ),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Approval inbox.

    Defaults:
    - status = pending
    - assigned_to_me = true
    - all entity types

    If `include_all_if_hr=true` and the actor is an HR approver, returns
    every pending request regardless of assignment.
    """
    if not current_user.person_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account is not linked to an employee record",
        )

    actor_person_id = current_user.person_id

    # Build filters
    filters = []

    if status_filter and status_filter != "all":
        filters.append(ApprovalRequest.status == status_filter)

    if entity_types:
        types = [t.strip() for t in entity_types.split(",") if t.strip()]
        if types:
            filters.append(ApprovalRequest.entity_type.in_(types))

    # Assignment scope
    if assigned_to_me and not include_all_if_hr:
        filters.append(ApprovalRequest.assigned_to_id == actor_person_id)
    else:
        # If include_all_if_hr is set, verify the actor has HR approver role.
        is_hr = await approval_service._person_has_any_role(
            db,
            actor_person_id,
            approval_service.HR_APPROVER_ROLES,
        )

        if is_hr and include_all_if_hr:
            # no assignment filter — show all pending
            pass
        else:
            # fall back to only assigned
            filters.append(ApprovalRequest.assigned_to_id == actor_person_id)

    # Count query
    count_query = select(func.count(ApprovalRequest.id))
    if filters:
        count_query = count_query.where(*filters)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Pending count (independent of status_filter)
    pending_query = select(func.count(ApprovalRequest.id)).where(
        ApprovalRequest.assigned_to_id == actor_person_id,
        ApprovalRequest.status == "pending",
    )
    pending_result = await db.execute(pending_query)
    pending_count = pending_result.scalar() or 0

    # Items query
    query = (
        select(ApprovalRequest)
        .options(
            selectinload(ApprovalRequest.requested_by),
            selectinload(ApprovalRequest.assigned_to),
            selectinload(ApprovalRequest.decided_by),
        )
    )
    if filters:
        query = query.where(*filters)

    query = (
        query
        .order_by(
            ApprovalRequest.priority.desc(),
            ApprovalRequest.due_at.asc().nullslast(),
            ApprovalRequest.created_at.desc(),
        )
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(query)
    requests = list(result.scalars().all())

    items = [
        await _to_summary(db, r, actor_person_id=actor_person_id)
        for r in requests
    ]

    return ApprovalListResponse(
        items=items,
        total=total,
        pending=pending_count,
    )


# ============================================================
# READ — DETAIL
# ============================================================

@router.get("/{request_id}", response_model=ApprovalDetail)
async def get_approval_detail(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Full detail for a single approval request, including comments.

    Visible to:
    - the requester
    - the current approver
    - HR approver roles
    """
    if not current_user.person_id:
        raise HTTPException(status_code=400, detail="No linked employee record")

    actor_person_id = current_user.person_id

    request = await approval_service.get_request(db, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")

    is_involved = (
        actor_person_id == request.requested_by_id
        or actor_person_id == request.assigned_to_id
        or await approval_service._person_has_any_role(
            db, actor_person_id, approval_service.HR_APPROVER_ROLES
        )
    )

    if not is_involved:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to view this request",
        )

    return await _to_detail(db, request, actor_person_id=actor_person_id)


# ============================================================
# ACTIONS
# ============================================================

@router.post("/{request_id}/approve", response_model=ApprovalDetail)
async def approve_request(
    request_id: str,
    payload: ApprovalDecisionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Approve an approval request.

    Side effects depend on entity_type:
    - leave_request: settles leave balance, updates LeaveRequest
    - timesheet:     (future) marks timesheet approved
    - document:      (future) marks document verified

    All authorization is delegated to `approval_service.can_act_on`.
    """
    request = await approval_service.get_request(db, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")

    # Route to the correct domain handler.
    # Route to the correct domain handler.
    if request.entity_type == "leave_request":
        await leave_service.approve_leave_request(
            db,
            actor=current_user,
            leave_request_id=request.entity_id,
            note=payload.note,
        )
        await db.flush()

    elif request.entity_type == "compensation_change":
        # First flip the approval record
        await approval_service.approve(
            db,
            request_id=request_id,
            actor=current_user,
            note=payload.note,
        )
        # Then finalize the compensation change
        from app.api.v1.endpoints.hr.compensation import (
            finalize_compensation_change,
        )
        await finalize_compensation_change(
            db,
            change_id=request.entity_id,
            approver_person_id=current_user.person_id,
        )

    else:
        await approval_service.approve(
            db,
            request_id=request_id,
            actor=current_user,
            note=payload.note,
        )

    await db.commit()

    # Reload fresh
    request = await approval_service.get_request(db, request_id)
    return await _to_detail(db, request, actor_person_id=current_user.person_id)


@router.post("/{request_id}/reject", response_model=ApprovalDetail)
async def reject_request(
    request_id: str,
    payload: ApprovalRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Reject an approval request. A non-empty note is required.
    """
    request = await approval_service.get_request(db, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")

    if request.entity_type == "leave_request":
        await leave_service.reject_leave_request(
            db,
            actor=current_user,
            leave_request_id=request.entity_id,
            note=payload.note,
        )
        await db.flush()

    elif request.entity_type == "compensation_change":
        # For compensation, rejecting the approval just means the change
        # is not applied. The CompensationChange row stays in the DB with
        # approved_at = NULL. HR can edit or delete it, or submit a new
        # one later. Nothing needs to be rolled back.
        await approval_service.reject(
            db,
            request_id=request_id,
            actor=current_user,
            note=payload.note,
        )

    else:
        await approval_service.reject(
            db,
            request_id=request_id,
            actor=current_user,
            note=payload.note,
        )

    await db.commit()

    request = await approval_service.get_request(db, request_id)
    return await _to_detail(db, request, actor_person_id=current_user.person_id)


@router.post("/{request_id}/escalate", response_model=ApprovalDetail)
async def escalate_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Manually escalate a pending request to the next level:
        manager -> HR -> exec
    """
    request = await approval_service.get_request(db, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")

    # Only the current assignee or an HR approver may escalate.
    actor_person_id = current_user.person_id
    can_escalate = (
        actor_person_id == request.assigned_to_id
        or await approval_service._person_has_any_role(
            db, actor_person_id, approval_service.HR_APPROVER_ROLES
        )
    )

    if not can_escalate:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to escalate this request",
        )

    await approval_service.escalate(
        db,
        request_id=request_id,
        actor=current_user,
    )
    await db.commit()

    request = await approval_service.get_request(db, request_id)
    return await _to_detail(db, request, actor_person_id=actor_person_id)


# ============================================================
# COMMENTS
# ============================================================

@router.post(
    "/{request_id}/comments",
    response_model=ApprovalCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_comment(
    request_id: str,
    payload: ApprovalCommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Post a comment on an approval request.

    Internal comments (is_internal=true) are visible only to HR
    approver roles.
    """
    comment = await approval_service.add_comment(
        db,
        request_id=request_id,
        actor=current_user,
        body=payload.body,
        is_internal=payload.is_internal,
    )

    await db.commit()
    await db.refresh(comment)

    return ApprovalCommentResponse(
        id=comment.id,
        author_id=comment.author_person_id,
        author_name=_person_name(comment.author),
        author_image=comment.author.profile_image_url if comment.author else None,
        body=comment.body,
        is_internal=comment.is_internal,
        created_at=comment.created_at.isoformat() if comment.created_at else "",
    )


# ============================================================
# STATS
# ============================================================

@router.get("/stats/me", response_model=ApprovalStats)
async def get_my_approval_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Counts for the sidebar badge and dashboard widget."""
    if not current_user.person_id:
        raise HTTPException(status_code=400, detail="No linked employee record")

    stats = await approval_service.inbox_stats(
        db,
        person_id=current_user.person_id,
    )
    return ApprovalStats(**stats)


# ============================================================
# HR ADMIN — TEAM / GLOBAL VIEW
# ============================================================

@router.get(
    "/admin/all",
    response_model=ApprovalListResponse,
    dependencies=[Depends(require_permission(Permissions.HR_VIEW_LEAVE))],
)
async def list_all_approvals_admin(
    status_filter: Optional[str] = Query("pending", alias="status"),
    entity_types: Optional[str] = Query(None),
    requested_by_id: Optional[str] = Query(None),
    assigned_to_id: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    HR oversight view — every approval, regardless of assignment.

    Requires hr.view_leave.
    """
    filters = []

    if status_filter and status_filter != "all":
        filters.append(ApprovalRequest.status == status_filter)

    if entity_types:
        types = [t.strip() for t in entity_types.split(",") if t.strip()]
        if types:
            filters.append(ApprovalRequest.entity_type.in_(types))

    if requested_by_id:
        filters.append(ApprovalRequest.requested_by_id == requested_by_id)

    if assigned_to_id:
        filters.append(ApprovalRequest.assigned_to_id == assigned_to_id)

    count_query = select(func.count(ApprovalRequest.id))
    if filters:
        count_query = count_query.where(*filters)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        select(ApprovalRequest)
        .options(
            selectinload(ApprovalRequest.requested_by),
            selectinload(ApprovalRequest.assigned_to),
            selectinload(ApprovalRequest.decided_by),
        )
    )
    if filters:
        query = query.where(*filters)

    query = (
        query
        .order_by(
            ApprovalRequest.priority.desc(),
            ApprovalRequest.due_at.asc().nullslast(),
            ApprovalRequest.created_at.desc(),
        )
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(query)
    requests = list(result.scalars().all())

    items = [
        await _to_summary(db, r, actor_person_id=current_user.person_id)
        for r in requests
    ]

    return ApprovalListResponse(
        items=items,
        total=total,
        pending=sum(1 for i in items if i.status == "pending"),
    )