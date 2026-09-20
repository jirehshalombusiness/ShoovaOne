from app.models.sql.base import Base, BaseModel, GUID

# Identity & access
from app.models.sql.user import User, Person
from app.models.sql.role import (
    Role,
    Permission,
    user_roles,
    role_permissions,
    user_permissions,
)
from app.models.sql.password_reset_token import PasswordResetToken

# Core operations
from app.models.sql.attendance import Attendance
from app.models.sql.work_session import WorkSession
from app.models.sql.notification import Notification

# Projects & tasks
from app.models.sql.project import Project, ProjectMember, Milestone, Task
from app.models.sql.timesheet import (
    Timesheet,
    TimesheetEntry,
    TimesheetApprovalHistory,
)

# HR
from app.models.sql.employment_contract import EmploymentContract
from app.models.sql.leave import LeaveType, LeaveBalance, LeaveRequest
from app.models.sql.public_holiday import PublicHoliday
from app.models.sql.device import Device, DeviceAssignment
from app.models.sql.hr_note import HRNote
from app.models.sql.hr_celebration import HRCelebration

# Compensation
from app.models.sql.compensation import CompensationChange

# Documents
from app.models.sql.document import Document
from app.models.sql.document_type import DocumentType

# Audit & approvals
from app.models.sql.audit_log import AuditLog
from app.models.sql.approval import ApprovalRequest, ApprovalComment


__all__ = [
    # Base
    "Base",
    "BaseModel",
    "GUID",
    # Identity & access
    "User",
    "Person",
    "Role",
    "Permission",
    "user_roles",
    "role_permissions",
    "user_permissions",
    "PasswordResetToken",
    # Core operations
    "Attendance",
    "WorkSession",
    "Notification",
    # Projects & tasks
    "Project",
    "ProjectMember",
    "Milestone",
    "Task",
    "Timesheet",
    "TimesheetEntry",
    "TimesheetApprovalHistory",
    # HR
    "EmploymentContract",
    "LeaveType",
    "LeaveBalance",
    "LeaveRequest",
    "PublicHoliday",
    "Device",
    "DeviceAssignment",
    "HRNote",
    "HRCelebration",
    # Compensation
    "CompensationChange",
    # Documents
    "Document",
    "DocumentType",
    # Audit & approvals
    "AuditLog",
    "ApprovalRequest",
    "ApprovalComment",
]