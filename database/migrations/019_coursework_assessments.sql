BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_programme_courses_id_programme') THEN
        ALTER TABLE programme_courses ADD CONSTRAINT uq_programme_courses_id_programme UNIQUE (id, programme_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_programme_cohorts_id_programme') THEN
        ALTER TABLE programme_cohorts ADD CONSTRAINT uq_programme_cohorts_id_programme UNIQUE (id, programme_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_cohort_enrolments_id_cohort') THEN
        ALTER TABLE cohort_enrolments ADD CONSTRAINT uq_cohort_enrolments_id_cohort UNIQUE (id, cohort_id);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS course_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_id UUID NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
    course_id UUID NOT NULL,
    cohort_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    instructions TEXT,
    due_on DATE,
    points_possible DOUBLE PRECISION NOT NULL,
    rubric JSON NOT NULL DEFAULT '[]',
    allow_resubmission BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_course_assignments_course_programme FOREIGN KEY (course_id, programme_id)
        REFERENCES programme_courses(id, programme_id) ON DELETE CASCADE,
    CONSTRAINT fk_course_assignments_cohort_programme FOREIGN KEY (cohort_id, programme_id)
        REFERENCES programme_cohorts(id, programme_id) ON DELETE CASCADE,
    CONSTRAINT uq_course_assignments_id_cohort UNIQUE (id, cohort_id),
    CONSTRAINT ck_course_assignments_title CHECK (length(trim(title)) > 0 AND length(title) <= 200),
    CONSTRAINT ck_course_assignments_points CHECK (points_possible > 0 AND points_possible <= 1.7976931348623157e308),
    CONSTRAINT ck_course_assignments_status CHECK (status IN ('draft', 'published', 'closed')),
    CONSTRAINT ck_course_assignments_rubric CHECK (json_typeof(rubric) = 'array')
);

CREATE INDEX IF NOT EXISTS ix_course_assignments_programme_id ON course_assignments(programme_id);
CREATE INDEX IF NOT EXISTS ix_course_assignments_course_id ON course_assignments(course_id);
CREATE INDEX IF NOT EXISTS ix_course_assignments_cohort_id ON course_assignments(cohort_id);
CREATE INDEX IF NOT EXISTS ix_course_assignments_status ON course_assignments(status);

CREATE TABLE IF NOT EXISTS assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL,
    enrolment_id UUID NOT NULL,
    cohort_id UUID NOT NULL,
    attempt INTEGER NOT NULL,
    content TEXT NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_by_id UUID REFERENCES people(id) ON DELETE SET NULL,
    score DOUBLE PRECISION,
    feedback TEXT,
    rubric_scores JSON NOT NULL DEFAULT '{}',
    grading_status VARCHAR(20) NOT NULL DEFAULT 'submitted',
    graded_by_id UUID REFERENCES people(id) ON DELETE SET NULL,
    graded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_assignment_submissions_assignment_cohort FOREIGN KEY (assignment_id, cohort_id)
        REFERENCES course_assignments(id, cohort_id) ON DELETE CASCADE,
    CONSTRAINT fk_assignment_submissions_enrolment_cohort FOREIGN KEY (enrolment_id, cohort_id)
        REFERENCES cohort_enrolments(id, cohort_id) ON DELETE CASCADE,
    CONSTRAINT uq_assignment_submissions_attempt UNIQUE (assignment_id, enrolment_id, attempt),
    CONSTRAINT ck_assignment_submissions_attempt CHECK (attempt >= 1),
    CONSTRAINT ck_assignment_submissions_content CHECK (length(trim(content)) > 0 AND length(content) <= 20000),
    CONSTRAINT ck_assignment_submissions_feedback CHECK (feedback IS NULL OR length(feedback) <= 10000),
    CONSTRAINT ck_assignment_submissions_score CHECK (score IS NULL OR (score >= 0 AND score <= 1.7976931348623157e308)),
    CONSTRAINT ck_assignment_submissions_status CHECK (grading_status IN ('submitted', 'graded', 'changes_requested')),
    CONSTRAINT ck_assignment_submissions_grade CHECK (
        (grading_status = 'graded' AND score IS NOT NULL AND graded_at IS NOT NULL)
        OR (grading_status != 'graded' AND score IS NULL)
    ),
    CONSTRAINT ck_assignment_submissions_changes CHECK (
        grading_status != 'changes_requested'
        OR (feedback IS NOT NULL AND length(trim(feedback)) > 0 AND graded_at IS NOT NULL)
    ),
    CONSTRAINT ck_assignment_submissions_rubric CHECK (json_typeof(rubric_scores) = 'object')
);

CREATE INDEX IF NOT EXISTS ix_assignment_submissions_assignment_id ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS ix_assignment_submissions_enrolment_id ON assignment_submissions(enrolment_id);
CREATE INDEX IF NOT EXISTS ix_assignment_submissions_cohort_id ON assignment_submissions(cohort_id);
CREATE INDEX IF NOT EXISTS ix_assignment_submissions_submitted_by_id ON assignment_submissions(submitted_by_id);
CREATE INDEX IF NOT EXISTS ix_assignment_submissions_graded_by_id ON assignment_submissions(graded_by_id);
CREATE INDEX IF NOT EXISTS ix_assignment_submissions_grading_status ON assignment_submissions(grading_status);

CREATE OR REPLACE FUNCTION validate_coursework_assignment() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    criterion JSON;
    ids TEXT[] := ARRAY[]::TEXT[];
    points DOUBLE PRECISION;
    total DOUBLE PRECISION := 0;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status != 'draft' THEN
        IF NEW.status = 'draft'
            OR NEW.programme_id IS DISTINCT FROM OLD.programme_id
            OR NEW.course_id IS DISTINCT FROM OLD.course_id
            OR NEW.cohort_id IS DISTINCT FROM OLD.cohort_id
            OR NEW.points_possible IS DISTINCT FROM OLD.points_possible
            OR NEW.rubric::JSONB IS DISTINCT FROM OLD.rubric::JSONB THEN
            RAISE EXCEPTION 'Published assignment structure is immutable' USING ERRCODE = '23514';
        END IF;
    END IF;
    IF json_typeof(NEW.rubric) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Rubric must be an array' USING ERRCODE = '23514';
    END IF;
    FOR criterion IN SELECT value FROM json_array_elements(NEW.rubric) LOOP
        IF json_typeof(criterion) IS DISTINCT FROM 'object'
            OR (SELECT count(*) FROM json_object_keys(criterion)) != 3
            OR json_typeof(criterion->'id') IS DISTINCT FROM 'string'
            OR json_typeof(criterion->'label') IS DISTINCT FROM 'string'
            OR json_typeof(criterion->'points') IS DISTINCT FROM 'number'
            OR length(trim(criterion->>'id')) = 0
            OR length(trim(criterion->>'label')) = 0
            OR criterion->>'id' = ANY(ids) THEN
            RAISE EXCEPTION 'Invalid rubric criterion' USING ERRCODE = '23514';
        END IF;
        points := (criterion->>'points')::DOUBLE PRECISION;
        IF NOT (points >= 0 AND points <= 1.7976931348623157e308) THEN
            RAISE EXCEPTION 'Rubric points must be finite and nonnegative' USING ERRCODE = '23514';
        END IF;
        ids := array_append(ids, criterion->>'id');
        total := total + points;
    END LOOP;
    IF cardinality(ids) > 0 AND abs(total - NEW.points_possible) > greatest(1e-8, 1e-9 * greatest(abs(total), abs(NEW.points_possible))) THEN
        RAISE EXCEPTION 'Rubric sum must equal points_possible' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_coursework_assignment ON course_assignments;
CREATE TRIGGER trg_validate_coursework_assignment BEFORE INSERT OR UPDATE ON course_assignments
    FOR EACH ROW EXECUTE FUNCTION validate_coursework_assignment();

CREATE OR REPLACE FUNCTION validate_coursework_submission() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    assignment course_assignments%ROWTYPE;
    criterion JSON;
    value DOUBLE PRECISION;
    total DOUBLE PRECISION := 0;
BEGIN
    IF TG_OP = 'UPDATE' AND (
        NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
        OR NEW.enrolment_id IS DISTINCT FROM OLD.enrolment_id
        OR NEW.cohort_id IS DISTINCT FROM OLD.cohort_id
        OR NEW.attempt IS DISTINCT FROM OLD.attempt
        OR NEW.content IS DISTINCT FROM OLD.content
        OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
        OR (NEW.submitted_by_id IS NOT NULL AND NEW.submitted_by_id IS DISTINCT FROM OLD.submitted_by_id)
    ) THEN
        RAISE EXCEPTION 'Submission attempt content and identity are immutable' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO assignment FROM course_assignments WHERE id = NEW.assignment_id;
    IF json_typeof(NEW.rubric_scores) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'rubric_scores must be an object' USING ERRCODE = '23514';
    END IF;
    IF NEW.grading_status != 'graded' THEN
        IF NEW.rubric_scores::JSONB != '{}'::JSONB THEN
            RAISE EXCEPTION 'Ungraded attempts cannot have rubric scores' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.score > assignment.points_possible THEN
        RAISE EXCEPTION 'Score exceeds points_possible' USING ERRCODE = '23514';
    END IF;
    IF json_array_length(assignment.rubric) = 0 THEN
        IF NEW.rubric_scores::JSONB != '{}'::JSONB THEN
            RAISE EXCEPTION 'Assignment has no rubric' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;
    IF (SELECT count(*) FROM json_object_keys(NEW.rubric_scores)) != json_array_length(assignment.rubric) THEN
        RAISE EXCEPTION 'Rubric score keys must match criteria' USING ERRCODE = '23514';
    END IF;
    FOR criterion IN SELECT v FROM json_array_elements(assignment.rubric) AS t(v) LOOP
        IF json_typeof(NEW.rubric_scores->(criterion->>'id')) IS DISTINCT FROM 'number' THEN
            RAISE EXCEPTION 'Missing or invalid rubric score' USING ERRCODE = '23514';
        END IF;
        value := (NEW.rubric_scores->>(criterion->>'id'))::DOUBLE PRECISION;
        IF NOT (value >= 0 AND value <= (criterion->>'points')::DOUBLE PRECISION) THEN
            RAISE EXCEPTION 'Rubric score exceeds criterion bounds' USING ERRCODE = '23514';
        END IF;
        total := total + value;
    END LOOP;
    IF abs(total - NEW.score) > greatest(1e-8, 1e-9 * greatest(abs(total), abs(NEW.score))) THEN
        RAISE EXCEPTION 'Score must equal rubric score sum' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_coursework_submission ON assignment_submissions;
CREATE TRIGGER trg_validate_coursework_submission BEFORE INSERT OR UPDATE ON assignment_submissions
    FOR EACH ROW EXECUTE FUNCTION validate_coursework_submission();

COMMIT;
