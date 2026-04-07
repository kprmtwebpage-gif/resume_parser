"""Pydantic schemas for the company_jobs_module."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CompanyJobCreate(BaseModel):
    title: str
    company: str
    priority: str = "Normal"
    status: str = "New"
    location: Optional[str] = None
    department: Optional[str] = None
    category: Optional[str] = None
    employment_type: Optional[str] = None
    skills: Optional[str] = None
    description: Optional[str] = None
    comments: Optional[str] = None
    customer: Optional[str] = None
    assignee: Optional[str] = None
    logo_path: Optional[str] = None


class CompanyJobRead(CompanyJobCreate):
    id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True
