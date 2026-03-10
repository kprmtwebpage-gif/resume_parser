"""
Database migration: Add job_id, posted_date columns to the jobs table
and normalise existing status values to DRAFT / POSTED.

Run once:
    python migrate_add_job_posting_fields.py
"""

import os, sys, uuid, base64
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

# ── Database connection ──────────────────────────────────────────
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
    print(f"[ERROR] Could not connect to database: {e}")
    sys.exit(1)


def generate_job_id() -> str:
    """Generate a short base64-encoded job ID."""
    now = datetime.now(timezone.utc)
    raw = f"{now.month:02d}/{now.day:02d}/{now.second:02d}"
    encoded = base64.b64encode(raw.encode()).decode().rstrip("=")
    # Add a random suffix to ensure uniqueness
    suffix = base64.b64encode(uuid.uuid4().bytes[:3]).decode().rstrip("=")
    return f"JOBID#{encoded}{suffix}"


def migrate():
    with engine.connect() as conn:
        # 1. Add job_id column if it doesn't exist
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'jobs' AND column_name = 'job_id'
        """))
        if result.fetchone() is None:
            print("[MIGRATION] Adding 'job_id' column to jobs table...")
            conn.execute(text("ALTER TABLE jobs ADD COLUMN job_id VARCHAR(50) UNIQUE"))
            conn.commit()
            print("[OK] job_id column added.")
        else:
            print("[SKIP] job_id column already exists.")

        # 2. Add posted_date column if it doesn't exist
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'jobs' AND column_name = 'posted_date'
        """))
        if result.fetchone() is None:
            print("[MIGRATION] Adding 'posted_date' column to jobs table...")
            conn.execute(text("ALTER TABLE jobs ADD COLUMN posted_date TIMESTAMPTZ"))
            conn.commit()
            print("[OK] posted_date column added.")
        else:
            print("[SKIP] posted_date column already exists.")

        # 3. Backfill job_id for existing rows that don't have one
        rows = conn.execute(text("SELECT id FROM jobs WHERE job_id IS NULL")).fetchall()
        if rows:
            print(f"[MIGRATION] Backfilling job_id for {len(rows)} existing jobs...")
            for row in rows:
                new_job_id = generate_job_id()
                conn.execute(
                    text("UPDATE jobs SET job_id = :jid WHERE id = :id"),
                    {"jid": new_job_id, "id": row[0]}
                )
            conn.commit()
            print(f"[OK] Backfilled {len(rows)} job IDs.")
        else:
            print("[SKIP] All jobs already have job_id values.")

        # 4. Normalise status values: map old statuses to DRAFT/POSTED
        print("[MIGRATION] Normalising status values to DRAFT / POSTED...")
        # Published → POSTED
        res = conn.execute(text(
            "UPDATE jobs SET status = 'POSTED', posted_date = COALESCE(posted_date, updated_at) "
            "WHERE status = 'Published'"
        ))
        if res.rowcount:
            print(f"  -> {res.rowcount} jobs updated: Published → POSTED")

        # Everything else → DRAFT
        res = conn.execute(text(
            "UPDATE jobs SET status = 'DRAFT' "
            "WHERE status IS NULL OR status NOT IN ('DRAFT', 'POSTED')"
        ))
        if res.rowcount:
            print(f"  -> {res.rowcount} jobs updated: (other) → DRAFT")
        
        conn.commit()
        print("[DONE] Migration complete!")


if __name__ == "__main__":
    migrate()
