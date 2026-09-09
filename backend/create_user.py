import asyncio
import sys
import os
import uuid

# Add the current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.models.sql.user import User, Person
from app.models.sql.base import Base
from app.core.security import get_password_hash


async def create_test_user():
    # Convert database URL for async
    database_url = settings.DATABASE_URL
    is_sqlite = database_url.startswith("sqlite://")
    
    if is_sqlite:
        database_url = database_url.replace("sqlite://", "sqlite+aiosqlite://")
    else:
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
    
    print(f"📊 Using database: {database_url}")
    
    # Create engine with appropriate parameters
    if is_sqlite:
        engine = create_async_engine(database_url, echo=True)
    else:
        engine = create_async_engine(database_url, echo=True, pool_size=5, max_overflow=10)
    
    async with engine.begin() as conn:
        # Create tables
        await conn.run_sync(Base.metadata.create_all)
        print("✅ Database tables created!")
        
        # Create session
        async_session = async_sessionmaker(engine, expire_on_commit=False)
        
        async with async_session() as session:
            # Check if user exists
            result = await session.execute(select(User).where(User.email == "admin@shoova.com"))
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                print("✅ Test user already exists!")
                print("📧 Email: admin@shoova.com")
                print("🔑 Password: password123")
                return
            
            # Generate IDs as strings for SQLite compatibility
            person_id = str(uuid.uuid4())
            user_id = str(uuid.uuid4())
            
            # Create person with explicit ID
            person = Person(
                id=person_id,
                first_name="Admin",
                last_name="User",
                email="admin@shoova.com",
                type="staff",
            )
            session.add(person)
            
            # Create user with explicit ID
            user = User(
                id=user_id,
                person_id=person_id,
                email="admin@shoova.com",
                password_hash=get_password_hash("password123"),
                is_active=True,
            )
            session.add(user)
            await session.commit()
            
            print("✅ Test user created successfully!")
            print("📧 Email: admin@shoova.com")
            print("🔑 Password: password123")

if __name__ == "__main__":
    asyncio.run(create_test_user())