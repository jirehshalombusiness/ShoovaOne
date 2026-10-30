from sqlalchemy import Column, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class DeviceRequest(BaseModel):
    """An employee's request for company equipment.

    Flow:
        draft -> pending_manager -> pending_hr -> pending_fulfilment
        pending_fulfilment -> purchase_requested -> fulfilled
        any pending state -> rejected / cancelled

    The line manager approves the need; HR approves and then fulfils it,
    either by assigning an existing device or by recording a purchase.
    """

    __tablename__ = "device_requests"

    request_number = Column(
        String(40), nullable=False, unique=True, index=True
    )
    requester_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    category = Column(String(50), nullable=False)
    item_name = Column(String(200), nullable=False)
    justification = Column(Text)
    needed_by = Column(Date)

    status = Column(
        String(30), nullable=False, default="draft", index=True
    )
    current_stage = Column(String(20))

    approval_id = Column(
        GUID,
        ForeignKey("approval_requests.id", ondelete="SET NULL"),
    )

    manager_decided_by_id = Column(
        GUID, ForeignKey("people.id", ondelete="SET NULL")
    )
    manager_decided_at = Column(DateTime(timezone=True))
    manager_decision_note = Column(Text)

    hr_decided_by_id = Column(
        GUID, ForeignKey("people.id", ondelete="SET NULL")
    )
    hr_decided_at = Column(DateTime(timezone=True))
    hr_decision_note = Column(Text)

    # stock | purchase
    fulfilment = Column(String(20))
    device_id = Column(
        GUID, ForeignKey("devices.id", ondelete="SET NULL")
    )
    assigned_at = Column(DateTime(timezone=True))
    purchase_reference = Column(String(120))
    close_note = Column(Text)
    rejection_reason = Column(Text)

    submitted_at = Column(DateTime(timezone=True))
    closed_at = Column(DateTime(timezone=True))

    requester = relationship(
        "Person", foreign_keys=[requester_id], lazy="selectin"
    )
    manager_decider = relationship(
        "Person", foreign_keys=[manager_decided_by_id], lazy="selectin"
    )
    hr_decider = relationship(
        "Person", foreign_keys=[hr_decided_by_id], lazy="selectin"
    )
    device = relationship("Device", lazy="selectin")
