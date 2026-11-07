-- Learner digital workflow: Enroll -> Learn -> Practice -> Evidence -> Assess
-- -> Progress -> Report, built on top of the programme academic tables (012).
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS learner_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrolment_id UUID NOT NULL
        REFERENCES cohort_enrolments(id) ON DELETE CASCADE,
    household_income_band VARCHAR(50),
    employment_status VARCHAR(50),
    can_afford_training VARCHAR(20),
    device_access VARCHAR(50),
    internet_access VARCHAR(50),
    transport_constraints TEXT,
    education_status VARCHAR(50),
    household_dependents INTEGER,
    vulnerability_class VARCHAR(20),
    notes TEXT,
    recorded_by UUID
        REFERENCES people(id) ON DELETE SET NULL,
    recorded_on DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_learner_baselines_enrolment
        UNIQUE (enrolment_id)
);

CREATE INDEX IF NOT EXISTS ix_learner_baselines_enrolment
    ON learner_baselines(enrolment_id);


CREATE TABLE IF NOT EXISTS module_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrolment_id UUID NOT NULL
        REFERENCES cohort_enrolments(id) ON DELETE CASCADE,
    course_id UUID NOT NULL
        REFERENCES programme_courses(id) ON DELETE CASCADE,
    competency VARCHAR(300) NOT NULL,
    assigned_on DATE,
    due_on DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'assigned',
    next_action VARCHAR(300),
    completed_on DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_module_assignments_enrolment_course
        UNIQUE (enrolment_id, course_id)
);

CREATE INDEX IF NOT EXISTS ix_module_assignments_enrolment
    ON module_assignments(enrolment_id);

CREATE INDEX IF NOT EXISTS ix_module_assignments_course
    ON module_assignments(course_id);

CREATE INDEX IF NOT EXISTS ix_module_assignments_status
    ON module_assignments(status);


CREATE TABLE IF NOT EXISTS practical_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL
        REFERENCES module_assignments(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    instructions TEXT,
    safety_requirements TEXT,
    expected_evidence TEXT,
    due_on DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'assigned',
    completed_on DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_practical_tasks_assignment
    ON practical_tasks(assignment_id);

CREATE INDEX IF NOT EXISTS ix_practical_tasks_status
    ON practical_tasks(status);


CREATE TABLE IF NOT EXISTS evidence_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL
        REFERENCES practical_tasks(id) ON DELETE CASCADE,
    evidence_type VARCHAR(30) NOT NULL DEFAULT 'note',
    document_id UUID
        REFERENCES documents(id) ON DELETE SET NULL,
    file_url TEXT,
    field_notes TEXT,
    reflection TEXT,
    gps_lat DOUBLE PRECISION,
    gps_lng DOUBLE PRECISION,
    location_label VARCHAR(255),
    recorded_on DATE,
    submitted_by UUID
        REFERENCES people(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_evidence_records_task
    ON evidence_records(task_id);


CREATE TABLE IF NOT EXISTS mentor_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id UUID NOT NULL
        REFERENCES evidence_records(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL
        REFERENCES people(id) ON DELETE CASCADE,
    assessed_on DATE,
    competency_result VARCHAR(20) NOT NULL,
    feedback TEXT,
    follow_up TEXT,
    evidence_quality VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_mentor_assessments_evidence
    ON mentor_assessments(evidence_id);

CREATE INDEX IF NOT EXISTS ix_mentor_assessments_mentor
    ON mentor_assessments(mentor_id);


CREATE TABLE IF NOT EXISTS learner_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrolment_id UUID NOT NULL
        REFERENCES cohort_enrolments(id) ON DELETE CASCADE,
    demonstrated_skills TEXT,
    field_outputs TEXT,
    further_training TEXT,
    placement_status VARCHAR(50),
    follow_up_status VARCHAR(50),
    follow_up_on DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_learner_outcomes_enrolment
        UNIQUE (enrolment_id)
);

CREATE INDEX IF NOT EXISTS ix_learner_outcomes_enrolment
    ON learner_outcomes(enrolment_id);

-- ---------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------
-- assess: mentors record competency decisions on learner evidence.
-- view_baseline: socioeconomic data is restricted to leadership;
-- holders of programmes.view/edit alone never see it.

INSERT INTO permissions (id, resource, action, description)
VALUES
    (
        gen_random_uuid(),
        'programmes',
        'assess',
        'Record mentor assessments of learner evidence'
    ),
    (
        gen_random_uuid(),
        'programmes',
        'view_baseline',
        'View learner socioeconomic baseline data'
    )
ON CONFLICT (resource, action) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
    ON p.resource = 'programmes'
    AND p.action IN ('assess', 'view_baseline')
WHERE r.name IN (
    'ceo',
    'executive_director',
    'system_admin'
)
ON CONFLICT DO NOTHING;