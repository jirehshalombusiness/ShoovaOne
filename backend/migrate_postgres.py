import asyncio
import os
import asyncpg


async def migrate():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")

    # This migration is for PostgreSQL only.
    # Refuse to run against the local SQLite database.
    if database_url.startswith(("sqlite://", "sqlite+")):
        raise RuntimeError(
            "This migration is for PostgreSQL only. "
            "Refusing to run against SQLite."
        )

    # Render may provide postgres://
    # asyncpg accepts postgresql://
    if database_url.startswith("postgres://"):
        database_url = database_url.replace(
            "postgres://",
            "postgresql://",
            1,
        )

    print("🔄 Connecting to PostgreSQL...")

    conn = await asyncpg.connect(database_url)

    try:
        print("🔍 Checking users table...")

        column_exists = await conn.fetchval(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'users'
                  AND column_name = 'must_change_password'
            )
            """
        )

        if column_exists:
            print("✅ users.must_change_password already exists")
        else:
            print("➕ Adding users.must_change_password...")

            await conn.execute(
                """
                ALTER TABLE users
                ADD COLUMN must_change_password
                BOOLEAN NOT NULL DEFAULT FALSE
                """
            )

            print("✅ users.must_change_password added successfully")

        print("🎉 PostgreSQL migration complete!")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(migrate())