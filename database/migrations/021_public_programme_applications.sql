-- Public programme details and applicant submissions.
-- Idempotent: safe to re-run.

ALTER TABLE programmes
    ADD COLUMN IF NOT EXISTS eligibility_requirements TEXT;

CREATE TABLE IF NOT EXISTS programme_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(32) NOT NULL UNIQUE,
    programme_id UUID NOT NULL
        REFERENCES programmes(id) ON DELETE RESTRICT,
    cohort_id UUID NOT NULL
        REFERENCES programme_cohorts(id) ON DELETE RESTRICT,
    applicant_name VARCHAR(200) NOT NULL,
    applicant_email VARCHAR(320) NOT NULL,
    applicant_phone VARCHAR(50),
    motivation TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_programme_applications_cohort_email
        UNIQUE (cohort_id, applicant_email)
);

CREATE INDEX IF NOT EXISTS ix_programme_applications_programme_id
    ON programme_applications(programme_id);

CREATE INDEX IF NOT EXISTS ix_programme_applications_cohort_id
    ON programme_applications(cohort_id);

CREATE INDEX IF NOT EXISTS ix_programme_applications_reference
    ON programme_applications(reference);
