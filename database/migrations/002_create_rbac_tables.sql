-- =============================================
-- RBAC TABLES MIGRATION
-- =============================================

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(resource, action)
);

-- Create user_roles table (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- Create role_permissions table (many-to-many)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- =============================================
-- INSERT DEFAULT ROLES
-- =============================================

INSERT OR IGNORE INTO roles (name, description, is_system) VALUES
('ceo', 'Chief Executive Officer - Full system access', 1),
('executive_director', 'Executive Director - Organisation-wide access', 1),
('director', 'Director - Department management', 1),
('manager', 'Manager - Team management', 1),
('staff', 'Staff - Personal and assigned work', 1),
('volunteer', 'Volunteer - Limited access', 1),
('external_partner', 'External Partner - Limited collaboration', 1);

-- =============================================
-- INSERT DEFAULT PERMISSIONS
-- =============================================

INSERT OR IGNORE INTO permissions (resource, action, description) VALUES
-- People
('people', 'view', 'View people directory'),
('people', 'create', 'Create new people'),
('people', 'edit', 'Edit people'),
('people', 'delete', 'Delete people'),

-- HR
('hr', 'view_sensitive', 'View sensitive HR data'),
('hr', 'edit_sensitive', 'Edit sensitive HR data'),

-- Timesheets
('timesheets', 'view', 'View timesheets'),
('timesheets', 'submit', 'Submit timesheets'),
('timesheets', 'approve', 'Approve timesheets'),

-- Projects
('projects', 'view', 'View projects'),
('projects', 'create', 'Create projects'),
('projects', 'edit', 'Edit projects'),
('projects', 'delete', 'Delete projects'),

-- Tasks
('tasks', 'view', 'View tasks'),
('tasks', 'create', 'Create tasks'),
('tasks', 'edit', 'Edit tasks'),
('tasks', 'delete', 'Delete tasks'),

-- CRM
('crm', 'view', 'View CRM data'),
('crm', 'create', 'Create CRM records'),
('crm', 'edit', 'Edit CRM records'),
('crm', 'delete', 'Delete CRM records'),

-- Finance
('finance', 'view', 'View finance data'),
('finance', 'approve', 'Approve finance records'),

-- Users
('users', 'manage', 'Manage users'),
('roles', 'manage', 'Manage roles and permissions'),

-- Events
('events', 'view', 'View events'),
('events', 'create', 'Create events'),
('events', 'edit', 'Edit events'),

-- Attendance
('attendance', 'view', 'View attendance records'),
('attendance', 'checkin', 'Check in/out'),

-- Programmes
('programmes', 'view', 'View programmes'),
('programmes', 'create', 'Create programmes'),
('programmes', 'edit', 'Edit programmes'),

-- Documents
('documents', 'view', 'View documents'),
('documents', 'upload', 'Upload documents');

-- =============================================
-- ASSIGN PERMISSIONS TO ROLES
-- =============================================

-- CEO gets everything
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'ceo';

-- Executive Director gets everything except user/role management
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'executive_director'
AND p.resource NOT IN ('users', 'roles');

-- Director gets most things
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'director'
AND p.action NOT IN ('approve', 'manage')
AND p.resource NOT IN ('users', 'roles', 'finance')
AND NOT (p.resource = 'hr' AND p.action = 'edit_sensitive');

-- Manager gets team-level access
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'manager'
AND p.resource IN ('people', 'timesheets', 'projects', 'tasks', 'events', 'attendance')
AND p.action IN ('view', 'submit', 'create', 'edit', 'checkin');

-- Staff gets personal access
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'staff'
AND p.resource IN ('people', 'timesheets', 'tasks', 'events', 'attendance', 'documents')
AND p.action IN ('view', 'submit', 'checkin', 'upload');

-- Volunteer gets limited access
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'volunteer'
AND p.resource IN ('people', 'tasks', 'events', 'attendance')
AND p.action IN ('view', 'checkin');

-- =============================================
-- ASSIGN CEO ROLE TO ADMIN USER
-- =============================================

-- Get admin user ID
WITH admin_user AS (
    SELECT id FROM users WHERE email = 'admin@shoova.com'
)
INSERT OR IGNORE INTO user_roles (user_id, role_id)
SELECT admin_user.id, roles.id
FROM admin_user, roles
WHERE roles.name = 'ceo';

-- =============================================
-- TRIGGERS FOR updated_at
-- =============================================

CREATE TRIGGER update_roles_updated_at 
AFTER UPDATE ON roles 
BEGIN 
    UPDATE roles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
END;

CREATE TRIGGER update_permissions_updated_at 
AFTER UPDATE ON permissions 
BEGIN 
    UPDATE permissions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; 
END;