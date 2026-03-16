"""
Pydantic schemas for the jobs CRUD API.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, Field


# ---------- Create ----------

class JobCreate(BaseModel):
    """Schema for POST /jobs — all fields the UI form can send."""
    job_title: str = Field(..., max_length=255)
    company: str = Field(..., max_length=255)
    priority: Optional[str] = Field(None, max_length=50)
    status: Optional[str] = Field(None, max_length=50)
    location: str = Field(..., max_length=255)
    department: Optional[str] = Field(None, max_length=255)
    open_positions: Optional[int] = 1
    reason: Optional[str] = None
    currency: Optional[str] = Field("USD", max_length=10)
    salary_start: Optional[Decimal] = None
    salary_end: Optional[Decimal] = None
    category: Optional[str] = Field(None, max_length=100)
    employment_type: Optional[str] = Field(None, max_length=50)
    experience: Optional[str] = Field(None, max_length=50)
    skills: Optional[str] = None
    required_qualification: Optional[str] = None
    job_description: Optional[str] = None
    comments: Optional[str] = None
    photo_url: Optional[str] = None


# ---------- Update ----------

class JobUpdate(BaseModel):
    """Schema for PUT /jobs/{id} — every field is optional."""
    job_title: Optional[str] = Field(None, max_length=255)
    company: Optional[str] = Field(None, max_length=255)
    priority: Optional[str] = Field(None, max_length=50)
    status: Optional[str] = Field(None, max_length=50)
    location: Optional[str] = Field(None, max_length=255)
    department: Optional[str] = Field(None, max_length=255)
    open_positions: Optional[int] = None
    reason: Optional[str] = None
    currency: Optional[str] = Field(None, max_length=10)
    salary_start: Optional[Decimal] = None
    salary_end: Optional[Decimal] = None
    category: Optional[str] = Field(None, max_length=100)
    employment_type: Optional[str] = Field(None, max_length=50)
    experience: Optional[str] = Field(None, max_length=50)
    skills: Optional[str] = None
    required_qualification: Optional[str] = None
    job_description: Optional[str] = None
    comments: Optional[str] = None
    photo_url: Optional[str] = None


# ---------- Read ----------

class JobRead(BaseModel):
    """Schema returned by GET endpoints."""
    id: uuid.UUID
    job_title: str
    company: str
    priority: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None
    department: Optional[str] = None
    open_positions: Optional[int] = None
    reason: Optional[str] = None
    currency: Optional[str] = None
    salary_start: Optional[Decimal] = None
    salary_end: Optional[Decimal] = None
    category: Optional[str] = None
    employment_type: Optional[str] = None
    experience: Optional[str] = None
    skills: Optional[str] = None
    required_qualification: Optional[str] = None
    job_description: Optional[str] = None
    comments: Optional[str] = None
    photo_url: Optional[str] = None
    job_id: Optional[str] = None
    posted_date: Optional[datetime] = None
    archived: bool = False
    archived_at: Optional[datetime] = None
    draft_saved_at: Optional[datetime] = None
    is_draft_autosave: bool = False
    held_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    applications_count: Optional[int] = 0

    model_config = {"from_attributes": True}


# ---------- Job Application Schemas ----------

class JobApplicationCreate(BaseModel):
    """Schema for creating a job application."""
    job_id: uuid.UUID
    first_name: str = Field(..., max_length=255)
    last_name: str = Field(..., max_length=255)
    candidate_email: str = Field(..., max_length=255)
    candidate_phone: str = Field(..., max_length=50)
    address: Optional[str] = None
    education: Optional[str] = None
    citizenship: Optional[str] = Field(None, max_length=100)
    experience: Optional[int] = None
    linkedin_url: Optional[str] = None
    resume_url: Optional[str] = None
    resume_filename: Optional[str] = Field(None, max_length=255)


class JobApplicationRead(BaseModel):
    """Schema for reading a job application."""
    id: uuid.UUID
    job_id: uuid.UUID
    # Legacy combined name field
    candidate_name: Optional[str] = None
    # Extended fields
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    candidate_email: Optional[str] = None
    candidate_phone: Optional[str] = None
    address: Optional[str] = None
    education: Optional[str] = None
    citizenship: Optional[str] = None
    experience: Optional[int] = None
    linkedin_url: Optional[str] = None
    resume_url: Optional[str] = None
    resume_filename: Optional[str] = None
    application_status: Optional[str] = "applied"
    applied_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class JobApplicationUpdate(BaseModel):
    """Schema for updating a job application."""
    candidate_name: Optional[str] = Field(None, max_length=255)
    candidate_email: Optional[str] = Field(None, max_length=255)
    candidate_phone: Optional[str] = Field(None, max_length=50)
    application_status: Optional[str] = Field(None, max_length=50)


# ---------- Export Schema ----------

class JobExport(BaseModel):
    """Schema for Excel export."""
    position: str
    jb_link: Optional[str] = None
    company: str
    department: Optional[str] = None
    assignee: Optional[str] = None
    opened_at: datetime
    opened_days: int
    status: str
    categories: Optional[str] = None
    priority: Optional[str] = None
    longlist: int = 0
    contacted: int = 0
    screening: int = 0
    interview: int = 0
    offer: int = 0
    hired: int = 0
