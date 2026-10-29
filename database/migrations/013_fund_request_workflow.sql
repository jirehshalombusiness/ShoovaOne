-- =============================================
-- FUND REQUEST WORKFLOW REBUILD
-- =============================================
-- Every member of staff can raise a claim. A claim moves through
-- manager -> finance -> CEO approval, is paid by Finance, then closes
-- only after Finance verifies the signed hardcopy receipts.
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------
-- 1. New columns
-- ---------------------------------------------------------

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS request_type VARCHAR(20) NOT NULL DEFAULT 'reimbursement';

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS expense_date DATE;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS current_stage VARCHAR(20);

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS approval_id UUID
        REFERENCES approval_requests(id) ON DELETE SET NULL;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS manager_decided_by_id UUID
        REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS manager_decided_at TIMESTAMPTZ;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS manager_decision_note TEXT;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS finance_decided_by_id UUID
        REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS finance_decided_at TIMESTAMPTZ;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS finance_decision_note TEXT;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS ceo_decided_by_id UUID
        REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS ceo_decided_at TIMESTAMPTZ;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS ceo_decision_note TEXT;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS receipt_required BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS receipt_reference VARCHAR(120);

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS receipt_verified_by_id UUID
        REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS receipt_verified_at TIMESTAMPTZ;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS receipt_verification_note TEXT;

-- ---------------------------------------------------------
-- 2. Carry legacy decision data into the new fields
-- ---------------------------------------------------------

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS reviewer_id UUID;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS review_notes TEXT;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS approver_id UUID;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS approval_notes TEXT;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS reconciler_id UUID;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

ALTER TABLE fund_requests
    ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT;

UPDATE fund_requests
SET manager_decided_by_id = reviewer_id,
    manager_decided_at = reviewed_at,
    manager_decision_note = review_notes
WHERE reviewer_id IS NOT NULL
  AND manager_decided_by_id IS NULL;

UPDATE fund_requests
SET finance_decided_by_id = approver_id,
    finance_decided_at = approved_at,
    finance_decision_note = approval_notes
WHERE approver_id IS NOT NULL
  AND finance_decided_by_id IS NULL;

UPDATE fund_requests
SET receipt_verified_by_id = reconciler_id,
    receipt_verified_at = reconciled_at,
    receipt_verification_note = reconciliation_notes
WHERE reconciler_id IS NOT NULL
  AND receipt_verified_by_id IS NULL;

-- Existing claims were raised for planned activity, not reimbursement.
UPDATE fund_requests
SET request_type = 'advance'
WHERE expense_date IS NULL
  AND request_type = 'reimbursement';

-- ---------------------------------------------------------
-- 3. Status remap
--    under_review -> manager_approved (finance stage)
--    reconciled   -> verified
-- ---------------------------------------------------------

UPDATE fund_requests SET status = 'manager_approved' WHERE status = 'under_review';
UPDATE fund_requests SET status = 'verified' WHERE status = 'reconciled';

UPDATE fund_requests
SET current_stage = CASE status
    WHEN 'submitted' THEN 'manager'
    WHEN 'manager_approved' THEN 'finance'
    WHEN 'finance_approved' THEN 'ceo'
    WHEN 'approved' THEN 'disbursement'
    WHEN 'disbursed' THEN 'verification'
    ELSE NULL
END
WHERE current_stage IS NULL;

UPDATE fund_requests
SET approved_amount = amount_requested
WHERE status IN ('approved', 'disbursed', 'verified')
  AND approved_amount IS NULL;

UPDATE fund_requests
SET amount_disbursed = approved_amount
WHERE status IN ('disbursed', 'verified')
  AND (amount_disbursed IS NULL OR amount_disbursed = 0);

UPDATE fund_requests
SET receipt_verified_at = COALESCE(receipt_verified_at, disbursed_at)
WHERE status = 'verified'
  AND receipt_verified_at IS NULL;

-- ---------------------------------------------------------
-- 4. Drop the superseded columns
-- ---------------------------------------------------------

ALTER TABLE fund_requests DROP COLUMN IF EXISTS reviewer_id;
ALTER TABLE fund_requests DROP COLUMN IF EXISTS reviewed_at;
ALTER TABLE fund_requests DROP COLUMN IF EXISTS review_notes;
ALTER TABLE fund_requests DROP COLUMN IF EXISTS approver_id;
ALTER TABLE fund_requests DROP COLUMN IF EXISTS approval_notes;
ALTER TABLE fund_requests DROP COLUMN IF EXISTS reconciler_id;
ALTER TABLE fund_requests DROP COLUMN IF EXISTS reconciled_at;
ALTER TABLE fund_requests DROP COLUMN IF EXISTS reconciliation_notes;

-- ---------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS ix_fund_requests_requester_status
    ON fund_requests (requester_id, status);

CREATE INDEX IF NOT EXISTS ix_fund_requests_stage_status
    ON fund_requests (current_stage, status);

-- ---------------------------------------------------------
-- 6. Stage label on the shared approval inbox
-- ---------------------------------------------------------

ALTER TABLE approval_requests
    ADD COLUMN IF NOT EXISTS stage VARCHAR(20);

-- ---------------------------------------------------------
-- 7. Receipt verification permission
-- ---------------------------------------------------------

INSERT INTO permissions (id, resource, action, description)
VALUES (
    gen_random_uuid(),
    'finance',
    'verify',
    'Verify signed hardcopy receipts after disbursement'
)
ON CONFLICT (resource, action) DO UPDATE
SET description = EXCLUDED.description;

-- Finance leadership can run the full claim lifecycle. This also
-- repairs head_of_finance, which previously had no Finance grants at
-- all even though it is the Treasurer's role.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.resource = 'finance'
WHERE r.name IN (
    'ceo',
    'executive_director',
    'head_of_finance',
    'finance_manager',
    'finance_officer'
)
AND p.action IN (
    'view',
    'create',
    'edit',
    'review',
    'approve',
    'reject',
    'disburse',
    'verify',
    'reconcile',
    'reports',
    'audit_view'
)
ON CONFLICT DO NOTHING;
