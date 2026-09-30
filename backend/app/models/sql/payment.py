from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class Payment(BaseModel):
    __tablename__ = "payments"

    payment_number = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    invoice_id = Column(
        GUID,
        ForeignKey("invoices.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    amount = Column(
        Numeric(15, 2),
        nullable=False,
    )

    currency = Column(
        String(3),
        nullable=False,
        default="GHS",
    )

    payment_date = Column(
        Date,
        nullable=False,
    )

    payment_method = Column(
        String(50),
        nullable=False,
    )

    reference = Column(
        String(200),
        nullable=True,
        index=True,
    )

    payer_name = Column(
        String(200),
        nullable=True,
    )

    payer_email = Column(
        String(255),
        nullable=True,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    status = Column(
        String(30),
        nullable=False,
        default="completed",
        index=True,
    )

    recorded_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )

    recorded_at = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    invoice = relationship(
        "Invoice",
        foreign_keys=[invoice_id],
        back_populates="payments",
    )

    recorded_by = relationship(
        "Person",
        foreign_keys=[recorded_by_id],
    )