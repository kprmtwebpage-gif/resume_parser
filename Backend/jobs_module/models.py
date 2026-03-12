"""
SQLAlchemy ORM model for the 'jobs' PostgreSQL table.
Maps 1-to-1 with the table created by create_jobs_table.sql.
"""

import uuid
import base64
from datetime import datetime, timezone

from sqlalchemy import Column, String, Text, Integer, Numeric, DateTime, Boolean, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from .database import Base


def generate_job_id() -> str:
    """Generate a short base64-encoded job ID like JOBID#MTAvMDQ."""
    now = datetime.now(timezone.utc)
    raw = f"{now.month:02d}/{now.day:02d}/{now.second:02d}"
    encoded = base64.b64encode(raw.encode()).decode().rstrip("=")
    return f"JOBID#{encoded}"


# Valid job statuses
JOB_STATUSES = ['DRAFT', 'POSTED', 'HOLD', 'CLOSED']


class Job(Base):
    __tablename__ = "jobs"

    # Removed constraint that only allowed DRAFT/POSTED - now we support more statuses

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Basic Information
    job_title = Column(String(255), nullable=False)
    company = Column(String(255), nullable=False)
    priority = Column(String(50), nullable=True)
    status = Column(String(50), nullable=False, default="DRAFT")
    location = Column(String(255), nullable=False)
    department = Column(String(255), nullable=True)

    # Hiring Details
    open_positions = Column(Integer, default=1)
    reason = Column(Text, nullable=True)

    # Salary Details
    currency = Column(String(10), default="USD")
    salary_start = Column(Numeric(12, 2), nullable=True)
    salary_end = Column(Numeric(12, 2), nullable=True)

    # Classification
    category = Column(String(100), nullable=True)
    employment_type = Column(String(50), nullable=True)
    
    # Experience field (Feature 9)
    experience = Column(String(50), nullable=True)

    # Skills & Qualifications
    skills = Column(Text, nullable=True)
    required_qualification = Column(Text, nullable=True)

    # Rich Content
    job_description = Column(Text, nullable=True)
    comments = Column(Text, nullable=True)

    # File Upload
    photo_url = Column(Text, nullable=True)

    # Job posting fields
    job_id = Column(String(50), nullable=True, unique=True, default=generate_job_id)
    posted_date = Column(DateTime(timezone=True), nullable=True)

    # Archive fields
    archived = Column(Boolean, default=False, nullable=False)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    
    # Draft autosave fields (Feature 2)
    draft_saved_at = Column(DateTime(timezone=True), nullable=True)
    is_draft_autosave = Column(Boolean, default=False, nullable=False)
    
    # Hold fields (Feature 3)
    held_at = Column(DateTime(timezone=True), nullable=True)
    
    # Close fields (Feature 4)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    # System Columns
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    
    # Relationship to applications
    applications = relationship("JobApplication", back_populates="job", cascade="all, delete-orphan")

    # Salary constraint is enforced at DB level via create_jobs_table.sql

    def __repr__(self) -> str:
        return f"<Job id={self.id} title={self.job_title!r}>"


class JobApplication(Base):
    """Model for tracking candidate applications to jobs (Feature 11)."""
    __tablename__ = "job_applications"

    id = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    
    # Foreign key to job
    job_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    # Candidate information (legacy combined field)
    candidate_name = Column(String(255), nullable=True)
    candidate_email = Column(String(255), nullable=True)
    candidate_phone = Column(String(50), nullable=True)
    resume_url = Column(Text, nullable=True)
    resume_filename = Column(String(255), nullable=True)

    # Legacy column aliases (used by old /job-applications endpoint)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    status = Column(String(50), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    qualification = Column(Text, nullable=True)
    work_authorization = Column(String(100), nullable=True)
    tech_experience = Column(Text, nullable=True)
    domain_expert = Column(Text, nullable=True)

    # Extended candidate fields
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    education = Column(Text, nullable=True)
    citizenship = Column(String(100), nullable=True)
    experience = Column(Integer, nullable=True)
    linkedin_url = Column(Text, nullable=True)

    # Application status
    application_status = Column(String(50), default="applied", nullable=True)
    
    # Timestamps
    applied_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    
    # Relationship back to job
    job = relationship("Job", back_populates="applications")
    
    def __repr__(self) -> str:
        return f"<JobApplication id={self.id} job_id={self.job_id} candidate={self.candidate_name!r}>"
