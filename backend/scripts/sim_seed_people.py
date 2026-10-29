"""Seed organisation, people, logins, contracts and payroll profiles.

Usage (from backend/):
    python scripts/sim_seed_people.py
"""
import asyncio
import datetime as dt
import json
import random
import sys
import uuid
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import asyncpg

from app.core.config import settings
from app.core.security import get_password_hash
from app.services.payroll.encryption import BankAccountEncryption

PASSWORD = "ShoovaDemo2026!"
ORG_NAME = "Shoova Initiative"

DEPARTMENTS = [
    ("Executive Office", "EXEC", "Project management and executive coordination"),
    ("Finance & Treasury", "FIN", "Data analytics, finance and treasury"),
    ("Ghana Operations", "OPS", "Ghana operations and IT infrastructure"),
    ("Education & Training", "EDU", "Education and training programmes"),
    ("Corporate Affairs", "CORP", "Banking, entrepreneurship and corporate relations"),
    ("Communication & PR", "COMM", "Project management and communication relations"),
    ("Human Resources", "HR", "People, culture and administration"),
    ("Programmes & M&E", "PROG", "Programme delivery, monitoring and evaluation"),
]

# key, first, last, middle, title, dept, location, country, base, group, roles
EMPLOYEES = [
    ("william", "William", "Agyekum", None, "Co-Founder & President", "EXEC", "Maryland", "USA", 35000, "Leadership", ["ceo"]),
    ("salome", "Salome", "Agyekum", None, "Co-Founder & Treasurer", "FIN", "Maryland", "USA", 26000, "Leadership", ["head_of_finance", "director"]),
    ("kwame", "Kwame", "Opon-Yeboah", None, "Executive Director & Head of Ghana Operations", "EXEC", "Accra", "Ghana", 24000, "Leadership", ["executive_director"]),
    ("julius", "Julius", "Botchway", None, "Director of Ghana Operations", "OPS", "Accra", "Ghana", 19000, "Leadership", ["director"]),
    ("wemba", "Wemba", "Kweji", "Keneh", "Secretary, PSM Managing Admin", "EXEC", "Maryland", "USA", 14000, "Leadership", ["manager"]),
    ("isaac", "Isaac", "Adjei-Ampofo", "Waddy", "Director of Education", "EDU", "Maryland", "USA", 19000, "Leadership", ["director"]),
    ("nana", "Nana", "Appiah", "Kwasi", "Director of Corporate Affairs", "CORP", "Accra", "Ghana", 19000, "Leadership", ["director"]),
    ("freda", "Freda", "Kwarteng-Amaniampong", None, "Project Management and Communication Lead", "COMM", "Maryland", "USA", 13500, "Leadership", ["manager"]),
    ("solomon", "Solomon", "Appiah", None, "Director Admin and Operations", "OPS", "Accra", "Ghana", 18500, "Leadership", ["director"]),
    ("efua", "Efua", "Owusu-Ansah", None, "Head of Human Resources", "HR", "Accra", "Ghana", 16000, "Leadership", ["head_of_hr"]),
    ("daniel", "Daniel", "Osei-Bonsu", None, "Director of Programmes", "PROG", "Accra", "Ghana", 18000, "Leadership", ["director"]),
    ("gifty", "Gifty", "Amoako", None, "Finance Officer", "FIN", "Accra", "Ghana", 8500, "Head Office", ["finance_officer"]),
    ("michael", "Michael", "Tetteh", None, "Programmes Coordinator", "PROG", "Accra", "Ghana", 7200, "Head Office", ["staff"]),
    ("akosua", "Akosua", "Frimpong", None, "HR Officer", "HR", "Accra", "Ghana", 6800, "Head Office", ["staff"]),
    ("kofi", "Kofi", "Boateng", None, "IT Support Officer", "OPS", "Accra", "Ghana", 7500, "Head Office", ["staff"]),
    ("abena", "Abena", "Serwaa", None, "Communications Officer", "COMM", "Accra", "Ghana", 6500, "Head Office", ["staff"]),
    ("yaw", "Yaw", "Antwi", None, "Data Analyst", "FIN", "Accra", "Ghana", 7800, "Head Office", ["staff"]),
    ("adwoa", "Adwoa", "Nyarko", None, "Executive Assistant", "EXEC", "Accra", "Ghana", 6000, "Head Office", ["staff"]),
    ("samuel", "Samuel", "Owusu", None, "Field Operations Officer", "OPS", "Kumasi", "Ghana", 5800, "Head Office", ["staff"]),
    ("comfort", "Comfort", "Adjei", None, "Finance Assistant", "FIN", "Accra", "Ghana", 5200, "Head Office", ["staff"]),
]

MANAGERS = {
    "salome": "william", "kwame": "william", "isaac": "william", "nana": "william",
    "julius": "kwame", "wemba": "kwame", "freda": "kwame", "solomon": "kwame",
    "efua": "kwame", "daniel": "kwame", "gifty": "salome", "michael": "daniel",
    "akosua": "efua", "kofi": "julius", "abena": "freda", "yaw": "salome",
    "adwoa": "wemba", "samuel": "solomon", "comfort": "gifty",
}

LEARNERS = [
    ("Ama", "Mensah", "Kaneshie", "Ghana"),
    ("Kojo", "Asante", "Tema", "Ghana"),
    ("Esi", "Boatemaa", "Accra", "Ghana"),
    ("Kwabena", "Owusu-Ansah", "Kumasi", "Ghana"),
    ("Yaa", "Asantewaa", "Cape Coast", "Ghana"),
    ("Nii", "Ashiley", "Accra", "Ghana"),
    ("Akua", "Darko", "Takoradi", "Ghana"),
    ("Fiifi", "Quansah", "Cape Coast", "Ghana"),
    ("Adjoa", "Badu", "Sunyani", "Ghana"),
    ("Kobby", "Mensah", "Ho", "Ghana"),
]

PARTNER_CONTACTS = [
    ("Amina", "Yusuf", "Programme Officer", "Mastercard Foundation"),
    ("Peter", "Ofori", "Partnerships Lead", "UNICEF Ghana"),
    ("Grace", "Adom", "CSR Manager", "Stanbic Bank Ghana"),
    ("Kwesi", "Larbi", "Programme Director", "USAID Ghana"),
    ("Naa", "Tetteh", "Foundation Manager", "MTN Ghana Foundation"),
]

EXTERNAL_ORGS = [
    ("Mastercard Foundation", "MCF", "Funder"),
    ("UNICEF Ghana", "UNICEF-GH", "Partner"),
    ("Stanbic Bank Ghana", "STANBIC", "Corporate sponsor"),
    ("USAID Ghana", "USAID-GH", "Funder"),
    ("MTN Ghana Foundation", "MTN-GH", "Corporate sponsor"),
]

BANKS = [
    ("Ecobank Ghana", "ECOBANK", "030100"),
    ("GCB Bank", "GCB", "040100"),
    ("Stanbic Bank Ghana", "STANBIC", "190100"),
    ("Absa Bank Ghana", "ABSA", "020100"),
    ("Fidelity Bank Ghana", "FIDELITY", "240100"),
    ("CalBank", "CALBANK", "140100"),
]

DEPARTMENT_NAMES = {code: name for name, code, _ in DEPARTMENTS}


def phone(rand):
    return f"+233 {rand.choice([20, 24, 26, 27, 50, 54, 55])} {rand.randint(100, 999)} {rand.randint(1000, 9999)}"


def employee_number(index):
    return f"SHO-{index:03d}"


async def main():
    if settings.DATABASE_URL.startswith("sqlite"):
        raise SystemExit("Refusing to seed: DATABASE_URL points at SQLite.")

    rand = random.Random(20261029)
    conn = await asyncpg.connect(settings.DATABASE_URL)
    try:
        if await conn.fetchval("SELECT count(*) FROM organisations WHERE code = 'SHOOVA'"):
            raise SystemExit("Demo data appears to be seeded already; aborting.")

        role_ids = {
            row["name"]: row["id"]
            for row in await conn.fetch("SELECT id, name FROM roles")
        }
        group_ids = {
            row["name"]: row["id"]
            for row in await conn.fetch("SELECT id, name FROM payroll_pay_groups")
        }
        component_ids = {
            row["code"]: row["id"]
            for row in await conn.fetch("SELECT id, code FROM payroll_component_types")
        }

        async with conn.transaction():
            org_id = uuid.uuid4()
            await conn.execute(
                """
                INSERT INTO organisations (id, name, code, description, status)
                VALUES ($1, $2, 'SHOOVA', $3, 'active')
                """,
                org_id,
                ORG_NAME,
                "Shoova Initiative - youth skills, entrepreneurship and community programmes.",
            )
            dept_ids = {}
            for name, code, description in DEPARTMENTS:
                dept_id = uuid.uuid4()
                dept_ids[code] = dept_id
                await conn.execute(
                    """
                    INSERT INTO departments
                        (id, organisation_id, name, code, description, status)
                    VALUES ($1, $2, $3, $4, $5, 'active')
                    """,
                    dept_id, org_id, name, code, description,
                )

            person_ids = {}
            user_ids = {}
            password_hash = get_password_hash(PASSWORD)
            joined = dt.datetime(2026, 8, 1, 9, 0, tzinfo=dt.timezone.utc)

            for index, (
                key, first, last, middle, title, dept_code, city, country,
                base, group, roles,
            ) in enumerate(EMPLOYEES, start=1):
                person_id = uuid.uuid4()
                person_ids[key] = person_id
                email = f"{first.lower()}.{last.lower().replace('-', '').replace(' ', '')}@shoova.org"
                await conn.execute(
                    """
                    INSERT INTO people
                        (id, first_name, middle_name, last_name, email, phone,
                         date_of_birth, gender, type, status, organization,
                         job_title, department, employee_number, location,
                         country, employment_type, created_at, updated_at,
                         address, city)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'staff', 'active',
                            $9, $10, $11, $12, $13, $14, 'full_time', $15, $15,
                            $16, $17)
                    """,
                    person_id, first, middle, last, email, phone(rand),
                    dt.datetime(rand.randint(1976, 1996), rand.randint(1, 12), rand.randint(1, 28)),
                    "female" if first in {
                        "Salome", "Freda", "Efua", "Gifty", "Akosua", "Abena",
                        "Adwoa", "Comfort",
                    } else "male",
                    ORG_NAME, title,
                    DEPARTMENT_NAMES[dept_code],
                    employee_number(index), city, country, joined,
                    f"{rand.randint(1, 40)} {rand.choice(['Liberation Road', 'Independence Ave', 'Ring Road', 'Spintex Road'])}",
                    city,
                )

                user_id = uuid.uuid4()
                user_ids[key] = user_id
                await conn.execute(
                    """
                    INSERT INTO users
                        (id, person_id, email, password_hash, is_active,
                         must_change_password, last_login_at, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, TRUE, FALSE, $5, $6, $6)
                    """,
                    user_id, person_id, email, password_hash,
                    dt.datetime(2026, 10, 28, 8, 15, tzinfo=dt.timezone.utc),
                    joined,
                )
                for role_name in roles:
                    await conn.execute(
                        """
                        INSERT INTO user_roles (user_id, role_id)
                        VALUES ($1, $2) ON CONFLICT DO NOTHING
                        """,
                        user_id, role_ids[role_name],
                    )

            # Org chart
            for key, manager_key in MANAGERS.items():
                await conn.execute(
                    "UPDATE people SET reports_to_id = $1 WHERE id = $2",
                    person_ids[manager_key], person_ids[key],
                )

            # Admin account: super admin roles and reporting line
            admin_user = await conn.fetchrow(
                "SELECT id, person_id FROM users WHERE lower(email) = 'admin@shoova.org'"
            )
            for role_name in ("ceo", "system_admin"):
                await conn.execute(
                    "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                    admin_user["id"], role_ids[role_name],
                )
            await conn.execute(
                "UPDATE people SET reports_to_id = $1, organization = $2 WHERE id = $3",
                person_ids["william"], ORG_NAME, admin_user["person_id"],
            )

            # Contracts, compensation history, payroll profiles
            for index, (
                key, first, last, middle, title, dept_code, city, country,
                base, group, roles,
            ) in enumerate(EMPLOYEES, start=1):
                person_id = person_ids[key]
                await conn.execute(
                    """
                    INSERT INTO employment_contracts
                        (id, person_id, contract_type, position, department,
                         start_date, reports_to_id, compensation_amount,
                         compensation_currency, compensation_frequency,
                         is_current, notes)
                    VALUES ($1, $2, 'permanent', $3, $4, $5, $6, $7, 'GHS',
                            'monthly', TRUE, 'Initial appointment letter on file.')
                    """,
                    uuid.uuid4(), person_id, title,
                    DEPARTMENT_NAMES[dept_code],
                    dt.date(2026, 8, 1),
                    person_ids[MANAGERS[key]] if key in MANAGERS else None,
                    Decimal(base),
                )
                await conn.execute(
                    """
                    INSERT INTO compensation_changes
                        (id, person_id, base_amount, currency, frequency,
                         effective_from, reason, approved_by_id, approved_at,
                         notes)
                    VALUES ($1, $2, $3, 'GHS', 'monthly', $4,
                            'Initial appointment', $5, $6, NULL)
                    """,
                    uuid.uuid4(), person_id, Decimal(base), dt.date(2026, 8, 1),
                    person_ids["william"] if group == "Leadership" else person_ids["efua"],
                    dt.datetime(2026, 8, 1, 12, 0, tzinfo=dt.timezone.utc),
                )
                await conn.execute(
                    """
                    INSERT INTO payroll_employee_profiles
                        (id, person_id, pay_group_id, pay_type, base_amount,
                         hourly_rate, currency, overtime_multiplier,
                         payment_method, cost_center, department,
                         effective_from, is_active, notes)
                    VALUES ($1, $2, $3, 'salaried', $4, 0, 'GHS', 1.5,
                            $5, $6, $7, $8, TRUE, NULL)
                    """,
                    uuid.uuid4(), person_id, group_ids[group], Decimal(base),
                    "mobile_money" if key in {"samuel", "comfort"} else "bank_transfer",
                    f"CC-{dept_code}", DEPARTMENT_NAMES[dept_code],
                    dt.date(2026, 8, 1),
                )

                bank_name, bank_code, sort_code = BANKS[index % len(BANKS)]
                account_number = f"{sort_code}{rand.randint(1000000, 9999999)}"
                await conn.execute(
                    """
                    INSERT INTO payroll_bank_accounts
                        (id, person_id, bank_name, branch, bank_code, account_name,
                         account_number_encrypted, account_number_last4,
                         is_primary, verification_status, effective_from,
                         created_by_id, approved_by_id, approved_at)
                    VALUES ($1, $2, $3, 'Accra Main', $4, $5, $6, $7, TRUE,
                            'verified', $8, $9, $10, $11)
                    """,
                    uuid.uuid4(), person_id, bank_name, bank_code,
                    f"{first} {last}",
                    BankAccountEncryption.encrypt(account_number),
                    BankAccountEncryption.last4(account_number),
                    dt.date(2026, 8, 1), person_ids["gifty"], person_ids["salome"],
                    dt.datetime(2026, 8, 2, 10, 0, tzinfo=dt.timezone.utc),
                )

                # Transport allowance for everyone.
                await conn.execute(
                    """
                    INSERT INTO payroll_recurring_components
                        (id, person_id, component_type_id, amount, rate,
                         effective_from, is_active, notes)
                    VALUES ($1, $2, $3, 800, 0, $4, TRUE, NULL)
                    """,
                    uuid.uuid4(), person_id, component_ids["TRANSPORT"],
                    dt.date(2026, 8, 1),
                )
                # Housing allowance as 10% of basic.
                await conn.execute(
                    """
                    INSERT INTO payroll_recurring_components
                        (id, person_id, component_type_id, amount, rate,
                         effective_from, is_active, notes)
                    VALUES ($1, $2, $3, 0, 0.10, $4, TRUE, NULL)
                    """,
                    uuid.uuid4(), person_id, component_ids["HOUSING"],
                    dt.date(2026, 8, 1),
                )

            # Staff loans
            loan_specs = [
                ("michael", Decimal("6000"), Decimal("500")),
                ("kofi", Decimal("3600"), Decimal("300")),
                ("adwoa", Decimal("2400"), Decimal("200")),
            ]
            for key, principal, installment in loan_specs:
                loan_id = uuid.uuid4()
                await conn.execute(
                    """
                    INSERT INTO payroll_loans
                        (id, person_id, principal, interest_rate,
                         installment_amount, term_months, start_date,
                         outstanding_balance, status, approved_by_id,
                         created_by_id, notes)
                    VALUES ($1, $2, $3, 0, $4, 12, $5, $3, 'active', $6, $7,
                            'Staff welfare loan')
                    """,
                    loan_id, person_ids[key], principal, installment,
                    dt.date(2026, 8, 1), person_ids["salome"], person_ids["gifty"],
                )
                for sequence in range(1, 13):
                    due = dt.date(2026, 8 + (sequence - 1), 28) if sequence <= 5 else dt.date(
                        2027, sequence - 5, 28
                    )
                    await conn.execute(
                        """
                        INSERT INTO payroll_loan_installments
                            (id, loan_id, sequence, due_date, amount,
                             principal_portion, interest_portion, status)
                        VALUES ($1, $2, $3, $4, $5, $5, 0, 'pending')
                        """,
                        uuid.uuid4(), loan_id, sequence, due, installment,
                    )

            # Leave balances for 2026
            leave_types = {
                row["code"]: row for row in await conn.fetch(
                    "SELECT id, code, default_days FROM leave_types"
                )
            }
            for key, *_ in EMPLOYEES:
                for code in ("ANNUAL", "SICK", "COMPASSIONATE"):
                    leave_type = leave_types[code]
                    await conn.execute(
                        """
                        INSERT INTO leave_balances
                            (id, person_id, leave_type_id, year, total_days,
                             used_days, pending_days, carry_over_days)
                        VALUES ($1, $2, $3, 2026, $4, 0, 0, 0)
                        """,
                        uuid.uuid4(), person_ids[key], leave_type["id"],
                        Decimal(leave_type["default_days"]),
                    )

            # Learners and partner contacts
            learner_ids = []
            for first, last, city, country in LEARNERS:
                person_id = uuid.uuid4()
                learner_ids.append(person_id)
                email = f"{first.lower()}.{last.lower().replace('-', '')}@example.com"
                await conn.execute(
                    """
                    INSERT INTO people
                        (id, first_name, last_name, email, phone, type, status,
                         organization, job_title, location, country, created_at,
                         updated_at)
                    VALUES ($1, $2, $3, $4, $5, 'student', 'active', NULL,
                            'Programme participant', $6, $7, $8, $8)
                    """,
                    person_id, first, last, email, phone(rand), city, country,
                    dt.datetime(2026, 8, 5, 10, 0, tzinfo=dt.timezone.utc),
                )

            contact_ids = {}
            for (first, last, title, org_name), (ext_name, *_rest) in zip(
                PARTNER_CONTACTS, EXTERNAL_ORGS
            ):
                person_id = uuid.uuid4()
                contact_ids[ext_name] = person_id
                await conn.execute(
                    """
                    INSERT INTO people
                        (id, first_name, last_name, email, phone, type, status,
                         organization, job_title, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, 'partner', 'active', $6, $7,
                            $8, $8)
                    """,
                    person_id, first, last,
                    f"{first.lower()}.{last.lower()}@partner.org",
                    phone(rand), ext_name, title,
                    dt.datetime(2026, 8, 12, 10, 0, tzinfo=dt.timezone.utc),
                )

            external_org_ids = {}
            for name, code, description in EXTERNAL_ORGS:
                org_row_id = uuid.uuid4()
                external_org_ids[name] = org_row_id
                await conn.execute(
                    """
                    INSERT INTO organisations (id, name, code, description, status)
                    VALUES ($1, $2, $3, $4, 'active')
                    """,
                    org_row_id, name, code, description,
                )

            # Save the lookup map for the operations seed.
            lookup = {
                "org": str(org_id),
                "departments": {k: str(v) for k, v in dept_ids.items()},
                "people": {k: str(v) for k, v in person_ids.items()},
                "users": {k: str(v) for k, v in user_ids.items()},
                "learners": [str(v) for v in learner_ids],
                "contacts": {k: str(v) for k, v in contact_ids.items()},
                "external_orgs": {k: str(v) for k, v in external_org_ids.items()},
            }
            (Path(__file__).resolve().parents[1] / "backups" / "sim_lookup.json").write_text(
                json.dumps(lookup, indent=1), encoding="utf-8"
            )

        counts = {
            "people": await conn.fetchval("SELECT count(*) FROM people"),
            "users": await conn.fetchval("SELECT count(*) FROM users"),
            "user_roles": await conn.fetchval("SELECT count(*) FROM user_roles"),
            "payroll_profiles": await conn.fetchval(
                "SELECT count(*) FROM payroll_employee_profiles"
            ),
            "bank_accounts": await conn.fetchval(
                "SELECT count(*) FROM payroll_bank_accounts"
            ),
            "loans": await conn.fetchval("SELECT count(*) FROM payroll_loans"),
        }
        print(counts)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
