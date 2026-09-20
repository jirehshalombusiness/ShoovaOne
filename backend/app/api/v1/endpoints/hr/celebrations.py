from datetime import date, timedelta
from typing import List, Optional
from enum import Enum

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_permission, Permissions
from app.models.sql.user import User, Person
from app.models.sql.employment_contract import EmploymentContract


router = APIRouter()


# ============================================================
# SCHEMAS
# ============================================================

class CelebrationKind(str, Enum):
    birthday = "birthday"
    anniversary = "anniversary"


class CelebrationItem(BaseModel):
    id: str
    kind: str
    person_id: str
    first_name: str
    last_name: str
    profile_image_url: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    date: str
    days_away: int
    years: int
    label: str


class CelebrationsResponse(BaseModel):
    items: List[CelebrationItem]
    birthdays_count: int
    anniversaries_count: int
    window_days: int


# ============================================================
# HELPERS
# ============================================================

def _next_occurrence(source: date, today: date) -> date:
    """
    Return the next occurrence of a month/day pair, on or after today.

    Handles Feb 29 -> Feb 28 in non-leap years.
    """
    def _safe(year: int) -> date:
        try:
            return source.replace(year=year)
        except ValueError:
            # Feb 29 in a non-leap year
            return source.replace(year=year, day=28)

    candidate = _safe(today.year)
    if candidate < today:
        candidate = _safe(today.year + 1)

    return candidate


# ============================================================
# ENDPOINT
# ============================================================

@router.get("", response_model=CelebrationsResponse)
async def get_celebrations(
    days_ahead: int = Query(60, ge=1, le=365),
    include_birthdays: bool = Query(True),
    include_anniversaries: bool = Query(True),
    department: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_SENSITIVE)),
):
    """
    Unified birthdays + work anniversaries feed.

    For anniversaries, the reference date is the earliest
    EmploymentContract.start_date for each person.

    Requires hr.view_sensitive.
    """
    today = date.today()
    horizon = today + timedelta(days=days_ahead)

    # ---- load people ----
    people_query = select(Person).where(
        Person.deleted_at.is_(None),
        Person.status == "active",
    )
    if department:
        people_query = people_query.where(Person.department == department)

    people_result = await db.execute(people_query)
    people = list(people_result.scalars().all())
    person_map = {p.id: p for p in people}
    person_ids = list(person_map.keys())

    # ---- birthdays ----
    celebrations: List[CelebrationItem] = []

    if include_birthdays:
        for p in people:
            if not p.date_of_birth:
                continue
            dob = p.date_of_birth
            if hasattr(dob, "date"):
                dob = dob.date()

            upcoming = _next_occurrence(dob, today)
            if upcoming < today or upcoming > horizon:
                continue

            days_away = (upcoming - today).days
            years = upcoming.year - dob.year

            celebrations.append(
                CelebrationItem(
                    id=f"bday-{p.id}",
                    kind="birthday",
                    person_id=p.id,
                    first_name=p.first_name,
                    last_name=p.last_name,
                    profile_image_url=p.profile_image_url,
                    job_title=p.job_title,
                    department=p.department,
                    date=upcoming.isoformat(),
                    days_away=days_away,
                    years=years,
                    label=f"Turns {years}",
                )
            )

    # ---- anniversaries ----
    if include_anniversaries and person_ids:
        # Earliest contract start_date per person
        earliest_result = await db.execute(
            select(
                EmploymentContract.person_id,
                func.min(EmploymentContract.start_date).label("earliest_start"),
            )
            .where(EmploymentContract.person_id.in_(person_ids))
            .group_by(EmploymentContract.person_id)
        )

        for row in earliest_result.all():
            person_id = row[0]
            earliest_start = row[1]
            if not earliest_start:
                continue

            p = person_map.get(person_id)
            if not p:
                continue

            upcoming = _next_occurrence(earliest_start, today)
            if upcoming < today or upcoming > horizon:
                continue

            days_away = (upcoming - today).days
            years = upcoming.year - earliest_start.year
            if years <= 0:
                continue

            celebrations.append(
                CelebrationItem(
                    id=f"anniv-{person_id}",
                    kind="anniversary",
                    person_id=person_id,
                    first_name=p.first_name,
                    last_name=p.last_name,
                    profile_image_url=p.profile_image_url,
                    job_title=p.job_title,
                    department=p.department,
                    date=upcoming.isoformat(),
                    days_away=days_away,
                    years=years,
                    label=(
                        f"{years} year{'s' if years != 1 else ''}"
                        f" at {earliest_start.year}"
                    ),
                )
            )

    # ---- sort by proximity ----
    celebrations.sort(key=lambda c: (c.days_away, c.first_name.lower()))

    birthdays_count = sum(1 for c in celebrations if c.kind == "birthday")
    anniversaries_count = sum(1 for c in celebrations if c.kind == "anniversary")

    return CelebrationsResponse(
        items=celebrations,
        birthdays_count=birthdays_count,
        anniversaries_count=anniversaries_count,
        window_days=days_ahead,
    )