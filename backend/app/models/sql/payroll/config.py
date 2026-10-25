from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class PayPeriod(BaseModel):
    __tablename__ = "payroll_pay_periods"

    name = Column(String(100), nullable=False)
    frequency = Column(String(20), nullable=False)
    period_start = Column(Date, nullable=False, index=True)
    period_end = Column(Date, nullable=False, index=True)
    cutoff_at = Column(DateTime(timezone=True), nullable=True)
    pay_date = Column(Date, nullable=False, index=True)
    status = Column(String(20), nullable=False, default="open")
    notes = Column(Text, nullable=True)

    runs = relationship("PayRun", back_populates="period")

    __table_args__ = (
        UniqueConstraint(
            "frequency",
            "period_start",
            "period_end",
            name="uq_payroll_period_range",
        ),
        Index("ix_payroll_period_dates", "period_start", "period_end"),
    )


class PayGroup(BaseModel):
    __tablename__ = "payroll_pay_groups"

    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    pay_type = Column(String(20), nullable=False, default="salaried")
    currency = Column(String(3), nullable=False, default="GHS")
    overtime_eligible = Column(Boolean, nullable=False, default=False)
    proration_basis = Column(String(30), nullable=False, default="working_days")
    is_active = Column(Boolean, nullable=False, default=True)

    profiles = relationship("EmployeePayProfile", back_populates="pay_group")


class StatutoryScheme(BaseModel):
    __tablename__ = "payroll_statutory_schemes"

    name = Column(String(150), nullable=False)
    code = Column(String(30), nullable=False, index=True)
    jurisdiction = Column(String(10), nullable=False, default="GH")
    scheme_type = Column(String(30), nullable=False, default="social_security")
    employee_rate = Column(Numeric(9, 6), nullable=False, default=0)
    employer_rate = Column(Numeric(9, 6), nullable=False, default=0)
    base = Column(String(20), nullable=False, default="basic")
    cap = Column(Numeric(15, 2), nullable=True)
    relief_amount = Column(Numeric(15, 2), nullable=False, default=0)
    remittance_due_day = Column(Integer, nullable=True)
    priority = Column(Integer, nullable=False, default=100)
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)

    bands = relationship(
        "TaxBand",
        back_populates="scheme",
        cascade="all, delete-orphan",
        order_by="TaxBand.sequence",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint(
            "code",
            "effective_from",
            name="uq_payroll_scheme_code_from",
        ),
        Index(
            "ix_payroll_scheme_effective",
            "scheme_type",
            "effective_from",
            "effective_to",
        ),
    )


class TaxBand(BaseModel):
    __tablename__ = "payroll_tax_bands"

    scheme_id = Column(
        GUID,
        ForeignKey("payroll_statutory_schemes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sequence = Column(Integer, nullable=False, default=1)
    band_from = Column(Numeric(15, 2), nullable=False, default=0)
    band_to = Column(Numeric(15, 2), nullable=True)
    rate = Column(Numeric(9, 6), nullable=False, default=0)

    scheme = relationship("StatutoryScheme", back_populates="bands")


class PayComponentType(BaseModel):
    __tablename__ = "payroll_component_types"

    code = Column(String(50), nullable=False, unique=True)
    name = Column(String(150), nullable=False)
    category = Column(String(30), nullable=False)
    taxable = Column(Boolean, nullable=False, default=True)
    statutory = Column(Boolean, nullable=False, default=False)
    calculation = Column(String(20), nullable=False, default="fixed")
    default_amount = Column(Numeric(15, 2), nullable=False, default=0)
    default_rate = Column(Numeric(9, 6), nullable=False, default=0)
    calculation_base = Column(String(20), nullable=False, default="gross")
    priority = Column(Integer, nullable=False, default=100)
    gl_account = Column(String(50), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)

    __table_args__ = (
        Index(
            "ix_payroll_component_category",
            "category",
            "is_active",
        ),
    )
