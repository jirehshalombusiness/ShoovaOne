-- =============================================
-- FINANCE PERMISSIONS MIGRATION
-- =============================================

-- Add the complete Finance permission set.
-- Existing permissions are preserved through the
-- UNIQUE(resource, action) constraint.

INSERT INTO permissions (id, resource, action, description)
VALUES
    (gen_random_uuid(), 'finance', 'view', 'View finance records and financial information'),
    (gen_random_uuid(), 'finance', 'create', 'Create finance records and fund requests'),
    (gen_random_uuid(), 'finance', 'edit', 'Edit draft finance records'),
    (gen_random_uuid(), 'finance', 'review', 'Review submitted fund requests'),
    (gen_random_uuid(), 'finance', 'approve', 'Approve finance records and fund requests'),
    (gen_random_uuid(), 'finance', 'reject', 'Reject finance records and fund requests'),
    (gen_random_uuid(), 'finance', 'disburse', 'Record and authorize fund disbursements'),
    (gen_random_uuid(), 'finance', 'reconcile', 'Reconcile completed financial transactions'),
    (gen_random_uuid(), 'finance', 'reports', 'View and generate financial reports'),
    (gen_random_uuid(), 'finance', 'audit_view', 'View the financial audit trail'),
    (gen_random_uuid(), 'finance', 'manage', 'Manage Finance configuration and controls')
ON CONFLICT (resource, action) DO UPDATE
SET description = EXCLUDED.description;


-- =============================================
-- EXECUTIVE DIRECTOR
-- =============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
    ON p.resource = 'finance'
WHERE r.name = 'executive_director'
  AND p.action IN (
      'view',
      'create',
      'edit',
      'review',
      'approve',
      'reject',
      'disburse',
      'reconcile',
      'reports',
      'audit_view'
  )
ON CONFLICT DO NOTHING;


-- =============================================
-- FINANCE MANAGER ROLE
-- =============================================

INSERT INTO roles (
    id,
    name,
    description,
    is_system
)
VALUES (
    gen_random_uuid(),
    'finance_manager',
    'Finance Manager - Financial oversight, approvals, reporting and reconciliation',
    true
)
ON CONFLICT (name) DO NOTHING;


INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
    ON p.resource = 'finance'
WHERE r.name = 'finance_manager'
  AND p.action IN (
      'view',
      'create',
      'edit',
      'review',
      'approve',
      'reject',
      'disburse',
      'reconcile',
      'reports',
      'audit_view'
  )
ON CONFLICT DO NOTHING;


-- =============================================
-- FINANCE OFFICER ROLE
-- =============================================

INSERT INTO roles (
    id,
    name,
    description,
    is_system
)
VALUES (
    gen_random_uuid(),
    'finance_officer',
    'Finance Officer - Finance processing, review, disbursement and reconciliation',
    true
)
ON CONFLICT (name) DO NOTHING;


INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
    ON p.resource = 'finance'
WHERE r.name = 'finance_officer'
  AND p.action IN (
      'view',
      'create',
      'edit',
      'review',
      'reject',
      'disburse',
      'reconcile',
      'reports',
      'audit_view'
  )
ON CONFLICT DO NOTHING;