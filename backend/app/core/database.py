from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
    AsyncEngine,
)
from typing import AsyncGenerator

from app.core.config import settings
from app.models.sql.base import Base
from app.models.sql.organisation import Organisation, Department, Programme  # noqa: F401

# Convert database URL for async
database_url = settings.DATABASE_URL
is_sqlite = database_url.startswith("sqlite://")

if is_sqlite:
    database_url = database_url.replace("sqlite://", "sqlite+aiosqlite://")
elif database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+asyncpg://")
elif database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")

if is_sqlite:
    engine: AsyncEngine = create_async_engine(
        database_url,
        echo=settings.DEBUG,
    )
else:
    engine: AsyncEngine = create_async_engine(
        database_url,
        echo=settings.DEBUG,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_pre_ping=True,
        pool_recycle=300,
    )

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
#
# Keep this list in sync with app/models/sql/__init__.py
# =============================================

# --- Identity & access ---
from app.models.sql.user import User, Person  # noqa: F401
from app.models.sql.role import (  # noqa: F401
    Role,
    Permission,
    user_roles,
    role_permissions,
    user_permissions,
)
from app.models.sql.password_reset_token import PasswordResetToken  # noqa: F401
from app.models.sql.compensation_request import CompensationRequest  # noqa: F401

# --- Core operations ---
from app.models.sql.attendance import Attendance  # noqa: F401
from app.models.sql.work_session import WorkSession  # noqa: F401
from app.models.sql.notification import Notification  # noqa: F401

# --- Projects & tasks ---
from app.models.sql.project import (  # noqa: F401
    Project,
    ProjectMember,
    Milestone,
    Task,
)
from app.models.sql.timesheet import (  # noqa: F401
    Timesheet,
    TimesheetEntry,
    TimesheetApprovalHistory,
)

# --- HR ---
from app.models.sql.employment_contract import EmploymentContract  # noqa: F401
from app.models.sql.leave import (  # noqa: F401
    LeaveType,
    LeaveBalance,
    LeaveRequest,
)
from app.models.sql.public_holiday import PublicHoliday  # noqa: F401
from app.models.sql.device import Device, DeviceAssignment  # noqa: F401
from app.models.sql.hr_note import HRNote  # noqa: F401
from app.models.sql.hr_celebration import HRCelebration  # noqa: F401

# --- Documents ---
from app.models.sql.document import Document  # noqa: F401
from app.models.sql.document_type import DocumentType  # noqa: F401

# --- Audit & approvals ---
from app.models.sql.audit_log import AuditLog  # noqa: F401
from app.models.sql.approval import ApprovalRequest, ApprovalComment  # noqa: F401


# =============================================
# DEPENDENCY
# =============================================

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yield an AsyncSession, close it on exit."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()