from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func, or_, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_permission, Permissions, get_current_active_user
from app.models.sql.crm.opportunity import (
    Opportunity,
    OpportunityContributor,
    OpportunityActivity,
    OpportunityStageHistory,
)
from app.models.sql.core.user import User, Person
from app.models.sql.core.organisation import Organisation
from app.services.core.audit_service import AuditService
from app.services.crm import currency_service


router = APIRouter(dependencies=[Depends(currency_service.refresh_if_stale)])


# ============================================================
# CONSTANTS
# ============================================================

STAGES = [
    "discovery",
    "qualified",
    "proposal",
    "negotiation",
    "committed",
    "won",
    "lost",
]

OPEN_STAGES = ["discovery", "qualified", "proposal", "negotiation", "committed"]
CLOSED_STAGES = ["won", "lost"]

# Default probability per stage
STAGE_PROBABILITY = {
    "discovery": 10,
    "qualified": 25,
    "proposal": 50,
    "negotiation": 70,
    "committed": 90,
    "won": 100,
    "lost": 0,
}

# Required for "qualified" transition: 3 of 5 criteria must be true
QUALIFICATION_CRITERIA_KEYS = [
    "has_budget",
    "has_contact",
    "technically_qualified",
    "timing_ok",
    "strategically_aligned",
]


# ============================================================
# SCHEMAS
# ============================================================

class OrganisationBrief(BaseModel):
    id: str
    name: str
    type: Optional[str] = None
    country: Optional[str] = None


class PersonBrief(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    profile_image_url: Optional[str] = None


class OpportunitySummary(BaseModel):
    id: str
    title: str
    type: str
    organisation: OrganisationBrief
    primary_contact: Optional[PersonBrief] = None
    owner: PersonBrief
    amount: Optional[float] = None
    currency: str
    amount_base: Optional[float] = None
    expected_close_date: Optional[str] = None
    stage: str
    probability: int
    qualified: bool
    strategic_priority: str
    source: str
    created_at: str
    updated_at: Optional[str] = None


class OpportunityListResponse(BaseModel):
    items: List[OpportunitySummary]
    total: int
    open_count: int
    open_value: float
    by_stage: dict


class OpportunityContributorItem(BaseModel):
    id: str
    person: PersonBrief
    role: str


class OpportunityActivityItem(BaseModel):
    id: str
    type: str
    occurred_at: str
    summary: str
    next_step: Optional[str] = None
    author: Optional[PersonBrief] = None


class OpportunityStageHistoryItem(BaseModel):
    id: str
    from_stage: Optional[str] = None
    to_stage: str
    changed_by: Optional[PersonBrief] = None
    note: Optional[str] = None
    changed_at: str


class OpportunityDetail(BaseModel):
    id: str
    title: str
    type: str
    description: Optional[str] = None
    organisation: OrganisationBrief
    primary_contact: Optional[PersonBrief] = None
    owner: PersonBrief
    contributors: List[OpportunityContributorItem] = []

    amount: Optional[float] = None
    currency: str
    amount_base: Optional[float] = None
    amount_type: str
    expected_close_date: Optional[str] = None
    expected_start_date: Optional[str] = None
    expected_duration_months: Optional[int] = None
    decision_timeline: Optional[str] = None

    source: str
    referred_by: Optional[PersonBrief] = None
    campaign: Optional[str] = None

    alignment_notes: Optional[str] = None
    strategic_priority: str
    programme_id: Optional[str] = None

    competitors: List[str] = []
    competitive_advantage: Optional[str] = None
    known_risks: Optional[str] = None

    eligibility_check: str
    required_documents: List[str] = []
    compliance_notes: Optional[str] = None

    stage: str
    probability: int
    qualified: bool
    qualified_by: Optional[PersonBrief] = None
    qualified_at: Optional[str] = None
    qualification_notes: Optional[str] = None
    qualification_criteria: dict = {}

    won_at: Optional[str] = None
    won_by: Optional[PersonBrief] = None
    lost_at: Optional[str] = None
    lost_reason: Optional[str] = None
    lost_notes: Optional[str] = None

    attributed_to: Optional[PersonBrief] = None

    activities: List[OpportunityActivityItem] = []
    stage_history: List[OpportunityStageHistoryItem] = []

    created_at: str
    updated_at: Optional[str] = None


class OpportunityCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    type: str = Field(..., max_length=30)
    description: Optional[str] = None

    organisation_id: str
    primary_contact_id: Optional[str] = None

    amount: Optional[float] = Field(None, ge=0)
    currency: str = Field("GHS", max_length=3)
    amount_type: str = Field("one_time", max_length=30)
    expected_close_date: Optional[date] = None
    expected_start_date: Optional[date] = None
    expected_duration_months: Optional[int] = Field(None, ge=0, le=240)
    decision_timeline: Optional[str] = None

    source: str = Field("outbound", max_length=30)
    referred_by_id: Optional[str] = None
    campaign: Optional[str] = Field(None, max_length=100)

    owner_id: str

    alignment_notes: Optional[str] = None
    strategic_priority: str = Field("medium", max_length=20)
    programme_id: Optional[str] = None

    competitors: List[str] = Field(default_factory=list)
    competitive_advantage: Optional[str] = None
    known_risks: Optional[str] = None

    eligibility_check: str = Field("unknown", max_length=30)
    required_documents: List[str] = Field(default_factory=list)
    compliance_notes: Optional[str] = None

    @field_validator("type")
    @classmethod
    def valid_type(cls, v):
        allowed = {"grant", "partnership", "contract", "programme"}
        if v not in allowed:
            raise ValueError(f"type must be one of {sorted(allowed)}")
        return v

    @field_validator("strategic_priority")
    @classmethod
    def valid_priority(cls, v):
        allowed = {"high", "medium", "low"}
        if v not in allowed:
            raise ValueError(f"strategic_priority must be one of {sorted(allowed)}")
        return v

    @field_validator("source")
    @classmethod
    def valid_source(cls, v):
        allowed = {
            "inbound",
            "outbound",
            "referral",
            "event",
            "existing_relationship",
        }
        if v not in allowed:
            raise ValueError(f"source must be one of {sorted(allowed)}")
        return v

    @field_validator("eligibility_check")
    @classmethod
    def valid_eligibility(cls, v):
        allowed = {"yes", "no", "unknown"}
        if v not in allowed:
            raise ValueError(f"eligibility_check must be one of {sorted(allowed)}")
        return v

    @field_validator("currency")
    @classmethod
    def valid_currency(cls, v):
        code = currency_service.normalize_currency(v)
        if not currency_service.is_supported(code):
            raise ValueError(f"Unsupported currency: {v}")
        return code


# ============================================================
# HELPERS
# ============================================================

def _iso(d) -> Optional[str]:
    if d is None:
        return None
    return d.isoformat()


def _person_brief(p: Optional[Person]) -> Optional[PersonBrief]:
    if not p:
        return None
    return PersonBrief(
        id=p.id,
        first_name=p.first_name,
        last_name=p.last_name,
        email=p.email,
        profile_image_url=p.profile_image_url,
    )


def _org_brief(o: Optional[Organisation]) -> Optional[OrganisationBrief]:
    if not o:
        return None
    return OrganisationBrief(
        id=o.id,
        name=o.name,
        type=getattr(o, "type", None),
        country=getattr(o, "country", None),
    )


def _summary(o: Opportunity) -> OpportunitySummary:
    return OpportunitySummary(
        id=o.id,
        title=o.title,
        type=o.type,
        organisation=_org_brief(o.organisation) or OrganisationBrief(id="", name="Unknown"),
        primary_contact=_person_brief(o.primary_contact),
        owner=_person_brief(o.owner) or PersonBrief(id="", first_name="Unknown", last_name=""),
        amount=float(o.amount) if o.amount is not None else None,
        currency=o.currency,
        amount_base=currency_service.convert_to_base(o.amount, o.currency),
        expected_close_date=_iso(o.expected_close_date),
        stage=o.stage,
        probability=o.probability,
        qualified=o.qualified,
        strategic_priority=o.strategic_priority,
        source=o.source,
        created_at=o.created_at.isoformat() if o.created_at else "",
        updated_at=_iso(o.updated_at),
    )


def _detail(o: Opportunity) -> OpportunityDetail:
    activities = [
        OpportunityActivityItem(
            id=a.id,
            type=a.type,
            occurred_at=a.occurred_at.isoformat() if a.occurred_at else "",
            summary=a.summary,
            next_step=a.next_step,
            author=_person_brief(a.author),
        )
        for a in (o.activities or [])
    ]

    history = [
        OpportunityStageHistoryItem(
            id=h.id,
            from_stage=h.from_stage,
            to_stage=h.to_stage,
            changed_by=_person_brief(h.changed_by),
            note=h.note,
            changed_at=h.changed_at.isoformat() if h.changed_at else "",
        )
        for h in (o.stage_history or [])
    ]

    contributors = [
        OpportunityContributorItem(
            id=c.id,
            person=_person_brief(c.person) or PersonBrief(id="", first_name="Unknown", last_name=""),
            role=c.role,
        )
        for c in (o.contributors or [])
    ]

    return OpportunityDetail(
        id=o.id,
        title=o.title,
        type=o.type,
        description=o.description,
        organisation=_org_brief(o.organisation) or OrganisationBrief(id="", name="Unknown"),
        primary_contact=_person_brief(o.primary_contact),
        owner=_person_brief(o.owner) or PersonBrief(id="", first_name="Unknown", last_name=""),
        contributors=contributors,
        amount=float(o.amount) if o.amount is not None else None,
        currency=o.currency,
        amount_base=currency_service.convert_to_base(o.amount, o.currency),
        amount_type=o.amount_type,
        expected_close_date=_iso(o.expected_close_date),
        expected_start_date=_iso(o.expected_start_date),
        expected_duration_months=o.expected_duration_months,
        decision_timeline=o.decision_timeline,
        source=o.source,
        referred_by=_person_brief(o.referred_by) if hasattr(o, "referred_by") else None,
        campaign=o.campaign,
        alignment_notes=o.alignment_notes,
        strategic_priority=o.strategic_priority,
        programme_id=str(o.programme_id) if o.programme_id else None,
        competitors=o.competitors or [],
        competitive_advantage=o.competitive_advantage,
        known_risks=o.known_risks,
        eligibility_check=o.eligibility_check,
        required_documents=o.required_documents or [],
        compliance_notes=o.compliance_notes,
        stage=o.stage,
        probability=o.probability,
        qualified=o.qualified,
        qualified_by=_person_brief(o.qualified_by) if hasattr(o, "qualified_by") else None,
        qualified_at=_iso(o.qualified_at),
        qualification_notes=o.qualification_notes,
        qualification_criteria=o.qualification_criteria or {},
        won_at=_iso(o.won_at),
        won_by=_person_brief(o.won_by) if hasattr(o, "won_by") else None,
        lost_at=_iso(o.lost_at),
        lost_reason=o.lost_reason,
        lost_notes=o.lost_notes,
        attributed_to=_person_brief(o.attributed_to) if hasattr(o, "attributed_to") else None,
        activities=activities,
        stage_history=history,
        created_at=o.created_at.isoformat() if o.created_at else "",
        updated_at=_iso(o.updated_at),
    )


async def _load_opportunity_detail(
    db: AsyncSession,
    opportunity_id: str,
) -> Opportunity:
    result = await db.execute(
        select(Opportunity)
        .options(
            selectinload(Opportunity.organisation),
            selectinload(Opportunity.primary_contact),
            selectinload(Opportunity.owner),
            selectinload(Opportunity.attributed_to),
            selectinload(Opportunity.contributors).selectinload(OpportunityContributor.person),
            selectinload(Opportunity.activities).selectinload(OpportunityActivity.author),
            selectinload(Opportunity.stage_history).selectinload(OpportunityStageHistory.changed_by),
        )
        .where(Opportunity.id == opportunity_id)
    )
    o = result.scalar_one_or_none()
    if not o:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return o


# ============================================================
# GET /crm/opportunities  — list
# ============================================================

@router.get("", response_model=OpportunityListResponse)
async def list_opportunities(
    search: Optional[str] = None,
    stage: Optional[str] = None,
    type_filter: Optional[str] = Query(None, alias="type"),
    owner_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
    priority: Optional[str] = None,
    qualified_only: bool = False,
    open_only: bool = False,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.CRM_VIEW)),
):
    """
    List opportunities. Requires crm.view.
    """
    filters = []

    if search:
        pattern = f"%{search}%"
        filters.append(
            or_(
                Opportunity.title.ilike(pattern),
                Opportunity.description.ilike(pattern),
                Opportunity.campaign.ilike(pattern),
            )
        )

    if stage:
        filters.append(Opportunity.stage == stage)

    if type_filter:
        filters.append(Opportunity.type == type_filter)

    if owner_id:
        filters.append(Opportunity.owner_id == owner_id)

    if organisation_id:
        filters.append(Opportunity.organisation_id == organisation_id)

    if priority:
        filters.append(Opportunity.strategic_priority == priority)

    if qualified_only:
        filters.append(Opportunity.qualified.is_(True))

    if open_only:
        filters.append(Opportunity.stage.in_(OPEN_STAGES))

    # Total count
    count_query = select(func.count(Opportunity.id))
    if filters:
        count_query = count_query.where(*filters)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Open count + value and stage breakdown, standardised to GHS.
    metrics_result = await db.execute(
        select(
            Opportunity.stage,
            Opportunity.amount,
            Opportunity.currency,
            Opportunity.probability,
        )
    )
    open_count = 0
    open_value = 0.0
    by_stage: dict = {}
    for stage, amount, currency, _probability in metrics_result.all():
        base_value = currency_service.convert_to_base(amount, currency) or 0.0
        bucket = by_stage.setdefault(stage, {"count": 0, "value": 0.0})
        bucket["count"] += 1
        bucket["value"] += base_value
        if stage in OPEN_STAGES:
            open_count += 1
            open_value += base_value

    for bucket in by_stage.values():
        bucket["value"] = round(bucket["value"], 2)
    open_value = round(open_value, 2)

    # Items
    query = (
        select(Opportunity)
        .options(
            selectinload(Opportunity.organisation),
            selectinload(Opportunity.primary_contact),
            selectinload(Opportunity.owner),
        )
    )
    if filters:
        query = query.where(*filters)
    query = (
        query
        .order_by(
            desc(Opportunity.expected_close_date).nullslast(),
            desc(Opportunity.created_at),
        )
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(query)
    opportunities = list(result.scalars().all())

    return OpportunityListResponse(
        items=[_summary(o) for o in opportunities],
        total=total,
        open_count=open_count,
        open_value=open_value,
        by_stage=by_stage,
    )


# ============================================================
# POST /crm/opportunities  — create
# ============================================================

@router.post("", response_model=OpportunityDetail, status_code=status.HTTP_201_CREATED)
async def create_opportunity(
    payload: OpportunityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.CRM_CREATE)),
):
    """
    Create a new opportunity. Requires crm.create.

    Validations:
    - organisation must exist
    - owner must exist
    - primary_contact (if set) must exist
    """
    # Validate organisation
    org_result = await db.execute(
        select(Organisation).where(Organisation.id == payload.organisation_id)
    )
    if not org_result.scalar_one_or_none():
        raise HTTPException(404, "Organisation not found")

    # Validate owner
    owner_result = await db.execute(
        select(Person).where(
            Person.id == payload.owner_id,
            Person.deleted_at.is_(None),
        )
    )
    if not owner_result.scalar_one_or_none():
        raise HTTPException(404, "Owner not found")

    # Validate primary contact (optional)
    if payload.primary_contact_id:
        contact_result = await db.execute(
            select(Person).where(
                Person.id == payload.primary_contact_id,
                Person.deleted_at.is_(None),
            )
        )
        if not contact_result.scalar_one_or_none():
            raise HTTPException(404, "Primary contact not found")

    opportunity = Opportunity(
        id=str(uuid.uuid4()),
        title=payload.title,
        type=payload.type,
        description=payload.description,
        organisation_id=payload.organisation_id,
        primary_contact_id=payload.primary_contact_id,
        amount=Decimal(str(payload.amount)) if payload.amount is not None else None,
        currency=payload.currency.upper(),
        amount_type=payload.amount_type,
        expected_close_date=payload.expected_close_date,
        expected_start_date=payload.expected_start_date,
        expected_duration_months=payload.expected_duration_months,
        decision_timeline=payload.decision_timeline,
        source=payload.source,
        referred_by_id=payload.referred_by_id,
        campaign=payload.campaign,
        owner_id=payload.owner_id,
        alignment_notes=payload.alignment_notes,
        strategic_priority=payload.strategic_priority,
        programme_id=payload.programme_id,
        competitors=payload.competitors,
        competitive_advantage=payload.competitive_advantage,
        known_risks=payload.known_risks,
        eligibility_check=payload.eligibility_check,
        required_documents=payload.required_documents,
        compliance_notes=payload.compliance_notes,
        stage="discovery",
        probability=STAGE_PROBABILITY["discovery"],
        qualified=False,
        qualification_criteria={},
    )
    db.add(opportunity)
    await db.flush()

    # Create initial stage history entry
    history = OpportunityStageHistory(
        id=str(uuid.uuid4()),
        opportunity_id=opportunity.id,
        from_stage=None,
        to_stage="discovery",
        changed_by_id=current_user.person_id,
        note="Opportunity created",
    )
    db.add(history)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="OPPORTUNITY_CREATED",
        entity_type="opportunity",
        entity_id=opportunity.id,
        description=f"Created opportunity: {payload.title}",
        new_values={
            "title": payload.title,
            "type": payload.type,
            "organisation_id": payload.organisation_id,
            "owner_id": payload.owner_id,
            "amount": str(payload.amount) if payload.amount else None,
        },
    )

    await db.commit()

    # Reload with relationships
    o = await _load_opportunity_detail(db, opportunity.id)
    return _detail(o)


# ============================================================
# GET /crm/opportunities/{id}  — detail
# ============================================================

@router.get("/{opportunity_id}", response_model=OpportunityDetail)
async def get_opportunity(
    opportunity_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.CRM_VIEW)),
):
    """Get full detail for one opportunity. Requires crm.view."""
    o = await _load_opportunity_detail(db, opportunity_id)
    return _detail(o)

# ============================================================
# UPDATE (excluding stage)
# ============================================================

class OpportunityUpdate(BaseModel):
    """Fields editable after creation. Stage is NOT here — that's a separate
    endpoint that enforces the state machine."""
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    type: Optional[str] = Field(None, max_length=30)
    description: Optional[str] = None

    organisation_id: Optional[str] = None
    primary_contact_id: Optional[str] = None

    amount: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = Field(None, max_length=3)
    amount_type: Optional[str] = Field(None, max_length=30)
    expected_close_date: Optional[date] = None
    expected_start_date: Optional[date] = None
    expected_duration_months: Optional[int] = Field(None, ge=0, le=240)
    decision_timeline: Optional[str] = None

    source: Optional[str] = Field(None, max_length=30)
    referred_by_id: Optional[str] = None
    campaign: Optional[str] = Field(None, max_length=100)

    owner_id: Optional[str] = None

    alignment_notes: Optional[str] = None
    strategic_priority: Optional[str] = Field(None, max_length=20)
    programme_id: Optional[str] = None

    competitors: Optional[List[str]] = None
    competitive_advantage: Optional[str] = None
    known_risks: Optional[str] = None

    eligibility_check: Optional[str] = Field(None, max_length=30)
    required_documents: Optional[List[str]] = None
    compliance_notes: Optional[str] = None

    qualification_criteria: Optional[dict] = None
    qualification_notes: Optional[str] = None

    attributed_to_id: Optional[str] = None

    @field_validator("currency")
    @classmethod
    def valid_currency(cls, v):
        if v is None:
            return v
        code = currency_service.normalize_currency(v)
        if not currency_service.is_supported(code):
            raise ValueError(f"Unsupported currency: {v}")
        return code


@router.patch("/{opportunity_id}", response_model=OpportunityDetail)
async def update_opportunity(
    opportunity_id: str,
    payload: OpportunityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.CRM_EDIT)),
):
    """
    Update editable fields on an opportunity. Requires crm.edit.

    Stage is NOT editable here — use POST /{id}/stage instead.
    Won / Lost opportunities cannot be edited except for notes fields.
    """
    o = await _load_opportunity_detail(db, opportunity_id)

    # Won / Lost are locked except for notes
    if o.stage in CLOSED_STAGES:
        allowed_in_closed = {"compliance_notes", "alignment_notes", "known_risks"}
        changes = payload.model_dump(exclude_unset=True)
        illegal = set(changes.keys()) - allowed_in_closed
        if illegal:
            raise HTTPException(
                400,
                f"Opportunity is {o.stage}. Only notes fields can be edited.",
            )

    changes = payload.model_dump(exclude_unset=True)
    old_values = {}
    for key, value in changes.items():
        old = getattr(o, key, None)
        old_values[key] = str(old) if old is not None else None

        if key == "amount" and value is not None:
            value = Decimal(str(value))
        if key == "currency" and value is not None:
            value = value.upper()

        setattr(o, key, value)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="OPPORTUNITY_UPDATED",
        entity_type="opportunity",
        entity_id=o.id,
        description=f"Updated opportunity: {o.title}",
        old_values=old_values,
        new_values={k: str(v) if v is not None else None for k, v in changes.items()},
    )

    await db.commit()
    o = await _load_opportunity_detail(db, opportunity_id)
    return _detail(o)


# ============================================================
# STAGE TRANSITION (the state machine)
# ============================================================

class StageTransitionRequest(BaseModel):
    to_stage: str = Field(..., max_length=30)
    note: Optional[str] = None
    # Only used when moving to "lost"
    lost_reason: Optional[str] = Field(None, max_length=50)
    lost_notes: Optional[str] = None
    # Only used when moving to "won"
    attributed_to_id: Optional[str] = None
    # Only used when moving to "qualified"
    qualification_criteria: Optional[dict] = None

    @field_validator("to_stage")
    @classmethod
    def valid_stage(cls, v):
        if v not in STAGES:
            raise ValueError(f"to_stage must be one of {STAGES}")
        return v


@router.post("/{opportunity_id}/stage", response_model=OpportunityDetail)
async def transition_stage(
    opportunity_id: str,
    payload: StageTransitionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.CRM_EDIT)),
):
    """
    Move an opportunity to a new stage. Requires crm.edit.

    State machine rules:
    - Cannot move backward (lost -> discovery) except reopen via admin tool
    - Cannot move out of won / lost
    - "qualified" requires organisation, contact, owner, at least one activity,
      and at least 3 of 5 qualification criteria = true
    - "won" requires amount > 0
    - "lost" requires a reason
    """
    o = await _load_opportunity_detail(db, opportunity_id)
    from_stage = o.stage
    to_stage = payload.to_stage

    # ---- Guard: closed stages cannot be reopened ----
    if from_stage in CLOSED_STAGES:
        raise HTTPException(
            400,
            f"Opportunity is already {from_stage}. Cannot transition from closed state.",
        )

    # ---- Guard: no-op ----
    if from_stage == to_stage:
        raise HTTPException(400, "Opportunity is already in this stage")

    # ---- Guard: backward movement ----
    current_idx = STAGES.index(from_stage)
    to_idx = STAGES.index(to_stage)
    # Allow moving to "lost" from any open stage
    if to_stage != "lost" and to_idx < current_idx:
        raise HTTPException(400, "Cannot move backward in the pipeline")

    # ---- Guard: "qualified" gate ----
    if to_stage == "qualified":
        if not o.organisation_id:
            raise HTTPException(400, "Add an organisation before qualifying")
        if not o.primary_contact_id:
            raise HTTPException(400, "Add a primary contact before qualifying")
        if not o.owner_id:
            raise HTTPException(400, "Assign an owner before qualifying")
        if not o.activities:
            raise HTTPException(400, "Log at least one activity before qualifying")

        criteria = payload.qualification_criteria or o.qualification_criteria or {}
        passed = sum(
            1 for k in QUALIFICATION_CRITERIA_KEYS if criteria.get(k) is True
        )
        if passed < 3:
            raise HTTPException(
                400,
                f"At least 3 of 5 qualification criteria must be met (currently {passed})",
            )

        o.qualified = True
        o.qualified_by_id = current_user.person_id
        o.qualified_at = datetime.now(timezone.utc)
        o.qualification_criteria = criteria
        if payload.note:
            o.qualification_notes = payload.note

    # ---- Guard: "won" gate ----
    if to_stage == "won":
        if not o.amount or float(o.amount) <= 0:
            raise HTTPException(400, "Set an amount before marking as won")
        o.won_at = datetime.now(timezone.utc)
        o.won_by_id = current_user.person_id
        if payload.attributed_to_id:
            o.attributed_to_id = payload.attributed_to_id

    # ---- Guard: "lost" gate ----
    if to_stage == "lost":
        if not payload.lost_reason:
            raise HTTPException(400, "A lost_reason is required")
        o.lost_at = datetime.now(timezone.utc)
        o.lost_reason = payload.lost_reason
        o.lost_notes = payload.lost_notes

    # ---- Apply transition ----
    o.stage = to_stage
    o.probability = STAGE_PROBABILITY[to_stage]

    history = OpportunityStageHistory(
        id=str(uuid.uuid4()),
        opportunity_id=o.id,
        from_stage=from_stage,
        to_stage=to_stage,
        changed_by_id=current_user.person_id,
        note=payload.note,
    )
    db.add(history)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="OPPORTUNITY_STAGE_CHANGED",
        entity_type="opportunity",
        entity_id=o.id,
        description=f"{o.title}: {from_stage} → {to_stage}",
        old_values={"stage": from_stage},
        new_values={"stage": to_stage, "note": payload.note},
    )

    await db.commit()
    o = await _load_opportunity_detail(db, opportunity_id)
    return _detail(o)


# ============================================================
# ACTIVITIES
# ============================================================

class ActivityCreate(BaseModel):
    type: str = Field(..., max_length=30)
    occurred_at: Optional[datetime] = None
    summary: str = Field(..., min_length=2, max_length=5000)
    next_step: Optional[str] = Field(None, max_length=2000)

    @field_validator("type")
    @classmethod
    def valid_type(cls, v):
        allowed = {"call", "email", "meeting", "site_visit", "note"}
        if v not in allowed:
            raise ValueError(f"type must be one of {sorted(allowed)}")
        return v


@router.post(
    "/{opportunity_id}/activities",
    response_model=OpportunityDetail,
    status_code=status.HTTP_201_CREATED,
)
async def add_activity(
    opportunity_id: str,
    payload: ActivityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.CRM_EDIT)),
):
    """Log an activity on an opportunity. Requires crm.edit."""
    o = await _load_opportunity_detail(db, opportunity_id)

    activity = OpportunityActivity(
        id=str(uuid.uuid4()),
        opportunity_id=o.id,
        type=payload.type,
        occurred_at=payload.occurred_at or datetime.now(timezone.utc),
        summary=payload.summary,
        next_step=payload.next_step,
        author_id=current_user.person_id,
    )
    db.add(activity)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="OPPORTUNITY_ACTIVITY_ADDED",
        entity_type="opportunity",
        entity_id=o.id,
        description=f"Logged {payload.type}: {payload.summary[:80]}",
        new_values={"type": payload.type},
    )

    await db.commit()
    o = await _load_opportunity_detail(db, opportunity_id)
    return _detail(o)


@router.delete(
    "/{opportunity_id}/activities/{activity_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_activity(
    opportunity_id: str,
    activity_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.CRM_EDIT)),
):
    """Delete an activity. Requires crm.edit."""
    result = await db.execute(
        select(OpportunityActivity).where(
            OpportunityActivity.id == activity_id,
            OpportunityActivity.opportunity_id == opportunity_id,
        )
    )
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(404, "Activity not found")

    await db.delete(activity)
    await AuditService.log(
        db=db,
        actor=current_user,
        action="OPPORTUNITY_ACTIVITY_DELETED",
        entity_type="opportunity",
        entity_id=opportunity_id,
        description=f"Deleted activity {activity_id}",
    )
    await db.commit()
    return None


# ============================================================
# CONTRIBUTORS
# ============================================================

class ContributorCreate(BaseModel):
    person_id: str
    role: str = Field("contributor", max_length=50)

    @field_validator("role")
    @classmethod
    def valid_role(cls, v):
        allowed = {"contributor", "advisor", "sponsor"}
        if v not in allowed:
            raise ValueError(f"role must be one of {sorted(allowed)}")
        return v


@router.post(
    "/{opportunity_id}/contributors",
    response_model=OpportunityDetail,
    status_code=status.HTTP_201_CREATED,
)
async def add_contributor(
    opportunity_id: str,
    payload: ContributorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.CRM_EDIT)),
):
    """Add a contributor to an opportunity. Requires crm.edit."""
    o = await _load_opportunity_detail(db, opportunity_id)

    # Validate person exists
    person_result = await db.execute(
        select(Person).where(
            Person.id == payload.person_id,
            Person.deleted_at.is_(None),
        )
    )
    if not person_result.scalar_one_or_none():
        raise HTTPException(404, "Person not found")

    # Prevent duplicate
    existing = await db.execute(
        select(OpportunityContributor).where(
            OpportunityContributor.opportunity_id == o.id,
            OpportunityContributor.person_id == payload.person_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "This person is already a contributor")

    contributor = OpportunityContributor(
        id=str(uuid.uuid4()),
        opportunity_id=o.id,
        person_id=payload.person_id,
        role=payload.role,
    )
    db.add(contributor)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="OPPORTUNITY_CONTRIBUTOR_ADDED",
        entity_type="opportunity",
        entity_id=o.id,
        description=f"Added contributor {payload.person_id} as {payload.role}",
    )

    await db.commit()
    o = await _load_opportunity_detail(db, opportunity_id)
    return _detail(o)


@router.delete(
    "/{opportunity_id}/contributors/{contributor_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_contributor(
    opportunity_id: str,
    contributor_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.CRM_EDIT)),
):
    """Remove a contributor. Requires crm.edit."""
    result = await db.execute(
        select(OpportunityContributor).where(
            OpportunityContributor.id == contributor_id,
            OpportunityContributor.opportunity_id == opportunity_id,
        )
    )
    contributor = result.scalar_one_or_none()
    if not contributor:
        raise HTTPException(404, "Contributor not found")

    await db.delete(contributor)
    await AuditService.log(
        db=db,
        actor=current_user,
        action="OPPORTUNITY_CONTRIBUTOR_REMOVED",
        entity_type="opportunity",
        entity_id=opportunity_id,
        description=f"Removed contributor {contributor_id}",
    )
    await db.commit()
    return None