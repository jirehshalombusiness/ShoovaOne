"""Rebuild roles, permission catalog and role grants after a data reset.

Replicates migrate_postgres.py's role rules without its duplicate-cleanup
step (which uses MIN(uuid), unsupported on this PostgreSQL version), then
applies the finance/organisation/payroll permission migrations directly and
the programme-academics schema migration.

Usage (from backend/):
    python scripts/sim_rebuild_access.py
"""
import asyncio
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import asyncpg

from app.core.config import settings
from app.core.permission_catalog import PERMISSION_CATALOG

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "database" / "migrations"

SYSTEM_ROLES = [
    ("ceo", "Chief Executive Officer - Full system access"),
    ("system_admin", "System Administrator - Technical system administration"),
    ("executive_director", "Executive Director - Organisation-wide access"),
    ("head_of_hr", "Head of Human Resources - Full HR management"),
    ("director", "Director - Department management"),
    ("manager", "Manager - Team management"),
    ("staff", "Staff - Personal and assigned work"),
    ("volunteer", "Volunteer - Limited access"),
    ("external_partner", "External Partner - Limited collaboration"),
]


def has_permission(role_name, resource, action):
    if role_name == "ceo":
        return True

    if resource == "payroll":
        if role_name == "head_of_hr":
            return action in (
                "view", "view_all", "view_own", "prepare",
                "review_hr", "config", "reports",
            )
        if role_name == "executive_director":
            return action in ("view", "view_all", "view_own", "approve", "reports")
        if role_name == "system_admin":
            return action in ("view_all", "config")
        if role_name in ("director", "manager", "staff", "volunteer"):
            return action == "view_own"
        return False

    if role_name == "system_admin":
        return (
            (resource == "users" and action == "manage")
            or (resource == "roles" and action == "manage")
            or (resource == "system" and action == "manage")
        )

    if role_name == "executive_director":
        return resource not in ("users", "roles", "system")

    if role_name == "head_of_hr":
        return (
            (resource == "hr" and action in (
                "view_sensitive", "edit_sensitive", "view_employment",
                "edit_employment", "view_compensation", "edit_compensation",
                "view_leave", "edit_leave", "view_performance", "edit_performance",
            ))
            or (resource == "people" and action in ("view", "create", "edit"))
            or (resource == "attendance" and action in ("view", "view_any", "edit"))
            or (resource == "documents" and action in ("view", "upload"))
        )

    if role_name == "director":
        return (
            action not in ("approve", "manage")
            and resource not in ("users", "roles", "system", "finance")
            and not (resource == "hr" and action in ("edit_sensitive", "edit_compensation"))
        )

    if role_name == "manager":
        return (
            resource in ("people", "timesheets", "projects", "tasks", "events", "attendance")
            and action in ("view", "submit", "create", "edit", "checkin")
        )

    if role_name == "staff":
        return (
            resource in ("people", "timesheets", "tasks", "events", "attendance", "documents")
            and action in ("view", "submit", "checkin", "upload")
        )

    if role_name == "volunteer":
        return (
            resource in ("people", "tasks", "events", "attendance")
            and action in ("view", "checkin")
        )

    if role_name == "external_partner":
        return (
            resource in ("projects", "tasks", "events", "documents")
            and action in ("view", "create", "edit", "upload")
        )

    return False


async def main():
    if settings.DATABASE_URL.startswith("sqlite"):
        raise SystemExit("Refusing to rebuild: DATABASE_URL points at SQLite.")

    conn = await asyncpg.connect(settings.DATABASE_URL)
    try:
        async with conn.transaction():
            for name, description in SYSTEM_ROLES:
                await conn.execute(
                    """
                    INSERT INTO roles (id, name, description, is_system)
                    VALUES ($1, $2, $3, TRUE)
                    ON CONFLICT (name)
                    DO UPDATE SET description = EXCLUDED.description, is_system = TRUE
                    """,
                    uuid.uuid4(), name, description,
                )

            existing = {
                (row["resource"], row["action"])
                for row in await conn.fetch("SELECT resource, action FROM permissions")
            }
            added = 0
            for resource, action, description in PERMISSION_CATALOG:
                if (resource, action) in existing:
                    continue
                await conn.execute(
                    """
                    INSERT INTO permissions (id, resource, action, description)
                    VALUES ($1, $2, $3, $4)
                    """,
                    uuid.uuid4(), resource, action, description,
                )
                added += 1
            print(f"permissions added: {added}")

            for filename in (
                "004_create_finance_permissions.sql",
                "007_create_organisation_permissions.sql",
                "008_create_payroll_permissions.sql",
            ):
                sql = (MIGRATIONS_DIR / filename).read_text(encoding="utf-8")
                await conn.execute(sql)
                print(f"applied {filename}")

            permissions = await conn.fetch("SELECT id, resource, action FROM permissions")
            for role_name, _ in SYSTEM_ROLES:
                role_id = await conn.fetchval(
                    "SELECT id FROM roles WHERE name = $1", role_name
                )
                await conn.execute(
                    "DELETE FROM role_permissions WHERE role_id = $1", role_id
                )
                for permission in permissions:
                    if has_permission(role_name, permission["resource"], permission["action"]):
                        await conn.execute(
                            """
                            INSERT INTO role_permissions (role_id, permission_id)
                            VALUES ($1, $2) ON CONFLICT DO NOTHING
                            """,
                            role_id, permission["id"],
                        )
            print("base role grants assigned")

            programme_sql = (MIGRATIONS_DIR / "012_create_programme_academics.sql").read_text(
                encoding="utf-8"
            )
            await conn.execute(programme_sql)
            print("applied 012_create_programme_academics.sql")

        roles = await conn.fetch("SELECT name, is_system FROM roles ORDER BY name")
        perms = await conn.fetchval("SELECT count(*) FROM permissions")
        grants = await conn.fetchval("SELECT count(*) FROM role_permissions")
        print(f"roles={len(roles)} permissions={perms} role_permissions={grants}")
        for row in roles:
            print(f"  {row['name']:20s} system={row['is_system']}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
