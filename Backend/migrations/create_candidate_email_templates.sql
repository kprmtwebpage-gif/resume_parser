-- Migration: create candidate_email_templates table
-- Run this once against your PostgreSQL database.

CREATE TABLE IF NOT EXISTS candidate_email_templates (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    created_by VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_email_templates_active
    ON candidate_email_templates (is_active);
