"""
FastAPI router for /company-jobs/ endpoints.

Usage in main.py (when ready):
    from company_jobs_module import company_jobs_router
    app.include_router(company_jobs_router)
"""

from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .schemas import CompanyJobCreate, CompanyJobRead
from . import service

router = APIRouter(prefix="/company-jobs", tags=["Company Jobs"])


# ----- Endpoints -------------------------------------------------------------

@router.post(
    "/",
    response_model=CompanyJobRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new company job",
)
def create_company_job(
    payload: CompanyJobCreate,
    db: Session = Depends(get_db),
):
    return service.create_job(db, payload)


@router.get(
    "/",
    response_model=List[CompanyJobRead],
    summary="List all company jobs",
)
def list_company_jobs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return service.get_jobs(db, skip=skip, limit=limit)


@router.get(
    "/{job_id}",
    response_model=CompanyJobRead,
    summary="Get a single company job by ID",
)
def get_company_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    job = service.get_job_by_id(db, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    return job
