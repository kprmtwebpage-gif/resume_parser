"""
FastAPI router for public job portal features:
- Saved Jobs
- Search History
- Job Applications
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from .database import get_db, Base, engine
from .public_models import SavedJob, SearchHistory
from .models import Job, JobApplication

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

# Ensure uploads directory exists
RESUME_UPLOAD_DIR = Path("uploads/applications")
RESUME_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(tags=["Public Job Portal"])


# ═══════════════════════════════════════════════════════
# Pydantic Schemas
# ═══════════════════════════════════════════════════════

class SavedJobCreate(BaseModel):
    job_id: str
    session_id: Optional[str] = None


class SavedJobRead(BaseModel):
    id: str
    job_id: str
    saved_at: datetime
    job: Optional[dict] = None

    class Config:
        from_attributes = True


class SearchHistoryCreate(BaseModel):
    query: Optional[str] = None
    location: Optional[str] = None
    salary_min: Optional[str] = None
    salary_max: Optional[str] = None
    filters: Optional[str] = None
    session_id: Optional[str] = None


class SearchHistoryRead(BaseModel):
    id: str
    search_query: Optional[str]
    location: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class JobApplicationRead(BaseModel):
    id: str
    job_id: str
    first_name: str
    last_name: str
    email: str
    status: str
    submitted_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════
# SAVED JOBS ENDPOINTS
# ═══════════════════════════════════════════════════════

@router.get(
    "/saved-jobs",
    response_model=List[dict],
    summary="Get all saved jobs",
)
def get_saved_jobs(
    session_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get all saved jobs, optionally filtered by session ID."""
    query = db.query(SavedJob)
    if session_id:
        query = query.filter(SavedJob.session_id == session_id)
    
    saved_jobs = query.order_by(SavedJob.saved_at.desc()).limit(100).all()
    
    # Include job details
    result = []
    for saved in saved_jobs:
        job = db.query(Job).filter(Job.id == saved.job_id).first()
        result.append({
            "id": str(saved.id),
            "job_id": str(saved.job_id),
            "saved_at": saved.saved_at.isoformat(),
            "job": {
                "id": str(job.id),
                "job_title": job.job_title,
                "company": job.company,
                "location": job.location,
                "salary_start": str(job.salary_start) if job.salary_start else None,
                "salary_end": str(job.salary_end) if job.salary_end else None,
                "currency": job.currency,
                "employment_type": job.employment_type,
                "photo_url": job.photo_url,
            } if job else None
        })
    
    return result


@router.post(
    "/saved-jobs",
    status_code=status.HTTP_201_CREATED,
    summary="Save a job",
)
def save_job(
    data: SavedJobCreate,
    db: Session = Depends(get_db),
):
    """Save/bookmark a job for later."""
    try:
        job_uuid = uuid.UUID(data.job_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format",
        )
    
    # Check if job exists
    job = db.query(Job).filter(Job.id == job_uuid).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    
    # Check if already saved
    existing = db.query(SavedJob).filter(
        SavedJob.job_id == job_uuid,
        SavedJob.session_id == data.session_id
    ).first()
    
    if existing:
        return {"id": str(existing.id), "message": "Job already saved"}
    
    # Create new saved job entry
    saved_job = SavedJob(
        job_id=job_uuid,
        session_id=data.session_id,
    )
    
    db.add(saved_job)
    db.commit()
    db.refresh(saved_job)
    
    return {"id": str(saved_job.id), "message": "Job saved successfully"}


@router.delete(
    "/saved-jobs/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a saved job",
)
def remove_saved_job(
    job_id: str,
    session_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Remove a job from saved jobs."""
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format",
        )
    
    query = db.query(SavedJob).filter(SavedJob.job_id == job_uuid)
    if session_id:
        query = query.filter(SavedJob.session_id == session_id)
    
    saved_job = query.first()
    if saved_job:
        db.delete(saved_job)
        db.commit()
    
    return None


# ═══════════════════════════════════════════════════════
# SEARCH HISTORY ENDPOINTS
# ═══════════════════════════════════════════════════════

@router.get(
    "/search-history",
    response_model=List[dict],
    summary="Get search history",
)
def get_search_history(
    session_id: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Get recent search history."""
    query = db.query(SearchHistory)
    if session_id:
        query = query.filter(SearchHistory.session_id == session_id)
    
    history = query.order_by(SearchHistory.created_at.desc()).limit(limit).all()
    
    return [
        {
            "id": str(h.id),
            "query": h.search_query,
            "location": h.location,
            "created_at": h.created_at.isoformat(),
        }
        for h in history
    ]


@router.post(
    "/search-history",
    status_code=status.HTTP_201_CREATED,
    summary="Save search to history",
)
def save_search_history(
    data: SearchHistoryCreate,
    db: Session = Depends(get_db),
):
    """Save a search query to history."""
    history_entry = SearchHistory(
        search_query=data.query,
        location=data.location,
        salary_min=data.salary_min,
        salary_max=data.salary_max,
        filters=data.filters,
        session_id=data.session_id,
    )
    
    db.add(history_entry)
    db.commit()
    db.refresh(history_entry)
    
    return {"id": str(history_entry.id), "message": "Search saved to history"}


@router.delete(
    "/search-history",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Clear search history",
)
def clear_search_history(
    session_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Clear all search history."""
    query = db.query(SearchHistory)
    if session_id:
        query = query.filter(SearchHistory.session_id == session_id)
    
    query.delete()
    db.commit()
    
    return None


@router.delete(
    "/search-history/{history_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a search history entry",
)
def delete_search_history_entry(
    history_id: str,
    db: Session = Depends(get_db),
):
    """Delete a specific search history entry."""
    try:
        history_uuid = uuid.UUID(history_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid history ID format",
        )
    
    entry = db.query(SearchHistory).filter(SearchHistory.id == history_uuid).first()
    if entry:
        db.delete(entry)
        db.commit()
    
    return None


# ═══════════════════════════════════════════════════════
# JOB APPLICATIONS ENDPOINTS
# ═══════════════════════════════════════════════════════

@router.post(
    "/job-applications",
    status_code=status.HTTP_201_CREATED,
    summary="Submit a job application",
)
async def submit_application(
    job_id: str = Form(...),
    first_name: str = Form(...),
    last_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    address: Optional[str] = Form(None),
    qualification: Optional[str] = Form(None),
    work_authorization: Optional[str] = Form(None),
    domain_expert: Optional[str] = Form(None),
    tech_experience: Optional[str] = Form(None),
    linkedin_url: Optional[str] = Form(None),
    resume: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    """Submit a job application with optional resume upload."""
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format",
        )
    
    # Check if job exists
    job = db.query(Job).filter(Job.id == job_uuid).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    
    # Handle resume upload
    resume_url = None
    resume_filename = None
    if resume and resume.filename:
        file_ext = Path(resume.filename).suffix or ".pdf"
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = RESUME_UPLOAD_DIR / unique_filename
        
        with open(file_path, "wb") as f:
            content = await resume.read()
            f.write(content)
        
        resume_url = f"/uploads/applications/{unique_filename}"
        resume_filename = resume.filename
    
    # Prevent duplicate submissions from the same email for this job
    existing = (
        db.query(JobApplication)
        .filter(
            JobApplication.job_id == job_uuid,
            (JobApplication.candidate_email == email) | (JobApplication.email == email),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already applied for this job.",
        )

    # Parse experience from tech_experience text field
    exp_int = None
    if tech_experience:
        try:
            exp_int = int(float(tech_experience))
        except (ValueError, TypeError):
            exp_int = None

    # Create application — write to both new and legacy column names for compatibility
    application = JobApplication(
        job_id=job_uuid,
        first_name=first_name,
        last_name=last_name,
        candidate_name=f"{first_name} {last_name}".strip(),
        candidate_email=email,
        candidate_phone=phone,
        # Legacy column aliases
        email=email,
        phone=phone,
        qualification=qualification,
        work_authorization=work_authorization,
        tech_experience=tech_experience,
        domain_expert=domain_expert,
        # New canonical fields
        education=qualification,
        citizenship=work_authorization,
        experience=exp_int,
        address=address,
        linkedin_url=linkedin_url,
        resume_url=resume_url,
        resume_filename=resume_filename,
        application_status="applied",
    )

    db.add(application)
    db.commit()
    db.refresh(application)
    
    return {
        "id": str(application.id),
        "message": "Application submitted successfully",
        "status": application.application_status,
    }


@router.get(
    "/job-applications",
    response_model=List[dict],
    summary="Get job applications (admin)",
)
def get_applications(
    job_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Get all job applications (for admin viewing)."""
    query = db.query(JobApplication)
    
    if job_id:
        try:
            job_uuid = uuid.UUID(job_id)
            query = query.filter(JobApplication.job_id == job_uuid)
        except ValueError:
            pass
    
    if status:
        query = query.filter(JobApplication.application_status == status)
    
    applications = (
        query
        .order_by(JobApplication.applied_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    result = []
    for app in applications:
        job = db.query(Job).filter(Job.id == app.job_id).first()
        # Split candidate_name back into first/last for API compatibility
        first = app.first_name or ""
        last = app.last_name or ""
        if not first and not last and app.candidate_name:
            name_parts = app.candidate_name.strip().split(" ", 1)
            first = name_parts[0]
            last = name_parts[1] if len(name_parts) > 1 else ""
        email = app.candidate_email or app.email or ""
        phone = app.candidate_phone or app.phone or ""
        applied_ts = app.applied_at or app.submitted_at
        result.append({
            "id": str(app.id),
            "job_id": str(app.job_id),
            "job_title": job.job_title if job else None,
            "company": job.company if job else None,
            "candidate_name": app.candidate_name,
            "first_name": first,
            "last_name": last,
            "email": email,
            "phone": phone,
            "education": app.education or app.qualification or "",
            "citizenship": app.citizenship or app.work_authorization or "",
            "address": app.address or "",
            "linkedin_url": app.linkedin_url or "",
            "status": app.application_status or app.status or "applied",
            "submitted_at": applied_ts.isoformat() if applied_ts else None,
            "resume_url": app.resume_url or "",
            "resume_filename": app.resume_filename or "",
        })
    
    return result


@router.get(
    "/job-applications/{application_id}",
    summary="Get application details",
)
def get_application_details(
    application_id: str,
    db: Session = Depends(get_db),
):
    """Get full details of a job application."""
    try:
        app_uuid = uuid.UUID(application_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid application ID format",
        )
    
    application = db.query(JobApplication).filter(JobApplication.id == app_uuid).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )
    
    job = db.query(Job).filter(Job.id == application.job_id).first()
    
    app = application
    first = app.first_name or ""
    last = app.last_name or ""
    if not first and not last and app.candidate_name:
        name_parts = app.candidate_name.strip().split(" ", 1)
        first = name_parts[0]
        last = name_parts[1] if len(name_parts) > 1 else ""
    email = app.candidate_email or app.email or ""
    phone = app.candidate_phone or app.phone or ""
    applied_ts = app.applied_at or app.submitted_at
    return {
        "id": str(app.id),
        "job_id": str(app.job_id),
        "job_title": job.job_title if job else None,
        "company": job.company if job else None,
        "candidate_name": app.candidate_name,
        "first_name": first,
        "last_name": last,
        "email": email,
        "phone": phone,
        "education": app.education or app.qualification or "",
        "citizenship": app.citizenship or app.work_authorization or "",
        "address": app.address or "",
        "linkedin_url": app.linkedin_url or "",
        "resume_url": app.resume_url or "",
        "resume_filename": app.resume_filename or "",
        "status": app.application_status or app.status or "applied",
        "submitted_at": applied_ts.isoformat() if applied_ts else None,
    }


@router.put(
    "/job-applications/{application_id}/status",
    summary="Update application status",
)
def update_application_status(
    application_id: str,
    new_status: str,
    db: Session = Depends(get_db),
):
    """Update the status of a job application."""
    try:
        app_uuid = uuid.UUID(application_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid application ID format",
        )
    
    application = db.query(JobApplication).filter(JobApplication.id == app_uuid).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )
    
    valid_statuses = ["applied", "Submitted", "Reviewed", "Shortlisted", "Rejected", "Hired"]
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}",
        )
    
    application.application_status = new_status
    db.commit()
    db.refresh(application)
    
    return {
        "id": str(application.id),
        "status": application.application_status,
        "message": "Status updated successfully",
    }
