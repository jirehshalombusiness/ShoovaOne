from fastapi import APIRouter

from app.api.v1.endpoints.payroll import (
    config,
    disbursements,
    employees,
    reports,
    runs,
    self_service,
)

router = APIRouter()

router.include_router(config.router, tags=["payroll"])
router.include_router(employees.router, tags=["payroll"])
router.include_router(runs.router, tags=["payroll"])
router.include_router(disbursements.router, tags=["payroll"])
router.include_router(self_service.router, tags=["payroll"])
router.include_router(reports.router, tags=["payroll"])
