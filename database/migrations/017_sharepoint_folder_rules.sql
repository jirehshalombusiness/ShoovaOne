-- =============================================
-- SHAREPOINT FOLDER ACCESS RULES
-- =============================================
-- The library is browsed with one app-only identity, so SharePoint's own
-- per-file permissions never reach the viewer. These rules let ShoovaOne
-- hide a folder subtree from anyone who lacks a permission.
--
-- folder_path is drive-relative and applies to every descendant.
-- folder_id is an optimisation for renamed folders; path is authoritative.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS sharepoint_folder_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id VARCHAR(400),
    folder_path TEXT NOT NULL UNIQUE,
    folder_name VARCHAR(255),
    required_permission VARCHAR(100) NOT NULL,
    created_by_id UUID
        REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_sharepoint_folder_rules_folder_id
    ON sharepoint_folder_rules (folder_id)
    WHERE folder_id IS NOT NULL;

-- ---------------------------------------------------------
-- Permission
-- ---------------------------------------------------------

INSERT INTO permissions (id, resource, action, description)
VALUES (
    gen_random_uuid(),
    'documents',
    'manage',
    'Manage document folder access rules'
)
ON CONFLICT (resource, action) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.resource = 'documents' AND p.action = 'manage'
WHERE r.name IN (
    'ceo',
    'executive_director',
    'system_admin'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------
-- Default rules
-- ---------------------------------------------------------
-- Finance and Human Resources are not visible to everyone. Holders of
-- finance.view / hr.view_sensitive keep access; everyone else does not.
-- The ids identify the current top-level folders in the Documents drive;
-- enforcement matches on folder_path, so these remain valid if an id is
-- stale.

INSERT INTO sharepoint_folder_rules (
    folder_id,
    folder_path,
    folder_name,
    required_permission
)
VALUES
    (
        '01PKKIBOFHMPRQJJDG2ZDYKMNGUR42W2ZU',
        '/Finance',
        'Finance',
        'finance.view'
    ),
    (
        '01PKKIBOBJJN6JEYIO2RCZXXANXZFJ3NI5',
        '/Human Resources',
        'Human Resources',
        'hr.view_sensitive'
    )
ON CONFLICT (folder_path) DO NOTHING;
