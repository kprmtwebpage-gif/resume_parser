"""
SQLAlchemy models for the Interview Pipeline (Kanban) module.

Tables:
  - pipeline_stage_config : Admin-configurable pipeline stages
  - pipeline_candidates : Candidates in the hiring pipeline with current stage
  - pipeline_stage_history : Audit log of all stage transitions
  - pipeline_feedback : Feedback/notes per candidate per stage
  - pipeline_scorecards : Structured scorecard ratings per candidate
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Text, Integer, Float, DateTime, Boolean,
    ForeignKey, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from .database import Base

def _now():
    return datetime.now(timezone.utc)


# Default stages (used as fallback if no DB config exists)
DEFAULT_PIPELINE_STAGES = [
    "screening",
    "written_test",
    "level_1",
    "level_2",
    "level_3",
    "offer",
    "onboarding_initiated",
    "onboarding_completed",
]

DEFAULT_STAGE_LABELS = {
    "screening": "Screening",
    "written_test": "Written Test",
    "level_1": "Level 1 Interview",
    "level_2": "Level 2 Interview",
    "level_3": "Level 3 Interview",
    "offer": "Offer",
    "onboarding_initiated": "Onboarding Initiated",
    "onboarding_completed": "Onboarding Completed",
}

# Keep these for backward compatibility
PIPELINE_STAGES = DEFAULT_PIPELINE_STAGES
STAGE_LABELS = DEFAULT_STAGE_LABELS


class PipelineStageConfig(Base):
    """Admin-configurable pipeline stages. Order determines Kanban column position."""
    __tablename__ = "pipeline_stage_config"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stage_key = Column(String(50), unique=True, nullable=False, comment="Unique key e.g. screening, level_1")
    label = Column(String(100), nullable=False, comment="Display label e.g. Screening, Level 1 Interview")
    stage_order = Column(Integer, nullable=False, default=0)
    color = Column(String(20), nullable=True, default="#6366f1", comment="Accent color hex")
    is_active = Column(Boolean, default=True, nullable=False)
    is_terminal = Column(Boolean, default=False, comment="Terminal stages like Onboarding Completed")
    description = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    def __repr__(self):
        return f"<StageConfig {self.stage_key} order={self.stage_order}>"

# Ranking tiers
RANKING_TIERS = [
    "potential_candidate",
    "average",
    "below_average",
    "poor",
    "fake_or_not_recommended",
]

RANKING_LABELS = {
    "potential_candidate": "Potential Candidate",
    "average": "Average",
    "below_average": "Below Average",
    "poor": "Poor",
    "fake_or_not_recommended": "Fake / Not Recommended",
}


class PipelineCandidate(Base):
    __tablename__ = "pipeline_candidates"
    __table_args__ = (
        UniqueConstraint("candidate_id", "job_id", name="uq_pipeline_candidate_job"),
    )

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Link to existing candidate_profile (integer PK)
    candidate_id = Column(Integer, nullable=False, index=True)
    candidate_name = Column(String(255), nullable=False)
    candidate_email = Column(String(255), nullable=True)
    candidate_phone = Column(String(50), nullable=True)

    # Link to jobs table (UUID PK)
    job_id = Column(PG_UUID(as_uuid=True), nullable=True)
    job_title = Column(String(255), nullable=True)

    # Current pipeline stage
    current_stage = Column(String(50), nullable=False, default="screening")
    stage_order = Column(Integer, nullable=False, default=0)

    # Overall scorecard
    overall_score = Column(Float, nullable=True, comment="Weighted average 0-100")
    ranking = Column(String(50), nullable=True, comment="potential_candidate, average, below_average, poor, fake_or_not_recommended")

    # Status within stage
    stage_status = Column(String(30), default="active", comment="active, passed, failed, on_hold, rejected, withdrawn")

    # Flags
    is_active = Column(Boolean, default=True)
    is_archived = Column(Boolean, default=False)

    # Audit
    added_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    # Relationships
    stage_history = relationship("PipelineStageHistory", back_populates="pipeline_candidate",
                                 cascade="all, delete-orphan", passive_deletes=True,
                                 order_by="PipelineStageHistory.created_at")
    feedback_entries = relationship("PipelineFeedback", back_populates="pipeline_candidate",
                                    cascade="all, delete-orphan", passive_deletes=True,
                                    order_by="PipelineFeedback.created_at.desc()")
    scorecard = relationship("PipelineScorecard", back_populates="pipeline_candidate",
                              cascade="all, delete-orphan", passive_deletes=True,
                              uselist=False)

    def __repr__(self):
        return f"<PipelineCandidate {self.candidate_name} stage={self.current_stage}>"


class PipelineStageHistory(Base):
    __tablename__ = "pipeline_stage_history"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_candidate_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("pipeline_candidates.id", ondelete="CASCADE"),
        nullable=False,
    )

    from_stage = Column(String(50), nullable=True)
    to_stage = Column(String(50), nullable=False)
    action = Column(String(30), default="moved", comment="moved, passed, failed, rejected, skipped")
    notes = Column(Text, nullable=True)
    moved_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    pipeline_candidate = relationship("PipelineCandidate", back_populates="stage_history")


class PipelineFeedback(Base):
    __tablename__ = "pipeline_feedback"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_candidate_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("pipeline_candidates.id", ondelete="CASCADE"),
        nullable=False,
    )

    stage = Column(String(50), nullable=False, comment="Stage when feedback was given")
    reviewer_name = Column(String(255), nullable=False)
    reviewer_email = Column(String(255), nullable=True)

    # Ratings (1-5)
    technical_rating = Column(Integer, nullable=True)
    communication_rating = Column(Integer, nullable=True)
    problem_solving_rating = Column(Integer, nullable=True)
    cultural_fit_rating = Column(Integer, nullable=True)
    overall_rating = Column(Integer, nullable=True)

    recommendation = Column(String(50), nullable=True,
                            comment="potential_candidate, average, below_average, poor, fake_or_not_recommended")
    comments = Column(Text, nullable=True)
    strengths = Column(Text, nullable=True)
    weaknesses = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    pipeline_candidate = relationship("PipelineCandidate", back_populates="feedback_entries")


class PipelineScorecard(Base):
    __tablename__ = "pipeline_scorecards"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_candidate_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("pipeline_candidates.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # Aggregate scores (auto-calculated from feedback)
    technical_avg = Column(Float, nullable=True)
    communication_avg = Column(Float, nullable=True)
    problem_solving_avg = Column(Float, nullable=True)
    cultural_fit_avg = Column(Float, nullable=True)
    overall_avg = Column(Float, nullable=True)

    # Weighted final score (0-100)
    final_score = Column(Float, nullable=True)

    # Auto-derived ranking
    ranking = Column(String(50), nullable=True)

    # Number of reviews
    review_count = Column(Integer, default=0)
    stages_completed = Column(Integer, default=0)

    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    pipeline_candidate = relationship("PipelineCandidate", back_populates="scorecard")
