from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
import uuid
from zoneinfo import ZoneInfo

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

import app.models.sql  # noqa: F401
from app.core.config import settings
from app.core.database import Base
from app.models.sql.timekeeping.attendance import Attendance
from app.models.sql.timekeeping.timesheet import TimesheetEntry
from app.models.sql.timekeeping.work_session import WorkSession
from app.api.v1.endpoints.timekeeping.sessions import start_session
from app.services.timekeeping.attendance_service import (
    auto_checkout_expired_attendance,
    aware,
    organization_date,
)


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with factory() as db:
        yield db

    await engine.dispose()


@pytest.mark.asyncio
async def test_midnight_checkout_records_only_time_worked_before_day_end(
    session: AsyncSession,
):
    org_timezone = ZoneInfo(settings.ORG_TIMEZONE)
    work_date = date(2026, 1, 1)
    check_in = datetime.combine(work_date, time(8), tzinfo=org_timezone)
    day_end = datetime.combine(
        work_date + timedelta(days=1),
        time.min,
        tzinfo=org_timezone,
    )
    person_id = str(uuid.uuid4())
    attendance = Attendance(
        id=str(uuid.uuid4()),
        person_id=person_id,
        date=work_date,
        check_in=check_in,
        status="present",
        current_status="active",
        work_type="office",
    )
    session_record = WorkSession(
        id=str(uuid.uuid4()),
        attendance_id=attendance.id,
        person_id=person_id,
        started_at=check_in,
        last_activity_at=day_end - timedelta(minutes=2),
        duration_minutes=90,
        status="active",
    )
    session.add_all([attendance, session_record])
    await session.commit()

    count = await auto_checkout_expired_attendance(
        session,
        now=day_end + timedelta(minutes=1),
    )

    await session.refresh(attendance)
    await session.refresh(session_record)
    entry_result = await session.execute(select(TimesheetEntry))
    entry = entry_result.scalar_one()

    assert count == 1
    assert aware(attendance.check_out) == day_end.astimezone(timezone.utc)
    assert attendance.duration_minutes == 92
    assert session_record.status == "ended"
    assert aware(session_record.ended_at) == day_end.astimezone(timezone.utc)
    assert entry.date == work_date
    assert entry.duration == Decimal("1.53")
    assert entry.is_locked is True
    assert await auto_checkout_expired_attendance(
        session,
        now=day_end + timedelta(minutes=2),
    ) == 0


@pytest.mark.asyncio
async def test_new_work_session_keeps_previous_effective_time(
    session: AsyncSession,
):
    person_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    attendance = Attendance(
        id=str(uuid.uuid4()),
        person_id=person_id,
        date=organization_date(),
        check_in=now - timedelta(hours=2),
        status="present",
        current_status="active",
        work_type="office",
        planned_task_ids=["previous-task"],
    )
    previous_session = WorkSession(
        id=str(uuid.uuid4()),
        attendance_id=attendance.id,
        person_id=person_id,
        started_at=now - timedelta(hours=2),
        last_activity_at=now - timedelta(minutes=3),
        duration_minutes=60,
        status="active",
    )
    session.add_all([attendance, previous_session])
    await session.commit()

    await start_session(
        {
            "work_type": "field",
            "planned_task_ids": [],
            "adhoc_tasks": [],
        },
        session,
        SimpleNamespace(person_id=person_id),
    )

    await session.refresh(attendance)
    await session.refresh(previous_session)
    sessions_result = await session.execute(select(WorkSession))
    sessions = list(sessions_result.scalars().all())

    assert attendance.work_type == "field"
    assert attendance.planned_task_ids == []
    assert previous_session.status == "ended"
    assert previous_session.duration_minutes >= 62
    assert sum(item.duration_minutes for item in sessions) >= 62
    assert sum(item.status == "active" for item in sessions) == 1
