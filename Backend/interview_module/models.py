"""
SQLAlchemy ORM models for the Interview Scheduling module.

Tables:
  - interviews        : Core interview records
  - interview_panels  : Interviewers assigned to each interview
  - interviewer_availability : Interviewer time-slot availability
  - interview_feedback : Post-interview feedback/notes
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Text, Integer, DateTime, Boolean,
    ForeignKey, Numeric, Enum as PgEnum,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from .database import Base


def _now():
    return datetime.now(timezone.utc)


class Interview(Base):
    __tablename__ = "interviews"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Candidate reference (integer FK to candidate_profile)
    candidate_id = Column(Integer, nullable=True)
    candidate_name = Column(String(255), nullable=False)
    candidate_email = Column(String(255), nullable=True)
    candidate_phone = Column(String(50), nullable=True)

    # Job reference (UUID FK to jobs table)
    job_id = Column(PG_UUID(as_uuid=True), nullable=True)
    job_title = Column(String(255), nullable=True)

    # Interview details
    interview_type = Column(
        String(50), nullable=False, default="video",
        comment="video, phone, onsite, panel, technical, hr, behavioral"
    )
    round_number = Column(Integer, default=1)
    round_label = Column(String(100), nullable=True, comment="e.g. Technical Round 1, HR Screening")

    # Scheduling
    scheduled_date = Column(DateTime(timezone=True), nullable=True)
    scheduled_end = Column(DateTime(timezone=True), nullable=True)
    duration_minutes = Column(Integer, default=60)
    timezone = Column(String(50), default="America/New_York")

    # Meeting details
    meeting_link = Column(Text, nullable=True)
    meeting_platform = Column(String(50), nullable=True, comment="zoom, teams, google_meet, webex, phone")
    meeting_id = Column(String(100), nullable=True)
    location = Column(String(255), nullable=True, comment="For onsite interviews")

    # Status flow: scheduled -> confirmed -> in_progress -> completed / cancelled / no_show
    status = Column(
        String(30), nullable=False, default="scheduled",
        comment="scheduled, confirmed, in_progress, completed, cancelled, no_show, rescheduled"
    )

    # Outcome (filled after interview)
    outcome = Column(
        String(30), nullable=True,
        comment="passed, failed, on_hold, strong_hire, hire, no_hire"
    )
    overall_rating = Column(Integer, nullable=True, comment="1-5 scale")

    # Notes
    notes = Column(Text, nullable=True)
    cancellation_reason = Column(Text, nullable=True)

    # Notifications
    candidate_notified = Column(Boolean, default=False)
    interviewer_notified = Column(Boolean, default=False)
    reminder_sent = Column(Boolean, default=False)

    # Audit
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    # Relationships
    panel_members = relationship("InterviewPanel", back_populates="interview",
                                 cascade="all, delete-orphan", passive_deletes=True)
    feedback = relationship("InterviewFeedback", back_populates="interview",
                            cascade="all, delete-orphan", passive_deletes=True)

    def __repr__(self):
        return f"<Interview id={self.id} candidate={self.candidate_name} status={self.status}>"


class InterviewPanel(Base):
    __tablename__ = "interview_panels"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("interviews.id", ondelete="CASCADE"),
        nullable=False,
    )

    interviewer_name = Column(String(255), nullable=False)
    interviewer_email = Column(String(255), nullable=True)
    interviewer_role = Column(String(100), nullable=True, comment="e.g. Hiring Manager, Tech Lead")
    is_lead = Column(Boolean, default=False, comment="Primary interviewer flag")

    # Per-interviewer status
    status = Column(String(30), default="pending", comment="pending, accepted, declined")
    response_note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    interview = relationship("Interview", back_populates="panel_members")

    def __repr__(self):
        return f"<InterviewPanel id={self.id} interviewer={self.interviewer_name}>"


class InterviewerAvailability(Base):
    __tablename__ = "interviewer_availability"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    interviewer_name = Column(String(255), nullable=False)
    interviewer_email = Column(String(255), nullable=False)

    # Available time slot
    available_date = Column(DateTime(timezone=True), nullable=False)
    available_end = Column(DateTime(timezone=True), nullable=False)

    # Recurring availability
    is_recurring = Column(Boolean, default=False)
    recurrence_pattern = Column(String(50), nullable=True, comment="weekly, biweekly, monthly")
    day_of_week = Column(Integer, nullable=True, comment="0=Monday, 6=Sunday")

    timezone = Column(String(50), default="America/New_York")
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    def __repr__(self):
        return f"<Availability id={self.id} interviewer={self.interviewer_name}>"


class InterviewFeedback(Base):
    __tablename__ = "interview_feedback"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("interviews.id", ondelete="CASCADE"),
        nullable=False,
    )

    reviewer_name = Column(String(255), nullable=False)
    reviewer_email = Column(String(255), nullable=True)

    # Ratings (1-5)
    technical_rating = Column(Integer, nullable=True)
    communication_rating = Column(Integer, nullable=True)
    problem_solving_rating = Column(Integer, nullable=True)
    cultural_fit_rating = Column(Integer, nullable=True)
    overall_rating = Column(Integer, nullable=True)

    # Recommendation
    recommendation = Column(
        String(30), nullable=True,
        comment="strong_hire, hire, no_hire, on_hold"
    )

    strengths = Column(Text, nullable=True)
    weaknesses = Column(Text, nullable=True)
    comments = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    interview = relationship("Interview", back_populates="feedback")

    def __repr__(self):
        return f"<Feedback id={self.id} reviewer={self.reviewer_name}>"
