from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_permission
from app.models.sql.expense import Expense
from app.models.sql.fund_request import FundRequest
from app.models.sql.project import Project
from app.models.sql.user import User
from app.schemas.finance import FinanceOverviewResponse
from app.services.finance_access_service import FinanceAccessService


router = APIRouter(tags=["finance"])


@router.get(
    "/overview",
    response_model=FinanceOverviewResponse,
)
async def get_finance_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    """
    Return the Finance dashboard overview.

    Organization-wide finance roles can see all records.
    Other users are limited to their own requests/expenses
    and records belonging to projects they manage.
    """

    can_view_all = await FinanceAccessService.can_view_all(
        db,
        current_user,
    )

    if not can_view_all and not current_user.person_id:
        raise HTTPException(
            status_code=400,
            detail="User is not linked to a person record.",
        )

    # ---------------------------------------------------------
    # Access scope
    # ---------------------------------------------------------

    fund_request_conditions = []
    expense_conditions = []

    if not can_view_all:
        project_manager_subquery = select(Project.id).where(
            Project.manager_id == current_user.person_id
        )

        fund_request_conditions = [
            or_(
                FundRequest.requester_id == current_user.person_id,
                FundRequest.project_id.in_(project_manager_subquery),
            )
        ]

        expense_conditions = [
            or_(
                Expense.requester_id == current_user.person_id,
                Expense.project_id.in_(project_manager_subquery),
            )
        ]

    # ---------------------------------------------------------
    # Fund Request metrics
    # ---------------------------------------------------------

    fund_request_query = select(
        func.count(FundRequest.id),
        func.coalesce(
            func.sum(FundRequest.amount_requested),
            0,
        ),
        func.coalesce(
            func.sum(FundRequest.approved_amount),
            0,
        ),
        func.coalesce(
            func.sum(FundRequest.amount_disbursed),
            0,
        ),
    )

    if fund_request_conditions:
        fund_request_query = fund_request_query.where(
            *fund_request_conditions
        )

    fund_request_result = await db.execute(
        fund_request_query
    )

    (
        total_fund_requests,
        total_funds_requested,
        total_funds_approved,
        total_funds_disbursed,
    ) = fund_request_result.one()

    # Pending fund requests
    pending_fund_request_query = select(
        func.count(FundRequest.id)
    ).where(
        FundRequest.status.in_(
            ["submitted", "under_review"]
        )
    )

    if fund_request_conditions:
        pending_fund_request_query = (
            pending_fund_request_query.where(
                *fund_request_conditions
            )
        )

    pending_fund_request_result = await db.execute(
        pending_fund_request_query
    )

    pending_fund_requests = (
        pending_fund_request_result.scalar() or 0
    )

    # Approved fund requests
    approved_fund_request_query = select(
        func.count(FundRequest.id)
    ).where(
        FundRequest.status == "approved"
    )

    if fund_request_conditions:
        approved_fund_request_query = (
            approved_fund_request_query.where(
                *fund_request_conditions
            )
        )

    approved_fund_request_result = await db.execute(
        approved_fund_request_query
    )

    approved_fund_requests = (
        approved_fund_request_result.scalar() or 0
    )

    # Fund requests requiring reconciliation
    fund_reconciliation_query = select(
        func.count(FundRequest.id)
    ).where(
        FundRequest.status == "disbursed"
    )

    if fund_request_conditions:
        fund_reconciliation_query = (
            fund_reconciliation_query.where(
                *fund_request_conditions
            )
        )

    fund_reconciliation_result = await db.execute(
        fund_reconciliation_query
    )

    fund_requests_requiring_reconciliation = (
        fund_reconciliation_result.scalar() or 0
    )

    # ---------------------------------------------------------
    # Expense metrics
    # ---------------------------------------------------------

    expense_query = select(
        func.count(Expense.id),
        func.coalesce(
            func.sum(Expense.amount),
            0,
        ),
    )

    if expense_conditions:
        expense_query = expense_query.where(
            *expense_conditions
        )

    expense_result = await db.execute(
        expense_query
    )

    (
        total_expenses,
        total_expense_amount,
    ) = expense_result.one()

    # Pending expenses
    pending_expense_query = select(
        func.count(Expense.id)
    ).where(
        Expense.status.in_(
            ["submitted", "under_review"]
        )
    )

    if expense_conditions:
        pending_expense_query = (
            pending_expense_query.where(
                *expense_conditions
            )
        )

    pending_expense_result = await db.execute(
        pending_expense_query
    )

    pending_expenses = (
        pending_expense_result.scalar() or 0
    )

    # Approved expenses
    approved_expense_query = select(
        func.count(Expense.id)
    ).where(
        Expense.status == "approved"
    )

    if expense_conditions:
        approved_expense_query = (
            approved_expense_query.where(
                *expense_conditions
            )
        )

    approved_expense_result = await db.execute(
        approved_expense_query
    )

    approved_expenses = (
        approved_expense_result.scalar() or 0
    )

    # Paid expenses
    paid_expense_query = select(
        func.coalesce(
            func.sum(Expense.amount),
            0,
        )
    ).where(
        Expense.status.in_(
            ["paid", "reconciled"]
        )
    )

    if expense_conditions:
        paid_expense_query = (
            paid_expense_query.where(
                *expense_conditions
            )
        )

    paid_expense_result = await db.execute(
        paid_expense_query
    )

    total_paid_expenses = (
        paid_expense_result.scalar() or 0
    )

    # Expenses requiring reconciliation
    expense_reconciliation_query = select(
        func.count(Expense.id)
    ).where(
        Expense.status == "paid"
    )

    if expense_conditions:
        expense_reconciliation_query = (
            expense_reconciliation_query.where(
                *expense_conditions
            )
        )

    expense_reconciliation_result = await db.execute(
        expense_reconciliation_query
    )

    expenses_requiring_reconciliation = (
        expense_reconciliation_result.scalar() or 0
    )

    # ---------------------------------------------------------
    # Response
    # ---------------------------------------------------------

    return FinanceOverviewResponse(
        total_fund_requests=total_fund_requests or 0,
        pending_fund_requests=pending_fund_requests,
        approved_fund_requests=approved_fund_requests,
        total_funds_requested=total_funds_requested,
        total_funds_approved=total_funds_approved,
        total_funds_disbursed=total_funds_disbursed,
        total_expenses=total_expenses or 0,
        pending_expenses=pending_expenses,
        approved_expenses=approved_expenses,
        total_expense_amount=total_expense_amount,
        total_paid_expenses=total_paid_expenses,
        expenses_requiring_reconciliation=(
            expenses_requiring_reconciliation
        ),
        fund_requests_requiring_reconciliation=(
            fund_requests_requiring_reconciliation
        ),
    )