-- =====================================================================
-- society_query.sql: housing societies with >= 3 COMPLETED jobs (SQLite, READ-ONLY)
-- Run on the production DB (DATABASE_URL=file:/data/dev.db; confirm in Coolify):
--   sqlite3 -readonly /data/dev.db < society_query.sql
-- Safety: opened read-only (-readonly) AND query_only below; the script only SELECTs.
-- Output is aggregate only: no customer names, mobiles or flat numbers.
-- =====================================================================
PRAGMA query_only = ON;   -- any INSERT/UPDATE/DELETE/DDL now fails

-- Pre-flight checks (run first; both must show what you expect):
--   SELECT COUNT(*) AS completed_jobs FROM "Job" WHERE status = 'COMPLETED' AND deletedAt IS NULL AND COALESCE(isDemo, 0) = 0;
--   SELECT COUNT(*) AS with_pin FROM pragma_table_info('Job') WHERE name IN ('pinCode', 'isDemo', 'deletedAt');   -- expect 3
--
-- Societies / complexes with >= 3 COMPLETED jobs (SQLite, read-only).
-- Job has no "society" column: society is free text inside Job.address, so we match known
-- society name fragments (lower-case LIKE). Add or edit rows in the VALUES list as needed.
-- Output is aggregate only: no customer names, mobiles or flat numbers (privacy rule for public pages).
WITH societies(society, locality, pat1, pat2) AS (VALUES
  ('Kumar Prospera',               'East',  'kumar prospera',      NULL),
  ('EON Free Zone area',           'East',  'eon free zone',       'eon it park'),
  ('Marvel Bounty',                'East',  'marvel bounty',       NULL),
  ('Tuscan Estate',                'East',  'tuscan estate',       NULL),
  ('Marvel Como',                  'West',  'marvel como',         NULL),
  ('Pristine Prolife',             'West',  'pristine prolife',    'prolife'),
  ('Kolte Patil Western Avenue',   'West',  'western avenue',      NULL),
  ('Blue Ridge',                   'West',  'blue ridge',          'blueridge'),
  ('Megapolis',                    'West',  'megapolis',           NULL),
  ('Clover Highlands',             'South', 'clover highlands',    NULL),
  ('Clover Park Royale',           'South', 'park royale',         NULL),
  ('Marvel Ganga',                 'South', 'marvel ganga',        NULL),
  ('Bramha Majestic',              'South', 'bramha majestic',     'brahma majestic'),
  ('Raheja Vista',                 'South', 'raheja vista',        NULL),
  ('Marvel Diva',                  'North', 'marvel diva',         NULL),
  ('Kumar Pacific',                'North', 'kumar pacific',       NULL),
  ('Kumar City',                   'North', 'kumar city',          NULL),
  ('Clover Center',                'North', 'clover center',       'clover centre')
)
SELECT
  s.society,
  s.locality                         AS zone,
  COUNT(DISTINCT j.id)               AS completed_jobs,
  COUNT(DISTINCT j.customerMobile)   AS distinct_customers,
  MIN(j.pinCode)                     AS pin_code,
  MIN(date(j.scheduledDate))         AS first_job,
  MAX(date(j.scheduledDate))         AS last_job
FROM societies s
JOIN "Job" j
  ON j.status = 'COMPLETED'
 AND j.deletedAt IS NULL
 AND COALESCE(j.isDemo, 0) = 0
 AND ( lower(j.address) LIKE '%' || s.pat1 || '%'
    OR (s.pat2 IS NOT NULL AND lower(j.address) LIKE '%' || s.pat2 || '%') )
GROUP BY s.society, s.locality
HAVING COUNT(DISTINCT j.id) >= 3
ORDER BY completed_jobs DESC;

-- Discovery query (run separately): completed-job counts by pin code + area, to spot societies
-- missing from the list above. Then eyeball the address text for the busiest areas.
-- SELECT pinCode, area, COUNT(*) AS completed_jobs
-- FROM "Job" WHERE status = 'COMPLETED' AND deletedAt IS NULL AND COALESCE(isDemo, 0) = 0 GROUP BY pinCode, area HAVING COUNT(*) >= 3
-- ORDER BY completed_jobs DESC;
