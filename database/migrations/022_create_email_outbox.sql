-- Durable transactional email outbox with retry bookkeeping.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS email_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_address VARCHAR(320) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    next_attempt_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_email_outbox_status
    ON email_outbox(status);

CREATE INDEX IF NOT EXISTS ix_email_outbox_next_attempt_at
    ON email_outbox(next_attempt_at);

CREATE INDEX IF NOT EXISTS ix_email_outbox_created_at
    ON email_outbox(created_at);
