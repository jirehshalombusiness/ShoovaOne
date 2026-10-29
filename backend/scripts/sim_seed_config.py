"""Seed HR/payroll configuration after a reset.

Usage (from backend/):
    python scripts/sim_seed_config.py
"""
import asyncio
import datetime as dt
import sys
import uuid
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import asyncpg

from app.core.config import settings

DOCUMENT_TYPES = [
    ("Employment Contract", "Signed contract", True, "staff", None),
    ("Guarantor Certificate", "Signed guarantor form", True, "staff", None),
    ("Professional Certification", "If applicable", False, "staff", None),
    ("Academic Certificate", "Highest qualification", True, "staff", None),
    ("Police Report", "Criminal record check", True, "staff", 12),
    ("Ghana Card", "National ID", True, "all", 120),
    ("Bank Account Details", "For payroll", True, "staff", None),
    ("Medical Certificate", "If applicable", False, "staff", 12),
    ("CV / Resume", "Current resume", True, "all", None),
    ("Job Offer Letter", "Signed offer letter", True, "staff", None),
]

LEAVE_TYPES = [
    ("Annual Leave", "ANNUAL", 20, True, True, False),
    ("Sick Leave", "SICK", 10, True, True, True),
    ("Compassionate Leave", "COMPASSIONATE", 5, True, True, False),
    ("Maternity Leave", "MATERNITY", 90, True, True, True),
    ("Paternity Leave", "PATERNITY", 10, True, True, False),
    ("Study Leave", "STUDY", 5, True, True, False),
    ("Unpaid Leave", "UNPAID", 0, False, True, False),
]

PUBLIC_HOLIDAYS = [
    ("New Year's Day", dt.date(2026, 1, 1)),
    ("Constitution Day", dt.date(2026, 1, 7)),
    ("Independence Day", dt.date(2026, 3, 6)),
    ("Eid ul-Fitr", dt.date(2026, 3, 20)),
    ("Good Friday", dt.date(2026, 4, 3)),
    ("Easter Monday", dt.date(2026, 4, 6)),
    ("May Day", dt.date(2026, 5, 1)),
    ("Eid ul-Adha", dt.date(2026, 5, 27)),
    ("Founders' Day", dt.date(2026, 8, 4)),
    ("Kwame Nkrumah Memorial Day", dt.date(2026, 9, 21)),
    ("Farmers' Day", dt.date(2026, 12, 4)),
    ("Christmas Day", dt.date(2026, 12, 25)),
    ("Boxing Day", dt.date(2026, 12, 26)),
]

COMPONENT_TYPES = [
    ("BASIC", "Basic Salary", "earning", True, False, "fixed", 0, 0, "gross", 10),
    ("TRANSPORT", "Transport Allowance", "earning", False, False, "fixed", 800, 0, "basic", 20),
    ("HOUSING", "Housing Allowance", "earning", True, False, "percent", 0, 0.10, "basic", 30),
    ("MEDICAL", "Medical Allowance", "earning", False, False, "fixed", 500, 0, "basic", 40),
    ("PERFORMANCE_BONUS", "Performance Bonus", "earning", True, False, "fixed", 0, 0, "basic", 50),
    ("STAFF_LOAN", "Staff Loan Repayment", "employee_deduction", False, False, "fixed", 0, 0, "basic", 200),
    ("PAYE", "PAYE Income Tax", "employee_deduction", False, True, "fixed", 0, 0, "gross", 300),
]

# (name, code, type, employee_rate, employer_rate, base, priority, bands)
STATUTORY_SCHEMES = [
    (
        "SSNIT Tier 1", "T1", "social_security", Decimal("0.0550"),
        Decimal("0.1300"), "basic", 100, [],
    ),
    (
        "Tier 2 Pension", "T2", "social_security", Decimal("0.0000"),
        Decimal("0.0500"), "basic", 110, [],
    ),
    (
        "PAYE", "PAYE", "tax", Decimal("0.0000"), Decimal("0.0000"),
        "gross", 200,
        [
            (Decimal("0"), Decimal("490"), Decimal("0")),
            (Decimal("490"), Decimal("563.33"), Decimal("0.05")),
            (Decimal("563.33"), Decimal("666.67"), Decimal("0.10")),
            (Decimal("666.67"), Decimal("1000"), Decimal("0.175")),
            (Decimal("1000"), Decimal("1500"), Decimal("0.25")),
            (Decimal("1500"), Decimal("3000"), Decimal("0.30")),
            (Decimal("3000"), None, Decimal("0.35")),
        ],
    ),
]

PAY_GROUPS = [
    ("Leadership", "Executives and directors", False),
    ("Head Office", "Head office staff", True),
]


async def main():
    if settings.DATABASE_URL.startswith("sqlite"):
        raise SystemExit("Refusing to seed: DATABASE_URL points at SQLite.")

    conn = await asyncpg.connect(settings.DATABASE_URL)
    try:
        async with conn.transaction():
            if await conn.fetchval("SELECT count(*) FROM document_types"):
                print("document_types already populated; skipping")
            else:
                for name, description, required, applies_to, validity in DOCUMENT_TYPES:
                    await conn.execute(
                        """
                        INSERT INTO document_types
                            (id, name, description, is_required, applies_to, validity_months)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        """,
                        uuid.uuid4(), name, description, required, applies_to, validity,
                    )

            if await conn.fetchval("SELECT count(*) FROM leave_types"):
                print("leave_types already populated; skipping")
            else:
                for name, code, days, paid, approval, doc in LEAVE_TYPES:
                    await conn.execute(
                        """
                        INSERT INTO leave_types
                            (id, name, code, default_days, is_paid,
                             requires_approval, requires_documentation, color, is_active)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, '#176b4d', TRUE)
                        """,
                        uuid.uuid4(), name, code, days, paid, approval, doc,
                    )

            if await conn.fetchval("SELECT count(*) FROM public_holidays"):
                print("public_holidays already populated; skipping")
            else:
                for name, holiday_date in PUBLIC_HOLIDAYS:
                    await conn.execute(
                        """
                        INSERT INTO public_holidays
                            (id, name, holiday_date, country, is_paid)
                        VALUES ($1, $2, $3, 'GH', TRUE)
                        """,
                        uuid.uuid4(), name, holiday_date,
                    )

            if await conn.fetchval("SELECT count(*) FROM payroll_component_types"):
                print("payroll component types already populated; skipping")
            else:
                for (
                    code, name, category, taxable, statutory, calculation,
                    default_amount, default_rate, base, priority,
                ) in COMPONENT_TYPES:
                    await conn.execute(
                        """
                        INSERT INTO payroll_component_types
                            (id, code, name, category, taxable, statutory, calculation,
                             default_amount, default_rate, calculation_base, priority,
                             is_active)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE)
                        """,
                        uuid.uuid4(), code, name, category, taxable, statutory,
                        calculation, default_amount, default_rate, base, priority,
                    )

            if await conn.fetchval("SELECT count(*) FROM payroll_pay_groups"):
                print("pay groups already populated; skipping")
            else:
                for name, description, overtime in PAY_GROUPS:
                    await conn.execute(
                        """
                        INSERT INTO payroll_pay_groups
                            (id, name, description, pay_type, currency,
                             overtime_eligible, proration_basis, is_active)
                        VALUES ($1, $2, $3, 'salaried', 'GHS', $4, 'working_days', TRUE)
                        """,
                        uuid.uuid4(), name, description, overtime,
                    )

            if await conn.fetchval("SELECT count(*) FROM payroll_statutory_schemes"):
                print("statutory schemes already populated; skipping")
            else:
                for (
                    name, code, scheme_type, employee_rate, employer_rate,
                    base, priority, bands,
                ) in STATUTORY_SCHEMES:
                    scheme_id = uuid.uuid4()
                    await conn.execute(
                        """
                        INSERT INTO payroll_statutory_schemes
                            (id, name, code, jurisdiction, scheme_type,
                             employee_rate, employer_rate, base, relief_amount,
                             remittance_due_day, priority, effective_from,
                             is_active)
                        VALUES ($1, $2, $3, 'GH', $4, $5, $6, $7, 0, 14, $8, $9, TRUE)
                        """,
                        scheme_id, name, code, scheme_type, employee_rate,
                        employer_rate, base, priority, dt.date(2026, 1, 1),
                    )
                    for sequence, (band_from, band_to, rate) in enumerate(bands, start=1):
                        await conn.execute(
                            """
                            INSERT INTO payroll_tax_bands
                                (id, scheme_id, sequence, band_from, band_to, rate)
                            VALUES ($1, $2, $3, $4, $5, $6)
                            """,
                            uuid.uuid4(), scheme_id, sequence, band_from, band_to, rate,
                        )

        counts = {
            "document_types": await conn.fetchval("SELECT count(*) FROM document_types"),
            "leave_types": await conn.fetchval("SELECT count(*) FROM leave_types"),
            "public_holidays": await conn.fetchval("SELECT count(*) FROM public_holidays"),
            "payroll_component_types": await conn.fetchval(
                "SELECT count(*) FROM payroll_component_types"
            ),
            "payroll_pay_groups": await conn.fetchval(
                "SELECT count(*) FROM payroll_pay_groups"
            ),
            "payroll_statutory_schemes": await conn.fetchval(
                "SELECT count(*) FROM payroll_statutory_schemes"
            ),
            "payroll_tax_bands": await conn.fetchval(
                "SELECT count(*) FROM payroll_tax_bands"
            ),
        }
        print(counts)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
