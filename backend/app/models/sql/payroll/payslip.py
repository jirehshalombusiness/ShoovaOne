from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class Payslip(BaseModel):
    __tablename__ = "payroll_payslips"

    run_item_id = Column(
        GUID,
        ForeignKey("payroll_run_items.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    period_id = Column(
        GUID,
        ForeignKey("payroll_pay_periods.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    gross_pay = Column(Numeric(15, 2), nullable=False, default=0)
    total_deductions = Column(Numeric(15, 2), nullable=False, default=0)
    net_pay = Column(Numeric(15, 2), nullable=False, default=0)
    ytd_gross = Column(Numeric(15, 2), nullable=False, default=0)
    ytd_deductions = Column(Numeric(15, 2), nullable=False, default=0)
    ytd_net = Column(Numeric(15, 2), nullable=False, default=0)
    status = Column(String(20), nullable=False, default="issued")
    version = Column(Integer, nullable=False, default=1)
    issued_at = Column(DateTime(timezone=True), nullable=False)
    viewed_at = Column(DateTime(timezone=True), nullable=True)

    item = relationship("PayRunItem", back_populates="payslip")
    person = relationship("Person", lazy="selectin")
    period = relationship("PayPeriod", lazy="selectin")
