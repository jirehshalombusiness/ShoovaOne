from sqlalchemy import Column, ForeignKey, String, Text, DateTime, func

from app.models.sql.base import BaseModel, GUID


class SharePointFolderRequest(BaseModel):
    __tablename__ = "sharepoint_folder_requests"

    action = Column(String(20), nullable=False)
    folder_name = Column(String(255), nullable=False)
    folder_id = Column(String(400))
    parent_folder_id = Column(String(400))
    folder_path = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="pending", server_default="pending")
    decision_note = Column(Text)
    requested_by_id = Column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    resolved_by_id = Column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
