from datetime import date
from types import SimpleNamespace
import uuid

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

import app.models.sql  # noqa: F401
from app.core.database import Base
from app.models.pydantic.payroll.schemas import PayGroupUpdate
from app.models.sql.payroll.config import PayGroup
from app.models.sql.payroll.employee import EmployeePayProfile
from app.api.v1.endpoints.payroll.config import update_pay_group


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


async def make_group(session: AsyncSession, **overrides) -> PayGroup:
    values = {
        "id": str(uuid.uuid4()),
        "name": f"Group {uuid.uuid4().hex[:6]}",
        "pay_type": "hourly",
        "currency": "GHS",
        "overtime_eligible": False,
        "proration_basis": "working_days",
        "is_active": True,
    }
    values.update(overrides)
    group = PayGroup(**values)
    session.add(group)
    await session.commit()
    return group


async def add_profile(session: AsyncSession, group: PayGroup, active=True):
    profile = EmployeePayProfile(
        id=str(uuid.uuid4()),
        person_id=str(uuid.uuid4()),
        pay_group_id=group.id,
        pay_type="hourly",
        base_amount=0,
        hourly_rate=20,
        currency="GHS",
        payment_method="bank_transfer",
        effective_from=date(2026, 10, 1),
        is_active=active,
    )
    session.add(profile)
    await session.commit()
    return profile


def actor():
    return SimpleNamespace(id=str(uuid.uuid4()), person_id=str(uuid.uuid4()))


@pytest.mark.asyncio
async def test_group_fields_can_be_edited(session: AsyncSession):
    group = await make_group(session)

    updated = await update_pay_group(
        group.id,
        PayGroupUpdate(pay_type="salaried", overtime_eligible=True),
        session,
        actor(),
    )

    assert updated.pay_type == "salaried"
    assert updated.overtime_eligible is True


@pytest.mark.asyncio
async def test_group_cannot_be_deactivated_with_active_profiles(
    session: AsyncSession,
):
    group = await make_group(session)
    await add_profile(session, group)

    with pytest.raises(HTTPException) as error:
        await update_pay_group(
            group.id,
            PayGroupUpdate(is_active=False),
            session,
            actor(),
        )

    assert error.value.status_code == 409
    assert "active employee pay profile" in error.value.detail


@pytest.mark.asyncio
async def test_group_deactivates_once_profiles_are_inactive(
    session: AsyncSession,
):
    group = await make_group(session)
    await add_profile(session, group, active=False)

    updated = await update_pay_group(
        group.id,
        PayGroupUpdate(is_active=False),
        session,
        actor(),
    )

    assert updated.is_active is False
