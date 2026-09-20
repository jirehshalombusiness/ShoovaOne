from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List, Optional

from app.models.sql.user import Person
from app.models.pydantic.person import PersonCreate, PersonUpdate


class PersonService:
    @staticmethod
    async def get_all(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        type: Optional[str] = None,
    ) -> List[Person]:
        query = select(Person).where(Person.deleted_at.is_(None))

        if search:
            query = query.where(
                or_(
                    Person.first_name.ilike(f"%{search}%"),
                    Person.last_name.ilike(f"%{search}%"),
                    Person.email.ilike(f"%{search}%"),
                )
            )

        if type:
            query = query.where(Person.type == type)

        query = query.offset(skip).limit(limit).order_by(Person.created_at.desc())
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_by_id(db: AsyncSession, person_id: str) -> Optional[Person]:
        result = await db.execute(
            select(Person).where(
                Person.id == person_id,
                Person.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_email(db: AsyncSession, email: str) -> Optional[Person]:
        result = await db.execute(
            select(Person).where(
                Person.email == email,
                Person.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create(db: AsyncSession, person_data: PersonCreate) -> Person:
        person = Person(**person_data.model_dump())
        db.add(person)
        await db.commit()
        await db.refresh(person)
        return person

    @staticmethod
    async def update(
        db: AsyncSession,
        person_id: str,
        person_data: PersonUpdate,
    ) -> Optional[Person]:
        person = await PersonService.get_by_id(db, person_id)
        if not person:
            return None

        for key, value in person_data.model_dump(exclude_unset=True).items():
            setattr(person, key, value)

        await db.commit()
        await db.refresh(person)
        return person