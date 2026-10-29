"""Destructive reset: clears every table except schema_migrations.

The admin account (admin@shoova.org) and its person row are preserved and
re-inserted after the truncate. Run sim_backup.py first.

Usage (from backend/):
    CONFIRM_RESET=yes python scripts/sim_reset.py
"""
import asyncio
import datetime as dt
import json
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import asyncpg

from app.core.config import settings

BACKUP_DIR = Path(__file__).resolve().parents[1] / "backups"
ADMIN_EMAIL = "admin@shoova.org"
KEEP_TABLES = {"schema_migrations"}


def _encode(value):
    if isinstance(value, (uuid.UUID, dt.datetime, dt.date, dt.time)):
        return str(value)
    if isinstance(value, dict):
        return {k: _encode(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_encode(v) for v in value]
    return value


async def main() -> None:
    if os.getenv("CONFIRM_RESET") != "yes":
        raise SystemExit("Set CONFIRM_RESET=yes to run the destructive reset.")
    if settings.DATABASE_URL.startswith("sqlite"):
        raise SystemExit("Refusing to reset: DATABASE_URL points at SQLite.")

    conn = await asyncpg.connect(settings.DATABASE_URL)
    try:
        admin_user = await conn.fetchrow(
            "SELECT * FROM users WHERE lower(email) = $1", ADMIN_EMAIL
        )
        if admin_user is None:
            raise SystemExit("admin@shoova.org not found; aborting before any writes.")

        admin_person = await conn.fetchrow(
            "SELECT * FROM people WHERE id = $1", admin_user["person_id"]
        )
        if admin_person is None:
            raise SystemExit("Admin person row not found; aborting before any writes.")

        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        preserve_path = BACKUP_DIR / f"preserved_admin_{stamp}.json"
        preserve_path.write_text(
            json.dumps(
                {"user": _encode(dict(admin_user)), "person": _encode(dict(admin_person))},
                indent=1,
            ),
            encoding="utf-8",
        )
        print(f"admin preserved -> {preserve_path}")

        tables = [
            row["table_name"]
            for row in await conn.fetch(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """
            )
            if row["table_name"] not in KEEP_TABLES
        ]
        print(f"truncating {len(tables)} tables (schema_migrations kept)")

        quoted = ", ".join(f'"{name}"' for name in tables)
        await conn.execute(f"TRUNCATE TABLE {quoted} CASCADE")

        person_columns = list(admin_person.keys())
        await conn.execute(
            f'INSERT INTO people ({", ".join(person_columns)}) '
            f'VALUES ({", ".join(f"${i + 1}" for i in range(len(person_columns)))})',
            *[admin_person[c] for c in person_columns],
        )
        user_columns = list(admin_user.keys())
        await conn.execute(
            f'INSERT INTO users ({", ".join(user_columns)}) '
            f'VALUES ({", ".join(f"${i + 1}" for i in range(len(user_columns)))})',
            *[admin_user[c] for c in user_columns],
        )

        remaining = {}
        for table in tables:
            count = await conn.fetchval(f'SELECT count(*) FROM "{table}"')
            if count:
                remaining[table] = count
        print(f"reset complete; non-empty tables: {remaining or 'none'}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
