-- ================================================================
-- ADD ARCHIVE COLUMNS TO JOBS TABLE
-- ================================================================
-- Purpose: Add archived and archived_at columns to support job archiving
-- Version: 1.1
-- Date: 2026-03-05
-- ================================================================

-- Add archived column (boolean, defaults to false)
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Add archived_at column (timestamp for when job was archived)
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Create index for filtering archived jobs efficiently
CREATE INDEX IF NOT EXISTS idx_jobs_archived ON jobs(archived);

-- Optional: Update any existing NULL archived values to FALSE
UPDATE jobs SET archived = FALSE WHERE archived IS NULL;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================
-- Run these to verify the changes:
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'jobs' AND column_name IN ('archived', 'archived_at');
-- ================================================================
