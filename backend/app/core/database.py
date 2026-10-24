from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
    AsyncEngine,
)
from typing import AsyncGenerator

from app.core.config import settings
from app.models.sql.base import Base
from app.models.sql.core.organisation import Organisation, Department, Programme  # noqa: F401

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

#meeting
from app.models.sql.meetings.meeting import (  # noqa: F401
    Meeting,
    MeetingAttendee,
    MeetingAgendaItem,
)

##crm
from app.models.sql.crm.opportunity import (  # noqa: F401
    Opportunity,
    OpportunityContributor,
    OpportunityActivity,
    OpportunityStageHistory,
)

# --- Identity & access ---
from app.models.sql.core.user import User, Person  # noqa: F401
from app.models.sql.core.role import (  # noqa: F401
    Role,
    Permission,
    user_roles,
    role_permissions,
    user_permissions,
)
from app.models.sql.core.password_reset_token import PasswordResetToken  # noqa: F401
from app.models.sql.hr.compensation_request import CompensationRequest  # noqa: F401

# --- Core operations ---
from app.models.sql.timekeeping.attendance import Attendance  # noqa: F401
from app.models.sql.timekeeping.work_session import WorkSession  # noqa: F401
from app.models.sql.core.notification import Notification  # noqa: F401

# --- Projects & tasks ---
from app.models.sql.projects.project import (  # noqa: F401
    Project,
    ProjectMember,
    Milestone,
    Task,
)
from app.models.sql.timekeeping.timesheet import (  # noqa: F401
    Timesheet,
    TimesheetEntry,
    TimesheetApprovalHistory,
)

# --- HR ---
from app.models.sql.hr.employment_contract import EmploymentContract  # noqa: F401
from app.models.sql.hr.leave import (  # noqa: F401
    LeaveType,
    LeaveBalance,
    LeaveRequest,
)
from app.models.sql.hr.public_holiday import PublicHoliday  # noqa: F401
from app.models.sql.hr.device import Device, DeviceAssignment  # noqa: F401
from app.models.sql.hr.hr_note import HRNote  # noqa: F401
from app.models.sql.hr.hr_celebration import HRCelebration  # noqa: F401

# --- Documents ---
from app.models.sql.core.document import Document  # noqa: F401
from app.models.sql.core.document_type import DocumentType  # noqa: F401

# --- Audit & approvals ---
from app.models.sql.core.audit_log import AuditLog  # noqa: F401
from app.models.sql.hr.approval import ApprovalRequest, ApprovalComment  # noqa: F401


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