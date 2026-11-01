"""Rollback-only smoke test for the multi-entity foundation (migration 015).

Verifies the entity tables, the Ghana backfill, and that the central scoping
filter hides other entities' people. Nothing is persisted.

Usage: PYTHONPATH=. python scripts/smoke_entity_scope.py
"""

import asyncio
import sys

from sqlalchemy import func, inspect, select, text

from app.core.database import AsyncSessionLocal
from app.core.entity_context import (
    reset_active_entity_id,
    set_active_entity_id,
)
from app.models.sql.core.entity import Entity, UserEntityMembership
from app.models.sql.core.user import Person, User

PASS = 0
FAIL = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"PASS  {name}" + (f"  ({detail})" if detail else ""))
    else:
        FAIL += 1
        print(f"FAIL  {name}" + (f"  ({detail})" if detail else ""))


async def main() -> int:
    async with AsyncSessionLocal() as db:
        tables = await db.run_sync(
            lambda sync: set(inspect(sync.connection()).get_table_names())
        )
        check("entities table present", "entities" in tables)
        check(
            "user_entity_memberships table present",
            "user_entity_memberships" in tables,
        )
        check("user_entity_roles table present", "user_entity_roles" in tables)

        if "entities" not in tables:
            print("Migration 015 has not been applied.")
            return 1

        gh = (
            await db.execute(select(Entity).where(Entity.code == "GH"))
        ).scalar_one_or_none()
        us = (
            await db.execute(select(Entity).where(Entity.code == "US"))
        ).scalar_one_or_none()
        check(
            "Ghana entity seeded",
            gh is not None,
            f"{gh.name} / {gh.currency}" if gh else "missing",
        )
        check(
            "U.S. entity seeded",
            us is not None,
            f"{us.name} / {us.currency}" if us else "missing",
        )
        if gh is None or us is None:
            return 1

        unassigned_people = (
            await db.execute(
                select(func.count()).select_from(Person).where(
                    Person.entity_id.is_(None)
                )
            )
        ).scalar()
        check("every person has an entity", unassigned_people == 0, f"{unassigned_people} null")

        unassigned_users = (
            await db.execute(
                text(
                    """
                    SELECT count(*) FROM users u
                    WHERE NOT EXISTS (
                        SELECT 1 FROM user_entity_memberships m
                        WHERE m.user_id = u.id
                    )
                    """
                )
            )
        ).scalar()
        check("every user has a workspace", unassigned_users == 0, f"{unassigned_users} unassigned")

        admin_rows = (
            await db.execute(
                select(Entity.code)
                .join(UserEntityMembership, UserEntityMembership.entity_id == Entity.id)
                .join(User, User.id == UserEntityMembership.user_id)
                .where(func.lower(User.email) == "admin@shoova.org")
            )
        ).scalars().all()
        check(
            "admin belongs to both entities",
            set(admin_rows) == {"GH", "US"},
            ", ".join(sorted(admin_rows)) or "none",
        )

        total_people = (
            await db.execute(
                select(func.count())
                .select_from(Person)
                .execution_options(include_all_entities=True)
            )
        ).scalar()

        token = set_active_entity_id(gh.id)
        gh_people = (
            await db.execute(select(func.count()).select_from(Person))
        ).scalar()
        reset_active_entity_id(token)

        token = set_active_entity_id(us.id)
        us_people = (
            await db.execute(select(func.count()).select_from(Person))
        ).scalar()
        reset_active_entity_id(token)

        check(
            "Ghana workspace sees Ghana people",
            gh_people == total_people,
            f"{gh_people}/{total_people}",
        )
        check(
            "U.S. workspace sees no Ghana people",
            us_people == 0,
            f"{us_people} visible",
        )

        token = set_active_entity_id(us.id)
        probe = Person(first_name="Scope", last_name="Probe", type="staff")
        db.add(probe)
        await db.flush()
        stamped = probe.entity_id
        check(
            "new people inherit the active workspace",
            stamped == str(us.id),
            str(stamped),
        )
        await db.rollback()
        reset_active_entity_id(token)

        audit_columns = await db.run_sync(
            lambda sync: {
                column["name"]
                for column in inspect(sync.connection()).get_columns("audit_logs")
            }
        )
        check(
            "audit_logs.owning_entity_id present",
            "owning_entity_id" in audit_columns,
        )

    print(f"\n{PASS}/{PASS + FAIL} checks passed")
    print("Transaction rolled back - no rows persisted.")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
