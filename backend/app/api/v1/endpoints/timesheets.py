from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date, timedelta
from decimal import Decimal

from app.core.database import get_db
from app.core.security import require_permission, Permissions
from app.models.sql.timesheet import (
    Timesheet,
    TimesheetEntry,
    TimesheetApprovalHistory,
)
from app.models.sql.user import Person
from app.models.pydantic.timesheet import (
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
# TIMESHEET AUTHORIZATION / ORGANIZATIONAL SCOPE
# ============================================================

# These roles have organization-wide timesheet access.
# CEO is also the current Super Admin role in Shoova ONE.
GLOBAL_TIMESHEET_ROLES = {
    "ceo",
    "executive_director",
}


async def get_timesheet_scope_person_ids(
    db: AsyncSession,
    current_user,
) -> set[str]:
    """
    Return the people whose timesheets the current user may manage.

    CEO / Super Admin and Executive Director:
        - Organization-wide access.

    Director / Manager:
        - Their entire reporting hierarchy.

    Other users:
        - Only people below them in the reporting hierarchy.
    """

    user_roles = {
        role.name.lower()
        for role in current_user.roles
        if role.name
    }

    # --------------------------------------------------------
    # CEO / SUPER ADMIN / EXECUTIVE DIRECTOR
    # --------------------------------------------------------
    if user_roles.intersection(GLOBAL_TIMESHEET_ROLES):
        result = await db.execute(
            select(Person.id).where(
                Person.deleted_at.is_(None)
            )
        )

        return {
            str(person_id)
            for person_id in result.scalars().all()
        }

    # --------------------------------------------------------
    # BUILD ORGANIZATIONAL HIERARCHY
    # --------------------------------------------------------
    result = await db.execute(
        select(
            Person.id,
            Person.reports_to_id,
        ).where(
            Person.deleted_at.is_(None)
        )
    )

    people = result.all()

    # Example:
    #
    # manager_id -> [employee1, employee2]
    #
    children_by_manager: dict[str, list[str]] = {}

    for person_id, reports_to_id in people:
        if reports_to_id:
            manager_id = str(reports_to_id)

            children_by_manager.setdefault(
                manager_id,
                []
            ).append(
                str(person_id)
            )

    # --------------------------------------------------------
    # WALK THE ENTIRE REPORTING TREE
    # --------------------------------------------------------
    root_id = str(current_user.person_id)

    scope: set[str] = set()

    pending = list(
        children_by_manager.get(root_id, [])
    )

    while pending:
        person_id = pending.pop()

        # Prevent loops / duplicate traversal.
        if person_id in scope:
            continue

        scope.add(person_id)

        # Add this person's direct reports.
        pending.extend(
            children_by_manager.get(
                person_id,
                []
            )
        )

    return scope


async def can_manage_timesheet(
    db: AsyncSession,
    current_user,
    timesheet: Timesheet,
) -> bool:
    """
    Check whether the current user may manage a specific
    timesheet.

    Users can always access their own timesheet.

    Managers / Directors can access timesheets belonging
    to people in their reporting hierarchy.

    CEO / Super Admin and Executive Director can access
    organization-wide timesheets.
    """

    # --------------------------------------------------------
    # OWN TIMESHEET
    # --------------------------------------------------------
    if str(timesheet.person_id) == str(
        current_user.person_id
    ):
        return True

    # --------------------------------------------------------
    # ORGANIZATIONAL SCOPE
    # --------------------------------------------------------
    scope = await get_timesheet_scope_person_ids(
        db,
        current_user,
    )

    return str(timesheet.person_id) in scope


# ============================================================
# MY TIMESHEET
# ============================================================

@router.get(
    "/my",
    response_model=TimesheetResponse,
)
async def get_my_timesheet(
    week_start: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(
            Permissions.TIMESHEETS_VIEW
        )
    ),
):
    """Get current user's timesheet for a specific week."""

    if not week_start:
        today = date.today()
        week_start = today - timedelta(
            days=today.weekday()
        )

    week_end = week_start + timedelta(days=6)

    result = await db.execute(
        select(Timesheet)
        .options(
            selectinload(Timesheet.entries)
        )
        .where(
            Timesheet.person_id
            == current_user.person_id,
            Timesheet.week_start_date
            == week_start,
        )
    )

    timesheet = result.scalar_one_or_none()

    if not timesheet:

        import uuid

        timesheet = Timesheet(
            id=str(uuid.uuid4()),
            person_id=current_user.person_id,
            week_start_date=week_start,
            week_end_date=week_end,
            status="draft",
            expected_hours=40,
        )

        db.add(timesheet)

        await db.commit()

        result = await db.execute(
            select(Timesheet)
            .options(
                selectinload(
                    Timesheet.entries
                )
            )
            .where(
                Timesheet.id
                == timesheet.id
            )
        )

        return result.scalar_one()

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
        require_permission(
            Permissions.TIMESHEETS_SUBMIT
        )
    ),
):
    """Add an entry to a timesheet."""

    timesheet_id = str(
        entry_data.timesheet_id
    )

    result = await db.execute(
        select(Timesheet).where(
            Timesheet.id == timesheet_id
        )
    )

    timesheet = result.scalar_one_or_none()

    if not timesheet:
        raise HTTPException(
            status_code=404,
            detail="Timesheet not found",
        )

    # Employees can only edit their own timesheets.
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
            detail="Timesheet is not editable",
        )

    import uuid

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
            entry_data.is_billable
            or "yes"
        ),
    )

    db.add(entry)

    # Recalculate total hours.
    result = await db.execute(
        select(
            func.sum(
                TimesheetEntry.duration
            )
        ).where(
            TimesheetEntry.timesheet_id
            == timesheet.id
        )
    )

    total = result.scalar() or 0

    timesheet.total_hours = Decimal(
        str(total)
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
        require_permission(
            Permissions.TIMESHEETS_SUBMIT
        )
    ),
):
    """Update a timesheet entry."""

    result = await db.execute(
        select(TimesheetEntry).where(
            TimesheetEntry.id == entry_id
        )
    )

    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(
            status_code=404,
            detail="Entry not found",
        )

    result = await db.execute(
        select(Timesheet).where(
            Timesheet.id
            == entry.timesheet_id
        )
    )

    timesheet = result.scalar_one()

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
            detail="Timesheet is not editable",
        )

    for key, value in (
        entry_data
        .model_dump(
            exclude_unset=True
        )
        .items()
    ):
        setattr(
            entry,
            key,
            value,
        )

    # Recalculate total hours.
    result = await db.execute(
        select(
            func.sum(
                TimesheetEntry.duration
            )
        ).where(
            TimesheetEntry.timesheet_id
            == timesheet.id
        )
    )

    total = result.scalar() or 0

    timesheet.total_hours = Decimal(
        str(total)
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
        require_permission(
            Permissions.TIMESHEETS_SUBMIT
        )
    ),
):
    """Delete a timesheet entry."""

    result = await db.execute(
        select(TimesheetEntry).where(
            TimesheetEntry.id == entry_id
        )
    )

    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(
            status_code=404,
            detail="Entry not found",
        )

    result = await db.execute(
        select(Timesheet).where(
            Timesheet.id
            == entry.timesheet_id
        )
    )

    timesheet = result.scalar_one()

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
            detail="Timesheet is not editable",
        )

    await db.delete(entry)

    # Recalculate total hours.
    result = await db.execute(
        select(
            func.sum(
                TimesheetEntry.duration
            )
        ).where(
            TimesheetEntry.timesheet_id
            == timesheet.id
        )
    )

    total = result.scalar() or 0

    timesheet.total_hours = Decimal(
        str(total)
    )

    await db.commit()


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
        require_permission(
            Permissions.TIMESHEETS_SUBMIT
        )
    ),
):
    """Submit a timesheet for approval."""

    timesheet_id = str(
        submit_data.timesheet_id
    )

    result = await db.execute(
        select(Timesheet).where(
            Timesheet.id == timesheet_id
        )
    )

    timesheet = result.scalar_one_or_none()

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

    timesheet.status = "submitted"
    timesheet.submitted_at = datetime.now()
    timesheet.submitted_by = (
        current_user.person_id
    )

    # Add approval history.
    import uuid

    history = TimesheetApprovalHistory(
        id=str(uuid.uuid4()),
        timesheet_id=timesheet.id,
        action="submitted",
        performed_by=current_user.person_id,
    )

    db.add(history)

    await db.commit()

    result = await db.execute(
        select(Timesheet)
        .options(
            selectinload(Timesheet.entries)
        )
        .where(
            Timesheet.id == timesheet.id
        )
    )

    return result.scalar_one()


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
        require_permission(
            Permissions.TIMESHEETS_APPROVE
        )
    ),
):
    """
    Get timesheets within the current user's
    organizational scope.
    """

    if not week_start:
        today = date.today()
        week_start = today - timedelta(
            days=today.weekday()
        )

    # Determine who this user is allowed to manage.
    scope = await get_timesheet_scope_person_ids(
        db,
        current_user,
    )

    if not scope:
        return []

    result = await db.execute(
        select(Timesheet)
        .options(
            selectinload(Timesheet.entries)
        )
        .where(
            Timesheet.week_start_date
            == week_start,
            Timesheet.person_id.in_(scope),
        )
        .order_by(
            Timesheet.person_id
        )
    )

    return result.scalars().all()


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
        require_permission(
            Permissions.TIMESHEETS_APPROVE
        )
    ),
):
    """Approve a timesheet."""

    timesheet_id = str(
        approve_data.timesheet_id
    )

    result = await db.execute(
        select(Timesheet).where(
            Timesheet.id == timesheet_id
        )
    )

    timesheet = result.scalar_one_or_none()

    if not timesheet:
        raise HTTPException(
            status_code=404,
            detail="Timesheet not found",
        )

    # --------------------------------------------------------
    # CHECK ORGANIZATIONAL AUTHORIZATION
    # --------------------------------------------------------
    if not await can_manage_timesheet(
        db,
        current_user,
        timesheet,
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "You are not authorized "
                "to approve this timesheet"
            ),
        )

    # --------------------------------------------------------
    # PREVENT SELF APPROVAL
    # --------------------------------------------------------
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

    if timesheet.status != "submitted":
        raise HTTPException(
            status_code=400,
            detail="Timesheet is not submitted",
        )

    timesheet.status = "approved"
    timesheet.approved_at = datetime.now()
    timesheet.approved_by = (
        current_user.person_id
    )

    # Add approval history.
    import uuid

    history = TimesheetApprovalHistory(
        id=str(uuid.uuid4()),
        timesheet_id=timesheet.id,
        action="approved",
        performed_by=current_user.person_id,
        comment=approve_data.comment,
    )

    db.add(history)

    await db.commit()

    result = await db.execute(
        select(Timesheet)
        .options(
            selectinload(Timesheet.entries)
        )
        .where(
            Timesheet.id == timesheet.id
        )
    )

    return result.scalar_one()


# ============================================================
# RETURN TIMESHEET
# ============================================================

@router.post(
    "/return",
    response_model=TimesheetResponse,
)
async def return_timesheet(
    return_data: TimesheetReturn,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(
            Permissions.TIMESHEETS_APPROVE
        )
    ),
):
    """Return a timesheet for correction."""

    timesheet_id = str(
        return_data.timesheet_id
    )

    result = await db.execute(
        select(Timesheet).where(
            Timesheet.id == timesheet_id
        )
    )

    timesheet = result.scalar_one_or_none()

    if not timesheet:
        raise HTTPException(
            status_code=404,
            detail="Timesheet not found",
        )

    # --------------------------------------------------------
    # CHECK ORGANIZATIONAL AUTHORIZATION
    # --------------------------------------------------------
    if not await can_manage_timesheet(
        db,
        current_user,
        timesheet,
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "You are not authorized "
                "to return this timesheet"
            ),
        )

    if timesheet.status != "submitted":
        raise HTTPException(
            status_code=400,
            detail="Timesheet is not submitted",
        )

    timesheet.status = "rejected"

    # Add approval history.
    import uuid

    history = TimesheetApprovalHistory(
        id=str(uuid.uuid4()),
        timesheet_id=timesheet.id,
        action="returned",
        performed_by=current_user.person_id,
        comment=return_data.comment,
    )

    db.add(history)

    await db.commit()

    result = await db.execute(
        select(Timesheet)
        .options(
            selectinload(Timesheet.entries)
        )
        .where(
            Timesheet.id == timesheet.id
        )
    )

    return result.scalar_one()


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
        require_permission(
            Permissions.TIMESHEETS_VIEW
        )
    ),
):
    """
    Get approval history for a timesheet.

    Users may view their own history.
    Managers / Directors may view history for
    their organizational scope.
    CEO / Super Admin and Executive Director
    may view organization-wide history.
    """

    # --------------------------------------------------------
    # FIRST FIND THE TIMESHEET
    # --------------------------------------------------------
    timesheet_result = await db.execute(
        select(Timesheet).where(
            Timesheet.id == timesheet_id
        )
    )

    timesheet = (
        timesheet_result
        .scalar_one_or_none()
    )

    if not timesheet:
        raise HTTPException(
            status_code=404,
            detail="Timesheet not found",
        )

    # --------------------------------------------------------
    # CHECK AUTHORIZATION
    # --------------------------------------------------------
    if not await can_manage_timesheet(
        db,
        current_user,
        timesheet,
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "You are not authorized "
                "to view this timesheet history"
            ),
        )

    # --------------------------------------------------------
    # GET HISTORY
    # --------------------------------------------------------
    result = await db.execute(
        select(
            TimesheetApprovalHistory
        )
        .where(
            TimesheetApprovalHistory.timesheet_id
            == timesheet_id
        )
        .order_by(
            TimesheetApprovalHistory.created_at
        )
    )

    return result.scalars().all()