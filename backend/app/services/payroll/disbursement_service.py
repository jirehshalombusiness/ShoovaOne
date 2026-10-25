from __future__ import annotations

import csv
import hashlib
import io
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.sql.core.user import User
from app.models.sql.payroll.disbursement import (
    DisbursementBatch,
    DisbursementItem,
)
from app.models.sql.payroll.employee import EmployeeBankAccount
from app.models.sql.payroll.runs import PayRun, PayRunItem
from app.services.core.audit_service import AuditService
from app.services.payroll.calculator import dec, money
from app.services.payroll.encryption import BankAccountEncryption

ZERO = Decimal("0.00")

BANK_METHODS = {"bank_transfer", "mobile_money"}
VALID_METHODS = {"bank_transfer", "mobile_money", "check", "cash"}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def item_to_dict(item: DisbursementItem) -> dict:
    return {
        "id": str(item.id),
        "person_id": str(item.person_id),
        "person_name": item.person_name,
        "employee_number": item.employee_number,
        "amount": item.amount,
        "method": item.method,
        "destination_masked": item.destination_masked,
        "status": item.status,
        "failure_reason": item.failure_reason,
        "retry_count": item.retry_count,
        "provider_reference": item.provider_reference,
        "paid_at": item.paid_at,
    }


def batch_to_dict(batch: DisbursementBatch, include_items: bool = True) -> dict:
    payload = {
        "id": str(batch.id),
        "batch_number": batch.batch_number,
        "run_id": str(batch.run_id),
        "method": batch.method,
        "currency": batch.currency,
        "pay_date": batch.pay_date,
        "status": batch.status,
        "control_count": batch.control_count,
        "control_total": batch.control_total,
        "bank_file_reference": batch.bank_file_reference,
        "bank_file_hash": batch.bank_file_hash,
        "provider_reference": batch.provider_reference,
        "created_by_id": str(batch.created_by_id) if batch.created_by_id else None,
        "approved_by_id": str(batch.approved_by_id) if batch.approved_by_id else None,
        "approved_at": batch.approved_at,
        "submitted_at": batch.submitted_at,
        "paid_at": batch.paid_at,
        "notes": batch.notes,
        "created_at": batch.created_at,
    }

    if include_items:
        payload["items"] = [item_to_dict(item) for item in (batch.items or [])]

    return payload


async def load_batch(
    db: AsyncSession,
    batch_id: str,
    include_items: bool = True,
) -> DisbursementBatch:
    query = select(DisbursementBatch).options(selectinload(DisbursementBatch.run))
    if include_items:
        query = query.options(
            selectinload(DisbursementBatch.items)
        )

    result = await db.execute(
        query.where(DisbursementBatch.id == batch_id).execution_options(
            populate_existing=True
        )
    )
    batch = result.scalar_one_or_none()

    if not batch:
        raise HTTPException(status_code=404, detail="Disbursement batch not found")

    return batch


async def primary_bank_account(
    db: AsyncSession,
    person_id,
    pay_date: date,
) -> Optional[EmployeeBankAccount]:
    result = await db.execute(
        select(EmployeeBankAccount)
        .where(
            EmployeeBankAccount.person_id == person_id,
            EmployeeBankAccount.is_primary.is_(True),
            EmployeeBankAccount.verification_status == "verified",
            EmployeeBankAccount.effective_from <= pay_date,
            or_(
                EmployeeBankAccount.effective_to.is_(None),
                EmployeeBankAccount.effective_to >= pay_date,
            ),
        )
        .order_by(EmployeeBankAccount.effective_from.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def destination_label(batch_method: str, account: Optional[EmployeeBankAccount]) -> str:
    if batch_method == "check":
        return "Cheque"
    if batch_method == "cash":
        return "Cash"
    if not account:
        return "Missing bank account"
    if batch_method == "mobile_money":
        provider = account.mobile_money_provider or account.bank_name
        return f"{provider} ****{account.account_number_last4}"
    return f"{account.bank_name} ****{account.account_number_last4}"


class DisbursementService:
    @staticmethod
    async def create_batch(
        db: AsyncSession,
        *,
        run_id: str,
        method: str,
        pay_date: Optional[date],
        notes: Optional[str],
        actor: User,
    ) -> DisbursementBatch:
        if method not in VALID_METHODS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported payment method: {method}",
            )

        run_result = await db.execute(
            select(PayRun)
            .options(selectinload(PayRun.items))
            .where(PayRun.id == run_id)
        )
        run = run_result.scalar_one_or_none()
        if not run:
            raise HTTPException(status_code=404, detail="Pay run not found")

        if run.status not in {"finalized", "disbursing"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "A disbursement batch requires a finalized pay run "
                    f"(current status: {run.status})."
                ),
            )

        existing_result = await db.execute(
            select(DisbursementBatch).where(
                DisbursementBatch.run_id == run_id,
                DisbursementBatch.status.not_in(
                    ["cancelled", "failed"]
                ),
            )
        )
        if existing_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An active disbursement batch already exists for this run.",
            )

        batch_date = pay_date or run.period.pay_date

        batch = DisbursementBatch(
            id=str(uuid.uuid4()),
            batch_number=(
                f"PB-{batch_date.strftime('%Y%m%d')}-"
                f"{uuid.uuid4().hex[:6].upper()}"
            ),
            run_id=run.id,
            method=method,
            currency=run.currency,
            pay_date=batch_date,
            status="pending_approval",
            control_count=0,
            control_total=ZERO,
            created_by_id=actor.person_id,
            notes=notes,
        )
        db.add(batch)
        await db.flush()

        control_total = ZERO
        created = 0

        for item in run.items:
            if item.status in {"held", "cancelled"}:
                continue

            amount = dec(item.net_pay)
            if amount <= ZERO:
                continue

            account = None
            failure_reason = None

            if method in BANK_METHODS:
                account = await primary_bank_account(
                    db,
                    item.person_id,
                    batch_date,
                )
                if not account:
                    failure_reason = (
                        "No verified primary bank account is available "
                        "for the pay date."
                    )

            db.add(
                DisbursementItem(
                    id=str(uuid.uuid4()),
                    batch_id=batch.id,
                    run_item_id=item.id,
                    person_id=item.person_id,
                    person_name=item.person_name,
                    employee_number=item.employee_number,
                    amount=money(amount),
                    method=method,
                    destination_masked=destination_label(method, account),
                    status="failed" if failure_reason else "pending",
                    failure_reason=failure_reason,
                )
            )

            control_total += amount
            created += 1

        if created == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="There are no payable items in this run.",
            )

        batch.control_count = created
        batch.control_total = money(control_total)

        await AuditService.log(
            db=db,
            actor=actor,
            action="PAYROLL_BATCH_CREATED",
            entity_type="payroll_disbursement_batch",
            entity_id=batch.id,
            description=(
                f"Created {method} batch for {created} employees "
                f"totalling {run.currency} {batch.control_total}"
            ),
            new_values={
                "run_id": str(run.id),
                "method": method,
                "control_total": str(batch.control_total),
            },
        )

        await db.commit()
        return await load_batch(db, str(batch.id))

    @staticmethod
    async def approve_batch(
        db: AsyncSession,
        *,
        batch_id: str,
        actor: User,
        note: Optional[str] = None,
    ) -> DisbursementBatch:
        batch = await load_batch(db, batch_id)

        if batch.status != "pending_approval":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Only a pending batch can be approved "
                    f"(current status: {batch.status})."
                ),
            )

        if actor.person_id and str(actor.person_id) == str(batch.created_by_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Segregation of duties: the batch creator cannot "
                    "approve the same batch."
                ),
            )

        batch.status = "approved"
        batch.approved_by_id = actor.person_id
        batch.approved_at = utcnow()
        batch.notes = (batch.notes or "") + (
            f"\nApproval note: {note}" if note else ""
        )

        await AuditService.log(
            db=db,
            actor=actor,
            action="PAYROLL_BATCH_APPROVED",
            entity_type="payroll_disbursement_batch",
            entity_id=batch.id,
            description=f"Approved disbursement batch {batch.batch_number}",
            new_values={"status": batch.status, "note": note},
        )

        await db.commit()
        return await load_batch(db, batch_id)

    @staticmethod
    async def generate_bank_file(
        db: AsyncSession,
        *,
        batch_id: str,
        actor: User,
    ) -> tuple[str, str]:
        batch = await load_batch(db, batch_id)

        if batch.status not in {"approved", "submitted", "processing"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The batch must be approved before a bank file is generated.",
            )

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            [
                "employee_number",
                "employee_name",
                "bank_name",
                "bank_code",
                "account_name",
                "account_number",
                "amount",
                "currency",
                "reference",
            ]
        )

        total = ZERO
        count = 0

        for item in batch.items:
            if item.status not in {"pending", "submitted", "processing"}:
                continue

            account = await primary_bank_account(
                db,
                item.person_id,
                batch.pay_date,
            )
            if not account and batch.method in BANK_METHODS:
                item.status = "failed"
                item.failure_reason = "Bank account missing or unverified."
                continue

            account_number = ""
            if account:
                account_number = BankAccountEncryption.decrypt(
                    account.account_number_encrypted
                )

            writer.writerow(
                [
                    item.employee_number or "",
                    item.person_name,
                    account.bank_name if account else "",
                    account.bank_code if account else "",
                    account.account_name if account else "",
                    account_number,
                    str(money(item.amount)),
                    batch.currency,
                    batch.batch_number,
                ]
            )
            total += dec(item.amount)
            count += 1

        writer.writerow(
            [
                "TOTAL",
                "",
                "",
                "",
                "",
                "",
                str(money(total)),
                batch.currency,
                f"{count} records",
            ]
        )

        content = buffer.getvalue()
        encoded = content.encode("utf-8")
        batch.bank_file_hash = hashlib.sha256(encoded).hexdigest()
        batch.bank_file_reference = f"{batch.batch_number}.csv"
        batch.control_count = count
        batch.control_total = money(total)

        await AuditService.log(
            db=db,
            actor=actor,
            action="PAYROLL_BANK_FILE_GENERATED",
            entity_type="payroll_disbursement_batch",
            entity_id=batch.id,
            description=(
                f"Generated bank file {batch.bank_file_reference} "
                f"for {count} employees"
            ),
            new_values={
                "hash": batch.bank_file_hash,
                "control_total": str(batch.control_total),
                "control_count": count,
            },
        )

        await db.commit()
        return batch.bank_file_reference, content

    @staticmethod
    async def submit_batch(
        db: AsyncSession,
        *,
        batch_id: str,
        actor: User,
        provider_reference: Optional[str] = None,
    ) -> DisbursementBatch:
        batch = await load_batch(db, batch_id)

        if batch.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Only an approved batch can be submitted "
                    f"(current status: {batch.status})."
                ),
            )

        now = utcnow()
        batch.status = "processing"
        batch.submitted_at = now
        batch.provider_reference = provider_reference

        for item in batch.items:
            if item.status == "pending":
                item.status = "submitted"
                item.provider_reference = provider_reference

        run_result = await db.execute(
            select(PayRun).where(PayRun.id == batch.run_id)
        )
        run = run_result.scalar_one_or_none()
        if run and run.status == "finalized":
            run.status = "disbursing"

        await AuditService.log(
            db=db,
            actor=actor,
            action="PAYROLL_BATCH_SUBMITTED",
            entity_type="payroll_disbursement_batch",
            entity_id=batch.id,
            description=f"Submitted disbursement batch {batch.batch_number}",
            new_values={
                "status": batch.status,
                "provider_reference": provider_reference,
            },
        )

        await db.commit()
        return await load_batch(db, batch_id)

    @staticmethod
    async def reconcile_item(
        db: AsyncSession,
        *,
        item_id: str,
        outcome: str,
        actor: User,
        failure_reason: Optional[str] = None,
        provider_reference: Optional[str] = None,
    ) -> DisbursementBatch:
        result = await db.execute(
            select(DisbursementItem).where(DisbursementItem.id == item_id)
        )
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail="Payment item not found")

        if item.status not in {"pending", "submitted", "processing", "failed"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Payment item cannot be reconciled from {item.status}",
            )

        if outcome == "paid":
            item.status = "paid"
            item.paid_at = utcnow()
            item.failure_reason = None
            item.provider_reference = provider_reference or item.provider_reference

            run_item_result = await db.execute(
                select(PayRunItem).where(PayRunItem.id == item.run_item_id)
            )
            run_item = run_item_result.scalar_one_or_none()
            if run_item:
                run_item.status = "paid"
        else:
            item.status = "failed"
            item.failure_reason = failure_reason or "Payment failed"
            item.provider_reference = provider_reference or item.provider_reference

        await AuditService.log(
            db=db,
            actor=actor,
            action="PAYROLL_PAYMENT_RECONCILED",
            entity_type="payroll_disbursement_item",
            entity_id=item.id,
            description=f"Payment marked {outcome}",
            new_values={
                "status": outcome,
                "failure_reason": failure_reason,
            },
        )

        await db.flush()

        batch = await load_batch(db, str(item.batch_id))
        await DisbursementService._refresh_batch_status(db, batch)
        await db.commit()
        return await load_batch(db, str(item.batch_id))

    @staticmethod
    async def reconcile_batch(
        db: AsyncSession,
        *,
        batch_id: str,
        outcome: str,
        actor: User,
        failure_reason: Optional[str] = None,
        provider_reference: Optional[str] = None,
    ) -> DisbursementBatch:
        batch = await load_batch(db, batch_id)

        if batch.status in {"draft", "pending_approval", "approved"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The batch has not been submitted for payment.",
            )

        now = utcnow()
        for item in batch.items:
            if item.status in {"paid", "failed", "cancelled"}:
                continue

            if outcome == "paid":
                item.status = "paid"
                item.paid_at = now
                item.failure_reason = None
                item.provider_reference = provider_reference or item.provider_reference

                run_item_result = await db.execute(
                    select(PayRunItem).where(PayRunItem.id == item.run_item_id)
                )
                run_item = run_item_result.scalar_one_or_none()
                if run_item:
                    run_item.status = "paid"
            else:
                item.status = "failed"
                item.failure_reason = failure_reason or "Batch payment failed"
                item.provider_reference = provider_reference or item.provider_reference

        await DisbursementService._refresh_batch_status(db, batch)

        await AuditService.log(
            db=db,
            actor=actor,
            action="PAYROLL_BATCH_RECONCILED",
            entity_type="payroll_disbursement_batch",
            entity_id=batch.id,
            description=f"Reconciled batch {batch.batch_number} as {outcome}",
            new_values={
                "outcome": outcome,
                "failure_reason": failure_reason,
            },
        )

        await db.commit()
        return await load_batch(db, batch_id)

    @staticmethod
    async def retry_item(
        db: AsyncSession,
        *,
        item_id: str,
        actor: User,
        provider_reference: Optional[str] = None,
    ) -> DisbursementBatch:
        result = await db.execute(
            select(DisbursementItem).where(DisbursementItem.id == item_id)
        )
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail="Payment item not found")

        if item.status != "failed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only a failed payment can be retried.",
            )

        item.status = "submitted"
        item.retry_count += 1
        item.failure_reason = None
        item.provider_reference = provider_reference

        batch = await load_batch(db, str(item.batch_id))
        if batch.status in {"failed", "partially_paid"}:
            batch.status = "processing"

        await AuditService.log(
            db=db,
            actor=actor,
            action="PAYROLL_PAYMENT_RETRIED",
            entity_type="payroll_disbursement_item",
            entity_id=item.id,
            description=f"Payment retry #{item.retry_count}",
            new_values={"retry_count": item.retry_count},
        )

        await db.commit()
        return await load_batch(db, str(item.batch_id))

    @staticmethod
    async def _refresh_batch_status(
        db: AsyncSession,
        batch: DisbursementBatch,
    ) -> None:
        statuses = [item.status for item in batch.items]

        if not statuses:
            batch.status = "failed"
            return

        if all(value == "paid" for value in statuses):
            batch.status = "paid"
            batch.paid_at = utcnow()
        elif all(value in {"failed", "cancelled"} for value in statuses):
            batch.status = "failed"
        elif any(value == "paid" for value in statuses):
            batch.status = "partially_paid"
        elif any(value in {"submitted", "processing"} for value in statuses):
            batch.status = "processing"
        else:
            batch.status = "pending_approval"

        await DisbursementService._refresh_run_status(db, batch.run_id)

    @staticmethod
    async def _refresh_run_status(
        db: AsyncSession,
        run_id,
    ) -> None:
        run_result = await db.execute(
            select(PayRun)
            .options(selectinload(PayRun.items))
            .where(PayRun.id == run_id)
        )
        run = run_result.scalar_one_or_none()
        if not run:
            return

        payable = [
            item
            for item in run.items
            if item.status not in {"held", "cancelled"}
        ]
        if not payable:
            return

        if all(item.status == "paid" for item in payable):
            run.status = "paid"
            run.paid_at = utcnow()
        elif any(item.status == "paid" for item in payable):
            if run.status != "paid":
                run.status = "disbursing"

    @staticmethod
    async def list_batches(
        db: AsyncSession,
        limit: int = 100,
        offset: int = 0,
    ) -> list[DisbursementBatch]:
        result = await db.execute(
            select(DisbursementBatch)
            .options(selectinload(DisbursementBatch.items))
            .order_by(DisbursementBatch.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())
