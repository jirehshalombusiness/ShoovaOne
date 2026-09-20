import asyncio
import os
import sys
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
                f"⏭️  Migration {version} is already "
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
            f"✅ Baseline recorded: "
            f"{version} -> {filename}"
        )

    finally:
        await conn.close()


async def run_migrations():
    conn = await asyncpg.connect(DATABASE_URL)

    try:
        await ensure_migration_table(conn)

        migration_files = sorted(
            MIGRATIONS_DIR.glob("*.sql")
        )

        for migration_file in migration_files:
            version = migration_file.name.split("_", 1)[0]

            already_applied = await conn.fetchval(
                """
                SELECT 1
                FROM schema_migrations
                WHERE version = $1
                """,
                version,
            )

            if already_applied:
                print(
                    f"⏭️  Skipping {migration_file.name} "
                    f"(already applied)"
                )
                continue

            print(
                f"▶️  Applying {migration_file.name}"
            )

            sql = migration_file.read_text(
                encoding="utf-8"
            )

            async with conn.transaction():
                await conn.execute(sql)

                await conn.execute(
                    """
                    INSERT INTO schema_migrations
                        (version, filename)
                    VALUES ($1, $2)
                    """,
                    version,
                    migration_file.name,
                )

            print(
                f"✅ Applied {migration_file.name}"
            )

        print("\n✅ PostgreSQL migrations completed.")

    finally:
        await conn.close()


def main():
    if len(sys.argv) == 1:
        asyncio.run(run_migrations())
        return

    if sys.argv[1] == "--baseline":
        if len(sys.argv) != 4:
            raise SystemExit(
                "Usage: python run_pg_migrations.py "
                "--baseline VERSION FILENAME"
            )

        version = sys.argv[2]
        filename = sys.argv[3]

        asyncio.run(
            baseline(version, filename)
        )
        return

    raise SystemExit(
        "Unknown command. "
        "Use --baseline or run without arguments."
    )


if __name__ == "__main__":
    main()