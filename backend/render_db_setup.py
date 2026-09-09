import os
import asyncpg
import asyncio
import hashlib
import uuid
from datetime import datetime

async def setup_production_db():
    """Setup database for production on Render."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not set!")
        return
    
    print("✅ Connecting to database...")
    
    # Extract connection details from URL
    # Format: postgresql://user:password@host:port/database
    
    conn = await asyncpg.connect(database_url)
    
    try:
        # Create tables
        print("📊 Creating tables...")
        
        # Check if tables exist
        tables = await conn.fetch("""
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
        """)
        
        existing_tables = [t['tablename'] for t in tables]
        
        if 'users' not in existing_tables:
            # Create tables (simplified for production)
            # In production, use SQLAlchemy migrations
            pass
        
        # Create admin user if not exists
        admin_email = "admin@shoova.com"
        admin_password = os.getenv('ADMIN_PASSWORD', 'password123')
        
        # Check if admin exists
        admin = await conn.fetchrow(
            "SELECT id FROM users WHERE email = $1",
            admin_email
        )
        
        if not admin:
            print("👤 Creating admin user...")
            person_id = str(uuid.uuid4())
            user_id = str(uuid.uuid4())
            password_hash = hashlib.sha256(admin_password.encode()).hexdigest()
            
            await conn.execute("""
                INSERT INTO people (id, first_name, last_name, email, type, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            """, person_id, "Admin", "User", admin_email, "staff")
            
            await conn.execute("""
                INSERT INTO users (id, person_id, email, password_hash, is_active, created_at, updated_at)
                VALUES ($1, $2, $3, $4, true, NOW(), NOW())
            """, user_id, person_id, admin_email, password_hash)
            
            print("✅ Admin user created!")
            print(f"📧 Email: {admin_email}")
            print(f"🔑 Password: {admin_password}")
        else:
            print("✅ Admin user already exists")
        
        print("✅ Database setup complete!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(setup_production_db())