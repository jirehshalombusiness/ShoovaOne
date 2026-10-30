from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pydantic.hr.device_request import (
    DeviceRequestCreate,
    DeviceRequestDetailResponse,
    DeviceRequestDecisionRecord,
    DeviceRequestResponse,
    DeviceRequestUpdate,
    DeviceStockItem,
)
from app.models.sql.core.role import Role
from app.models.sql.core.user import Person, User
from app.models.sql.hr.approval import ApprovalRequest
from app.models.sql.hr.device import Device, DeviceAssignment
from app.models.sql.hr.device_request import DeviceRequest
from app.services.core.audit_service import AuditService
from app.services.hr import approval_service


# ============================================================
# CONSTANTS
# ============================================================

STAGE_MANAGER = "manager"
STAGE_HR = "hr"
STAGE_FULFILMENT = "fulfilment"
STAGE_CLOSED = "closed"

STAGE_LABELS = {
    STAGE_MANAGER: "Manager",
    STAGE_HR: "HR",
    STAGE_FULFILMENT: "Fulfilment",
    STAGE_CLOSED: "Closed",
}

EDITABLE_STATUSES = {"draft", "rejected"}
OPEN_STATUSES = {
    "pending_manager",
    "pending_hr",
    "pending_fulfilment",
    "purchase_requested",
}

ENTITY_TYPE = "device_request"

HR_APPROVER_ROLES = ("head_of_hr", "executive_director", "ceo")


# ============================================================
# HELPERS
# ============================================================

def _generate_request_number() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"DR-{stamp}-{uuid4().hex[:6].upper()}"


def _parse_uuid(value: str, label: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label}.",
        )


async def get_request(
    db: AsyncSession,
    request_id: str,
) -> DeviceRequest:
    request_uuid = _parse_uuid(request_id, "device request ID")

    record = (
        await db.execute(
            select(DeviceRequest).where(DeviceRequest.id == request_uuid)
        )
    ).scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device request not found.",
        )

    return record


def assert_owner(record: DeviceRequest, actor: User) -> None:
    if not actor.person_id or record.requester_id != actor.person_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This device request belongs to someone else.",
        )


async def _find_role_person(
    db: AsyncSession,
    roles: tuple[str, ...],
    exclude_ids: set[str],
) -> Optional[str]:
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


async def _has_any_role(
    db: AsyncSession,
    person_id: Optional[str],
    role_names: set[str],
) -> bool:
    if not person_id:
        return False

    result = await db.execute(
        select(User.id)
        .join(User.roles)
        .where(
            User.person_id == person_id,
            Role.name.in_(list(role_names)),
            User.is_active.is_(True),
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _create_stage_approval(
    db: AsyncSession,
    record: DeviceRequest,
    *,
    stage: str,
    person_id: str,
    level: int,
) -> ApprovalRequest:
    approval = await approval_service.create_request(
        db,
        entity_type=ENTITY_TYPE,
        entity_id=record.id,
        requested_by_id=record.requester_id,
        title=f"Device request — {record.item_name}",
        summary=(
            f"{record.category.replace('_', ' ').title()}: "
            f"{record.item_name}"
        ),
        assigned_to_id=person_id,
        escalation_level=level,
        stage=stage,
        enforce_assignment_policy=False,
    )

    record.approval_id = approval.id
    record.current_stage = stage

    return approval


# ============================================================
# CREATE / UPDATE / SUBMIT / CANCEL
# ============================================================

async def create_request(
    db: AsyncSession,
    payload: DeviceRequestCreate,
    actor: User,
) -> DeviceRequest:
    if not actor.person_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not linked to a person record.",
        )

    record = DeviceRequest(
        request_number=_generate_request_number(),
        requester_id=actor.person_id,
        category=payload.category,
        item_name=payload.item_name.strip(),
        justification=(
            payload.justification.strip()
            if payload.justification
            else None
        ),
        needed_by=payload.needed_by,
        status="draft",
    )

    db.add(record)
    await db.flush()

    await AuditService.log(
        db,
        actor=actor,
        action="DEVICE_REQUEST_CREATED",
        entity_type=ENTITY_TYPE,
        entity_id=record.id,
        description=(
            f"Draft device request {record.request_number} created."
        ),
        new_values={
            "category": record.category,
            "item_name": record.item_name,
        },
    )

    return record


async def update_request(
    db: AsyncSession,
    record: DeviceRequest,
    payload: DeviceRequestUpdate,
    actor: User,
) -> DeviceRequest:
    assert_owner(record, actor)

    if record.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft or rejected device requests can be edited.",
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "item_name" and value:
            value = value.strip()
        if field == "justification" and value:
            value = value.strip()
        setattr(record, field, value)

    return record


async def submit_request(
    db: AsyncSession,
    record: DeviceRequest,
    actor: User,
    request: Optional[Request] = None,
) -> DeviceRequest:
    assert_owner(record, actor)

    if record.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft or rejected device requests can be submitted.",
        )

    if record.status == "rejected":
        record.rejection_reason = None
        record.manager_decided_by_id = None
        record.manager_decided_at = None
        record.manager_decision_note = None
        record.hr_decided_by_id = None
        record.hr_decided_at = None
        record.hr_decision_note = None

    manager_id = await approval_service._resolve_manager_person_id(
        db, record.requester_id
    )

    if (
        manager_id
        and manager_id != record.requester_id
        and await approval_service._is_active_approver(db, manager_id)
    ):
        stage = STAGE_MANAGER
        approver_id = manager_id
        level = 0
        new_status = "pending_manager"
    else:
        approver_id = await _find_role_person(
            db, HR_APPROVER_ROLES, {record.requester_id}
        )
        if not approver_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "No approver could be resolved. Set a manager or "
                    "assign the Head of HR role."
                ),
            )
        stage = STAGE_HR
        level = 1
        new_status = "pending_hr"

    record.status = new_status
    record.submitted_at = datetime.now(timezone.utc)
    record.current_stage = stage

    await _create_stage_approval(
        db,
        record,
        stage=stage,
        person_id=approver_id,
        level=level,
    )

    await AuditService.log(
        db,
        actor=actor,
        action="DEVICE_REQUEST_SUBMITTED",
        entity_type=ENTITY_TYPE,
        entity_id=record.id,
        description=(
            f"Device request {record.request_number} submitted for "
            f"{STAGE_LABELS[stage]} approval."
        ),
        new_values={"stage": stage, "approver_id": approver_id},
        request=request,
    )

    return record


async def cancel_request(
    db: AsyncSession,
    record: DeviceRequest,
    actor: User,
    request: Optional[Request] = None,
) -> DeviceRequest:
    assert_owner(record, actor)

    if record.status not in OPEN_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only open device requests can be cancelled.",
        )

    if record.approval_id:
        await approval_service.cancel(
            db,
            request_id=str(record.approval_id),
            actor=actor,
        )

    record.status = "cancelled"
    record.current_stage = STAGE_CLOSED
    record.approval_id = None
    record.closed_at = datetime.now(timezone.utc)

    await AuditService.log(
        db,
        actor=actor,
        action="DEVICE_REQUEST_CANCELLED",
        entity_type=ENTITY_TYPE,
        entity_id=record.id,
        description=(
            f"Device request {record.request_number} cancelled."
        ),
        request=request,
    )

    return record


# ============================================================
# DECIDE
# ============================================================

async def _assert_stage_authority(
    db: AsyncSession,
    *,
    record: DeviceRequest,
    approval: ApprovalRequest,
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
            detail="The requester cannot decide their own device request.",
        )

    if approval.assigned_to_id == actor_person_id:
        return

    if await _has_any_role(
        db, actor_person_id, set(HR_APPROVER_ROLES)
    ):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=(
            f"This device request is waiting for the "
            f"{STAGE_LABELS.get(record.current_stage or '', '').lower()} "
            f"stage."
        ),
    )


async def decide(
    db: AsyncSession,
    *,
    approval: ApprovalRequest,
    actor: User,
    approve: bool,
    note: Optional[str] = None,
) -> DeviceRequest:
    record = await get_request(db, approval.entity_id)

    if (
        record.approval_id
        and str(record.approval_id) != str(approval.id)
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This approval is no longer the active stage for the "
                "device request."
            ),
        )

    stage = record.current_stage
    if stage not in {STAGE_MANAGER, STAGE_HR}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This device request is not awaiting an approval decision.",
        )

    if approval.stage and approval.stage != stage:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Approval stage does not match the device request.",
        )

    await _assert_stage_authority(
        db,
        record=record,
        approval=approval,
        actor=actor,
    )

    now = datetime.now(timezone.utc)

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

        if stage == STAGE_MANAGER:
            record.manager_decided_by_id = actor.person_id
            record.manager_decided_at = now
            record.manager_decision_note = note.strip()
        else:
            record.hr_decided_by_id = actor.person_id
            record.hr_decided_at = now
            record.hr_decision_note = note.strip()

        record.status = "rejected"
        record.current_stage = STAGE_CLOSED
        record.approval_id = None
        record.rejection_reason = note.strip()

        await AuditService.log(
            db,
            actor=actor,
            action="DEVICE_REQUEST_REJECTED",
            entity_type=ENTITY_TYPE,
            entity_id=record.id,
            description=(
                f"Device request {record.request_number} rejected at the "
                f"{STAGE_LABELS[stage]} stage."
            ),
            new_values={
                "stage": stage,
                "rejection_reason": note.strip(),
            },
        )

        return record

    # ---------------- approve ----------------
    await approval_service.approve(
        db,
        request_id=approval.id,
        actor=actor,
        note=note,
        notify_requester=False,
    )

    if stage == STAGE_MANAGER:
        record.manager_decided_by_id = actor.person_id
        record.manager_decided_at = now
        record.manager_decision_note = note

        hr_approver = await _find_role_person(
            db,
            HR_APPROVER_ROLES,
            {record.requester_id, actor.person_id},
        )
        if not hr_approver:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "No HR approver is available. Assign the Head of HR "
                    "role before approving."
                ),
            )

        record.status = "pending_hr"
        await _create_stage_approval(
            db,
            record,
            stage=STAGE_HR,
            person_id=hr_approver,
            level=1,
        )

        await AuditService.log(
            db,
            actor=actor,
            action="DEVICE_REQUEST_STAGE_APPROVED",
            entity_type=ENTITY_TYPE,
            entity_id=record.id,
            description=(
                f"Manager approved device request "
                f"{record.request_number}."
            ),
            new_values={"stage": stage, "note": note},
        )

        await approval_service._notify_person(
            db,
            person_id=record.requester_id,
            title="Device request approved by your manager",
            body=(
                f"{record.request_number} is now with HR for review."
            ),
            link="/me/devices",
        )

        return record

    # HR stage approves; fulfilment happens in a separate HR action.
    record.hr_decided_by_id = actor.person_id
    record.hr_decided_at = now
    record.hr_decision_note = note
    record.status = "pending_fulfilment"
    record.current_stage = STAGE_FULFILMENT
    record.approval_id = None

    await AuditService.log(
        db,
        actor=actor,
        action="DEVICE_REQUEST_APPROVED",
        entity_type=ENTITY_TYPE,
        entity_id=record.id,
        description=(
            f"HR approved device request {record.request_number}."
        ),
        new_values={"stage": stage, "note": note},
    )

    await approval_service._notify_person(
        db,
        person_id=record.requester_id,
        title="Device request approved",
        body=(
            f"{record.request_number} was approved. HR will arrange "
            f"the equipment."
        ),
        link="/me/devices",
    )

    return record


# ============================================================
# FULFILMENT
# ============================================================

async def list_available_devices(
    db: AsyncSession,
) -> list[DeviceStockItem]:
    assigned_device_ids = select(DeviceAssignment.device_id).where(
        DeviceAssignment.returned_at.is_(None)
    )

    devices = (
        await db.execute(
            select(Device)
            .where(Device.id.notin_(assigned_device_ids))
            .order_by(Device.category, Device.name)
        )
    ).scalars().all()

    return [
        DeviceStockItem(
            id=str(device.id),
            name=device.name,
            category=device.category,
            brand=device.brand,
            model=device.model,
            serial_number=device.serial_number,
            condition=device.condition or "good",
        )
        for device in devices
    ]


async def fulfil_with_device(
    db: AsyncSession,
    record: DeviceRequest,
    *,
    actor: User,
    device_id: str,
    note: Optional[str] = None,
    request: Optional[Request] = None,
) -> DeviceRequest:
    if record.status not in {"pending_fulfilment", "purchase_requested"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only approved device requests can be fulfilled.",
        )

    device_uuid = _parse_uuid(device_id, "device ID")

    device = (
        await db.execute(select(Device).where(Device.id == device_uuid))
    ).scalar_one_or_none()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found in the register.",
        )

    open_assignment = (
        await db.execute(
            select(DeviceAssignment.id).where(
                DeviceAssignment.device_id == device_uuid,
                DeviceAssignment.returned_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    if open_assignment:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That device is already assigned to someone.",
        )

    now = datetime.now(timezone.utc)

    db.add(
        DeviceAssignment(
            device_id=device_uuid,
            person_id=record.requester_id,
            assigned_at=now,
            assigned_by=actor.person_id,
            condition_on_assignment=device.condition or "good",
            notes=note,
        )
    )

    record.fulfilment = record.fulfilment or "stock"
    record.device_id = device_uuid
    record.assigned_at = now
    record.status = "fulfilled"
    record.current_stage = STAGE_CLOSED
    record.closed_at = now
    record.close_note = note

    await AuditService.log(
        db,
        actor=actor,
        action="DEVICE_REQUEST_FULFILLED",
        entity_type=ENTITY_TYPE,
        entity_id=record.id,
        description=(
            f"Device {device.name} assigned against "
            f"{record.request_number}."
        ),
        new_values={
            "device_id": str(device_uuid),
            "person_id": str(record.requester_id),
            "fulfilment": record.fulfilment,
        },
        request=request,
    )

    await approval_service._notify_person(
        db,
        person_id=record.requester_id,
        title="Device ready",
        body=(
            f"{device.name} has been assigned to you against "
            f"{record.request_number}."
        ),
        link="/me/devices",
    )

    return record


async def mark_purchase(
    db: AsyncSession,
    record: DeviceRequest,
    *,
    actor: User,
    purchase_reference: Optional[str] = None,
    note: Optional[str] = None,
    request: Optional[Request] = None,
) -> DeviceRequest:
    if record.status != "pending_fulfilment":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A purchase can only be recorded for an approved request "
                "that is not yet fulfilled."
            ),
        )

    record.fulfilment = "purchase"
    record.purchase_reference = (
        purchase_reference.strip() if purchase_reference else None
    )
    record.status = "purchase_requested"
    record.close_note = note

    await AuditService.log(
        db,
        actor=actor,
        action="DEVICE_REQUEST_PURCHASE_RECORDED",
        entity_type=ENTITY_TYPE,
        entity_id=record.id,
        description=(
            f"Purchase recorded for device request "
            f"{record.request_number}."
        ),
        new_values={
            "purchase_reference": record.purchase_reference,
            "note": note,
        },
        request=request,
    )

    await approval_service._notify_person(
        db,
        person_id=record.requester_id,
        title="Device on order",
        body=(
            f"HR has ordered the equipment for {record.request_number}. "
            f"You will be notified when it is assigned."
        ),
        link="/me/devices",
    )

    return record


# ============================================================
# READ MODELS
# ============================================================

def _name(person: Optional[Person]) -> Optional[str]:
    if not person:
        return None
    return f"{person.first_name} {person.last_name}".strip()


async def _person_name(
    db: AsyncSession,
    person_id,
) -> Optional[str]:
    if not person_id:
        return None
    row = (
        await db.execute(
            select(Person.first_name, Person.last_name).where(
                Person.id == person_id
            )
        )
    ).first()
    return f"{row[0]} {row[1]}".strip() if row else None


async def _device_name(
    db: AsyncSession,
    device_id,
) -> Optional[str]:
    if not device_id:
        return None
    return (
        await db.execute(
            select(Device.name).where(Device.id == device_id)
        )
    ).scalar_one_or_none()


async def _approval_history(
    db: AsyncSession,
    record: DeviceRequest,
) -> list[DeviceRequestDecisionRecord]:
    rows = (
        await db.execute(
            select(ApprovalRequest)
            .where(
                ApprovalRequest.entity_type == ENTITY_TYPE,
                ApprovalRequest.entity_id == record.id,
            )
            .order_by(ApprovalRequest.created_at.asc())
        )
    ).scalars().all()

    history: list[DeviceRequestDecisionRecord] = []

    for row in rows:
        history.append(
            DeviceRequestDecisionRecord(
                id=str(row.id),
                stage=row.stage or "manager",
                status=row.status,
                decision=row.status,
                decided_by_name=_name(row.decided_by),
                decided_at=row.decided_at,
                note=row.decision_note,
            )
        )

    return history


async def to_response(
    db: AsyncSession,
    record: DeviceRequest,
) -> DeviceRequestResponse:
    return DeviceRequestResponse(
        id=str(record.id),
        request_number=record.request_number,
        requester_id=str(record.requester_id),
        requester_name=(
            await _person_name(db, record.requester_id) or "Someone"
        ),
        category=record.category,
        item_name=record.item_name,
        justification=record.justification,
        needed_by=record.needed_by,
        status=record.status,
        current_stage=record.current_stage,
        fulfilment=record.fulfilment,
        device_id=str(record.device_id) if record.device_id else None,
        device_name=await _device_name(db, record.device_id),
        assigned_at=record.assigned_at,
        purchase_reference=record.purchase_reference,
        rejection_reason=record.rejection_reason,
        manager_decision_note=record.manager_decision_note,
        hr_decision_note=record.hr_decision_note,
        submitted_at=record.submitted_at,
        closed_at=record.closed_at,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


async def to_detail(
    db: AsyncSession,
    record: DeviceRequest,
) -> DeviceRequestDetailResponse:
    base = await to_response(db, record)

    return DeviceRequestDetailResponse(
        **base.model_dump(),
        approval_history=await _approval_history(db, record),
    )
