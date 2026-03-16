"""
SQLAlchemy model for the company_jobs table.
Completely independent — does NOT touch any existing tables.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .database import Base


class CompanyJob(Base):
    __tablename__ = "company_jobs"

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        unique=True,
        nullable=False,
    )
    title = Column(String(255), nullable=False)
    company = Column(String(255), nullable=False)
    priority = Column(String(50), nullable=False, default="Normal")
    status = Column(String(50), nullable=False, default="New")
    location = Column(String(255), nullable=True)
    department = Column(String(255), nullable=True)
    category = Column(String(255), nullable=True)
    employment_type = Column(String(100), nullable=True)
    skills = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    comments = Column(Text, nullable=True)
    customer = Column(String(255), nullable=True)
    assignee = Column(String(255), nullable=True)
    logo_path = Column(String(500), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<CompanyJob id={self.id} title={self.title!r}>"
