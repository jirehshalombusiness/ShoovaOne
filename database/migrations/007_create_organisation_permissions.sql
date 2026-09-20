-- =============================================
-- ORGANISATION PERMISSIONS MIGRATION
-- =============================================

-- Add the Organisation permission set.
-- Existing permissions are preserved through the
-- UNIQUE(resource, action) constraint.

INSERT INTO permissions (
    id,
    resource,
    action,
    description
)
VALUES
    (
        gen_random_uuid(),
        'organisation',
        'view',
        'View organisations, departments and programmes'
    ),
    (
        gen_random_uuid(),
        'organisation',
        'manage',
        'Create and manage organisations, departments and programmes'
    )
ON CONFLICT (resource, action) DO UPDATE
SET description = EXCLUDED.description;


-- =============================================
-- EXECUTIVE DIRECTOR
-- =============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
    ON p.resource = 'organisation'
WHERE r.name = 'executive_director'
  AND p.action IN (
      'view',
      'manage'
  )
ON CONFLICT DO NOTHING;


-- =============================================
-- FINANCE MANAGER
-- =============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
    ON p.resource = 'organisation'
WHERE r.name = 'finance_manager'
  AND p.action IN (
      'view'
  )
ON CONFLICT DO NOTHING;


-- =============================================
-- FINANCE OFFICER
-- =============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
    ON p.resource = 'organisation'
WHERE r.name = 'finance_officer'
  AND p.action IN (
      'view'
  )
ON CONFLICT DO NOTHING;