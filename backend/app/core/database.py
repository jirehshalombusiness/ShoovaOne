from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
    AsyncEngine,
)
from typing import AsyncGenerator

from app.core.config import settings
from app.models.sql.base import Base

# Convert database URL for async
database_url = settings.DATABASE_URL
is_sqlite = database_url.startswith("sqlite://")

if is_sqlite:
    database_url = database_url.replace("sqlite://", "sqlite+aiosqlite://")
else:
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")

# Create async engine with appropriate parameters
if is_sqlite:
    # SQLite doesn't support connection pooling
    engine: AsyncEngine = create_async_engine(
        database_url,
        echo=settings.DEBUG,
    )
else:
    # PostgreSQL with connection pooling
    engine: AsyncEngine = create_async_engine(
        database_url,
        echo=settings.DEBUG,
        pool_size=10,
        max_overflow=20,
        pool_timeout=30,
    )

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Shared declarative base used by all SQLAlchemy models.
# Importing the model modules registers the tables against this metadata.
from app.models.sql import User, Person, Role, Permission, Attendance, Notification  # noqa: F401


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()