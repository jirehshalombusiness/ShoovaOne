-- =============================================
-- PEOPLE COUNTRY CODE
-- =============================================
-- ShoovaOne keeps one shared directory for every team, so country is a
-- label on a person rather than a partition of the data. country stays
-- free text for display; country_code is the stable value used for
-- filtering, public holidays and default currencies.
-- Idempotent: safe to re-run.

ALTER TABLE people
    ADD COLUMN IF NOT EXISTS country_code VARCHAR(10);

CREATE INDEX IF NOT EXISTS ix_people_country_code
    ON people (country_code);

-- Backfill from the free-text country already captured on profiles.
UPDATE people
SET country_code = 'GH'
WHERE country_code IS NULL
  AND lower(btrim(coalesce(country, ''))) IN ('gh', 'ghana');

UPDATE people
SET country_code = 'US'
WHERE country_code IS NULL
  AND lower(btrim(coalesce(country, ''))) IN (
      'us', 'usa', 'u.s.', 'u.s.a.',
      'united states', 'united states of america', 'america'
  );

-- Staff without a stated country are Ghana-based unless later corrected.
-- External partners stay unassigned.
UPDATE people
SET country_code = 'GH'
WHERE country_code IS NULL
  AND type = 'staff';
