from datetime import date
from decimal import Decimal
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_permission, Permissions, get_current_active_user
from app.models.sql.user import User, Person
from app.models.sql.employment_contract import EmploymentContract
from app.models.sql.document import Document
from app.services import approval_service
from app.services.audit_service import AuditService


router = APIRouter()


# ============================================================
# SCHEMAS
# ============================================================

class ContractPerson(BaseModel):
    id: str
    first_name: str
    last_name: str
    profile_image_url: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    employee_number: Optional[str] = None


class ContractResponse(BaseModel):
    id: str
    person_id: str
    person: ContractPerson
    contract_type: str
    position: Optional[str] = None
    department: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None
    reports_to_id: Optional[str] = None
    reports_to_name: Optional[str] = None
    compensation_amount: Optional[float] = None
    compensation_currency: Optional[str] = None
    compensation_frequency: Optional[str] = None
    document_id: Optional[str] = None
    is_current: bool
    notes: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None


class ContractListResponse(BaseModel):
    items: List[ContractResponse]
    total: int
    current: int
    ending_soon: int


class ContractCreate(BaseModel):
    person_id: str
    contract_type: str = Field(..., max_length=50)
    position: Optional[str] = Field(None, max_length=200)
    department: Optional[str] = Field(None, max_length=200)
    start_date: date
    end_date: Optional[date] = None
    reports_to_id: Optional[str] = None
    compensation_amount: Optional[float] = Field(None, ge=0)
    compensation_currency: Optional[str] = Field("GHS", max_length=3)
    compensation_frequency: Optional[str] = Field("monthly", max_length=20)
    document_id: Optional[str] = None
    notes: Optional[str] = None
    is_current: bool = True


class ContractUpdate(BaseModel):
    contract_type: Optional[str] = Field(None, max_length=50)
    position: Optional[str] = Field(None, max_length=200)
    department: Optional[str] = Field(None, max_length=200)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    reports_to_id: Optional[str] = None
    compensation_amount: Optional[float] = Field(None, ge=0)
    compensation_currency: Optional[str] = Field(None, max_length=3)
    compensation_frequency: Optional[str] = Field(None, max_length=20)
    document_id: Optional[str] = None
    notes: Optional[str] = None
    is_current: Optional[bool] = None


class ContractRenewRequest(BaseModel):
    new_start_date: date
    new_end_date: Optional[date] = None
    new_contract_type: Optional[str] = None
    new_compensation_amount: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None


class ContractStats(BaseModel):
    total: int
    active: int
    expiring_30: int
    expiring_60: int
    expiring_90: int
    by_type: dict


# ============================================================
# HELPERS
# ============================================================

def _iso(d) -> Optional[str]:
    if d is None:
        return None
    return d.isoformat()


def _person_name(p: Optional[Person]) -> Optional[str]:
    if not p:
        return None
    return f"{p.first_name} {p.last_name}".strip()


async def _person_bundle(
    db: AsyncSession,
    person_ids: List[str],
) -> dict[str, Person]:
    if not person_ids:
        return {}
    result = await db.execute(
        select(Person).where(Person.id.in_(person_ids))
    )
    return {p.id: p for p in result.scalars().all()}


async def _manager_names(
    db: AsyncSession,
    manager_ids: List[str],
) -> dict[str, str]:
    if not manager_ids:
        return {}
    result = await db.execute(
        select(Person.id, Person.first_name, Person.last_name)
        .where(Person.id.in_(manager_ids))
    )
    return {row[0]: f"{row[1]} {row[2]}".strip() for row in result.all()}


def _serialize_contract(
    c: EmploymentContract,
    person: Optional[Person],
    manager_name: Optional[str],
) -> ContractResponse:
    return ContractResponse(
        id=c.id,
        person_id=c.person_id,
        person=ContractPerson(
            id=person.id if person else "",
            first_name=person.first_name if person else "",
            last_name=person.last_name if person else "",
            profile_image_url=person.profile_image_url if person else None,
            job_title=person.job_title if person else None,
            department=person.department if person else None,
            employee_number=person.employee_number if person else None,
        ),
        contract_type=c.contract_type,
        position=c.position,
        department=c.department,
        start_date=c.start_date.isoformat(),
        end_date=_iso(c.end_date),
        reports_to_id=c.reports_to_id,
        reports_to_name=manager_name,
        compensation_amount=(
            float(c.compensation_amount)
            if c.compensation_amount is not None
            else None
        ),
        compensation_currency=c.compensation_currency,
        compensation_frequency=c.compensation_frequency,
        document_id=c.document_id,
        is_current=bool(c.is_current),
        notes=c.notes,
        created_at=c.created_at.isoformat() if c.created_at else "",
        updated_at=_iso(c.updated_at),
    )


# ============================================================
# LIST
# ============================================================

@router.get("", response_model=ContractListResponse)
async def list_contracts(
    person_id: Optional[str] = None,
    contract_type: Optional[str] = None,
    is_current: Optional[bool] = None,
    expiring_in_days: Optional[int] = Query(None, ge=1, le=365),
    search: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_EMPLOYMENT)),
):
    """
    All employment contracts. Requires hr.view_employment.
    """
    filters = []

    if person_id:
        filters.append(EmploymentContract.person_id == person_id)
    if contract_type:
        filters.append(EmploymentContract.contract_type == contract_type)
    if is_current is not None:
        filters.append(EmploymentContract.is_current.is_(is_current))

    if expiring_in_days is not None:
        horizon = date.today() + __import__("datetime").timedelta(days=expiring_in_days)
        filters.append(
            EmploymentContract.end_date.is_not(None)
        )
        filters.append(EmploymentContract.end_date <= horizon)
        filters.append(EmploymentContract.end_date >= date.today())

    if search:
        pattern = f"%{search}%"
        filters.append(
            EmploymentContract.person_id.in_(
                select(Person.id).where(
                    or_(
                        Person.first_name.ilike(pattern),
                        Person.last_name.ilike(pattern),
                        Person.email.ilike(pattern),
                        Person.employee_number.ilike(pattern),
                    )
                )
            )
        )

    count_query = select(func.count(EmploymentContract.id))
    if filters:
        count_query = count_query.where(*filters)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    current_result = await db.execute(
        select(func.count(EmploymentContract.id)).where(
            EmploymentContract.is_current.is_(True)
        )
    )
    current_count = current_result.scalar() or 0

    thirty = date.today() + __import__("datetime").timedelta(days=30)
    ending_soon_result = await db.execute(
        select(func.count(EmploymentContract.id)).where(
            EmploymentContract.is_current.is_(True),
            EmploymentContract.end_date.is_not(None),
            EmploymentContract.end_date <= thirty,
            EmploymentContract.end_date >= date.today(),
        )
    )
    ending_soon = ending_soon_result.scalar() or 0

    query = select(EmploymentContract)
    if filters:
        query = query.where(*filters)
    query = (
        query
        .order_by(
            EmploymentContract.is_current.desc(),
            EmploymentContract.start_date.desc(),
        )
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(query)
    contracts = list(result.scalars().all())

    persons = await _person_bundle(db, [c.person_id for c in contracts])
    managers = await _manager_names(
        db, [c.reports_to_id for c in contracts if c.reports_to_id]
    )

    return ContractListResponse(
        items=[
            _serialize_contract(
                c,
                persons.get(c.person_id),
                managers.get(c.reports_to_id) if c.reports_to_id else None,
            )
            for c in contracts
        ],
        total=total,
        current=current_count,
        ending_soon=ending_soon,
    )


# ============================================================
# STATS
# ============================================================

@router.get("/stats", response_model=ContractStats)
async def contract_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_EMPLOYMENT)),
):
    today = date.today()

    total_result = await db.execute(select(func.count(EmploymentContract.id)))
    total = total_result.scalar() or 0

    active_result = await db.execute(
        select(func.count(EmploymentContract.id)).where(
            EmploymentContract.is_current.is_(True),
            or_(
                EmploymentContract.end_date.is_(None),
                EmploymentContract.end_date >= today,
            ),
        )
    )
    active = active_result.scalar() or 0

    from datetime import timedelta

    async def _expiring(days: int) -> int:
        horizon = today + timedelta(days=days)
        r = await db.execute(
            select(func.count(EmploymentContract.id)).where(
                EmploymentContract.is_current.is_(True),
                EmploymentContract.end_date.is_not(None),
                EmploymentContract.end_date >= today,
                EmploymentContract.end_date <= horizon,
            )
        )
        return r.scalar() or 0

    by_type_result = await db.execute(
        select(EmploymentContract.contract_type, func.count(EmploymentContract.id))
        .where(EmploymentContract.is_current.is_(True))
        .group_by(EmploymentContract.contract_type)
    )
    by_type = {row[0]: row[1] for row in by_type_result.all()}

    return ContractStats(
        total=total,
        active=active,
        expiring_30=await _expiring(30),
        expiring_60=await _expiring(60),
        expiring_90=await _expiring(90),
        by_type=by_type,
    )


# ============================================================
# DETAIL
# ============================================================

@router.get("/{contract_id}", response_model=ContractResponse)
async def get_contract(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_EMPLOYMENT)),
):
    result = await db.execute(
        select(EmploymentContract).where(EmploymentContract.id == contract_id)
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    persons = await _person_bundle(db, [contract.person_id])
    managers = await _manager_names(
        db, [contract.reports_to_id] if contract.reports_to_id else []
    )

    return _serialize_contract(
        contract,
        persons.get(contract.person_id),
        managers.get(contract.reports_to_id) if contract.reports_to_id else None,
    )


# ============================================================
# CREATE
# ============================================================

@router.post(
    "",
    response_model=ContractResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_contract(
    payload: ContractCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_EMPLOYMENT)),
):
    """
    Create a new contract.

    If is_current=True, any existing current contract for the same
    person is closed first.
    """
    person_result = await db.execute(
        select(Person).where(
            Person.id == payload.person_id,
            Person.deleted_at.is_(None),
        )
    )
    person = person_result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    if payload.reports_to_id:
        if payload.reports_to_id == payload.person_id:
            raise HTTPException(status_code=400, detail="A person cannot report to themselves")
        mgr_result = await db.execute(
            select(Person).where(Person.id == payload.reports_to_id)
        )
        if not mgr_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Manager not found")

    if payload.end_date and payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="end_date must be after start_date")

    # If is_current=True, close existing current contract
    if payload.is_current:
        existing_result = await db.execute(
            select(EmploymentContract).where(
                EmploymentContract.person_id == payload.person_id,
                EmploymentContract.is_current.is_(True),
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            existing.is_current = False
            if not existing.end_date:
                existing.end_date = payload.start_date

    contract = EmploymentContract(
        id=str(uuid.uuid4()),
        person_id=payload.person_id,
        contract_type=payload.contract_type,
        position=payload.position,
        department=payload.department,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reports_to_id=payload.reports_to_id,
        compensation_amount=(
            Decimal(str(payload.compensation_amount))
            if payload.compensation_amount is not None
            else None
        ),
        compensation_currency=payload.compensation_currency or "GHS",
        compensation_frequency=payload.compensation_frequency or "monthly",
        document_id=payload.document_id,
        is_current=payload.is_current,
        notes=payload.notes,
    )
    db.add(contract)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="CONTRACT_CREATED",
        entity_type="employment_contract",
        entity_id=contract.id,
        description=f"Created contract for {person.first_name} {person.last_name}",
        new_values={
            "contract_type": payload.contract_type,
            "start_date": payload.start_date.isoformat(),
            "is_current": payload.is_current,
        },
    )

    await db.commit()
    await db.refresh(contract)

    persons = await _person_bundle(db, [contract.person_id])
    managers = await _manager_names(
        db, [contract.reports_to_id] if contract.reports_to_id else []
    )

    return _serialize_contract(
        contract,
        persons.get(contract.person_id),
        managers.get(contract.reports_to_id) if contract.reports_to_id else None,
    )


# ============================================================
# UPDATE
# ============================================================

@router.patch("/{contract_id}", response_model=ContractResponse)
async def update_contract(
    contract_id: str,
    payload: ContractUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_EMPLOYMENT)),
):
    result = await db.execute(
        select(EmploymentContract).where(EmploymentContract.id == contract_id)
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="No changes supplied")

    if "reports_to_id" in changes and changes["reports_to_id"]:
        if changes["reports_to_id"] == contract.person_id:
            raise HTTPException(status_code=400, detail="A person cannot report to themselves")
        mgr_result = await db.execute(
            select(Person).where(Person.id == changes["reports_to_id"])
        )
        if not mgr_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Manager not found")

    old_values = {}
    for key, value in changes.items():
        old = getattr(contract, key, None)
        old_values[key] = str(old) if old is not None else None

        if key == "compensation_amount" and value is not None:
            value = Decimal(str(value))

        setattr(contract, key, value)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="CONTRACT_UPDATED",
        entity_type="employment_contract",
        entity_id=contract.id,
        description="Updated employment contract",
        old_values=old_values,
        new_values={k: str(v) if v is not None else None for k, v in changes.items()},
    )

    await db.commit()
    await db.refresh(contract)

    persons = await _person_bundle(db, [contract.person_id])
    managers = await _manager_names(
        db, [contract.reports_to_id] if contract.reports_to_id else []
    )

    return _serialize_contract(
        contract,
        persons.get(contract.person_id),
        managers.get(contract.reports_to_id) if contract.reports_to_id else None,
    )


# ============================================================
# RENEW
# ============================================================

@router.post("/{contract_id}/renew", response_model=ContractResponse)
async def renew_contract(
    contract_id: str,
    payload: ContractRenewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_EMPLOYMENT)),
):
    """
    Renew a contract: close the current one and open a new one.
    The new contract inherits anything not overridden.
    """
    result = await db.execute(
        select(EmploymentContract).where(EmploymentContract.id == contract_id)
    )
    old_contract = result.scalar_one_or_none()
    if not old_contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Close old
    old_contract.is_current = False
    if not old_contract.end_date:
        old_contract.end_date = payload.new_start_date

    new_contract = EmploymentContract(
        id=str(uuid.uuid4()),
        person_id=old_contract.person_id,
        contract_type=payload.new_contract_type or old_contract.contract_type,
        position=old_contract.position,
        department=old_contract.department,
        start_date=payload.new_start_date,
        end_date=payload.new_end_date,
        reports_to_id=old_contract.reports_to_id,
        compensation_amount=(
            Decimal(str(payload.new_compensation_amount))
            if payload.new_compensation_amount is not None
            else old_contract.compensation_amount
        ),
        compensation_currency=old_contract.compensation_currency,
        compensation_frequency=old_contract.compensation_frequency,
        document_id=None,
        is_current=True,
        notes=payload.notes,
    )
    db.add(new_contract)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="CONTRACT_RENEWED",
        entity_type="employment_contract",
        entity_id=new_contract.id,
        description=f"Renewed contract (replaces {old_contract.id})",
        old_values={"previous_contract_id": old_contract.id},
        new_values={
            "start_date": payload.new_start_date.isoformat(),
            "end_date": _iso(payload.new_end_date),
        },
    )

    await db.commit()
    await db.refresh(new_contract)

    persons = await _person_bundle(db, [new_contract.person_id])
    managers = await _manager_names(
        db, [new_contract.reports_to_id] if new_contract.reports_to_id else []
    )

    return _serialize_contract(
        new_contract,
        persons.get(new_contract.person_id),
        managers.get(new_contract.reports_to_id) if new_contract.reports_to_id else None,
    )


# ============================================================
# TERMINATE
# ============================================================

@router.post("/{contract_id}/terminate", response_model=ContractResponse)
async def terminate_contract(
    contract_id: str,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_EMPLOYMENT)),
):
    """
    Close a contract without creating a new one.
    Use this when someone is leaving.
    """
    result = await db.execute(
        select(EmploymentContract).where(EmploymentContract.id == contract_id)
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    contract.is_current = False
    contract.end_date = end_date or date.today()

    await AuditService.log(
        db=db,
        actor=current_user,
        action="CONTRACT_TERMINATED",
        entity_type="employment_contract",
        entity_id=contract.id,
        description="Closed contract",
        new_values={"end_date": contract.end_date.isoformat()},
    )

    await db.commit()
    await db.refresh(contract)

    persons = await _person_bundle(db, [contract.person_id])
    managers = await _manager_names(
        db, [contract.reports_to_id] if contract.reports_to_id else []
    )

    return _serialize_contract(
        contract,
        persons.get(contract.person_id),
        managers.get(contract.reports_to_id) if contract.reports_to_id else None,
    )