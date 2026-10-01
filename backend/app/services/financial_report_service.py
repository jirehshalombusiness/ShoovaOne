from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sql.budget import Budget
from app.models.sql.expense import Expense
from app.models.sql.fund_request import FundRequest
from app.models.sql.invoice import Invoice
from app.models.sql.payment import Payment
from app.models.sql.reimbursement import Reimbursement


ZERO = Decimal("0.00")


class FinancialReportService:
    """
    Centralised financial reporting calculations.

    This service does not create or maintain a separate financial-report
    database table. Reports are calculated directly from the existing
    Finance records.

    Important:
    - Amounts are never combined across different currencies.
    - Reports are grouped by currency where necessary.
    - Expenses and reimbursements are treated as expenditure.
    - Fund-request disbursements represent funds released.
    - Invoice payments represent income/receivables activity.
    """

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _decimal(value: Any) -> Decimal:
        if value is None:
            return ZERO

        if isinstance(value, Decimal):
            return value

        return Decimal(str(value))

    @staticmethod
    def _normalise_currency(currency: Optional[str]) -> Optional[str]:
        if not currency:
            return None

        return currency.strip().upper()

    @staticmethod
    def _amount(
        amount: Any,
        currency: Optional[str],
        target_currency: Optional[str],
    ) -> Decimal:
        """
        Return amount only when the record currency matches the requested
        reporting currency.

        We intentionally do not perform an FX conversion here. The existing
        Finance module supports multiple currencies, and silently combining
        GHS, USD, EUR, etc. would produce incorrect reports.
        """
        if target_currency is None:
            return ZERO

        if not currency:
            return ZERO

        if currency.upper() != target_currency.upper():
            return ZERO

        return FinancialReportService._decimal(amount)

    @staticmethod
    async def _sum_amount(
        db: AsyncSession,
        model: Any,
        amount_column: Any,
        currency_column: Any,
        *,
        currency: str,
        conditions: Optional[list[Any]] = None,
    ) -> Decimal:
        conditions = conditions or []

        query = select(
            func.coalesce(
                func.sum(amount_column),
                0,
            )
        ).where(
            currency_column == currency,
            *conditions,
        )

        result = await db.execute(query)

        return FinancialReportService._decimal(
            result.scalar_one()
        )

    # ------------------------------------------------------------------
    # Financial Summary
    # ------------------------------------------------------------------

    @staticmethod
    async def get_financial_summary(
        db: AsyncSession,
        *,
        currency: str = "GHS",
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> dict[str, Any]:
        """
        Build the high-level Finance dashboard/report summary.

        Includes:
        - total budgets
        - total approved budgets
        - total fund requests
        - total funds approved
        - total funds disbursed
        - total expenses
        - total paid expenses
        - total reimbursements
        - total paid reimbursements
        - total invoiced
        - total received
        - outstanding receivables
        """

        currency = FinancialReportService._normalise_currency(
            currency
        ) or "GHS"

        budget_conditions = [
            Budget.currency == currency,
        ]

        fund_conditions = [
            FundRequest.currency == currency,
        ]

        expense_conditions = [
            Expense.currency == currency,
        ]

        reimbursement_conditions = [
            Reimbursement.currency == currency,
        ]

        invoice_conditions = [
            Invoice.currency == currency,
        ]

        payment_conditions = [
            Payment.currency == currency,
        ]

        if start_date:
            budget_conditions.append(
                Budget.start_date >= start_date
            )

            fund_conditions.append(
                FundRequest.created_at >= start_date
            )

            expense_conditions.append(
                Expense.incurred_date >= start_date
            )

            reimbursement_conditions.append(
                Reimbursement.incurred_date >= start_date
            )

            invoice_conditions.append(
                Invoice.issue_date >= start_date
            )

            payment_conditions.append(
                Payment.payment_date >= start_date
            )

        if end_date:
            budget_conditions.append(
                Budget.end_date <= end_date
            )

            fund_conditions.append(
                FundRequest.created_at <= end_date
            )

            expense_conditions.append(
                Expense.incurred_date <= end_date
            )

            reimbursement_conditions.append(
                Reimbursement.incurred_date <= end_date
            )

            invoice_conditions.append(
                Invoice.issue_date <= end_date
            )

            payment_conditions.append(
                Payment.payment_date <= end_date
            )

        total_budget = await db.scalar(
            select(
                func.coalesce(
                    func.sum(Budget.amount),
                    0,
                )
            ).where(*budget_conditions)
        )

        total_funds_requested = await db.scalar(
            select(
                func.coalesce(
                    func.sum(FundRequest.amount_requested),
                    0,
                )
            ).where(*fund_conditions)
        )

        total_funds_approved = await db.scalar(
            select(
                func.coalesce(
                    func.sum(
                        func.coalesce(
                            FundRequest.approved_amount,
                            FundRequest.amount_requested,
                        )
                    ),
                    0,
                )
            ).where(
                *fund_conditions,
                FundRequest.status.in_(
                    [
                        "approved",
                        "disbursed",
                        "reconciled",
                    ]
                ),
            )
        )

        total_funds_disbursed = await db.scalar(
            select(
                func.coalesce(
                    func.sum(FundRequest.amount_disbursed),
                    0,
                )
            ).where(*fund_conditions)
        )

        total_expenses = await db.scalar(
            select(
                func.coalesce(
                    func.sum(Expense.amount),
                    0,
                )
            ).where(
                *expense_conditions,
                Expense.status.in_(
                    [
                        "approved",
                        "paid",
                        "reconciled",
                    ]
                ),
            )
        )

        total_paid_expenses = await db.scalar(
            select(
                func.coalesce(
                    func.sum(Expense.amount),
                    0,
                )
            ).where(
                *expense_conditions,
                Expense.status.in_(
                    [
                        "paid",
                        "reconciled",
                    ]
                ),
            )
        )

        total_reimbursements = await db.scalar(
            select(
                func.coalesce(
                    func.sum(Reimbursement.amount),
                    0,
                )
            ).where(
                *reimbursement_conditions,
                Reimbursement.status.in_(
                    [
                        "approved",
                        "paid",
                        "reconciled",
                    ]
                ),
            )
        )

        total_paid_reimbursements = await db.scalar(
            select(
                func.coalesce(
                    func.sum(Reimbursement.amount),
                    0,
                )
            ).where(
                *reimbursement_conditions,
                Reimbursement.status.in_(
                    [
                        "paid",
                        "reconciled",
                    ]
                ),
            )
        )

        total_invoiced = await db.scalar(
            select(
                func.coalesce(
                    func.sum(Invoice.amount),
                    0,
                )
            ).where(
                *invoice_conditions,
                Invoice.status.in_(
                    [
                        "issued",
                        "partially_paid",
                        "paid",
                    ]
                ),
            )
        )

        total_received = await db.scalar(
            select(
                func.coalesce(
                    func.sum(Payment.amount),
                    0,
                )
            ).where(
                *payment_conditions,
                Payment.status == "completed",
            )
        )

        total_outstanding = (
            FinancialReportService._decimal(
                total_invoiced
            )
            - FinancialReportService._decimal(
                total_received
            )
        )

        total_expenditure = (
            FinancialReportService._decimal(
                total_expenses
            )
            + FinancialReportService._decimal(
                total_reimbursements
            )
        )

        return {
            "currency": currency,
            "period": {
                "start_date": start_date,
                "end_date": end_date,
            },
            "total_budget": FinancialReportService._decimal(
                total_budget
            ),
            "total_funds_requested": FinancialReportService._decimal(
                total_funds_requested
            ),
            "total_funds_approved": FinancialReportService._decimal(
                total_funds_approved
            ),
            "total_funds_disbursed": FinancialReportService._decimal(
                total_funds_disbursed
            ),
            "total_expenses": FinancialReportService._decimal(
                total_expenses
            ),
            "total_paid_expenses": FinancialReportService._decimal(
                total_paid_expenses
            ),
            "total_reimbursements": FinancialReportService._decimal(
                total_reimbursements
            ),
            "total_paid_reimbursements": FinancialReportService._decimal(
                total_paid_reimbursements
            ),
            "total_expenditure": total_expenditure,
            "total_invoiced": FinancialReportService._decimal(
                total_invoiced
            ),
            "total_received": FinancialReportService._decimal(
                total_received
            ),
            "outstanding_receivables": total_outstanding,
        }

    # ------------------------------------------------------------------
    # Budget vs Actual
    # ------------------------------------------------------------------

    @staticmethod
    async def get_budget_vs_actual(
        db: AsyncSession,
        *,
        currency: str = "GHS",
        fiscal_year: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """
        Compare each budget against actual expenditure.

        Actual expenditure is calculated from:
        - approved/paid/reconciled expenses
        - approved/paid/reconciled reimbursements

        Draft and rejected records are excluded.
        """

        currency = FinancialReportService._normalise_currency(
            currency
        ) or "GHS"

        conditions = [
            Budget.currency == currency,
        ]

        if fiscal_year:
            conditions.append(
                Budget.fiscal_year == fiscal_year
            )

        budget_result = await db.execute(
            select(Budget)
            .where(*conditions)
            .order_by(
                Budget.start_date.asc(),
                Budget.name.asc(),
            )
        )

        budgets = budget_result.scalars().all()

        reports: list[dict[str, Any]] = []

        for budget in budgets:
            expense_conditions = [
                Expense.currency == currency,
                Expense.status.in_(
                    [
                        "approved",
                        "paid",
                        "reconciled",
                    ]
                ),
                Expense.incurred_date >= budget.start_date,
                Expense.incurred_date <= budget.end_date,
            ]

            reimbursement_conditions = [
                Reimbursement.currency == currency,
                Reimbursement.status.in_(
                    [
                        "approved",
                        "paid",
                        "reconciled",
                    ]
                ),
                Reimbursement.incurred_date >= budget.start_date,
                Reimbursement.incurred_date <= budget.end_date,
            ]

            # Respect the budget's programme/department/project
            # scope where one is defined.
            if budget.department_id:
                expense_conditions.append(
                    Expense.department_id
                    == budget.department_id
                )

                reimbursement_conditions.append(
                    Reimbursement.department_id
                    == budget.department_id
                )

            if budget.programme_id:
                expense_conditions.append(
                    Expense.programme_id
                    == budget.programme_id
                )

                reimbursement_conditions.append(
                    Reimbursement.programme_id
                    == budget.programme_id
                )

            if budget.project_id:
                expense_conditions.append(
                    Expense.project_id
                    == budget.project_id
                )

                reimbursement_conditions.append(
                    Reimbursement.project_id
                    == budget.project_id
                )

            expenses = await db.scalar(
                select(
                    func.coalesce(
                        func.sum(Expense.amount),
                        0,
                    )
                ).where(*expense_conditions)
            )

            reimbursements = await db.scalar(
                select(
                    func.coalesce(
                        func.sum(Reimbursement.amount),
                        0,
                    )
                ).where(*reimbursement_conditions)
            )

            spent = (
                FinancialReportService._decimal(expenses)
                + FinancialReportService._decimal(
                    reimbursements
                )
            )

            budget_amount = FinancialReportService._decimal(
                budget.amount
            )

            remaining = budget_amount - spent

            utilisation = (
                (spent / budget_amount) * Decimal("100")
                if budget_amount > ZERO
                else ZERO
            )

            reports.append(
                {
                    "budget_id": str(budget.id),
                    "budget_number": budget.budget_number,
                    "name": budget.name,
                    "fiscal_year": budget.fiscal_year,
                    "currency": budget.currency,
                    "budget_amount": budget_amount,
                    "spent": spent,
                    "remaining": remaining,
                    "utilisation_percentage": utilisation,
                    "status": budget.status,
                    "department_id": (
                        str(budget.department_id)
                        if budget.department_id
                        else None
                    ),
                    "programme_id": (
                        str(budget.programme_id)
                        if budget.programme_id
                        else None
                    ),
                    "project_id": (
                        str(budget.project_id)
                        if budget.project_id
                        else None
                    ),
                }
            )

        return reports

    # ------------------------------------------------------------------
    # Income & Expenditure
    # ------------------------------------------------------------------

    @staticmethod
    async def get_income_expenditure(
        db: AsyncSession,
        *,
        currency: str = "GHS",
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> dict[str, Any]:
        """
        Income = completed invoice payments.

        Expenditure =
        approved/paid/reconciled expenses +
        approved/paid/reconciled reimbursements.
        """

        currency = FinancialReportService._normalise_currency(
            currency
        ) or "GHS"

        payment_conditions = [
            Payment.currency == currency,
            Payment.status == "completed",
        ]

        expense_conditions = [
            Expense.currency == currency,
            Expense.status.in_(
                [
                    "approved",
                    "paid",
                    "reconciled",
                ]
            ),
        ]

        reimbursement_conditions = [
            Reimbursement.currency == currency,
            Reimbursement.status.in_(
                [
                    "approved",
                    "paid",
                    "reconciled",
                ]
            ),
        ]

        if start_date:
            payment_conditions.append(
                Payment.payment_date >= start_date
            )

            expense_conditions.append(
                Expense.incurred_date >= start_date
            )

            reimbursement_conditions.append(
                Reimbursement.incurred_date >= start_date
            )

        if end_date:
            payment_conditions.append(
                Payment.payment_date <= end_date
            )

            expense_conditions.append(
                Expense.incurred_date <= end_date
            )

            reimbursement_conditions.append(
                Reimbursement.incurred_date <= end_date
            )

        income = await db.scalar(
            select(
                func.coalesce(
                    func.sum(Payment.amount),
                    0,
                )
            ).where(*payment_conditions)
        )

        expenses = await db.scalar(
            select(
                func.coalesce(
                    func.sum(Expense.amount),
                    0,
                )
            ).where(*expense_conditions)
        )

        reimbursements = await db.scalar(
            select(
                func.coalesce(
                    func.sum(Reimbursement.amount),
                    0,
                )
            ).where(*reimbursement_conditions)
        )

        income_amount = FinancialReportService._decimal(
            income
        )

        expense_amount = FinancialReportService._decimal(
            expenses
        )

        reimbursement_amount = (
            FinancialReportService._decimal(
                reimbursements
            )
        )

        total_expenditure = (
            expense_amount + reimbursement_amount
        )

        net_cash_flow = income_amount - total_expenditure

        return {
            "currency": currency,
            "period": {
                "start_date": start_date,
                "end_date": end_date,
            },
            "income": income_amount,
            "expenses": expense_amount,
            "reimbursements": reimbursement_amount,
            "total_expenditure": total_expenditure,
            "net_cash_flow": net_cash_flow,
        }

    # ------------------------------------------------------------------
    # Receivables
    # ------------------------------------------------------------------

    @staticmethod
    async def get_receivables(
        db: AsyncSession,
        *,
        currency: str = "GHS",
        include_paid: bool = False,
    ) -> list[dict[str, Any]]:
        """
        Return invoice-level receivables.

        Overdue is derived from the invoice due date rather than stored as
        a permanent status.
        """

        currency = FinancialReportService._normalise_currency(
            currency
        ) or "GHS"

        conditions = [
            Invoice.currency == currency,
            Invoice.status.in_(
                [
                    "issued",
                    "partially_paid",
                    "paid",
                ]
            ),
        ]

        if not include_paid:
            conditions.append(
                Invoice.status != "paid"
            )

        result = await db.execute(
            select(Invoice)
            .where(*conditions)
            .order_by(
                Invoice.due_date.asc(),
            )
        )

        invoices = result.scalars().all()

        today = date.today()

        reports: list[dict[str, Any]] = []

        for invoice in invoices:
            amount = FinancialReportService._decimal(
                invoice.amount
            )

            amount_paid = FinancialReportService._decimal(
                invoice.amount_paid
            )

            outstanding = amount - amount_paid

            overdue = (
                outstanding > ZERO
                and invoice.due_date < today
            )

            reports.append(
                {
                    "invoice_id": str(invoice.id),
                    "invoice_number": invoice.invoice_number,
                    "customer_name": invoice.customer_name,
                    "customer_email": invoice.customer_email,
                    "currency": invoice.currency,
                    "issue_date": invoice.issue_date,
                    "due_date": invoice.due_date,
                    "amount": amount,
                    "amount_paid": amount_paid,
                    "outstanding": outstanding,
                    "status": invoice.status,
                    "overdue": overdue,
                }
            )

        return reports

    # ------------------------------------------------------------------
    # Fund Flow
    # ------------------------------------------------------------------

    @staticmethod
    async def get_fund_flow(
        db: AsyncSession,
        *,
        currency: str = "GHS",
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> dict[str, Any]:
        """
        Show the movement of funds through the main Finance workflows.

        Inflow:
            completed invoice payments

        Outflow:
            fund request disbursements
            paid/reconciled expenses
            paid/reconciled reimbursements
        """

        currency = FinancialReportService._normalise_currency(
            currency
        ) or "GHS"

        payment_conditions = [
            Payment.currency == currency,
            Payment.status == "completed",
        ]

        fund_conditions = [
            FundRequest.currency == currency,
            FundRequest.amount_disbursed > ZERO,
        ]

        expense_conditions = [
            Expense.currency == currency,
            Expense.status.in_(
                [
                    "paid",
                    "reconciled",
                ]
            ),
        ]

        reimbursement_conditions = [
            Reimbursement.currency == currency,
            Reimbursement.status.in_(
                [
                    "paid",
                    "reconciled",
                ]
            ),
        ]

        if start_date:
            payment_conditions.append(
                Payment.payment_date >= start_date
            )

            fund_conditions.append(
                FundRequest.disbursed_at >= start_date
            )

            expense_conditions.append(
                Expense.paid_at >= start_date
            )

            reimbursement_conditions.append(
                Reimbursement.paid_at >= start_date
            )

        if end_date:
            payment_conditions.append(
                Payment.payment_date <= end_date
            )

            fund_conditions.append(
                FundRequest.disbursed_at <= end_date
            )

            expense_conditions.append(
                Expense.paid_at <= end_date
            )

            reimbursement_conditions.append(
                Reimbursement.paid_at <= end_date
            )

        inflow = await db.scalar(
            select(
                func.coalesce(
                    func.sum(Payment.amount),
                    0,
                )
            ).where(*payment_conditions)
        )

        fund_disbursements = await db.scalar(
            select(
                func.coalesce(
                    func.sum(FundRequest.amount_disbursed),
                    0,
                )
            ).where(*fund_conditions)
        )

        expense_outflow = await db.scalar(
            select(
                func.coalesce(
                    func.sum(Expense.amount),
                    0,
                )
            ).where(*expense_conditions)
        )

        reimbursement_outflow = await db.scalar(
            select(
                func.coalesce(
                    func.sum(Reimbursement.amount),
                    0,
                )
            ).where(*reimbursement_conditions)
        )

        income = FinancialReportService._decimal(
            inflow
        )

        disbursements = FinancialReportService._decimal(
            fund_disbursements
        )

        expenses = FinancialReportService._decimal(
            expense_outflow
        )

        reimbursements = (
            FinancialReportService._decimal(
                reimbursement_outflow
            )
        )

        total_outflow = (
            disbursements
            + expenses
            + reimbursements
        )

        net_flow = income - total_outflow

        return {
            "currency": currency,
            "period": {
                "start_date": start_date,
                "end_date": end_date,
            },
            "inflow": income,
            "fund_disbursements": disbursements,
            "expense_outflow": expenses,
            "reimbursement_outflow": reimbursements,
            "total_outflow": total_outflow,
            "net_flow": net_flow,
        }

    # ------------------------------------------------------------------
    # Currency Summary
    # ------------------------------------------------------------------

    @staticmethod
    async def get_currency_summary(
        db: AsyncSession,
    ) -> list[dict[str, Any]]:
        """
        Return the currencies currently represented in Finance.

        This is useful for the Financial Reports UI because the frontend
        should allow the user to select a reporting currency rather than
        combining currencies incorrectly.
        """

        currencies: set[str] = set()

        for model in [
            Budget,
            FundRequest,
            Expense,
            Reimbursement,
            Invoice,
            Payment,
        ]:
            result = await db.execute(
                select(model.currency).distinct()
            )

            for currency in result.scalars().all():
                if currency:
                    currencies.add(currency.upper())

        return [
            {
                "currency": currency,
            }
            for currency in sorted(currencies)
        ]