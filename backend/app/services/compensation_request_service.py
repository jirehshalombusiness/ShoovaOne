from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sql.approval import ApprovalRequest
from app.models.sql.compensation import CompensationChange
from app.models.sql.compensation_request import CompensationRequest
from app.models.sql.user import User, Person
from app.models.sql.role import Role
from app.services.audit_service import AuditService


# ============================================================
# STAGE MAPPING
# ============================================================

STAGE_HR = 0
STAGE_CEO = 1
STAGE_DONE = 2

STAGE_LABELS = {
    STAGE_HR: "hr",
    STAGE_CEO: "ceo",
    STAGE_DONE: "done",
}


def _stage_from_level(level: int) -> str:
    return STAGE_LABELS.get(level, "hr")


# ============================================================
# HELPERS
# ============================================================

async def _load_compensation_request(
    db: AsyncSession,
    comp_request_id: str,
) -> CompensationRequest:
    result = await db.execute(
        select(CompensationRequest).where(
            CompensationRequest.id == comp_request_id
        )
    )
    comp_request = result.scalar_one_or_none()
    if not comp_request:
        raise HTTPException(
            status_code=404,
            detail="Compensation request not found",
        )
    return comp_request


async def _has_role(db: AsyncSession, person_id: str, role_name: str) -> bool:
    """Return True if the person's user account has the given role."""
    if not person_id:
        return False
    result = await db.execute(
        select(Role.id)
        .join(Role.users)
        .where(
            Role.name == role_name,
            User.person_id == person_id,
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _assert_stage_authority(
    db: AsyncSession,
    *,
    actor_person_id: str,
    stage: str,
) -> None:
    """
    Enforce stage-specific authority.

    Stage "hr"  -> must be head_of_hr or ceo
    Stage "ceo" -> must be ceo
    """
    is_ceo = await _has_role(db, actor_person_id, "ceo")

    # CEO can act at any stage (bypass, consistent with backend design)
    if is_ceo:
        return

    if stage == "hr":
        is_hr = await _has_role(db, actor_person_id, "head_of_hr")
        if not is_hr:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the Head of HR can act at this stage",
            )
        return

    if stage == "ceo":
        # At the CEO stage, only CEO can act. Already checked above.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the CEO can approve compensation at the final stage",
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Unknown approval stage: {stage}",
    )


# ============================================================
# APPROVE (one stage at a time)
# ============================================================

async def approve_stage(
    db: AsyncSession,
    *,
    request: ApprovalRequest,
    actor: User,
    note: Optional[str] = None,
) -> dict:
    """
    Approve a compensation request by one stage.

    Returns:
        {
          "next_stage": "ceo" | "done",
          "comp_request": CompensationRequest,
        }

    Raises HTTPException on any failure.
    """
    comp_request = await _load_compensation_request(db, request.entity_id)

    if comp_request.status not in ("pending_hr", "pending_ceo"):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot approve: request is already {comp_request.status}",
        )

    current_stage = _stage_from_level(request.escalation_level)

    # Enforce who can act at this stage
    await _assert_stage_authority(
        db,
        actor_person_id=actor.person_id,
        stage=current_stage,
    )

    # ---------------- HR stage ----------------
    if current_stage == "hr":
        comp_request.status = "pending_ceo"
        comp_request.hr_decided_by_id = actor.person_id
        comp_request.hr_decided_at = datetime.now(timezone.utc)
        comp_request.hr_decision_note = note

        await AuditService.log(
            db=db,
            actor=actor,
            action="COMPENSATION_REQUEST_HR_APPROVED",
            entity_type="compensation_request",
            entity_id=comp_request.id,
            description="Head of HR approved; forwarded to CEO",
            new_values={"note": note},
        )

        return {
            "next_stage": "ceo",
            "comp_request": comp_request,
        }

    # ---------------- CEO stage ----------------
    if current_stage == "ceo":
        comp_request.status = "approved"
        comp_request.ceo_decided_by_id = actor.person_id
        comp_request.ceo_decided_at = datetime.now(timezone.utc)
        comp_request.ceo_decision_note = note

        # Apply the change — create a CompensationChange
        applied = await _apply_change(
            db,
            comp_request=comp_request,
            actor=actor,
        )
        comp_request.applied_change_id = applied.id

        await AuditService.log(
            db=db,
            actor=actor,
            action="COMPENSATION_REQUEST_APPROVED",
            entity_type="compensation_request",
            entity_id=comp_request.id,
            description="CEO approved compensation request; change applied",
            new_values={
                "note": note,
                "applied_change_id": applied.id,
            },
        )

        return {
            "next_stage": "done",
            "comp_request": comp_request,
        }

    raise HTTPException(
        status_code=400,
        detail="Approval request is already in a terminal state",
    )


# ============================================================
# REJECT (either stage; no escalation)
# ============================================================

async def reject_stage(
    db: AsyncSession,
    *,
    request: ApprovalRequest,
    actor: User,
    note: str,
) -> dict:
    """
    Reject a compensation request.

    At HR stage: HR rejects -> done.
    At CEO stage: CEO rejects -> done, overriding HR's prior approval.
    """
    if not note or not note.strip():
        raise HTTPException(
            status_code=400,
            detail="A rejection reason is required",
        )

    comp_request = await _load_compensation_request(db, request.entity_id)

    if comp_request.status not in ("pending_hr", "pending_ceo"):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot reject: request is already {comp_request.status}",
        )

    current_stage = _stage_from_level(request.escalation_level)

    await _assert_stage_authority(
        db,
        actor_person_id=actor.person_id,
        stage=current_stage,
    )

    comp_request.status = "rejected"

    if current_stage == "hr":
        comp_request.hr_decided_by_id = actor.person_id
        comp_request.hr_decided_at = datetime.now(timezone.utc)
        comp_request.hr_decision_note = note
        stage_label = "Head of HR"
    else:
        comp_request.ceo_decided_by_id = actor.person_id
        comp_request.ceo_decided_at = datetime.now(timezone.utc)
        comp_request.ceo_decision_note = note
        stage_label = "CEO"

    await AuditService.log(
        db=db,
        actor=actor,
        action="COMPENSATION_REQUEST_REJECTED",
        entity_type="compensation_request",
        entity_id=comp_request.id,
        description=f"Rejected by {stage_label}",
        new_values={"note": note, "stage": current_stage},
    )

    return {
        "next_stage": "rejected",
        "comp_request": comp_request,
    }


# ============================================================
# APPLY THE CHANGE
# ============================================================

async def _apply_change(
    db: AsyncSession,
    *,
    comp_request: CompensationRequest,
    actor: User,
) -> CompensationChange:
    """
    Create a CompensationChange row that reflects the approved request.

    - Closes any existing current changes for the same person
    - Creates a new change with effective_from = today
    - Returns the new change
    """
    today = date.today()

    # Close previous active change for the same person
    prev_result = await db.execute(
        select(CompensationChange).where(
            CompensationChange.person_id == comp_request.person_id,
            CompensationChange.effective_to.is_(None),
        )
    )
    for prev in prev_result.scalars().all():
        prev.effective_to = today

    if comp_request.requested_amount is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot apply compensation change: request has no "
                "requested_amount. This should not happen — please "
                "review the request record."
            ),
        )

    change = CompensationChange(
        id=str(uuid.uuid4()),
        person_id=comp_request.person_id,
        base_amount=Decimal(str(comp_request.requested_amount)),
        currency=comp_request.currency,
        frequency=comp_request.frequency,
        effective_from=today,
        effective_to=None,
        reason="compensation_request",
        notes=f"Applied from approved request {comp_request.id}",
        approved_by_id=actor.person_id,
        approved_at=datetime.now(timezone.utc),
    )
    db.add(change)
    await db.flush()

    await AuditService.log(
        db=db,
        actor=actor,
        action="COMPENSATION_CHANGE_APPLIED",
        entity_type="compensation_change",
        entity_id=change.id,
        description=(
            f"Applied compensation change for person "
            f"{comp_request.person_id}"
        ),
        new_values={
            "base_amount": str(change.base_amount),
            "currency": change.currency,
            "frequency": change.frequency,
            "effective_from": change.effective_from.isoformat(),
            "from_request_id": comp_request.id,
        },
    )

    return change