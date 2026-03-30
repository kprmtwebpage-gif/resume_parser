"""
Pydantic schemas for Interview Scheduling API validation.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


# ── Interview ─────────────────────────────────────

class InterviewCreate(BaseModel):
    candidate_id: Optional[int] = None
    candidate_name: str = Field(..., max_length=255)
    candidate_email: Optional[str] = Field(None, max_length=255)
    candidate_phone: Optional[str] = Field(None, max_length=50)
    job_id: Optional[uuid.UUID] = None
    job_title: Optional[str] = Field(None, max_length=255)
    interview_type: str = Field("video", max_length=50)
    round_number: int = 1
    round_label: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    duration_minutes: int = 60
    timezone: str = "America/New_York"
    meeting_link: Optional[str] = None
    meeting_platform: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    panel_members: Optional[List[PanelMemberCreate]] = []


class InterviewUpdate(BaseModel):
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    candidate_phone: Optional[str] = None
    job_title: Optional[str] = None
    interview_type: Optional[str] = None
    round_number: Optional[int] = None
    round_label: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    timezone: Optional[str] = None
    meeting_link: Optional[str] = None
    meeting_platform: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    outcome: Optional[str] = None
    overall_rating: Optional[int] = None
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None


class PanelMemberCreate(BaseModel):
    interviewer_name: str = Field(..., max_length=255)
    interviewer_email: Optional[str] = Field(None, max_length=255)
    interviewer_role: Optional[str] = None
    is_lead: bool = False


class PanelMemberRead(BaseModel):
    id: uuid.UUID
    interview_id: uuid.UUID
    interviewer_name: str
    interviewer_email: Optional[str] = None
    interviewer_role: Optional[str] = None
    is_lead: bool
    status: str
    response_note: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class FeedbackCreate(BaseModel):
    reviewer_name: str = Field(..., max_length=255)
    reviewer_email: Optional[str] = None
    technical_rating: Optional[int] = Field(None, ge=1, le=5)
    communication_rating: Optional[int] = Field(None, ge=1, le=5)
    problem_solving_rating: Optional[int] = Field(None, ge=1, le=5)
    cultural_fit_rating: Optional[int] = Field(None, ge=1, le=5)
    overall_rating: Optional[int] = Field(None, ge=1, le=5)
    recommendation: Optional[str] = None
    strengths: Optional[str] = None
    weaknesses: Optional[str] = None
    comments: Optional[str] = None


class FeedbackRead(BaseModel):
    id: uuid.UUID
    interview_id: uuid.UUID
    reviewer_name: str
    reviewer_email: Optional[str] = None
    technical_rating: Optional[int] = None
    communication_rating: Optional[int] = None
    problem_solving_rating: Optional[int] = None
    cultural_fit_rating: Optional[int] = None
    overall_rating: Optional[int] = None
    recommendation: Optional[str] = None
    strengths: Optional[str] = None
    weaknesses: Optional[str] = None
    comments: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InterviewRead(BaseModel):
    id: uuid.UUID
    candidate_id: Optional[int] = None
    candidate_name: str
    candidate_email: Optional[str] = None
    candidate_phone: Optional[str] = None
    job_id: Optional[uuid.UUID] = None
    job_title: Optional[str] = None
    interview_type: str
    round_number: int
    round_label: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    duration_minutes: int
    timezone: Optional[str] = "America/New_York"
    meeting_link: Optional[str] = None
    meeting_platform: Optional[str] = None
    meeting_id: Optional[str] = None
    location: Optional[str] = None
    status: str = "scheduled"
    outcome: Optional[str] = None
    overall_rating: Optional[int] = None
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None
    candidate_notified: Optional[bool] = False
    interviewer_notified: Optional[bool] = False
    reminder_sent: Optional[bool] = False
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    panel_members: List[PanelMemberRead] = []
    feedback: List[FeedbackRead] = []

    model_config = {"from_attributes": True}


class InterviewListRead(BaseModel):
    id: uuid.UUID
    candidate_name: str
    candidate_email: Optional[str] = None
    job_title: Optional[str] = None
    interview_type: str
    round_number: int
    round_label: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    duration_minutes: int
    status: str
    outcome: Optional[str] = None
    overall_rating: Optional[int] = None
    meeting_platform: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Availability ──────────────────────────────────

class AvailabilityCreate(BaseModel):
    interviewer_name: str = Field(..., max_length=255)
    interviewer_email: str = Field(..., max_length=255)
    available_date: datetime
    available_end: datetime
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None
    day_of_week: Optional[int] = None
    timezone: str = "America/New_York"


class AvailabilityRead(BaseModel):
    id: uuid.UUID
    interviewer_name: str
    interviewer_email: str
    available_date: datetime
    available_end: datetime
    is_recurring: bool
    recurrence_pattern: Optional[str] = None
    day_of_week: Optional[int] = None
    timezone: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Analytics ─────────────────────────────────────

class InterviewAnalytics(BaseModel):
    total_interviews: int = 0
    scheduled: int = 0
    completed: int = 0
    cancelled: int = 0
    no_show: int = 0
    avg_rating: Optional[float] = None
    pass_rate: Optional[float] = None
    avg_time_to_schedule_hours: Optional[float] = None
    interviews_this_week: int = 0
    interviews_this_month: int = 0
    by_type: dict = {}
    by_outcome: dict = {}
    interviewer_load: List[dict] = []


# Fix forward reference
InterviewCreate.model_rebuild()
