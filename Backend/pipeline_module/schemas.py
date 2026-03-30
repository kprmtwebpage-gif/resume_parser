"""Pydantic schemas for the Interview Pipeline module."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


# ── Stage Config (Admin) ──────────────────────────

class StageConfigCreate(BaseModel):
    stage_key: str = Field(..., max_length=50)
    label: str = Field(..., max_length=100)
    stage_order: int = 0
    color: Optional[str] = "#6366f1"
    is_terminal: bool = False
    description: Optional[str] = None


class StageConfigUpdate(BaseModel):
    label: Optional[str] = None
    stage_order: Optional[int] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    is_terminal: Optional[bool] = None
    description: Optional[str] = None


class StageConfigRead(BaseModel):
    id: uuid.UUID
    stage_key: str
    label: str
    stage_order: int
    color: Optional[str] = "#6366f1"
    is_active: bool = True
    is_terminal: bool = False
    description: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Feedback Update ───────────────────────────────

class StageFeedbackUpdate(BaseModel):
    technical_rating: Optional[int] = Field(None, ge=1, le=5)
    communication_rating: Optional[int] = Field(None, ge=1, le=5)
    problem_solving_rating: Optional[int] = Field(None, ge=1, le=5)
    cultural_fit_rating: Optional[int] = Field(None, ge=1, le=5)
    overall_rating: Optional[int] = Field(None, ge=1, le=5)
    recommendation: Optional[str] = None
    comments: Optional[str] = None
    strengths: Optional[str] = None
    weaknesses: Optional[str] = None


# ── Pipeline Candidate ────────────────────────────

class PipelineCandidateCreate(BaseModel):
    candidate_id: int
    candidate_name: str = Field(..., max_length=255)
    candidate_email: Optional[str] = None
    candidate_phone: Optional[str] = None
    job_id: Optional[uuid.UUID] = None
    job_title: Optional[str] = None
    current_stage: str = "screening"


class PipelineCandidateUpdate(BaseModel):
    current_stage: Optional[str] = None
    stage_status: Optional[str] = None
    ranking: Optional[str] = None
    is_active: Optional[bool] = None
    is_archived: Optional[bool] = None


class StageTransition(BaseModel):
    to_stage: str
    action: str = "moved"
    notes: Optional[str] = None


class StageFeedbackCreate(BaseModel):
    stage: str
    reviewer_name: str = Field(..., max_length=255)
    reviewer_email: Optional[str] = None
    technical_rating: Optional[int] = Field(None, ge=1, le=5)
    communication_rating: Optional[int] = Field(None, ge=1, le=5)
    problem_solving_rating: Optional[int] = Field(None, ge=1, le=5)
    cultural_fit_rating: Optional[int] = Field(None, ge=1, le=5)
    overall_rating: Optional[int] = Field(None, ge=1, le=5)
    recommendation: Optional[str] = None
    comments: Optional[str] = None
    strengths: Optional[str] = None
    weaknesses: Optional[str] = None


# ── Read schemas ──────────────────────────────────

class StageHistoryRead(BaseModel):
    id: uuid.UUID
    from_stage: Optional[str] = None
    to_stage: str
    action: str
    notes: Optional[str] = None
    moved_by: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class FeedbackRead(BaseModel):
    id: uuid.UUID
    stage: str
    reviewer_name: str
    reviewer_email: Optional[str] = None
    technical_rating: Optional[int] = None
    communication_rating: Optional[int] = None
    problem_solving_rating: Optional[int] = None
    cultural_fit_rating: Optional[int] = None
    overall_rating: Optional[int] = None
    recommendation: Optional[str] = None
    comments: Optional[str] = None
    strengths: Optional[str] = None
    weaknesses: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class ScorecardRead(BaseModel):
    id: uuid.UUID
    technical_avg: Optional[float] = None
    communication_avg: Optional[float] = None
    problem_solving_avg: Optional[float] = None
    cultural_fit_avg: Optional[float] = None
    overall_avg: Optional[float] = None
    final_score: Optional[float] = None
    ranking: Optional[str] = None
    review_count: int = 0
    stages_completed: int = 0
    updated_at: datetime
    model_config = {"from_attributes": True}


class PipelineCandidateRead(BaseModel):
    id: uuid.UUID
    candidate_id: int
    candidate_name: str
    candidate_email: Optional[str] = None
    candidate_phone: Optional[str] = None
    job_id: Optional[uuid.UUID] = None
    job_title: Optional[str] = None
    current_stage: str
    stage_order: int
    overall_score: Optional[float] = None
    ranking: Optional[str] = None
    stage_status: Optional[str] = "active"
    is_active: bool = True
    is_archived: bool = False
    added_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    stage_history: List[StageHistoryRead] = []
    feedback_entries: List[FeedbackRead] = []
    scorecard: Optional[ScorecardRead] = None
    model_config = {"from_attributes": True}


class PipelineCandidateListRead(BaseModel):
    id: uuid.UUID
    candidate_id: int
    candidate_name: str
    candidate_email: Optional[str] = None
    job_title: Optional[str] = None
    current_stage: str
    stage_order: int
    overall_score: Optional[float] = None
    ranking: Optional[str] = None
    stage_status: Optional[str] = "active"
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Board view ────────────────────────────────────

class StageColumn(BaseModel):
    stage: str
    label: str
    order: int
    candidates: List[PipelineCandidateListRead] = []
    count: int = 0


class PipelineBoardView(BaseModel):
    columns: List[StageColumn] = []
    total_candidates: int = 0


# ── Analytics ─────────────────────────────────────

class PipelineAnalytics(BaseModel):
    total_in_pipeline: int = 0
    by_stage: dict = {}
    by_ranking: dict = {}
    avg_score: Optional[float] = None
    conversion_rates: dict = {}
    recent_moves: List[dict] = []
