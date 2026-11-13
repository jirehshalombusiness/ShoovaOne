from collections import defaultdict
from datetime import date, datetime, timezone
import secrets
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.rate_limit import SlidingWindowLimiter
from app.models.sql.core.organisation import Programme
from app.models.sql.programmes.academics import (
    CohortEnrolment,
    ProgrammeCohort,
)
from app.models.sql.programmes.public_application import ProgrammeApplication

router = APIRouter()

APPLICATION_IP_LIMIT = 20
APPLICATION_IP_WINDOW_SECONDS = 3600
application_limiter = SlidingWindowLimiter()


class PublicCohort(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    enrolment_opens_on: Optional[date] = None
    enrolment_closes_on: Optional[date] = None
    delivery_mode: str
    location: Optional[str] = None


class PublicProgramme(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    department_name: Optional[str] = None
    level: Optional[str] = None
    duration_weeks: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    learning_outcomes: Optional[str] = None
    eligibility_requirements: Optional[str] = None
    cohorts: List[PublicCohort] = []


class PublicApplicationRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=50)
    cohort_id: str = Field(..., min_length=1, max_length=36)
    motivation: str = Field(..., min_length=20, max_length=4000)

    @field_validator("full_name", "motivation", mode="before")
    @classmethod
    def trim_required_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("phone", mode="before")
    @classmethod
    def trim_phone(cls, value):
        if isinstance(value, str):
            return value.strip() or None
        return value


class PublicApplicationReceipt(BaseModel):
    reference: str
    programme_name: str
    cohort_name: str
    submitted_at: datetime


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _open_cohort_filters(today: date):
    return (
        ProgrammeCohort.status == "enrolling",
        or_(
            ProgrammeCohort.enrolment_opens_on.is_(None),
            ProgrammeCohort.enrolment_opens_on <= today,
        ),
        or_(
            ProgrammeCohort.enrolment_closes_on.is_(None),
            ProgrammeCohort.enrolment_closes_on >= today,
        ),
    )


async def _public_programmes(
    db: AsyncSession,
    *,
    programme_id: Optional[str] = None,
) -> List[PublicProgramme]:
    today = _today()
    query = (
        select(Programme)
        .options(selectinload(Programme.department))
        .where(Programme.status == "active")
        .order_by(Programme.name.asc())
    )
    if programme_id:
        query = query.where(Programme.id == programme_id)

    programmes = (await db.execute(query)).scalars().all()
    if not programmes:
        return []

    programme_ids = [programme.id for programme in programmes]
    cohorts = (
        await db.execute(
            select(ProgrammeCohort)
            .where(
                ProgrammeCohort.programme_id.in_(programme_ids),
                *_open_cohort_filters(today),
            )
            .order_by(ProgrammeCohort.start_date, ProgrammeCohort.name)
        )
    ).scalars().all()

    cohorts_by_programme = defaultdict(list)
    for cohort in cohorts:
        cohorts_by_programme[cohort.programme_id].append(
            PublicCohort(
                id=str(cohort.id),
                name=cohort.name,
                code=cohort.code,
                start_date=cohort.start_date,
                end_date=cohort.end_date,
                enrolment_opens_on=cohort.enrolment_opens_on,
                enrolment_closes_on=cohort.enrolment_closes_on,
                delivery_mode=cohort.delivery_mode,
                location=cohort.location,
            )
        )

    return [
        PublicProgramme(
            id=str(programme.id),
            name=programme.name,
            code=programme.code,
            description=programme.description,
            department_name=(
                programme.department.name if programme.department else None
            ),
            level=programme.level,
            duration_weeks=programme.duration_weeks,
            start_date=programme.start_date,
            end_date=programme.end_date,
            learning_outcomes=programme.learning_outcomes,
            eligibility_requirements=programme.eligibility_requirements,
            cohorts=cohorts_by_programme[programme.id],
        )
        for programme in programmes
        if cohorts_by_programme[programme.id]
    ]


@router.get("", response_model=List[PublicProgramme])
async def list_open_programmes(
    db: AsyncSession = Depends(get_db),
):
    """Return only active programmes with cohorts currently accepting applications."""
    return await _public_programmes(db)


@router.get("/{programme_id}", response_model=PublicProgramme)
async def get_open_programme(
    programme_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Return a public-safe programme detail or 404 when it is not open."""
    programmes = await _public_programmes(db, programme_id=programme_id)
    if not programmes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Programme is not currently accepting applications",
        )
    return programmes[0]


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        first = forwarded_for.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"


@router.post(
    "/{programme_id}/applications",
    response_model=PublicApplicationReceipt,
    status_code=status.HTTP_201_CREATED,
)
async def submit_public_application(
    programme_id: str,
    payload: PublicApplicationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    key = f"programme-application:{_client_ip(request)}"
    retry_after = await application_limiter.retry_after(
        key,
        limit=APPLICATION_IP_LIMIT,
        window_seconds=APPLICATION_IP_WINDOW_SECONDS,
    )
    if retry_after:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many applications submitted. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )
    await application_limiter.record(
        key,
        window_seconds=APPLICATION_IP_WINDOW_SECONDS,
    )

    today = _today()
    programme = (
        await db.execute(
            select(Programme).where(
                Programme.id == programme_id,
                Programme.status == "active",
            )
        )
    ).scalar_one_or_none()
    cohort = (
        await db.execute(
            select(ProgrammeCohort).where(
                ProgrammeCohort.id == payload.cohort_id,
                ProgrammeCohort.programme_id == programme_id,
                *_open_cohort_filters(today),
            )
        )
    ).scalar_one_or_none()

    if programme is None or cohort is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Programme or cohort is not currently accepting applications",
        )

    existing = await db.execute(
        select(ProgrammeApplication.id).where(
            ProgrammeApplication.cohort_id == cohort.id,
            ProgrammeApplication.applicant_email
            == str(payload.email).strip().lower(),
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An application from this email already exists for this cohort",
        )

    enrolled_count = await db.scalar(
        select(func.count(CohortEnrolment.id)).where(
            CohortEnrolment.cohort_id == cohort.id,
            CohortEnrolment.status != "withdrawn",
        )
    )
    if cohort.capacity is not None and (enrolled_count or 0) >= cohort.capacity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This cohort has reached capacity",
        )

    application = ProgrammeApplication(
        reference=f"SH-{today.year}-{secrets.token_hex(8).upper()}",
        programme_id=programme.id,
        cohort_id=cohort.id,
        applicant_name=payload.full_name,
        applicant_email=str(payload.email).strip().lower(),
        applicant_phone=payload.phone,
        motivation=payload.motivation,
    )
    db.add(application)

    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        original_error = str(error.orig).lower()
        is_duplicate_email = (
            "uq_programme_applications_cohort_email" in original_error
            or (
                "programme_applications.cohort_id" in original_error
                and "programme_applications.applicant_email" in original_error
            )
        )
        if is_duplicate_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An application from this email already exists for this cohort",
            ) from error
        raise

    await db.refresh(application)
    return PublicApplicationReceipt(
        reference=application.reference,
        programme_name=programme.name,
        cohort_name=cohort.name,
        submitted_at=application.created_at or datetime.now(timezone.utc),
    )
