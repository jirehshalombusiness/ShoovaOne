from sqlalchemy import (
    Column,
    String,
    Integer,
    Text,
    Date,
    DateTime,
    DECIMAL,
    Boolean,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.sql.base import BaseModel, GUID


# ============================================================
# OPPORTUNITY
# ============================================================

class Opportunity(BaseModel):
    """
    A potential grant, partnership, contract, or programme.

    The pipeline entity. Every "deal" the org is chasing is one row here.

    Stages:
        discovery     - gathering information
        qualified     - vetted, worth pursuing
        proposal      - proposal drafted and/or submitted
        negotiation   - terms being discussed
        committed     - verbal/handshake agreement, awaiting contract
        won           - signed, funding/delivery secured
        lost          - didn't close
    """

    __tablename__ = "opportunities"

    # ---- basics ----
    title = Column(String(255), nullable=False)
    type = Column(String(30), nullable=False)  # grant / partnership / contract / programme
    description = Column(Text)

    # ---- org + contact ----
    organisation_id = Column(
        GUID,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    primary_contact_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ---- value ----
    amount = Column(DECIMAL(15, 2), nullable=True)
    currency = Column(String(3), default="GHS", nullable=False)
    amount_type = Column(String(30), default="one_time")
    # one_time / recurring / milestone
    expected_close_date = Column(Date, nullable=True, index=True)
    expected_start_date = Column(Date, nullable=True)
    expected_duration_months = Column(Integer, nullable=True)
    decision_timeline = Column(Text)

    # ---- source ----
    source = Column(String(30), default="outbound")
    # inbound / outbound / referral / event / existing_relationship
    referred_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )
    campaign = Column(String(100))

    # ---- ownership ----
    owner_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ---- strategic fit ----
    alignment_notes = Column(Text)
    strategic_priority = Column(String(20), default="medium")
    # high / medium / low
    programme_id = Column(GUID, nullable=True)

    # ---- competition + risk ----
    competitors = Column(JSON, default=list)
    competitive_advantage = Column(Text)
    known_risks = Column(Text)

    # ---- requirements ----
    eligibility_check = Column(String(30), default="unknown")
    # yes / no / unknown
    required_documents = Column(JSON, default=list)
    compliance_notes = Column(Text)

    # ---- stage + qualification ----
    stage = Column(String(30), default="discovery", nullable=False, index=True)
    probability = Column(Integer, default=10)
    qualified = Column(Boolean, default=False, nullable=False)
    qualified_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )
    qualified_at = Column(DateTime(timezone=True), nullable=True)
    qualification_notes = Column(Text)
    qualification_criteria = Column(JSON, default=dict)
    # {has_budget: bool, has_contact: bool, technically_qualified: bool,
    #  timing_ok: bool, strategically_aligned: bool}

    # ---- close ----
    won_at = Column(DateTime(timezone=True), nullable=True)
    won_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )
    lost_at = Column(DateTime(timezone=True), nullable=True)
    lost_reason = Column(String(50), nullable=True)
    # no_budget / timing / competitor / not_a_fit / withdrawn / other
    lost_notes = Column(Text)

    # ---- attribution ----
    attributed_to_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ---- relationships ----
    organisation = relationship("Organisation", lazy="selectin")
    primary_contact = relationship(
        "Person",
        foreign_keys=[primary_contact_id],
        lazy="selectin",
    )
    owner = relationship(
        "Person",
        foreign_keys=[owner_id],
        lazy="selectin",
    )
    attributed_to = relationship(
        "Person",
        foreign_keys=[attributed_to_id],
        lazy="selectin",
    )

    contributors = relationship(
        "OpportunityContributor",
        back_populates="opportunity",
        cascade="all, delete-orphan",
    )
    activities = relationship(
        "OpportunityActivity",
        back_populates="opportunity",
        cascade="all, delete-orphan",
        order_by="OpportunityActivity.occurred_at.desc()",
    )
    stage_history = relationship(
        "OpportunityStageHistory",
        back_populates="opportunity",
        cascade="all, delete-orphan",
        order_by="OpportunityStageHistory.changed_at.desc()",
    )


# ============================================================
# CONTRIBUTORS
# ============================================================

class OpportunityContributor(BaseModel):
    __tablename__ = "opportunity_contributors"

    opportunity_id = Column(
        GUID,
        ForeignKey("opportunities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
    )
    role = Column(String(50), default="contributor")
    # contributor / advisor / sponsor

    opportunity = relationship("Opportunity", back_populates="contributors")
    person = relationship("Person", lazy="selectin")


# ============================================================
# ACTIVITIES
# ============================================================

class OpportunityActivity(BaseModel):
    __tablename__ = "opportunity_activities"

    opportunity_id = Column(
        GUID,
        ForeignKey("opportunities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type = Column(String(30), nullable=False)
    # call / email / meeting / site_visit / note / stage_change
    occurred_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    summary = Column(Text, nullable=False)
    next_step = Column(Text, nullable=True)
    author_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )

    opportunity = relationship("Opportunity", back_populates="activities")
    author = relationship("Person", lazy="selectin")


# ============================================================
# STAGE HISTORY
# ============================================================

class OpportunityStageHistory(BaseModel):
    __tablename__ = "opportunity_stage_history"

    opportunity_id = Column(
        GUID,
        ForeignKey("opportunities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_stage = Column(String(30), nullable=True)
    to_stage = Column(String(30), nullable=False)
    changed_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )
    note = Column(Text, nullable=True)
    changed_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    opportunity = relationship("Opportunity", back_populates="stage_history")
    changed_by = relationship("Person", lazy="selectin")