"""
Database configuration for company_jobs_module.
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


def get_db():
    """Yields a SQLAlchemy session for this module."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables for this module. Call once on app startup."""
    from . import models  # noqa: F401  – registers models with Base
    Base.metadata.create_all(bind=engine)
