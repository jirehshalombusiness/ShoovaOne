"""Full JSON backup of every table in the configured database.

Usage (from backend/):
    python scripts/sim_backup.py
"""
import asyncio
import datetime as dt
import decimal
import json
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import asyncpg

from app.core.config import settings

BACKUP_DIR = Path(__file__).resolve().parents[1] / "backups"


def _default(value):
    if isinstance(value, (uuid.UUID, dt.datetime, dt.date, dt.time)):
        return str(value)
    if isinstance(value, decimal.Decimal):
        return str(value)
    if isinstance(value, (bytes, bytearray)):
        return "<bytes>"
    raise TypeError(f"Unsupported type {type(value)!r}")


async def main() -> None:
    url = settings.DATABASE_URL
    if url.startswith("sqlite"):
        raise SystemExit("Refusing to back up: DATABASE_URL points at SQLite.")

    conn = await asyncpg.connect(url)
    try:
        tables = [
            row["table_name"]
            for row in await conn.fetch(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """
            )
        ]

        dump = {}
        counts = {}
        for table in tables:
            rows = await conn.fetch(f'SELECT * FROM "{table}"')
            dump[table] = [dict(row) for row in rows]
            counts[table] = len(rows)
    finally:
        await conn.close()

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = BACKUP_DIR / f"sim_reset_backup_{stamp}.json"
    path.write_text(json.dumps(dump, default=_default, indent=1), encoding="utf-8")

    print(f"backup -> {path}")
    print(f"tables={len(tables)} rows={sum(counts.values())}")
    for name in tables:
        if counts[name]:
            print(f"  {name:40s} {counts[name]}")


if __name__ == "__main__":
    asyncio.run(main())
