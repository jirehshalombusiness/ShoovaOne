"""Provision the real Shoova team: people, login accounts and roles.

Idempotent: people are matched by email, users are only created when missing,
and roles are only assigned when the account has none.

Usage (from backend/):
    python scripts/provision_team.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.sql.core.role import Role, user_roles
from app.models.sql.core.user import Person, User

TEAM_PASSWORD = os.getenv("PROVISION_PASSWORD", "")

# Ordered so every manager exists before their report is created.
TEAM = [
    {
        "key": "william",
        "first_name": "William",
        "last_name": "Agyekum",
        "email": "agyekumwilliam01@gmail.com",
        "job_title": "Chief Executive Officer",
        "roles": ["ceo"],
        "reports_to": None,
    },
    {
        "key": "salome",
        "first_name": "Salome",
        "last_name": "Agyekum",
        "email": "salagyekum1@gmail.com",
        "job_title": "Co-Founder, Treasurer & Head of Finance",
        "department": "Administration & Finance",
        "roles": ["head_of_finance"],
        "reports_to": "william",
    },
    {
        "key": "kwame",
        "first_name": "Kwame",
        "last_name": "Opon-Yeboah",
        "email": "oponyeboah@gmail.com",
        "job_title": "Executive Director",
        "roles": ["executive_director"],
        "reports_to": "william",
    },
    {
        "key": "kwame_hr",
        "first_name": "Kwame",
        "last_name": "Opon-Yeboah",
        "email": "oponyeboah_2@gmail.com",
        "job_title": "Head of Human Resources",
        "department": "Administration & Finance",
        "roles": ["head_of_hr"],
        "reports_to": "william",
    },
    {
        "key": "nana",
        "first_name": "Nana Kwasi",
        "last_name": "Appiah",
        "email": "ksappiahus@yahoo.com",
        "job_title": "Director",
        "roles": ["director"],
        "reports_to": "kwame",
    },
    {
        "key": "solomon",
        "first_name": "Solomon",
        "last_name": "Appiah",
        "email": "Kwaappiah1982@gmail.com",
        "job_title": "Director",
        "roles": ["director"],
        "reports_to": "kwame",
    },
    {
        "key": "stanley",
        "first_name": "Stanley",
        "last_name": "Essuman",
        "email": "stanley@gmail.com",
        "job_title": "Director",
        "roles": ["director"],
        "reports_to": "solomon",
    },
    {
        "key": "julius",
        "first_name": "Julius",
        "last_name": "Botchway",
        "email": "quesijulius@gmail.com",
        "job_title": "Director of IT",
        "roles": ["director"],
        "reports_to": "kwame",
    },
    {
        "key": "finance_manager",
        "first_name": "Finance",
        "last_name": "Manager",
        "email": "financemanager@gmail.com",
        "job_title": "Finance Manager",
        "department": "Administration & Finance",
        "roles": ["finance_manager"],
        "reports_to": "kwame",
    },
]


async def has_roles(db, user) -> bool:
    return (
        await db.execute(
            select(user_roles.c.role_id).where(user_roles.c.user_id == user.id)
        )
    ).first() is not None


async def assign_roles(db, user, roles, names) -> None:
    await db.execute(
        user_roles.insert(),
        [
            {"user_id": user.id, "role_id": roles[name].id}
            for name in names
        ],
    )


async def main() -> None:
    if not TEAM_PASSWORD:
        raise SystemExit(
            "Set PROVISION_PASSWORD to the temporary password for new accounts."
        )

    async with AsyncSessionLocal() as db:
        roles = {
            role.name: role
            for role in (await db.execute(select(Role))).scalars().all()
        }
        missing = {
            name
            for member in TEAM
            for name in member["roles"]
            if name not in roles
        }
        if missing:
            raise SystemExit(f"Unknown roles: {sorted(missing)}")

        person_ids: dict[str, str] = {}

        for member in TEAM:
            email = member["email"].lower()  # login matches on lowercased input
            person = (
                await db.execute(
                    select(Person).where(Person.email == email)
                )
            ).scalar_one_or_none()

            if person is None:
                person = Person(
                    first_name=member["first_name"],
                    last_name=member["last_name"],
                    email=email,
                    type="staff",
                    status="active",
                    organization="Shoova Initiative",
                    country="Ghana",
                    country_code="GH",
                )
                db.add(person)
                await db.flush()

            person.job_title = member["job_title"]
            person.department = member.get("department")
            person.reports_to_id = (
                person_ids[member["reports_to"]]
                if member["reports_to"]
                else None
            )
            person_ids[member["key"]] = person.id

            user = (
                await db.execute(select(User).where(User.email == email))
            ).scalar_one_or_none()

            if user is None:
                user = User(
                    person_id=person.id,
                    email=email,
                    password_hash=get_password_hash(TEAM_PASSWORD),
                    is_active=True,
                    must_change_password=True,
                )
                db.add(user)
                await db.flush()
                await assign_roles(db, user, roles, member["roles"])
                print(f"+ {member['email']:34s} {member['job_title']}")
            elif not await has_roles(db, user):
                await assign_roles(db, user, roles, member["roles"])
                print(f"~ {member['email']:34s} roles assigned")
            else:
                print(f"= {member['email']:34s} already present")

        await db.commit()

        people = (await db.execute(select(Person))).scalars().all()
        users = (await db.execute(select(User))).scalars().all()
        print(f"\npeople: {len(people)}  users: {len(users)}")


if __name__ == "__main__":
    asyncio.run(main())
