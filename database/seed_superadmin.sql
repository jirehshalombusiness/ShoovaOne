-- Run in Supabase SQL Editor.
-- Replace CHANGE_THIS_PASSWORD before running. This creates an application user
-- in public.users; it does not create a Supabase Auth user.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

INSERT INTO roles (id, name, description, is_system)
VALUES (gen_random_uuid(), 'ceo', 'Full system access', true)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    is_system = true;

INSERT INTO permissions (id, resource, action, description)
VALUES
    (gen_random_uuid(), 'people', 'view', 'View people directory'),
    (gen_random_uuid(), 'people', 'create', 'Create new people'),
    (gen_random_uuid(), 'people', 'edit', 'Edit people'),
    (gen_random_uuid(), 'people', 'delete', 'Delete people'),
    (gen_random_uuid(), 'hr', 'view_sensitive', 'View sensitive HR data'),
    (gen_random_uuid(), 'hr', 'edit_sensitive', 'Edit sensitive HR data'),
    (gen_random_uuid(), 'timesheets', 'view', 'View timesheets'),
    (gen_random_uuid(), 'timesheets', 'submit', 'Submit timesheets'),
    (gen_random_uuid(), 'timesheets', 'approve', 'Approve timesheets'),
    (gen_random_uuid(), 'projects', 'view', 'View projects'),
    (gen_random_uuid(), 'projects', 'create', 'Create projects'),
    (gen_random_uuid(), 'projects', 'edit', 'Edit projects'),
    (gen_random_uuid(), 'projects', 'delete', 'Delete projects'),
    (gen_random_uuid(), 'tasks', 'view', 'View tasks'),
    (gen_random_uuid(), 'tasks', 'create', 'Create tasks'),
    (gen_random_uuid(), 'tasks', 'edit', 'Edit tasks'),
    (gen_random_uuid(), 'tasks', 'delete', 'Delete tasks'),
    (gen_random_uuid(), 'crm', 'view', 'View CRM data'),
    (gen_random_uuid(), 'crm', 'create', 'Create CRM records'),
    (gen_random_uuid(), 'crm', 'edit', 'Edit CRM records'),
    (gen_random_uuid(), 'crm', 'delete', 'Delete CRM records'),
    (gen_random_uuid(), 'finance', 'view', 'View finance data'),
    (gen_random_uuid(), 'finance', 'approve', 'Approve finance records'),
    (gen_random_uuid(), 'users', 'manage', 'Manage users'),
    (gen_random_uuid(), 'roles', 'manage', 'Manage roles and permissions'),
    (gen_random_uuid(), 'events', 'view', 'View events'),
    (gen_random_uuid(), 'events', 'create', 'Create events'),
    (gen_random_uuid(), 'events', 'edit', 'Edit events'),
    (gen_random_uuid(), 'attendance', 'view', 'View attendance records'),
    (gen_random_uuid(), 'attendance', 'checkin', 'Check in/out'),
    (gen_random_uuid(), 'programmes', 'view', 'View programmes'),
    (gen_random_uuid(), 'programmes', 'create', 'Create programmes'),
    (gen_random_uuid(), 'programmes', 'edit', 'Edit programmes'),
    (gen_random_uuid(), 'documents', 'view', 'View documents'),
    (gen_random_uuid(), 'documents', 'upload', 'Upload documents')
ON CONFLICT (resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'ceo'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO people (id, first_name, last_name, email, type)
VALUES (
    gen_random_uuid(),
    'Super',
    'Admin',
    'admin@shoova.org',
    'staff'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (id, person_id, email, password_hash, is_active)
SELECT
    gen_random_uuid(),
    p.id,
    p.email,
    crypt('CHANGE_THIS_PASSWORD', gen_salt('bf')),
    true
FROM people p
WHERE p.email = 'admin@shoova.org'
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    is_active = true,
    person_id = EXCLUDED.person_id;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE u.email = 'admin@shoova.org'
  AND r.name = 'ceo'
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;

-- Verify the application account:
SELECT u.email, u.is_active, array_agg(r.name) AS roles
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.email = 'admin@shoova.org'
GROUP BY u.email, u.is_active;