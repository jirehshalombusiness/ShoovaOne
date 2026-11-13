from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import Permissions, require_permission
from app.models.sql.core.organisation import Programme
from app.models.sql.core.user import Person, User
from app.models.sql.programmes.academics import (
    CohortEnrolment,
    ProgrammeCohort,
)
from app.models.sql.programmes.public_application import ProgrammeApplication
from app.services.core.audit_service import AuditService
from app.services.core.permission_service import PermissionService

router = APIRouter()

APPLICATION_STATUSES = {
    "submitted",
    "in_review",
    "accepted",
    "declined",
    "enrolled",
}
APPLICATION_STATUS_TRANSITIONS = {
    "submitted": {"in_review", "accepted", "declined"},
    "in_review": {"submitted", "accepted", "declined"},
    "accepted": {"in_review", "enrolled"},
    "declined": {"in_review"},
    "enrolled": set(),
}


class ProgrammeApplicationItem(BaseModel):
    id: str
    reference: str
    programme_id: str
    programme_name: str
    cohort_id: str
    cohort_name: str
    applicant_name: str
    applicant_email: str
    applicant_phone: Optional[str] = None
    motivation: str
    status: str
    submitted_at: datetime


class ApplicationStatusRequest(BaseModel):
    status: str = Field(..., max_length=20)

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        if value not in APPLICATION_STATUSES:
            raise ValueError(f"must be one of {sorted(APPLICATION_STATUSES)}")
        return value


async def _can_manage(db: AsyncSession, user: User) -> bool:
    return await PermissionService.has_permission(
        db, user.id, Permissions.PROGRAMMES_EDIT
    )


async def _load_programme(db: AsyncSession, programme_id: str) -> Programme:
    programme = await db.scalar(
        select(Programme).where(Programme.id == programme_id)
    )
    if programme is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Programme not found",
        )
    return programme


async def _load_application(
    db: AsyncSession,
    application_id: str,
    programme_id: str,
) -> ProgrammeApplication:
    application = await db.scalar(
        select(ProgrammeApplication).where(
            ProgrammeApplication.id == application_id,
            ProgrammeApplication.programme_id == programme_id,
        )
    )
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )
    return application


def _item(
    application: ProgrammeApplication,
    programme_name: str,
    cohort_name: str,
) -> ProgrammeApplicationItem:
    return ProgrammeApplicationItem(
        id=str(application.id),
        reference=application.reference,
        programme_id=str(application.programme_id),
        programme_name=programme_name,
        cohort_id=str(application.cohort_id),
        cohort_name=cohort_name,
        applicant_name=application.applicant_name,
        applicant_email=application.applicant_email,
        applicant_phone=application.applicant_phone,
        motivation=application.motivation,
        status=application.status,
        submitted_at=application.created_at or datetime.now(timezone.utc),
    )


@router.get(
    "/{programme_id}/applications",
    response_model=List[ProgrammeApplicationItem],
)
async def list_programme_applications(
    programme_id: str,
    status_filter: Optional[str] = Query(None, alias="status"),
    cohort_id: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.PROGRAMMES_VIEW)),
):
    programme = await _load_programme(db, programme_id)
    if programme.status == "draft" and not await _can_manage(db, current_user):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Programme not found",
        )

    if status_filter and status_filter not in APPLICATION_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"status must be one of {sorted(APPLICATION_STATUSES)}",
        )

    query = (
        select(ProgrammeApplication, ProgrammeCohort.name)
        .join(
            ProgrammeCohort,
            ProgrammeCohort.id == ProgrammeApplication.cohort_id,
        )
        .where(ProgrammeApplication.programme_id == programme.id)
        .order_by(ProgrammeApplication.created_at.desc())
        .limit(limit)
    )
    if status_filter:
        query = query.where(ProgrammeApplication.status == status_filter)
    if cohort_id:
        query = query.where(ProgrammeApplication.cohort_id == cohort_id)

    rows = (await db.execute(query)).all()
    return [
        _item(application, programme.name, cohort_name)
        for application, cohort_name in rows
    ]


@router.patch(
    "/{programme_id}/applications/{application_id}",
    response_model=ProgrammeApplicationItem,
)
async def review_programme_application(
    programme_id: str,
    application_id: str,
    payload: ApplicationStatusRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.PROGRAMMES_EDIT)),
):
    programme = await _load_programme(db, programme_id)
    application = await _load_application(db, application_id, programme.id)

    allowed = APPLICATION_STATUS_TRANSITIONS.get(application.status, set())
    if payload.status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot change an application from {application.status} "
                f"to {payload.status}"
            ),
        )

    previous = application.status
    application.status = payload.status

    cohort = await db.scalar(
        select(ProgrammeCohort).where(
            ProgrammeCohort.id == application.cohort_id
        )
    )

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PROGRAMME_APPLICATION_STATUS_CHANGED",
        entity_type="programme_application",
        entity_id=application.id,
        description=(
            f"Application {application.reference} moved from {previous} "
            f"to {payload.status}"
        ),
        old_values={"status": previous},
        new_values={"status": payload.status},
    )

    await db.commit()
    await db.refresh(application)

    return _item(
        application,
        programme.name,
        cohort.name if cohort else "Unknown cohort",
    )


def _split_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split()
    if not parts:
        return "Applicant", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


@router.post(
    "/{programme_id}/applications/{application_id}/enrol",
    response_model=ProgrammeApplicationItem,
)
async def enrol_accepted_application(
    programme_id: str,
    application_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.PROGRAMMES_EDIT)),
):
    programme = await _load_programme(db, programme_id)
    application = await _load_application(db, application_id, programme.id)

    if application.status != "accepted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only accepted applications can be enrolled",
        )

    cohort = await db.scalar(
        select(ProgrammeCohort).where(
            ProgrammeCohort.id == application.cohort_id
        )
    )
    if cohort is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cohort not found",
        )
    if cohort.status in {"completed", "cancelled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This cohort is closed for enrolment",
        )

    email = application.applicant_email.strip().lower()
    person = await db.scalar(
        select(Person).where(func.lower(Person.email) == email)
    )
    person_created = False
    if person is None:
        first_name, last_name = _split_name(application.applicant_name)
        person = Person(
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=application.applicant_phone,
            type="learner",
            status="active",
        )
        db.add(person)
        await db.flush()
        person_created = True

    existing = await db.scalar(
        select(CohortEnrolment).where(
            CohortEnrolment.cohort_id == cohort.id,
            CohortEnrolment.person_id == person.id,
        )
    )
    if existing is not None:
        if existing.status != "withdrawn":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This applicant is already enrolled on the cohort",
            )
        existing.status = "enrolled"
        existing.enrolled_on = date.today()
    else:
        occupied = await db.scalar(
            select(func.count(CohortEnrolment.id)).where(
                CohortEnrolment.cohort_id == cohort.id,
                CohortEnrolment.status != "withdrawn",
            )
        )
        if cohort.capacity is not None and (occupied or 0) >= cohort.capacity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Cohort capacity is {cohort.capacity}; "
                    f"{occupied} place(s) already taken"
                ),
            )
        db.add(
            CohortEnrolment(
                cohort_id=cohort.id,
                person_id=person.id,
                status="enrolled",
                enrolled_on=date.today(),
            )
        )

    application.status = "enrolled"

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PROGRAMME_APPLICATION_ENROLLED",
        entity_type="programme_application",
        entity_id=application.id,
        description=(
            f"Enrolled {application.applicant_name} on {cohort.name} from "
            f"application {application.reference}"
        ),
        new_values={
            "status": "enrolled",
            "person_id": str(person.id),
            "person_created": person_created,
        },
    )

    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Could not enrol this applicant — they may already be "
                "enrolled or the email address is already in use"
            ),
        ) from error

    await db.refresh(application)

    return _item(application, programme.name, cohort.name)
