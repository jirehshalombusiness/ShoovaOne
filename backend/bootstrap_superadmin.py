import asyncio
import os
import sys
import uuid

import asyncpg
from passlib.context import CryptContext


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def bootstrap_superadmin() -> None:
    database_url = os.getenv("DATABASE_URL")
    password = os.getenv("SUPERADMIN_PASSWORD")
    email = os.getenv("SUPERADMIN_EMAIL", "admin@shoova.org").strip().lower()
    first_name = os.getenv("SUPERADMIN_FIRST_NAME", "Super")
    last_name = os.getenv("SUPERADMIN_LAST_NAME", "Admin")

    if not database_url:
        raise RuntimeError("DATABASE_URL is required")
    if not password or len(password) < 12:
        raise RuntimeError("SUPERADMIN_PASSWORD must be set and contain at least 12 characters")

    conn = await asyncpg.connect(database_url)
    try:
        role = await conn.fetchrow("SELECT id FROM roles WHERE name = 'ceo'")
        if not role:
            role_id = uuid.uuid4()
            await conn.execute(
                """
                INSERT INTO roles (id, name, description, is_system, created_at, updated_at)
                VALUES ($1, 'ceo', 'Full system access', true, NOW(), NOW())
                """,
                role_id,
            )
        else:
            role_id = role["id"]

        person = await conn.fetchrow("SELECT id FROM people WHERE lower(email) = $1", email)
        if not person:
            person_id = uuid.uuid4()
            await conn.execute(
                """
                INSERT INTO people
                    (id, first_name, last_name, email, type, created_at, updated_at)
                VALUES ($1, $2, $3, $4, 'staff', NOW(), NOW())
                """,
                person_id,
                first_name,
                last_name,
                email,
            )
        else:
            person_id = person["id"]

        user = await conn.fetchrow("SELECT id FROM users WHERE lower(email) = $1", email)
        if not user:
            user_id = uuid.uuid4()
            await conn.execute(
                """
                INSERT INTO users
                    (id, person_id, email, password_hash, is_active, created_at, updated_at)
                VALUES ($1, $2, $3, $4, true, NOW(), NOW())
                """,
                user_id,
                person_id,
                email,
                pwd_context.hash(password),
            )
        else:
            user_id = user["id"]
            await conn.execute(
                "UPDATE users SET password_hash = $1, is_active = true, updated_at = NOW() WHERE id = $2",
                pwd_context.hash(password),
                user_id,
            )

        await conn.execute(
            """
            INSERT INTO user_roles (user_id, role_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, role_id) DO NOTHING
            """,
            user_id,
            role_id,
        )
        await conn.execute(
            """
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT $1, id FROM permissions
            ON CONFLICT (role_id, permission_id) DO NOTHING
            """,
            role_id,
        )
        print(f"Super-admin account ready: {email}")
    finally:
        await conn.close()


if __name__ == "__main__":
    try:
        asyncio.run(bootstrap_superadmin())
    except Exception as error:
        print(f"Super-admin bootstrap failed: {error}", file=sys.stderr)
        raise
