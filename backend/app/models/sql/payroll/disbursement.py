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
)
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class DisbursementBatch(BaseModel):
    __tablename__ = "payroll_disbursement_batches"

    batch_number = Column(String(50), nullable=False, unique=True, index=True)
    run_id = Column(
        GUID,
        ForeignKey("payroll_runs.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    method = Column(String(30), nullable=False, default="bank_transfer")
    currency = Column(String(3), nullable=False, default="GHS")
    pay_date = Column(Date, nullable=False)
    status = Column(String(30), nullable=False, default="draft", index=True)
    control_count = Column(Integer, nullable=False, default=0)
    control_total = Column(Numeric(15, 2), nullable=False, default=0)
    bank_file_reference = Column(String(100), nullable=True)
    bank_file_hash = Column(String(64), nullable=True)
    provider_reference = Column(String(200), nullable=True)
    created_by_id = Column(GUID, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)
    approved_by_id = Column(GUID, ForeignKey("people.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    run = relationship("PayRun", lazy="selectin")
    items = relationship(
        "DisbursementItem",
        back_populates="batch",
        cascade="all, delete-orphan",
        order_by="DisbursementItem.person_name",
    )

    __table_args__ = (
        Index("ix_payroll_batch_run_status", "run_id", "status"),
    )


class DisbursementItem(BaseModel):
    __tablename__ = "payroll_disbursement_items"

    batch_id = Column(
        GUID,
        ForeignKey("payroll_disbursement_batches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    run_item_id = Column(
        GUID,
        ForeignKey("payroll_run_items.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="RESTRICT"),
        nullable=False,
    )
    person_name = Column(String(250), nullable=False)
    employee_number = Column(String(50), nullable=True)
    amount = Column(Numeric(15, 2), nullable=False)
    method = Column(String(30), nullable=False)
    destination_masked = Column(String(150), nullable=True)
    status = Column(String(20), nullable=False, default="pending", index=True)
    failure_reason = Column(String(300), nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    provider_reference = Column(String(200), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    batch = relationship("DisbursementBatch", back_populates="items")
    run_item = relationship("PayRunItem", lazy="selectin")
