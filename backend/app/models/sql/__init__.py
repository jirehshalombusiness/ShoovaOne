from app.models.sql.base import Base, BaseModel, GUID

from app.models.sql.core.user import User, Person
from app.models.sql.core.role import (
    Role,
    Permission,
    user_roles,
    role_permissions,
    user_permissions,
)
from app.models.sql.core.organisation import Organisation, Department, Programme
from app.models.sql.core.notification import Notification
from app.models.sql.core.password_reset_token import PasswordResetToken
from app.models.sql.core.audit_log import AuditLog
from app.models.sql.core.document import Document
from app.models.sql.core.document_type import DocumentType

from app.models.sql.hr.approval import ApprovalRequest, ApprovalComment
from app.models.sql.hr.leave import LeaveType, LeaveBalance, LeaveRequest
from app.models.sql.hr.public_holiday import PublicHoliday
from app.models.sql.hr.compensation import CompensationChange
from app.models.sql.hr.compensation_request import CompensationRequest
from app.models.sql.hr.employment_contract import EmploymentContract
from app.models.sql.hr.hr_note import HRNote
from app.models.sql.hr.device import Device, DeviceAssignment

from app.models.sql.finance.expense import Expense
from app.models.sql.finance.reimbursement import Reimbursement
from app.models.sql.finance.invoice import Invoice
from app.models.sql.finance.payment import Payment
from app.models.sql.finance.budget import Budget
from app.models.sql.finance.allocation import Allocation
from app.models.sql.finance.fund_request import FundRequest

from app.models.sql.projects.project import Project, ProjectMember, Milestone, Task

from app.models.sql.timekeeping.attendance import Attendance
from app.models.sql.timekeeping.work_session import WorkSession
from app.models.sql.timekeeping.timesheet import (
    Timesheet,
    TimesheetEntry,
    TimesheetApprovalHistory,
)

from app.models.sql.payroll import (
    PayPeriod,
    PayGroup,
    StatutoryScheme,
    TaxBand,
    PayComponentType,
    EmployeePayProfile,
    EmployeeBankAccount,
    RecurringComponent,
    Loan,
    LoanInstallment,
    PayRun,
    PayRunItem,
    PayRunLine,
    PayRunApproval,
    PayRunTimesheet,
    PayAdjustment,
    StatutoryRemittance,
    PayrollGLEntry,
    DisbursementBatch,
    DisbursementItem,
    Payslip,
)

from app.models.sql.crm.opportunity import (
    Opportunity,
    OpportunityContributor,
    OpportunityActivity,
    OpportunityStageHistory,
)

from app.models.sql.meetings.meeting import (
    Meeting,
    MeetingAttendee,
    MeetingAgendaItem,
)

from app.models.sql.events.event import Event, EventAttendee

from app.models.sql.chat import Conversation, ConversationMember, ChatMessage

__all__ = [
    "Base",
    "BaseModel",
    "GUID",
    "User",
    "Person",
    "Role",
    "Permission",
    "user_roles",
    "role_permissions",
    "user_permissions",
    "Organisation",
    "Department",
    "Programme",
    "Notification",
    "PasswordResetToken",
    "AuditLog",
    "Document",
    "DocumentType",
    "ApprovalRequest",
    "ApprovalComment",
    "LeaveType",
    "LeaveBalance",
    "LeaveRequest",
    "PublicHoliday",
    "CompensationChange",
    "CompensationRequest",
    "EmploymentContract",
    "HRNote",
    "Device",
    "DeviceAssignment",
    "Expense",
    "Reimbursement",
    "Invoice",
    "Payment",
    "Budget",
    "Allocation",
    "FundRequest",
    "Project",
    "ProjectMember",
    "Milestone",
    "Task",
    "Attendance",
    "WorkSession",
    "Timesheet",
    "TimesheetEntry",
    "TimesheetApprovalHistory",
    "PayPeriod",
    "PayGroup",
    "StatutoryScheme",
    "TaxBand",
    "PayComponentType",
    "EmployeePayProfile",
    "EmployeeBankAccount",
    "RecurringComponent",
    "Loan",
    "LoanInstallment",
    "PayRun",
    "PayRunItem",
    "PayRunLine",
    "PayRunApproval",
    "PayRunTimesheet",
    "PayAdjustment",
    "StatutoryRemittance",
    "PayrollGLEntry",
    "DisbursementBatch",
    "DisbursementItem",
    "Payslip",
    "Opportunity",
    "OpportunityContributor",
    "OpportunityActivity",
    "OpportunityStageHistory",
    "Meeting",
    "MeetingAttendee",
    "MeetingAgendaItem",
    "Event",
    "EventAttendee",
    "Conversation",
    "ConversationMember",
    "ChatMessage",
]
