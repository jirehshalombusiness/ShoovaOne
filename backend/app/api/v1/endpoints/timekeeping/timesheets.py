from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import case, select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
import uuid
from app.models.sql.core.user import User, Person
from app.models.sql.core.role import Role



from app.core.database import get_db
from app.core.security import require_permission, require_any_permission, Permissions
from app.services.core.permission_service import PermissionService
from app.services.core.audit_service import AuditService

from app.models.sql.timekeeping.timesheet import (
    Timesheet,
    TimesheetEntry,
    TimesheetApprovalHistory,
)
from app.models.sql.projects.project import Project

from app.models.pydantic.timekeeping.timesheet import (
    TimesheetResponse,
    TimesheetEntryResponse,
    TimesheetEntryCreate,
    TimesheetEntryUpdate,
    TimesheetSubmit,
    TimesheetApprove,
    TimesheetReturn,
    TimesheetApprovalHistoryResponse,
)

router = APIRouter()


# ============================================================
# HELPERS
# ============================================================

def _utc_now() -> datetime:
    """Return a timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def _entry_snapshot(entry: TimesheetEntry) -> dict:
    """
    Create a JSON-safe snapshot of a timesheet entry.

    Used by the audit system to record before/after values.
    """
    return {
        "id": str(entry.id),
        "timesheet_id": str(entry.timesheet_id),
        "date": (
            entry.date.isoformat()
            if entry.date
            else None
        ),
        "project_id": (
            str(entry.project_id)
            if entry.project_id
            else None
        ),
        "task_id": (
            str(entry.task_id)
            if entry.task_id
            else None
        ),
        "start_time": (
            entry.start_time.isoformat()
            if entry.start_time
            else None
        ),
        "end_time": (
            entry.end_time.isoformat()
            if entry.end_time
            else None
        ),
        "break_minutes": entry.break_minutes,
        "duration": (
            float(entry.duration)
            if entry.duration is not None
            else 0
        ),
        "description": entry.description,
        "is_billable": entry.is_billable,
        "source": getattr(entry, "source", None),
        "attendance_id": (
            str(entry.attendance_id)
            if getattr(entry, "attendance_id", None)
            else None
        ),
        "is_locked": bool(
            getattr(entry, "is_locked", False)
        ),
    }


async def _recalculate_timesheet_total(
    db: AsyncSession,
    timesheet: Timesheet,
) -> Decimal:
    """
    Recalculate total hours for a timesheet.
    """

    result = await db.execute(
        select(func.sum(TimesheetEntry.duration)).where(
            TimesheetEntry.timesheet_id == timesheet.id
        )
    )

    total = result.scalar() or 0

    total_decimal = Decimal(str(total))

    timesheet.total_hours = total_decimal

    return total_decimal


async def _can_edit_any(
    db: AsyncSession,
    current_user,
) -> bool:
    """
    Check whether the current user has the
    timesheets.edit_any permission.
    """

    return await PermissionService.has_permission(
        db,
        current_user.id,
        Permissions.TIMESHEETS_EDIT_ANY,
    )


async def _get_timesheet(
    db: AsyncSession,
    timesheet_id: str,
) -> Optional[Timesheet]:
    """
    Retrieve a timesheet by ID.
    """

    result = await db.execute(
        select(Timesheet)
        .where(Timesheet.id == timesheet_id)
    )

    return result.scalar_one_or_none()


async def _get_timesheet_with_entries(
    db: AsyncSession,
    timesheet_id: str,
) -> Optional[Timesheet]:
    """
    Retrieve a timesheet and preload its entries.
    """

    result = await db.execute(
        select(Timesheet)
        .options(selectinload(Timesheet.entries))
        .where(Timesheet.id == timesheet_id)
    )

    return result.scalar_one_or_none()


# ============================================================
# GET MY TIMESHEET
# ============================================================

@router.get(
    "/my",
    response_model=TimesheetResponse,
)
async def get_my_timesheet(
    week_start: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.TIMESHEETS_VIEW)
    ),
):
    """
    Get the current user's timesheet for a specific week.

    If no week is supplied, the current Monday-Sunday
    work week is used.
    """

    if not week_start:
        today = date.today()
        week_start = (
            today - timedelta(days=today.weekday())
        )

    week_end = week_start + timedelta(days=6)

    result = await db.execute(
        select(Timesheet)
        .options(selectinload(Timesheet.entries))
        .where(
            Timesheet.person_id == current_user.person_id,
            Timesheet.week_start_date == week_start,
        )
    )

    timesheet = result.scalar_one_or_none()

    if not timesheet:

        timesheet = Timesheet(
            id=str(uuid.uuid4()),
            person_id=current_user.person_id,
            week_start_date=week_start,
            week_end_date=week_end,
            status="draft",
            expected_hours=40,
            total_hours=0,
        )

        db.add(timesheet)

        await db.commit()

        return await _get_timesheet_with_entries(
            db,
            str(timesheet.id),
        )

    return timesheet


# ============================================================
# CREATE TIMESHEET ENTRY
# ============================================================

@router.post(
    "/entries",
    response_model=TimesheetEntryResponse,
)
async def create_entry(
    entry_data: TimesheetEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.TIMESHEETS_SUBMIT)
    ),
):
    """
    Add a new entry to a timesheet.
    """

    timesheet_id = str(
        entry_data.timesheet_id
    )

    timesheet = await _get_timesheet(
        db,
        timesheet_id,
    )

    if not timesheet:
        raise HTTPException(
            status_code=404,
            detail="Timesheet not found",
        )

    can_override = await _can_edit_any(
        db,
        current_user,
    )

    if (
        not can_override
        and str(timesheet.person_id)
        != str(current_user.person_id)
    ):
        raise HTTPException(
            status_code=403,
            detail="Not your timesheet",
        )

    if (
        not can_override
        and timesheet.status
        not in ["draft", "rejected"]
    ):
        raise HTTPException(
            status_code=400,
            detail="Timesheet is not editable",
        )

    entry = TimesheetEntry(
        id=str(uuid.uuid4()),
        timesheet_id=timesheet_id,
        date=entry_data.date,
        project_id=(
            str(entry_data.project_id)
            if entry_data.project_id
            else None
        ),
        task_id=(
            str(entry_data.task_id)
            if entry_data.task_id
            else None
        ),
        start_time=entry_data.start_time,
        end_time=entry_data.end_time,
        break_minutes=(
            entry_data.break_minutes or 0
        ),
        duration=entry_data.duration,
        description=entry_data.description,
        is_billable=(
            entry_data.is_billable or "yes"
        ),
    )

    db.add(entry)

    await db.flush()

    total_hours = await _recalculate_timesheet_total(
        db,
        timesheet,
    )

    await AuditService.log(
        db,
        actor=current_user,
        action="TIMESHEET_CREATED",
        entity_type="timesheet_entry",
        entity_id=entry.id,
        description=(
            f"Created timesheet entry for "
            f"{entry.date.isoformat()}"
        ),
        new_values={
            **_entry_snapshot(entry),
            "timesheet_total_hours": float(
                total_hours
            ),
        },
    )

    await db.commit()

    await db.refresh(entry)

    return entry


# ============================================================
# UPDATE TIMESHEET ENTRY
# ============================================================

@router.put(
    "/entries/{entry_id}",
    response_model=TimesheetEntryResponse,
)
async def update_entry(
    entry_id: str,
    entry_data: TimesheetEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.TIMESHEETS_SUBMIT)
    ),
):
    """
    Update an existing timesheet entry.
    """

    result = await db.execute(
        select(TimesheetEntry)
        .where(TimesheetEntry.id == entry_id)
    )

    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(
            status_code=404,
            detail="Entry not found",
        )

    if entry.is_locked:
        raise HTTPException(
            status_code=400,
            detail=(
                "This entry was auto-generated "
                "from attendance and cannot be edited."
            ),
        )

    timesheet = await _get_timesheet(
        db,
        str(entry.timesheet_id),
    )

    if not timesheet:
        raise HTTPException(
            status_code=404,
            detail="Timesheet not found",
        )

    can_override = await _can_edit_any(
        db,
        current_user,
    )

    if (
        not can_override
        and str(timesheet.person_id)
        != str(current_user.person_id)
    ):
        raise HTTPException(
            status_code=403,
            detail="Not your timesheet",
        )

    if (
        not can_override
        and timesheet.status
        not in ["draft", "rejected"]
    ):
        raise HTTPException(
            status_code=400,
            detail="Timesheet is not editable",
        )

    old_values = _entry_snapshot(entry)

    update_data = entry_data.model_dump(
        exclude_unset=True
    )

    for key, value in update_data.items():

        if key in {
            "project_id",
            "task_id",
        }:

            value = (
                str(value)
                if value
                else None
            )

        setattr(entry, key, value)

    await db.flush()

    total_hours = await _recalculate_timesheet_total(
        db,
        timesheet,
    )

    new_values = _entry_snapshot(entry)

    await AuditService.log(
        db,
        actor=current_user,
        action="TIMESHEET_UPDATED",
        entity_type="timesheet_entry",
        entity_id=entry.id,
        description=(
            f"Updated timesheet entry "
            f"{entry.id}"
        ),
        old_values=old_values,
        new_values={
            **new_values,
            "timesheet_total_hours": float(
                total_hours
            ),
        },
    )

    await db.commit()

    await db.refresh(entry)

    return entry


# ============================================================
# DELETE TIMESHEET ENTRY
# ============================================================

@router.delete(
    "/entries/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.TIMESHEETS_SUBMIT)
    ),
):
    """
    Delete a timesheet entry.
    """

    result = await db.execute(
        select(TimesheetEntry)
        .where(TimesheetEntry.id == entry_id)
    )

    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(
            status_code=404,
            detail="Entry not found",
        )

    if entry.is_locked:
        raise HTTPException(
            status_code=400,
            detail=(
                "This entry was auto-generated "
                "from attendance and cannot be edited."
            ),
        )

    timesheet = await _get_timesheet(
        db,
        str(entry.timesheet_id),
    )

    if not timesheet:
        raise HTTPException(
            status_code=404,
            detail="Timesheet not found",
        )

    can_override = await _can_edit_any(
        db,
        current_user,
    )

    if (
        not can_override
        and str(timesheet.person_id)
        != str(current_user.person_id)
    ):
        raise HTTPException(
            status_code=403,
            detail="Not your timesheet",
        )

    if (
        not can_override
        and timesheet.status
        not in ["draft", "rejected"]
    ):
        raise HTTPException(
            status_code=400,
            detail="Timesheet is not editable",
        )

    old_values = _entry_snapshot(entry)

    await db.delete(entry)

    await db.flush()

    total_hours = await _recalculate_timesheet_total(
        db,
        timesheet,
    )

    await AuditService.log(
        db,
        actor=current_user,
        action="TIMESHEET_DELETED",
        entity_type="timesheet_entry",
        entity_id=entry_id,
        description=(
            f"Deleted timesheet entry "
            f"{entry_id}"
        ),
        old_values={
            **old_values,
            "timesheet_total_hours": float(
                total_hours
            ),
        },
    )

    await db.commit()

    return None


# ============================================================
# SUBMIT TIMESHEET
# ============================================================

@router.post(
    "/submit",
    response_model=TimesheetResponse,
)
async def submit_timesheet(
    submit_data: TimesheetSubmit,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.TIMESHEETS_SUBMIT)
    ),
):
    """
    Submit a timesheet for approval.
    """

    timesheet_id = str(
        submit_data.timesheet_id
    )

    timesheet = await _get_timesheet(
        db,
        timesheet_id,
    )

    if not timesheet:
        raise HTTPException(
            status_code=404,
            detail="Timesheet not found",
        )

    if (
        str(timesheet.person_id)
        != str(current_user.person_id)
    ):
        raise HTTPException(
            status_code=403,
            detail="Not your timesheet",
        )

    if timesheet.status not in [
        "draft",
        "rejected",
    ]:
        raise HTTPException(
            status_code=400,
            detail="Timesheet cannot be submitted",
        )

    old_status = timesheet.status

    # Make sure the total is current before submission.
    total_hours = await _recalculate_timesheet_total(
        db,
        timesheet,
    )

    timesheet.status = "submitted"
    timesheet.submitted_at = _utc_now()
    timesheet.submitted_by = current_user.person_id

    history = TimesheetApprovalHistory(
        id=str(uuid.uuid4()),
        timesheet_id=timesheet.id,
        action="submitted",
        performed_by=current_user.person_id,
    )

    db.add(history)

    await db.flush()

    await AuditService.log(
        db,
        actor=current_user,
        action="TIMESHEET_SUBMITTED",
        entity_type="timesheet",
        entity_id=timesheet.id,
        description=(
            f"Submitted timesheet for "
            f"week beginning "
            f"{timesheet.week_start_date.isoformat()}"
        ),
        old_values={
            "status": old_status,
        },
        new_values={
            "status": "submitted",
            "submitted_at": (
                timesheet.submitted_at.isoformat()
            ),
            "total_hours": float(total_hours),
            "expected_hours": float(
                timesheet.expected_hours or 40
            ),
        },
    )

    await db.commit()
    # Notify the approver
    submitter_result = await db.execute(
        select(Person).where(Person.id == current_user.person_id)
    )
    submitter = submitter_result.scalar_one_or_none()

    approver_person_id: Optional[str] = None
    if submitter and submitter.reports_to_id:
        approver_person_id = submitter.reports_to_id
    else:
        # No manager → route to Head of HR
        hr_result = await db.execute(
            select(User.person_id)
            .join(User.roles)
            .where(Role.name == "head_of_hr", User.is_active.is_(True))
            .limit(1)
        )
        approver_person_id = hr_result.scalar_one_or_none()

    if approver_person_id:
        # Find that person's user account
        approver_user_result = await db.execute(
            select(User).where(User.person_id == approver_person_id)
        )
        approver_user = approver_user_result.scalar_one_or_none()

        if approver_user:
            from app.models.sql.core.notification import Notification

            notification = Notification(
                id=str(uuid.uuid4()),
                user_id=approver_user.id,
                title="Timesheet awaiting your approval",
                body=(
                    f"{submitter.first_name} {submitter.last_name} submitted "
                    f"a timesheet for week beginning "
                    f"{timesheet.week_start_date.isoformat()}"
                ),
                type="info",
                link="/timesheets?tab=team",
            )
            db.add(notification)
            await db.commit()

    return await _get_timesheet_with_entries(
        db,
        str(timesheet.id),
    )


# ============================================================
# TEAM TIMESHEETS
# ============================================================

@router.get(
    "/team",
    response_model=List[TimesheetResponse],
)
async def get_team_timesheets(
    week_start: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.TIMESHEETS_APPROVE)
    ),
):
    """
    Get timesheets for a specific week.

    Managers see only their direct reports. HR administrators and
    executives with organisation-wide access see everyone.
    """

    if not week_start:
        today = date.today()
        week_start = (
            today - timedelta(days=today.weekday())
        )

    can_view_all = await PermissionService.has_permission(
        db,
        current_user.id,
        Permissions.TIMESHEETS_EDIT_ANY,
    )
    if not can_view_all:
        can_view_all = await PermissionService.has_permission(
            db,
            current_user.id,
            Permissions.HR_VIEW_SENSITIVE,
        )
    if not can_view_all:
        can_view_all = await PermissionService.has_permission(
            db,
            current_user.id,
            Permissions.USERS_MANAGE,
        )

    query = (
        select(Timesheet)
        .options(selectinload(Timesheet.entries))
        .where(Timesheet.week_start_date == week_start)
        .order_by(Timesheet.person_id)
    )

    if not can_view_all:
        query = query.where(
            Timesheet.person_id.in_(
                select(Person.id).where(
                    Person.reports_to_id == current_user.person_id
                )
            )
        )

    result = await db.execute(query)
    return result.scalars().all()


# ============================================================
# HR TIMESHEET OVERVIEW
# ============================================================

@router.get("/hr-overview")
async def get_hr_timesheet_overview(
    start_date: date,
    end_date: date,
    timesheet_status: Optional[str] = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_any_permission(
            [
                Permissions.TIMESHEETS_EDIT_ANY,
                Permissions.HR_VIEW_SENSITIVE,
            ]
        )
    ),
):
    """
    Organisation-wide timesheet totals for HR and payroll preparation.

    Returns approved, submitted and draft hours per employee, plus
    overtime hours and weekly totals for the requested date range.
    """

    if end_date < start_date:
        raise HTTPException(
            status_code=400,
            detail="end_date must be on or after start_date",
        )

    overlap = (
        (Timesheet.week_end_date >= start_date)
        & (Timesheet.week_start_date <= end_date)
    )
    if timesheet_status:
        overlap = overlap & (Timesheet.status == timesheet_status)

    person_query = (
        select(
            Person.id,
            Person.first_name,
            Person.last_name,
            Person.employee_number,
            Person.department,
            func.count(func.distinct(Timesheet.id)),
            func.coalesce(func.sum(Timesheet.total_hours), 0),
            func.coalesce(func.sum(Timesheet.expected_hours), 0),
            func.coalesce(
                func.sum(
                    case((Timesheet.status == "approved", Timesheet.total_hours), else_=0)
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case((Timesheet.status == "submitted", Timesheet.total_hours), else_=0)
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case((Timesheet.status == "draft", Timesheet.total_hours), else_=0)
                ),
                0,
            ),
        )
        .select_from(Person)
        .outerjoin(Timesheet, (Timesheet.person_id == Person.id) & overlap)
        .where(
            Person.deleted_at.is_(None),
            Person.status == "active",
            Person.type == "staff",
        )
        .group_by(
            Person.id,
            Person.first_name,
            Person.last_name,
            Person.employee_number,
            Person.department,
        )
        .order_by(Person.first_name, Person.last_name)
    )

    person_result = await db.execute(person_query)

    overtime_query = (
        select(
            Timesheet.person_id,
            func.coalesce(func.sum(TimesheetEntry.overtime_minutes), 0),
        )
        .join(TimesheetEntry, TimesheetEntry.timesheet_id == Timesheet.id)
        .join(Person, Person.id == Timesheet.person_id)
        .where(
            Person.type == "staff",
            Person.deleted_at.is_(None),
            Timesheet.week_end_date >= start_date,
            Timesheet.week_start_date <= end_date,
            TimesheetEntry.date >= start_date,
            TimesheetEntry.date <= end_date,
        )
        .group_by(Timesheet.person_id)
    )
    overtime_result = await db.execute(overtime_query)
    overtime_by_person = {
        str(person_id): float(minutes or 0) / 60
        for person_id, minutes in overtime_result.all()
    }

    employees = []
    total_hours = 0.0
    approved_hours = 0.0
    submitted_hours = 0.0

    for (
        person_id,
        first_name,
        last_name,
        employee_number,
        department,
        sheet_count,
        hours,
        expected,
        approved,
        submitted,
        draft,
    ) in person_result.all():
        person_key = str(person_id)
        employee = {
            "person_id": person_key,
            "person_name": f"{first_name} {last_name}".strip(),
            "employee_number": employee_number,
            "department": department,
            "timesheet_count": int(sheet_count or 0),
            "total_hours": round(float(hours or 0), 2),
            "expected_hours": round(float(expected or 0), 2),
            "approved_hours": round(float(approved or 0), 2),
            "submitted_hours": round(float(submitted or 0), 2),
            "draft_hours": round(float(draft or 0), 2),
            "overtime_hours": round(overtime_by_person.get(person_key, 0), 2),
        }
        employees.append(employee)
        total_hours += employee["total_hours"]
        approved_hours += employee["approved_hours"]
        submitted_hours += employee["submitted_hours"]

    week_result = await db.execute(
        select(
            Timesheet.week_start_date,
            Timesheet.week_end_date,
            func.count(func.distinct(Timesheet.person_id)),
            func.coalesce(func.sum(Timesheet.total_hours), 0),
            func.coalesce(
                func.sum(
                    case((Timesheet.status == "approved", Timesheet.total_hours), else_=0)
                ),
                0,
            ),
        )
        .join(Person, Person.id == Timesheet.person_id)
        .where(
            Timesheet.week_end_date >= start_date,
            Timesheet.week_start_date <= end_date,
            Person.type == "staff",
            Person.deleted_at.is_(None),
            Person.status == "active",
        )
        .group_by(Timesheet.week_start_date, Timesheet.week_end_date)
        .order_by(Timesheet.week_start_date)
    )
    by_week = [
        {
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "employee_count": int(count or 0),
            "total_hours": round(float(hours or 0), 2),
            "approved_hours": round(float(approved or 0), 2),
        }
        for week_start, week_end, count, hours, approved in week_result.all()
    ]

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "summary": {
            "employee_count": len([e for e in employees if e["timesheet_count"] > 0]),
            "total_hours": round(total_hours, 2),
            "approved_hours": round(approved_hours, 2),
            "submitted_hours": round(submitted_hours, 2),
            "overtime_hours": round(sum(e["overtime_hours"] for e in employees), 2),
        },
        "employees": employees,
        "by_week": by_week,
    }


# ============================================================
# APPROVE TIMESHEET
# ============================================================

@router.post(
    "/approve",
    response_model=TimesheetResponse,
)
async def approve_timesheet(
    approve_data: TimesheetApprove,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.TIMESHEETS_APPROVE)
    ),
):
    """
    Approve a submitted timesheet.
    """

    timesheet_id = str(
        approve_data.timesheet_id
    )

    timesheet = await _get_timesheet(
        db,
        timesheet_id,
    )

    if not timesheet:
        raise HTTPException(
            status_code=404,
            detail="Timesheet not found",
        )

    if (
        str(timesheet.person_id)
        == str(current_user.person_id)
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "You cannot approve "
                "your own timesheet"
            ),
        )
    # Verify the actor is authorized to approve THIS timesheet
    is_hr_admin = await PermissionService.has_permission(
        db,
        current_user.id,
        Permissions.HR_VIEW_SENSITIVE,
    )
    is_ceo = await PermissionService.has_permission(
        db,
        current_user.id,
        Permissions.USERS_MANAGE,
    )

    if not (is_hr_admin or is_ceo):
        submitter_result = await db.execute(
            select(Person).where(Person.id == timesheet.person_id)
        )
        submitter = submitter_result.scalar_one_or_none()

        if not submitter or str(submitter.reports_to_id) != str(current_user.person_id):
            raise HTTPException(
                status_code=403,
                detail="You can only approve timesheets from your direct reports",
            )
    if timesheet.status != "submitted":
        raise HTTPException(
            status_code=400,
            detail="Timesheet is not submitted",
        )

    old_status = timesheet.status

    now = _utc_now()

    timesheet.status = "approved"
    timesheet.approved_at = now
    timesheet.approved_by = current_user.person_id

    history = TimesheetApprovalHistory(
        id=str(uuid.uuid4()),
        timesheet_id=timesheet.id,
        action="approved",
        performed_by=current_user.person_id,
        comment=approve_data.comment,
    )

    db.add(history)

    await db.flush()

    await AuditService.log(
        db,
        actor=current_user,
        action="TIMESHEET_APPROVED",
        entity_type="timesheet",
        entity_id=timesheet.id,
        description=(
            f"Approved timesheet for "
            f"week beginning "
            f"{timesheet.week_start_date.isoformat()}"
        ),
        old_values={
            "status": old_status,
        },
        new_values={
            "status": "approved",
            "approved_at": now.isoformat(),
            "approved_by": str(
                current_user.person_id
            ),
            "comment": approve_data.comment,
        },
    )

    await db.commit()

    return await _get_timesheet_with_entries(
        db,
        str(timesheet.id),
    )


# ============================================================
# RETURN / REJECT TIMESHEET
# ============================================================

@router.post(
    "/return",
    response_model=TimesheetResponse,
)
async def return_timesheet(
    return_data: TimesheetReturn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.TIMESHEETS_APPROVE)
    ),
):
    """
    Return a submitted timesheet to the employee
    for correction.

    The existing application calls this action
    'returned' in approval history and uses
    'rejected' as the timesheet status.
    """

    timesheet_id = str(
        return_data.timesheet_id
    )

    timesheet = await _get_timesheet(
        db,
        timesheet_id,
    )

    if not timesheet:
        raise HTTPException(
            status_code=404,
            detail="Timesheet not found",
        )

    if timesheet.status != "submitted":
        raise HTTPException(
            status_code=400,
            detail="Timesheet is not submitted",
        )
    # Verify the actor is authorized to return THIS timesheet
    is_hr_admin = await PermissionService.has_permission(
        db,
        current_user.id,
        Permissions.HR_VIEW_SENSITIVE,
    )
    is_ceo = await PermissionService.has_permission(
        db,
        current_user.id,
        Permissions.USERS_MANAGE,
    )

    if not (is_hr_admin or is_ceo):
        submitter_result = await db.execute(
            select(Person).where(Person.id == timesheet.person_id)
        )
        submitter = submitter_result.scalar_one_or_none()

        if not submitter or str(submitter.reports_to_id) != str(current_user.person_id):
            raise HTTPException(
                status_code=403,
                detail="You can only return timesheets from your direct reports",
            )
        
    old_status = timesheet.status

    timesheet.status = "rejected"

    history = TimesheetApprovalHistory(
        id=str(uuid.uuid4()),
        timesheet_id=timesheet.id,
        action="returned",
        performed_by=current_user.person_id,
        comment=return_data.comment,
    )

    db.add(history)

    await db.flush()

    await AuditService.log(
        db,
        actor=current_user,
        action="TIMESHEET_REJECTED",
        entity_type="timesheet",
        entity_id=timesheet.id,
        description=(
            f"Returned timesheet for correction "
            f"for week beginning "
            f"{timesheet.week_start_date.isoformat()}"
        ),
        old_values={
            "status": old_status,
        },
        new_values={
            "status": "rejected",
            "comment": return_data.comment,
        },
    )

    await db.commit()

    return await _get_timesheet_with_entries(
        db,
        str(timesheet.id),
    )


# ============================================================
# APPROVAL HISTORY
# ============================================================

@router.get(
    "/history/{timesheet_id}",
    response_model=List[
        TimesheetApprovalHistoryResponse
    ],
)
async def get_approval_history(
    timesheet_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.TIMESHEETS_VIEW)
    ),
):
    """
    Get the approval history for a timesheet.
    """

    timesheet = await _get_timesheet(
        db,
        timesheet_id,
    )

    if not timesheet:
        raise HTTPException(
            status_code=404,
            detail="Timesheet not found",
        )

    # A normal employee may view the history
    # of their own timesheet.
    #
    # Approval users may view team histories.
    if (
        str(timesheet.person_id)
        != str(current_user.person_id)
    ):

        can_approve = await PermissionService.has_permission(
            db,
            current_user.id,
            Permissions.TIMESHEETS_APPROVE,
        )

        if not can_approve:
            raise HTTPException(
                status_code=403,
                detail=(
                    "You do not have permission "
                    "to view this timesheet history"
                ),
            )

    result = await db.execute(
        select(TimesheetApprovalHistory)
        .where(
            TimesheetApprovalHistory.timesheet_id
            == timesheet_id
        )
        .order_by(
            TimesheetApprovalHistory.created_at
        )
    )

    return result.scalars().all()


# ============================================================
# MY TIMESHEET ANALYTICS
# ============================================================

@router.get("/my/analytics")
async def get_my_timesheet_analytics(
    week_start: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.TIMESHEETS_VIEW)
    ),
):
    """
    Analytics for the current user's week.

    Returns:
    - hours per day
    - hours per project
    - total hours
    - expected hours
    - remaining hours
    - completion percentage
    - timesheet status
    """

    if not week_start:
        today = date.today()
        week_start = (
            today - timedelta(days=today.weekday())
        )

    week_end = week_start + timedelta(days=6)

    result = await db.execute(
        select(Timesheet)
        .where(
            Timesheet.person_id
            == current_user.person_id,
            Timesheet.week_start_date
            == week_start,
        )
    )

    timesheet = result.scalar_one_or_none()

    if not timesheet:
        return {
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "total_hours": 0,
            "expected_hours": 40,
            "remaining_hours": 40,
            "completion_percentage": 0,
            "status": "not_created",
            "daily": [],
            "by_project": [],
        }

    entries_result = await db.execute(
        select(TimesheetEntry)
        .where(
            TimesheetEntry.timesheet_id
            == timesheet.id
        )
    )

    entries = entries_result.scalars().all()

    # --------------------------------------------------------
    # Daily hours
    # --------------------------------------------------------

    daily_map: dict[str, float] = {}

    for i in range(7):

        current_date = (
            week_start
            + timedelta(days=i)
        )

        daily_map[
            current_date.isoformat()
        ] = 0.0

    for entry in entries:

        entry_date = entry.date.isoformat()

        daily_map[entry_date] = (
            daily_map.get(entry_date, 0)
            + float(entry.duration or 0)
        )

    # --------------------------------------------------------
    # Project hours
    # --------------------------------------------------------

    project_ids = list(
        {
            str(entry.project_id)
            for entry in entries
            if entry.project_id
        }
    )

    projects_map: dict[str, str] = {}

    if project_ids:

        project_result = await db.execute(
            select(Project)
            .where(
                Project.id.in_(project_ids)
            )
        )

        for project in project_result.scalars().all():
            projects_map[
                str(project.id)
            ] = project.name

    project_hours: dict[str, float] = {}

    unassigned_hours = 0.0

    for entry in entries:

        hours = float(
            entry.duration or 0
        )

        if entry.project_id:

            project_id = str(
                entry.project_id
            )

            project_name = projects_map.get(
                project_id,
                "Unknown",
            )

            project_hours[
                project_name
            ] = (
                project_hours.get(
                    project_name,
                    0,
                )
                + hours
            )

        else:
            unassigned_hours += hours

    by_project = [
        {
            "name": name,
            "hours": round(hours, 2),
        }
        for name, hours in sorted(
            project_hours.items(),
            key=lambda item: -item[1],
        )
    ]

    if unassigned_hours > 0:

        by_project.append(
            {
                "name": "General / Admin",
                "hours": round(
                    unassigned_hours,
                    2,
                ),
            }
        )

    # --------------------------------------------------------
    # Totals
    # --------------------------------------------------------

    total_hours = sum(
        float(entry.duration or 0)
        for entry in entries
    )

    expected_hours = float(
        timesheet.expected_hours or 40
    )

    remaining_hours = max(
        expected_hours - total_hours,
        0,
    )

    if expected_hours > 0:

        completion_percentage = min(
            round(
                (
                    total_hours
                    / expected_hours
                )
                * 100,
                2,
            ),
            100,
        )

    else:
        completion_percentage = 0

    return {
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "total_hours": round(
            total_hours,
            2,
        ),
        "expected_hours": expected_hours,
        "remaining_hours": round(
            remaining_hours,
            2,
        ),
        "completion_percentage": (
            completion_percentage
        ),
        "status": timesheet.status,
        "daily": [
            {
                "date": current_date,
                "hours": round(
                    hours,
                    2,
                ),
            }
            for current_date, hours
            in sorted(daily_map.items())
        ],
        "by_project": by_project,
    }