from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_permission
from app.models.sql.user import User
from app.schemas.financial_report import (
    BudgetVsActualItem,
    CurrencySummaryResponse,
    FinancialSummaryResponse,
    FundFlowResponse,
    IncomeExpenditureResponse,
    ReceivableItem,
)
from app.services.financial_report_service import FinancialReportService


router = APIRouter(
    tags=["finance"],
)


def validate_period(
    start_date: Optional[date],
    end_date: Optional[date],
) -> None:
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date cannot be after end date.",
        )


def normalise_currency(currency: str) -> str:
    return currency.strip().upper()


@router.get(
    "/reports/summary",
    response_model=FinancialSummaryResponse,
)
async def get_financial_summary(
    currency: str = Query(
        default="GHS",
        min_length=3,
        max_length=3,
    ),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    """
    Return the financial summary for the selected currency
    and optional reporting period.
    """

    validate_period(start_date, end_date)

    currency = normalise_currency(currency)

    return await FinancialReportService.get_financial_summary(
        db=db,
        currency=currency,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/reports/budget-vs-actual",
    response_model=list[BudgetVsActualItem],
)
async def get_budget_vs_actual(
    currency: str = Query(
        default="GHS",
        min_length=3,
        max_length=3,
    ),
    fiscal_year: Optional[str] = Query(
        default=None,
        min_length=4,
        max_length=10,
    ),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    """
    Return budget-versus-actual expenditure by budget.
    """

    validate_period(start_date, end_date)

    currency = normalise_currency(currency)

    return await FinancialReportService.get_budget_vs_actual(
        db=db,
        currency=currency,
        fiscal_year=fiscal_year,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/reports/income-expenditure",
    response_model=IncomeExpenditureResponse,
)
async def get_income_expenditure(
    currency: str = Query(
        default="GHS",
        min_length=3,
        max_length=3,
    ),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    """
    Return income, expenditure, and net cash flow.
    """

    validate_period(start_date, end_date)

    currency = normalise_currency(currency)

    return await FinancialReportService.get_income_expenditure(
        db=db,
        currency=currency,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/reports/receivables",
    response_model=list[ReceivableItem],
)
async def get_receivables(
    currency: str = Query(
        default="GHS",
        min_length=3,
        max_length=3,
    ),
    include_paid: bool = Query(default=False),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    """
    Return invoice receivables and outstanding balances.
    """

    validate_period(start_date, end_date)

    currency = normalise_currency(currency)

    return await FinancialReportService.get_receivables(
        db=db,
        currency=currency,
        include_paid=include_paid,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/reports/fund-flow",
    response_model=FundFlowResponse,
)
async def get_fund_flow(
    currency: str = Query(
        default="GHS",
        min_length=3,
        max_length=3,
    ),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    """
    Return financial inflows, fund disbursements,
    expense outflows, reimbursement outflows,
    and net flow.
    """

    validate_period(start_date, end_date)

    currency = normalise_currency(currency)

    return await FinancialReportService.get_fund_flow(
        db=db,
        currency=currency,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/reports/currencies",
    response_model=CurrencySummaryResponse,
)
async def get_report_currencies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    """
    Return currencies currently represented in the
    financial records.
    """

    currencies = await FinancialReportService.get_currency_summary(
        db=db,
    )

    return CurrencySummaryResponse(
        currencies=[
            {
                "currency": item["currency"],
            }
            for item in currencies
        ]
    )