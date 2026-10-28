-- Performance indexes for hot list, dashboard and scheduler queries.
--
-- Every statement is idempotent (IF NOT EXISTS) and additive; no data is
-- modified. Names are prefixed with ix_perf_ to avoid clashing with
-- indexes created by SQLAlchemy from the models.

-- ---------------------------------------------------------
-- Attendance and work sessions
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS ix_perf_attendance_status_heartbeat
    ON attendance (current_status, last_heartbeat_at);

CREATE INDEX IF NOT EXISTS ix_perf_work_sessions_attendance
    ON work_sessions (attendance_id);

CREATE INDEX IF NOT EXISTS ix_perf_work_sessions_person_started
    ON work_sessions (person_id, started_at DESC);

CREATE INDEX IF NOT EXISTS ix_perf_work_sessions_status_activity
    ON work_sessions (status, last_activity_at);

-- ---------------------------------------------------------
-- Timesheets
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS ix_perf_timesheets_status_week
    ON timesheets (status, week_start_date);

CREATE INDEX IF NOT EXISTS ix_perf_timesheet_entries_timesheet_date
    ON timesheet_entries (timesheet_id, date);

-- ---------------------------------------------------------
-- Approvals and leave
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS ix_perf_approvals_status_due
    ON approval_requests (status, due_at);

CREATE INDEX IF NOT EXISTS ix_perf_leave_requests_person_status
    ON leave_requests (person_id, status);

CREATE INDEX IF NOT EXISTS ix_perf_leave_requests_status_dates
    ON leave_requests (status, start_date, end_date);

CREATE INDEX IF NOT EXISTS ix_perf_leave_balances_person_year
    ON leave_balances (person_id, year);

-- ---------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS ix_perf_notifications_user_unread
    ON notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_perf_notifications_user_link
    ON notifications (user_id, link);

-- ---------------------------------------------------------
-- Documents
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS ix_perf_documents_entity
    ON documents (related_entity_type, related_entity_id);

CREATE INDEX IF NOT EXISTS ix_perf_documents_owner
    ON documents (owner_id);

CREATE INDEX IF NOT EXISTS ix_perf_documents_type
    ON documents (document_type_id);

-- ---------------------------------------------------------
-- Projects and tasks
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS ix_perf_projects_manager
    ON projects (manager_id);

CREATE INDEX IF NOT EXISTS ix_perf_projects_status
    ON projects (status);

CREATE INDEX IF NOT EXISTS ix_perf_project_members_person
    ON project_members (person_id);

CREATE INDEX IF NOT EXISTS ix_perf_project_members_project_person
    ON project_members (project_id, person_id);

CREATE INDEX IF NOT EXISTS ix_perf_tasks_assignee_status_due
    ON tasks (assignee_id, status, due_date);

CREATE INDEX IF NOT EXISTS ix_perf_tasks_project_status
    ON tasks (project_id, status);

CREATE INDEX IF NOT EXISTS ix_perf_milestones_project_due
    ON milestones (project_id, due_date);

-- ---------------------------------------------------------
-- Meetings
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS ix_perf_meetings_status_start
    ON meetings (status, starts_at);

CREATE INDEX IF NOT EXISTS ix_perf_meetings_organizer_start
    ON meetings (organizer_id, starts_at DESC);

-- ---------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS ix_perf_audit_logs_actor_created
    ON audit_logs (actor_person_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_perf_audit_logs_entity
    ON audit_logs (entity_type, entity_id);
