from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_permission, Permissions
from app.models.sql.user import User, Person
from app.models.sql.employment_contract import EmploymentContract
from app.models.sql.leave import LeaveRequest, LeaveType, LeaveBalance
from app.models.sql.compensation import CompensationChange
from app.models.sql.attendance import Attendance


router = APIRouter()


# ============================================================
# SCHEMAS
# ============================================================

class HeadcountBucket(BaseModel):
    label: str
    count: int


class HeadcountReport(BaseModel):
    total: int
    active: int
    inactive: int
    by_type: List[HeadcountBucket]
    by_department: List[HeadcountBucket]
    by_status: List[HeadcountBucket]
    by_employment_type: List[HeadcountBucket]
    by_location: List[HeadcountBucket]
    hired_this_year: int
    left_this_year: int

class AttendanceTodayReport(BaseModel):
    total_active: int
    checked_in: int
    checked_out: int
    not_checked_in: int
    percentage_checked_in: float
    as_of: str

class TurnoverMonth(BaseModel):
    month: str
    hires: int
    terminations: int
    net: int


class TurnoverReport(BaseModel):
    months: List[TurnoverMonth]
    rolling_12_month_rate: float
    total_hires: int
    total_terminations: int


class LeaveUsageRow(BaseModel):
    leave_type_id: str
    leave_type_name: str
    leave_type_color: str
    total_days_requested: float
    total_days_approved: float
    total_days_rejected: float
    requests_count: int
    avg_days_per_request: float


class LeaveUsageReport(BaseModel):
    year: int
    rows: List[LeaveUsageRow]
    total_approved_days: float
    total_pending_days: float
    most_used_type: Optional[str] = None


class DepartmentCompRow(BaseModel):
    department: str
    headcount: int
    avg_base_amount: float
    min_base_amount: float
    max_base_amount: float
    currency: str


class CompensationReport(BaseModel):
    rows: List[DepartmentCompRow]
    total_annual_cost: float
    currency: str
    headcount_with_salary: int


class ContractExpiryRow(BaseModel):
    contract_id: str
    person_id: str
    person_name: str
    contract_type: str
    position: Optional[str] = None
    end_date: str
    days_until_expiry: int


class ContractExpiryReport(BaseModel):
    within_30: List[ContractExpiryRow]
    within_60: List[ContractExpiryRow]
    within_90: List[ContractExpiryRow]


# ============================================================
# HELPERS
# ============================================================

async def _group_count(db, column, base_filter=None):
    q = select(column, func.count(Person.id)).where(Person.deleted_at.is_(None))
    if base_filter is not None:
        q = q.where(base_filter)
    q = q.group_by(column)
    result = await db.execute(q)
    return [
        HeadcountBucket(label=(row[0] or "Unspecified"), count=row[1])
        for row in result.all()
    ]


# ============================================================
# HEADCOUNT
# ============================================================

@router.get("/headcount", response_model=HeadcountReport)
async def headcount_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_SENSITIVE)),
):
    """Current org composition."""
    today = date.today()
    year_start = date(today.year, 1, 1)

    total_result = await db.execute(
        select(func.count(Person.id)).where(Person.deleted_at.is_(None))
    )
    total = total_result.scalar() or 0

    active_result = await db.execute(
        select(func.count(Person.id)).where(
            Person.deleted_at.is_(None),
            Person.status == "active",
        )
    )
    active = active_result.scalar() or 0

    hired_result = await db.execute(
        select(func.count(func.distinct(EmploymentContract.person_id))).where(
            EmploymentContract.start_date >= year_start
        )
    )
    hired_this_year = hired_result.scalar() or 0

    left_result = await db.execute(
        select(func.count(Person.id)).where(
            Person.deleted_at.isnot(None),
            Person.deleted_at >= year_start,
        )
    )
    left_this_year = left_result.scalar() or 0

    # Employment type from the current contract
    et_result = await db.execute(
        select(EmploymentContract.contract_type, func.count(EmploymentContract.id))
        .where(EmploymentContract.is_current.is_(True))
        .group_by(EmploymentContract.contract_type)
    )
    by_employment_type = [
        HeadcountBucket(label=row[0], count=row[1])
        for row in et_result.all()
    ]

    return HeadcountReport(
        total=total,
        active=active,
        inactive=total - active,
        by_type=await _group_count(db, Person.type),
        by_department=await _group_count(db, Person.department),
        by_status=await _group_count(db, Person.status),
        by_employment_type=by_employment_type,
        by_location=await _group_count(db, Person.location),
        hired_this_year=hired_this_year,
        left_this_year=left_this_year,
    )


# ============================================================
# TURNOVER
# ============================================================

@router.get("/turnover", response_model=TurnoverReport)
async def turnover_report(
    months_back: int = Query(12, ge=1, le=36),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_SENSITIVE)),
):
    """
    Monthly hires vs terminations over the last N months.
    """
    today = date.today()
    start_month = today.replace(day=1) - timedelta(days=30 * (months_back - 1))
    start_month = start_month.replace(day=1)

    hires_result = await db.execute(
        select(
            func.to_char(EmploymentContract.start_date, "YYYY-MM").label("month"),
            func.count(EmploymentContract.id),
        )
        .where(EmploymentContract.start_date >= start_month)
        .group_by("month")
        .order_by("month")
    )
    hires_by_month = {row[0]: row[1] for row in hires_result.all()}

    terms_result = await db.execute(
        select(
            func.to_char(Person.deleted_at, "YYYY-MM").label("month"),
            func.count(Person.id),
        )
        .where(Person.deleted_at >= start_month, Person.deleted_at.isnot(None))
        .group_by("month")
        .order_by("month")
    )
    terms_by_month = {row[0]: row[1] for row in terms_result.all()}

    months: List[TurnoverMonth] = []
    cursor = start_month
    for _ in range(months_back):
        key = cursor.strftime("%Y-%m")
        hires = hires_by_month.get(key, 0)
        terms = terms_by_month.get(key, 0)
        months.append(
            TurnoverMonth(month=key, hires=hires, terminations=terms, net=hires - terms)
        )
        # advance one month
        if cursor.month == 12:
            cursor = cursor.replace(year=cursor.year + 1, month=1)
        else:
            cursor = cursor.replace(month=cursor.month + 1)

    total_hires = sum(m.hires for m in months)
    total_terms = sum(m.terminations for m in months)

    # Very rough rolling rate: terminations / avg headcount over the window
    current_result = await db.execute(
        select(func.count(Person.id)).where(Person.deleted_at.is_(None))
    )
    current_headcount = current_result.scalar() or 1
    rolling_rate = round((total_terms / max(current_headcount, 1)) * 100, 2)

    return TurnoverReport(
        months=months,
        rolling_12_month_rate=rolling_rate,
        total_hires=total_hires,
        total_terminations=total_terms,
    )


# ============================================================
# LEAVE USAGE
# ============================================================

@router.get("/leave-usage", response_model=LeaveUsageReport)
async def leave_usage_report(
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_LEAVE)),
):
    """Leave volume per type for the given year."""
    if year is None:
        year = date.today().year

    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)

    result = await db.execute(
        select(
            LeaveType.id,
            LeaveType.name,
            LeaveType.color,
            func.count(LeaveRequest.id),
            func.coalesce(
                func.sum(
                    func.case(
                        (LeaveRequest.status == "approved", LeaveRequest.total_days),
                        else_=0,
                    )
                ),
                0,
            ).label("approved_days"),
            func.coalesce(
                func.sum(
                    func.case(
                        (LeaveRequest.status == "pending", LeaveRequest.total_days),
                        else_=0,
                    )
                ),
                0,
            ).label("pending_days"),
            func.coalesce(
                func.sum(
                    func.case(
                        (LeaveRequest.status == "rejected", LeaveRequest.total_days),
                        else_=0,
                    )
                ),
                0,
            ).label("rejected_days"),
            func.coalesce(func.sum(LeaveRequest.total_days), 0).label("requested_days"),
        )
        .join(LeaveRequest, LeaveRequest.leave_type_id == LeaveType.id)
        .where(
            LeaveRequest.start_date >= year_start,
            LeaveRequest.start_date <= year_end,
        )
        .group_by(LeaveType.id, LeaveType.name, LeaveType.color)
        .order_by(func.coalesce(func.sum(LeaveRequest.total_days), 0).desc())
    )

    rows: List[LeaveUsageRow] = []
    total_approved = 0.0
    total_pending = 0.0

    for row in result.all():
        ltype_id, ltype_name, ltype_color = row[0], row[1], row[2]
        count = row[3] or 0
        approved = float(row[4] or 0)
        pending = float(row[5] or 0)
        rejected = float(row[6] or 0)
        requested = float(row[7] or 0)

        rows.append(
            LeaveUsageRow(
                leave_type_id=ltype_id,
                leave_type_name=ltype_name,
                leave_type_color=ltype_color or "#176b4d",
                total_days_requested=requested,
                total_days_approved=approved,
                total_days_rejected=rejected,
                requests_count=count,
                avg_days_per_request=(
                    round(requested / count, 2) if count else 0.0
                ),
            )
        )
        total_approved += approved
        total_pending += pending

    most_used = rows[0].leave_type_name if rows else None

    return LeaveUsageReport(
        year=year,
        rows=rows,
        total_approved_days=total_approved,
        total_pending_days=total_pending,
        most_used_type=most_used,
    )


# ============================================================
# COMPENSATION
# ============================================================

@router.get("/compensation", response_model=CompensationReport)
async def compensation_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_COMPENSATION)),
):
    """
    Current compensation per department.
    Only counts the active CompensationChange per person.
    """
    # Current comp rows
    current_result = await db.execute(
        select(CompensationChange).where(CompensationChange.effective_to.is_(None))
    )
    changes = list(current_result.scalars().all())

    if not changes:
        return CompensationReport(
            rows=[],
            total_annual_cost=0.0,
            currency="GHS",
            headcount_with_salary=0,
        )

    person_ids = [c.person_id for c in changes]
    people_result = await db.execute(
        select(Person).where(Person.id.in_(person_ids))
    )
    people = {p.id: p for p in people_result.scalars().all()}

    by_dept: dict[str, List[CompensationChange]] = {}
    for change in changes:
        person = people.get(change.person_id)
        dept = person.department if person and person.department else "Unspecified"
        by_dept.setdefault(dept, []).append(change)

    rows: List[DepartmentCompRow] = []
    total_annual = 0.0

    for dept, items in by_dept.items():
        amounts = [float(c.base_amount) for c in items]
        currency = items[0].currency
        rows.append(
            DepartmentCompRow(
                department=dept,
                headcount=len(items),
                avg_base_amount=round(sum(amounts) / len(amounts), 2),
                min_base_amount=min(amounts),
                max_base_amount=max(amounts),
                currency=currency,
            )
        )

        # Normalise to monthly for the annual cost approximation
        for c in items:
            freq = (c.frequency or "monthly").lower()
            monthly = float(c.base_amount)
            if freq == "annual":
                monthly = float(c.base_amount) / 12
            elif freq == "biweekly":
                monthly = float(c.base_amount) * 26 / 12
            elif freq == "weekly":
                monthly = float(c.base_amount) * 52 / 12
            elif freq == "hourly":
                monthly = float(c.base_amount) * 160
            total_annual += monthly * 12

    rows.sort(key=lambda r: r.headcount, reverse=True)

    return CompensationReport(
        rows=rows,
        total_annual_cost=round(total_annual, 2),
        currency=changes[0].currency if changes else "GHS",
        headcount_with_salary=len(changes),
    )


# ============================================================
# CONTRACT EXPIRY
# ============================================================

@router.get("/contracts-expiring", response_model=ContractExpiryReport)
async def contracts_expiring(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_EMPLOYMENT)),
):
    """
    Current contracts whose end_date falls within 30/60/90 days.
    """
    today = date.today()
    horizon = today + timedelta(days=90)

    result = await db.execute(
        select(EmploymentContract, Person)
        .join(Person, Person.id == EmploymentContract.person_id)
        .where(
            EmploymentContract.is_current.is_(True),
            EmploymentContract.end_date.is_not(None),
            EmploymentContract.end_date >= today,
            EmploymentContract.end_date <= horizon,
        )
        .order_by(EmploymentContract.end_date)
    )

    rows_30: List[ContractExpiryRow] = []
    rows_60: List[ContractExpiryRow] = []
    rows_90: List[ContractExpiryRow] = []

    for contract, person in result.all():
        days = (contract.end_date - today).days
        entry = ContractExpiryRow(
            contract_id=contract.id,
            person_id=person.id,
            person_name=f"{person.first_name} {person.last_name}".strip(),
            contract_type=contract.contract_type,
            position=contract.position,
            end_date=contract.end_date.isoformat(),
            days_until_expiry=days,
        )
        if days <= 30:
            rows_30.append(entry)
        if days <= 60:
            rows_60.append(entry)
        rows_90.append(entry)

    return ContractExpiryReport(
        within_30=rows_30,
        within_60=rows_60,
        within_90=rows_90,
    )

# ============================================================
# ATTENDANCE TODAY
# ============================================================

@router.get("/attendance-today", response_model=AttendanceTodayReport)
async def attendance_today_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_SENSITIVE)),
):
    """
    Live count of who has checked in today.

    - total_active:      active staff + volunteers
    - checked_in:        has an attendance row for today with check_in set
    - checked_out:       has both check_in and check_out set
    - not_checked_in:    no attendance row yet for today
    - percentage_checked_in: checked_in / total_active * 100
    """
    today = date.today()

    # Count active staff + volunteers
    total_result = await db.execute(
        select(func.count(Person.id)).where(
            Person.deleted_at.is_(None),
            Person.status == "active",
            Person.type.in_(["staff", "volunteer"]),
        )
    )
    total_active = total_result.scalar() or 0

    # Count checked in today
    checked_in_result = await db.execute(
        select(func.count(Attendance.id)).where(
            Attendance.date == today,
            Attendance.check_in.is_not(None),
        )
    )
    checked_in = checked_in_result.scalar() or 0

    # Count checked out today
    checked_out_result = await db.execute(
        select(func.count(Attendance.id)).where(
            Attendance.date == today,
            Attendance.check_out.is_not(None),
        )
    )
    checked_out = checked_out_result.scalar() or 0

    not_checked_in = max(0, total_active - checked_in)

    percentage = (
        round((checked_in / total_active) * 100, 1)
        if total_active > 0
        else 0.0
    )

    return AttendanceTodayReport(
        total_active=total_active,
        checked_in=checked_in,
        checked_out=checked_out,
        not_checked_in=not_checked_in,
        percentage_checked_in=percentage,
        as_of=datetime.now(timezone.utc).isoformat(),
    )