import sqlite3
import os
import uuid


# Get the backend directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(backend_dir, "shoova_one.db")
migration_path = os.path.join(
    backend_dir,
    "..",
    "database",
    "migrations",
    "002_create_rbac_tables.sql",
)

print(f"📁 Database path: {db_path}")
print(f"📁 Migration path: {migration_path}")


def run_migration():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Enable foreign key enforcement in SQLite
    cursor.execute("PRAGMA foreign_keys = ON")

    # Read migration file
    try:
        with open(migration_path, "r", encoding="utf-8") as f:
            f.read()
            print("📄 Migration file loaded successfully!")
    except FileNotFoundError:
        print(f"❌ Migration file not found at: {migration_path}")
        conn.close()
        return

    # ============================================================
    # ROLES TABLE
    # ============================================================

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS roles (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            is_system INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    print("✅ roles table created")

    # ============================================================
    # PERMISSIONS TABLE
    # ============================================================

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS permissions (
            id TEXT PRIMARY KEY,
            resource TEXT NOT NULL,
            action TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(resource, action)
        )
        """
    )
    print("✅ permissions table created")

    # ============================================================
    # USER ROLES TABLE
    # ============================================================

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS user_roles (
            user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
            role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, role_id)
        )
        """
    )
    print("✅ user_roles table created")

    # ============================================================
    # ROLE PERMISSIONS TABLE
    # ============================================================

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS role_permissions (
            role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
            permission_id TEXT REFERENCES permissions(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (role_id, permission_id)
        )
        """
    )
    print("✅ role_permissions table created")

    # ============================================================
    # DEFAULT SYSTEM ROLES
    # ============================================================

    roles = [
        (
            "ceo",
            "Chief Executive Officer - Full system access",
            1,
        ),
        (
            "executive_director",
            "Executive Director - Organisation-wide access",
            1,
        ),
        (
            "head_of_hr",
            "Head of Human Resources - Full HR management",
            1,
        ),
        (
            "director",
            "Director - Department management",
            1,
        ),
        (
            "manager",
            "Manager - Team management",
            1,
        ),
        (
            "staff",
            "Staff - Personal and assigned work",
            1,
        ),
        (
            "volunteer",
            "Volunteer - Limited access",
            1,
        ),
        (
            "external_partner",
            "External Partner - Limited collaboration",
            1,
        ),
    ]

    for name, description, is_system in roles:
        cursor.execute(
            """
            INSERT OR IGNORE INTO roles
                (id, name, description, is_system)
            VALUES (?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                name,
                description,
                is_system,
            ),
        )

    print("✅ Default roles inserted")

    # ============================================================
    # DEFAULT PERMISSIONS
    # ============================================================

    permissions = [
        # --------------------------------------------------------
        # PEOPLE
        # --------------------------------------------------------
        ("people", "view", "View people directory"),
        ("people", "create", "Create new people"),
        ("people", "edit", "Edit people"),
        ("people", "delete", "Delete people"),

        # --------------------------------------------------------
        # HR
        # --------------------------------------------------------
        ("hr", "view_sensitive", "View sensitive HR data"),
        ("hr", "edit_sensitive", "Edit sensitive HR data"),
        ("hr", "view_employment", "View employment information"),
        ("hr", "edit_employment", "Edit employment information"),
        ("hr", "view_compensation", "View compensation information"),
        ("hr", "edit_compensation", "Edit compensation information"),
        ("hr", "view_leave", "View leave information"),
        ("hr", "edit_leave", "Edit leave information"),
        ("hr", "view_performance", "View performance information"),
        ("hr", "edit_performance", "Edit performance information"),

        # --------------------------------------------------------
        # TIMESHEETS
        # --------------------------------------------------------
        ("timesheets", "view", "View timesheets"),
        ("timesheets", "submit", "Submit timesheets"),
        ("timesheets", "approve", "Approve timesheets"),

        # --------------------------------------------------------
        # PROJECTS
        # --------------------------------------------------------
        ("projects", "view", "View projects"),
        ("projects", "create", "Create projects"),
        ("projects", "edit", "Edit projects"),
        ("projects", "delete", "Delete projects"),

        # --------------------------------------------------------
        # TASKS
        # --------------------------------------------------------
        ("tasks", "view", "View tasks"),
        ("tasks", "create", "Create tasks"),
        ("tasks", "edit", "Edit tasks"),
        ("tasks", "delete", "Delete tasks"),

        # --------------------------------------------------------
        # CRM
        # --------------------------------------------------------
        ("crm", "view", "View CRM data"),
        ("crm", "create", "Create CRM records"),
        ("crm", "edit", "Edit CRM records"),
        ("crm", "delete", "Delete CRM records"),

        # --------------------------------------------------------
        # FINANCE
        # --------------------------------------------------------
        ("finance", "view", "View finance data"),
        ("finance", "approve", "Approve finance records"),

        # --------------------------------------------------------
        # USERS & ROLES
        # --------------------------------------------------------
        ("users", "manage", "Manage users"),
        ("roles", "manage", "Manage roles and permissions"),

        # --------------------------------------------------------
        # EVENTS
        # --------------------------------------------------------
        ("events", "view", "View events"),
        ("events", "create", "Create events"),
        ("events", "edit", "Edit events"),

        # --------------------------------------------------------
        # ATTENDANCE
        # --------------------------------------------------------
        ("attendance", "view", "View attendance records"),
        ("attendance", "checkin", "Check in/out"),
        ("attendance", "edit", "Edit attendance records"),

        # --------------------------------------------------------
        # PROGRAMMES
        # --------------------------------------------------------
        ("programmes", "view", "View programmes"),
        ("programmes", "create", "Create programmes"),
        ("programmes", "edit", "Edit programmes"),

        # --------------------------------------------------------
        # DOCUMENTS
        # --------------------------------------------------------
        ("documents", "view", "View documents"),
        ("documents", "upload", "Upload documents"),
    ]

    for resource, action, description in permissions:
        cursor.execute(
            """
            INSERT OR IGNORE INTO permissions
                (id, resource, action, description)
            VALUES (?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                resource,
                action,
                description,
            ),
        )

    print("✅ Default permissions inserted")

    # ============================================================
    # ROLE PERMISSION RULES
    # ============================================================

    role_permission_rules = {

        # ========================================================
        # CEO / SUPER ADMIN
        # ========================================================
        "ceo": lambda resource, action: True,

        # ========================================================
        # EXECUTIVE DIRECTOR
        # Organisation-wide access, but not system administration
        # ========================================================
        "executive_director": lambda resource, action: (
            resource not in ("users", "roles")
        ),

        # ========================================================
        # HEAD OF HR
        # Full HR access + employee management
        # ========================================================
        "head_of_hr": lambda resource, action: (
            (
                resource == "hr"
                and action in (
                    "view_sensitive",
                    "edit_sensitive",
                    "view_employment",
                    "edit_employment",
                    "view_compensation",
                    "edit_compensation",
                    "view_leave",
                    "edit_leave",
                    "view_performance",
                    "edit_performance",
                )
            )
            or (
                resource == "people"
                and action in (
                    "view",
                    "create",
                    "edit",
                )
            )
            or (
                resource == "attendance"
                and action in (
                    "view",
                    "edit",
                )
            )
            or (
                resource == "documents"
                and action in (
                    "view",
                    "upload",
                )
            )
        ),

        # ========================================================
        # DIRECTOR
        # Department management without system administration
        # or sensitive HR editing
        # ========================================================
        "director": lambda resource, action: (
            action not in ("approve", "manage")
            and resource not in (
                "users",
                "roles",
                "finance",
            )
            and not (
                resource == "hr"
                and action in (
                    "edit_sensitive",
                    "edit_compensation",
                )
            )
        ),

        # ========================================================
        # MANAGER
        # Team-level operational management
        # ========================================================
        "manager": lambda resource, action: (
            resource in (
                "people",
                "timesheets",
                "projects",
                "tasks",
                "events",
                "attendance",
            )
            and action in (
                "view",
                "submit",
                "create",
                "edit",
                "checkin",
            )
        ),

        # ========================================================
        # STAFF
        # Basic operational access
        # ========================================================
        "staff": lambda resource, action: (
            resource in (
                "people",
                "timesheets",
                "tasks",
                "events",
                "attendance",
                "documents",
            )
            and action in (
                "view",
                "submit",
                "checkin",
                "upload",
            )
        ),

        # ========================================================
        # VOLUNTEER
        # Very limited operational access
        # ========================================================
        "volunteer": lambda resource, action: (
            resource in (
                "people",
                "tasks",
                "events",
                "attendance",
            )
            and action in (
                "view",
                "checkin",
            )
        ),

        # ========================================================
        # EXTERNAL PARTNER
        # Restricted collaboration only
        # ========================================================
        "external_partner": lambda resource, action: (
            resource in (
                "projects",
                "tasks",
                "events",
                "documents",
            )
            and action in (
                "view",
                "create",
                "edit",
                "upload",
            )
        ),
    }

    # ============================================================
    # ASSIGN PERMISSIONS TO ROLES
    # ============================================================

    for role_name, permission_rule in role_permission_rules.items():

        cursor.execute(
            "SELECT id FROM roles WHERE name = ?",
            (role_name,),
        )

        role = cursor.fetchone()

        if not role:
            print(f"⚠️ Role not found: {role_name}")
            continue

        role_id = role[0]

        cursor.execute(
            "SELECT id, resource, action FROM permissions"
        )

        all_permissions = cursor.fetchall()

        for permission_id, resource, action in all_permissions:

            if permission_rule(resource, action):

                cursor.execute(
                    """
                    INSERT OR IGNORE INTO role_permissions
                        (role_id, permission_id)
                    VALUES (?, ?)
                    """,
                    (
                        role_id,
                        permission_id,
                    ),
                )

    print("✅ Default role permissions assigned")

    # ============================================================
    # ASSIGN CEO ROLE TO SUPER ADMIN
    # ============================================================

    cursor.execute(
        """
        SELECT id
        FROM users
        WHERE lower(email) = 'admin@shoova.org'
        """
    )

    admin_user = cursor.fetchone()

    if admin_user:

        cursor.execute(
            "SELECT id FROM roles WHERE name = 'ceo'"
        )

        ceo_role = cursor.fetchone()

        if ceo_role:

            cursor.execute(
                """
                INSERT OR IGNORE INTO user_roles
                    (user_id, role_id)
                VALUES (?, ?)
                """,
                (
                    admin_user[0],
                    ceo_role[0],
                ),
            )

            print("✅ Assigned CEO role to admin user")

    # ============================================================
    # USER SECURITY FIELDS
    # ============================================================

    # Check whether must_change_password already exists
    cursor.execute("PRAGMA table_info(users)")
    user_columns = [row[1] for row in cursor.fetchall()]

    if "must_change_password" not in user_columns:
        cursor.execute(
            """
            ALTER TABLE users
            ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0
            """
        )
        print("✅ Added must_change_password column")
        print(
            "✅ Existing users default to "
            "must_change_password = false"
        )
    else:
        print("✅ must_change_password column already exists")

    # ============================================================
    # PASSWORD RESET TOKENS
    # ============================================================

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
        ON password_reset_tokens(user_id)
        """
    )

    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash
        ON password_reset_tokens(token_hash)
        """
    )

    print("✅ password_reset_tokens table created")

        # ============================================================
    # TIMESHEET SECURITY / ATTENDANCE LINK FIELDS
    # ============================================================

    cursor.execute("PRAGMA table_info(timesheet_entries)")
    timesheet_entry_columns = [
        row[1] for row in cursor.fetchall()
    ]

    timesheet_entry_fields = [
        ("source", "TEXT"),
        ("attendance_id", "TEXT"),
        ("is_locked", "INTEGER NOT NULL DEFAULT 0"),
    ]

    for column_name, column_type in timesheet_entry_fields:
        if column_name not in timesheet_entry_columns:
            cursor.execute(
                f"ALTER TABLE timesheet_entries "
                f"ADD COLUMN {column_name} {column_type}"
            )
            print(
                f"✅ Added {column_name} column to timesheet_entries"
            )


    # ============================================================
    # ATTENDANCE SECURITY / HR FIELDS
    # ============================================================

    cursor.execute("PRAGMA table_info(attendance)")
    attendance_columns = [
        row[1] for row in cursor.fetchall()
    ]

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
                f"ALTER TABLE attendance "
                f"ADD COLUMN {column_name} {column_type}"
            )
            print(
                f"✅ Added {column_name} column to attendance"
            )

    # ============================================================
    # COMMIT
    # ============================================================

    conn.commit()
    conn.close()

    print("✅ Migration completed successfully!")


if __name__ == "__main__":
    run_migration()