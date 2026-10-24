from sqlalchemy import Column, DateTime, func, String, TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import declarative_base
import uuid


class GUID(TypeDecorator):
    """
    Platform-independent GUID type.
    - Uses PostgreSQL's native UUID when available.
    - Falls back to CHAR(36) on other databases.
    - Always returns strings to the application.
    """
    impl = CHAR(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            # asyncpg returns UUID objects; bind UUIDs too so batched
            # INSERT..RETURNING sentinel matching can correlate rows.
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == 'postgresql':
            return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return str(value)

    def _sentinel_value_resolver(self, dialect):
        # SQLAlchemy matches batched INSERT..RETURNING rows on raw DBAPI
        # values; asyncpg returns uuid.UUID while our params are strings.
        if dialect.name != 'postgresql':
            return None

        def resolve(value):
            return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))

        return resolve


Base = declarative_base()


class BaseModel(Base):
    """Base model with common fields."""
    __abstract__ = True

    id = Column(GUID, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())