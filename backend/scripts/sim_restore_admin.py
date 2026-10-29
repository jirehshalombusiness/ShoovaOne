"""Restore the preserved admin person/user rows after a reset truncate."""
import asyncio
import glob
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import asyncpg

from app.core.config import settings

BACKUP_DIR = Path(__file__).resolve().parents[1] / "backups"
PG_TYPES = {
    "uuid": "uuid",
    "timestamp with time zone": "timestamptz",
    "timestamp without time zone": "timestamp",
    "date": "date",
    "boolean": "boolean",
    "integer": "integer",
    "bigint": "bigint",
    "numeric": "numeric",
    "double precision": "double precision",
}


async def insert_row(conn, table, row, null_columns=()):
    columns = list(row.keys())
    types = {
        r["column_name"]: r["data_type"]
        for r in await conn.fetch(
            """
            SELECT column_name, data_type FROM information_schema.columns
            WHERE table_schema='public' AND table_name=$1
            """,
            table,
        )
    }
    params = []
    placeholders = []
    for index, column in enumerate(columns, start=1):
        value = None if column in null_columns else row[column]
        data_type = types.get(column, "text")
        cast = PG_TYPES.get(data_type)
        if value is not None:
            if isinstance(value, bool):
                value = "true" if value else "false"
            elif isinstance(value, (dict, list)):
                value = json.dumps(value)
            else:
                value = str(value)
        # Bind as text and let PostgreSQL cast, so JSON strings work.
        placeholders.append(f"${index}::text::{cast}" if cast else f"${index}::text")
        params.append(value)
    await conn.execute(
        f'INSERT INTO "{table}" ({", ".join(columns)}) VALUES ({", ".join(placeholders)})',
        *params,
    )


async def main():
    if settings.DATABASE_URL.startswith("sqlite"):
        raise SystemExit("Refusing to restore: DATABASE_URL points at SQLite.")
    latest = sorted(glob.glob(str(BACKUP_DIR / "preserved_admin_*.json")))[-1]
    payload = json.loads(Path(latest).read_text(encoding="utf-8"))
    conn = await asyncpg.connect(settings.DATABASE_URL)
    try:
        await insert_row(conn, "people", payload["person"], null_columns=("reports_to_id",))
        await insert_row(conn, "users", payload["user"])
        print(f"restored admin from {latest}")
        print(await conn.fetchrow("SELECT id, email FROM users"))
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
