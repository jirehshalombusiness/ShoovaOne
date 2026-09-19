import asyncio
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.sql.user import User


async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User))
        users = result.scalars().all()

        for user in users:
            print(
                user.email,
                "| active:", user.is_active,
                "| roles:", [role.name for role in user.roles]
            )


if __name__ == "__main__":
    asyncio.run(main())
