from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.pydantic.finance.finance import (
    FundRequestApprovalRecord,
    FundRequestCreate,
    FundRequestDetailResponse,
    FundRequestDocument,
    FundRequestResponse,
    FundRequestUpdate,
)
from app.models.sql.core.document import Document
from app.models.sql.core.role import Role
from app.models.sql.core.user import User
from app.models.sql.finance.fund_request import FundRequest
from app.models.sql.hr.approval import ApprovalRequest
from app.models.sql.projects.project import Project
from app.services.core.audit_service import AuditService
from app.services.hr import approval_service


# ============================================================
# CONSTANTS
# ============================================================

STAGE_MANAGER = "manager"
STAGE_FINANCE = "finance"
STAGE_CEO = "ceo"
STAGE_DISBURSEMENT = "disbursement"
STAGE_VERIFICATION = "verification"
STAGE_CLOSED = "closed"

STAGE_ORDER = (STAGE_MANAGER, STAGE_FINANCE, STAGE_CEO)

STAGE_LABELS = {
    STAGE_MANAGER: "Manager",
    STAGE_FINANCE: "Finance",
    STAGE_CEO: "CEO",
    STAGE_DISBURSEMENT: "Disbursement",
    STAGE_VERIFICATION: "Receipt verification",
    STAGE_CLOSED: "Closed",
}

# Finance approval routes to the most senior active finance user first,
# as confirmed for the workflow.
FINANCE_APPROVER_ROLES = (
    "head_of_finance",
    "finance_manager",
    "finance_officer",
)

FINANCE_OVERRIDE_ROLES = {"executive_director", "ceo"}

EDITABLE_STATUSES = {"draft", "rejected"}

CANCELLABLE_STATUSES = {
    "draft",
    "submitted",
    "manager_approved",
    "finance_approved",
}

ENTITY_TYPE = "fund_request"


# ============================================================
# HELPERS
# ============================================================

def _parse_uuid(value: str, label: str) -> UUID:
    try:
        return UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label}.",
        )


def _generate_request_number() -> str:
    return f"FR-{datetime.now(timezone.utc):%Y%m%d}-{uuid4().hex[:6].upper()}"


async def get_request(db: AsyncSession, request_id: str) -> FundRequest:
    request_uuid = _parse_uuid(request_id, "fund request ID")

    record = (
        await db.execute(
            select(FundRequest).where(FundRequest.id == request_uuid)
        )
    ).scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fund request not found.",
        )

    return record


async def _person_name(db: AsyncSession, person_id: Optional[str]) -> Optional[str]:
    if not person_id:
        return None
    return await approval_service._person_display_name(db, person_id)


async def _requester_name(db: AsyncSession, record: FundRequest) -> str:
    person = record.__dict__.get("requester")
    if person is not None:
        return f"{person.first_name} {person.last_name}".strip()
    return await approval_service._person_display_name(db, record.requester_id)


async def _count_documents(db: AsyncSession, request_id: str) -> int:
    result = await db.execute(
        select(func.count(Document.id)).where(
            Document.related_entity_type == ENTITY_TYPE,
            Document.related_entity_id == request_id,
            Document.deleted_at.is_(None),
        )
    )
    return result.scalar() or 0


async def _documents(
    db: AsyncSession,
    request_id: str,
) -> list[Document]:
    result = await db.execute(
        select(Document)
        .where(
            Document.related_entity_type == ENTITY_TYPE,
            Document.related_entity_id == request_id,
            Document.deleted_at.is_(None),
        )
        .order_by(Document.created_at.desc())
    )
    return list(result.scalars().all())


async def _approval_history(
    db: AsyncSession,
    request_id: str,
) -> list[ApprovalRequest]:
    result = await db.execute(
        select(ApprovalRequest)
        .options(selectinload(ApprovalRequest.decided_by))
        .where(
            ApprovalRequest.entity_type == ENTITY_TYPE,
            ApprovalRequest.entity_id == request_id,
        )
        .order_by(ApprovalRequest.created_at.asc())
    )
    return list(result.scalars().all())


# ============================================================
# ROUTING
# ============================================================

async def _find_role_person(
    db: AsyncSession,
    roles: tuple[str, ...],
    exclude_ids: set[str],
) -> Optional[str]:
    """Return the first active user in the given role preference order."""
    for role_name in roles:
        query = (
            select(User.person_id)
            .join(User.roles)
            .where(
                Role.name == role_name,
                User.is_active.is_(True),
            )
        )
        if exclude_ids:
            query = query.where(
                User.person_id.notin_(list(exclude_ids))
            )

        person_id = (
            await db.execute(query.limit(1))
        ).scalar_one_or_none()

        if person_id:
            return person_id

    return None


async def _resolve_stage_approver(
    db: AsyncSession,
    *,
    stage: str,
    requester_id: str,
    exclude_ids: set[str],
) -> Optional[str]:
    excluded = set(exclude_ids)
    excluded.add(requester_id)

    if stage == STAGE_MANAGER:
        manager_id = await approval_service._resolve_manager_person_id(
            db, requester_id
        )
        if (
            manager_id
            and manager_id not in excluded
            and await approval_service._is_active_approver(db, manager_id)
        ):
            return manager_id
        return None

    if stage == STAGE_FINANCE:
        return await _find_role_person(
            db, FINANCE_APPROVER_ROLES, excluded
        )

    if stage == STAGE_CEO:
        return await _find_role_person(db, ("ceo",), excluded)

    return None


async def _next_approver(
    db: AsyncSession,
    *,
    record: FundRequest,
    after_stage: Optional[str],
) -> tuple[Optional[str], Optional[str]]:
    """
    Resolve the next stage and its approver.

    Stages already decided, the requester, and the manager are excluded
    so a claim never routes to someone who is already in the chain.
    """
    if after_stage is None:
        remaining = STAGE_ORDER
    else:
        try:
            remaining = STAGE_ORDER[STAGE_ORDER.index(after_stage) + 1:]
        except ValueError:
            remaining = ()

    exclude_ids = {
        decided
        for decided in (
            record.manager_decided_by_id,
            record.finance_decided_by_id,
            record.ceo_decided_by_id,
        )
        if decided
    }

    for stage in remaining:
        person_id = await _resolve_stage_approver(
            db,
            stage=stage,
            requester_id=record.requester_id,
            exclude_ids=exclude_ids,
        )
        if person_id:
            return stage, person_id

    return None, None


async def _create_stage_approval(
    db: AsyncSession,
    record: FundRequest,
    *,
    stage: str,
    person_id: str,
    index: int,
    summary: str,
) -> ApprovalRequest:
    approval = await approval_service.create_request(
        db,
        entity_type=ENTITY_TYPE,
        entity_id=record.id,
        requested_by_id=record.requester_id,
        title=f"{STAGE_LABELS[stage]} approval — {record.request_number}",
        summary=summary,
        assigned_to_id=person_id,
        escalation_level=index,
        stage=stage,
        enforce_assignment_policy=False,
    )

    record.approval_id = approval.id
    record.current_stage = stage

    return approval


async def _notify_finance(
    db: AsyncSession,
    record: FundRequest,
    *,
    title: str,
    body: str,
    link: str,
) -> None:
    person_ids: set[str] = set()

    for role_name in FINANCE_APPROVER_ROLES:
        result = await db.execute(
            select(User.person_id)
            .join(User.roles)
            .where(
                Role.name == role_name,
                User.is_active.is_(True),
                User.person_id != record.requester_id,
            )
        )
        person_ids.update(
            person_id for person_id in result.scalars().all() if person_id
        )

    for person_id in person_ids:
        await approval_service._notify_person(
            db,
            person_id=person_id,
            title=title,
            body=body,
            link=link,
            type="finance",
        )


# ============================================================
# ACCESS
# ============================================================

def assert_owner(record: FundRequest, actor: User) -> None:
    if not actor.person_id or record.requester_id != actor.person_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage your own fund request.",
        )


async def can_view(
    db: AsyncSession,
    record: FundRequest,
    user: User,
) -> bool:
    from app.services.finance.finance_access_service import (
        FinanceAccessService,
    )

    if user.person_id and record.requester_id == user.person_id:
        return True

    if await FinanceAccessService.can_view_all(db, user):
        return True

    if record.project_id:
        manager_id = (
            await db.execute(
                select(Project.manager_id).where(
                    Project.id == record.project_id
                )
            )
        ).scalar_one_or_none()

        if user.person_id and manager_id == user.person_id:
            return True

    return False


# ============================================================
# CREATE / UPDATE
# ============================================================

async def create_request(
    db: AsyncSession,
    payload: FundRequestCreate,
    actor: User,
) -> FundRequest:
    if not actor.person_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not linked to a person record.",
        )

    project_id = (
        _parse_uuid(payload.project_id, "project ID")
        if payload.project_id
        else None
    )

    if project_id:
        exists = (
            await db.execute(
                select(Project.id).where(Project.id == project_id)
            )
        ).scalar_one_or_none()
        if not exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project not found.",
            )

    record = FundRequest(
        request_number=_generate_request_number(),
        request_type=payload.request_type,
        title=payload.title.strip(),
        description=payload.description,
        justification=payload.justification,
        expense_date=payload.expense_date,
        requester_id=actor.person_id,
        project_id=project_id,
        programme_id=(
            _parse_uuid(payload.programme_id, "programme ID")
            if payload.programme_id
            else None
        ),
        department_id=(
            _parse_uuid(payload.department_id, "department ID")
            if payload.department_id
            else None
        ),
        amount_requested=payload.amount_requested,
        currency=payload.currency.upper(),
        amount_disbursed=Decimal("0"),
        status="draft",
        current_stage=None,
        required_by_date=payload.required_by_date,
        receipt_required=True,
    )

    db.add(record)
    await db.flush()

    await AuditService.log(
        db,
        actor=actor,
        action="FUND_REQUEST_CREATED",
        entity_type=ENTITY_TYPE,
        entity_id=record.id,
        description=(
            f"Draft {record.request_type} claim "
            f"{record.request_number} created."
        ),
        new_values={
            "amount_requested": str(record.amount_requested),
            "currency": record.currency,
        },
    )

    return record


async def update_request(
    db: AsyncSession,
    record: FundRequest,
    payload: FundRequestUpdate,
    actor: User,
) -> FundRequest:
    assert_owner(record, actor)

    if record.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft or rejected fund requests can be edited.",
        )

    updates = payload.model_dump(exclude_unset=True)

    for field, value in updates.items():
        if field in {"project_id", "programme_id", "department_id"}:
            value = (
                _parse_uuid(value, field.replace("_id", " ID"))
                if value
                else None
            )

        if field == "currency" and value:
            value = value.upper()

        if field == "title" and value:
            value = value.strip()

        setattr(record, field, value)

    if (
        record.request_type == "reimbursement"
        and record.expense_date is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A reimbursement must record the date the money was spent.",
        )

    return record


# ============================================================
# SUBMIT / CANCEL
# ============================================================

async def submit_request(
    db: AsyncSession,
    record: FundRequest,
    actor: User,
    request: Optional[Request] = None,
) -> FundRequest:
    assert_owner(record, actor)

    if record.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only draft or rejected fund requests can be submitted."
            ),
        )

    if record.amount_requested <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fund request amount must be greater than zero.",
        )

    if (
        record.request_type == "reimbursement"
        and record.expense_date is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A reimbursement must record the date the money was spent.",
        )

    document_count = await _count_documents(db, record.id)
    if document_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Attach at least one supporting document (receipt, "
                "invoice or quotation) before submitting."
            ),
        )

    previous_status = record.status

    stage, person_id = await _next_approver(
        db, record=record, after_stage=None
    )

    if not stage or not person_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "No approver could be resolved for this request. "
                "Ensure the requester has a manager, or that Finance "
                "and CEO roles are assigned."
            ),
        )

    if previous_status == "rejected":
        # A revised claim starts the chain again; prior decisions stay
        # in the approval history for audit.
        record.rejection_reason = None
        record.manager_decided_by_id = None
        record.manager_decided_at = None
        record.manager_decision_note = None
        record.finance_decided_by_id = None
        record.finance_decided_at = None
        record.finance_decision_note = None
        record.ceo_decided_by_id = None
        record.ceo_decided_at = None
        record.ceo_decision_note = None
        record.approved_amount = None
        record.amount_disbursed = Decimal("0")

    record.status = "submitted"
    record.submitted_at = datetime.now(timezone.utc)

    await _create_stage_approval(
        db,
        record,
        stage=stage,
        person_id=person_id,
        index=STAGE_ORDER.index(stage),
        summary=(
            f"{record.request_type.title()} claim of "
            f"{record.currency} {record.amount_requested:,.2f}"
        ),
    )

    await AuditService.log(
        db,
        actor=actor,
        action="FUND_REQUEST_SUBMITTED",
        entity_type=ENTITY_TYPE,
        entity_id=record.id,
        description=(
            f"Fund request {record.request_number} submitted "
            f"to {STAGE_LABELS[stage]}."
        ),
        old_values={"status": previous_status},
        new_values={
            "status": record.status,
            "current_stage": stage,
            "documents": document_count,
        },
        metadata={
            "request_number": record.request_number,
            "amount_requested": str(record.amount_requested),
            "currency": record.currency,
        },
        request=request,
    )

    return record


async def cancel_request(
    db: AsyncSession,
    record: FundRequest,
    actor: User,
    request: Optional[Request] = None,
) -> FundRequest:
    assert_owner(record, actor)

    if record.status not in CANCELLABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This fund request can no longer be cancelled. "
                "Only requests that have not been disbursed can be withdrawn."
            ),
        )

    if record.approval_id:
        approval = await approval_service.get_request(
            db, record.approval_id
        )
        if approval and approval.status == "pending":
            await approval_service.cancel(
                db, request_id=approval.id, actor=actor
            )

    previous_status = record.status

    record.status = "cancelled"
    record.current_stage = STAGE_CLOSED
    record.approval_id = None

    await AuditService.log(
        db,
        actor=actor,
        action="FUND_REQUEST_CANCELLED",
        entity_type=ENTITY_TYPE,
        entity_id=record.id,
        description=f"Fund request {record.request_number} withdrawn.",
        old_values={"status": previous_status},
        new_values={"status": record.status},
        request=request,
    )

    return record


# ============================================================
# DECISIONS
# ============================================================

async def _has_any_role(
    db: AsyncSession,
    person_id: str,
    roles: set[str],
) -> bool:
    return await approval_service._person_has_any_role(
        db, person_id, roles
    )


async def _assert_stage_authority(
    db: AsyncSession,
    *,
    record: FundRequest,
    approval: ApprovalRequest,
    stage: str,
    actor: User,
) -> None:
    actor_person_id = actor.person_id

    if not actor_person_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not linked to a person record.",
        )

    if actor_person_id == record.requester_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The requester cannot decide their own fund request.",
        )

    if approval.assigned_to_id == actor_person_id:
        return

    if stage == STAGE_FINANCE and await _has_any_role(
        db, actor_person_id, FINANCE_OVERRIDE_ROLES
    ):
        return

    if stage == STAGE_CEO and await _has_any_role(
        db, actor_person_id, {"ceo"}
    ):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=(
            f"This fund request is waiting for the "
            f"{STAGE_LABELS.get(stage, stage).lower()} stage."
        ),
    )


def _record_stage_decision(
    record: FundRequest,
    *,
    stage: str,
    actor_person_id: str,
    note: Optional[str],
) -> None:
    now = datetime.now(timezone.utc)

    if stage == STAGE_MANAGER:
        record.manager_decided_by_id = actor_person_id
        record.manager_decided_at = now
        record.manager_decision_note = note
    elif stage == STAGE_FINANCE:
        record.finance_decided_by_id = actor_person_id
        record.finance_decided_at = now
        record.finance_decision_note = note
    elif stage == STAGE_CEO:
        record.ceo_decided_by_id = actor_person_id
        record.ceo_decided_at = now
        record.ceo_decision_note = note


async def decide(
    db: AsyncSession,
    *,
    approval: ApprovalRequest,
    actor: User,
    approve: bool,
    note: Optional[str] = None,
    approved_amount: Optional[Decimal] = None,
) -> FundRequest:
    """
    Apply one stage decision to the underlying fund request.

    `approval` is the pending inbox row that triggered this call; its
    `stage` must match the request's current stage.
    """
    record = await get_request(db, approval.entity_id)

    if (
        record.approval_id
        and str(record.approval_id) != str(approval.id)
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This approval is no longer the active stage for the "
                "fund request."
            ),
        )

    stage = record.current_stage

    if stage not in STAGE_ORDER:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This fund request is not awaiting an approval decision.",
        )

    if approval.stage and approval.stage != stage:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Approval stage does not match the fund request.",
        )

    await _assert_stage_authority(
        db,
        record=record,
        approval=approval,
        stage=stage,
        actor=actor,
    )

    # ---------------- reject ----------------
    if not approve:
        if not note or not note.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A rejection reason is required.",
            )

        await approval_service.reject(
            db,
            request_id=approval.id,
            actor=actor,
            note=note.strip(),
        )

        previous_status = record.status

        _record_stage_decision(
            record,
            stage=stage,
            actor_person_id=actor.person_id,
            note=note.strip(),
        )
        record.status = "rejected"
        record.current_stage = STAGE_CLOSED
        record.approval_id = None
        record.rejection_reason = note.strip()

        await AuditService.log(
            db,
            actor=actor,
            action="FUND_REQUEST_REJECTED",
            entity_type=ENTITY_TYPE,
            entity_id=record.id,
            description=(
                f"Fund request {record.request_number} rejected at the "
                f"{STAGE_LABELS[stage]} stage."
            ),
            old_values={"status": previous_status},
            new_values={
                "status": record.status,
                "stage": stage,
                "rejection_reason": note.strip(),
            },
        )

        return record

    # ---------------- approve ----------------
    if stage == STAGE_FINANCE:
        requested = Decimal(str(record.amount_requested))
        final_amount = (
            Decimal(str(approved_amount))
            if approved_amount is not None
            else requested
        )

        if final_amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Approved amount must be greater than zero.",
            )

        if final_amount > requested:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Approved amount cannot exceed the requested amount.",
            )

        record.approved_amount = final_amount

    await approval_service.approve(
        db,
        request_id=approval.id,
        actor=actor,
        note=note,
        notify_requester=False,
    )

    _record_stage_decision(
        record,
        stage=stage,
        actor_person_id=actor.person_id,
        note=note,
    )

    if stage == STAGE_MANAGER:
        record.status = "manager_approved"
    elif stage == STAGE_FINANCE:
        record.status = "finance_approved"
    else:
        record.status = "approved"

    await AuditService.log(
        db,
        actor=actor,
        action="FUND_REQUEST_STAGE_APPROVED",
        entity_type=ENTITY_TYPE,
        entity_id=record.id,
        description=(
            f"{STAGE_LABELS[stage]} approved fund request "
            f"{record.request_number}."
        ),
        new_values={
            "stage": stage,
            "approved_amount": (
                str(record.approved_amount)
                if record.approved_amount is not None
                else None
            ),
            "note": note,
        },
    )

    next_stage, next_person_id = await _next_approver(
        db, record=record, after_stage=stage
    )

    if next_stage and next_person_id:
        await _create_stage_approval(
            db,
            record,
            stage=next_stage,
            person_id=next_person_id,
            index=STAGE_ORDER.index(next_stage),
            summary=(
                f"{record.request_type.title()} claim of "
                f"{record.currency} {record.amount_requested:,.2f}"
            ),
        )
        return record

    # Chain complete
    record.status = "approved"
    record.current_stage = STAGE_DISBURSEMENT
    record.approval_id = None
    record.approved_at = datetime.now(timezone.utc)
    record.rejection_reason = None

    if record.approved_amount is None:
        record.approved_amount = record.amount_requested

    await approval_service._notify_person(
        db,
        person_id=record.requester_id,
        title="Fund request approved",
        body=(
            f"{record.request_number} is fully approved. "
            f"Finance will arrange payment."
        ),
        link=f"/me/finance/{record.id}",
        type="finance",
    )

    await _notify_finance(
        db,
        record,
        title="Fund request ready for disbursement",
        body=(
            f"{record.request_number} ({record.currency} "
            f"{record.amount_requested:,.2f}) is fully approved."
        ),
        link="/finance/disbursements",
    )

    return record


# ============================================================
# DISBURSEMENT
# ============================================================

async def disburse(
    db: AsyncSession,
    record: FundRequest,
    *,
    actor: User,
    amount: Decimal,
    notes: Optional[str] = None,
    request: Optional[Request] = None,
) -> FundRequest:
    if record.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only fully approved fund requests can be paid out.",
        )

    if record.requester_id == actor.person_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The requester cannot disburse their own fund request.",
        )

    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Disbursement amount must be greater than zero.",
        )

    approved_amount = Decimal(
        str(record.approved_amount or record.amount_requested)
    )
    disbursed = Decimal(str(record.amount_disbursed or 0))
    remaining = approved_amount - disbursed

    if amount > remaining:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Disbursement cannot exceed the remaining approved amount.",
        )

    record.amount_disbursed = disbursed + amount
    record.disburser_id = actor.person_id
    if notes:
        record.disbursement_notes = notes

    fully_disbursed = record.amount_disbursed >= approved_amount

    if fully_disbursed:
        now = datetime.now(timezone.utc)
        record.disbursed_at = now

        if record.receipt_required:
            record.status = "disbursed"
            record.current_stage = STAGE_VERIFICATION

            await approval_service._notify_person(
                db,
                person_id=record.requester_id,
                title="Payment released — bring signed receipts",
                body=(
                    f"{record.currency} {record.amount_disbursed:,.2f} has "
                    f"been released for {record.request_number}. Submit the "
                    f"signed hardcopy receipts to Finance for verification."
                ),
                link=f"/me/finance/{record.id}",
                type="finance",
            )
        else:
            record.status = "verified"
            record.current_stage = STAGE_CLOSED
            record.receipt_verified_by_id = actor.person_id
            record.receipt_verified_at = now
            record.receipt_verification_note = "Receipt not required."

    await AuditService.log(
        db,
        actor=actor,
        action="FUND_REQUEST_DISBURSED",
        entity_type=ENTITY_TYPE,
        entity_id=record.id,
        description=(
            f"Disbursed {record.currency} {amount:,.2f} against "
            f"{record.request_number}."
        ),
        old_values={"amount_disbursed": str(disbursed)},
        new_values={
            "amount_disbursed": str(record.amount_disbursed),
            "fully_disbursed": fully_disbursed,
            "status": record.status,
            "notes": notes,
        },
        metadata={
            "request_number": record.request_number,
            "approved_amount": str(approved_amount),
            "currency": record.currency,
        },
        request=request,
    )

    return record


# ============================================================
# RECEIPT VERIFICATION
# ============================================================

async def verify_receipt(
    db: AsyncSession,
    record: FundRequest,
    *,
    actor: User,
    verified: bool,
    note: Optional[str] = None,
    receipt_reference: Optional[str] = None,
    request: Optional[Request] = None,
) -> FundRequest:
    if record.status not in {"disbursed", "verification_failed"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only disbursed fund requests can have receipts verified."
            ),
        )

    if record.requester_id == actor.person_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The requester cannot verify their own receipts.",
        )

    if Decimal(str(record.amount_disbursed or 0)) <= 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No disbursement has been recorded for this request.",
        )

    if not verified and not (note and note.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Explain what is missing or wrong with the hardcopy "
                "receipts."
            ),
        )

    previous_status = record.status
    now = datetime.now(timezone.utc)

    record.receipt_verified_by_id = actor.person_id
    record.receipt_verified_at = now
    record.receipt_verification_note = note

    if receipt_reference:
        record.receipt_reference = receipt_reference

    if verified:
        record.status = "verified"
        record.current_stage = STAGE_CLOSED

        await approval_service._notify_person(
            db,
            person_id=record.requester_id,
            title="Fund request closed",
            body=(
                f"Finance verified the receipts for {record.request_number}. "
                f"The claim is now closed."
            ),
            link=f"/me/finance/{record.id}",
            type="finance",
        )
    else:
        record.status = "verification_failed"
        record.current_stage = STAGE_VERIFICATION

        await approval_service._notify_person(
            db,
            person_id=record.requester_id,
            title="Receipts need attention",
            body=(
                f"Finance could not verify the receipts for "
                f"{record.request_number}: {note.strip()}"
            ),
            link=f"/me/finance/{record.id}",
            type="finance",
        )

    await AuditService.log(
        db,
        actor=actor,
        action=(
            "FUND_REQUEST_RECEIPT_VERIFIED"
            if verified
            else "FUND_REQUEST_RECEIPT_REJECTED"
        ),
        entity_type=ENTITY_TYPE,
        entity_id=record.id,
        description=(
            f"Hardcopy receipts {'verified' if verified else 'rejected'} "
            f"for {record.request_number}."
        ),
        old_values={"status": previous_status},
        new_values={
            "status": record.status,
            "note": note,
            "receipt_reference": record.receipt_reference,
        },
        request=request,
    )

    return record


async def resubmit_receipt(
    db: AsyncSession,
    record: FundRequest,
    *,
    actor: User,
    note: Optional[str] = None,
    request: Optional[Request] = None,
) -> FundRequest:
    assert_owner(record, actor)

    if record.status != "verification_failed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only requests whose receipts failed verification can be "
                "resubmitted."
            ),
        )

    document_count = await _count_documents(db, record.id)
    if document_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attach the corrected supporting document before resubmitting.",
        )

    record.status = "disbursed"
    record.current_stage = STAGE_VERIFICATION

    if note:
        record.receipt_verification_note = note

    verifier_id = record.receipt_verified_by_id

    if verifier_id:
        await approval_service._notify_person(
            db,
            person_id=verifier_id,
            title="Corrected receipts resubmitted",
            body=(
                f"{record.request_number} has new receipts awaiting "
                f"verification."
            ),
            link="/finance/verification",
            type="finance",
        )
    else:
        await _notify_finance(
            db,
            record,
            title="Corrected receipts resubmitted",
            body=f"{record.request_number} is awaiting receipt verification.",
            link="/finance/verification",
        )

    await AuditService.log(
        db,
        actor=actor,
        action="FUND_REQUEST_RECEIPT_RESUBMITTED",
        entity_type=ENTITY_TYPE,
        entity_id=record.id,
        description=(
            f"Corrected hardcopy receipts resubmitted for "
            f"{record.request_number}."
        ),
        new_values={"note": note, "documents": document_count},
        request=request,
    )

    return record


# ============================================================
# SERIALIZATION
# ============================================================

async def to_response(
    db: AsyncSession,
    record: FundRequest,
) -> FundRequestResponse:
    return FundRequestResponse(
        id=str(record.id),
        request_number=record.request_number,
        request_type=record.request_type or "reimbursement",
        expense_date=record.expense_date,
        title=record.title,
        description=record.description,
        justification=record.justification,
        requester_id=str(record.requester_id),
        requester_name=await _requester_name(db, record),
        project_id=str(record.project_id) if record.project_id else None,
        programme_id=(
            str(record.programme_id) if record.programme_id else None
        ),
        department_id=(
            str(record.department_id) if record.department_id else None
        ),
        amount_requested=record.amount_requested,
        currency=record.currency,
        approved_amount=record.approved_amount,
        amount_disbursed=record.amount_disbursed or Decimal("0"),
        status=record.status,
        current_stage=record.current_stage,
        required_by_date=record.required_by_date,
        submitted_at=record.submitted_at,
        approved_at=record.approved_at,
        disbursed_at=record.disbursed_at,
        manager_decided_by_id=(
            str(record.manager_decided_by_id)
            if record.manager_decided_by_id
            else None
        ),
        manager_decided_at=record.manager_decided_at,
        manager_decision_note=record.manager_decision_note,
        finance_decided_by_id=(
            str(record.finance_decided_by_id)
            if record.finance_decided_by_id
            else None
        ),
        finance_decided_at=record.finance_decided_at,
        finance_decision_note=record.finance_decision_note,
        ceo_decided_by_id=(
            str(record.ceo_decided_by_id)
            if record.ceo_decided_by_id
            else None
        ),
        ceo_decided_at=record.ceo_decided_at,
        ceo_decision_note=record.ceo_decision_note,
        disburser_id=(
            str(record.disburser_id) if record.disburser_id else None
        ),
        disbursement_notes=record.disbursement_notes,
        rejection_reason=record.rejection_reason,
        receipt_required=bool(record.receipt_required),
        receipt_reference=record.receipt_reference,
        receipt_verified_by_id=(
            str(record.receipt_verified_by_id)
            if record.receipt_verified_by_id
            else None
        ),
        receipt_verified_at=record.receipt_verified_at,
        receipt_verification_note=record.receipt_verification_note,
        approval_id=(
            str(record.approval_id) if record.approval_id else None
        ),
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


async def to_detail(
    db: AsyncSession,
    record: FundRequest,
) -> FundRequestDetailResponse:
    base = await to_response(db, record)

    documents = [
        FundRequestDocument(
            id=str(doc.id),
            name=doc.name,
            file_url=doc.file_url,
            mime_type=doc.mime_type,
            file_size_bytes=doc.file_size_bytes,
            category=doc.type,
            uploaded_by_id=str(doc.owner_id) if doc.owner_id else None,
            created_at=doc.created_at,
        )
        for doc in await _documents(db, record.id)
    ]

    history = await _approval_history(db, record.id)

    approvals = [
        FundRequestApprovalRecord(
            id=item.id,
            stage=item.stage
            or STAGE_ORDER[min(item.escalation_level, len(STAGE_ORDER) - 1)],
            decision=item.status,
            actor_id=(
                str(item.decided_by_id) if item.decided_by_id else None
            ),
            actor_name=(
                f"{item.decided_by.first_name} {item.decided_by.last_name}".strip()
                if item.decided_by
                else None
            ),
            note=item.decision_note,
            decided_at=item.decided_at,
        )
        for item in history
    ]

    pending = next(
        (item for item in history if item.status == "pending"), None
    )

    next_approver_name = None
    if pending:
        next_approver_name = await _person_name(
            db, pending.assigned_to_id
        )

    return FundRequestDetailResponse(
        **base.model_dump(),
        documents=documents,
        approvals=approvals,
        next_approver_name=next_approver_name,
    )
