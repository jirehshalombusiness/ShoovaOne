"""Create the temporary email-test user.

The seeded logins carry placeholder addresses, so this account receives
real mail while the email pipeline is being tested:

    email:    quesijulius@gmail.com
    password: printed once by this script

Idempotent: exits without changes if the login already exists.

Usage (from backend/):
    .venv/Scripts/python scripts/create_test_email_user.py
"""

import asyncio
import sys

from sqlalchemy import insert, select

from app.core.database import AsyncSessionLocal, engine
from app.core.security import get_password_hash
from app.models.sql.core.role import Role, user_roles
from app.models.sql.core.user import Person, User

TEST_EMAIL = "quesijulius@gmail.com"
TEST_PASSWORD = "Shoova-Test-2026!"


async def main() -> int:
    async with AsyncSessionLocal() as db:
        existing = (
            await db.execute(select(User).where(User.email == TEST_EMAIL))
        ).scalars().first()
        if existing:
            print(f"Login already exists: {TEST_EMAIL} (user {existing.id})")
            await engine.dispose()
            return 0

        hr_person_id = (
            await db.execute(
                select(User.person_id)
                .join(User.roles)
                .where(
                    Role.name == "head_of_hr",
                    User.is_active.is_(True),
                )
                .limit(1)
            )
        ).scalar_one_or_none()

        person = Person(
            first_name="Quesi",
            last_name="Julius",
            email=TEST_EMAIL,
            type="staff",
            status="active",
            job_title="Temporary test account",
            reports_to_id=hr_person_id,
        )
        db.add(person)
        await db.flush()

        user = User(
            person_id=person.id,
            email=TEST_EMAIL,
            password_hash=get_password_hash(TEST_PASSWORD),
            is_active=True,
            must_change_password=False,
        )
        db.add(user)
        await db.flush()

        staff_role = (
            await db.execute(select(Role).where(Role.name == "staff"))
        ).scalar_one_or_none()
        if staff_role:
            await db.execute(
                insert(user_roles).values(
                    user_id=user.id,
                    role_id=staff_role.id,
                )
            )

        await db.commit()

        print(f"Created login: {TEST_EMAIL}")
        print(f"  person_id: {person.id}")
        print(f"  user_id:   {user.id}")
        print(f"  password:  {TEST_PASSWORD}")
        print(
            "  reports to: "
            + (str(hr_person_id) if hr_person_id else "nobody yet")
        )
        print("Change or delete this account before launch.")

    await engine.dispose()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
