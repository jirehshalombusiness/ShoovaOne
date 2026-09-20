CREATE TABLE IF NOT EXISTS organisations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organisations_status
    ON organisations(status);


CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL
        REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_departments_organisation_code
        UNIQUE (organisation_id, code)
);

CREATE INDEX IF NOT EXISTS idx_departments_organisation
    ON departments(organisation_id);

CREATE INDEX IF NOT EXISTS idx_departments_status
    ON departments(status);


CREATE TABLE IF NOT EXISTS programmes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL
        REFERENCES organisations(id) ON DELETE CASCADE,
    department_id UUID
        REFERENCES departments(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_programmes_organisation_code
        UNIQUE (organisation_id, code)
);

CREATE INDEX IF NOT EXISTS idx_programmes_organisation
    ON programmes(organisation_id);

CREATE INDEX IF NOT EXISTS idx_programmes_department
    ON programmes(department_id);

CREATE INDEX IF NOT EXISTS idx_programmes_status
    ON programmes(status);


ALTER TABLE projects
    ALTER COLUMN department_id TYPE UUID
    USING NULLIF(department_id, '')::UUID;

ALTER TABLE projects
    ALTER COLUMN programme_id TYPE UUID
    USING NULLIF(programme_id, '')::UUID;

ALTER TABLE projects
    ALTER COLUMN organisation_id TYPE UUID
    USING NULLIF(organisation_id, '')::UUID;


ALTER TABLE projects
    ADD CONSTRAINT fk_projects_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations(id)
        ON DELETE SET NULL;

ALTER TABLE projects
    ADD CONSTRAINT fk_projects_department
        FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON DELETE SET NULL;

ALTER TABLE projects
    ADD CONSTRAINT fk_projects_programme
        FOREIGN KEY (programme_id)
        REFERENCES programmes(id)
        ON DELETE SET NULL;


CREATE INDEX IF NOT EXISTS idx_projects_organisation
    ON projects(organisation_id);

CREATE INDEX IF NOT EXISTS idx_projects_department
    ON projects(department_id);

CREATE INDEX IF NOT EXISTS idx_projects_programme
    ON projects(programme_id);
