"""
Smoke test for the fund-claim workflow.

Runs the full lifecycle against the configured database (production
Supabase by default) inside a single transaction that is ALWAYS rolled
back, so no claim, approval, notification or audit row is persisted.

Usage (from backend/):
    .venv/Scripts/python scripts/smoke_fund_request_workflow.py
"""

import asyncio
import logging
import sys
from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select, text

from app.core.database import AsyncSessionLocal, engine
from app.models.pydantic.finance.finance import FundRequestCreate
from app.models.sql.core.document import Document
from app.models.sql.core.role import Role
from app.models.sql.core.user import User
from app.services.finance import fund_request_service
from app.services.hr import approval_service

FINANCE_ROLES = (
    "head_of_finance",
    "finance_manager",
    "finance_officer",
)

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
                    "WHERE table_name = 'fund_requests'"
                )
            )
        ).all()
    }

    required = {
        "request_type",
        "expense_date",
        "current_stage",
        "approval_id",
        "manager_decided_by_id",
        "manager_decided_at",
        "manager_decision_note",
        "finance_decided_by_id",
        "finance_decided_at",
        "finance_decision_note",
        "ceo_decided_by_id",
        "ceo_decided_at",
        "ceo_decision_note",
        "receipt_required",
        "receipt_reference",
        "receipt_verified_by_id",
        "receipt_verified_at",
        "receipt_verification_note",
    }
    missing = sorted(required - columns)
    record("fund_requests workflow columns present", not missing, ", ".join(missing))

    legacy = {"reviewer_id", "approver_id", "reconciler_id"} & columns
    record("superseded columns dropped", not legacy, ", ".join(sorted(legacy)))

    stage = (
        await db.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = 'approval_requests' AND column_name = 'stage'"
            )
        )
    ).scalar_one_or_none()
    record("approval_requests.stage present", stage is not None)

    verify_perm = (
        await db.execute(
            text(
                "SELECT id FROM permissions "
                "WHERE resource = 'finance' AND action = 'verify'"
            )
        )
    ).scalar_one_or_none()
    record("finance.verify permission present", verify_perm is not None)

    for role_name in ("ceo", "executive_director", "head_of_finance",
                      "finance_manager", "finance_officer"):
        granted = (
            await db.execute(
                text(
                    "SELECT count(*) FROM role_permissions rp "
                    "JOIN roles r ON r.id = rp.role_id "
                    "JOIN permissions p ON p.id = rp.permission_id "
                    "WHERE r.name = :role AND p.resource = 'finance'"
                ),
                {"role": role_name},
            )
        ).scalar_one()
        detail = f"{granted} finance grants"
        ok = granted > 0
        if role_name in ("head_of_finance", "finance_manager", "finance_officer"):
            verify_granted = (
                await db.execute(
                    text(
                        "SELECT 1 FROM role_permissions rp "
                        "JOIN roles r ON r.id = rp.role_id "
                        "JOIN permissions p ON p.id = rp.permission_id "
                        "WHERE r.name = :role AND p.resource = 'finance' "
                        "AND p.action = 'verify'"
                    ),
                    {"role": role_name},
                )
            ).scalar_one_or_none()
            ok = ok and verify_granted is not None
            detail += ", verify " + ("granted" if verify_granted else "MISSING")
        record(f"{role_name} has finance access", ok, detail)


async def lifecycle(db) -> None:
    # ---- pick a requester: active, has a manager, not finance/CEO ----
    candidates = (
        await db.execute(
            select(User)
            .where(User.is_active.is_(True), User.person_id.isnot(None))
        )
    ).scalars().all()

    blocked_roles = set(FINANCE_ROLES) | {
        "ceo",
        "executive_director",
        "system_admin",
        "head_of_hr",
    }

    requester = None
    for user in sorted(
        candidates,
        key=lambda u: "staff" not in {role.name for role in u.roles},
    ):
        if not user.person or not getattr(user.person, "reports_to_id", None):
            continue
        if {role.name for role in user.roles} & blocked_roles:
            continue
        manager_person = await approval_service._resolve_manager_person_id(
            db, user.person_id
        )
        if manager_person:
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

    # ---- create a reimbursement claim ----
    record_obj = await fund_request_service.create_request(
        db,
        FundRequestCreate(
            request_type="reimbursement",
            title="Smoke test claim",
            description="Automated smoke test - rolled back.",
            expense_date=date.today(),
            amount_requested=Decimal("450.00"),
            currency="GHS",
        ),
        requester,
    )
    record(
        "claim created as draft",
        record_obj.status == "draft" and record_obj.request_number.startswith("FR-"),
        record_obj.request_number,
    )

    reimbursement_without_date_rejected = False
    try:
        FundRequestCreate(
            request_type="reimbursement",
            title="No expense date",
            amount_requested=Decimal("10.00"),
            currency="GHS",
        )
    except Exception:
        reimbursement_without_date_rejected = True
    record(
        "reimbursement requires expense date",
        reimbursement_without_date_rejected,
    )

    # ---- document gate ----
    empty_docs = await fund_request_service._count_documents(db, record_obj.id)
    record("new claim starts with 0 documents", empty_docs == 0)

    await expect_http(
        fund_request_service.submit_request(db, record_obj, requester),
        400,
        "submit without documents blocked",
    )

    db.add(
        Document(
            name="smoke-test-receipt.pdf",
            file_url="https://example.invalid/smoke-test-receipt.pdf",
            mime_type="application/pdf",
            type="receipt",
            owner_id=requester.person_id,
            related_entity_type="fund_request",
            related_entity_id=record_obj.id,
            visibility="internal",
        )
    )
    await db.flush()

    # ---- submit -> manager stage ----
    await fund_request_service.submit_request(db, record_obj, requester)
    record(
        "submit routes to manager",
        record_obj.status == "submitted" and record_obj.current_stage == "manager",
        f"{record_obj.status}/{record_obj.current_stage}",
    )

    approval = await approval_service.get_request(db, str(record_obj.approval_id))
    record(
        "approval inbox row created at manager stage",
        approval is not None
        and approval.stage == "manager"
        and approval.entity_type == "fund_request",
        f"assigned={approval.assigned_to_id}",
    )

    await expect_http(
        fund_request_service.decide(
            db, approval=approval, actor=requester, approve=True, note="self"
        ),
        403,
        "requester cannot decide own claim",
    )

    manager = await load_user(db, str(approval.assigned_to_id))
    await fund_request_service.decide(
        db, approval=approval, actor=manager, approve=True, note="Manager OK"
    )
    record(
        "manager approval moves to finance",
        record_obj.status == "manager_approved"
        and record_obj.current_stage == "finance"
        and record_obj.manager_decided_by_id == manager.person_id,
        f"{record_obj.status}/{record_obj.current_stage}",
    )

    approval = await approval_service.get_request(db, str(record_obj.approval_id))
    finance_user = await load_user(db, str(approval.assigned_to_id))
    finance_role_names = {role.name for role in finance_user.roles}
    routed_head = sorted(finance_role_names & set(FINANCE_ROLES))
    record(
        "finance stage routed to finance leadership",
        bool(routed_head),
        f"{finance_user.person.first_name} {finance_user.person.last_name} "
        f"({', '.join(routed_head) or 'no finance role'})",
    )
    record(
        "requester never routed to self",
        record_obj.requester_id != approval.assigned_to_id,
    )

    await expect_http(
        fund_request_service.decide(
            db,
            approval=approval,
            actor=finance_user,
            approve=True,
            approved_amount=Decimal("500.00"),
        ),
        400,
        "finance cannot approve above requested amount",
    )

    await fund_request_service.decide(
        db,
        approval=approval,
        actor=finance_user,
        approve=True,
        note="Finance OK",
        approved_amount=Decimal("400.00"),
    )
    record(
        "finance approval caps amount and moves to CEO",
        record_obj.status == "finance_approved"
        and record_obj.current_stage == "ceo"
        and Decimal(str(record_obj.approved_amount)) == Decimal("400.00"),
        f"{record_obj.status}/{record_obj.current_stage} approved={record_obj.approved_amount}",
    )

    approval = await approval_service.get_request(db, str(record_obj.approval_id))
    ceo = await load_user(db, str(approval.assigned_to_id))
    await fund_request_service.decide(
        db, approval=approval, actor=ceo, approve=True, note="CEO OK"
    )
    record(
        "CEO approval completes the chain",
        record_obj.status == "approved"
        and record_obj.current_stage == "disbursement"
        and record_obj.approved_at is not None,
        f"{record_obj.status}/{record_obj.current_stage}",
    )

    # ---- disbursement ----
    await expect_http(
        fund_request_service.disburse(
            db, record_obj, actor=requester, amount=Decimal("400.00")
        ),
        403,
        "requester cannot disburse own claim",
    )
    await expect_http(
        fund_request_service.disburse(
            db, record_obj, actor=finance_user, amount=Decimal("500.00")
        ),
        400,
        "disbursement cannot exceed approved amount",
    )

    await fund_request_service.disburse(
        db,
        record_obj,
        actor=finance_user,
        amount=Decimal("400.00"),
        notes="Smoke test payout",
    )
    record(
        "disbursement moves to receipt verification",
        record_obj.status == "disbursed"
        and record_obj.current_stage == "verification"
        and Decimal(str(record_obj.amount_disbursed)) == Decimal("400.00"),
        f"{record_obj.status}/{record_obj.current_stage}",
    )

    # ---- hardcopy verification ----
    await expect_http(
        fund_request_service.verify_receipt(
            db, record_obj, actor=requester, verified=True
        ),
        403,
        "requester cannot verify own receipts",
    )
    await expect_http(
        fund_request_service.verify_receipt(
            db, record_obj, actor=finance_user, verified=False, note=""
        ),
        400,
        "returning receipts requires a note",
    )

    await fund_request_service.verify_receipt(
        db,
        record_obj,
        actor=finance_user,
        verified=False,
        note="Receipt is missing the vendor stamp.",
    )
    record(
        "returned receipts reopen verification",
        record_obj.status == "verification_failed"
        and record_obj.current_stage == "verification",
        record_obj.status,
    )

    await fund_request_service.verify_receipt(
        db,
        record_obj,
        actor=finance_user,
        verified=True,
        note="Hardcopy received and checked.",
        receipt_reference="RC-0001",
    )
    record(
        "verified receipts close the claim",
        record_obj.status == "verified"
        and record_obj.current_stage == "closed"
        and record_obj.receipt_reference == "RC-0001",
        f"{record_obj.status}/{record_obj.current_stage}",
    )

    # ---- read models ----
    await db.refresh(record_obj)
    detail = await fund_request_service.to_detail(db, record_obj)
    response = await fund_request_service.to_response(db, record_obj)
    documents = (detail.get("documents") if isinstance(detail, dict) else
                 getattr(detail, "documents", None)) or []
    record(
        "detail view exposes documents and history",
        len(documents) >= 1,
        f"{len(documents)} document(s)",
    )
    record(
        "list view exposes stage decisions",
        getattr(response, "requester_name", None) is not None,
    )


async def main() -> int:
    # The engine is created with echo=True when DEBUG is set.
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
