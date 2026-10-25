from sqlalchemy import (
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


class PayRun(BaseModel):
    __tablename__ = "payroll_runs"

    run_number = Column(String(50), nullable=True, unique=True, index=True)
    period_id = Column(
        GUID,
        ForeignKey("payroll_pay_periods.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    pay_group_id = Column(
        GUID,
        ForeignKey("payroll_pay_groups.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    run_type = Column(String(30), nullable=False, default="regular")
    status = Column(String(30), nullable=False, default="draft", index=True)
    currency = Column(String(3), nullable=False, default="GHS")
    total_gross = Column(Numeric(15, 2), nullable=False, default=0)
    total_employee_deductions = Column(Numeric(15, 2), nullable=False, default=0)
    total_employer_contributions = Column(Numeric(15, 2), nullable=False, default=0)
    total_net = Column(Numeric(15, 2), nullable=False, default=0)
    total_employer_cost = Column(Numeric(15, 2), nullable=False, default=0)
    employee_count = Column(Integer, nullable=False, default=0)
    exception_count = Column(Integer, nullable=False, default=0)
    calculation_hash = Column(String(64), nullable=True)
    prepared_by_id = Column(GUID, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)
    hr_approved_by_id = Column(GUID, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)
    hr_approved_at = Column(DateTime(timezone=True), nullable=True)
    finance_approved_by_id = Column(GUID, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)
    finance_approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by_id = Column(GUID, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    finalized_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    period = relationship("PayPeriod", back_populates="runs", lazy="selectin")
    pay_group = relationship("PayGroup", lazy="selectin")
    items = relationship(
        "PayRunItem",
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="PayRunItem.person_name",
    )
    approvals = relationship(
        "PayRunApproval",
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="PayRunApproval.created_at",
    )
    timesheets = relationship(
        "PayRunTimesheet",
        back_populates="run",
        cascade="all, delete-orphan",
    )
    remittances = relationship(
        "StatutoryRemittance",
        back_populates="run",
        cascade="all, delete-orphan",
    )
    gl_entries = relationship(
        "PayrollGLEntry",
        back_populates="run",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_payroll_run_period_group", "period_id", "pay_group_id", "status"),
    )


class PayRunItem(BaseModel):
    __tablename__ = "payroll_run_items"

    run_id = Column(
        GUID,
        ForeignKey("payroll_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    person_name = Column(String(250), nullable=False)
    employee_number = Column(String(50), nullable=True)
    department = Column(String(200), nullable=True)
    cost_center = Column(String(100), nullable=True)
    pay_type = Column(String(20), nullable=False, default="salaried")
    currency = Column(String(3), nullable=False, default="GHS")
    regular_hours = Column(Numeric(9, 2), nullable=False, default=0)
    overtime_hours = Column(Numeric(9, 2), nullable=False, default=0)
    unpaid_leave_days = Column(Numeric(7, 2), nullable=False, default=0)
    gross_pay = Column(Numeric(15, 2), nullable=False, default=0)
    total_employee_deductions = Column(Numeric(15, 2), nullable=False, default=0)
    total_employer_contributions = Column(Numeric(15, 2), nullable=False, default=0)
    net_pay = Column(Numeric(15, 2), nullable=False, default=0)
    employer_cost = Column(Numeric(15, 2), nullable=False, default=0)
    status = Column(String(20), nullable=False, default="calculated", index=True)
    exception_summary = Column(Text, nullable=True)
    calculation_snapshot = Column(Text, nullable=True)

    run = relationship("PayRun", back_populates="items")
    person = relationship("Person", lazy="selectin")
    lines = relationship(
        "PayRunLine",
        back_populates="item",
        cascade="all, delete-orphan",
        order_by="PayRunLine.created_at",
    )
    payslip = relationship(
        "Payslip",
        back_populates="item",
        cascade="all, delete-orphan",
        uselist=False,
    )


class PayRunLine(BaseModel):
    __tablename__ = "payroll_run_lines"

    run_item_id = Column(
        GUID,
        ForeignKey("payroll_run_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    component_type_id = Column(
        GUID,
        ForeignKey("payroll_component_types.id", ondelete="SET NULL"),
        nullable=True,
    )
    code = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    category = Column(String(30), nullable=False)
    quantity = Column(Numeric(12, 4), nullable=True)
    rate = Column(Numeric(15, 6), nullable=True)
    amount = Column(Numeric(15, 2), nullable=False, default=0)
    taxable = Column(String(5), nullable=False, default="yes")
    statutory = Column(String(5), nullable=False, default="no")
    employer = Column(String(5), nullable=False, default="no")
    source = Column(String(30), nullable=False, default="manual")
    source_ref = Column(String(100), nullable=True)
    priority = Column(Integer, nullable=False, default=100)
    notes = Column(Text, nullable=True)

    item = relationship("PayRunItem", back_populates="lines")


class PayRunApproval(BaseModel):
    __tablename__ = "payroll_run_approvals"

    run_id = Column(
        GUID,
        ForeignKey("payroll_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stage = Column(String(30), nullable=False)
    decision = Column(String(20), nullable=False)
    actor_person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )
    note = Column(Text, nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=False)

    run = relationship("PayRun", back_populates="approvals")
    actor = relationship("Person", lazy="selectin")


class PayRunTimesheet(BaseModel):
    __tablename__ = "payroll_run_timesheets"

    run_id = Column(
        GUID,
        ForeignKey("payroll_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    timesheet_id = Column(
        GUID,
        ForeignKey("timesheets.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="RESTRICT"),
        nullable=False,
    )
    week_start_date = Column(Date, nullable=False)
    week_end_date = Column(Date, nullable=False)
    total_hours = Column(Numeric(9, 2), nullable=False, default=0)
    overtime_hours = Column(Numeric(9, 2), nullable=False, default=0)
    locked_at = Column(DateTime(timezone=True), nullable=False)

    run = relationship("PayRun", back_populates="timesheets")

    __table_args__ = (
        UniqueConstraint(
            "run_id",
            "timesheet_id",
            name="uq_payroll_run_timesheet",
        ),
    )


class PayAdjustment(BaseModel):
    __tablename__ = "payroll_adjustments"

    person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_run_id = Column(
        GUID,
        ForeignKey("payroll_runs.id", ondelete="SET NULL"),
        nullable=True,
    )
    target_period_id = Column(
        GUID,
        ForeignKey("payroll_pay_periods.id", ondelete="SET NULL"),
        nullable=True,
    )
    adjustment_type = Column(String(30), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    created_by_id = Column(GUID, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)


class StatutoryRemittance(BaseModel):
    __tablename__ = "payroll_statutory_remittances"

    run_id = Column(
        GUID,
        ForeignKey("payroll_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scheme_id = Column(
        GUID,
        ForeignKey("payroll_statutory_schemes.id", ondelete="RESTRICT"),
        nullable=False,
    )
    scheme_name = Column(String(150), nullable=False)
    employee_amount = Column(Numeric(15, 2), nullable=False, default=0)
    employer_amount = Column(Numeric(15, 2), nullable=False, default=0)
    total_amount = Column(Numeric(15, 2), nullable=False, default=0)
    due_date = Column(Date, nullable=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    reference = Column(String(200), nullable=True)

    run = relationship("PayRun", back_populates="remittances")
    scheme = relationship("StatutoryScheme", lazy="selectin")


class PayrollGLEntry(BaseModel):
    __tablename__ = "payroll_gl_entries"

    run_id = Column(
        GUID,
        ForeignKey("payroll_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entry_date = Column(Date, nullable=False)
    account_code = Column(String(50), nullable=False)
    account_name = Column(String(200), nullable=False)
    description = Column(String(300), nullable=True)
    cost_center = Column(String(100), nullable=True)
    debit = Column(Numeric(15, 2), nullable=False, default=0)
    credit = Column(Numeric(15, 2), nullable=False, default=0)
    status = Column(String(20), nullable=False, default="posted")
    posted_at = Column(DateTime(timezone=True), nullable=True)

    run = relationship("PayRun", back_populates="gl_entries")
