-- Migration: Add template_type column to email_templates table
-- Run this once against your PostgreSQL database.

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS template_type VARCHAR(20) NOT NULL DEFAULT 'COMMON';

-- All existing templates are treated as COMMON templates
UPDATE email_templates SET template_type = 'COMMON' WHERE template_type IS NULL OR template_type = '';

-- Optional: add a check constraint to enforce valid values
ALTER TABLE email_templates
  DROP CONSTRAINT IF EXISTS chk_template_type;

ALTER TABLE email_templates
  ADD CONSTRAINT chk_template_type
    CHECK (template_type IN ('COMMON', 'CANDIDATE'));
