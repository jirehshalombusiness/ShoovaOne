from sqlalchemy import Column, ForeignKey
from sqlalchemy.orm import declared_attr

from app.models.sql.base import GUID


class EntityScopedMixin:
    """Marks a record as owned by an entity.

    ``entity_id`` is NULL for institutional/shared records. Reads are filtered
    centrally in ``app.core.database``; writes are stamped from the active
    workspace on flush.
    """

    @declared_attr
    def entity_id(cls):
        return Column(
            GUID,
            ForeignKey("entities.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        )
