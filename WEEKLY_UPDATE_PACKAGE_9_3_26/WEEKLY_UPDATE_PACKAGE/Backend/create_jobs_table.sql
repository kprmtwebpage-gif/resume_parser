-- ================================================================
-- PRODUCTION-READY JOBS TABLE CREATION SCRIPT
-- ================================================================
-- Purpose: Create standalone jobs table for Job Management System
-- Version: 1.0
-- Date: 2026-03-03
-- ================================================================

-- ================================================================
-- STEP 1: Enable UUID Extension
-- ================================================================
-- Enable uuid-ossp extension for UUID generation
-- This is required for using gen_random_uuid() function
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- STEP 2: Create Jobs Table
-- ================================================================
-- Standalone table for job postings and management
-- Includes all fields from the Job Creation UI
-- ================================================================

CREATE TABLE IF NOT EXISTS jobs (
    -- ============================================================
    -- Primary Key
    -- ============================================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- ============================================================
    -- Basic Information
    -- ============================================================
    job_title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    priority VARCHAR(50),
    status VARCHAR(50),
    location VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    
    -- ============================================================
    -- Hiring Details
    -- ============================================================
    open_positions INTEGER DEFAULT 1,
    reason TEXT,
    
    -- ============================================================
    -- Salary Details
    -- ============================================================
    currency VARCHAR(10) DEFAULT 'USD',
    salary_start NUMERIC(12, 2),
    salary_end NUMERIC(12, 2),
    
    -- ============================================================
    -- Classification
    -- ============================================================
    category VARCHAR(100),
    employment_type VARCHAR(50),
    
    -- ============================================================
    -- Skills & Qualifications
    -- ============================================================
    skills TEXT,
    required_qualification TEXT,
    
    -- ============================================================
    -- Rich Content
    -- ============================================================
    job_description TEXT,
    comments TEXT,
    
    -- ============================================================
    -- File Upload
    -- ============================================================
    photo_url TEXT,
    
    -- ============================================================
    -- System Columns - Automatic Timestamps
    -- ============================================================
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- ============================================================
    -- Constraints
    -- ============================================================
    CONSTRAINT jobs_salary_check CHECK (
        salary_start IS NULL OR 
        salary_end IS NULL OR 
        salary_start <= salary_end
    )
);

-- ================================================================
-- STEP 3: Create Indexes for Performance
-- ================================================================
-- Indexes on frequently queried columns for optimal performance
-- ================================================================

-- Index on job_title for search queries
CREATE INDEX IF NOT EXISTS idx_jobs_job_title ON jobs(job_title);

-- Index on company for filtering
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);

-- Index on status for status-based queries
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- Index on location for location-based searches
CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);

-- Index on employment_type for filtering
CREATE INDEX IF NOT EXISTS idx_jobs_employment_type ON jobs(employment_type);

-- Index on created_at for sorting by date
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at ON jobs(status, created_at DESC);

-- ================================================================
-- STEP 4: Create Trigger Function for Auto-update
-- ================================================================
-- Function to automatically update the updated_at timestamp
-- whenever a row is modified
-- ================================================================

CREATE OR REPLACE FUNCTION update_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- STEP 5: Create Trigger
-- ================================================================
-- Trigger that calls the function before UPDATE operations
-- ================================================================

DROP TRIGGER IF EXISTS trigger_update_jobs_updated_at ON jobs;

CREATE TRIGGER trigger_update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_jobs_updated_at();

-- ================================================================
-- STEP 6: Add Helpful Comments to Table and Columns
-- ================================================================
-- Documentation for database administrators and developers
-- ================================================================

COMMENT ON TABLE jobs IS 'Standalone table for job postings and recruitment management';

COMMENT ON COLUMN jobs.id IS 'Unique identifier (UUID) for each job posting';
COMMENT ON COLUMN jobs.job_title IS 'Title of the job position (required)';
COMMENT ON COLUMN jobs.company IS 'Company name offering the position (required)';
COMMENT ON COLUMN jobs.priority IS 'Priority level (e.g., High, Medium, Low)';
COMMENT ON COLUMN jobs.status IS 'Current status (e.g., Open, Closed, On Hold)';
COMMENT ON COLUMN jobs.location IS 'Job location (required)';
COMMENT ON COLUMN jobs.department IS 'Department or team name';
COMMENT ON COLUMN jobs.open_positions IS 'Number of open positions (default: 1)';
COMMENT ON COLUMN jobs.reason IS 'Reason for hiring or additional hiring details';
COMMENT ON COLUMN jobs.currency IS 'Salary currency code (default: USD)';
COMMENT ON COLUMN jobs.salary_start IS 'Starting salary range';
COMMENT ON COLUMN jobs.salary_end IS 'Ending salary range';
COMMENT ON COLUMN jobs.category IS 'Job category or industry';
COMMENT ON COLUMN jobs.employment_type IS 'Type of employment (e.g., Full-time, Part-time, Contract)';
COMMENT ON COLUMN jobs.skills IS 'Required skills (comma-separated or formatted text)';
COMMENT ON COLUMN jobs.required_qualification IS 'Required qualifications and experience';
COMMENT ON COLUMN jobs.job_description IS 'Detailed job description (rich text supported)';
COMMENT ON COLUMN jobs.comments IS 'Additional comments or notes';
COMMENT ON COLUMN jobs.photo_url IS 'URL or path to job/company photo';
COMMENT ON COLUMN jobs.created_at IS 'Timestamp when job was created (auto-generated)';
COMMENT ON COLUMN jobs.updated_at IS 'Timestamp when job was last updated (auto-updated)';

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================
-- Run these queries to verify the table was created successfully
-- ================================================================

-- Verify table structure
-- SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'jobs'
-- ORDER BY ordinal_position;

-- Verify indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'jobs';

-- Verify trigger
-- SELECT trigger_name, event_manipulation, event_object_table, action_statement
-- FROM information_schema.triggers
-- WHERE event_object_table = 'jobs';

-- ================================================================
-- SAMPLE INSERT QUERY (for testing)
-- ================================================================

-- INSERT INTO jobs (
--     job_title,
--     company,
--     priority,
--     status,
--     location,
--     department,
--     open_positions,
--     reason,
--     currency,
--     salary_start,
--     salary_end,
--     category,
--     employment_type,
--     skills,
--     required_qualification,
--     job_description,
--     comments
-- ) VALUES (
--     'Senior Full Stack Developer',
--     'Tech Innovations Inc.',
--     'High',
--     'Open',
--     'San Francisco, CA',
--     'Engineering',
--     2,
--     'Team expansion due to new product launch',
--     'USD',
--     120000.00,
--     160000.00,
--     'Technology',
--     'Full-time',
--     'React, Node.js, PostgreSQL, AWS, Docker',
--     'Bachelor''s degree in Computer Science or equivalent. 5+ years of experience in full-stack development.',
--     'We are seeking an experienced Full Stack Developer to join our growing team...',
--     'Excellent benefits package included'
-- );

-- ================================================================
-- SAMPLE UPDATE QUERY (to test auto-update trigger)
-- ================================================================

-- UPDATE jobs
-- SET status = 'Closed'
-- WHERE job_title = 'Senior Full Stack Developer';

-- Check that updated_at was automatically updated:
-- SELECT job_title, status, created_at, updated_at
-- FROM jobs
-- WHERE job_title = 'Senior Full Stack Developer';

-- ================================================================
-- SAMPLE SELECT QUERIES
-- ================================================================

-- Get all open jobs
-- SELECT id, job_title, company, location, status, created_at
-- FROM jobs
-- WHERE status = 'Open'
-- ORDER BY created_at DESC;

-- Get jobs by company
-- SELECT id, job_title, location, employment_type, salary_start, salary_end
-- FROM jobs
-- WHERE company = 'Tech Innovations Inc.'
-- ORDER BY created_at DESC;

-- Search jobs by title
-- SELECT id, job_title, company, location, status
-- FROM jobs
-- WHERE job_title ILIKE '%developer%'
-- ORDER BY created_at DESC;

-- ================================================================
-- CLEANUP SCRIPT (USE WITH CAUTION)
-- ================================================================
-- Uncomment to drop the table and related objects
-- ================================================================

-- DROP TRIGGER IF EXISTS trigger_update_jobs_updated_at ON jobs;
-- DROP FUNCTION IF EXISTS update_jobs_updated_at();
-- DROP TABLE IF EXISTS jobs CASCADE;

-- ================================================================
-- END OF SCRIPT
-- ================================================================
