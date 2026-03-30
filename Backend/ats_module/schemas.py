"""Pydantic schemas for ATS matching module."""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class MatchResultRead(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    candidate_id: int
    overall_score: float
    skills_score: float = 0
    experience_score: float = 0
    location_score: float = 0
    education_score: float = 0
    title_score: float = 0
    match_tier: str
    job_title: Optional[str] = None
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    candidate_skills: Optional[str] = None
    matched_skills: Optional[str] = None
    missing_skills: Optional[str] = None
    is_applied: Optional[bool] = False
    is_shortlisted: Optional[bool] = False
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AnalysisConfigCreate(BaseModel):
    job_id: uuid.UUID
    job_title: Optional[str] = None
    is_enabled: bool = True
    auto_run: bool = False
    min_score_threshold: int = 40
    weight_skills: int = 40
    weight_experience: int = 20
    weight_location: int = 15
    weight_education: int = 10
    weight_title: int = 15


class AnalysisConfigUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    auto_run: Optional[bool] = None
    min_score_threshold: Optional[int] = None
    weight_skills: Optional[int] = None
    weight_experience: Optional[int] = None
    weight_location: Optional[int] = None
    weight_education: Optional[int] = None
    weight_title: Optional[int] = None


class AnalysisConfigRead(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    job_title: Optional[str] = None
    is_enabled: bool
    auto_run: bool
    min_score_threshold: int
    weight_skills: int
    weight_experience: int
    weight_location: int
    weight_education: int
    weight_title: int
    last_run_at: Optional[datetime] = None
    total_matches: int = 0
    created_by: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class AnalysisRunRead(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    job_title: Optional[str] = None
    trigger_type: str
    triggered_by: Optional[str] = None
    candidates_analyzed: int
    matches_found: int
    best_matches: int
    good_matches: int
    duration_seconds: Optional[float] = None
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}


class AnalyzeRequest(BaseModel):
    job_id: uuid.UUID
    force_refresh: bool = False


class JobMatchSummary(BaseModel):
    job_id: uuid.UUID
    job_title: Optional[str] = None
    total_candidates: int = 0
    best_matches: int = 0
    good_matches: int = 0
    partial_matches: int = 0
    low_matches: int = 0
    applied: int = 0
    shortlisted: int = 0
    last_analyzed: Optional[datetime] = None
    is_auto_enabled: bool = False
