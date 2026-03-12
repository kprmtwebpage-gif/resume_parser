"""
SQLAlchemy engine + session factory for the jobs module.
Reads DB credentials from the project-wide .env file.
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = (
    f"postgresql://{os.getenv('DB_USER', 'postgres')}"
    f":{os.getenv('DB_PASSWORD', 'admin')}"
    f"@{os.getenv('DB_HOST', 'localhost')}"
    f":{os.getenv('DB_PORT', '5432')}"
    f"/{os.getenv('DB_NAME', 'postgres')}"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_db():
    """Initialize database tables. Call this on app startup."""
    # Import models to register them with Base
    from . import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _migrate_jobs_columns()
    _migrate_job_applications()


def _migrate_jobs_columns():
    """Ensure all jobs table columns exist (safe, idempotent migration)."""
    from sqlalchemy import text
    _JOBS_COLUMNS = [
        ("priority",             "VARCHAR(50)",    None),
        ("department",           "VARCHAR(255)",   None),
        ("open_positions",       "INTEGER",        "1"),
        ("reason",               "TEXT",           None),
        ("currency",             "VARCHAR(10)",    "'USD'"),
        ("salary_start",         "NUMERIC(12,2)",  None),
        ("salary_end",           "NUMERIC(12,2)",  None),
        ("category",             "VARCHAR(100)",   None),
        ("employment_type",      "VARCHAR(50)",    None),
        ("experience",           "VARCHAR(50)",    None),
        ("skills",               "TEXT",           None),
        ("required_qualification","TEXT",          None),
        ("job_description",      "TEXT",           None),
        ("comments",             "TEXT",           None),
        ("photo_url",            "TEXT",           None),
        ("job_id",               "VARCHAR(50)",    None),
        ("posted_date",          "TIMESTAMPTZ",    None),
        ("archived",             "BOOLEAN",        "FALSE"),
        ("archived_at",          "TIMESTAMPTZ",    None),
        ("draft_saved_at",       "TIMESTAMPTZ",    None),
        ("is_draft_autosave",    "BOOLEAN",        "FALSE"),
        ("held_at",              "TIMESTAMPTZ",    None),
        ("closed_at",            "TIMESTAMPTZ",    None),
        ("updated_at",           "TIMESTAMPTZ",    "NOW()"),
    ]
    try:
        with engine.connect() as conn:
            for col, col_type, default in _JOBS_COLUMNS:
                default_clause = f" DEFAULT {default}" if default else ""
                conn.execute(text(
                    f"ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "
                    f"{col} {col_type}{default_clause}"
                ))
            conn.commit()
    except Exception as e:
        print(f"[DB_MIGRATE] jobs column migration warning: {e}")


def _migrate_job_applications():
    """Add new columns to job_applications table if they don't exist (safe migration)."""
    from sqlalchemy import text, inspect as sa_inspect
    try:
        inspector = sa_inspect(engine)
        tables = inspector.get_table_names()
        if 'job_applications' not in tables:
            return  # Table doesn't exist yet, create_all will handle it

        existing_columns = {col['name'] for col in inspector.get_columns('job_applications')}
        new_columns = {
            'first_name': 'VARCHAR(255)',
            'last_name': 'VARCHAR(255)',
            'address': 'TEXT',
            'education': 'TEXT',
            'citizenship': 'VARCHAR(100)',
            'experience': 'INTEGER',
            'linkedin_url': 'TEXT',
            'domain_expert': 'TEXT',
        }
        with engine.connect() as conn:
            for col_name, col_type in new_columns.items():
                if col_name not in existing_columns:
                    conn.execute(text(
                        f'ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS {col_name} {col_type}'
                    ))
            conn.commit()
    except Exception as e:
        print(f"[DB_MIGRATE] Warning: migration check failed: {e}")


def get_db():
    """FastAPI dependency — yields a DB session, auto-closes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
