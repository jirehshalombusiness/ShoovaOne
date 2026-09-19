from fastapi import APIRouter

# ------------------------------------------------------------
# HR router package
# ------------------------------------------------------------
#
# Every HR-related sub-router is mounted from here. The parent
# api router includes this package under prefix "/api/v1".
#
# Sub-router prefixes are declared inside each module so that
# this file stays declarative and easy to read.
#
# Layout:
#
#   /me/*                  self-service (all authenticated users)
#   /hr/approvals/*        unified approval inbox
#   /hr/employees/*        HR admin: employee records
#   /hr/time-off/*         HR admin: leave oversight
#   /hr/leave-policies/*   HR admin: leave types + public holidays
#   /hr/contracts/*        HR admin: employment contracts
#   /hr/compensation/*     HR admin: compensation records
#   /hr/celebrations/*     HR admin: birthdays + anniversaries
#   /hr/documents/*        HR admin: document verification
#   /hr/reports/*          HR admin: analytics
#
# ------------------------------------------------------------

from app.api.v1.endpoints.hr import me
# from app.api.v1.endpoints.hr import approvals
# from app.api.v1.endpoints.hr import employees
# from app.api.v1.endpoints.hr import time_off
# from app.api.v1.endpoints.hr import leave_policies
# from app.api.v1.endpoints.hr import contracts
# from app.api.v1.endpoints.hr import compensation
# from app.api.v1.endpoints.hr import celebrations
# from app.api.v1.endpoints.hr import documents
# from app.api.v1.endpoints.hr import reports


router = APIRouter()

router.include_router(me.router)
# router.include_router(approvals.router)
# router.include_router(employees.router)
# router.include_router(time_off.router)
# router.include_router(leave_policies.router)
# router.include_router(contracts.router)
# router.include_router(compensation.router)
# router.include_router(celebrations.router)
# router.include_router(documents.router)
# router.include_router(reports.router)