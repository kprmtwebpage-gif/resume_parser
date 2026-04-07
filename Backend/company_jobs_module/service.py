"""Service layer for company_jobs_module."""

import uuid
from typing import List, Optional

from sqlalchemy.orm import Session

from .models import CompanyJob
from .schemas import CompanyJobCreate


def create_job(db: Session, payload: CompanyJobCreate) -> CompanyJob:
    job = CompanyJob(**payload.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_jobs(db: Session, skip: int = 0, limit: int = 100) -> List[CompanyJob]:
    return (
        db.query(CompanyJob)
        .order_by(CompanyJob.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_job_by_id(db: Session, job_id: uuid.UUID) -> Optional[CompanyJob]:
    return db.query(CompanyJob).filter(CompanyJob.id == job_id).first()
