import asyncio
import os
import asyncpg


async def migrate():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")

    # PostgreSQL only — never run this against the local SQLite database.
    if database_url.startswith(("sqlite://", "sqlite+")):
        raise RuntimeError(
            "This migration is for PostgreSQL only. "
            "Refusing to run against SQLite."
        )

    if database_url.startswith("postgres://"):
        database_url = database_url.replace(
            "postgres://",
            "postgresql://",
            1,
        )

    print("🔄 Connecting to PostgreSQL...")

    conn = await asyncpg.connect(database_url)

    try:
        # ---------------------------------------------------------
        # 1. USERS
        # ---------------------------------------------------------
        print("🔍 Checking users table...")

        await conn.execute(
            """
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS must_change_password
            BOOLEAN NOT NULL DEFAULT FALSE
            """
        )

        print("✅ users.must_change_password verified")

        # ---------------------------------------------------------
        # 2. ROLES
        # ---------------------------------------------------------
        print("🔍 Checking roles table...")

        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS roles (
                id UUID PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                description TEXT,
                is_system BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )

        print("✅ roles table verified")

        # ---------------------------------------------------------
        # 3. PERMISSIONS
        # ---------------------------------------------------------
        print("🔍 Checking permissions table...")

        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS permissions (
                id UUID PRIMARY KEY,
                resource VARCHAR(100) NOT NULL,
                action VARCHAR(50) NOT NULL,
                description TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )

        print("✅ permissions table verified")

        # ---------------------------------------------------------
        # 4. USER ROLES
        # ---------------------------------------------------------
        print("🔍 Checking user_roles table...")

        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_roles (
                user_id UUID NOT NULL
                    REFERENCES users(id) ON DELETE CASCADE,
                role_id UUID NOT NULL
                    REFERENCES roles(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (user_id, role_id)
            )
            """
        )

        print("✅ user_roles table verified")

        # ---------------------------------------------------------
        # 5. ROLE PERMISSIONS
        # ---------------------------------------------------------
        print("🔍 Checking role_permissions table...")

        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS role_permissions (
                role_id UUID NOT NULL
                    REFERENCES roles(id) ON DELETE CASCADE,
                permission_id UUID NOT NULL
                    REFERENCES permissions(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (role_id, permission_id)
            )
            """
        )

        print("✅ role_permissions table verified")

        # ---------------------------------------------------------
        # 6. PASSWORD RESET TOKENS
        # ---------------------------------------------------------
        print("🔍 Checking password_reset_tokens table...")

        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL
                    REFERENCES users(id) ON DELETE CASCADE,
                token_hash VARCHAR(64) UNIQUE NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                used_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )

        print("✅ password_reset_tokens table verified")

        # ---------------------------------------------------------
        # 7. TIMESHEET COLUMNS
        # ---------------------------------------------------------
        print("🔍 Checking timesheet_entries columns...")

        await conn.execute(
            """
            ALTER TABLE timesheet_entries
            ADD COLUMN IF NOT EXISTS source TEXT
            """
        )

        await conn.execute(
            """
            ALTER TABLE timesheet_entries
            ADD COLUMN IF NOT EXISTS attendance_id TEXT
            """
        )

        await conn.execute(
            """
            ALTER TABLE timesheet_entries
            ADD COLUMN IF NOT EXISTS is_locked
            BOOLEAN NOT NULL DEFAULT FALSE
            """
        )

        print("✅ timesheet_entries columns verified")

        # ---------------------------------------------------------
        # 8. ATTENDANCE COLUMNS
        # ---------------------------------------------------------
        print("🔍 Checking attendance columns...")

        await conn.execute(
            """
            ALTER TABLE attendance
            ADD COLUMN IF NOT EXISTS planned_task_ids TEXT
            """
        )

        await conn.execute(
            """
            ALTER TABLE attendance
            ADD COLUMN IF NOT EXISTS completed_task_ids TEXT
            """
        )

        await conn.execute(
            """
            ALTER TABLE attendance
            ADD COLUMN IF NOT EXISTS adhoc_tasks TEXT
            """
        )

        await conn.execute(
            """
            ALTER TABLE attendance
            ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ
            """
        )

        await conn.execute(
            """
            ALTER TABLE attendance
            ADD COLUMN IF NOT EXISTS checkout_notes TEXT
            """
        )

        print("✅ attendance columns verified")

        print("")
        print("🎉 PostgreSQL schema migration complete!")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(migrate())