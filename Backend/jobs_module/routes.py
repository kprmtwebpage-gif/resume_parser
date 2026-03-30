"""
FastAPI router — full CRUD for the 'jobs' table.

Endpoints:
    POST   /jobs                      → create
    GET    /jobs                      → list active jobs (not archived)
    GET    /jobs/archived             → list archived jobs
    GET    /jobs/{id}                 → get one
    PUT    /jobs/{id}                 → update
    POST   /jobs/{id}/archive         → archive a job
    POST   /jobs/{id}/restore         → restore a job from archive
    POST   /jobs/{id}/duplicate       → duplicate a job (copy job)
    POST   /jobs/{id}/hold            → hold a job
    POST   /jobs/{id}/unhold          → resume/unhold a job
    POST   /jobs/{id}/close           → close a job
    POST   /jobs/{id}/draft           → autosave draft
    DELETE /jobs/{id}                 → archive (soft delete from UI)
    DELETE /jobs/{id}/permanent       → permanently delete a job
    
    # Job Applications
    GET    /jobs/{id}/applications    → list applications for a job
    POST   /jobs/{id}/applications    → create application
    GET    /jobs/applications/{app_id}→ get single application
    DELETE /jobs/applications/{app_id}→ delete application
    
    # Export
    GET    /jobs/export               → export jobs to Excel
    
    # Filter options
    GET    /jobs/filter-options       → get dynamic filter options
"""

from __future__ import annotations

import os
import uuid
import io
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from .database import get_db
from .models import Job, JobApplication, generate_job_id
from .schemas import (
    JobCreate, JobRead, JobUpdate, 
    JobApplicationCreate, JobApplicationRead, JobApplicationUpdate,
    JobExport
)

# Absolute base path (Backend directory) — avoids CWD-dependent resolution
_BACKEND_DIR = Path(__file__).resolve().parent.parent

# Ensure uploads directory exists
UPLOAD_DIR = _BACKEND_DIR / "uploads" / "jobs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Upload directory for resumes
RESUME_UPLOAD_DIR = _BACKEND_DIR / "uploads" / "applications"
RESUME_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/api/job-projects", tags=["Job Projects"])


# Helper to get applications count for a job
def get_job_with_app_count(job: Job, db: Session) -> dict:
    """Convert job to dict and add applications count."""
    job_dict = {
        "id": job.id,
        "job_title": job.job_title,
        "company": job.company,
        "priority": job.priority,
        "status": job.status,
        "location": job.location,
        "department": job.department,
        "open_positions": job.open_positions,
        "reason": job.reason,
        "currency": job.currency,
        "salary_start": job.salary_start,
        "salary_end": job.salary_end,
        "category": job.category,
        "employment_type": job.employment_type,
        "experience": job.experience,
        "skills": job.skills,
        "required_qualification": job.required_qualification,
        "job_description": job.job_description,
        "comments": job.comments,
        "photo_url": job.photo_url,
        "job_id": job.job_id,
        "posted_date": job.posted_date,
        "archived": job.archived,
        "archived_at": job.archived_at,
        "draft_saved_at": job.draft_saved_at,
        "is_draft_autosave": job.is_draft_autosave,
        "held_at": job.held_at,
        "closed_at": job.closed_at,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "applications_count": db.query(func.count(JobApplication.id)).filter(JobApplication.job_id == job.id).scalar() or 0
    }
    return job_dict


# ────────────────────── CREATE ──────────────────────

@router.post(
    "",
    response_model=JobRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new job",
)
async def create_job(
    job_title: str = Form(...),
    company: str = Form(...),
    location: str = Form(...),
    priority: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    open_positions: Optional[int] = Form(None),
    reason: Optional[str] = Form(None),
    currency: Optional[str] = Form(None),
    salary_start: Optional[str] = Form(None),
    salary_end: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    employment_type: Optional[str] = Form(None),
    experience: Optional[str] = Form(None),
    skills: Optional[str] = Form(None),
    required_qualification: Optional[str] = Form(None),
    job_description: Optional[str] = Form(None),
    comments: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    """Create a new job with optional photo upload."""
    
    # Handle file upload
    photo_url = None
    if photo and photo.filename:
        # Generate unique filename
        file_ext = Path(photo.filename).suffix or ".jpg"
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = UPLOAD_DIR / unique_filename
        
        # Save file to disk
        with open(file_path, "wb") as f:
            content = await photo.read()
            f.write(content)
        
        # Store relative URL path
        photo_url = f"/uploads/jobs/{unique_filename}"
    
    # Create job record
    job = Job(
        job_title=job_title,
        company=company,
        location=location,
        priority=priority,
        status=status or "DRAFT",
        department=department,
        open_positions=open_positions,
        reason=reason,
        currency=currency,
        salary_start=salary_start,
        salary_end=salary_end,
        category=category,
        employment_type=employment_type,
        experience=experience,
        skills=skills,
        required_qualification=required_qualification,
        job_description=job_description,
        comments=comments,
        photo_url=photo_url,
        job_id=generate_job_id(),
    )
    
    db.add(job)
    db.commit()
    db.refresh(job)
    return get_job_with_app_count(job, db)


# ────────────────────── READ (list) ──────────────────────

@router.get(
    "",
    response_model=List[JobRead],
    summary="List active jobs (not archived)",
)
def list_jobs(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    """List all active jobs (excludes archived jobs, includes on-hold jobs)."""
    jobs = (
        db.query(Job)
        .filter(Job.archived == False)
        .order_by(Job.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [get_job_with_app_count(job, db) for job in jobs]


# ────────────────────── READ (archived list) ──────────────────────

@router.get(
    "/archived",
    response_model=List[JobRead],
    summary="List archived jobs",
)
def list_archived_jobs(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    """List all archived jobs."""
    jobs = (
        db.query(Job)
        .filter(Job.archived == True)
        .order_by(Job.archived_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [get_job_with_app_count(job, db) for job in jobs]


# ────────────────────── FILTER OPTIONS (dynamic) ──────────────────────

@router.get(
    "/filter-options",
    summary="Get dynamic filter options from database",
)
def get_filter_options(db: Session = Depends(get_db)):
    """Get unique values for filter dropdowns from the database."""
    companies = db.query(Job.company).filter(Job.company.isnot(None)).distinct().all()
    statuses = db.query(Job.status).filter(Job.status.isnot(None)).distinct().all()
    priorities = db.query(Job.priority).filter(Job.priority.isnot(None)).distinct().all()
    departments = db.query(Job.department).filter(Job.department.isnot(None)).distinct().all()
    categories = db.query(Job.category).filter(Job.category.isnot(None)).distinct().all()
    employment_types = db.query(Job.employment_type).filter(Job.employment_type.isnot(None)).distinct().all()
    
    return {
        "companies": [c[0] for c in companies if c[0]],
        "statuses": ["DRAFT", "POSTED", "HOLD", "CLOSED"],  # Standard statuses
        "priorities": [p[0] for p in priorities if p[0]] or ["High", "Normal", "Low"],
        "departments": [d[0] for d in departments if d[0]],
        "categories": [c[0] for c in categories if c[0]],
        "employment_types": [e[0] for e in employment_types if e[0]] or [
            "Full Time", "Part Time", "Contract", "Temporary", "Temp to Perm"
        ],
    }


# ────────────────────── PUBLIC JOBS (for candidate portal) ──────────────────────

@router.get(
    "/public",
    response_model=List[JobRead],
    summary="List published jobs for public viewing",
)
def list_public_jobs(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    """List all POSTED jobs for the public job search portal (excludes HOLD and CLOSED)."""
    jobs = (
        db.query(Job)
        .filter(Job.archived == False)
        .filter(Job.status == "POSTED")
        .order_by(Job.posted_date.desc().nullslast(), Job.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    print(f"[JOB_PROJECTS] Public jobs returned: {len(jobs)}")
    return [get_job_with_app_count(job, db) for job in jobs]


# ────────────────────── SEARCH (must be before /{job_id}) ──────────────────────

@router.get(
    "/search",
    response_model=List[JobRead],
    summary="Search posted jobs with filters",
)
def search_jobs(
    q: Optional[str] = None,
    location: Optional[str] = None,
    salary_min: Optional[float] = None,
    salary_max: Optional[float] = None,
    employment_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
):
    """Search posted jobs by title/company, location, salary, and type."""
    query = (
        db.query(Job)
        .filter(Job.archived == False)
        .filter(Job.status == "POSTED")
    )
    if q:
        pattern = f"%{q}%"
        query = query.filter(
            (Job.job_title.ilike(pattern)) | (Job.company.ilike(pattern))
        )
    if location:
        query = query.filter(Job.location.ilike(f"%{location}%"))
    if salary_min is not None:
        query = query.filter(Job.salary_start >= salary_min)
    if salary_max is not None:
        query = query.filter(Job.salary_end <= salary_max)
    if employment_type:
        types = [t.strip() for t in employment_type.split(",")]
        query = query.filter(Job.employment_type.in_(types))

    jobs = (
        query.order_by(Job.posted_date.desc().nullslast(), Job.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [get_job_with_app_count(job, db) for job in jobs]


# ────────────────────── JOB ANALYTICS (must be before /{job_id}) ──────────────────────

@router.get("/analytics", summary="Job pipeline analytics")
def get_job_analytics(db: Session = Depends(get_db)):
    from .models import Job, JobApplication
    total = db.query(func.count(Job.id)).scalar() or 0
    by_status = {}
    for row in db.query(Job.status, func.count(Job.id)).group_by(Job.status).all():
        by_status[row[0] or 'UNKNOWN'] = row[1]
    posted = by_status.get('POSTED', 0)
    draft = by_status.get('DRAFT', 0)
    hold = by_status.get('HOLD', 0)
    closed = by_status.get('CLOSED', 0)
    total_applications = db.query(func.count(JobApplication.id)).scalar() or 0
    avg_apps = round(total_applications / posted, 1) if posted > 0 else 0
    return {
        "total_jobs": total,
        "posted": posted,
        "draft": draft,
        "on_hold": hold,
        "closed": closed,
        "total_applications": total_applications,
        "avg_applications_per_job": avg_apps,
        "by_status": by_status,
    }

# ────────────────────── EXCEL EXPORT (must be before /{job_id}) ──────────────────────

@router.get(
    "/export/excel",
    summary="Export jobs to Excel",
)
def export_jobs_to_excel_route(
    db: Session = Depends(get_db),
):
    """Export all active jobs to an Excel file with colored headers."""
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="openpyxl library not installed. Run: pip install openpyxl",
        )
    
    # Get all active jobs
    jobs = db.query(Job).filter(Job.archived == False).order_by(Job.created_at.desc()).all()
    
    # Create workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "jobs_export"
    
    # Define headers (Feature 8 specification)
    headers = [
        "Position", "JB_Link", "Company", "Department", "Assignee",
        "Opened_At", "Opened_Days", "Status", "Categories", "Priority",
        "Longlist", "Contacted", "Screening", "Interview", "Offer", "Hired"
    ]
    
    # Header styles
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True, size=11)
    header_alignment = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Write headers
    for col, header in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
        cell.border = thin_border
    
    # Write data rows
    for row_idx, job in enumerate(jobs, start=2):
        # Calculate opened days
        opened_days = 0
        if job.created_at:
            opened_days = (datetime.now(timezone.utc) - job.created_at).days
        
        # Get applications count for pipeline metrics
        app_count = db.query(func.count(JobApplication.id)).filter(JobApplication.job_id == job.id).scalar() or 0
        
        row_data = [
            job.job_title or "",
            job.job_id or "",
            job.company or "",
            job.department or "",
            "",  # Assignee - not implemented yet
            job.created_at.strftime("%Y-%m-%d %H:%M:%S") if job.created_at else "",
            opened_days,
            job.status.lower() if job.status else "",
            job.category or "",
            job.priority.lower() if job.priority else "",
            app_count,  # Longlist
            0,  # Contacted
            0,  # Screening
            0,  # Interview
            0,  # Offer
            0,  # Hired
        ]
        
        for col, value in enumerate(row_data, start=1):
            cell = ws.cell(row=row_idx, column=col, value=value)
            cell.border = thin_border
            cell.alignment = Alignment(horizontal="left", vertical="center")
    
    # Auto-adjust column widths
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column].width = adjusted_width
    
    # Save to bytes
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    # Generate filename with date
    filename = f"jobs_export_{datetime.now().strftime('%Y_%m_%d_%H_%M')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ────────────────────── FILTER OPTIONS ENDPOINTS ──────────────────────

@router.get(
    "/filters/job-titles",
    summary="Get distinct job titles for filter dropdown",
)
def get_filter_job_titles(db: Session = Depends(get_db)):
    """Get unique job titles from the database for filter suggestions."""
    titles = db.query(Job.job_title).filter(Job.job_title.isnot(None)).distinct().all()
    return {"success": True, "data": sorted([t[0] for t in titles if t[0]])}


@router.get(
    "/filters/companies",
    summary="Get distinct companies for filter dropdown",
)
def get_filter_companies(db: Session = Depends(get_db)):
    """Get unique company names from the database for filter suggestions."""
    companies = db.query(Job.company).filter(Job.company.isnot(None)).distinct().all()
    return {"success": True, "data": sorted([c[0] for c in companies if c[0]])}


@router.get(
    "/filters/locations",
    summary="Get distinct locations for filter dropdown",
)
def get_filter_locations(db: Session = Depends(get_db)):
    """Get unique locations from the database for filter suggestions."""
    locations = db.query(Job.location).filter(Job.location.isnot(None)).distinct().all()
    # Parse locations that might contain multiple values (pipe or comma separated)
    all_locations = set()
    for loc in locations:
        if loc[0]:
            # Split by pipe first (new format), then fall back to raw value
            if ' | ' in loc[0]:
                for l in loc[0].split(' | '):
                    cleaned = l.strip()
                    if cleaned:
                        all_locations.add(cleaned)
            else:
                cleaned = loc[0].strip()
                if cleaned:
                    all_locations.add(cleaned)
    return {"success": True, "data": sorted(list(all_locations))}


@router.get(
    "/filters/departments",
    summary="Get distinct departments for filter dropdown",
)
def get_filter_departments(db: Session = Depends(get_db)):
    """Get unique departments from the database for filter suggestions."""
    departments = db.query(Job.department).filter(Job.department.isnot(None)).distinct().all()
    return {"success": True, "data": sorted([d[0] for d in departments if d[0]])}


@router.get(
    "/filters/categories",
    summary="Get distinct categories for filter dropdown",
)
def get_filter_categories(db: Session = Depends(get_db)):
    """Get unique categories from the database for filter suggestions."""
    categories = db.query(Job.category).filter(Job.category.isnot(None)).distinct().all()
    return {"success": True, "data": sorted([c[0] for c in categories if c[0]])}


@router.get(
    "/filters/skills",
    summary="Get distinct skills for filter dropdown",
)
def get_filter_skills(db: Session = Depends(get_db)):
    """Get unique skills from the database for filter suggestions."""
    skills_rows = db.query(Job.skills).filter(Job.skills.isnot(None)).distinct().all()
    # Parse skills separated by pipe or comma
    all_skills = set()
    for row in skills_rows:
        if row[0]:
            sep = ' | ' if ' | ' in row[0] else ','
            for skill in row[0].split(sep):
                cleaned = skill.strip()
                if cleaned:
                    all_skills.add(cleaned)
    return {"success": True, "data": sorted(list(all_skills))}


# ────────────────────── APPLICATIONS (GET single - must be before /{job_id}) ──────────────────────

@router.get(
    "/applications/{application_id}",
    response_model=JobApplicationRead,
    summary="Get a single application",
)
def get_application_route(application_id: uuid.UUID, db: Session = Depends(get_db)):
    """Get a single job application by ID."""
    application = db.query(JobApplication).filter(JobApplication.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {application_id} not found",
        )
    return application


@router.delete(
    "/applications/{application_id}",
    summary="Delete an application",
)
def delete_application_route(application_id: uuid.UUID, db: Session = Depends(get_db)):
    """Delete a job application and remove its resume file if stored."""
    application = db.query(JobApplication).filter(JobApplication.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {application_id} not found",
        )

    # Delete resume file if exists
    if application.resume_url:
        resume_file = Path(application.resume_url.lstrip("/"))
        if resume_file.exists():
            try:
                resume_file.unlink()
            except Exception as e:
                print(f"Warning: Could not delete resume file: {e}")

    db.delete(application)
    db.commit()
    return {"message": "Application deleted successfully"}


# ────────────────────── BULK DELETE (Issue 2 - must be before /{job_id}) ──────────────────────

from pydantic import BaseModel as PydanticBaseModel
from typing import List as PyList

class BulkDeleteRequest(PydanticBaseModel):
    job_ids: PyList[uuid.UUID]

@router.post(
    "/bulk-delete",
    summary="Bulk delete multiple jobs permanently (Issue 2)",
)
def bulk_delete_jobs(request: BulkDeleteRequest, db: Session = Depends(get_db)):
    """Permanently delete multiple jobs from the database.
    
    This action cannot be undone. All associated applications will also be deleted.
    """
    deleted_count = 0
    failed_ids = []

    for job_id in request.job_ids:
        try:
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job:
                failed_ids.append(str(job_id))
                continue

            # Delete photo file if exists
            if job.photo_url:
                old_file = Path(job.photo_url.lstrip("/"))
                if old_file.exists():
                    try:
                        old_file.unlink()
                    except Exception as e:
                        print(f"Warning: Could not delete photo file for job {job_id}: {e}")

            # Explicitly delete all FK-referencing rows first using raw SQL so SQLAlchemy
            # never issues a SELECT on those tables (avoids missing-column 500 errors).
            from sqlalchemy import text as sa_text
            db.execute(sa_text("DELETE FROM job_applications WHERE job_id = :jid"), {"jid": str(job_id)})
            db.execute(sa_text("DELETE FROM saved_jobs WHERE job_id = :jid"), {"jid": str(job_id)})

            db.delete(job)
            deleted_count += 1
        except Exception as e:
            print(f"[ERROR] Could not stage delete for job {job_id}: {e}")
            failed_ids.append(str(job_id))

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Bulk delete commit failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete jobs: {str(e)}",
        )

    return {
        "message": f"Successfully deleted {deleted_count} job(s)",
        "deleted_count": deleted_count,
        "failed_ids": failed_ids,
        "success": True
    }


# ────────────────────── READ (single) ──────────────────────

@router.get(
    "/{job_id}",
    response_model=JobRead,
    summary="Get a single job by ID",
)
def get_job(job_id: uuid.UUID, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    return get_job_with_app_count(job, db)


# ────────────────────── UPDATE ──────────────────────

@router.put(
    "/{job_id}",
    response_model=JobRead,
    summary="Update an existing job",
)
async def update_job(
    job_id: uuid.UUID,
    job_title: Optional[str] = Form(None),
    company: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    priority: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    open_positions: Optional[int] = Form(None),
    reason: Optional[str] = Form(None),
    currency: Optional[str] = Form(None),
    salary_start: Optional[str] = Form(None),
    salary_end: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    employment_type: Optional[str] = Form(None),
    experience: Optional[str] = Form(None),
    skills: Optional[str] = Form(None),
    required_qualification: Optional[str] = Form(None),
    job_description: Optional[str] = Form(None),
    comments: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    remove_photo: Optional[str] = Form(None),  # Feature 10: Flag to remove photo
    db: Session = Depends(get_db),
):
    """Update an existing job with optional photo upload."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )

    # Feature 10: Handle photo removal
    if remove_photo == "true" or remove_photo == "1":
        if job.photo_url:
            old_file = Path(job.photo_url.lstrip("/"))
            if old_file.exists():
                try:
                    old_file.unlink()
                except Exception as e:
                    print(f"Warning: Could not delete old photo file: {e}")
        job.photo_url = None
    # Handle new file upload if provided
    elif photo and photo.filename:
        # Generate unique filename
        file_ext = Path(photo.filename).suffix or ".jpg"
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = UPLOAD_DIR / unique_filename
        
        # Save file to disk
        with open(file_path, "wb") as f:
            content = await photo.read()
            f.write(content)
        
        # Delete old file if exists
        if job.photo_url:
            old_file = Path(job.photo_url.lstrip("/"))
            if old_file.exists():
                try:
                    old_file.unlink()
                except Exception as e:
                    print(f"Warning: Could not delete old photo file: {e}")
        
        # Update photo_url
        job.photo_url = f"/uploads/jobs/{unique_filename}"
    
    # Update other fields if provided
    if job_title is not None: job.job_title = job_title
    if company is not None: job.company = company
    if location is not None: job.location = location
    if priority is not None: job.priority = priority
    if status is not None: job.status = status
    if department is not None: job.department = department
    if open_positions is not None: job.open_positions = open_positions
    if reason is not None: job.reason = reason
    if currency is not None: job.currency = currency
    if salary_start is not None: job.salary_start = salary_start
    if salary_end is not None: job.salary_end = salary_end
    if category is not None: job.category = category
    if employment_type is not None: job.employment_type = employment_type
    if experience is not None: job.experience = experience
    if skills is not None: job.skills = skills
    if required_qualification is not None: job.required_qualification = required_qualification
    if job_description is not None: job.job_description = job_description
    if comments is not None: job.comments = comments

    db.commit()
    db.refresh(job)
    return get_job_with_app_count(job, db)


# ────────────────────── ARCHIVE ──────────────────────

@router.post(
    "/{job_id}/archive",
    response_model=JobRead,
    summary="Archive a job",
)
def archive_job(job_id: uuid.UUID, db: Session = Depends(get_db)):
    """Move a job to the archive."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    
    job.archived = True
    job.archived_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(job)
    return get_job_with_app_count(job, db)


# ────────────────────── RESTORE ──────────────────────

@router.post(
    "/{job_id}/restore",
    response_model=JobRead,
    summary="Restore a job from archive",
)
def restore_job(job_id: uuid.UUID, db: Session = Depends(get_db)):
    """Restore a job from the archive back to active jobs.
    
    Sets status to POSTED (not CLOSED) so the job is visible again.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    
    job.archived = False
    job.archived_at = None
    # Reset status to POSTED when restoring (Issue 5)
    job.status = "POSTED"
    job.closed_at = None
    job.held_at = None
    
    db.commit()
    db.refresh(job)
    return get_job_with_app_count(job, db)


# ────────────────────── DUPLICATE (Copy Job) ──────────────────────

@router.post(
    "/{job_id}/duplicate",
    response_model=JobRead,
    status_code=status.HTTP_201_CREATED,
    summary="Copy a job (create duplicate)",
)
def duplicate_job(job_id: uuid.UUID, db: Session = Depends(get_db)):
    """Create a copy of an existing job with '[Copy]' prepended to the title."""
    original = db.query(Job).filter(Job.id == job_id).first()
    if not original:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    
    # Create a new job with copied data
    new_job = Job(
        job_title=f"[Copy] {original.job_title}",
        company=original.company,
        location=original.location,
        priority=original.priority,
        status="DRAFT",  # Reset status for the new job
        department=original.department,
        open_positions=original.open_positions,
        reason=original.reason,
        currency=original.currency,
        salary_start=original.salary_start,
        salary_end=original.salary_end,
        category=original.category,
        employment_type=original.employment_type,
        experience=original.experience,  # Include experience field
        skills=original.skills,
        required_qualification=original.required_qualification,
        job_description=original.job_description,
        comments=original.comments,
        photo_url=original.photo_url,  # Keep same photo
        archived=False,
        archived_at=None,
    )
    
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return get_job_with_app_count(new_job, db)


# ────────────────────── HOLD (Feature 3) ──────────────────────

@router.post(
    "/{job_id}/hold",
    response_model=JobRead,
    summary="Put a job on hold",
)
def hold_job(job_id: uuid.UUID, db: Session = Depends(get_db)):
    """Put a job on hold - removes from public listings but keeps all data."""
    print(f"[JOB_PROJECTS] HOLD request received for job {job_id}")
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    job.status = "HOLD"
    job.held_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    print(f"[JOB_PROJECTS] Job {job_id} is now on HOLD")
    return get_job_with_app_count(job, db)


# ────────────────────── UNHOLD (Resume Job - Feature 3) ──────────────────────

@router.post(
    "/{job_id}/unhold",
    response_model=JobRead,
    summary="Resume a held job",
)
def unhold_job(job_id: uuid.UUID, db: Session = Depends(get_db)):
    """Resume a job from hold status back to DRAFT."""
    print(f"[JOB_PROJECTS] UNHOLD request received for job {job_id}")
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    job.status = "DRAFT"
    job.held_at = None
    db.commit()
    db.refresh(job)
    print(f"[JOB_PROJECTS] Job {job_id} resumed from HOLD")
    return get_job_with_app_count(job, db)


# ────────────────────── CLOSE (Feature 4) ──────────────────────

@router.post(
    "/{job_id}/close",
    response_model=JobRead,
    summary="Close a job",
)
def close_job(job_id: uuid.UUID, db: Session = Depends(get_db)):
    """Close a job - moves to closed status but keeps all candidate data."""
    print(f"[JOB_PROJECTS] CLOSE request received for job {job_id}")
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    job.status = "CLOSED"
    job.closed_at = datetime.now(timezone.utc)
    # Also archive it
    job.archived = True
    job.archived_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    print(f"[JOB_PROJECTS] Job {job_id} is now CLOSED")
    return get_job_with_app_count(job, db)


# ────────────────────── DRAFT AUTOSAVE (Feature 2) ──────────────────────

@router.post(
    "/{job_id}/draft",
    response_model=JobRead,
    summary="Autosave draft",
)
async def save_draft(
    job_id: uuid.UUID,
    job_title: Optional[str] = Form(None),
    company: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    priority: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    open_positions: Optional[int] = Form(None),
    reason: Optional[str] = Form(None),
    currency: Optional[str] = Form(None),
    salary_start: Optional[str] = Form(None),
    salary_end: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    employment_type: Optional[str] = Form(None),
    experience: Optional[str] = Form(None),
    skills: Optional[str] = Form(None),
    required_qualification: Optional[str] = Form(None),
    job_description: Optional[str] = Form(None),
    comments: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Autosave draft - saves form data without changing status."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    
    # Update fields if provided
    if job_title is not None: job.job_title = job_title
    if company is not None: job.company = company
    if location is not None: job.location = location
    if priority is not None: job.priority = priority
    if department is not None: job.department = department
    if open_positions is not None: job.open_positions = open_positions
    if reason is not None: job.reason = reason
    if currency is not None: job.currency = currency
    if salary_start is not None: job.salary_start = salary_start
    if salary_end is not None: job.salary_end = salary_end
    if category is not None: job.category = category
    if employment_type is not None: job.employment_type = employment_type
    if experience is not None: job.experience = experience
    if skills is not None: job.skills = skills
    if required_qualification is not None: job.required_qualification = required_qualification
    if job_description is not None: job.job_description = job_description
    if comments is not None: job.comments = comments
    
    # Mark as draft autosave
    job.draft_saved_at = datetime.now(timezone.utc)
    job.is_draft_autosave = True
    
    db.commit()
    db.refresh(job)
    return get_job_with_app_count(job, db)


# ────────────────────── CREATE DRAFT (Feature 2) ──────────────────────

@router.post(
    "/draft",
    response_model=JobRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new draft job",
)
async def create_draft(
    job_title: str = Form("Untitled Draft"),
    company: str = Form(""),
    location: str = Form(""),
    priority: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    open_positions: Optional[int] = Form(None),
    reason: Optional[str] = Form(None),
    currency: Optional[str] = Form(None),
    salary_start: Optional[str] = Form(None),
    salary_end: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    employment_type: Optional[str] = Form(None),
    experience: Optional[str] = Form(None),
    skills: Optional[str] = Form(None),
    required_qualification: Optional[str] = Form(None),
    job_description: Optional[str] = Form(None),
    comments: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Create a new draft job for autosave."""
    job = Job(
        job_title=job_title or "Untitled Draft",
        company=company or "",
        location=location or "",
        priority=priority,
        status="DRAFT",
        department=department,
        open_positions=open_positions,
        reason=reason,
        currency=currency,
        salary_start=salary_start,
        salary_end=salary_end,
        category=category,
        employment_type=employment_type,
        experience=experience,
        skills=skills,
        required_qualification=required_qualification,
        job_description=job_description,
        comments=comments,
        job_id=generate_job_id(),
        is_draft_autosave=True,
        draft_saved_at=datetime.now(timezone.utc),
    )
    
    db.add(job)
    db.commit()
    db.refresh(job)
    return get_job_with_app_count(job, db)


# ────────────────────── POST (publish) ──────────────────────

@router.post(
    "/{job_id}/post",
    response_model=JobRead,
    summary="Post a job to public",
)
def post_job(job_id: uuid.UUID, db: Session = Depends(get_db)):
    """Set job status to POSTED so it appears on the public portal."""
    print(f"[JOB_PROJECTS] POST request received for job {job_id}")
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    job.status = "POSTED"
    job.posted_date = datetime.now(timezone.utc)
    job.is_draft_autosave = False  # Clear draft flag when posting
    db.commit()
    db.refresh(job)
    print(f"[JOB_PROJECTS] Job {job_id} updated to POSTED")
    return get_job_with_app_count(job, db)


# ────────────────────── UNPOST (unpublish) ──────────────────────

@router.post(
    "/{job_id}/unpost",
    response_model=JobRead,
    summary="Unpost a job from public",
)
def unpost_job(job_id: uuid.UUID, db: Session = Depends(get_db)):
    """Set job status back to DRAFT so it is removed from the public portal."""
    print(f"[JOB_PROJECTS] UNPOST request received for job {job_id}")
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    job.status = "DRAFT"
    db.commit()
    db.refresh(job)
    print(f"[JOB_PROJECTS] Job {job_id} updated to DRAFT")
    return get_job_with_app_count(job, db)


# ────────────────────── DELETE (Soft Delete - Archives) ──────────────────────

@router.delete(
    "/{job_id}",
    response_model=JobRead,
    summary="Delete a job (moves to archive)",
)
def delete_job(job_id: uuid.UUID, db: Session = Depends(get_db)):
    """Delete a job by moving it to archive. This is a soft delete - job can be restored.
    
    Feature 1: Delete button now archives instead of permanently deleting.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    
    # Soft delete - move to archive
    job.archived = True
    job.archived_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(job)
    return get_job_with_app_count(job, db)


# ────────────────────── PERMANENT DELETE ──────────────────────

@router.delete(
    "/{job_id}/permanent",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Permanently delete a job",
)
def delete_job_permanently(job_id: uuid.UUID, db: Session = Depends(get_db)):
    """Permanently delete a job from the database. This action cannot be undone."""
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        # Delete photo file if exists
        if job.photo_url:
            old_file = Path(job.photo_url.lstrip("/"))
            if old_file.exists():
                try:
                    old_file.unlink()
                except Exception as e:
                    print(f"Warning: Could not delete photo file: {e}")

        # Explicitly delete all FK-referencing rows with raw SQL so SQLAlchemy
        # never issues a SELECT on those tables (avoids missing-column 500 errors).
        from sqlalchemy import text as sa_text
        db.execute(sa_text("DELETE FROM job_applications WHERE job_id = :jid"), {"jid": str(job_id)})
        db.execute(sa_text("DELETE FROM saved_jobs WHERE job_id = :jid"), {"jid": str(job_id)})
        db.delete(job)
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to permanently delete job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete job: {str(e)}",
        )


# ────────────────────── PERMANENT DELETE (alternate path) ──────────────────────

@router.delete(
    "/{job_id}/permanent-delete",
    summary="Permanently delete a job (Issue 1)",
)
def delete_job_permanently_alt(job_id: uuid.UUID, db: Session = Depends(get_db)):
    """Permanently delete a job from the database. This action cannot be undone.

    This is an alternate endpoint path for frontend compatibility.
    Returns JSON response instead of 204 No Content.
    """
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        # Delete photo file if exists
        if job.photo_url:
            old_file = Path(job.photo_url.lstrip("/"))
            if old_file.exists():
                try:
                    old_file.unlink()
                except Exception as e:
                    print(f"Warning: Could not delete photo file: {e}")

        # Store job title for response
        job_title = job.job_title

        # Explicitly delete all FK-referencing rows with raw SQL so SQLAlchemy
        # never issues a SELECT on those tables (avoids missing-column 500 errors).
        from sqlalchemy import text as sa_text
        db.execute(sa_text("DELETE FROM job_applications WHERE job_id = :jid"), {"jid": str(job_id)})
        db.execute(sa_text("DELETE FROM saved_jobs WHERE job_id = :jid"), {"jid": str(job_id)})
        db.delete(job)
        db.commit()
        print(f"[JOB_PROJECTS] Job '{job_title}' ({job_id}) permanently deleted")
        return {"message": f"Job '{job_title}' permanently deleted", "success": True}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to permanently delete job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete job: {str(e)}",
        )


# ────────────────────── JOB APPLICATIONS (Feature 11) ──────────────────────

def _app_to_dict(app: JobApplication) -> dict:
    """Convert a JobApplication ORM object to a response dict with all fields.
    Handles both new-style and legacy column names.
    """
    # Resolve first/last name from multiple sources
    first = app.first_name or ""
    last = app.last_name or ""
    # Derive from candidate_name if new fields are empty
    if not first and not last and app.candidate_name:
        parts = app.candidate_name.strip().split(" ", 1)
        first = parts[0]
        last = parts[1] if len(parts) > 1 else ""

    # Resolve email/phone from new or legacy columns
    email = app.candidate_email or app.email or ""
    phone = app.candidate_phone or app.phone or ""

    # Resolve education/citizenship/experience from new or legacy columns
    education = app.education or app.qualification or ""
    citizenship = app.citizenship or app.work_authorization or ""
    experience = app.experience
    if experience is None and app.tech_experience:
        try:
            experience = int(float(app.tech_experience))
        except (ValueError, TypeError):
            experience = None

    # Resolve status and applied_at from new or legacy columns
    app_status = app.application_status or app.status or "applied"
    applied_ts = app.applied_at or app.submitted_at

    return {
        "application_id": str(app.id),
        "id": str(app.id),
        "job_id": str(app.job_id),
        "first_name": first,
        "last_name": last,
        "candidate_name": app.candidate_name,
        "email": email,
        "candidate_email": email,
        "phone": phone,
        "candidate_phone": phone,
        "address": app.address or "",
        "education": education,
        "citizenship": citizenship,
        "experience": experience,
        "linkedin_url": app.linkedin_url or "",
        "tech_experience": app.tech_experience or "",
        "domain_expert": app.domain_expert or "",
        "resume_file": app.resume_url or "",
        "resume_url": app.resume_url or "",
        "resume_filename": app.resume_filename or "",
        "application_status": app_status,
        "submitted_at": (app.submitted_at or app.applied_at).isoformat() if (app.submitted_at or app.applied_at) else None,
        "applied_at": applied_ts.isoformat() if applied_ts else None,
        "created_at": app.applied_at.isoformat() if app.applied_at else None,
        "updated_at": app.updated_at.isoformat() if app.updated_at else None,
    }


@router.get(
    "/{job_id}/applications/count",
    summary="Get count of applications for a job",
)
def get_job_applications_count(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Get the count of applications for a specific job."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    count = db.query(func.count(JobApplication.id)).filter(JobApplication.job_id == job_id).scalar() or 0
    return {"count": count}


@router.get(
    "/{job_id}/applications",
    summary="Get applications for a job",
)
def get_job_applications(
    job_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Get all applications for a specific job. Returns real database data only."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )

    applications = (
        db.query(JobApplication)
        .filter(JobApplication.job_id == job_id)
        .order_by(JobApplication.applied_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_app_to_dict(app) for app in applications]


@router.post(
    "/{job_id}/applications",
    status_code=status.HTTP_201_CREATED,
    summary="Create job application",
)
async def create_job_application(
    job_id: uuid.UUID,
    first_name: str = Form(...),
    last_name: str = Form(...),
    candidate_email: str = Form(...),
    candidate_phone: str = Form(...),
    address: Optional[str] = Form(None),
    education: Optional[str] = Form(None),
    citizenship: Optional[str] = Form(None),
    experience: Optional[str] = Form(None),
    linkedin_url: Optional[str] = Form(None),
    tech_experience: Optional[str] = Form(None),
    domain_expert: Optional[str] = Form(None),
    resume: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    """Submit a job application. Validates job, prevents duplicates, saves all candidate fields."""
    # Validate job exists
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )

    # Validate required fields
    if not first_name.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="first_name is required")
    if not last_name.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="last_name is required")
    if not candidate_email.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="email is required")
    if not candidate_phone.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="phone is required")
    # Phone must be digits only, 10-15 characters
    import re as _re
    _phone_digits = _re.sub(r'\D', '', candidate_phone.strip())
    if not _phone_digits or len(_phone_digits) < 10 or len(_phone_digits) > 15:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid phone number. Must contain 10-15 digits.")

    # Prevent duplicate applications (same email + same job)
    existing = db.query(JobApplication).filter(
        JobApplication.job_id == job_id,
        JobApplication.candidate_email == candidate_email.strip(),
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This candidate has already applied for this job",
        )

    # Parse experience to integer
    exp_int = None
    if experience is not None and experience.strip():
        try:
            exp_int = int(float(experience.strip()))
        except (ValueError, TypeError):
            exp_int = None

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

    application = JobApplication(
        job_id=job_id,
        candidate_name=f"{first_name.strip()} {last_name.strip()}",
        candidate_email=candidate_email.strip(),
        candidate_phone=candidate_phone.strip(),
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        address=address,
        education=education,
        citizenship=citizenship,
        experience=exp_int,
        linkedin_url=linkedin_url,
        tech_experience=tech_experience,
        domain_expert=domain_expert,
        resume_url=resume_url,
        resume_filename=resume_filename,
    )

    db.add(application)
    db.commit()
    db.refresh(application)
    return {"message": "Application submitted successfully", "application_id": str(application.id)}
