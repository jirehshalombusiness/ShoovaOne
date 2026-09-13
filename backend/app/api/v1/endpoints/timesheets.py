from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date, timedelta
from decimal import Decimal

from app.core.database import get_db
from app.core.security import require_permission, Permissions, get_current_active_user
from app.services.permission_service import PermissionService
from app.models.sql.timesheet import Timesheet, TimesheetEntry, TimesheetApprovalHistory
from app.models.sql.user import Person
from app.models.pydantic.timesheet import (
    TimesheetResponse, TimesheetCreate, TimesheetUpdate,
    TimesheetEntryResponse, TimesheetEntryCreate, TimesheetEntryUpdate,
    TimesheetSubmit, TimesheetApprove, TimesheetReturn,
    TimesheetApprovalHistoryResponse
)

router = APIRouter()


# ============ TIMESHEET ENDPOINTS ============

@router.get("/my", response_model=TimesheetResponse)
async def get_my_timesheet(
    week_start: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TIMESHEETS_VIEW)),
):
    """Get current user's timesheet for a specific week."""
    if not week_start:
        # Get current week start (Monday)
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
    
    week_end = week_start + timedelta(days=6)
    
    result = await db.execute(
        select(Timesheet).options(selectinload(Timesheet.entries))
        .where(
            Timesheet.person_id == current_user.person_id,
            Timesheet.week_start_date == week_start
        )
    )
    timesheet = result.scalar_one_or_none()
    
    if not timesheet:
        # Create a new timesheet for this week
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
            .options(selectinload(Timesheet.entries))
            .where(Timesheet.id == timesheet.id)
        )
        return result.scalar_one()

    return timesheet


@router.post("/entries", response_model=TimesheetEntryResponse)
async def create_entry(
    entry_data: TimesheetEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TIMESHEETS_SUBMIT)),
):
    """Add an entry to a timesheet."""
    timesheet_id = str(entry_data.timesheet_id)

    # Check if timesheet exists and belongs to user
    result = await db.execute(
        select(Timesheet).where(Timesheet.id == timesheet_id)
    )
    timesheet = result.scalar_one_or_none()
    
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    
    if timesheet.person_id != current_user.person_id:
        raise HTTPException(status_code=403, detail="Not your timesheet")
    
    can_override = await PermissionService.has_permission(
        db, current_user.id, Permissions.TIMESHEETS_EDIT_ANY
    )
    if not can_override and timesheet.status not in ["draft", "rejected"]:
        raise HTTPException(status_code=400, detail="Timesheet is not editable")
    
    import uuid
    entry = TimesheetEntry(
        id=str(uuid.uuid4()),
        timesheet_id=timesheet_id,
        date=entry_data.date,
        project_id=str(entry_data.project_id) if entry_data.project_id else None,
        task_id=str(entry_data.task_id) if entry_data.task_id else None,
        start_time=entry_data.start_time,
        end_time=entry_data.end_time,
        break_minutes=entry_data.break_minutes or 0,
        duration=entry_data.duration,
        description=entry_data.description,
        is_billable=entry_data.is_billable or "yes",
    )
    db.add(entry)
    
    # Update total hours
    result = await db.execute(
        select(func.sum(TimesheetEntry.duration))
        .where(TimesheetEntry.timesheet_id == timesheet.id)
    )
    total = result.scalar() or 0
    timesheet.total_hours = Decimal(str(total))
    
    await db.commit()
    await db.refresh(entry)
    return entry


@router.put("/entries/{entry_id}", response_model=TimesheetEntryResponse)
async def update_entry(
    entry_id: str,
    entry_data: TimesheetEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TIMESHEETS_SUBMIT)),
):
    """Update a timesheet entry."""
    result = await db.execute(
        select(TimesheetEntry).where(TimesheetEntry.id == entry_id)
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if entry.is_locked:
        raise HTTPException(
            status_code=400,
            detail="This entry was auto-generated from attendance and cannot be edited."
        )

    # Check timesheet ownership
    result = await db.execute(
        select(Timesheet).where(Timesheet.id == entry.timesheet_id)
    )
    timesheet = result.scalar_one_or_none()

    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")

    if timesheet.person_id != current_user.person_id:
        raise HTTPException(status_code=403, detail="Not your timesheet")

    can_override = await PermissionService.has_permission(
        db, current_user.id, Permissions.TIMESHEETS_EDIT_ANY
    )
    if not can_override and timesheet.status not in ["draft", "rejected"]:
        raise HTTPException(status_code=400, detail="Timesheet is not editable")

    for key, value in entry_data.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)

    # Update total hours
    result = await db.execute(
        select(func.sum(TimesheetEntry.duration))
        .where(TimesheetEntry.timesheet_id == timesheet.id)
    )
    total = result.scalar() or 0
    timesheet.total_hours = Decimal(str(total))

    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TIMESHEETS_SUBMIT)),
):
    """Delete a timesheet entry."""
    result = await db.execute(
        select(TimesheetEntry).where(TimesheetEntry.id == entry_id)
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if entry.is_locked:
        raise HTTPException(
            status_code=400,
            detail="This entry was auto-generated from attendance and cannot be edited."
        )

    result = await db.execute(
        select(Timesheet).where(Timesheet.id == entry.timesheet_id)
    )
    timesheet = result.scalar_one_or_none()

    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")

    if timesheet.person_id != current_user.person_id:
        raise HTTPException(status_code=403, detail="Not your timesheet")

    can_override = await PermissionService.has_permission(
        db, current_user.id, Permissions.TIMESHEETS_EDIT_ANY
    )
    if not can_override and timesheet.status not in ["draft", "rejected"]:
        raise HTTPException(status_code=400, detail="Timesheet is not editable")

    await db.delete(entry)

    # Update total hours
    result = await db.execute(
        select(func.sum(TimesheetEntry.duration))
        .where(TimesheetEntry.timesheet_id == timesheet.id)
    )
    total = result.scalar() or 0
    timesheet.total_hours = Decimal(str(total))

    await db.commit()


@router.post("/submit", response_model=TimesheetResponse)
async def submit_timesheet(
    submit_data: TimesheetSubmit,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TIMESHEETS_SUBMIT)),
):
    """Submit a timesheet for approval."""
    timesheet_id = str(submit_data.timesheet_id)
    result = await db.execute(
        select(Timesheet).where(Timesheet.id == timesheet_id)
    )
    timesheet = result.scalar_one_or_none()
    
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    
    if timesheet.person_id != current_user.person_id:
        raise HTTPException(status_code=403, detail="Not your timesheet")
    
    if timesheet.status not in ["draft", "rejected"]:
        raise HTTPException(status_code=400, detail="Timesheet cannot be submitted")
    
    timesheet.status = "submitted"
    timesheet.submitted_at = datetime.now()
    timesheet.submitted_by = current_user.person_id
    
    # Add approval history
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
        .options(selectinload(Timesheet.entries))
        .where(Timesheet.id == timesheet.id)
    )
    return result.scalar_one()


@router.get("/team", response_model=List[TimesheetResponse])
async def get_team_timesheets(
    week_start: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TIMESHEETS_APPROVE)),
):
    """Get timesheets for the user's team."""
    if not week_start:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
    
    week_end = week_start + timedelta(days=6)
    
    result = await db.execute(
        select(Timesheet).options(selectinload(Timesheet.entries))
        .where(Timesheet.week_start_date == week_start)
        .order_by(Timesheet.person_id)
    )
    return result.scalars().all()


@router.post("/approve", response_model=TimesheetResponse)
async def approve_timesheet(
    approve_data: TimesheetApprove,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TIMESHEETS_APPROVE)),
):
    """Approve a timesheet."""
    timesheet_id = str(approve_data.timesheet_id)
    result = await db.execute(
        select(Timesheet).where(Timesheet.id == timesheet_id)
    )
    timesheet = result.scalar_one_or_none()
    
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")

    if timesheet.person_id == current_user.person_id:
        raise HTTPException(status_code=403, detail="You cannot approve your own timesheet")
    
    if timesheet.status != "submitted":
        raise HTTPException(status_code=400, detail="Timesheet is not submitted")
    
    timesheet.status = "approved"
    timesheet.approved_at = datetime.now()
    timesheet.approved_by = current_user.person_id
    
    # Add approval history
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
        .options(selectinload(Timesheet.entries))
        .where(Timesheet.id == timesheet.id)
    )
    return result.scalar_one()


@router.post("/return", response_model=TimesheetResponse)
async def return_timesheet(
    return_data: TimesheetReturn,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TIMESHEETS_APPROVE)),
):
    """Return a timesheet for correction."""
    timesheet_id = str(return_data.timesheet_id)
    result = await db.execute(
        select(Timesheet).where(Timesheet.id == timesheet_id)
    )
    timesheet = result.scalar_one_or_none()
    
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    
    if timesheet.status != "submitted":
        raise HTTPException(status_code=400, detail="Timesheet is not submitted")
    
    timesheet.status = "rejected"
    
    # Add approval history
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
        .options(selectinload(Timesheet.entries))
        .where(Timesheet.id == timesheet.id)
    )
    return result.scalar_one()


@router.get("/history/{timesheet_id}", response_model=List[TimesheetApprovalHistoryResponse])
async def get_approval_history(
    timesheet_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TIMESHEETS_VIEW)),
):
    """Get approval history for a timesheet."""
    result = await db.execute(
        select(TimesheetApprovalHistory)
        .where(TimesheetApprovalHistory.timesheet_id == timesheet_id)
        .order_by(TimesheetApprovalHistory.created_at)
    )
    return result.scalars().all()
async def _can_edit_timesheet(
    db: AsyncSession,
    user_id: str,
    timesheet_owner_person_id: str,
    current_user_person_id: str,
) -> bool:
    """
    Returns True if the user can edit this timesheet.
    Rules:
    - Owner can edit IF timesheet is draft/rejected (not submitted/approved)
    - Any user with timesheets.edit_any can edit ALWAYS
    """
    from app.services.permission_service import PermissionService

    if await PermissionService.has_permission(db, user_id, Permissions.TIMESHEETS_EDIT_ANY):
        return True

    # Owner can only edit draft/rejected
    if str(timesheet_owner_person_id) != str(current_user_person_id):
        return False

    return True

@router.get("/my/analytics")
async def get_my_timesheet_analytics(
    week_start: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TIMESHEETS_VIEW)),
):
    """
    Analytics for the current user's week:
    - hours per day
    - hours per project
    - total hours
    """
    from datetime import timedelta
    from app.models.sql.project import Project

    if not week_start:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    # Get timesheet
    ts_result = await db.execute(
        select(Timesheet).where(
            Timesheet.person_id == current_user.person_id,
            Timesheet.week_start_date == week_start,
        )
    )
    timesheet = ts_result.scalar_one_or_none()

    if not timesheet:
        return {
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "total_hours": 0,
            "expected_hours": 40,
            "daily": [],
            "by_project": [],
        }

    # Get entries
    entries_result = await db.execute(
        select(TimesheetEntry)
        .where(TimesheetEntry.timesheet_id == timesheet.id)
    )
    entries = entries_result.scalars().all()

    # Group by day
    daily_map: dict[str, float] = {}
    for i in range(7):
        d = week_start + timedelta(days=i)
        daily_map[d.isoformat()] = 0.0

    for e in entries:
        daily_map[e.date.isoformat()] = daily_map.get(e.date.isoformat(), 0) + float(e.duration or 0)

    # Group by project
    project_ids = list({str(e.project_id) for e in entries if e.project_id})
    projects_map: dict[str, str] = {}
    if project_ids:
        proj_result = await db.execute(
            select(Project).where(Project.id.in_(project_ids))
        )
        for p in proj_result.scalars().all():
            projects_map[str(p.id)] = p.name

    project_hours: dict[str, float] = {}
    unassigned_hours = 0.0
    for e in entries:
        hours = float(e.duration or 0)
        if e.project_id:
            pid = str(e.project_id)
            name = projects_map.get(pid, "Unknown")
            project_hours[name] = project_hours.get(name, 0) + hours
        else:
            unassigned_hours += hours

    by_project = [
        {"name": name, "hours": round(h, 2)}
        for name, h in sorted(project_hours.items(), key=lambda x: -x[1])
    ]
    if unassigned_hours > 0:
        by_project.append({"name": "General / Admin", "hours": round(unassigned_hours, 2)})

    total = sum(float(e.duration or 0) for e in entries)

    return {
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "total_hours": round(total, 2),
        "expected_hours": float(timesheet.expected_hours or 40),
        "status": timesheet.status,
        "daily": [
            {"date": d, "hours": round(h, 2)}
            for d, h in sorted(daily_map.items())
        ],
        "by_project": by_project,
    }