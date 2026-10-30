from datetime import datetime, timedelta, timezone
from typing import Optional, List, Sequence
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select, or_, and_, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.sql.hr.approval import ApprovalRequest, ApprovalComment
from app.models.sql.core.user import User, Person
from app.models.sql.core.role import Role
from app.models.sql.core.audit_log import AuditLog
from app.models.sql.core.notification import Notification
from app.services.core.audit_service import AuditService


# ============================================================
# CONSTANTS
# ============================================================

ESCALATION_LEVELS = {
    0: "manager",
    1: "hr",
    2: "exec",
}

# Who can see and administer HR approvals. Directors are intentionally
# excluded: they can be *assigned* a request, but they do not get
# blanket authority over every employee's approvals.
HR_APPROVER_ROLES = {"head_of_hr", "executive_director", "ceo"}

# Roles allowed to decide a request that was not assigned to them.
# Every override is recorded on the approval audit trail.
APPROVAL_OVERRIDE_ROLES = HR_APPROVER_ROLES

# Default SLA per entity type, in hours.
DEFAULT_SLA_HOURS = {
    "leave_request": 72,
    "timesheet": 48,
    "document_verification": 120,
    "profile_change": 120,
    "compensation_change": 168,
    "contract_renewal": 168,
    "termination": 72,
    "fund_request": 48,
    "device_request": 48,
}


# ============================================================
# HELPERS
# ============================================================

async def _person_has_any_role(
    db: AsyncSession,
    person_id: str,
    role_names: set[str],
) -> bool:
    """Return True if the person's user account has any of the given roles."""
    if not role_names:
        return False

    result = await db.execute(
        select(func.count(User.id))
        .join(User.roles)
        .where(
            User.person_id == person_id,
            Role.name.in_(role_names),
        )
    )
    return (result.scalar() or 0) > 0


async def _get_person_user_id(db: AsyncSession, person_id: str) -> Optional[str]:
    result = await db.execute(
        select(User.id).where(User.person_id == person_id)
    )
    return result.scalar_one_or_none()


async def _is_active_approver(db: AsyncSession, person_id: Optional[str]) -> bool:
    """A person can only approve if they have an active user account."""
    if not person_id:
        return False
    result = await db.execute(
        select(func.count(User.id)).where(
            User.person_id == person_id,
            User.is_active.is_(True),
        )
    )
    return (result.scalar() or 0) > 0


async def _person_display_name(db: AsyncSession, person_id: str) -> str:
    result = await db.execute(
        select(Person.first_name, Person.last_name).where(Person.id == person_id)
    )
    row = result.first()
    if not row:
        return "Someone"
    return f"{row[0]} {row[1]}".strip()


async def _notify_person(
    db: AsyncSession,
    *,
    person_id: Optional[str],
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
    type: str = "approval",
) -> None:
    """Attach a notification to a person's active user account, if one exists."""
    if not person_id:
        return
    result = await db.execute(
        select(User).where(
            User.person_id == person_id,
            User.is_active.is_(True),
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        return

    db.add(
        Notification(
            id=str(uuid.uuid4()),
            user_id=user.id,
            title=title,
            body=body,
            type=type,
            link=link,
        )
    )


async def _resolve_manager_person_id(db: AsyncSession, person_id: str) -> Optional[str]:
    """Return the person_id of the direct manager, if any."""
    result = await db.execute(
        select(Person.reports_to_id).where(Person.id == person_id)
    )
    return result.scalar_one_or_none()


async def _find_hr_approver(
    db: AsyncSession,
    *,
    exclude_person_id: Optional[str] = None,
) -> Optional[str]:
    """
    Pick an HR approver. Preference order:
        head_of_hr -> executive_director -> ceo
    Returns a person_id or None.
    """
    preference = ["head_of_hr", "executive_director", "ceo"]

    for role_name in preference:
        query = (
            select(User.person_id)
            .join(User.roles)
            .where(
                Role.name == role_name,
                User.is_active.is_(True),
            )
        )
        if exclude_person_id:
            query = query.where(User.person_id != exclude_person_id)

        result = await db.execute(query.limit(1))
        person_id = result.scalar_one_or_none()
        if person_id:
            return person_id

    return None


async def _find_exec_approver(
    db: AsyncSession,
    *,
    exclude_person_id: Optional[str] = None,
) -> Optional[str]:
    """Pick an exec approver. Preference: executive_director -> ceo."""
    preference = ["executive_director", "ceo"]

    for role_name in preference:
        query = (
            select(User.person_id)
            .join(User.roles)
            .where(
                Role.name == role_name,
                User.is_active.is_(True),
            )
        )
        if exclude_person_id:
            query = query.where(User.person_id != exclude_person_id)

        result = await db.execute(query.limit(1))
        person_id = result.scalar_one_or_none()
        if person_id:
            return person_id

    return None


# ============================================================
# CREATE
# ============================================================

async def create_request(
    db: AsyncSession,
    *,
    entity_type: str,
    entity_id: str,
    requested_by_id: str,
    title: str,
    summary: Optional[str] = None,
    priority: str = "normal",
    assigned_to_id: Optional[str] = None,
    due_hours: Optional[int] = None,
    metadata: Optional[dict] = None,
    escalation_level: int = 0,
    stage: Optional[str] = None,
    enforce_assignment_policy: bool = True,
) -> ApprovalRequest:
    """
    Create an approval request.

    If assigned_to_id is not provided, routing is:
        manager -> HR -> exec
    based on the requester's reporting line.

    Explicit assignments are validated rather than silently rerouted:
    - the assignee must have an active user account
    - the requester cannot assign themselves
    - level 0 must be the requester's manager or an HR approver
    - higher levels must be HR approvers

    Domains whose ladder is not manager -> HR -> exec (for example a
    fund request's manager -> finance -> CEO chain) pass
    `enforce_assignment_policy=False`; they validate stage authority
    themselves before routing here.

    Raises if no approver can be resolved.
    """

    # ---------- resolve approver ----------
    if assigned_to_id is None:
        # A manager can only receive the request if they have an active
        # user account; otherwise it goes straight to HR.
        manager_id = await _resolve_manager_person_id(db, requested_by_id)

        if (
            manager_id
            and manager_id != requested_by_id
            and await _is_active_approver(db, manager_id)
        ):
            assigned_to_id = manager_id
        else:
            assigned_to_id = await _find_hr_approver(
                db, exclude_person_id=requested_by_id
            )
    else:
        if assigned_to_id == requested_by_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot assign an approval request to yourself",
            )

        if not await _is_active_approver(db, assigned_to_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "The selected approver does not have an active "
                    "user account"
                ),
            )

        if enforce_assignment_policy:
            is_hr_approver = await _person_has_any_role(
                db, assigned_to_id, HR_APPROVER_ROLES
            )

            if escalation_level == 0:
                manager_id = await _resolve_manager_person_id(db, requested_by_id)
                if assigned_to_id != manager_id and not is_hr_approver:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=(
                            "An approver must be your direct manager or hold "
                            "an HR approver role"
                        ),
                    )
            elif not is_hr_approver:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Approvals above the manager stage must be assigned to "
                        "an HR approver"
                    ),
                )

    if assigned_to_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "No approver could be resolved for this request. "
                "Set a manager or ensure an HR role exists."
            ),
        )

    # ---------- SLA ----------
    if due_hours is None:
        due_hours = DEFAULT_SLA_HOURS.get(entity_type, 72)

    due_at = datetime.now(timezone.utc) + timedelta(hours=due_hours)

    request = ApprovalRequest(
        id=str(uuid.uuid4()),
        entity_type=entity_type,
        entity_id=entity_id,
        requested_by_id=requested_by_id,
        assigned_to_id=assigned_to_id,
        status="pending",
        priority=priority,
        escalation_level=escalation_level,
        stage=stage,
        due_at=due_at,
        title=title,
        summary=summary,
    )

    db.add(request)
    await db.flush()

    await AuditService.log(
        db=db,
        action="APPROVAL_CREATED",
        entity_type=entity_type,
        entity_id=entity_id,
        description=f"Approval requested: {title}",
        new_values={
            "approval_id": request.id,
            "assigned_to_id": assigned_to_id,
            "escalation_level": escalation_level,
        },
        metadata=metadata,
    )

    requester_name = await _person_display_name(db, requested_by_id)
    await _notify_person(
        db,
        person_id=assigned_to_id,
        title="Approval needed",
        body=f"{requester_name} submitted: {title}",
        link=f"/me/approvals/{request.id}",
    )

    return request


# ============================================================
# LIST / READ
# ============================================================

async def list_for_person(
    db: AsyncSession,
    *,
    person_id: str,
    statuses: Optional[Sequence[str]] = None,
    entity_types: Optional[Sequence[str]] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[ApprovalRequest]:
    """Requests currently assigned to this person."""
    query = select(ApprovalRequest).where(
        ApprovalRequest.assigned_to_id == person_id
    )

    if statuses:
        query = query.where(ApprovalRequest.status.in_(list(statuses)))

    if entity_types:
        query = query.where(ApprovalRequest.entity_type.in_(list(entity_types)))

    query = (
        query
        .options(
            selectinload(ApprovalRequest.requested_by),
            selectinload(ApprovalRequest.assigned_to),
        )
        .order_by(
            ApprovalRequest.priority.desc(),
            ApprovalRequest.due_at.asc().nullslast(),
            ApprovalRequest.created_at.desc(),
        )
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(query)
    return list(result.scalars().all())


async def list_requested_by(
    db: AsyncSession,
    *,
    person_id: str,
    statuses: Optional[Sequence[str]] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[ApprovalRequest]:
    """Requests created by this person."""
    query = select(ApprovalRequest).where(
        ApprovalRequest.requested_by_id == person_id
    )

    if statuses:
        query = query.where(ApprovalRequest.status.in_(list(statuses)))

    query = (
        query
        .options(
            selectinload(ApprovalRequest.requested_by),
            selectinload(ApprovalRequest.assigned_to),
        )
        .order_by(ApprovalRequest.created_at.desc())
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_request(
    db: AsyncSession,
    request_id: str,
) -> Optional[ApprovalRequest]:
    result = await db.execute(
        select(ApprovalRequest)
        .options(
            selectinload(ApprovalRequest.requested_by),
            selectinload(ApprovalRequest.assigned_to),
            selectinload(ApprovalRequest.decided_by),
            selectinload(ApprovalRequest.comments).selectinload(ApprovalComment.author),
        )
        .where(ApprovalRequest.id == request_id)
    )
    return result.scalar_one_or_none()


# ============================================================
# AUTHORIZATION
# ============================================================

async def is_override(
    db: AsyncSession,
    *,
    actor_person_id: str,
    request: ApprovalRequest,
) -> bool:
    """True when the actor can decide only via an override role, not assignment."""
    if request.assigned_to_id == actor_person_id:
        return False
    return await _person_has_any_role(
        db, actor_person_id, APPROVAL_OVERRIDE_ROLES
    )


async def can_act_on(
    db: AsyncSession,
    *,
    actor_person_id: str,
    request: ApprovalRequest,
) -> bool:
    """
    Return True if actor_person_id is allowed to approve/reject this request.

    Rules:
    - Only the assigned approver can act by default.
    - HR override roles (head_of_hr, executive_director, ceo) may decide
      a request assigned elsewhere; this is audited as an override.
    - The requester can never decide their own request.
    - Compensation has its own two-stage authority model.
    """
    if request.status != "pending":
        return False

    if request.requested_by_id == actor_person_id:
        return False

    # Compensation has a dedicated two-stage authority model.
    # Level 0 = HR stage, level >= 1 = CEO stage (2 after escalation).
    if request.entity_type == "compensation_request":
        if request.escalation_level >= 1:
            return await _person_has_any_role(db, actor_person_id, {"ceo"})
        return await _person_has_any_role(
            db, actor_person_id, {"head_of_hr", "ceo"}
        )

    if request.assigned_to_id == actor_person_id:
        return True

    if await is_override(
        db,
        actor_person_id=actor_person_id,
        request=request,
    ):
        return True

    return False


# ============================================================
# DECIDE
# ============================================================

async def approve(
    db: AsyncSession,
    *,
    request_id: str,
    actor: User,
    note: Optional[str] = None,
    notify_requester: bool = True,
) -> ApprovalRequest:
    """
    Approve a request.

    `notify_requester=False` is used by multi-stage flows where this
    approval only completes an intermediate stage and the domain
    service sends its own, more accurate notification.
    """
    request = await get_request(db, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")

    if request.status != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot approve: request is {request.status}",
        )

    actor_person_id = actor.person_id
    if not await can_act_on(db, actor_person_id=actor_person_id, request=request):
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to approve this request",
        )

    override = await is_override(
        db,
        actor_person_id=actor_person_id,
        request=request,
    )

    request.status = "approved"
    request.decided_at = datetime.now(timezone.utc)
    request.decided_by_id = actor_person_id
    request.decision_note = note

    await AuditService.log(
        db=db,
        actor=actor,
        action="APPROVAL_APPROVED",
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        description=(
            f"Approved{f' (override of {request.assigned_to_id})' if override else ''}:"
            f" {request.title}"
        ),
        new_values={
            "note": note,
            "approval_id": request.id,
            "override": override,
            "assigned_to_id": request.assigned_to_id,
        },
    )

    actor_name = await _person_display_name(db, actor_person_id)
    if notify_requester:
        await _notify_person(
            db,
            person_id=request.requested_by_id,
            title="Request approved",
            body=f"{actor_name} approved: {request.title}",
            link=f"/me/approvals/{request.id}",
        )

    return request


async def reject(
    db: AsyncSession,
    *,
    request_id: str,
    actor: User,
    note: str,
) -> ApprovalRequest:
    if not note or not note.strip():
        raise HTTPException(
            status_code=400,
            detail="A rejection reason is required",
        )

    request = await get_request(db, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")

    if request.status != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot reject: request is {request.status}",
        )

    actor_person_id = actor.person_id
    if not await can_act_on(db, actor_person_id=actor_person_id, request=request):
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to reject this request",
        )

    override = await is_override(
        db,
        actor_person_id=actor_person_id,
        request=request,
    )

    request.status = "rejected"
    request.decided_at = datetime.now(timezone.utc)
    request.decided_by_id = actor_person_id
    request.decision_note = note

    await AuditService.log(
        db=db,
        actor=actor,
        action="APPROVAL_REJECTED",
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        description=(
            f"Rejected{f' (override of {request.assigned_to_id})' if override else ''}:"
            f" {request.title}"
        ),
        new_values={
            "note": note,
            "approval_id": request.id,
            "override": override,
            "assigned_to_id": request.assigned_to_id,
        },
    )

    actor_name = await _person_display_name(db, actor_person_id)
    await _notify_person(
        db,
        person_id=request.requested_by_id,
        title="Request rejected",
        body=f"{actor_name} rejected: {request.title}",
        link=f"/me/approvals/{request.id}",
    )

    return request


async def cancel(
    db: AsyncSession,
    *,
    request_id: str,
    actor: User,
) -> ApprovalRequest:
    """
    Requester withdraws their own request. Only allowed while pending.
    """
    request = await get_request(db, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")

    if request.status != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot cancel: request is {request.status}",
        )

    if request.requested_by_id != actor.person_id:
        raise HTTPException(
            status_code=403,
            detail="Only the requester can cancel this request",
        )

    request.status = "cancelled"
    request.decided_at = datetime.now(timezone.utc)
    request.decided_by_id = actor.person_id

    await AuditService.log(
        db=db,
        actor=actor,
        action="APPROVAL_CANCELLED",
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        description=f"Cancelled: {request.title}",
        new_values={"approval_id": request.id},
    )

    return request


# ============================================================
# ESCALATION
# ============================================================

async def escalate(
    db: AsyncSession,
    *,
    request_id: str,
    actor: User,
) -> ApprovalRequest:
    """
    Manually push a request up one escalation level.

    Levels:
        0 manager  -> 1 HR
        1 HR       -> 2 exec
        2 exec     -> cannot escalate further
    """
    request = await get_request(db, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")

    if request.status != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot escalate: request is {request.status}",
        )

    if request.escalation_level >= 2:
        raise HTTPException(
            status_code=409,
            detail="Request is already at the highest escalation level",
        )

    next_level = request.escalation_level + 1

    if next_level == 1:
        new_approver = await _find_hr_approver(
            db, exclude_person_id=request.requested_by_id
        )
    else:
        new_approver = await _find_exec_approver(
            db, exclude_person_id=request.requested_by_id
        )

    if not new_approver:
        raise HTTPException(
            status_code=409,
            detail=f"No approver available at escalation level {next_level}",
        )

    old_approver = request.assigned_to_id
    request.assigned_to_id = new_approver
    request.escalation_level = next_level
    request.escalated_at = datetime.now(timezone.utc)

    await AuditService.log(
        db=db,
        actor=actor,
        action="APPROVAL_ESCALATED",
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        description=(
            f"Escalated to level {next_level} "
            f"({ESCALATION_LEVELS.get(next_level, 'unknown')})"
        ),
        old_values={"assigned_to_id": old_approver},
        new_values={"assigned_to_id": new_approver, "level": next_level},
    )

    await _notify_person(
        db,
        person_id=new_approver,
        title="Approval escalated to you",
        body=f"{request.title} — escalated to {ESCALATION_LEVELS.get(next_level, 'you')}",
        link=f"/me/approvals/{request.id}",
    )

    return request


async def auto_escalate_overdue(
    db: AsyncSession,
) -> int:
    """
    Sweep pending requests whose SLA has expired and escalate them.

    Intended to be called by a scheduled job (cron / APScheduler).

    Returns the number of requests escalated.
    """
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(ApprovalRequest).where(
            ApprovalRequest.status == "pending",
            ApprovalRequest.due_at.is_not(None),
            ApprovalRequest.due_at <= now,
            ApprovalRequest.escalation_level < 2,
            # Compensation and fund requests have their own fixed stage
            # flows; the generic ladder must not move them.
            ApprovalRequest.entity_type.notin_(
                ["compensation_request", "fund_request", "device_request"]
            ),
        )
    )

    overdue = list(result.scalars().all())
    escalated_count = 0

    for request in overdue:
        next_level = request.escalation_level + 1

        if next_level == 1:
            new_approver = await _find_hr_approver(
                db, exclude_person_id=request.requested_by_id
            )
        else:
            new_approver = await _find_exec_approver(
                db, exclude_person_id=request.requested_by_id
            )

        if not new_approver:
            continue

        request.assigned_to_id = new_approver
        request.escalation_level = next_level
        request.escalated_at = now
        # give the new approver a fresh SLA window
        request.due_at = now + timedelta(
            hours=DEFAULT_SLA_HOURS.get(request.entity_type, 72)
        )

        await AuditService.log(
            db=db,
            action="APPROVAL_AUTO_ESCALATED",
            entity_type=request.entity_type,
            entity_id=request.entity_id,
            description=f"Auto-escalated to level {next_level} (SLA expired)",
            new_values={"assigned_to_id": new_approver, "level": next_level},
        )

        await _notify_person(
            db,
            person_id=new_approver,
            title="Overdue approval escalated to you",
            body=f"{request.title} passed its SLA and needs a decision",
            link=f"/me/approvals/{request.id}",
        )

        escalated_count += 1

    if escalated_count:
        await db.commit()

    return escalated_count


# ============================================================
# COMMENTS
# ============================================================

async def add_comment(
    db: AsyncSession,
    *,
    request_id: str,
    actor: User,
    body: str,
    is_internal: bool = False,
) -> ApprovalComment:
    if not body or not body.strip():
        raise HTTPException(status_code=400, detail="Comment body is required")

    request = await get_request(db, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")

    # Anyone involved with the request can comment:
    # requester, current approver, HR approver roles.
    actor_person_id = actor.person_id
    is_involved = (
        actor_person_id == request.requested_by_id
        or actor_person_id == request.assigned_to_id
        or await _person_has_any_role(db, actor_person_id, HR_APPROVER_ROLES)
    )

    if not is_involved:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to comment on this request",
        )

    # Only HR/approver roles can post internal comments.
    if is_internal:
        if not await _person_has_any_role(db, actor_person_id, HR_APPROVER_ROLES):
            raise HTTPException(
                status_code=403,
                detail="Only HR approvers can post internal comments",
            )

    comment = ApprovalComment(
        id=str(uuid.uuid4()),
        approval_request_id=request_id,
        author_person_id=actor_person_id,
        body=body.strip(),
        is_internal=is_internal,
    )

    db.add(comment)

    await AuditService.log(
        db=db,
        actor=actor,
        action="APPROVAL_COMMENTED",
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        description=f"Commented on: {request.title}",
        new_values={"internal": is_internal},
    )

    return comment


# ============================================================
# STATS
# ============================================================

async def inbox_stats(
    db: AsyncSession,
    *,
    person_id: str,
) -> dict:
    """Counts for the inbox UI."""
    result = await db.execute(
        select(
            ApprovalRequest.status,
            func.count(ApprovalRequest.id),
        )
        .where(ApprovalRequest.assigned_to_id == person_id)
        .group_by(ApprovalRequest.status)
    )

    by_status = {row[0]: row[1] for row in result.all()}

    # by entity type, pending only
    result = await db.execute(
        select(
            ApprovalRequest.entity_type,
            func.count(ApprovalRequest.id),
        )
        .where(
            ApprovalRequest.assigned_to_id == person_id,
            ApprovalRequest.status == "pending",
        )
        .group_by(ApprovalRequest.entity_type)
    )

    by_type = {row[0]: row[1] for row in result.all()}

    # overdue count
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(func.count(ApprovalRequest.id)).where(
            ApprovalRequest.assigned_to_id == person_id,
            ApprovalRequest.status == "pending",
            ApprovalRequest.due_at.is_not(None),
            ApprovalRequest.due_at <= now,
        )
    )

    overdue = result.scalar() or 0

    return {
        "pending": by_status.get("pending", 0),
        "approved": by_status.get("approved", 0),
        "rejected": by_status.get("rejected", 0),
        "cancelled": by_status.get("cancelled", 0),
        "overdue": overdue,
        "by_type": by_type,
    }

# ============================================================
# CEO ESCALATION
# ============================================================

async def _find_ceo_approver(
    db: AsyncSession,
    *,
    exclude_person_id: Optional[str] = None,
) -> Optional[str]:
    """Find an active user with the CEO role. Returns person_id."""
    query = (
        select(User.person_id)
        .join(User.roles)
        .where(
            Role.name == "ceo",
            User.is_active.is_(True),
        )
    )
    if exclude_person_id:
        query = query.where(User.person_id != exclude_person_id)

    result = await db.execute(query.limit(1))
    return result.scalar_one_or_none()


async def escalate_to_ceo(
    db: AsyncSession,
    *,
    request_id: str,
    actor: User,
) -> ApprovalRequest:
    """
    Move an approval to the CEO (level 2 = exec).

    Called when the HR stage is complete and the request needs the
    CEO's final decision. Updates assignment, escalation_level, and
    gives a fresh SLA window.
    """
    request = await get_request(db, request_id)
    if not request:
        raise HTTPException(404, "Approval request not found")

    if request.status != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Cannot escalate: request is {request.status}",
        )

    ceo_person_id = await _find_ceo_approver(
        db, exclude_person_id=request.requested_by_id
    )
    if not ceo_person_id:
        raise HTTPException(
            status_code=500,
            detail="No CEO user is configured. Contact system administrator.",
        )

    old_approver = request.assigned_to_id
    request.assigned_to_id = ceo_person_id
    request.escalation_level = 2
    request.escalated_at = datetime.now(timezone.utc)

    # Fresh SLA for the CEO
    request.due_at = datetime.now(timezone.utc) + timedelta(days=7)

    await AuditService.log(
        db=db,
        actor=actor,
        action="APPROVAL_ESCALATED_TO_CEO",
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        description=f"Escalated '{request.title}' to CEO",
        old_values={"assigned_to_id": old_approver},
        new_values={"assigned_to_id": ceo_person_id, "level": 2},
    )

    await _notify_person(
        db,
        person_id=ceo_person_id,
        title="CEO approval required",
        body=f"{request.title} is ready for your final decision",
        link=f"/me/approvals/{request.id}",
    )

    return request


# ============================================================
# ORG-WIDE STATS
# ============================================================

async def get_creation_metadata(
    db: AsyncSession,
    *,
    request_id: str,
    entity_type: str,
    entity_id: str,
) -> Optional[dict]:
    """
    Return the structured payload recorded when a request was created.

    The payload lives on the APPROVAL_CREATED audit entry, so no
    schema change is needed on approval_requests.
    """
    result = await db.execute(
        select(AuditLog)
        .where(
            AuditLog.action == "APPROVAL_CREATED",
            AuditLog.entity_type == entity_type,
            AuditLog.entity_id == entity_id,
        )
        .order_by(AuditLog.created_at.desc())
        .limit(20)
    )

    for log in result.scalars().all():
        if (log.new_values or {}).get("approval_id") == request_id:
            return log.metadata_ or {}

    return None


async def overview_stats(db: AsyncSession) -> dict:
    """Org-wide approval counts for the HR shell and overview page."""
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(
            ApprovalRequest.status,
            func.count(ApprovalRequest.id),
        ).group_by(ApprovalRequest.status)
    )
    by_status = {row[0]: row[1] for row in result.all()}

    result = await db.execute(
        select(
            ApprovalRequest.entity_type,
            func.count(ApprovalRequest.id),
        )
        .where(ApprovalRequest.status == "pending")
        .group_by(ApprovalRequest.entity_type)
    )
    by_type = {row[0]: row[1] for row in result.all()}

    overdue_result = await db.execute(
        select(func.count(ApprovalRequest.id)).where(
            ApprovalRequest.status == "pending",
            ApprovalRequest.due_at.is_not(None),
            ApprovalRequest.due_at <= now,
        )
    )

    return {
        "pending": by_status.get("pending", 0),
        "approved": by_status.get("approved", 0),
        "rejected": by_status.get("rejected", 0),
        "cancelled": by_status.get("cancelled", 0),
        "overdue": overdue_result.scalar() or 0,
        "by_type": by_type,
    }