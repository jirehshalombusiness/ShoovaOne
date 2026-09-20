-- ============================================================
-- Shoova ONE
-- Finance Foundation
-- Migration 003: Fund Requests
-- ============================================================

CREATE TABLE IF NOT EXISTS fund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    request_number VARCHAR(50) NOT NULL UNIQUE,

    title VARCHAR(200) NOT NULL,
    description TEXT,
    justification TEXT,

    requester_id UUID NOT NULL
        REFERENCES people(id)
        ON DELETE RESTRICT,

    project_id UUID
        REFERENCES projects(id)
        ON DELETE SET NULL,

    -- These currently correspond to existing project/programme
    -- references, but their database types are not relational UUID
    -- columns in the current production schema.
    programme_id UUID,
    department_id UUID,

    amount_requested NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'GHS',

    approved_amount NUMERIC(15, 2),
    amount_disbursed NUMERIC(15, 2) NOT NULL DEFAULT 0,

    status VARCHAR(30) NOT NULL DEFAULT 'draft',

    required_by_date DATE,

    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    disbursed_at TIMESTAMPTZ,
    reconciled_at TIMESTAMPTZ,

    reviewer_id UUID
        REFERENCES people(id)
        ON DELETE SET NULL,

    approver_id UUID
        REFERENCES people(id)
        ON DELETE SET NULL,

    disburser_id UUID
        REFERENCES people(id)
        ON DELETE SET NULL,

    reconciler_id UUID
        REFERENCES people(id)
        ON DELETE SET NULL,

    rejection_reason TEXT,
    review_notes TEXT,
    approval_notes TEXT,
    disbursement_notes TEXT,
    reconciliation_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_fund_requests_status
    ON fund_requests(status);

CREATE INDEX IF NOT EXISTS idx_fund_requests_requester
    ON fund_requests(requester_id);

CREATE INDEX IF NOT EXISTS idx_fund_requests_project
    ON fund_requests(project_id);

CREATE INDEX IF NOT EXISTS idx_fund_requests_submitted_at
    ON fund_requests(submitted_at);

CREATE INDEX IF NOT EXISTS idx_fund_requests_required_by_date
    ON fund_requests(required_by_date);

CREATE INDEX IF NOT EXISTS idx_fund_requests_approver
    ON fund_requests(approver_id);