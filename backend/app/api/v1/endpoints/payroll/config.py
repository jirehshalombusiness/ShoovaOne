from __future__ import annotations

import calendar
import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import Permissions, require_any_permission, require_permission
from app.models.pydantic.payroll.schemas import (
    ComponentTypeCreate,
    ComponentTypeResponse,
    ComponentTypeUpdate,
    PayGroupCreate,
    PayGroupResponse,
    PayGroupUpdate,
    PayPeriodCreate,
    PayPeriodGenerate,
    PayPeriodResponse,
    PayPeriodUpdate,
    StatutorySchemeCreate,
    StatutorySchemeResponse,
    StatutorySchemeUpdate,
    TaxBandCreate,
)
from app.models.sql.payroll.config import (
    PayComponentType,
    PayGroup,
    PayPeriod,
    StatutoryScheme,
    TaxBand,
)
from app.services.core.audit_service import AuditService

router = APIRouter()

FREQUENCIES = {"weekly", "biweekly", "semi_monthly", "monthly"}
COMPONENT_CATEGORIES = {"earning", "employee_deduction", "employer_contribution"}
CALCULATIONS = {"fixed", "percent"}
CALCULATION_BASES = {"basic", "gross", "taxable"}
PAY_TYPES = {"salaried", "hourly", "mixed"}
PRORATION_BASES = {"working_days", "calendar_days"}

read_access = require_any_permission(
    [
        Permissions.PAYROLL_VIEW_ALL,
        Permissions.PAYROLL_PREPARE,
        Permissions.PAYROLL_CONFIG,
        Permissions.PAYROLL_REVIEW_FINANCE,
        Permissions.PAYROLL_REPORTS,
    ]
)
config_access = require_permission(Permissions.PAYROLL_CONFIG)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _validate_frequency(frequency: str) -> None:
    if frequency not in FREQUENCIES:
        raise HTTPException(
            status_code=400,
            detail=f"frequency must be one of {sorted(FREQUENCIES)}",
        )


def _validate_rates(*values: Decimal) -> None:
    for value in values:
        if value is not None and (value < 0 or value > 1):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Rates must be expressed as decimals between 0 and 1 "
                    "(for example 5.5% is 0.055)."
                ),
            )


def _validate_bands(bands: list[TaxBandCreate]) -> None:
    ordered = sorted(bands, key=lambda band: (band.band_from, band.sequence))
    previous_to: Optional[Decimal] = None

    for index, band in enumerate(ordered):
        if band.band_to is not None and band.band_to <= band.band_from:
            raise HTTPException(
                status_code=400,
                detail="Each tax band must end above where it starts.",
            )
        _validate_rates(band.rate)

        if index > 0:
            if previous_to is None:
                raise HTTPException(
                    status_code=400,
                    detail="An open-ended tax band must be the final band.",
                )
            if band.band_from < previous_to:
                raise HTTPException(
                    status_code=400,
                    detail="Tax bands must not overlap.",
                )
            if band.band_from > previous_to:
                raise HTTPException(
                    status_code=400,
                    detail="Tax bands must be contiguous.",
                )

        previous_to = band.band_to


def _period_name(frequency: str, start: date, end: date) -> str:
    if frequency == "monthly":
        return f"{calendar.month_name[start.month]} {start.year}"
    if frequency == "semi_monthly":
        half = "First half" if start.day <= 15 else "Second half"
        return f"{half} {calendar.month_name[start.month]} {start.year}"
    if frequency == "weekly":
        return f"Week of {start.strftime('%d %b %Y')}"
    return f"Fortnight {start.strftime('%d %b %Y')} - {end.strftime('%d %b %Y')}"


def _generated_ranges(
    payload: PayPeriodGenerate,
) -> list[tuple[date, date]]:
    ranges: list[tuple[date, date]] = []
    start = payload.start_date
    end = payload.end_date

    if end < start:
        raise HTTPException(status_code=400, detail="end_date must be on or after start_date")

    if payload.frequency in {"weekly", "biweekly"}:
        step = timedelta(days=7 if payload.frequency == "weekly" else 14)
        cursor = start
        while cursor <= end:
            period_end = min(cursor + step - timedelta(days=1), end)
            ranges.append((cursor, period_end))
            cursor += step
        return ranges

    cursor_month = date(start.year, start.month, 1)
    while cursor_month <= end:
        last_day = calendar.monthrange(cursor_month.year, cursor_month.month)[1]
        month_end = date(cursor_month.year, cursor_month.month, last_day)

        if payload.frequency == "monthly":
            ranges.append((cursor_month, month_end))
        else:
            first_half_end = date(cursor_month.year, cursor_month.month, 15)
            second_half_start = date(cursor_month.year, cursor_month.month, 16)
            ranges.append((cursor_month, first_half_end))
            if second_half_start <= month_end:
                ranges.append((second_half_start, month_end))

        if cursor_month.month == 12:
            cursor_month = date(cursor_month.year + 1, 1, 1)
        else:
            cursor_month = date(cursor_month.year, cursor_month.month + 1, 1)

    return [(range_start, range_end) for range_start, range_end in ranges if range_end >= start]


# ============================================================
# PAY PERIODS
# ============================================================

@router.get("/pay-periods", response_model=list[PayPeriodResponse])
async def list_pay_periods(
    frequency: Optional[str] = None,
    period_status: Optional[str] = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(read_access),
):
    query = select(PayPeriod).order_by(PayPeriod.period_start.desc())
    if frequency:
        query = query.where(PayPeriod.frequency == frequency)
    if period_status:
        query = query.where(PayPeriod.status == period_status)

    result = await db.execute(query.offset(offset).limit(limit))
    return list(result.scalars().all())


@router.post(
    "/pay-periods",
    response_model=PayPeriodResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_pay_period(
    payload: PayPeriodCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(config_access),
):
    _validate_frequency(payload.frequency)
    if payload.period_end < payload.period_start:
        raise HTTPException(status_code=400, detail="period_end must be on or after period_start")
    if payload.pay_date < payload.period_end:
        raise HTTPException(status_code=400, detail="pay_date must be on or after period_end")

    existing = await db.execute(
        select(PayPeriod).where(
            PayPeriod.frequency == payload.frequency,
            PayPeriod.period_start == payload.period_start,
            PayPeriod.period_end == payload.period_end,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pay period already exists for this frequency and date range.",
        )

    period = PayPeriod(
        id=str(uuid.uuid4()),
        name=payload.name,
        frequency=payload.frequency,
        period_start=payload.period_start,
        period_end=payload.period_end,
        cutoff_at=payload.cutoff_at,
        pay_date=payload.pay_date,
        status="open",
        notes=payload.notes,
    )
    db.add(period)
    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAY_PERIOD_CREATED",
        entity_type="payroll_pay_period",
        entity_id=period.id,
        description=f"Created pay period {period.name}",
        new_values={
            "frequency": period.frequency,
            "period_start": period.period_start.isoformat(),
            "period_end": period.period_end.isoformat(),
            "pay_date": period.pay_date.isoformat(),
        },
    )
    await db.commit()
    await db.refresh(period)
    return period


@router.post(
    "/pay-periods/generate",
    response_model=list[PayPeriodResponse],
    status_code=status.HTTP_201_CREATED,
)
async def generate_pay_periods(
    payload: PayPeriodGenerate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(config_access),
):
    ranges = _generated_ranges(payload)

    existing_result = await db.execute(
        select(PayPeriod.period_start, PayPeriod.period_end).where(
            PayPeriod.frequency == payload.frequency
        )
    )
    existing = {(start, end) for start, end in existing_result.all()}

    created: list[PayPeriod] = []
    for period_start, period_end in ranges:
        if (period_start, period_end) in existing:
            continue

        cutoff_date = period_end - timedelta(days=payload.cutoff_days_before_end)
        cutoff_at = datetime.combine(
            cutoff_date,
            time(23, 59, 59),
            tzinfo=timezone.utc,
        )

        period = PayPeriod(
            id=str(uuid.uuid4()),
            name=_period_name(payload.frequency, period_start, period_end),
            frequency=payload.frequency,
            period_start=period_start,
            period_end=period_end,
            cutoff_at=cutoff_at,
            pay_date=period_end + timedelta(days=payload.pay_day_offset),
            status="open",
        )
        db.add(period)
        created.append(period)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAY_PERIODS_GENERATED",
        entity_type="payroll_pay_period",
        entity_id="batch",
        description=(
            f"Generated {len(created)} {payload.frequency} pay periods "
            f"between {payload.start_date} and {payload.end_date}"
        ),
        new_values={"created": len(created)},
    )
    await db.commit()
    return created


@router.patch("/pay-periods/{period_id}", response_model=PayPeriodResponse)
async def update_pay_period(
    period_id: str,
    payload: PayPeriodUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(config_access),
):
    result = await db.execute(select(PayPeriod).where(PayPeriod.id == period_id))
    period = result.scalar_one_or_none()
    if not period:
        raise HTTPException(status_code=404, detail="Pay period not found")

    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(period, key, value)

    if period.pay_date < period.period_end:
        raise HTTPException(status_code=400, detail="pay_date must be on or after period_end")

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAY_PERIOD_UPDATED",
        entity_type="payroll_pay_period",
        entity_id=period.id,
        description=f"Updated pay period {period.name}",
        new_values={key: str(value) for key, value in changes.items()},
    )
    await db.commit()
    await db.refresh(period)
    return period


# ============================================================
# PAY GROUPS
# ============================================================

@router.get("/pay-groups", response_model=list[PayGroupResponse])
async def list_pay_groups(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(read_access),
):
    query = select(PayGroup).order_by(PayGroup.name)
    if active_only:
        query = query.where(PayGroup.is_active.is_(True))
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post(
    "/pay-groups",
    response_model=PayGroupResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_pay_group(
    payload: PayGroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(config_access),
):
    if payload.pay_type not in PAY_TYPES:
        raise HTTPException(status_code=400, detail=f"pay_type must be one of {sorted(PAY_TYPES)}")
    if payload.proration_basis not in PRORATION_BASES:
        raise HTTPException(
            status_code=400,
            detail=f"proration_basis must be one of {sorted(PRORATION_BASES)}",
        )

    existing = await db.execute(select(PayGroup).where(PayGroup.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A pay group with this name already exists.")

    group = PayGroup(
        id=str(uuid.uuid4()),
        **payload.model_dump(),
    )
    db.add(group)
    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAY_GROUP_CREATED",
        entity_type="payroll_pay_group",
        entity_id=group.id,
        description=f"Created pay group {group.name}",
        new_values={"pay_type": group.pay_type, "currency": group.currency},
    )
    await db.commit()
    await db.refresh(group)
    return group


@router.patch("/pay-groups/{group_id}", response_model=PayGroupResponse)
async def update_pay_group(
    group_id: str,
    payload: PayGroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(config_access),
):
    result = await db.execute(select(PayGroup).where(PayGroup.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Pay group not found")

    changes = payload.model_dump(exclude_unset=True)
    if "pay_type" in changes and changes["pay_type"] not in PAY_TYPES:
        raise HTTPException(status_code=400, detail="Invalid pay_type")
    if (
        "proration_basis" in changes
        and changes["proration_basis"] not in PRORATION_BASES
    ):
        raise HTTPException(status_code=400, detail="Invalid proration_basis")

    for key, value in changes.items():
        setattr(group, key, value)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAY_GROUP_UPDATED",
        entity_type="payroll_pay_group",
        entity_id=group.id,
        description=f"Updated pay group {group.name}",
        new_values={key: str(value) for key, value in changes.items()},
    )
    await db.commit()
    await db.refresh(group)
    return group


# ============================================================
# STATUTORY SCHEMES
# ============================================================

@router.get("/statutory-schemes", response_model=list[StatutorySchemeResponse])
async def list_statutory_schemes(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(read_access),
):
    query = select(StatutoryScheme).order_by(
        StatutoryScheme.priority,
        StatutoryScheme.code,
        StatutoryScheme.effective_from.desc(),
    )
    if not include_inactive:
        query = query.where(StatutoryScheme.is_active.is_(True))
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post(
    "/statutory-schemes",
    response_model=StatutorySchemeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_statutory_scheme(
    payload: StatutorySchemeCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(config_access),
):
    if payload.scheme_type == "tax":
        if not payload.bands:
            raise HTTPException(
                status_code=400,
                detail="A tax scheme requires at least one tax band.",
            )
        _validate_bands(payload.bands)
    else:
        _validate_rates(payload.employee_rate, payload.employer_rate)

    if payload.base not in CALCULATION_BASES:
        raise HTTPException(
            status_code=400,
            detail=f"base must be one of {sorted(CALCULATION_BASES)}",
        )
    if payload.cap is not None and payload.cap < 0:
        raise HTTPException(status_code=400, detail="cap cannot be negative")

    existing = await db.execute(
        select(StatutoryScheme).where(
            StatutoryScheme.code == payload.code,
            StatutoryScheme.effective_from == payload.effective_from,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=(
                "A statutory scheme with this code already exists for that "
                "effective date. Create a new effective-dated version instead."
            ),
        )

    scheme = StatutoryScheme(
        id=str(uuid.uuid4()),
        name=payload.name,
        code=payload.code,
        jurisdiction=payload.jurisdiction,
        scheme_type=payload.scheme_type,
        employee_rate=payload.employee_rate,
        employer_rate=payload.employer_rate,
        base=payload.base,
        cap=payload.cap,
        relief_amount=payload.relief_amount,
        remittance_due_day=payload.remittance_due_day,
        priority=payload.priority,
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
        is_active=payload.is_active,
        notes=payload.notes,
        bands=[
            TaxBand(
                id=str(uuid.uuid4()),
                sequence=band.sequence,
                band_from=band.band_from,
                band_to=band.band_to,
                rate=band.rate,
            )
            for band in payload.bands
        ],
    )
    db.add(scheme)
    await AuditService.log(
        db=db,
        actor=current_user,
        action="STATUTORY_SCHEME_CREATED",
        entity_type="payroll_statutory_scheme",
        entity_id=scheme.id,
        description=f"Created statutory scheme {scheme.name} ({scheme.code})",
        new_values={
            "employee_rate": str(scheme.employee_rate),
            "employer_rate": str(scheme.employer_rate),
            "effective_from": scheme.effective_from.isoformat(),
        },
    )
    await db.commit()
    await db.refresh(scheme)
    return scheme


@router.patch(
    "/statutory-schemes/{scheme_id}",
    response_model=StatutorySchemeResponse,
)
async def update_statutory_scheme(
    scheme_id: str,
    payload: StatutorySchemeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(config_access),
):
    result = await db.execute(
        select(StatutoryScheme).where(StatutoryScheme.id == scheme_id)
    )
    scheme = result.scalar_one_or_none()
    if not scheme:
        raise HTTPException(status_code=404, detail="Statutory scheme not found")

    changes = payload.model_dump(exclude_unset=True)
    if "effective_to" in changes and changes["effective_to"] is not None:
        if changes["effective_to"] < scheme.effective_from:
            raise HTTPException(
                status_code=400,
                detail="effective_to cannot be before effective_from",
            )

    for key, value in changes.items():
        setattr(scheme, key, value)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="STATUTORY_SCHEME_UPDATED",
        entity_type="payroll_statutory_scheme",
        entity_id=scheme.id,
        description=f"Updated statutory scheme {scheme.name}",
        new_values={key: str(value) for key, value in changes.items()},
    )
    await db.commit()
    await db.refresh(scheme)
    return scheme


# ============================================================
# COMPONENT TYPES
# ============================================================

@router.get("/component-types", response_model=list[ComponentTypeResponse])
async def list_component_types(
    category: Optional[str] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(read_access),
):
    query = select(PayComponentType).order_by(
        PayComponentType.category,
        PayComponentType.priority,
        PayComponentType.name,
    )
    if category:
        query = query.where(PayComponentType.category == category)
    if active_only:
        query = query.where(PayComponentType.is_active.is_(True))
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post(
    "/component-types",
    response_model=ComponentTypeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_component_type(
    payload: ComponentTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(config_access),
):
    if payload.category not in COMPONENT_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"category must be one of {sorted(COMPONENT_CATEGORIES)}",
        )
    if payload.calculation not in CALCULATIONS:
        raise HTTPException(
            status_code=400,
            detail=f"calculation must be one of {sorted(CALCULATIONS)}",
        )
    if payload.calculation_base not in CALCULATION_BASES:
        raise HTTPException(
            status_code=400,
            detail=f"calculation_base must be one of {sorted(CALCULATION_BASES)}",
        )
    _validate_rates(payload.default_rate)

    existing = await db.execute(
        select(PayComponentType).where(PayComponentType.code == payload.code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A component type with this code already exists.")

    component = PayComponentType(id=str(uuid.uuid4()), **payload.model_dump())
    db.add(component)
    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAY_COMPONENT_CREATED",
        entity_type="payroll_component_type",
        entity_id=component.id,
        description=f"Created pay component {component.name}",
        new_values={
            "code": component.code,
            "category": component.category,
            "calculation": component.calculation,
        },
    )
    await db.commit()
    await db.refresh(component)
    return component


@router.patch(
    "/component-types/{component_id}",
    response_model=ComponentTypeResponse,
)
async def update_component_type(
    component_id: str,
    payload: ComponentTypeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(config_access),
):
    result = await db.execute(
        select(PayComponentType).where(PayComponentType.id == component_id)
    )
    component = result.scalar_one_or_none()
    if not component:
        raise HTTPException(status_code=404, detail="Component type not found")

    changes = payload.model_dump(exclude_unset=True)
    if "calculation" in changes and changes["calculation"] not in CALCULATIONS:
        raise HTTPException(status_code=400, detail="Invalid calculation")
    if (
        "calculation_base" in changes
        and changes["calculation_base"] not in CALCULATION_BASES
    ):
        raise HTTPException(status_code=400, detail="Invalid calculation_base")
    if "default_rate" in changes:
        _validate_rates(changes["default_rate"])

    for key, value in changes.items():
        setattr(component, key, value)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAY_COMPONENT_UPDATED",
        entity_type="payroll_component_type",
        entity_id=component.id,
        description=f"Updated pay component {component.name}",
        new_values={key: str(value) for key, value in changes.items()},
    )
    await db.commit()
    await db.refresh(component)
    return component
