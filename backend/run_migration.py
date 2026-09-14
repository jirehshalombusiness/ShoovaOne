import sqlite3
import os
import uuid

# Get the backend directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(backend_dir, 'shoova_one.db')
migration_path = os.path.join(backend_dir, '..', 'database', 'migrations', '002_create_rbac_tables.sql')

print(f"📁 Database path: {db_path}")
print(f"📁 Migration path: {migration_path}")

def run_migration():
    # Connect to the database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Read the migration file
    try:
        with open(migration_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
            print("📄 Migration file loaded successfully!")
    except FileNotFoundError:
        print(f"❌ Migration file not found at: {migration_path}")
        conn.close()
        return
    
    # For SQLite, we need to handle the SQL differently since UUID functions don't exist
    # Let's create tables manually
    
    # Create roles table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        is_system INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    print("✅ roles table created")
    
    # Create permissions table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        resource TEXT NOT NULL,
        action TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(resource, action)
    )
    ''')
    print("✅ permissions table created")
    
    # Create user_roles table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS user_roles (
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, role_id)
    )
    ''')
    print("✅ user_roles table created")
    
    # Create role_permissions table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS role_permissions (
        role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
        permission_id TEXT REFERENCES permissions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, permission_id)
    )
    ''')
    print("✅ role_permissions table created")
    
    # Insert default roles
    roles = [
        ('ceo', 'Chief Executive Officer - Full system access', 1),
        ('executive_director', 'Executive Director - Organisation-wide access', 1),
        ('director', 'Director - Department management', 1),
        ('manager', 'Manager - Team management', 1),
        ('staff', 'Staff - Personal and assigned work', 1),
        ('volunteer', 'Volunteer - Limited access', 1),
        ('external_partner', 'External Partner - Limited collaboration', 1),
    ]
    
    for name, description, is_system in roles:
        cursor.execute(
            'INSERT OR IGNORE INTO roles (id, name, description, is_system) VALUES (?, ?, ?, ?)',
            (str(uuid.uuid4()), name, description, is_system)
        )
    print("✅ Default roles inserted")
    
    # Insert default permissions
    permissions = [
        # People
        ('people', 'view', 'View people directory'),
        ('people', 'create', 'Create new people'),
        ('people', 'edit', 'Edit people'),
        ('people', 'delete', 'Delete people'),
        # HR
        ('hr', 'view_sensitive', 'View sensitive HR data'),
        ('hr', 'edit_sensitive', 'Edit sensitive HR data'),
        # Timesheets
        ('timesheets', 'view', 'View timesheets'),
        ('timesheets', 'submit', 'Submit timesheets'),
        ('timesheets', 'approve', 'Approve timesheets'),
        # Projects
        ('projects', 'view', 'View projects'),
        ('projects', 'create', 'Create projects'),
        ('projects', 'edit', 'Edit projects'),
        ('projects', 'delete', 'Delete projects'),
        # Tasks
        ('tasks', 'view', 'View tasks'),
        ('tasks', 'create', 'Create tasks'),
        ('tasks', 'edit', 'Edit tasks'),
        ('tasks', 'delete', 'Delete tasks'),
        # CRM
        ('crm', 'view', 'View CRM data'),
        ('crm', 'create', 'Create CRM records'),
        ('crm', 'edit', 'Edit CRM records'),
        ('crm', 'delete', 'Delete CRM records'),
        # Finance
        ('finance', 'view', 'View finance data'),
        ('finance', 'approve', 'Approve finance records'),
        # Users
        ('users', 'manage', 'Manage users'),
        ('roles', 'manage', 'Manage roles and permissions'),
        # Events
        ('events', 'view', 'View events'),
        ('events', 'create', 'Create events'),
        ('events', 'edit', 'Edit events'),
        # Attendance
        ('attendance', 'view', 'View attendance records'),
        ('attendance', 'checkin', 'Check in/out'),
        # Programmes
        ('programmes', 'view', 'View programmes'),
        ('programmes', 'create', 'Create programmes'),
        ('programmes', 'edit', 'Edit programmes'),
        # Documents
        ('documents', 'view', 'View documents'),
        ('documents', 'upload', 'Upload documents'),
    ]
    
    for resource, action, description in permissions:
        cursor.execute(
            'INSERT OR IGNORE INTO permissions (id, resource, action, description) VALUES (?, ?, ?, ?)',
            (str(uuid.uuid4()), resource, action, description)
        )
    print("✅ Default permissions inserted")

    # Assign the default permissions to each system role. This is intentionally
    # idempotent so existing databases are repaired when the migration is rerun.
    role_permission_rules = {
        'ceo': lambda resource, action: True,
        'executive_director': lambda resource, action: resource not in ('users', 'roles'),
        'director': lambda resource, action: (
            action not in ('approve', 'manage')
            and resource not in ('users', 'roles', 'finance')
            and not (resource == 'hr' and action == 'edit_sensitive')
        ),
        'manager': lambda resource, action: (
            resource in ('people', 'timesheets', 'projects', 'tasks', 'events', 'attendance')
            and action in ('view', 'submit', 'create', 'edit', 'checkin')
        ),
        'staff': lambda resource, action: (
            resource in ('people', 'timesheets', 'tasks', 'events', 'attendance', 'documents')
            and action in ('view', 'submit', 'checkin', 'upload')
        ),
        'volunteer': lambda resource, action: (
            resource in ('people', 'tasks', 'events', 'attendance')
            and action in ('view', 'checkin')
        ),
    }

    for role_name, permission_rule in role_permission_rules.items():
        cursor.execute('SELECT id FROM roles WHERE name = ?', (role_name,))
        role = cursor.fetchone()
        if not role:
            continue

        cursor.execute('SELECT id, resource, action FROM permissions')
        for permission_id, resource, action in cursor.fetchall():
            if permission_rule(resource, action):
                cursor.execute(
                    'INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
                    (role[0], permission_id)
                )
    print("✅ Default role permissions assigned")
    
    # Assign CEO role to admin user
    cursor.execute("SELECT id FROM users WHERE email = 'admin@shoova.com'")
    admin_user = cursor.fetchone()
    
    if admin_user:
        cursor.execute("SELECT id FROM roles WHERE name = 'ceo'")
        ceo_role = cursor.fetchone()
        if ceo_role:
            cursor.execute(
                'INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)',
                (admin_user[0], ceo_role[0])
            )
            print("✅ Assigned CEO role to admin user")
    
        # Add password reset support
    cursor.execute("PRAGMA table_info(users)")
    user_columns = [row[1] for row in cursor.fetchall()]

    if "must_change_password" not in user_columns:
        cursor.execute(
            "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0"
        )
        print("✅ Added must_change_password column to users")

    # Create password reset tokens table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP
    )
    ''')

    cursor.execute('''
    CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user_id
    ON password_reset_tokens(user_id)
    ''')

    cursor.execute('''
    CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_token_hash
    ON password_reset_tokens(token_hash)
    ''')

    print("✅ password_reset_tokens table created")

        # ATTENDANCE SECURITY/HR FIELDS
    cursor.execute("PRAGMA table_info(attendance)")
    attendance_columns = [row[1] for row in cursor.fetchall()]

    attendance_fields = [
        ("planned_task_ids", "TEXT"),
        ("completed_task_ids", "TEXT"),
        ("adhoc_tasks", "TEXT"),
        ("confirmed_at", "TIMESTAMP"),
        ("checkout_notes", "TEXT"),
    ]

    for column_name, column_type in attendance_fields:
        if column_name not in attendance_columns:
            cursor.execute(
                f"ALTER TABLE attendance ADD COLUMN {column_name} {column_type}"
            )
            print(f"✅ Added {column_name} column to attendance")


    conn.commit()
    conn.close()
    print("✅ Migration completed successfully!")

if __name__ == "__main__":
    run_migration()