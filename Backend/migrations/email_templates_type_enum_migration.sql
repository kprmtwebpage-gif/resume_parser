-- Migration: enforce COMMON/CANDIDATE template typing with PostgreSQL ENUM.
-- Safe to run multiple times.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'template_type') THEN
        CREATE TYPE template_type AS ENUM ('COMMON', 'CANDIDATE');
    END IF;
END $$;

-- Ensure column exists for existing deployments.
ALTER TABLE email_templates
    ADD COLUMN IF NOT EXISTS template_type template_type NOT NULL DEFAULT 'COMMON';

-- Normalize unexpected/legacy values before type conversion.
UPDATE email_templates
SET template_type = 'COMMON'
WHERE upper(template_type::text) NOT IN ('COMMON', 'CANDIDATE');

-- Convert VARCHAR template_type -> ENUM template_type when needed.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'email_templates'
          AND column_name = 'template_type'
          AND data_type = 'character varying'
    ) THEN
        ALTER TABLE email_templates
            ALTER COLUMN template_type DROP DEFAULT;

        ALTER TABLE email_templates
            ALTER COLUMN template_type TYPE template_type
            USING upper(template_type)::template_type;

        ALTER TABLE email_templates
            ALTER COLUMN template_type SET DEFAULT 'COMMON';
    END IF;
END $$;
