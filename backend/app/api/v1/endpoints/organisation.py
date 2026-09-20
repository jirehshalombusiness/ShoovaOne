
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_permission, Permissions

from app.models.sql.organisation import (
    Organisation,
    Department,
    Programme,
)

from app.schemas.organisation import (
    OrganisationCreate,
    OrganisationUpdate,
    OrganisationResponse,
    DepartmentCreate,
    DepartmentUpdate,
    DepartmentResponse,
    ProgrammeCreate,
    ProgrammeUpdate,
    ProgrammeResponse,
)


router = APIRouter()


# ============================================================
# HELPERS
# ============================================================

def parse_uuid(value: str, field_name: str) -> UUID:
    """
    Convert a string to UUID and return a clean 400 error
    if the value is not a valid UUID.
    """
    try:
        return UUID(value)
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {field_name}",
        )


# ============================================================
# ORGANISATIONS
# ============================================================

@router.get(
    "/",
    response_model=List[OrganisationResponse],
)
async def list_organisations(
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
    ),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.ORGANISATION_VIEW)
    ),
):
    query = select(Organisation).order_by(
        Organisation.name.asc()
    )

    if status_filter:
        query = query.where(
            Organisation.status == status_filter
        )

    result = await db.execute(query)
    organisations = result.scalars().all()

    return [
        OrganisationResponse(
            id=str(item.id),
            name=item.name,
            code=item.code,
            description=item.description,
            status=item.status,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in organisations
    ]


@router.get(
    "/{organisation_id}",
    response_model=OrganisationResponse,
)
async def get_organisation(
    organisation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.ORGANISATION_VIEW)
    ),
):
    organisation_uuid = parse_uuid(
        organisation_id,
        "organisation_id",
    )

    result = await db.execute(
        select(Organisation).where(
            Organisation.id == organisation_uuid
        )
    )

    organisation = result.scalar_one_or_none()

    if not organisation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found",
        )

    return OrganisationResponse(
        id=str(organisation.id),
        name=organisation.name,
        code=organisation.code,
        description=organisation.description,
        status=organisation.status,
        created_at=organisation.created_at,
        updated_at=organisation.updated_at,
    )


@router.post(
    "/",
    response_model=OrganisationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_organisation(
    payload: OrganisationCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.ORGANISATION_MANAGE)
    ),
):
    # Prevent duplicate organisation codes
    if payload.code:
        existing = await db.execute(
            select(Organisation).where(
                Organisation.code == payload.code
            )
        )

        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Organisation code already exists",
            )

    organisation = Organisation(
        name=payload.name,
        code=payload.code,
        description=payload.description,
    )

    db.add(organisation)
    await db.commit()
    await db.refresh(organisation)

    return OrganisationResponse(
        id=str(organisation.id),
        name=organisation.name,
        code=organisation.code,
        description=organisation.description,
        status=organisation.status,
        created_at=organisation.created_at,
        updated_at=organisation.updated_at,
    )


# ============================================================
# DEPARTMENTS
# ============================================================

@router.get(
    "/{organisation_id}/departments",
    response_model=List[DepartmentResponse],
)
async def list_departments(
    organisation_id: str,
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
    ),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.ORGANISATION_VIEW)
    ),
):
    organisation_uuid = parse_uuid(
        organisation_id,
        "organisation_id",
    )

    # Make sure organisation exists
    organisation_result = await db.execute(
        select(Organisation).where(
            Organisation.id == organisation_uuid
        )
    )

    if not organisation_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found",
        )

    query = select(Department).where(
        Department.organisation_id == organisation_uuid
    )

    if status_filter:
        query = query.where(
            Department.status == status_filter
        )

    query = query.order_by(
        Department.name.asc()
    )

    result = await db.execute(query)
    departments = result.scalars().all()

    return [
        DepartmentResponse(
            id=str(item.id),
            organisation_id=str(item.organisation_id),
            name=item.name,
            code=item.code,
            description=item.description,
            status=item.status,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in departments
    ]


@router.post(
    "/{organisation_id}/departments",
    response_model=DepartmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_department(
    organisation_id: str,
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.ORGANISATION_MANAGE)
    ),
):
    organisation_uuid = parse_uuid(
        organisation_id,
        "organisation_id",
    )

    # Verify organisation
    organisation_result = await db.execute(
        select(Organisation).where(
            Organisation.id == organisation_uuid
        )
    )

    organisation = organisation_result.scalar_one_or_none()

    if not organisation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found",
        )

    # Prevent duplicate department code within organisation
    if payload.code:
        existing = await db.execute(
            select(Department).where(
                Department.organisation_id == organisation_uuid,
                Department.code == payload.code,
            )
        )

        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Department code already exists in this organisation",
            )

    department = Department(
        organisation_id=organisation_uuid,
        name=payload.name,
        code=payload.code,
        description=payload.description,
    )

    db.add(department)
    await db.commit()
    await db.refresh(department)

    return DepartmentResponse(
        id=str(department.id),
        organisation_id=str(department.organisation_id),
        name=department.name,
        code=department.code,
        description=department.description,
        status=department.status,
        created_at=department.created_at,
        updated_at=department.updated_at,
    )


# ============================================================
# PROGRAMMES
# ============================================================

@router.get(
    "/{organisation_id}/programmes",
    response_model=List[ProgrammeResponse],
)
async def list_programmes(
    organisation_id: str,
    department_id: Optional[str] = None,
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
    ),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.ORGANISATION_VIEW)
    ),
):
    organisation_uuid = parse_uuid(
        organisation_id,
        "organisation_id",
    )

    # Verify organisation
    organisation_result = await db.execute(
        select(Organisation).where(
            Organisation.id == organisation_uuid
        )
    )

    if not organisation_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found",
        )

    query = select(Programme).where(
        Programme.organisation_id == organisation_uuid
    )

    if department_id:
        department_uuid = parse_uuid(
            department_id,
            "department_id",
        )

        # Make sure department belongs to this organisation
        department_result = await db.execute(
            select(Department).where(
                Department.id == department_uuid,
                Department.organisation_id == organisation_uuid,
            )
        )

        if not department_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Department does not belong to this organisation",
            )

        query = query.where(
            Programme.department_id == department_uuid
        )

    if status_filter:
        query = query.where(
            Programme.status == status_filter
        )

    query = query.order_by(
        Programme.name.asc()
    )

    result = await db.execute(query)
    programmes = result.scalars().all()

    return [
        ProgrammeResponse(
            id=str(item.id),
            organisation_id=str(item.organisation_id),
            department_id=(
                str(item.department_id)
                if item.department_id
                else None
            ),
            name=item.name,
            code=item.code,
            description=item.description,
            status=item.status,
            start_date=item.start_date,
            end_date=item.end_date,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in programmes
    ]


@router.post(
    "/{organisation_id}/programmes",
    response_model=ProgrammeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_programme(
    organisation_id: str,
    payload: ProgrammeCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.ORGANISATION_MANAGE)
    ),
):
    organisation_uuid = parse_uuid(
        organisation_id,
        "organisation_id",
    )

    # ========================================================
    # VERIFY ORGANISATION
    # ========================================================

    organisation_result = await db.execute(
        select(Organisation).where(
            Organisation.id == organisation_uuid
        )
    )

    organisation = organisation_result.scalar_one_or_none()

    if not organisation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found",
        )

    # ========================================================
    # VERIFY DEPARTMENT
    # ========================================================

    department_uuid = None

    if payload.department_id:
        department_uuid = parse_uuid(
            payload.department_id,
            "department_id",
        )

        department_result = await db.execute(
            select(Department).where(
                Department.id == department_uuid,
                Department.organisation_id == organisation_uuid,
            )
        )

        department = department_result.scalar_one_or_none()

        if not department:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Department does not belong to this organisation",
            )

    # ========================================================
    # PREVENT DUPLICATE PROGRAMME CODE
    # ========================================================

    if payload.code:
        existing = await db.execute(
            select(Programme).where(
                Programme.organisation_id == organisation_uuid,
                Programme.code == payload.code,
            )
        )

        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Programme code already exists in this organisation",
            )

    # ========================================================
    # CREATE PROGRAMME
    # ========================================================

    programme = Programme(
        organisation_id=organisation_uuid,
        department_id=department_uuid,
        name=payload.name,
        code=payload.code,
        description=payload.description,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )

    db.add(programme)
    await db.commit()
    await db.refresh(programme)

    return ProgrammeResponse(
        id=str(programme.id),
        organisation_id=str(programme.organisation_id),
        department_id=(
            str(programme.department_id)
            if programme.department_id
            else None
        ),
        name=programme.name,
        code=programme.code,
        description=programme.description,
        status=programme.status,
        start_date=programme.start_date,
        end_date=programme.end_date,
        created_at=programme.created_at,
        updated_at=programme.updated_at,
    )

