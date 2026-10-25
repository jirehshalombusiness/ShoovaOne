-- =============================================
-- PAYROLL PERMISSIONS MIGRATION
-- =============================================

-- Payroll permissions are deliberately separate from finance.* because
-- payroll data is more sensitive and follows a different approval chain.

INSERT INTO permissions (id, resource, action, description)
VALUES
    (gen_random_uuid(), 'payroll', 'view', 'View payroll records'),
    (gen_random_uuid(), 'payroll', 'view_all', 'View payroll records for all employees'),
    (gen_random_uuid(), 'payroll', 'view_own', 'View own payslips and pay profile'),
    (gen_random_uuid(), 'payroll', 'prepare', 'Prepare pay periods and pay runs'),
    (gen_random_uuid(), 'payroll', 'review_hr', 'Submit payroll to Finance on behalf of HR'),
    (gen_random_uuid(), 'payroll', 'review_finance', 'Review and approve payroll at the Finance stage'),
    (gen_random_uuid(), 'payroll', 'approve', 'Give final approval for payroll'),
    (gen_random_uuid(), 'payroll', 'disburse', 'Create, approve and reconcile payroll disbursements'),
    (gen_random_uuid(), 'payroll', 'config', 'Manage payroll configuration'),
    (gen_random_uuid(), 'payroll', 'reports', 'View payroll reports and statutory remittances')
ON CONFLICT (resource, action) DO UPDATE
SET description = EXCLUDED.description;


-- =============================================
-- HEAD OF FINANCE ROLE
-- =============================================

INSERT INTO roles (
    id,
    name,
    description,
    is_system
)
VALUES (
    gen_random_uuid(),
    'head_of_finance',
    'Head of Finance - Financial control, payroll approval and oversight',
    true
)
ON CONFLICT (name) DO NOTHING;


-- =============================================
-- HEAD OF HR
-- =============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
    ON p.resource = 'payroll'
WHERE r.name = 'head_of_hr'
  AND p.action IN (
      'view',
      'view_all',
      'view_own',
      'prepare',
      'review_hr',
      'config',
      'reports'
  )
ON CONFLICT DO NOTHING;


-- =============================================
-- HEAD OF FINANCE
-- =============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
    ON p.resource = 'payroll'
WHERE r.name = 'head_of_finance'
  AND p.action IN (
      'view',
      'view_all',
      'view_own',
      'review_finance',
      'approve',
      'disburse',
      'config',
      'reports'
  )
ON CONFLICT DO NOTHING;


-- =============================================
-- FINANCE MANAGER
-- =============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
    ON p.resource = 'payroll'
WHERE r.name = 'finance_manager'
  AND p.action IN (
      'view',
      'view_all',
      'view_own',
      'review_finance',
      'approve',
      'disburse',
      'config',
      'reports'
  )
ON CONFLICT DO NOTHING;


-- =============================================
-- FINANCE OFFICER
-- =============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
    ON p.resource = 'payroll'
WHERE r.name = 'finance_officer'
  AND p.action IN (
      'view',
      'view_all',
      'view_own',
      'review_finance',
      'disburse',
      'reports'
  )
ON CONFLICT DO NOTHING;


-- =============================================
-- CHIEF EXECUTIVE AND EXECUTIVE DIRECTOR
-- =============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
    ON p.resource = 'payroll'
WHERE r.name IN ('ceo', 'executive_director')
  AND p.action IN (
      'view',
      'view_all',
      'view_own',
      'approve',
      'reports'
  )
ON CONFLICT DO NOTHING;


-- =============================================
-- SYSTEM ADMINISTRATOR
-- =============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
    ON p.resource = 'payroll'
WHERE r.name = 'system_admin'
  AND p.action IN (
      'view_all',
      'config'
  )
ON CONFLICT DO NOTHING;


-- =============================================
-- SELF-SERVICE ACCESS FOR ALL EMPLOYEES
-- =============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
    ON p.resource = 'payroll' AND p.action = 'view_own'
WHERE r.name IN (
    'ceo',
    'executive_director',
    'head_of_hr',
    'head_of_finance',
    'director',
    'manager',
    'staff',
    'volunteer',
    'system_admin',
    'finance_manager',
    'finance_officer'
)
ON CONFLICT DO NOTHING;
