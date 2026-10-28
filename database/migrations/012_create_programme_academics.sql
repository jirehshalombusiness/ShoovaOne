-- Programme module: academic structure on top of the existing programmes table.
-- Idempotent: safe to run against a database created before these tables existed.

ALTER TABLE programmes
    ADD COLUMN IF NOT EXISTS level VARCHAR(30);

ALTER TABLE programmes
    ADD COLUMN IF NOT EXISTS duration_weeks INTEGER;

ALTER TABLE programmes
    ADD COLUMN IF NOT EXISTS learning_outcomes TEXT;

ALTER TABLE programmes
    ADD COLUMN IF NOT EXISTS lead_id UUID
        REFERENCES people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_programmes_lead
    ON programmes(lead_id);


CREATE TABLE IF NOT EXISTS programme_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_id UUID NOT NULL
        REFERENCES programmes(id) ON DELETE CASCADE,
    code VARCHAR(50),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    sequence INTEGER NOT NULL DEFAULT 0,
    contact_hours INTEGER,
    learning_outcomes TEXT,
    is_optional BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_programme_courses_programme_code
        UNIQUE (programme_id, code)
);

CREATE INDEX IF NOT EXISTS ix_programme_courses_programme
    ON programme_courses(programme_id);


CREATE TABLE IF NOT EXISTS programme_cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_id UUID NOT NULL
        REFERENCES programmes(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50),
    start_date DATE,
    end_date DATE,
    enrolment_opens_on DATE,
    enrolment_closes_on DATE,
    capacity INTEGER,
    delivery_mode VARCHAR(20) NOT NULL DEFAULT 'in_person',
    location VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'planned',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_programme_cohorts_programme_code
        UNIQUE (programme_id, code)
);

CREATE INDEX IF NOT EXISTS ix_programme_cohorts_programme
    ON programme_cohorts(programme_id);

CREATE INDEX IF NOT EXISTS ix_programme_cohorts_status
    ON programme_cohorts(status);

CREATE INDEX IF NOT EXISTS ix_programme_cohorts_start
    ON programme_cohorts(start_date);


CREATE TABLE IF NOT EXISTS cohort_instructors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL
        REFERENCES programme_cohorts(id) ON DELETE CASCADE,
    person_id UUID NOT NULL
        REFERENCES people(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'instructor',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cohort_instructors_cohort_person
        UNIQUE (cohort_id, person_id)
);

CREATE INDEX IF NOT EXISTS ix_cohort_instructors_cohort
    ON cohort_instructors(cohort_id);

CREATE INDEX IF NOT EXISTS ix_cohort_instructors_person
    ON cohort_instructors(person_id);


CREATE TABLE IF NOT EXISTS cohort_enrolments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL
        REFERENCES programme_cohorts(id) ON DELETE CASCADE,
    person_id UUID NOT NULL
        REFERENCES people(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'enrolled',
    enrolled_on DATE,
    completed_on DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cohort_enrolments_cohort_person
        UNIQUE (cohort_id, person_id)
);

CREATE INDEX IF NOT EXISTS ix_cohort_enrolments_cohort
    ON cohort_enrolments(cohort_id);

CREATE INDEX IF NOT EXISTS ix_cohort_enrolments_person
    ON cohort_enrolments(person_id);

CREATE INDEX IF NOT EXISTS ix_cohort_enrolments_status
    ON cohort_enrolments(status);


CREATE TABLE IF NOT EXISTS enrolment_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrolment_id UUID NOT NULL
        REFERENCES cohort_enrolments(id) ON DELETE CASCADE,
    course_id UUID NOT NULL
        REFERENCES programme_courses(id) ON DELETE CASCADE,
    score DOUBLE PRECISION,
    grade VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_enrolment_results_enrolment_course
        UNIQUE (enrolment_id, course_id)
);

CREATE INDEX IF NOT EXISTS ix_enrolment_results_enrolment
    ON enrolment_results(enrolment_id);

CREATE INDEX IF NOT EXISTS ix_enrolment_results_course
    ON enrolment_results(course_id);
