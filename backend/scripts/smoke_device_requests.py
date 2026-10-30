"""
Smoke test for the device-request workflow.

Runs create -> submit -> manager -> HR -> purchase recorded -> assign from
stock against the configured database inside a single transaction that is
ALWAYS rolled back, so no request, approval, assignment or audit row is
persisted.

Usage (from backend/):
    .venv/Scripts/python scripts/smoke_device_requests.py
"""

import asyncio
import logging
import sys

from fastapi import HTTPException
from sqlalchemy import select, text

from app.core.database import AsyncSessionLocal, engine
from app.models.pydantic.hr.device_request import (
    DeviceRequestCreate,
    DeviceRequestUpdate,
)
from app.models.sql.core.user import User
from app.models.sql.hr.device import Device, DeviceAssignment
from app.services.hr import approval_service, device_request_service

results: list[tuple[str, bool, str]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""))


async def expect_http(coro, status: int, name: str) -> None:
    try:
        await coro
    except HTTPException as exc:
        record(
            name,
            exc.status_code == status,
            f"got {exc.status_code}: {exc.detail}",
        )
        return
    record(name, False, f"no HTTPException raised (expected {status})")


async def load_user(db, person_id: str) -> User:
    user = (
        await db.execute(
            select(User).where(
                User.person_id == person_id,
                User.is_active.is_(True),
            )
        )
    ).scalars().first()
    if not user:
        raise RuntimeError(f"No active user for person {person_id}")
    return user


async def schema_checks(db) -> None:
    columns = {
        row[0]
        for row in (
            await db.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = 'device_requests'"
                )
            )
        ).all()
    }

    required = {
        "request_number",
        "requester_id",
        "category",
        "item_name",
        "justification",
        "needed_by",
        "status",
        "current_stage",
        "approval_id",
        "manager_decided_by_id",
        "manager_decided_at",
        "manager_decision_note",
        "hr_decided_by_id",
        "hr_decided_at",
        "hr_decision_note",
        "fulfilment",
        "device_id",
        "assigned_at",
        "purchase_reference",
        "close_note",
        "rejection_reason",
        "submitted_at",
        "closed_at",
    }
    missing = sorted(required - columns)
    record("device_requests table present", bool(columns), f"{len(columns)} columns")
    record("device_requests workflow columns present", not missing, ", ".join(missing))

    for action in ("view", "manage"):
        perm = (
            await db.execute(
                text(
                    "SELECT id FROM permissions "
                    "WHERE resource = 'devices' AND action = :action"
                ),
                {"action": action},
            )
        ).scalar_one_or_none()
        record(f"devices.{action} permission present", perm is not None)

    expected_grants = {
        "ceo": {"view"},
        "executive_director": {"view"},
        "head_of_hr": {"view", "manage"},
        "system_admin": {"view", "manage"},
    }
    for role_name, actions in expected_grants.items():
        granted = {
            row[0]
            for row in (
                await db.execute(
                    text(
                        "SELECT p.action FROM role_permissions rp "
                        "JOIN roles r ON r.id = rp.role_id "
                        "JOIN permissions p ON p.id = rp.permission_id "
                        "WHERE r.name = :role AND p.resource = 'devices'"
                    ),
                    {"role": role_name},
                )
            ).all()
        }
        missing_actions = sorted(actions - granted)
        record(
            f"{role_name} has devices grants",
            not missing_actions,
            ", ".join(missing_actions) or ", ".join(sorted(granted)),
        )


async def lifecycle(db) -> None:
    # ---- pick a requester: active, has a manager ----
    candidates = (
        await db.execute(
            select(User).where(
                User.is_active.is_(True),
                User.person_id.isnot(None),
            )
        )
    ).scalars().all()

    requester = None
    for user in candidates:
        if not user.person or not getattr(user.person, "reports_to_id", None):
            continue
        manager_person = await approval_service._resolve_manager_person_id(
            db, user.person_id
        )
        if manager_person and manager_person != user.person_id:
            requester = user
            break

    if requester is None:
        record("requester with manager resolved", False)
        return
    record(
        "requester with manager resolved",
        True,
        f"{requester.person.first_name} {requester.person.last_name}",
    )

    # ---- create draft ----
    record_obj = await device_request_service.create_request(
        db,
        DeviceRequestCreate(
            category="laptop",
            item_name="Smoke test laptop",
            justification="Automated smoke test - rolled back.",
        ),
        requester,
    )
    record(
        "device request created as draft",
        record_obj.status == "draft"
        and record_obj.request_number.startswith("DR-"),
        record_obj.request_number,
    )

    await device_request_service.update_request(
        db,
        record_obj,
        DeviceRequestUpdate(justification="Updated by smoke test."),
        requester,
    )
    record(
        "draft can be edited",
        record_obj.justification == "Updated by smoke test.",
    )

    # ---- submit -> manager stage ----
    await device_request_service.submit_request(db, record_obj, requester)
    record(
        "submit routes to manager",
        record_obj.status == "pending_manager"
        and record_obj.current_stage == "manager"
        and record_obj.submitted_at is not None,
        f"{record_obj.status}/{record_obj.current_stage}",
    )

    approval = await approval_service.get_request(db, str(record_obj.approval_id))
    record(
        "approval inbox row created at manager stage",
        approval is not None
        and approval.stage == "manager"
        and approval.entity_type == "device_request",
        f"assigned={approval.assigned_to_id}",
    )

    await expect_http(
        device_request_service.decide(
            db, approval=approval, actor=requester, approve=True, note="self"
        ),
        403,
        "requester cannot decide own request",
    )

    # ---- manager approves -> HR stage ----
    manager = await load_user(db, str(approval.assigned_to_id))
    await device_request_service.decide(
        db, approval=approval, actor=manager, approve=True, note="Manager OK"
    )
    record(
        "manager approval moves to HR",
        record_obj.status == "pending_hr"
        and record_obj.current_stage == "hr"
        and record_obj.manager_decided_by_id == manager.person_id,
        f"{record_obj.status}/{record_obj.current_stage}",
    )

    approval = await approval_service.get_request(db, str(record_obj.approval_id))
    hr_user = await load_user(db, str(approval.assigned_to_id))
    hr_role_names = {role.name for role in hr_user.roles}
    routed = sorted(
        hr_role_names & set(device_request_service.HR_APPROVER_ROLES)
    )
    record(
        "HR stage routed to an HR approver",
        bool(routed),
        f"{hr_user.person.first_name} {hr_user.person.last_name} "
        f"({', '.join(routed) or 'no HR role'})",
    )
    record(
        "requester never routed to self",
        record_obj.requester_id != approval.assigned_to_id,
    )

    await expect_http(
        device_request_service.decide(
            db, approval=approval, actor=hr_user, approve=False, note=""
        ),
        400,
        "rejection requires a reason",
    )

    # ---- HR approves -> fulfilment ----
    await device_request_service.decide(
        db, approval=approval, actor=hr_user, approve=True, note="HR OK"
    )
    record(
        "HR approval moves to fulfilment",
        record_obj.status == "pending_fulfilment"
        and record_obj.current_stage == "fulfilment"
        and record_obj.approval_id is None
        and record_obj.hr_decided_by_id == hr_user.person_id,
        f"{record_obj.status}/{record_obj.current_stage}",
    )

    # ---- fulfil cannot happen before approval ----
    late = await device_request_service.create_request(
        db,
        DeviceRequestCreate(
            category="monitor", item_name="Smoke test monitor"
        ),
        requester,
    )
    early_device = Device(
        name="Smoke test spare monitor",
        category="monitor",
        condition="good",
    )
    db.add(early_device)
    await db.flush()
    await expect_http(
        device_request_service.fulfil_with_device(
            db, late, actor=hr_user, device_id=str(early_device.id)
        ),
        409,
        "fulfilment blocked before approval",
    )

    # ---- record purchase, then assign stock ----
    await device_request_service.mark_purchase(
        db,
        record_obj,
        actor=hr_user,
        purchase_reference="PO-SMOKE-1",
        note="Ordered from supplier.",
    )
    record(
        "purchase recorded",
        record_obj.status == "purchase_requested"
        and record_obj.fulfilment == "purchase"
        and record_obj.purchase_reference == "PO-SMOKE-1",
        f"{record_obj.status}/{record_obj.fulfilment}",
    )

    device = Device(
        name="Smoke test laptop",
        category="laptop",
        brand="Smoke",
        condition="good",
    )
    db.add(device)
    await db.flush()

    stock = await device_request_service.list_available_devices(db)
    stock_ids = {item.id for item in stock}
    record("new device appears in stock", str(device.id) in stock_ids)

    await device_request_service.fulfil_with_device(
        db,
        record_obj,
        actor=hr_user,
        device_id=str(device.id),
        note="Handed over at the office.",
    )
    record(
        "assigning a device closes the request",
        record_obj.status == "fulfilled"
        and record_obj.current_stage == "closed"
        and str(record_obj.device_id) == str(device.id)
        and record_obj.closed_at is not None,
        f"{record_obj.status}/{record_obj.current_stage}",
    )

    assignment = (
        await db.execute(
            select(DeviceAssignment).where(
                DeviceAssignment.device_id == device.id
            )
        )
    ).scalars().first()
    record(
        "device assignment recorded for the requester",
        assignment is not None
        and assignment.person_id == record_obj.requester_id
        and assignment.returned_at is None,
    )

    await expect_http(
        device_request_service.fulfil_with_device(
            db, record_obj, actor=hr_user, device_id=str(device.id)
        ),
        409,
        "closed request cannot be fulfilled twice",
    )

    await expect_http(
        device_request_service.mark_purchase(
            db, record_obj, actor=hr_user, purchase_reference="PO-2"
        ),
        409,
        "purchase cannot be recorded after fulfilment",
    )

    # ---- fulfilment must not reuse an assigned device ----
    second = await device_request_service.create_request(
        db,
        DeviceRequestCreate(category="monitor", item_name="Second monitor"),
        requester,
    )
    await device_request_service.submit_request(db, second, requester)
    approval = await approval_service.get_request(db, str(second.approval_id))
    manager = await load_user(db, str(approval.assigned_to_id))
    await device_request_service.decide(
        db, approval=approval, actor=manager, approve=True, note="OK"
    )
    approval = await approval_service.get_request(db, str(second.approval_id))
    hr_user = await load_user(db, str(approval.assigned_to_id))
    await device_request_service.decide(
        db, approval=approval, actor=hr_user, approve=True, note="OK"
    )
    await expect_http(
        device_request_service.fulfil_with_device(
            db, second, actor=hr_user, device_id=str(device.id)
        ),
        409,
        "cannot assign a device that is already out",
    )

    # ---- read models ----
    await db.refresh(record_obj)
    detail = await device_request_service.to_detail(db, record_obj)
    record(
        "detail exposes requester and approval history",
        detail.requester_name is not None
        and len(detail.approval_history) >= 2
        and detail.device_name == "Smoke test laptop",
        f"{len(detail.approval_history)} history entries",
    )


async def main() -> int:
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine.Engine").setLevel(logging.WARNING)

    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            await schema_checks(db)
            await lifecycle(db)
        finally:
            await trans.rollback()
            print("\nTransaction rolled back - no rows persisted.")

    await engine.dispose()

    failed = [name for name, ok, _ in results if not ok]
    print(
        f"\n{len(results) - len(failed)}/{len(results)} checks passed"
        + (f" - FAILED: {', '.join(failed)}" if failed else "")
    )
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
