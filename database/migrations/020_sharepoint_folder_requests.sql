-- Folder creation and deletion requests, with CEO approval.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS sharepoint_folder_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(20) NOT NULL
        CHECK (action IN ('create', 'delete')),
    folder_name VARCHAR(255) NOT NULL,
    folder_id VARCHAR(400),
    parent_folder_id VARCHAR(400),
    folder_path TEXT NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    decision_note TEXT,
    requested_by_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    resolved_by_id UUID
        REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_sharepoint_folder_requests_requester
    ON sharepoint_folder_requests(requested_by_id);

CREATE INDEX IF NOT EXISTS ix_sharepoint_folder_requests_status_created
    ON sharepoint_folder_requests(status, created_at DESC);
