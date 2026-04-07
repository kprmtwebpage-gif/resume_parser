"""
Auto-migration script: Adds any missing columns to the jobs and job_applications tables.
Safe to run multiple times - skips columns that already exist.
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "admin")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

try:
    from sqlalchemy import create_engine, text
    engine = create_engine(DATABASE_URL)
except Exception as e:
    print(f"[ERROR] Could not connect: {e}")
    sys.exit(1)


def column_exists(conn, table, column):
    result = conn.execute(text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = :table AND column_name = :col
    """), {"table": table, "col": column})
    return result.fetchone() is not None


def table_exists(conn, table):
    result = conn.execute(text("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = :table
    """), {"table": table})
    return result.fetchone() is not None


def add_column(conn, table, column, col_def, default_val=None):
    if not column_exists(conn, table, column):
        print(f"  [ADD] {table}.{column}")
        if default_val is not None:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_def} DEFAULT {default_val}"))
        else:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}"))
        conn.commit()
    else:
        print(f"  [OK]  {table}.{column} (exists)")


def migrate():
    with engine.connect() as conn:
        print("\n=== Checking jobs table ===")
        if not table_exists(conn, "jobs"):
            print("[ERROR] 'jobs' table does not exist! Run setup_jobs_table.py first.")
            return False

        # Jobs table columns
        add_column(conn, "jobs", "priority", "VARCHAR(50)")
        add_column(conn, "jobs", "department", "VARCHAR(255)")
        add_column(conn, "jobs", "open_positions", "INTEGER", "1")
        add_column(conn, "jobs", "reason", "TEXT")
        add_column(conn, "jobs", "currency", "VARCHAR(10)", "'USD'")
        add_column(conn, "jobs", "salary_start", "NUMERIC(12,2)")
        add_column(conn, "jobs", "salary_end", "NUMERIC(12,2)")
        add_column(conn, "jobs", "category", "VARCHAR(100)")
        add_column(conn, "jobs", "employment_type", "VARCHAR(50)")
        add_column(conn, "jobs", "experience", "VARCHAR(50)")
        add_column(conn, "jobs", "skills", "TEXT")
        add_column(conn, "jobs", "required_qualification", "TEXT")
        add_column(conn, "jobs", "job_description", "TEXT")
        add_column(conn, "jobs", "comments", "TEXT")
        add_column(conn, "jobs", "photo_url", "TEXT")
        add_column(conn, "jobs", "job_id", "VARCHAR(50)")
        add_column(conn, "jobs", "posted_date", "TIMESTAMPTZ")
        add_column(conn, "jobs", "archived", "BOOLEAN", "FALSE")
        add_column(conn, "jobs", "archived_at", "TIMESTAMPTZ")
        add_column(conn, "jobs", "draft_saved_at", "TIMESTAMPTZ")
        add_column(conn, "jobs", "is_draft_autosave", "BOOLEAN", "FALSE")
        add_column(conn, "jobs", "held_at", "TIMESTAMPTZ")
        add_column(conn, "jobs", "closed_at", "TIMESTAMPTZ")
        add_column(conn, "jobs", "updated_at", "TIMESTAMPTZ", "NOW()")

        # Ensure job_id unique constraint (safe to run even if it exists)
        try:
            conn.execute(text("""
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint 
                        WHERE conname = 'jobs_job_id_key'
                    ) THEN
                        ALTER TABLE jobs ADD CONSTRAINT jobs_job_id_key UNIQUE (job_id);
                    END IF;
                END $$;
            """))
            conn.commit()
        except Exception as e:
            print(f"  [WARN] Could not add unique constraint on job_id: {e}")
            conn.rollback()

        print("\n=== Checking job_applications table ===")
        if not table_exists(conn, "job_applications"):
            print("  [CREATE] job_applications table")
            conn.execute(text("""
                CREATE TABLE job_applications (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
                    candidate_name VARCHAR(255) NOT NULL,
                    candidate_email VARCHAR(255),
                    candidate_phone VARCHAR(50),
                    resume_url TEXT,
                    resume_filename VARCHAR(255),
                    application_status VARCHAR(50) NOT NULL DEFAULT 'applied',
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """))
            conn.commit()
            print("  [OK] job_applications table created")
        else:
            add_column(conn, "job_applications", "candidate_name", "VARCHAR(255)")
            add_column(conn, "job_applications", "candidate_email", "VARCHAR(255)")
            add_column(conn, "job_applications", "candidate_phone", "VARCHAR(50)")
            add_column(conn, "job_applications", "resume_url", "TEXT")
            add_column(conn, "job_applications", "resume_filename", "VARCHAR(255)")
            add_column(conn, "job_applications", "application_status", "VARCHAR(50)", "'applied'")
            add_column(conn, "job_applications", "applied_at", "TIMESTAMPTZ", "NOW()")
            add_column(conn, "job_applications", "updated_at", "TIMESTAMPTZ", "NOW()")
            # Legacy alias columns used by the admin /job-applications endpoint
            add_column(conn, "job_applications", "email", "VARCHAR(255)")
            add_column(conn, "job_applications", "phone", "VARCHAR(50)")
            add_column(conn, "job_applications", "status", "VARCHAR(50)")
            add_column(conn, "job_applications", "submitted_at", "TIMESTAMPTZ")
            add_column(conn, "job_applications", "qualification", "TEXT")
            add_column(conn, "job_applications", "work_authorization", "VARCHAR(100)")
            add_column(conn, "job_applications", "tech_experience", "TEXT")
            add_column(conn, "job_applications", "domain_expert", "TEXT")
            add_column(conn, "job_applications", "first_name", "VARCHAR(255)")
            add_column(conn, "job_applications", "last_name", "VARCHAR(255)")
            add_column(conn, "job_applications", "address", "TEXT")
            add_column(conn, "job_applications", "education", "TEXT")
            add_column(conn, "job_applications", "citizenship", "VARCHAR(100)")
            add_column(conn, "job_applications", "experience", "INTEGER")
            add_column(conn, "job_applications", "linkedin_url", "TEXT")

        print("\n=== Checking saved_jobs table ===")
        if not table_exists(conn, "saved_jobs"):
            print("  [CREATE] saved_jobs table")
            conn.execute(text("""
                CREATE TABLE saved_jobs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
                    candidate_id VARCHAR(255),
                    session_id VARCHAR(255),
                    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """))
            conn.commit()

        print("\n=== Checking search_history table ===")
        if not table_exists(conn, "search_history"):
            print("  [CREATE] search_history table")
            conn.execute(text("""
                CREATE TABLE search_history (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    candidate_id VARCHAR(255),
                    session_id VARCHAR(255),
                    search_query VARCHAR(500),
                    location VARCHAR(255),
                    salary_min VARCHAR(50),
                    salary_max VARCHAR(50),
                    filters TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """))
            conn.commit()

        print("\n=== Migration complete! ===\n")
        return True


if __name__ == "__main__":
    print("Running database migrations...")
    success = migrate()
    sys.exit(0 if success else 1)
