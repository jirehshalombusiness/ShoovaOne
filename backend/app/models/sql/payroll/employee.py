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
)
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class EmployeePayProfile(BaseModel):
    __tablename__ = "payroll_employee_profiles"

    person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pay_group_id = Column(
        GUID,
        ForeignKey("payroll_pay_groups.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    pay_type = Column(String(20), nullable=False, default="salaried")
    base_amount = Column(Numeric(15, 2), nullable=False, default=0)
    hourly_rate = Column(Numeric(15, 4), nullable=False, default=0)
    currency = Column(String(3), nullable=False, default="GHS")
    overtime_multiplier = Column(Numeric(5, 2), nullable=False, default=1.5)
    payment_method = Column(String(30), nullable=False, default="bank_transfer")
    cost_center = Column(String(100), nullable=True)
    department = Column(String(200), nullable=True)
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)

    person = relationship("Person", lazy="selectin")
    pay_group = relationship("PayGroup", back_populates="profiles", lazy="selectin")

    __table_args__ = (
        Index(
            "ix_payroll_profile_person_dates",
            "person_id",
            "effective_from",
            "effective_to",
        ),
    )


class EmployeeBankAccount(BaseModel):
    __tablename__ = "payroll_bank_accounts"

    person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bank_name = Column(String(150), nullable=False)
    branch = Column(String(150), nullable=True)
    bank_code = Column(String(30), nullable=True)
    account_name = Column(String(200), nullable=False)
    account_number_encrypted = Column(Text, nullable=False)
    account_number_last4 = Column(String(4), nullable=False)
    mobile_money_provider = Column(String(50), nullable=True)
    is_primary = Column(Boolean, nullable=False, default=False)
    verification_status = Column(String(20), nullable=False, default="pending")
    verification_note = Column(Text, nullable=True)
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)
    created_by_id = Column(GUID, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)
    approved_by_id = Column(GUID, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    person = relationship("Person", foreign_keys=[person_id], lazy="selectin")
    approver = relationship("Person", foreign_keys=[approved_by_id], lazy="selectin")

    __table_args__ = (
        Index(
            "ix_payroll_bank_person_primary",
            "person_id",
            "is_primary",
        ),
    )


class RecurringComponent(BaseModel):
    __tablename__ = "payroll_recurring_components"

    person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    component_type_id = Column(
        GUID,
        ForeignKey("payroll_component_types.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount = Column(Numeric(15, 2), nullable=False, default=0)
    rate = Column(Numeric(9, 6), nullable=False, default=0)
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)
    remaining_amount = Column(Numeric(15, 2), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)

    person = relationship("Person", lazy="selectin")
    component_type = relationship("PayComponentType", lazy="selectin")

    __table_args__ = (
        Index(
            "ix_payroll_recurring_person_active",
            "person_id",
            "is_active",
        ),
    )


class Loan(BaseModel):
    __tablename__ = "payroll_loans"

    person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    principal = Column(Numeric(15, 2), nullable=False)
    interest_rate = Column(Numeric(9, 6), nullable=False, default=0)
    installment_amount = Column(Numeric(15, 2), nullable=False)
    term_months = Column(Integer, nullable=False)
    start_date = Column(Date, nullable=False)
    outstanding_balance = Column(Numeric(15, 2), nullable=False)
    status = Column(String(20), nullable=False, default="active", index=True)
    approved_by_id = Column(GUID, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)
    created_by_id = Column(GUID, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)

    person = relationship("Person", foreign_keys=[person_id], lazy="selectin")
    approver = relationship("Person", foreign_keys=[approved_by_id], lazy="selectin")
    installments = relationship(
        "LoanInstallment",
        back_populates="loan",
        cascade="all, delete-orphan",
        order_by="LoanInstallment.sequence",
    )


class LoanInstallment(BaseModel):
    __tablename__ = "payroll_loan_installments"

    loan_id = Column(
        GUID,
        ForeignKey("payroll_loans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sequence = Column(Integer, nullable=False)
    due_date = Column(Date, nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    principal_portion = Column(Numeric(15, 2), nullable=False, default=0)
    interest_portion = Column(Numeric(15, 2), nullable=False, default=0)
    status = Column(String(20), nullable=False, default="pending", index=True)
    pay_run_item_id = Column(
        GUID,
        ForeignKey("payroll_run_items.id", ondelete="SET NULL"),
        nullable=True,
    )
    paid_at = Column(DateTime(timezone=True), nullable=True)

    loan = relationship("Loan", back_populates="installments")
