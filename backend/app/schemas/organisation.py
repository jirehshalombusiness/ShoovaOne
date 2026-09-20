
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# ORGANISATION
# ============================================================

class OrganisationCreate(BaseModel):
    name: str = Field(
        ...,
        min_length=2,
        max_length=200,
    )
    code: Optional[str] = Field(
        None,
        max_length=50,
    )
    description: Optional[str] = None


class OrganisationUpdate(BaseModel):
    name: Optional[str] = Field(
        None,
        min_length=2,
        max_length=200,
    )
    code: Optional[str] = Field(
        None,
        max_length=50,
    )
    description: Optional[str] = None
    status: Optional[str] = Field(
        None,
        max_length=30,
    )


class OrganisationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime


# ============================================================
# DEPARTMENT
# ============================================================

class DepartmentCreate(BaseModel):
    """
    Organisation is intentionally NOT included here.

    The organisation is determined by the route:

        POST /organisations/{organisation_id}/departments
    """

    name: str = Field(
        ...,
        min_length=2,
        max_length=200,
    )
    code: Optional[str] = Field(
        None,
        max_length=50,
    )
    description: Optional[str] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(
        None,
        min_length=2,
        max_length=200,
    )
    code: Optional[str] = Field(
        None,
        max_length=50,
    )
    description: Optional[str] = None
    status: Optional[str] = Field(
        None,
        max_length=30,
    )


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organisation_id: str
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime


# ============================================================
# PROGRAMME
# ============================================================

class ProgrammeCreate(BaseModel):
    """
    Organisation is intentionally NOT included here.

    The organisation is determined by the route:

        POST /organisations/{organisation_id}/programmes
    """

    name: str = Field(
        ...,
        min_length=2,
        max_length=200,
    )
    code: Optional[str] = Field(
        None,
        max_length=50,
    )
    description: Optional[str] = None

    # A programme may be organisation-wide,
    # so department_id remains optional.
    department_id: Optional[str] = None

    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ProgrammeUpdate(BaseModel):
    name: Optional[str] = Field(
        None,
        min_length=2,
        max_length=200,
    )
    code: Optional[str] = Field(
        None,
        max_length=50,
    )
    description: Optional[str] = None
    department_id: Optional[str] = None
    status: Optional[str] = Field(
        None,
        max_length=30,
    )
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ProgrammeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organisation_id: str
    department_id: Optional[str] = None
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    status: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

