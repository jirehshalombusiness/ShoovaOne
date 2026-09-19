from datetime import datetime, timedelta, timezone
from typing import Optional, List, Sequence
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select, or_, and_, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.sql.approval import ApprovalRequest, ApprovalComment
from app.models.sql.user import User, Person
from app.models.sql.role import Role
from app.models.sql.audit_log import AuditLog
from app.services.audit_service import AuditService


# ============================================================
# CONSTANTS
# ============================================================

ESCALATION_LEVELS = {
    0: "manager",
    1: "hr",
    2: "exec",
}

# Who can act as HR approvers when the assigned approver is absent.
HR_APPROVER_ROLES = {"head_of_hr", "director", "executive_director", "ceo"}

# Default SLA per entity type, in hours.
DEFAULT_SLA_HOURS = {
    "leave_request": 72,
    "timesheet": 48,
    "document_verification": 120,
    "profile_change": 120,
    "compensation_change": 168,
    "contract_renewal": 168,
    "termination": 72,
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


async def _resolve_manager_person_id(db: AsyncSession, person_id: str) -> Optional[str]:
    """Return the person_id of the direct manager, if any."""
    result = await db.execute(
        select(Person.reports_to_id).where(Person.id == person_id)
    )
    return result.scalar_one_or_none()


async def _find_hr_approver(db: AsyncSession) -> Optional[str]:
    """
    Pick an HR approver. Preference order:
        head_of_hr -> director -> executive_director -> ceo
    Returns a person_id or None.
    """
    preference = ["head_of_hr", "director", "executive_director", "ceo"]

    for role_name in preference:
        result = await db.execute(
            select(User.person_id)
            .join(User.roles)
            .where(
                Role.name == role_name,
                User.is_active.is_(True),
            )
            .limit(1)
        )
        person_id = result.scalar_one_or_none()
        if person_id:
            return person_id

    return None


async def _find_exec_approver(db: AsyncSession) -> Optional[str]:
    """Pick an exec approver. Preference: director -> executive_director -> ceo."""
    preference = ["director", "executive_director", "ceo"]

    for role_name in preference:
        result = await db.execute(
            select(User.person_id)
            .join(User.roles)
            .where(
                Role.name == role_name,
                User.is_active.is_(True),
            )
            .limit(1)
        )
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
) -> ApprovalRequest:
    """
    Create an approval request.

    If assigned_to_id is not provided, routing is:
        manager -> HR -> exec
    based on the requester's reporting line.

    Raises if no approver can be resolved, unless the requester
    is themselves an HR approver and approving their own request.
    """

    # ---------- resolve approver ----------
    if assigned_to_id is None:
        manager_id = await _resolve_manager_person_id(db, requested_by_id)

        if manager_id and manager_id != requested_by_id:
            assigned_to_id = manager_id
        else:
            assigned_to_id = await _find_hr_approver(db)

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
        escalation_level=0,
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
            "escalation_level": 0,
        },
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

async def can_act_on(
    db: AsyncSession,
    *,
    actor_person_id: str,
    request: ApprovalRequest,
) -> bool:
    """
    Return True if actor_person_id is allowed to approve/reject this request.

    Rules:
    - The assigned approver can act.
    - Any HR approver role can act (head_of_hr, director, executive_director, ceo).
    - The requester cannot approve their own request.
    """
    if request.status != "pending":
        return False

    if request.requested_by_id == actor_person_id:
        return False

    if request.assigned_to_id == actor_person_id:
        return True

    if await _person_has_any_role(db, actor_person_id, HR_APPROVER_ROLES):
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
) -> ApprovalRequest:
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
        description=f"Approved: {request.title}",
        new_values={"note": note, "approval_id": request.id},
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
        description=f"Rejected: {request.title}",
        new_values={"note": note, "approval_id": request.id},
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
        new_approver = await _find_hr_approver(db)
    else:
        new_approver = await _find_exec_approver(db)

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
        )
    )

    overdue = list(result.scalars().all())
    escalated_count = 0

    for request in overdue:
        next_level = request.escalation_level + 1

        if next_level == 1:
            new_approver = await _find_hr_approver(db)
        else:
            new_approver = await _find_exec_approver(db)

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