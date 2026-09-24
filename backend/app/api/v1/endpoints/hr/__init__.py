from fastapi import APIRouter

from app.api.v1.endpoints.hr import me
from app.api.v1.endpoints.hr import approvals
from app.api.v1.endpoints.hr import employees
from app.api.v1.endpoints.hr import time_off
from app.api.v1.endpoints.hr import leave_policies
from app.api.v1.endpoints.hr import contracts
from app.api.v1.endpoints.hr import compensation
from app.api.v1.endpoints.hr import celebrations
from app.api.v1.endpoints.hr import documents
from app.api.v1.endpoints.hr import reports
from app.api.v1.endpoints.hr import org_chart
from app.api.v1.endpoints.hr import me_compensation


router = APIRouter()

router.include_router(me.router)
router.include_router(
    approvals.router,
    prefix="/hr/approvals",
    tags=["hr-approvals"],
)
router.include_router(employees.router,     prefix="/hr/employees",     tags=["hr-employees"])
router.include_router(time_off.router,      prefix="/hr/time-off",      tags=["hr-time-off"])
router.include_router(leave_policies.router, prefix="/hr/leave-policies", tags=["hr-leave-policies"])
router.include_router(contracts.router,     prefix="/hr/contracts",     tags=["hr-contracts"])
router.include_router(compensation.router,  prefix="/hr/compensation",  tags=["hr-compensation"])
router.include_router(celebrations.router,  prefix="/hr/celebrations",  tags=["hr-celebrations"])
router.include_router(documents.router,     prefix="/hr/documents",     tags=["hr-documents"])
router.include_router(reports.router,       prefix="/hr/reports",       tags=["hr-reports"])
router.include_router(org_chart.router,     prefix="/hr/org-chart",     tags=["hr-org-chart"])
router.include_router(me_compensation.router, prefix="/me",             tags=["hr-me"])