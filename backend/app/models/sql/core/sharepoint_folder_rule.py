from sqlalchemy import Column, ForeignKey, String, Text

from app.models.sql.base import BaseModel, GUID


class SharePointFolderRule(BaseModel):
    """Restricts one SharePoint folder subtree to a permission.

    ``folder_path`` is drive-relative (``/Finance``) and covers every
    descendant, so files added inside the folder inherit the rule.
    ``folder_id`` is kept so a renamed folder can still be matched while
    the rule is being edited; path matching is what enforces access.
    """

    __tablename__ = "sharepoint_folder_rules"

    folder_id = Column(String(400))
    folder_path = Column(Text, nullable=False, unique=True)
    folder_name = Column(String(255))
    required_permission = Column(String(100), nullable=False)
    created_by_id = Column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
    )
