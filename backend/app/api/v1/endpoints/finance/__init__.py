from fastapi import APIRouter

from app.api.v1.endpoints.finance import (
    allocations,
    budgets,
    expenses,
    finance,
    finance_overview,
    financial_reports,
    fund_requests_me,
    invoices,
    payments,
    reimbursements,
)

router = APIRouter()

router.include_router(finance.router, prefix="/finance", tags=["finance"])
router.include_router(
    fund_requests_me.router,
    prefix="/finance/me",
    tags=["finance"],
)
router.include_router(expenses.router, prefix="/finance", tags=["finance"])
router.include_router(reimbursements.router, prefix="/finance", tags=["finance"])
router.include_router(invoices.router, prefix="/finance", tags=["finance"])
router.include_router(finance_overview.router, prefix="/finance", tags=["finance"])
router.include_router(payments.router, prefix="/finance", tags=["finance"])
router.include_router(budgets.router, prefix="/finance", tags=["finance"])
router.include_router(allocations.router, prefix="/finance", tags=["finance"])
router.include_router(
    financial_reports.router,
    prefix="/finance",
    tags=["finance"],
)
