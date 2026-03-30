"""
SQLAlchemy models for the ATS Job-Candidate Matching module.

Tables:
  - ats_match_results    : Cached match scores between jobs and candidates
  - ats_analysis_config  : Admin-configured analysis job settings
  - ats_analysis_runs    : Log of each analysis run
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Text, Integer, Float, DateTime, Boolean,
    ForeignKey, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import relationship

from .database import Base


def _now():
    return datetime.now(timezone.utc)


class ATSMatchResult(Base):
    """Cached match score between a job and a candidate."""
    __tablename__ = "ats_match_results"
    __table_args__ = (
        UniqueConstraint("job_id", "candidate_id", name="uq_ats_job_candidate"),
    )

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    candidate_id = Column(Integer, nullable=False, index=True)

    # Scores (0-100)
    overall_score = Column(Float, nullable=False, default=0)
    skills_score = Column(Float, default=0, comment="Skills keyword match %")
    experience_score = Column(Float, default=0, comment="Experience years match %")
    location_score = Column(Float, default=0, comment="Location/remote match %")
    education_score = Column(Float, default=0, comment="Education match %")
    title_score = Column(Float, default=0, comment="Job title similarity %")

    # Tier: best_match, good_match, partial_match, low_match
    match_tier = Column(String(30), default="low_match")

    # Snapshot data (so results are readable without joins)
    job_title = Column(String(255), nullable=True)
    candidate_name = Column(String(255), nullable=True)
    candidate_email = Column(String(255), nullable=True)
    candidate_skills = Column(Text, nullable=True)
    matched_skills = Column(Text, nullable=True, comment="Comma-sep skills that matched")
    missing_skills = Column(Text, nullable=True, comment="Required skills candidate lacks")

    # Status
    is_applied = Column(Boolean, default=False, comment="Candidate applied for this job")
    is_shortlisted = Column(Boolean, default=False)

    # Analysis run reference
    analysis_run_id = Column(PG_UUID(as_uuid=True), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)


class ATSAnalysisConfig(Base):
    """Admin-configured analysis job settings per job posting."""
    __tablename__ = "ats_analysis_config"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(PG_UUID(as_uuid=True), unique=True, nullable=False)
    job_title = Column(String(255), nullable=True)

    is_enabled = Column(Boolean, default=True)
    auto_run = Column(Boolean, default=False, comment="Auto-run daily at 7 AM EST")
    auto_run_cron = Column(String(50), default="0 7 * * *", comment="Cron expression for auto-run")
    min_score_threshold = Column(Integer, default=40, comment="Min score to include in results")

    # Weights for scoring (must sum to 100)
    weight_skills = Column(Integer, default=40)
    weight_experience = Column(Integer, default=20)
    weight_location = Column(Integer, default=15)
    weight_education = Column(Integer, default=10)
    weight_title = Column(Integer, default=15)

    last_run_at = Column(DateTime(timezone=True), nullable=True)
    total_matches = Column(Integer, default=0)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)


class ATSAnalysisRun(Base):
    """Log of each analysis run."""
    __tablename__ = "ats_analysis_runs"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(PG_UUID(as_uuid=True), nullable=False)
    job_title = Column(String(255), nullable=True)

    trigger_type = Column(String(20), default="manual", comment="manual, auto, api")
    triggered_by = Column(String(100), nullable=True)

    candidates_analyzed = Column(Integer, default=0)
    matches_found = Column(Integer, default=0)
    best_matches = Column(Integer, default=0)
    good_matches = Column(Integer, default=0)
    duration_seconds = Column(Float, nullable=True)

    status = Column(String(20), default="completed", comment="running, completed, failed")
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
