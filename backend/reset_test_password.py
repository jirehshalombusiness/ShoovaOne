import asyncio
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.sql.user import User
from app.core.security import get_password_hash


async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.email == "testuser@shoova.org")
        )
        user = result.scalar_one_or_none()

        if not user:
            print("Test user not found.")
            return

        user.password_hash = get_password_hash("TestPassword123!")
        user.must_change_password = False

        await db.commit()

        print("Test user password reset successfully.")


if __name__ == "__main__":
    asyncio.run(main())
