"""Canonical permission catalog.

The database is the runtime source of truth for grants, but this catalog is
the source of truth for which permissions must exist. It is applied
idempotently at startup so newly shipped features (e.g. payroll) are always
assignable even when a migration has not been run on an environment.
"""

PERMISSION_CATALOG: tuple[tuple[str, str, str], ...] = (
    # People
    ("people", "view", "View people directory"),
    ("people", "create", "Create new people"),
    ("people", "edit", "Edit people"),
    ("people", "delete", "Delete people"),
    # HR
    ("hr", "view_basic", "View basic HR information"),
    ("hr", "view_sensitive", "View sensitive HR data"),
    ("hr", "edit_sensitive", "Edit sensitive HR data"),
    ("hr", "view_employment", "View employment information"),
    ("hr", "edit_employment", "Edit employment information"),
    ("hr", "view_compensation", "View compensation information"),
    ("hr", "edit_compensation", "Edit compensation information"),
    ("hr", "view_leave", "View leave information"),
    ("hr", "edit_leave", "Edit leave information"),
    ("hr", "view_performance", "View performance information"),
    ("hr", "edit_performance", "Edit performance information"),
    # Timesheets
    ("timesheets", "view", "View timesheets"),
    ("timesheets", "submit", "Submit timesheets"),
    ("timesheets", "approve", "Approve timesheets"),
    ("timesheets", "edit_any", "Edit any user's timesheets"),
    # Organisation
    ("organisation", "view", "View organisations, departments and programmes"),
    ("organisation", "manage", "Manage organisations, departments and programmes"),
    # Projects
    ("projects", "view", "View projects"),
    ("projects", "create", "Create projects"),
    ("projects", "edit", "Edit projects"),
    ("projects", "delete", "Delete projects"),
    # Tasks
    ("tasks", "view", "View tasks"),
    ("tasks", "create", "Create tasks"),
    ("tasks", "edit", "Edit tasks"),
    ("tasks", "delete", "Delete tasks"),
    # CRM
    ("crm", "view", "View CRM data"),
    ("crm", "create", "Create CRM records"),
    ("crm", "edit", "Edit CRM records"),
    ("crm", "delete", "Delete CRM records"),
    # Finance
    ("finance", "view", "View finance records and financial information"),
    ("finance", "create", "Create finance records and fund requests"),
    ("finance", "edit", "Edit draft finance records"),
    ("finance", "review", "Review submitted finance records"),
    ("finance", "approve", "Approve finance records"),
    ("finance", "reject", "Reject finance records"),
    ("finance", "disburse", "Record and authorize disbursements"),
    ("finance", "reconcile", "Reconcile financial transactions"),
    ("finance", "reports", "View and generate financial reports"),
    ("finance", "audit_view", "View the financial audit trail"),
    ("finance", "manage", "Manage Finance configuration and controls"),
    # Payroll
    ("payroll", "view", "View payroll records"),
    ("payroll", "view_all", "View payroll records for all employees"),
    ("payroll", "view_own", "View own payslips and pay profile"),
    ("payroll", "prepare", "Prepare pay periods and pay runs"),
    ("payroll", "review_hr", "Submit payroll to Finance on behalf of HR"),
    ("payroll", "review_finance", "Review payroll at the Finance stage"),
    ("payroll", "approve", "Give final approval for payroll"),
    ("payroll", "disburse", "Create, approve and reconcile disbursements"),
    ("payroll", "config", "Manage payroll configuration"),
    ("payroll", "reports", "View payroll reports and statutory remittances"),
    # Users, roles and administration
    ("users", "manage", "Manage user accounts"),
    ("roles", "manage", "Manage roles and permissions"),
    ("audit", "view", "View system audit logs"),
    ("system", "manage", "Manage system configuration and security"),
    # Events
    ("events", "view", "View events"),
    ("events", "create", "Create events"),
    ("events", "edit", "Edit events"),
    # Attendance
    ("attendance", "view", "View attendance records"),
    ("attendance", "view_any", "View all employees' attendance records"),
    ("attendance", "checkin", "Check in and out"),
    ("attendance", "edit", "Edit attendance records"),
    # Programmes
    ("programmes", "view", "View programmes"),
    ("programmes", "create", "Create programmes"),
    ("programmes", "edit", "Edit programmes"),
    # Documents
    ("documents", "view", "View documents"),
    ("documents", "upload", "Upload documents"),
    # Meetings
    ("meetings", "view", "View meetings"),
    ("meetings", "create", "Create meetings"),
    ("meetings", "edit", "Edit meetings"),
    ("meetings", "cancel", "Cancel meetings"),
)

CANONICAL_PERMISSIONS = frozenset(
    f"{resource}.{action}" for resource, action, _ in PERMISSION_CATALOG
)
