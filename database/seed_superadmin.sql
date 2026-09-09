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