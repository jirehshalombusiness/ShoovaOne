-- =============================================
-- DEVICE REQUESTS
-- =============================================
-- Staff request equipment (laptop, monitor, phone, SIM, ...).
-- The line manager approves the need, HR approves and then fulfils it
-- by assigning an existing device or recording a purchase.
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS device_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(40) NOT NULL UNIQUE,
    requester_id UUID NOT NULL
        REFERENCES people(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    justification TEXT,
    needed_by DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    current_stage VARCHAR(20),
    approval_id UUID
        REFERENCES approval_requests(id) ON DELETE SET NULL,
    manager_decided_by_id UUID
        REFERENCES people(id) ON DELETE SET NULL,
    manager_decided_at TIMESTAMPTZ,
    manager_decision_note TEXT,
    hr_decided_by_id UUID
        REFERENCES people(id) ON DELETE SET NULL,
    hr_decided_at TIMESTAMPTZ,
    hr_decision_note TEXT,
    fulfilment VARCHAR(20),
    device_id UUID
        REFERENCES devices(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ,
    purchase_reference VARCHAR(120),
    close_note TEXT,
    rejection_reason TEXT,
    submitted_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS ix_device_requests_requester_status
    ON device_requests (requester_id, status);

CREATE INDEX IF NOT EXISTS ix_device_requests_status_stage
    ON device_requests (status, current_stage);

CREATE INDEX IF NOT EXISTS ix_device_requests_created_at
    ON device_requests (created_at DESC);

-- ---------------------------------------------------------
-- 3. Permissions
-- ---------------------------------------------------------

INSERT INTO permissions (id, resource, action, description)
VALUES (
    gen_random_uuid(),
    'devices',
    'view',
    'View the device register and device requests'
)
ON CONFLICT (resource, action) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO permissions (id, resource, action, description)
VALUES (
    gen_random_uuid(),
    'devices',
    'manage',
    'Approve device requests and assign equipment'
)
ON CONFLICT (resource, action) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.resource = 'devices'
WHERE r.name IN (
    'ceo',
    'executive_director',
    'head_of_hr',
    'system_admin'
)
ON CONFLICT DO NOTHING;
