from datetime import date
from decimal import Decimal

import pytest

from app.services.payroll.calculator import (
    ComponentInput,
    LoanInput,
    PayCalculationInput,
    StatutorySchemeInput,
    TaxBandInput,
    calculate_pay,
    calculate_progressive_tax,
    working_days,
)

GHANA_BANDS = (
    TaxBandInput(Decimal("0"), Decimal("490"), Decimal("0")),
    TaxBandInput(Decimal("490"), Decimal("600"), Decimal("0.05")),
    TaxBandInput(Decimal("600"), Decimal("730"), Decimal("0.10")),
    TaxBandInput(Decimal("730"), Decimal("3896.67"), Decimal("0.175")),
    TaxBandInput(Decimal("3896.67"), Decimal("19896.67"), Decimal("0.25")),
    TaxBandInput(Decimal("19896.67"), Decimal("50416.67"), Decimal("0.30")),
    TaxBandInput(Decimal("50416.67"), None, Decimal("0.35")),
)


def statutory_schemes():
    return [
        StatutorySchemeInput(
            id="ssnit",
            code="SSNIT",
            name="SSNIT Tier 1",
            scheme_type="social_security",
            employee_rate=Decimal("0.055"),
            employer_rate=Decimal("0.13"),
            base="basic",
            priority=10,
        ),
        StatutorySchemeInput(
            id="paye",
            code="PAYE",
            name="PAYE",
            scheme_type="tax",
            base="taxable",
            priority=20,
            bands=GHANA_BANDS,
        ),
    ]


def salaried_payload(**overrides):
    values = {
        "pay_type": "salaried",
        "base_amount": Decimal("5000"),
        "period_start": date(2026, 10, 1),
        "period_end": date(2026, 10, 31),
        "pay_date": date(2026, 10, 28),
        "statutory_schemes": statutory_schemes(),
    }
    values.update(overrides)
    return PayCalculationInput(**values)


def test_working_days_excludes_weekends():
    assert working_days(date(2026, 10, 1), date(2026, 10, 31)) == 22


def test_progressive_tax_is_calculated_band_by_band():
    assert calculate_progressive_tax(Decimal("4725"), GHANA_BANDS) == Decimal("779.75")
    assert calculate_progressive_tax(Decimal("0"), GHANA_BANDS) == Decimal("0")


def test_salaried_paye_and_ssnit():
    result = calculate_pay(salaried_payload())

    assert result.gross_pay == Decimal("5000.00")
    assert result.net_pay == Decimal("3945.25")
    assert result.total_employee_deductions == Decimal("1054.75")
    assert result.total_employer_contributions == Decimal("650.00")
    assert result.employer_cost == Decimal("5650.00")
    assert result.exceptions == []
    assert result.held is False


def test_hourly_employee_is_paid_only_for_hours():
    result = calculate_pay(
        PayCalculationInput(
            pay_type="hourly",
            base_amount=Decimal("5000"),
            hourly_rate=Decimal("40"),
            regular_hours=Decimal("160"),
            overtime_hours=Decimal("10"),
            overtime_eligible=True,
            period_start=date(2026, 10, 1),
            period_end=date(2026, 10, 31),
            pay_date=date(2026, 10, 28),
        )
    )

    assert result.gross_pay == Decimal("7000.00")
    assert result.basic_pay == Decimal("6400.00")
    codes = {line.code: line.amount for line in result.lines}
    assert codes["HOURLY_REGULAR"] == Decimal("6400.00")
    assert codes["OVERTIME"] == Decimal("600.00")
    assert "BASIC" not in codes


def test_salary_is_prorated_for_a_mid_month_start():
    result = calculate_pay(
        salaried_payload(
            eligible_from=date(2026, 10, 16),
            eligible_to=date(2026, 10, 31),
        )
    )

    assert result.gross_pay == Decimal("2500.00")
    assert any("prorated" in message.lower() for message in result.exceptions)


def test_percentage_deduction_and_loan_are_capped_by_net_pay():
    result = calculate_pay(
        PayCalculationInput(
            pay_type="salaried",
            base_amount=Decimal("1000"),
            period_start=date(2026, 10, 1),
            period_end=date(2026, 10, 31),
            pay_date=date(2026, 10, 28),
            deductions=[
                ComponentInput(
                    code="UNION",
                    name="Union dues",
                    calculation="percent",
                    rate=Decimal("0.05"),
                    priority=10,
                )
            ],
            loans=[
                LoanInput(
                    id="loan-1",
                    name="Staff loan",
                    installment_amount=Decimal("1000"),
                    outstanding_balance=Decimal("5000"),
                    priority=30,
                )
            ],
        )
    )

    assert result.gross_pay == Decimal("1000.00")
    assert result.total_employee_deductions == Decimal("1000.00")
    assert result.net_pay == Decimal("0.00")
    assert result.held is False

    union = next(line for line in result.lines if line.code == "UNION")
    loan = next(line for line in result.lines if line.code == "STAFF_LOAN")
    assert union.amount == Decimal("50.00")
    assert loan.amount == Decimal("950.00")
    assert "carried forward" in (loan.notes or "").lower()


def test_employer_contribution_does_not_reduce_net_pay():
    result = calculate_pay(
        PayCalculationInput(
            pay_type="salaried",
            base_amount=Decimal("3000"),
            period_start=date(2026, 10, 1),
            period_end=date(2026, 10, 31),
            pay_date=date(2026, 10, 28),
            employer_contributions=[
                ComponentInput(
                    code="PENSION",
                    name="Employer pension",
                    calculation="percent",
                    rate=Decimal("0.05"),
                    category="employer_contribution",
                )
            ],
        )
    )

    assert result.net_pay == Decimal("3000.00")
    assert result.total_employer_contributions == Decimal("150.00")
    assert result.employer_cost == Decimal("3150.00")


def test_statutory_deductions_cannot_make_net_pay_negative():
    result = calculate_pay(
        PayCalculationInput(
            pay_type="salaried",
            base_amount=Decimal("100"),
            period_start=date(2026, 10, 1),
            period_end=date(2026, 10, 31),
            pay_date=date(2026, 10, 28),
            statutory_schemes=[
                StatutorySchemeInput(
                    id="ssnit",
                    code="SSNIT",
                    name="SSNIT",
                    scheme_type="social_security",
                    employee_rate=Decimal("0.50"),
                    base="basic",
                    priority=10,
                )
            ],
            deductions=[
                ComponentInput(
                    code="ADVANCE",
                    name="Salary advance",
                    amount=Decimal("100"),
                    priority=10,
                )
            ],
        )
    )

    assert result.gross_pay == Decimal("100.00")
    assert result.net_pay >= Decimal("0.00")
    assert result.total_employee_deductions <= result.gross_pay
