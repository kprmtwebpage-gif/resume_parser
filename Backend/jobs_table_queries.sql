-- ================================================================
-- JOBS TABLE - QUICK REFERENCE SQL QUERIES
-- ================================================================
-- Common SQL queries for the jobs table
-- Copy and modify these queries as needed
-- ================================================================

-- ================================================================
-- CREATE OPERATIONS
-- ================================================================

-- Create a new job posting (basic)
INSERT INTO jobs (
    job_title,
    company,
    location,
    status,
    employment_type
) VALUES (
    'Software Engineer',
    'Tech Corp',
    'Remote',
    'Open',
    'Full-time'
)
RETURNING id, created_at;

-- Create a complete job posting
INSERT INTO jobs (
    job_title,
    company,
    priority,
    status,
    location,
    department,
    open_positions,
    reason,
    currency,
    salary_start,
    salary_end,
    category,
    employment_type,
    skills,
    required_qualification,
    job_description,
    comments,
    photo_url
) VALUES (
    'Senior Full Stack Developer',
    'Tech Innovations Inc.',
    'High',
    'Open',
    'San Francisco, CA, USA',
    'Engineering',
    2,
    'Team expansion for new product launch',
    'USD',
    120000.00,
    160000.00,
    'Technology',
    'Full-time',
    'React, Node.js, PostgreSQL, AWS, Docker, Kubernetes',
    'Bachelor degree in Computer Science. 5+ years experience in full-stack development. Strong problem-solving skills.',
    'We are seeking an experienced Full Stack Developer to join our growing engineering team. You will work on cutting-edge technologies and contribute to building scalable web applications.',
    'Excellent benefits package including health insurance, 401k matching, and unlimited PTO.',
    'https://example.com/company-logo.png'
)
RETURNING id, job_title, created_at;

-- ================================================================
-- READ OPERATIONS
-- ================================================================

-- Get all jobs
SELECT * FROM jobs
ORDER BY created_at DESC;

-- Get all open jobs
SELECT 
    id,
    job_title,
    company,
    location,
    employment_type,
    salary_start,
    salary_end,
    created_at
FROM jobs
WHERE status = 'Open'
ORDER BY created_at DESC;

-- Get jobs with pagination
SELECT 
    id,
    job_title,
    company,
    location,
    status,
    created_at
FROM jobs
ORDER BY created_at DESC
LIMIT 25 OFFSET 0;  -- Change OFFSET for next page (0, 25, 50, etc.)

-- Search jobs by title (case-insensitive)
SELECT 
    id,
    job_title,
    company,
    location,
    employment_type,
    status
FROM jobs
WHERE job_title ILIKE '%developer%'
ORDER BY created_at DESC;

-- Filter by company
SELECT 
    id,
    job_title,
    location,
    employment_type,
    status,
    created_at
FROM jobs
WHERE company = 'Tech Innovations Inc.'
ORDER BY created_at DESC;

-- Filter by location
SELECT 
    id,
    job_title,
    company,
    employment_type,
    status
FROM jobs
WHERE location ILIKE '%San Francisco%'
ORDER BY created_at DESC;

-- Filter by employment type
SELECT 
    id,
    job_title,
    company,
    location,
    status
FROM jobs
WHERE employment_type = 'Full-time'
ORDER BY created_at DESC;

-- Filter by salary range
SELECT 
    id,
    job_title,
    company,
    salary_start,
    salary_end,
    currency
FROM jobs
WHERE salary_start >= 100000
  AND salary_end <= 150000
ORDER BY salary_start DESC;

-- Get job by ID
SELECT * FROM jobs
WHERE id = 'your-uuid-here';

-- Get jobs by multiple statuses
SELECT 
    id,
    job_title,
    company,
    status,
    created_at
FROM jobs
WHERE status IN ('Open', 'On Hold')
ORDER BY created_at DESC;

-- Get high priority jobs
SELECT 
    id,
    job_title,
    company,
    priority,
    status,
    created_at
FROM jobs
WHERE priority = 'High'
  AND status = 'Open'
ORDER BY created_at DESC;

-- Advanced search with multiple filters
SELECT 
    id,
    job_title,
    company,
    location,
    employment_type,
    salary_start,
    salary_end,
    status
FROM jobs
WHERE status = 'Open'
  AND employment_type = 'Full-time'
  AND (job_title ILIKE '%engineer%' OR job_title ILIKE '%developer%')
  AND salary_start >= 80000
ORDER BY created_at DESC;

-- Get job statistics by status
SELECT 
    status,
    COUNT(*) as count
FROM jobs
GROUP BY status
ORDER BY count DESC;

-- Get job statistics by company
SELECT 
    company,
    COUNT(*) as total_jobs,
    SUM(open_positions) as total_positions
FROM jobs
WHERE status = 'Open'
GROUP BY company
ORDER BY total_jobs DESC;

-- Get recently updated jobs
SELECT 
    id,
    job_title,
    company,
    status,
    updated_at
FROM jobs
WHERE updated_at > NOW() - INTERVAL '7 days'
ORDER BY updated_at DESC;

-- ================================================================
-- UPDATE OPERATIONS
-- ================================================================

-- Update job status
UPDATE jobs
SET status = 'Closed'
WHERE id = 'your-uuid-here'
RETURNING id, job_title, status, updated_at;

-- Update multiple fields
UPDATE jobs
SET 
    status = 'On Hold',
    priority = 'Low',
    comments = 'Temporarily paused due to budget review'
WHERE id = 'your-uuid-here'
RETURNING id, job_title, status, updated_at;

-- Update salary range
UPDATE jobs
SET 
    salary_start = 130000.00,
    salary_end = 170000.00
WHERE id = 'your-uuid-here'
RETURNING id, job_title, salary_start, salary_end, updated_at;

-- Close all jobs for a specific company
UPDATE jobs
SET status = 'Closed'
WHERE company = 'Old Company Name'
  AND status = 'Open'
RETURNING id, job_title, status;

-- Update open positions
UPDATE jobs
SET open_positions = open_positions - 1
WHERE id = 'your-uuid-here'
  AND open_positions > 0
RETURNING id, job_title, open_positions;

-- ================================================================
-- DELETE OPERATIONS
-- ================================================================

-- Delete a specific job (use with caution)
DELETE FROM jobs
WHERE id = 'your-uuid-here'
RETURNING job_title;

-- Delete all closed jobs older than 1 year (use with extreme caution)
-- DELETE FROM jobs
-- WHERE status = 'Closed'
--   AND created_at < NOW() - INTERVAL '1 year'
-- RETURNING id, job_title;

-- ================================================================
-- ADVANCED QUERIES
-- ================================================================

-- Full-text search in job description
SELECT 
    id,
    job_title,
    company,
    location
FROM jobs
WHERE job_description ILIKE '%cloud%'
  OR skills ILIKE '%cloud%'
ORDER BY created_at DESC;

-- Get average salary by employment type
SELECT 
    employment_type,
    AVG(salary_start) as avg_start,
    AVG(salary_end) as avg_end,
    COUNT(*) as job_count
FROM jobs
WHERE salary_start IS NOT NULL
  AND salary_end IS NOT NULL
GROUP BY employment_type
ORDER BY avg_start DESC;

-- Get jobs with no salary information
SELECT 
    id,
    job_title,
    company,
    location
FROM jobs
WHERE salary_start IS NULL
  OR salary_end IS NULL
ORDER BY created_at DESC;

-- Get jobs created in the last 30 days
SELECT 
    id,
    job_title,
    company,
    status,
    created_at
FROM jobs
WHERE created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- Count jobs by category
SELECT 
    category,
    COUNT(*) as count
FROM jobs
WHERE category IS NOT NULL
GROUP BY category
ORDER BY count DESC;

-- Get most common skills mentioned in jobs
-- Note: This assumes skills are stored as comma-separated values
SELECT 
    TRIM(skill) as skill,
    COUNT(*) as frequency
FROM jobs
CROSS JOIN LATERAL unnest(string_to_array(skills, ',')) as skill
WHERE skills IS NOT NULL
GROUP BY TRIM(skill)
ORDER BY frequency DESC
LIMIT 20;

-- ================================================================
-- REPORTING QUERIES
-- ================================================================

-- Monthly job posting report
SELECT 
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as jobs_posted,
    SUM(open_positions) as total_positions
FROM jobs
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- Jobs by priority distribution
SELECT 
    priority,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM jobs
WHERE priority IS NOT NULL
GROUP BY priority
ORDER BY count DESC;

-- Open positions summary
SELECT 
    COUNT(*) as total_jobs,
    SUM(open_positions) as total_positions,
    AVG(open_positions) as avg_positions_per_job
FROM jobs
WHERE status = 'Open';

-- Salary statistics by category
SELECT 
    category,
    COUNT(*) as job_count,
    MIN(salary_start) as min_salary,
    AVG((salary_start + salary_end) / 2) as avg_salary,
    MAX(salary_end) as max_salary
FROM jobs
WHERE salary_start IS NOT NULL
  AND salary_end IS NOT NULL
  AND category IS NOT NULL
GROUP BY category
ORDER BY avg_salary DESC;

-- ================================================================
-- MAINTENANCE QUERIES
-- ================================================================

-- Check for jobs with invalid salary ranges
SELECT 
    id,
    job_title,
    salary_start,
    salary_end
FROM jobs
WHERE salary_start IS NOT NULL
  AND salary_end IS NOT NULL
  AND salary_start > salary_end;

-- Find duplicate job titles
SELECT 
    job_title,
    company,
    COUNT(*) as duplicate_count
FROM jobs
GROUP BY job_title, company
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- List jobs missing required fields
SELECT 
    id,
    job_title,
    company,
    location,
    status,
    CASE 
        WHEN job_description IS NULL THEN 'Missing Description'
        WHEN skills IS NULL THEN 'Missing Skills'
        WHEN required_qualification IS NULL THEN 'Missing Qualifications'
        ELSE 'Other'
    END as issue
FROM jobs
WHERE job_description IS NULL
   OR skills IS NULL
   OR required_qualification IS NULL
ORDER BY created_at DESC;

-- ================================================================
-- ARCHIVE OPERATIONS
-- ================================================================

-- Create archive table (run once)
-- CREATE TABLE jobs_archive (LIKE jobs INCLUDING ALL);

-- Move old closed jobs to archive
-- INSERT INTO jobs_archive
-- SELECT * FROM jobs
-- WHERE status = 'Closed'
--   AND created_at < NOW() - INTERVAL '1 year';

-- Then delete from main table
-- DELETE FROM jobs
-- WHERE status = 'Closed'
--   AND created_at < NOW() - INTERVAL '1 year';

-- ================================================================
-- USEFUL VIEWS (Optional)
-- ================================================================

-- Create a view for open jobs with complete info
CREATE OR REPLACE VIEW open_jobs_view AS
SELECT 
    id,
    job_title,
    company,
    location,
    department,
    employment_type,
    open_positions,
    salary_start,
    salary_end,
    currency,
    skills,
    created_at
FROM jobs
WHERE status = 'Open'
ORDER BY created_at DESC;

-- Use the view
-- SELECT * FROM open_jobs_view;

-- ================================================================
-- END OF QUICK REFERENCE
-- ================================================================
