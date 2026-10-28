-- Events module.
--
-- Every statement is idempotent so the migration is safe to re-run and
-- harmless on databases where the module was created by SQLAlchemy.

CREATE TABLE IF NOT EXISTS events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    event_type          VARCHAR(50) NOT NULL DEFAULT 'general',
    status              VARCHAR(30) NOT NULL DEFAULT 'draft',
    starts_at           TIMESTAMPTZ NOT NULL,
    ends_at             TIMESTAMPTZ NOT NULL,
    all_day             BOOLEAN NOT NULL DEFAULT FALSE,
    location            VARCHAR(255),
    is_virtual          BOOLEAN NOT NULL DEFAULT FALSE,
    meeting_url         TEXT,
    organisation_id     UUID REFERENCES organisations(id) ON DELETE SET NULL,
    department_id       UUID REFERENCES departments(id) ON DELETE SET NULL,
    programme_id        UUID REFERENCES programmes(id) ON DELETE SET NULL,
    project_id          UUID REFERENCES projects(id) ON DELETE SET NULL,
    organiser_id        UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    published_at        TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    cancelled_by_id     UUID REFERENCES people(id) ON DELETE SET NULL,
    cancellation_reason TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_attendees (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    person_id     UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    role          VARCHAR(30) NOT NULL DEFAULT 'attendee',
    response      VARCHAR(30) NOT NULL DEFAULT 'pending',
    responded_at  TIMESTAMPTZ,
    response_note TEXT,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_event_attendees_event_person UNIQUE (event_id, person_id)
);

CREATE INDEX IF NOT EXISTS ix_events_status_starts
    ON events (status, starts_at);

CREATE INDEX IF NOT EXISTS ix_events_organiser
    ON events (organiser_id);

CREATE INDEX IF NOT EXISTS ix_events_organisation
    ON events (organisation_id);

CREATE INDEX IF NOT EXISTS ix_events_department
    ON events (department_id);

CREATE INDEX IF NOT EXISTS ix_events_programme
    ON events (programme_id);

CREATE INDEX IF NOT EXISTS ix_events_project
    ON events (project_id);

CREATE INDEX IF NOT EXISTS ix_event_attendees_event
    ON event_attendees (event_id);

CREATE INDEX IF NOT EXISTS ix_event_attendees_person
    ON event_attendees (person_id);
