from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.sql import func

from app.models.sql.user import User, Person
from app.models.pydantic.user import UserCreate
from app.core.security import get_password_hash
import uuid


class UserService:
    @staticmethod
    async def get_by_id(db: AsyncSession, user_id: str):
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_email(db: AsyncSession, email: str):
        result = await db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_person_id(db: AsyncSession, person_id: str):
        result = await db.execute(
            select(User).where(User.person_id == person_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create_user(db: AsyncSession, user_data: UserCreate):
        # Generate IDs
        person_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        
        # Create person first
        person = Person(
            id=person_id,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            email=user_data.email,
            type="staff",
        )
        db.add(person)
        await db.flush()

        # Create user
        user = User(
            id=user_id,
            person_id=person_id,
            email=user_data.email,
            password_hash=get_password_hash(user_data.password),
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        return user

    @staticmethod
    async def update_last_login(db: AsyncSession, user_id: str):
        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(last_login_at=func.now())
        )
        await db.commit()