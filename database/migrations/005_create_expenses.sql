-- EXPENSES MIGRATION

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    expense_number VARCHAR(50) NOT NULL UNIQUE,

    title VARCHAR(200) NOT NULL,
    description TEXT,

    category VARCHAR(100) NOT NULL,

    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'GHS',

    incurred_date DATE NOT NULL,

    requester_id UUID NOT NULL
        REFERENCES people(id)
        ON DELETE RESTRICT,

    project_id UUID
        REFERENCES projects(id)
        ON DELETE SET NULL,

    programme_id UUID,

    department_id UUID,

    vendor_name VARCHAR(200),

    vendor_reference VARCHAR(100),

    payment_method VARCHAR(50),

    status VARCHAR(30) NOT NULL DEFAULT 'draft',

    submitted_at TIMESTAMPTZ,

    reviewed_at TIMESTAMPTZ,

    approved_at TIMESTAMPTZ,

    paid_at TIMESTAMPTZ,

    reconciled_at TIMESTAMPTZ,

    reviewer_id UUID
        REFERENCES people(id)
        ON DELETE SET NULL,

    approver_id UUID
        REFERENCES people(id)
        ON DELETE SET NULL,

    payer_id UUID
        REFERENCES people(id)
        ON DELETE SET NULL,

    reconciler_id UUID
        REFERENCES people(id)
        ON DELETE SET NULL,

    review_notes TEXT,

    approval_notes TEXT,

    rejection_reason TEXT,

    payment_notes TEXT,

    reconciliation_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_expenses_status
    ON expenses(status);

CREATE INDEX IF NOT EXISTS idx_expenses_requester
    ON expenses(requester_id);

CREATE INDEX IF NOT EXISTS idx_expenses_project
    ON expenses(project_id);

CREATE INDEX IF NOT EXISTS idx_expenses_incurred_date
    ON expenses(incurred_date);

CREATE INDEX IF NOT EXISTS idx_expenses_category
    ON expenses(category);

CREATE INDEX IF NOT EXISTS idx_expenses_submitted_at
    ON expenses(submitted_at);

CREATE INDEX IF NOT EXISTS idx_expenses_approver
    ON expenses(approver_id);