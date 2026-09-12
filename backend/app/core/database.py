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
elif database_url.startswith("postgres://"):
    # Render uses postgres:// but SQLAlchemy needs postgresql://
    database_url = database_url.replace("postgres://", "postgresql+asyncpg://")
elif database_url.startswith("postgresql://"):
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
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_pre_ping=True,
        pool_recycle=300,
    )

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# =============================================
# IMPORT ALL MODELS TO REGISTER WITH SQLALCHEMY
# =============================================
# This is CRITICAL — without importing all models, SQLAlchemy
# won't know about their tables when creating them, and foreign
# keys will fail with NoReferencedTableError.
# =============================================

from app.models.sql.user import User, Person  # noqa: F401
from app.models.sql.role import Role, Permission, user_roles, role_permissions  # noqa: F401
from app.models.sql.attendance import Attendance  # noqa: F401
from app.models.sql.notification import Notification  # noqa: F401
from app.models.sql.project import Project, ProjectMember, Milestone, Task  # noqa: F401
from app.models.sql.timesheet import Timesheet, TimesheetEntry, TimesheetApprovalHistory  # noqa: F401


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()