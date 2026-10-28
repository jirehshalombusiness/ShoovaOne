-- Remove fields and tables that duplicate another source of truth or
-- are no longer read by any code path.
--
--   people.role      -> RBAC roles (user_roles) plus people.job_title
--   people.position  -> people.job_title
--   people.notes     -> hr_notes
--   leave_request_attachments -> no writer or reader in the application
--   hr_celebrations           -> birthdays/anniversaries are derived from
--                                people.date_of_birth and employment_contracts
--
-- These objects were created outside the migration chain, so every
-- statement is guarded to keep the migration safe on fresh databases.

ALTER TABLE people DROP COLUMN IF EXISTS role;
ALTER TABLE people DROP COLUMN IF EXISTS position;
ALTER TABLE people DROP COLUMN IF EXISTS notes;

DROP TABLE IF EXISTS leave_request_attachments;
DROP TABLE IF EXISTS hr_celebrations;
