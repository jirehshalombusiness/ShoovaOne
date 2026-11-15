-- Operational indexes for hot read paths.
-- Idempotent: safe to re-run.

-- Notification list (user, newest first) and unread badge.
CREATE INDEX IF NOT EXISTS ix_notifications_user_created_at
    ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_notifications_user_is_read
    ON notifications (user_id, is_read);

-- Documents are looked up by their owning record.
CREATE INDEX IF NOT EXISTS ix_documents_related_entity
    ON documents (related_entity_type, related_entity_id);

-- Public applications: duplicate detection and the per-email daily cap.
CREATE INDEX IF NOT EXISTS ix_programme_applications_applicant_email
    ON programme_applications (applicant_email, created_at DESC);
