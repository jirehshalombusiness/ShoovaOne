from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class Invoice(BaseModel):
    __tablename__ = "invoices"

    invoice_number = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    customer_name = Column(
        String(200),
        nullable=False,
        index=True,
    )

    customer_email = Column(
        String(255),
        nullable=True,
    )

    customer_phone = Column(
        String(50),
        nullable=True,
    )

    customer_address = Column(
        Text,
        nullable=True,
    )

    title = Column(
        String(200),
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
    )

    amount = Column(
        Numeric(15, 2),
        nullable=False,
    )

    amount_paid = Column(
        Numeric(15, 2),
        nullable=False,
        default=0,
    )

    currency = Column(
        String(3),
        nullable=False,
        default="GHS",
    )

    issue_date = Column(
        Date,
        nullable=False,
    )

    due_date = Column(
        Date,
        nullable=False,
    )

    status = Column(
        String(30),
        nullable=False,
        default="draft",
        index=True,
    )

    project_id = Column(
        GUID,
        ForeignKey(
            "projects.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    programme_id = Column(
        GUID,
        nullable=True,
    )

    department_id = Column(
        GUID,
        nullable=True,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    issued_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    paid_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    cancelled_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    cancellation_reason = Column(
        Text,
        nullable=True,
    )

    created_by_id = Column(
        GUID,
        ForeignKey(
            "people.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    created_by = relationship(
        "Person",
        foreign_keys=[created_by_id],
    )

    project = relationship(
        "Project",
        foreign_keys=[project_id],
    )

    payments = relationship(
    "Payment",
    foreign_keys="Payment.invoice_id",
    back_populates="invoice",
    cascade="all, delete-orphan",
)