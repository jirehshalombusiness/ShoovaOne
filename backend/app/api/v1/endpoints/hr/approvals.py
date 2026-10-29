from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_active_user, require_permission, Permissions
from app.models.sql.hr.approval import ApprovalRequest, ApprovalComment
from app.models.sql.core.user import User, Person
from app.models.sql.core.audit_log import AuditLog
from app.services.hr import approval_service
from app.services.hr import leave_service
from app.services.core.audit_service import AuditService


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
    stage: str
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
    approved_amount: Optional[Decimal] = Field(
        default=None,
        gt=0,
        description="Fund requests only: amount approved at the finance stage.",
    )


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


def _stage_label(request: ApprovalRequest) -> str:
    """
    Human-readable stage for the workflow.

    Compensation requests use their own HR -> CEO flow; generic
    approvals use manager -> HR -> exec.
    """
    if request.entity_type == "compensation_request":
        # Level 1 is kept for rows escalated before the stage fix.
        return "ceo" if request.escalation_level >= 1 else "hr"

    if request.entity_type == "fund_request":
        if request.stage:
            return request.stage
        return {0: "manager", 1: "finance", 2: "ceo"}.get(
            request.escalation_level, "manager"
        )

    return {0: "manager", 1: "hr", 2: "exec"}.get(
        request.escalation_level, "manager"
    )


async def _enrich_detail(
    db: AsyncSession,
    request: ApprovalRequest,
) -> Optional[ApprovalDetailLink]:
    """
    Attach domain-specific context so approvers can decide without
    leaving the approval screen.
    """
    if request.entity_type == "employee_change":
        metadata = await approval_service.get_creation_metadata(
            db,
            request_id=request.id,
            entity_type=request.entity_type,
            entity_id=request.entity_id,
        )
        changes = (metadata or {}).get("employee_change")
        if not changes:
            return None

        from app.models.sql.core.user import Person

        person = (
            await db.execute(select(Person).where(Person.id == request.entity_id))
        ).scalar_one_or_none()

        current = (
            {key: getattr(person, key, None) for key in changes}
            if person is not None
            else {}
        )

        # Once applied, show the values from before the change so the
        # approved diff stays meaningful in the request history.
        if request.status != "pending":
            applied_log = (
                await db.execute(
                    select(AuditLog)
                    .where(
                        AuditLog.entity_type == "person",
                        AuditLog.entity_id == request.entity_id,
                        AuditLog.action == "EMPLOYEE_CHANGE_APPLIED",
                    )
                    .order_by(AuditLog.created_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if applied_log and isinstance(applied_log.old_values, dict):
                current.update(
                    {
                        key: value
                        for key, value in applied_log.old_values.items()
                        if key in changes
                    }
                )

        async def _name(manager_id) -> Optional[str]:
            if not manager_id:
                return None
            manager = (
                await db.execute(select(Person).where(Person.id == manager_id))
            ).scalar_one_or_none()
            return f"{manager.first_name} {manager.last_name}" if manager else None

        proposed_manager = await _name(changes.get("reports_to_id"))
        current_manager = (
            await _name(current.get("reports_to_id"))
            if "reports_to_id" in changes
            else None
        )

        return ApprovalDetailLink(
            kind="employee_change",
            payload={
                "changes": changes,
                "current": current,
                "reports_to_name": proposed_manager,
                "current_reports_to_name": current_manager,
            },
        )

    if request.entity_type == "fund_request":
        from app.models.sql.core.document import Document
        from app.models.sql.finance.fund_request import FundRequest

        fund = (
            await db.execute(
                select(FundRequest).where(
                    FundRequest.id == request.entity_id
                )
            )
        ).scalar_one_or_none()

        if not fund:
            return None

        documents = (
            await db.execute(
                select(Document)
                .where(
                    Document.related_entity_type == "fund_request",
                    Document.related_entity_id == fund.id,
                    Document.deleted_at.is_(None),
                )
                .order_by(Document.created_at.desc())
            )
        ).scalars().all()

        return ApprovalDetailLink(
            kind="fund_request",
            payload={
                "request_number": fund.request_number,
                "request_type": fund.request_type,
                "title": fund.title,
                "description": fund.description,
                "justification": fund.justification,
                "amount_requested": str(fund.amount_requested),
                "approved_amount": (
                    str(fund.approved_amount)
                    if fund.approved_amount is not None
                    else None
                ),
                "amount_disbursed": str(fund.amount_disbursed),
                "currency": fund.currency,
                "expense_date": (
                    fund.expense_date.isoformat()
                    if fund.expense_date
                    else None
                ),
                "required_by_date": (
                    fund.required_by_date.isoformat()
                    if fund.required_by_date
                    else None
                ),
                "status": fund.status,
                "current_stage": fund.current_stage,
                "documents": [
                    {
                        "id": str(document.id),
                        "name": document.name,
                        "file_url": document.file_url,
                        "mime_type": document.mime_type,
                        "category": document.type,
                    }
                    for document in documents
                ],
            },
        )

    if request.entity_type != "leave_request":
        return None

    from app.models.sql.hr.leave import LeaveRequest

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

    # Older employee-change rows embedded the payload in the summary;
    # keep it out of the UI now that it is stored structurally.
    summary = request.summary
    if summary and " | payload=" in summary:
        summary = summary.split(" | payload=")[0]

    return ApprovalSummary(
        id=request.id,
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        title=request.title,
        summary=summary,
        status=request.status,
        priority=request.priority,
        stage=_stage_label(request),
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

    # Internal notes are for HR approvers only — never expose them to
    # the requester through the API.
    can_view_internal = await approval_service._person_has_any_role(
        db,
        actor_person_id,
        approval_service.HR_APPROVER_ROLES,
    )

    comments: List[ApprovalCommentResponse] = []
    for c in request.comments or []:
        if c.is_internal and not can_view_internal:
            continue
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

    detail = await _enrich_detail(db, request)

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

    # Scope filters apply to every count below.
    scope_filters = []

    if entity_types:
        types = [t.strip() for t in entity_types.split(",") if t.strip()]
        if types:
            scope_filters.append(ApprovalRequest.entity_type.in_(types))

    # Assignment scope
    if assigned_to_me and not include_all_if_hr:
        scope_filters.append(ApprovalRequest.assigned_to_id == actor_person_id)
    else:
        # If include_all_if_hr is set, verify the actor has HR approver role.
        is_hr = await approval_service._person_has_any_role(
            db,
            actor_person_id,
            approval_service.HR_APPROVER_ROLES,
        )

        if not (is_hr and include_all_if_hr):
            # fall back to only assigned
            scope_filters.append(
                ApprovalRequest.assigned_to_id == actor_person_id
            )

    # Status filter only applies to the item list.
    filters = list(scope_filters)
    if status_filter and status_filter != "all":
        filters.append(ApprovalRequest.status == status_filter)

    # Count query
    count_query = select(func.count(ApprovalRequest.id))
    if filters:
        count_query = count_query.where(*filters)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Pending count for the active scope — not just the status tab.
    pending_query = select(func.count(ApprovalRequest.id)).where(
        *scope_filters,
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
# READ — ORG-WIDE STATS
# ============================================================

@router.get(
    "/stats/overview",
    response_model=ApprovalStats,
    dependencies=[Depends(require_permission(Permissions.HR_VIEW_LEAVE))],
)
async def get_approval_overview(
    db: AsyncSession = Depends(get_db),
):
    """Org-wide approval counts for the HR shell and overview."""
    stats = await approval_service.overview_stats(db)
    return ApprovalStats(**stats)


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
    if request.entity_type == "leave_request":
        await leave_service.approve_leave_request(
            db,
            actor=current_user,
            leave_request_id=request.entity_id,
            note=payload.note,
        )
        await db.flush()

    elif request.entity_type == "compensation_request":
        # Two-stage flow: HR approves → moves to CEO → CEO approves → done
        from app.services.hr import compensation_request_service

        result = await compensation_request_service.approve_stage(
            db,
            request=request,
            actor=current_user,
            note=payload.note,
        )

        if result["next_stage"] == "ceo":
            # Escalate the approval inbox item to CEO
            await approval_service.escalate_to_ceo(
                db,
                request_id=request_id,
                actor=current_user,
            )
            # Approval stays pending (now assigned to CEO)
        else:
            # CEO approved — finalize the approval record too
            await approval_service.approve(
                db,
                request_id=request_id,
                actor=current_user,
                note=payload.note,
            )

    elif request.entity_type == "fund_request":
        # Manager -> Finance -> CEO chain; the domain service enforces
        # stage authority and routes the next stage.
        from app.services.finance import fund_request_service

        await fund_request_service.decide(
            db,
            approval=request,
            actor=current_user,
            approve=True,
            note=payload.note,
            approved_amount=payload.approved_amount,
        )

    elif request.entity_type == "employee_change":
        # Apply the approved structural change, then close the request.
        from app.services.hr import employee_change_service

        metadata = await approval_service.get_creation_metadata(
            db,
            request_id=request_id,
            entity_type=request.entity_type,
            entity_id=request.entity_id,
        )
        changes = (metadata or {}).get("employee_change")

        if not changes:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This employee change has no structured payload and "
                    "cannot be applied automatically. Apply it manually "
                    "and close the request."
                ),
            )

        result = await employee_change_service.apply_employee_change(
            db,
            person_id=request.entity_id,
            changes=changes,
        )
        await AuditService.log(
            db=db,
            actor=current_user,
            action="EMPLOYEE_CHANGE_APPLIED",
            entity_type="person",
            entity_id=request.entity_id,
            description=(
                f"Applied approved employee change for "
                f"{result['person'].first_name} {result['person'].last_name}"
            ),
            old_values=result["old_values"],
            new_values=result["applied"],
        )
        await approval_service.approve(
            db,
            request_id=request_id,
            actor=current_user,
            note=payload.note,
        )

    elif request.entity_type == "compensation_change":
        # HR-initiated compensation change (existing flow)
        await approval_service.approve(
            db,
            request_id=request_id,
            actor=current_user,
            note=payload.note,
        )
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

    elif request.entity_type == "compensation_request":
        # Two-stage: reject at either stage ends the request
        from app.services.hr import compensation_request_service

        await compensation_request_service.reject_stage(
            db,
            request=request,
            actor=current_user,
            note=payload.note,
        )
        # Mark the approval record as rejected too
        await approval_service.reject(
            db,
            request_id=request_id,
            actor=current_user,
            note=payload.note,
        )

    elif request.entity_type == "compensation_change":
        # HR-initiated compensation change (existing flow)
        await approval_service.reject(
            db,
            request_id=request_id,
            actor=current_user,
            note=payload.note,
        )

    elif request.entity_type == "fund_request":
        from app.services.finance import fund_request_service

        await fund_request_service.decide(
            db,
            approval=request,
            actor=current_user,
            approve=False,
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

    if request.entity_type in {"compensation_request", "fund_request"}:
        raise HTTPException(
            status_code=400,
            detail=(
                "This request follows a fixed stage workflow and cannot "
                "be manually escalated"
            ),
        )

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