"""
SQLAlchemy model for the standalone_candidate_comments table.
Uses integer candidate_id to match candidate_profile.id.
"""

from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Text, DateTime

from .database import Base


class StandaloneComment(Base):
    __tablename__ = "standalone_candidate_comments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    candidate_id = Column(String, nullable=False, index=True)
    comment_text = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<StandaloneComment id={self.id} candidate_id={self.candidate_id}>"
