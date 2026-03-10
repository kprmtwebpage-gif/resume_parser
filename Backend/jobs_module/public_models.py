"""
SQLAlchemy ORM models for the public job portal features:
- SavedJob: Jobs saved/bookmarked by candidates
- SearchHistory: Search queries from candidates  
- JobApplication: Job applications submitted by candidates
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .database import Base


class SavedJob(Base):
    """Tracks jobs saved/bookmarked by candidates."""
    __tablename__ = "saved_jobs"

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    job_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )
    candidate_id = Column(String(255), nullable=True)  # Optional - for anonymous saves
    session_id = Column(String(255), nullable=True)    # Browser session ID for anonymous tracking
    saved_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<SavedJob id={self.id} job_id={self.job_id}>"


class SearchHistory(Base):
    """Stores search history for candidates."""
    __tablename__ = "search_history"

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    candidate_id = Column(String(255), nullable=True)  # Optional
    session_id = Column(String(255), nullable=True)    # Browser session ID
    search_query = Column(String(500), nullable=True)
    location = Column(String(255), nullable=True)
    salary_min = Column(String(50), nullable=True)
    salary_max = Column(String(50), nullable=True)
    filters = Column(Text, nullable=True)  # JSON string of filters
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<SearchHistory id={self.id} query={self.search_query!r}>"


# JobApplication is defined in models.py to avoid duplicate table conflicts.
# Import it from there: from .models import JobApplication
