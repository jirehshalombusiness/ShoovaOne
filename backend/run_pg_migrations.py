import argparse
import asyncio
import os
from pathlib import Path

import asyncpg
from dotenv import load_dotenv


load_dotenv()


DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

DATABASE_URL = DATABASE_URL.replace(
    "postgresql+asyncpg://",
    "postgresql://",
    1,
)

BASE_DIR = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = BASE_DIR / "database" / "migrations"


def migration_files():
    return sorted(MIGRATIONS_DIR.glob("*.sql"))


def select_files(versions):
    """Return the migration files for the given version prefixes."""
    files = migration_files()
    if not versions:
        return files

    wanted = {version.zfill(3) for version in versions}
    known = {file.name.split("_", 1)[0] for file in files}
    missing = wanted - known
    if missing:
        raise SystemExit(
            f"Unknown migration version(s): {', '.join(sorted(missing))}"
        )
    return [file for file in files if file.name.split("_", 1)[0] in wanted]


def strip_transaction_control(sql):
    """Remove a file's own BEGIN/COMMIT so it can run inside one transaction."""
    stripped = sql.strip()
    if stripped[:6].upper() == "BEGIN;":
        stripped = stripped[6:].lstrip()
    if stripped[-7:].upper() == "COMMIT;":
        stripped = stripped[:-7].rstrip()
    return stripped


async def ensure_migration_table(conn):
    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(20) PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )


async def applied_versions(conn):
    rows = await conn.fetch("SELECT version FROM schema_migrations")
    return {row["version"] for row in rows}


async def baseline(version, filename):
    conn = await asyncpg.connect(DATABASE_URL)

    try:
        await ensure_migration_table(conn)

        existing = await conn.fetchval(
            """
            SELECT 1
            FROM schema_migrations
            WHERE version = $1
            """,
            version,
        )

        if existing:
            print(
                f"[skip]  Migration {version} is already "
                f"recorded as applied."
            )
            return

        await conn.execute(
            """
            INSERT INTO schema_migrations
                (version, filename)
            VALUES ($1, $2)
            """,
            version,
            filename,
        )

        print(
            f"[ok] Baseline recorded: "
            f"{version} -> {filename}"
        )

    finally:
        await conn.close()


async def migration_status():
    """Print applied/pending state without writing anything."""
    conn = await asyncpg.connect(DATABASE_URL)

    try:
        await ensure_migration_table(conn)
        applied = await applied_versions(conn)

        for migration_file in migration_files():
            version = migration_file.name.split("_", 1)[0]
            state = "applied" if version in applied else "PENDING"
            print(f"{state:8} {migration_file.name}")

    finally:
        await conn.close()


async def run_migrations(versions=None, force=False):
    conn = await asyncpg.connect(DATABASE_URL)

    try:
        await ensure_migration_table(conn)

        for migration_file in select_files(versions):
            version = migration_file.name.split("_", 1)[0]

            if not force and version in await applied_versions(conn):
                print(
                    f"[skip]  Skipping {migration_file.name} "
                    f"(already applied)"
                )
                continue

            print(
                f"[run]  Applying {migration_file.name}"
            )

            sql = strip_transaction_control(
                migration_file.read_text(encoding="utf-8")
            )

            async with conn.transaction():
                await conn.execute(sql)

                await conn.execute(
                    """
                    INSERT INTO schema_migrations
                        (version, filename)
                    VALUES ($1, $2)
                    ON CONFLICT (version) DO UPDATE
                    SET filename = EXCLUDED.filename,
                        applied_at = NOW()
                    """,
                    version,
                    migration_file.name,
                )

            print(
                f"[ok] Applied {migration_file.name}"
            )

        print("\n[ok] PostgreSQL migrations completed.")

    finally:
        await conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Apply ShoovaONE SQL migrations to DATABASE_URL.",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="List applied/pending migrations without writing.",
    )
    parser.add_argument(
        "--only",
        nargs="+",
        metavar="VERSION",
        help="Apply only these version prefixes, e.g. --only 012 021.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-run selected migrations even when already recorded.",
    )
    parser.add_argument(
        "--baseline",
        nargs=2,
        metavar=("VERSION", "FILENAME"),
        help="Record an already-applied migration without running it.",
    )
    args = parser.parse_args()

    if args.baseline:
        asyncio.run(baseline(args.baseline[0], args.baseline[1]))
        return

    if args.status:
        asyncio.run(migration_status())
        return

    asyncio.run(run_migrations(args.only, args.force))


if __name__ == "__main__":
    main()
