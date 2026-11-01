-- =============================================
-- MULTI-ENTITY FOUNDATION
-- =============================================
-- One platform, multiple legal entities. Records carry an owning entity;
-- users belong to one or more workspaces without duplicating accounts.
-- Existing data is assigned to Shoova Ghana; Shoova U.S. starts empty.
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------
-- 1. Entities
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    legal_name VARCHAR(255),
    country_code VARCHAR(2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    timezone VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------
-- 2. Workspace membership
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_entity_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    access_level VARCHAR(20) NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_entity_membership UNIQUE (user_id, entity_id)
);

CREATE INDEX IF NOT EXISTS ix_user_entity_memberships_user_id
    ON user_entity_memberships (user_id);

CREATE INDEX IF NOT EXISTS ix_user_entity_memberships_entity_id
    ON user_entity_memberships (entity_id);

-- ---------------------------------------------------------
-- 3. Entity-scoped role grants
-- ---------------------------------------------------------
-- A role in user_roles applies across every workspace the user belongs to;
-- a role here applies only inside the named entity.

CREATE TABLE IF NOT EXISTS user_entity_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, entity_id, role_id)
);

-- ---------------------------------------------------------
-- 4. Ownership column on people
-- ---------------------------------------------------------

ALTER TABLE people
    ADD COLUMN IF NOT EXISTS entity_id UUID
    REFERENCES entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_people_entity_id ON people (entity_id);

-- ---------------------------------------------------------
-- 5. Ownership on audit logs
-- ---------------------------------------------------------
-- audit_logs.entity_id is the audited record's id; owning_entity_id is the
-- legal entity that owns that record.

ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS owning_entity_id UUID
    REFERENCES entities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_audit_logs_owning_entity_id
    ON audit_logs (owning_entity_id);

-- ---------------------------------------------------------
-- 6. Seed the two legal entities
-- ---------------------------------------------------------

INSERT INTO entities (
    id, code, name, legal_name, country_code, currency, timezone, status
)
VALUES (
    gen_random_uuid(),
    'GH',
    'Shoova Ghana',
    'Shoova Initiative LBG',
    'GH',
    'GHS',
    'Africa/Accra',
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    legal_name = EXCLUDED.legal_name,
    country_code = EXCLUDED.country_code,
    currency = EXCLUDED.currency,
    timezone = EXCLUDED.timezone,
    updated_at = now();

INSERT INTO entities (
    id, code, name, legal_name, country_code, currency, timezone, status
)
VALUES (
    gen_random_uuid(),
    'US',
    'Shoova U.S.',
    'Shoova Initiative Corporation',
    'US',
    'USD',
    'America/New_York',
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    legal_name = EXCLUDED.legal_name,
    country_code = EXCLUDED.country_code,
    currency = EXCLUDED.currency,
    timezone = EXCLUDED.timezone,
    updated_at = now();

-- ---------------------------------------------------------
-- 7. Backfill existing records to Ghana
-- ---------------------------------------------------------

UPDATE people
SET entity_id = (SELECT id FROM entities WHERE code = 'GH')
WHERE entity_id IS NULL;

INSERT INTO user_entity_memberships (
    id, user_id, entity_id, is_default, access_level
)
SELECT
    gen_random_uuid(),
    u.id,
    COALESCE(p.entity_id, (SELECT id FROM entities WHERE code = 'GH')),
    TRUE,
    'member'
FROM users u
JOIN people p ON p.id = u.person_id
ON CONFLICT (user_id, entity_id) DO NOTHING;

-- System administrators work across entities.
INSERT INTO user_entity_memberships (
    id, user_id, entity_id, is_default, access_level
)
SELECT
    gen_random_uuid(),
    u.id,
    e.id,
    FALSE,
    'admin'
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
CROSS JOIN (SELECT id FROM entities WHERE code = 'US') e
WHERE r.name = 'system_admin'
ON CONFLICT (user_id, entity_id) DO NOTHING;
