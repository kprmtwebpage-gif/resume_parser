"""
SQLAlchemy model for the candidate_comments table.
Completely independent — does NOT modify any existing tables.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .database import Base


class CandidateComment(Base):
    __tablename__ = "candidate_comments"

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        nullable=False,
    )
    candidate_id = Column(
        Integer,
        nullable=False,
        index=True,
        comment="References the candidates table id column",
    )
    comment_text = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<CandidateComment id={self.id} candidate_id={self.candidate_id}>"
