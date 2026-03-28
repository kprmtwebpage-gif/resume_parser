-- ============================================================
-- Re-queue 203 failed resumes for re-parsing
--
-- Run this on the production DB AFTER the new code is deployed
-- (commit 44f92f7 — fix: resolve PDF extraction timeouts)
--
-- Usage (from production server):
--   docker exec -it resume-db-prod psql -U postgres -d resume_prod -f /tmp/requeue_failed_resumes.sql
--
-- Or from psql prompt:
--   \i /tmp/requeue_failed_resumes.sql
-- ============================================================

-- Check how many are currently failed before re-queuing
SELECT resume_parse_status, COUNT(*) AS total
FROM candidate_profile
GROUP BY resume_parse_status
ORDER BY total DESC;

-- Re-queue all failed resumes (reset to 'pending' so the
-- background ingestion service picks them up for re-parsing)
UPDATE candidate_profile
SET
    resume_parse_status = 'pending',
    parse_failure_reason = NULL,
    parsed_at = NULL
WHERE resume_parse_status = 'failed';

-- Show result
SELECT 'Re-queued: ' || COUNT(*) || ' resumes set back to pending' AS result
FROM candidate_profile
WHERE resume_parse_status = 'pending';
