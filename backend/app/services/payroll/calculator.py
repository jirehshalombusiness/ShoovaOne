from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

ZERO = Decimal("0")
MONEY = Decimal("0.01")
RATE = Decimal("0.000001")


def dec(value) -> Decimal:
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def money(value: Decimal) -> Decimal:
    return dec(value).quantize(MONEY, rounding=ROUND_HALF_UP)


def rate(value: Decimal) -> Decimal:
    return dec(value).quantize(RATE, rounding=ROUND_HALF_UP)


def working_days(start: date, end: date) -> int:
    if end < start:
        return 0
    days = 0
    cursor = start
    while cursor <= end:
        if cursor.weekday() < 5:
            days += 1
        cursor += timedelta(days=1)
    return days


@dataclass(frozen=True)
class TaxBandInput:
    band_from: Decimal
    band_to: Optional[Decimal]
    rate: Decimal


@dataclass(frozen=True)
class StatutorySchemeInput:
    id: str
    code: str
    name: str
    scheme_type: str
    employee_rate: Decimal = ZERO
    employer_rate: Decimal = ZERO
    base: str = "basic"
    cap: Optional[Decimal] = None
    relief_amount: Decimal = ZERO
    priority: int = 100
    bands: tuple[TaxBandInput, ...] = ()


@dataclass
class ComponentInput:
    code: str
    name: str
    amount: Decimal = ZERO
    rate: Decimal = ZERO
    category: str = "earning"
    taxable: bool = True
    statutory: bool = False
    calculation: str = "fixed"
    calculation_base: str = "gross"
    priority: int = 100
    component_type_id: Optional[str] = None
    source: str = "manual"
    source_ref: Optional[str] = None
    quantity: Optional[Decimal] = None
    line_rate: Optional[Decimal] = None
    notes: Optional[str] = None


@dataclass
class LoanInput:
    id: str
    name: str
    installment_amount: Decimal
    outstanding_balance: Decimal
    priority: int = 30


@dataclass
class PayCalculationInput:
    pay_type: str = "salaried"
    base_amount: Decimal = ZERO
    hourly_rate: Decimal = ZERO
    overtime_multiplier: Decimal = Decimal("1.5")
    currency: str = "GHS"
    period_start: date = date.today()
    period_end: date = date.today()
    pay_date: date = date.today()
    proration_basis: str = "working_days"
    overtime_eligible: bool = False
    eligible_from: Optional[date] = None
    eligible_to: Optional[date] = None
    regular_hours: Decimal = ZERO
    overtime_hours: Decimal = ZERO
    unpaid_leave_days: Decimal = ZERO
    earnings: list[ComponentInput] = field(default_factory=list)
    deductions: list[ComponentInput] = field(default_factory=list)
    employer_contributions: list[ComponentInput] = field(default_factory=list)
    statutory_schemes: list[StatutorySchemeInput] = field(default_factory=list)
    loans: list[LoanInput] = field(default_factory=list)


@dataclass
class CalculationLine:
    code: str
    name: str
    category: str
    amount: Decimal
    taxable: bool = True
    statutory: bool = False
    employer: bool = False
    priority: int = 100
    component_type_id: Optional[str] = None
    source: str = "manual"
    source_ref: Optional[str] = None
    quantity: Optional[Decimal] = None
    rate: Optional[Decimal] = None
    notes: Optional[str] = None


@dataclass
class PayCalculationResult:
    gross_pay: Decimal
    basic_pay: Decimal
    taxable_gross: Decimal
    total_employee_deductions: Decimal
    total_employer_contributions: Decimal
    net_pay: Decimal
    employer_cost: Decimal
    lines: list[CalculationLine]
    exceptions: list[str]
    held: bool
    input_hash: str


def _eligible_window(payload: PayCalculationInput) -> tuple[date, date]:
    start = payload.period_start
    end = payload.period_end

    if payload.eligible_from and payload.eligible_from > start:
        start = payload.eligible_from
    if payload.eligible_to and payload.eligible_to < end:
        end = payload.eligible_to

    return start, end


def _proration_ratio(payload: PayCalculationInput) -> tuple[Decimal, int, int]:
    period_days = (payload.period_end - payload.period_start).days + 1
    if period_days <= 0:
        return ZERO, 0, 0

    start, end = _eligible_window(payload)
    if end < start:
        return ZERO, 0, period_days

    if payload.proration_basis == "calendar_days":
        eligible = (end - start).days + 1
        return dec(eligible) / dec(period_days), eligible, period_days

    period_working = working_days(payload.period_start, payload.period_end)
    eligible_working = working_days(start, end)

    if period_working <= 0:
        eligible = (end - start).days + 1
        return dec(eligible) / dec(period_days), eligible, period_days

    return dec(eligible_working) / dec(period_working), eligible_working, period_working


def calculate_progressive_tax(
    taxable_amount: Decimal,
    bands: tuple[TaxBandInput, ...] | list[TaxBandInput],
) -> Decimal:
    if taxable_amount <= ZERO:
        return ZERO

    tax = ZERO
    for band in sorted(bands, key=lambda item: dec(item.band_from)):
        lower = dec(band.band_from)
        upper = dec(band.band_to) if band.band_to is not None else None
        if taxable_amount <= lower:
            continue

        band_top = taxable_amount
        if upper is not None and upper < band_top:
            band_top = upper

        taxable_slice = band_top - lower
        if taxable_slice > ZERO:
            tax += taxable_slice * dec(band.rate)

    return money(tax)


def _scheme_base(payload: PayCalculationInput, scheme: StatutorySchemeInput, basic_pay: Decimal, gross_pay: Decimal, taxable_gross: Decimal) -> Decimal:
    if scheme.base == "gross":
        base = gross_pay
    elif scheme.base == "taxable":
        base = taxable_gross
    else:
        base = basic_pay

    if scheme.cap is not None and dec(scheme.cap) > ZERO:
        base = min(base, dec(scheme.cap))

    return max(base, ZERO)


def _input_hash(payload: PayCalculationInput) -> str:
    def encode(value):
        if isinstance(value, Decimal):
            return str(value)
        if isinstance(value, date):
            return value.isoformat()
        if hasattr(value, "__dict__"):
            return {
                key: encode(item)
                for key, item in value.__dict__.items()
                if not key.startswith("_")
            }
        if isinstance(value, (list, tuple)):
            return [encode(item) for item in value]
        return value

    raw = json.dumps(encode(payload), sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def calculate_pay(payload: PayCalculationInput) -> PayCalculationResult:
    exceptions: list[str] = []
    lines: list[CalculationLine] = []

    # --------------------------------------------------------
    # Base pay and attendance-driven earnings
    # --------------------------------------------------------
    pay_type = payload.pay_type or "salaried"
    uses_salary = pay_type in {"salaried", "mixed"}

    ratio, eligible_units, period_units = _proration_ratio(payload)
    if ratio <= ZERO:
        exceptions.append("Employee is not employed during this pay period.")
        prorated_base = ZERO
    elif uses_salary:
        prorated_base = money(dec(payload.base_amount) * ratio)
        if ratio < 1:
            exceptions.append(
                f"Base pay prorated for {eligible_units} of {period_units} "
                f"{'working days' if payload.proration_basis != 'calendar_days' else 'calendar days'}."
            )
    else:
        prorated_base = ZERO

    regular_hours = dec(payload.regular_hours)
    overtime_hours = dec(payload.overtime_hours)
    hourly_rate_value = dec(payload.hourly_rate)
    regular_hourly_pay = money(regular_hours * hourly_rate_value)

    overtime_pay = ZERO
    if overtime_hours > ZERO:
        if payload.overtime_eligible:
            overtime_pay = money(
                overtime_hours
                * hourly_rate_value
                * dec(payload.overtime_multiplier)
            )
        else:
            exceptions.append(
                f"{overtime_hours} overtime hours were ignored because "
                "overtime is not enabled for this pay group."
            )

    unpaid_leave_amount = ZERO
    unpaid_days = dec(payload.unpaid_leave_days)
    if unpaid_days > ZERO and pay_type == "salaried":
        denominator = max(period_units, 1)
        daily_rate = dec(payload.base_amount) / dec(denominator)
        unpaid_leave_amount = money(
            min(unpaid_days, dec(denominator)) * daily_rate
        )

    basic_pay = money(
        max(
            prorated_base
            + regular_hourly_pay
            - unpaid_leave_amount,
            ZERO,
        )
    )

    gross_before_manual_earnings = money(
        max(
            prorated_base
            + regular_hourly_pay
            + overtime_pay
            - unpaid_leave_amount,
            ZERO,
        )
    )

    if pay_type == "hourly" and regular_hours <= ZERO and overtime_hours <= ZERO:
        exceptions.append("No approved hours were found for this hourly employee.")

    if pay_type == "hourly" and overtime_hours > ZERO and hourly_rate_value <= ZERO:
        exceptions.append(
            "Overtime hours exist but no hourly rate is configured."
        )

    if prorated_base > ZERO:
        lines.append(
            CalculationLine(
                code="BASIC",
                name="Basic salary",
                category="earning",
                amount=prorated_base,
                taxable=True,
                source="profile",
                quantity=dec(eligible_units),
                rate=None,
                notes=(
                    f"Prorated {eligible_units}/{period_units}"
                    if ratio < 1
                    else None
                ),
            )
        )

    if regular_hourly_pay > ZERO:
        lines.append(
            CalculationLine(
                code="HOURLY_REGULAR",
                name="Regular hours",
                category="earning",
                amount=regular_hourly_pay,
                taxable=True,
                source="timesheet",
                quantity=regular_hours,
                rate=hourly_rate_value,
            )
        )

    if overtime_pay > ZERO:
        lines.append(
            CalculationLine(
                code="OVERTIME",
                name="Overtime",
                category="earning",
                amount=overtime_pay,
                taxable=True,
                source="timesheet",
                quantity=overtime_hours,
                rate=money(hourly_rate_value * dec(payload.overtime_multiplier)),
            )
        )

    if unpaid_leave_amount > ZERO:
        lines.append(
            CalculationLine(
                code="UNPAID_LEAVE",
                name="Unpaid leave",
                category="earning",
                amount=-unpaid_leave_amount,
                taxable=True,
                source="leave",
                quantity=unpaid_days,
                notes="Unpaid leave deduction",
            )
        )

    for earning in payload.earnings:
        if earning.calculation == "percent":
            percent_base = (
                basic_pay
                if earning.calculation_base == "basic"
                else gross_before_manual_earnings
            )
            amount = money(percent_base * dec(earning.rate))
        else:
            amount = money(dec(earning.amount))

        if amount == ZERO:
            continue
        lines.append(
            CalculationLine(
                code=earning.code,
                name=earning.name,
                category="earning",
                amount=amount,
                taxable=earning.taxable,
                statutory=earning.statutory,
                component_type_id=earning.component_type_id,
                source=earning.source,
                source_ref=earning.source_ref,
                quantity=earning.quantity,
                rate=earning.line_rate,
                priority=earning.priority,
                notes=earning.notes,
            )
        )

    gross_pay = money(sum((line.amount for line in lines if line.category == "earning"), ZERO))
    if gross_pay < ZERO:
        exceptions.append("Earnings are negative; gross pay has been held at zero.")
        gross_pay = ZERO

    taxable_gross = money(
        sum(
            (
                line.amount
                for line in lines
                if line.category == "earning" and line.taxable
            ),
            ZERO,
        )
    )
    taxable_gross = max(taxable_gross, ZERO)

    # --------------------------------------------------------
    # Statutory deductions (non-tax first, then tax)
    # --------------------------------------------------------
    non_tax_schemes = sorted(
        (
            scheme
            for scheme in payload.statutory_schemes
            if scheme.scheme_type != "tax"
        ),
        key=lambda scheme: (scheme.priority, scheme.code),
    )
    tax_schemes = sorted(
        (
            scheme
            for scheme in payload.statutory_schemes
            if scheme.scheme_type == "tax"
        ),
        key=lambda scheme: (scheme.priority, scheme.code),
    )

    statutory_employee_total = ZERO
    statutory_employer_total = ZERO

    for scheme in non_tax_schemes:
        base = _scheme_base(payload, scheme, basic_pay, gross_pay, taxable_gross)
        employee_amount = money(base * dec(scheme.employee_rate))
        employer_amount = money(base * dec(scheme.employer_rate))

        if employee_amount > ZERO:
            lines.append(
                CalculationLine(
                    code=scheme.code,
                    name=scheme.name,
                    category="employee_deduction",
                    amount=employee_amount,
                    taxable=False,
                    statutory=True,
                    priority=scheme.priority,
                    source="statutory",
                    source_ref=scheme.id,
                    rate=dec(scheme.employee_rate),
                )
            )
            statutory_employee_total += employee_amount

        if employer_amount > ZERO:
            lines.append(
                CalculationLine(
                    code=f"{scheme.code}_EMPLOYER",
                    name=f"{scheme.name} (employer)",
                    category="employer_contribution",
                    amount=employer_amount,
                    taxable=False,
                    statutory=True,
                    employer=True,
                    priority=scheme.priority,
                    source="statutory",
                    source_ref=scheme.id,
                    rate=dec(scheme.employer_rate),
                )
            )
            statutory_employer_total += employer_amount

    relief_used = False
    for scheme in tax_schemes:
        relief = ZERO
        if not relief_used:
            relief = dec(scheme.relief_amount)
            relief_used = True

        taxable_income = max(
            taxable_gross - statutory_employee_total - relief,
            ZERO,
        )

        if scheme.bands:
            employee_amount = calculate_progressive_tax(taxable_income, scheme.bands)
        else:
            base = _scheme_base(payload, scheme, basic_pay, gross_pay, taxable_gross)
            employee_amount = money(max(base - relief, ZERO) * dec(scheme.employee_rate))

        if employee_amount > ZERO:
            lines.append(
                CalculationLine(
                    code=scheme.code,
                    name=scheme.name,
                    category="employee_deduction",
                    amount=employee_amount,
                    taxable=False,
                    statutory=True,
                    priority=scheme.priority,
                    source="statutory",
                    source_ref=scheme.id,
                    notes=(
                        f"Relief applied: {money(relief)}"
                        if relief > ZERO
                        else None
                    ),
                )
            )
            statutory_employee_total += employee_amount

        employer_amount = money(
            _scheme_base(payload, scheme, basic_pay, gross_pay, taxable_gross)
            * dec(scheme.employer_rate)
        )
        if employer_amount > ZERO:
            lines.append(
                CalculationLine(
                    code=f"{scheme.code}_EMPLOYER",
                    name=f"{scheme.name} (employer)",
                    category="employer_contribution",
                    amount=employer_amount,
                    taxable=False,
                    statutory=True,
                    employer=True,
                    priority=scheme.priority,
                    source="statutory",
                    source_ref=scheme.id,
                    rate=dec(scheme.employer_rate),
                )
            )
            statutory_employer_total += employer_amount

    if statutory_employee_total > gross_pay:
        exceptions.append(
            "Statutory deductions exceed gross pay. The pay item must be reviewed."
        )

    # --------------------------------------------------------
    # Recurring deductions, loans and manual deductions
    # --------------------------------------------------------
    candidates: list[tuple[int, str, CalculationLine]] = []

    for deduction in payload.deductions:
        if deduction.calculation == "percent":
            percent_base = (
                basic_pay
                if deduction.calculation_base == "basic"
                else gross_pay
            )
            amount = money(percent_base * dec(deduction.rate))
        else:
            amount = money(dec(deduction.amount))

        if amount <= ZERO:
            continue
        candidates.append(
            (
                deduction.priority,
                deduction.code,
                CalculationLine(
                    code=deduction.code,
                    name=deduction.name,
                    category="employee_deduction",
                    amount=amount,
                    taxable=deduction.taxable,
                    component_type_id=deduction.component_type_id,
                    source=deduction.source,
                    source_ref=deduction.source_ref,
                    priority=deduction.priority,
                    notes=deduction.notes,
                ),
            )
        )

    for loan in payload.loans:
        desired = money(dec(loan.installment_amount))
        if desired <= ZERO:
            continue
        candidates.append(
            (
                loan.priority,
                "LOAN",
                CalculationLine(
                    code="STAFF_LOAN",
                    name=loan.name,
                    category="employee_deduction",
                    amount=desired,
                    taxable=False,
                    priority=loan.priority,
                    source="loan",
                    source_ref=loan.id,
                    notes="Staff loan repayment",
                ),
            )
        )

    candidates.sort(key=lambda item: (item[0], item[1]))

    available = gross_pay - statutory_employee_total
    employee_deduction_total = statutory_employee_total

    for priority, _, line in candidates:
        requested = line.amount
        if available <= ZERO:
            applied = ZERO
        else:
            applied = min(requested, available)

        applied = money(applied)
        if applied < requested:
            shortfall = money(requested - applied)
            line.notes = (
                (line.notes + " " if line.notes else "")
                + f"Requested {requested}, applied {applied}; "
                f"{shortfall} carried forward."
            )
        line.amount = applied
        lines.append(line)
        employee_deduction_total += applied
        available -= applied

    for contribution in payload.employer_contributions:
        if contribution.calculation == "percent":
            percent_base = (
                basic_pay
                if contribution.calculation_base == "basic"
                else gross_pay
            )
            amount = money(percent_base * dec(contribution.rate))
        else:
            amount = money(dec(contribution.amount))

        if amount <= ZERO:
            continue
        lines.append(
            CalculationLine(
                code=contribution.code,
                name=contribution.name,
                category="employer_contribution",
                amount=amount,
                taxable=False,
                employer=True,
                component_type_id=contribution.component_type_id,
                source=contribution.source,
                source_ref=contribution.source_ref,
                priority=contribution.priority,
                notes=contribution.notes,
            )
        )
        statutory_employer_total += amount

    total_employee_deductions = money(
        sum(
            (
                line.amount
                for line in lines
                if line.category == "employee_deduction"
            ),
            ZERO,
        )
    )
    total_employer_contributions = money(
        sum(
            (
                line.amount
                for line in lines
                if line.category == "employer_contribution"
            ),
            ZERO,
        )
    )

    net_pay = money(gross_pay - total_employee_deductions)
    employer_cost = money(gross_pay + total_employer_contributions)

    held = False
    if net_pay < ZERO:
        held = True
        exceptions.append("Net pay is negative. The pay item is on hold.")
    if pay_type == "hourly" and gross_pay == ZERO:
        exceptions.append("Hourly employee has zero payable earnings.")

    return PayCalculationResult(
        gross_pay=gross_pay,
        basic_pay=basic_pay,
        taxable_gross=taxable_gross,
        total_employee_deductions=total_employee_deductions,
        total_employer_contributions=total_employer_contributions,
        net_pay=net_pay,
        employer_cost=employer_cost,
        lines=lines,
        exceptions=exceptions,
        held=held,
        input_hash=_input_hash(payload),
    )


def has_blocking_exception(result: PayCalculationResult) -> bool:
    return result.held
