from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import Permissions, require_any_permission, require_permission
from app.models.pydantic.payroll.schemas import (
    GLEntryResponse,
    PayRunCreate,
    PayRunDecision,
    PayRunDetailResponse,
    PayRunResponse,
    PayRunReviewDecision,
    PayRunSubmit,
    PayslipResponse,
    RemittancePayRequest,
    RemittanceResponse,
)
from app.models.sql.payroll.payslip import Payslip
from app.models.sql.payroll.runs import (
    PayrollGLEntry,
    PayRun,
    StatutoryRemittance,
)
from app.services.core.audit_service import AuditService
from app.services.payroll.payroll_service import (
    PayrollService,
    load_run,
    run_to_dict,
)

router = APIRouter()

view_access = require_any_permission(
    [
        Permissions.PAYROLL_VIEW_ALL,
        Permissions.PAYROLL_PREPARE,
        Permissions.PAYROLL_REVIEW_HR,
        Permissions.PAYROLL_REVIEW_FINANCE,
        Permissions.PAYROLL_APPROVE,
        Permissions.PAYROLL_DISBURSE,
        Permissions.PAYROLL_REPORTS,
    ]
)
prepare_access = require_any_permission(
    [Permissions.PAYROLL_PREPARE, Permissions.PAYROLL_REVIEW_HR]
)
finance_review_access = require_permission(Permissions.PAYROLL_REVIEW_FINANCE)
final_approval_access = require_permission(Permissions.PAYROLL_APPROVE)
finalize_access = require_any_permission(
    [Permissions.PAYROLL_REVIEW_FINANCE, Permissions.PAYROLL_APPROVE]
)
disburse_access = require_permission(Permissions.PAYROLL_DISBURSE)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ============================================================
# PAY RUNS
# ============================================================

@router.get("/runs", response_model=list[PayRunResponse])
async def list_pay_runs(
    period_id: Optional[str] = None,
    pay_group_id: Optional[str] = None,
    run_status: Optional[str] = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=300),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(view_access),
):
    query = (
        select(PayRun)
        .options(
            selectinload(PayRun.period),
            selectinload(PayRun.pay_group),
            selectinload(PayRun.approvals),
        )
        .order_by(PayRun.created_at.desc())
    )
    if period_id:
        query = query.where(PayRun.period_id == period_id)
    if pay_group_id:
        query = query.where(PayRun.pay_group_id == pay_group_id)
    if run_status:
        query = query.where(PayRun.status == run_status)

    result = await db.execute(query.offset(offset).limit(limit))
    return [run_to_dict(run) for run in result.scalars().all()]


@router.post(
    "/runs",
    response_model=PayRunDetailResponse,
    status_code=201,
)
async def create_pay_run(
    payload: PayRunCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(prepare_access),
):
    run = await PayrollService.create_run(
        db,
        period_id=payload.period_id,
        pay_group_id=payload.pay_group_id,
        run_type=payload.run_type,
        actor=current_user,
        notes=payload.notes,
    )
    return run_to_dict(run, include_items=True)


@router.get("/runs/{run_id}", response_model=PayRunDetailResponse)
async def get_pay_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(view_access),
):
    run = await load_run(db, run_id)
    return run_to_dict(run, include_items=True)


@router.post("/runs/{run_id}/calculate", response_model=PayRunDetailResponse)
async def calculate_pay_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(prepare_access),
):
    run = await PayrollService.calculate_run(db, run_id=run_id, actor=current_user)
    return run_to_dict(run, include_items=True)


@router.post("/runs/{run_id}/submit", response_model=PayRunDetailResponse)
async def submit_pay_run(
    run_id: str,
    payload: PayRunSubmit,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(prepare_access),
):
    run = await PayrollService.submit_to_finance(
        db,
        run_id=run_id,
        actor=current_user,
        note=payload.note,
    )
    return run_to_dict(run, include_items=True)


@router.post("/runs/{run_id}/review", response_model=PayRunDetailResponse)
async def review_pay_run(
    run_id: str,
    payload: PayRunReviewDecision,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(finance_review_access),
):
    run = await PayrollService.review_finance(
        db,
        run_id=run_id,
        actor=current_user,
        decision=payload.decision,
        note=payload.note,
    )
    return run_to_dict(run, include_items=True)


@router.post("/runs/{run_id}/approve", response_model=PayRunDetailResponse)
async def approve_pay_run(
    run_id: str,
    payload: PayRunDecision,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(final_approval_access),
):
    run = await PayrollService.final_approve(
        db,
        run_id=run_id,
        actor=current_user,
        note=payload.note,
    )
    return run_to_dict(run, include_items=True)


@router.post("/runs/{run_id}/finalize", response_model=PayRunDetailResponse)
async def finalize_pay_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(finalize_access),
):
    run = await PayrollService.finalize(db, run_id=run_id, actor=current_user)
    return run_to_dict(run, include_items=True)


@router.get(
    "/runs/{run_id}/gl-entries",
    response_model=list[GLEntryResponse],
)
async def list_run_gl_entries(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(view_access),
):
    await load_run(db, run_id, include_items=False)
    result = await db.execute(
        select(PayrollGLEntry)
        .where(PayrollGLEntry.run_id == run_id)
        .order_by(PayrollGLEntry.account_code, PayrollGLEntry.cost_center)
    )
    return list(result.scalars().all())


@router.get(
    "/runs/{run_id}/remittances",
    response_model=list[RemittanceResponse],
)
async def list_run_remittances(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(view_access),
):
    await load_run(db, run_id, include_items=False)
    result = await db.execute(
        select(StatutoryRemittance)
        .where(StatutoryRemittance.run_id == run_id)
        .order_by(StatutoryRemittance.scheme_name)
    )
    return list(result.scalars().all())


# ============================================================
# STATUTORY REMITTANCES
# ============================================================

@router.get("/remittances", response_model=list[RemittanceResponse])
async def list_remittances(
    remittance_status: Optional[str] = Query(default=None, alias="status"),
    run_id: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(view_access),
):
    query = select(StatutoryRemittance).order_by(
        StatutoryRemittance.due_date,
        StatutoryRemittance.scheme_name,
    )
    if remittance_status:
        query = query.where(StatutoryRemittance.status == remittance_status)
    if run_id:
        query = query.where(StatutoryRemittance.run_id == run_id)

    result = await db.execute(query.offset(offset).limit(limit))
    return list(result.scalars().all())


@router.post(
    "/remittances/{remittance_id}/pay",
    response_model=RemittanceResponse,
)
async def pay_remittance(
    remittance_id: str,
    payload: RemittancePayRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(disburse_access),
):
    result = await db.execute(
        select(StatutoryRemittance).where(
            StatutoryRemittance.id == remittance_id
        )
    )
    remittance = result.scalar_one_or_none()
    if not remittance:
        raise HTTPException(status_code=404, detail="Remittance not found")

    if remittance.status == "paid":
        raise HTTPException(status_code=409, detail="Remittance is already paid")

    remittance.status = "paid"
    remittance.paid_at = _utcnow()
    remittance.reference = payload.reference

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAYROLL_REMITTANCE_PAID",
        entity_type="payroll_statutory_remittance",
        entity_id=remittance.id,
        description=f"Recorded payment of {remittance.scheme_name}",
        new_values={
            "total_amount": str(remittance.total_amount),
            "reference": payload.reference,
        },
    )
    await db.commit()
    await db.refresh(remittance)
    return remittance


# ============================================================
# PAYSLIPS (PAYROLL ADMIN)
# ============================================================

@router.get("/payslips", response_model=list[PayslipResponse])
async def list_payslips(
    person_id: Optional[str] = None,
    period_id: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(view_access),
):
    query = (
        select(Payslip)
        .options(selectinload(Payslip.period))
        .order_by(Payslip.issued_at.desc())
    )
    if person_id:
        query = query.where(Payslip.person_id == person_id)
    if period_id:
        query = query.where(Payslip.period_id == period_id)

    result = await db.execute(query.offset(offset).limit(limit))
    return [
        PayrollService.payslip_to_dict(payslip)
        for payslip in result.scalars().all()
    ]


@router.get("/payslips/{payslip_id}", response_model=PayslipResponse)
async def get_payslip(
    payslip_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(view_access),
):
    result = await db.execute(
        select(Payslip)
        .options(selectinload(Payslip.period))
        .where(Payslip.id == payslip_id)
    )
    payslip = result.scalar_one_or_none()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    return PayrollService.payslip_to_dict(payslip)
