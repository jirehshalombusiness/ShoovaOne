import asyncio
import os
import uuid

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

    # Normalize PostgreSQL URL for asyncpg
    if database_url.startswith("postgresql+asyncpg://"):
        database_url = database_url.replace(
            "postgresql+asyncpg://",
            "postgresql://",
            1,
        )
    elif database_url.startswith("postgres://"):
        database_url = database_url.replace(
            "postgres://",
            "postgresql://",
            1,
        )

    print("🔄 Connecting to PostgreSQL...")

    conn = await asyncpg.connect(database_url)
    try:
        # =========================================================
        # 1. USERS
        # =========================================================
        print("🔍 Checking users table...")

        await conn.execute(
            """
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS must_change_password
            BOOLEAN NOT NULL DEFAULT FALSE
            """
        )

        print("✅ users.must_change_password verified")

        # =========================================================
        # 2. ROLES
        # =========================================================
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

        # =========================================================
        # 3. PERMISSIONS
        # =========================================================
        print("🔍 Checking permissions table...")

        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS permissions (
                id UUID PRIMARY KEY,
                resource VARCHAR(100) NOT NULL,
                action VARCHAR(50) NOT NULL,
                description TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT uq_permissions_resource_action UNIQUE (resource, action)
            )
            """
        )

        print("✅ permissions table verified")

        # =========================================================
        # 4. USER ROLES
        # =========================================================
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

        # =========================================================
        # 5. ROLE PERMISSIONS
        # =========================================================
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

        # =========================================================
        # 6. USER PERMISSIONS
        # =========================================================
        print("🔐 Checking user_permissions table...")

        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_permissions (
                user_id UUID NOT NULL
                    REFERENCES users(id) ON DELETE CASCADE,
                permission_id UUID NOT NULL
                    REFERENCES permissions(id) ON DELETE CASCADE,
                granted_by UUID
                    REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (user_id, permission_id)
            )
            """
        )

        print("✅ user_permissions table verified")

        # =========================================================
        # 5A. PERMISSION DUPLICATE CLEANUP / UNIQUE CONSTRAINT
        # =========================================================
        print("🔍 Checking for duplicate permissions...")

        # Remove duplicate role-permission assignments that would
        # conflict when duplicate permission IDs are consolidated.
        await conn.execute(
            """
            DELETE FROM role_permissions rp
            USING permissions duplicate_permission,
                  permissions keeper_permission
            WHERE rp.permission_id = duplicate_permission.id
              AND keeper_permission.resource = duplicate_permission.resource
              AND keeper_permission.action = duplicate_permission.action
              AND keeper_permission.id < duplicate_permission.id
              AND EXISTS (
                  SELECT 1
                  FROM role_permissions existing_rp
                  WHERE existing_rp.role_id = rp.role_id
                    AND existing_rp.permission_id = keeper_permission.id
              )
            """
        )

        # Repoint remaining role-permission assignments to the
        # keeper permission ID.
        await conn.execute(
            """
            UPDATE role_permissions rp
            SET permission_id = keeper_permission.id
            FROM permissions duplicate_permission
            JOIN permissions keeper_permission
              ON keeper_permission.resource = duplicate_permission.resource
             AND keeper_permission.action = duplicate_permission.action
             AND keeper_permission.id < duplicate_permission.id
            WHERE rp.permission_id = duplicate_permission.id
            """
        )

        # Remove duplicate direct user-permission assignments that
        # would conflict with the keeper permission.
        await conn.execute(
            """
            DELETE FROM user_permissions up
            USING permissions duplicate_permission,
                  permissions keeper_permission
            WHERE up.permission_id = duplicate_permission.id
              AND keeper_permission.resource = duplicate_permission.resource
              AND keeper_permission.action = duplicate_permission.action
              AND keeper_permission.id < duplicate_permission.id
              AND EXISTS (
                  SELECT 1
                  FROM user_permissions existing_up
                  WHERE existing_up.user_id = up.user_id
                    AND existing_up.permission_id = keeper_permission.id
              )
            """
        )

        # Repoint remaining direct user-permission assignments.
        await conn.execute(
            """
            UPDATE user_permissions up
            SET permission_id = keeper_permission.id
            FROM permissions duplicate_permission
            JOIN permissions keeper_permission
              ON keeper_permission.resource = duplicate_permission.resource
             AND keeper_permission.action = duplicate_permission.action
             AND keeper_permission.id < duplicate_permission.id
            WHERE up.permission_id = duplicate_permission.id
            """
        )

        # Keep exactly one permission definition for each
        # resource/action pair.
        await conn.execute(
            """
            DELETE FROM permissions
            WHERE id NOT IN (
                SELECT MIN(id)
                FROM permissions
                GROUP BY resource, action
            )
            """
        )

        # Enforce uniqueness on existing PostgreSQL databases.
        await conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS
                uq_permissions_resource_action
            ON permissions (resource, action)
            """
        )

        print("✅ Permissions are unique and protected")

        # =========================================================
        # 6. DEFAULT SYSTEM ROLES
        print("🔐 Seeding system roles...")

        roles = [
            (
                "ceo",
                "Chief Executive Officer - Full system access",
            ),
           (
                "system_admin",
                "System Administrator - Technical system administration",
            ),
            (
                "executive_director",
                "Executive Director - Organisation-wide access",
            ),
            (
                "head_of_hr",
                "Head of Human Resources - Full HR management",
            ),
            (
                "director",
                "Director - Department management",
            ),
            (
                "manager",
                "Manager - Team management",
            ),
            (
                "staff",
                "Staff - Personal and assigned work",
            ),
            (
                "volunteer",
                "Volunteer - Limited access",
            ),
            (
                "external_partner",
                "External Partner - Limited collaboration",
            ),
        ]

        for name, description in roles:
            await conn.execute(
                """
                INSERT INTO roles
                    (id, name, description, is_system)
                VALUES
                    ($1, $2, $3, TRUE)
                ON CONFLICT (name)
                DO UPDATE SET
                    description = EXCLUDED.description,
                    is_system = TRUE
                """,
                uuid.uuid4(),
                name,
                description,
            )

        print("✅ System roles seeded")

        # =========================================================
        # 7. DEFAULT PERMISSIONS
        # =========================================================
        print("🔐 Seeding permissions...")

        permissions = [
            # PEOPLE
            ("people", "view", "View people directory"),
            ("people", "create", "Create new people"),
            ("people", "edit", "Edit people"),
            ("people", "delete", "Delete people"),

            # HR
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

            # TIMESHEETS
            ("timesheets", "view", "View timesheets"),
            ("timesheets", "submit", "Submit timesheets"),
            ("timesheets", "approve", "Approve timesheets"),
            ("timesheets", "edit_any", "Edit any user's timesheets"),
            # PROJECTS
            ("projects", "view", "View projects"),
            ("projects", "create", "Create projects"),
            ("projects", "edit", "Edit projects"),
            ("projects", "delete", "Delete projects"),

            # TASKS
            ("tasks", "view", "View tasks"),
            ("tasks", "create", "Create tasks"),
            ("tasks", "edit", "Edit tasks"),
            ("tasks", "delete", "Delete tasks"),

            # CRM
            ("crm", "view", "View CRM data"),
            ("crm", "create", "Create CRM records"),
            ("crm", "edit", "Edit CRM records"),
            ("crm", "delete", "Delete CRM records"),

            # FINANCE
            ("finance", "view", "View finance data"),
            ("finance", "approve", "Approve finance records"),

            # USERS & ROLES
            ("users", "manage", "Manage user accounts"),
            ("roles", "manage", "Manage roles and permissions"),

            # AUDIT
            ("audit", "view", "View system audit logs"),

            # SYSTEM ADMINISTRATION
            ("system", "manage", "Manage system configuration and security"),
            # EVENTS
            ("events", "view", "View events"),
            ("events", "create", "Create events"),
            ("events", "edit", "Edit events"),

            # ATTENDANCE
            ("attendance", "view", "View attendance records"),
            ("attendance", "view_any", "View all employees' attendance records"),
            ("attendance", "checkin", "Check in/out"),
            ("attendance", "edit", "Edit attendance records"),

            # PROGRAMMES
            ("programmes", "view", "View programmes"),
            ("programmes", "create", "Create programmes"),
            ("programmes", "edit", "Edit programmes"),

            # DOCUMENTS
            ("documents", "view", "View documents"),
            ("documents", "upload", "Upload documents"),
        ]

        for resource, action, description in permissions:
            existing_permission = await conn.fetchrow(
                """
                SELECT id
                FROM permissions
                WHERE resource = $1
                  AND action = $2
                LIMIT 1
                """,
                resource,
                action,
            )

            if existing_permission:
                await conn.execute(
                    """
                    UPDATE permissions
                    SET description = $1,
                        updated_at = NOW()
                    WHERE id = $2
                    """,
                    description,
                    existing_permission["id"],
                )
            else:
                await conn.execute(
                    """
                    INSERT INTO permissions
                        (id, resource, action, description)
                    VALUES
                        ($1, $2, $3, $4)
                    """,
                    uuid.uuid4(),
                    resource,
                    action,
                    description,
                )

        print("✅ Permissions seeded")

        # =========================================================
        # 8. ROLE PERMISSION RULES
        # =========================================================
        print("🔐 Assigning permissions to roles...")

        def has_permission(role_name, resource, action):
            # -----------------------------------------------------
            # CEO
            # Organizational top-level authority.
            # Full access across Shoova ONE.
            # -----------------------------------------------------
            if role_name == "ceo":
                return True

            # -----------------------------------------------------
            # SYSTEM ADMINISTRATOR
            # Technical/system administration only.
            #
            # System Admin does NOT automatically receive access
            # to sensitive HR, compensation, performance, or
            # other organizational decision-making data.
            # -----------------------------------------------------
            if role_name == "system_admin":
                return (
                    (
                        resource == "users"
                        and action == "manage"
                    )
                    or (
                        resource == "roles"
                        and action == "manage"
                    )
                    or (
                        resource == "system"
                        and action == "manage"
                    )
                )

            # -----------------------------------------------------
            # EXECUTIVE DIRECTOR
            # Organisation-wide operational access except
            # system administration.
            # -----------------------------------------------------
            if role_name == "executive_director":
                return resource not in (
                    "users",
                    "roles",
                    "system",
                )

            # -----------------------------------------------------
            # HEAD OF HR
            # Full HR access + employee management.
            # -----------------------------------------------------
            if role_name == "head_of_hr":
                return (
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
                            "view_any",
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
                )

            # -----------------------------------------------------
            # DIRECTOR
            # Department management without system administration
            # or sensitive HR editing.
            # -----------------------------------------------------
            if role_name == "director":
                return (
                    action not in ("approve", "manage")
                    and resource not in (
                        "users",
                        "roles",
                        "system",
                        "finance",
                    )
                    and not (
                        resource == "hr"
                        and action in (
                            "edit_sensitive",
                            "edit_compensation",
                        )
                    )
                )

            # -----------------------------------------------------
            # MANAGER
            # Team-level operational management.
            # -----------------------------------------------------
            if role_name == "manager":
                return (
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
                )

            # -----------------------------------------------------
            # STAFF
            # Basic operational access.
            # -----------------------------------------------------
            if role_name == "staff":
                return (
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
                )

            # -----------------------------------------------------
            # VOLUNTEER
            # Very limited operational access.
            # -----------------------------------------------------
            if role_name == "volunteer":
                return (
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
                )

            # -----------------------------------------------------
            # EXTERNAL PARTNER
            # Restricted collaboration only.
            # -----------------------------------------------------
            if role_name == "external_partner":
                return (
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
                )

                return False
        # Fetch every permission from PostgreSQL
        all_permissions = await conn.fetch(
            """
            SELECT id, resource, action
            FROM permissions
            """
        )

        for role_name, _ in roles:
            role = await conn.fetchrow(
                """
                SELECT id
                FROM roles
                WHERE name = $1
                """,
                role_name,
            )

            if not role:
                print(f"⚠️ Role not found: {role_name}")
                continue

            role_id = role["id"]

            # Make system-role permissions authoritative.
            # This removes permissions that are no longer allowed
            # by the current role rules before re-assigning the correct ones.
            await conn.execute(
                """
                DELETE FROM role_permissions
                WHERE role_id = $1
                """,
                role_id,
            )

            for permission in all_permissions:
                permission_id = permission["id"]
                resource = permission["resource"]
                action = permission["action"]

                if has_permission(
                    role_name,
                    resource,
                    action,
                ):
                    await conn.execute(
                        """
                        INSERT INTO role_permissions
                            (role_id, permission_id)
                        VALUES
                            ($1, $2)
                        ON CONFLICT (role_id, permission_id)
                        DO NOTHING
                        """,
                        role_id,
                        permission_id,
                    )

        print("✅ Role permissions assigned")

        # =========================================================
        # 9. ASSIGN CEO ROLE TO SUPER ADMIN
        # =========================================================
        print("👑 Checking Super Admin role assignment...")

        admin_user = await conn.fetchrow(
            """
            SELECT id
            FROM users
            WHERE lower(email) = 'admin@shoova.org'
            LIMIT 1
            """
        )

        if admin_user:
            ceo_role = await conn.fetchrow(
                """
                SELECT id
                FROM roles
                WHERE name = 'ceo'
                LIMIT 1
                """
            )

            if ceo_role:
                await conn.execute(
                    """
                    INSERT INTO user_roles
                        (user_id, role_id)
                    VALUES
                        ($1, $2)
                    ON CONFLICT (user_id, role_id)
                    DO NOTHING
                    """,
                    admin_user["id"],
                    ceo_role["id"],
                )

                print("✅ Assigned CEO role to admin@shoova.org")
            else:
                print("⚠️ CEO role was not found")
        else:
            print("⚠️ admin@shoova.org was not found")

        # =========================================================
        # 10. PASSWORD RESET TOKENS
        # =========================================================
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

        # =========================================================
        # 11. TIMESHEET COLUMNS
        # =========================================================
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

        # =========================================================
        # 12. ATTENDANCE COLUMNS
        # =========================================================
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

        # =========================================================
        # COMPLETE
        # =========================================================
        print("")
        print("==============================================")
        print("🎉 PostgreSQL migration complete!")
        print("==============================================")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(migrate())