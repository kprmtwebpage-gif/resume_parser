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

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=3, max_overflow=5)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_db():
    """Initialize database tables. Call this on app startup."""
    # Import models to register them with Base
    from . import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _migrate_job_applications()


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
