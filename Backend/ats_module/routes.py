"""
FastAPI router — ATS Job-Candidate Matching endpoints.
"""
from __future__ import annotations

import uuid
import time
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc, text

from .database import get_db
from .models import ATSMatchResult, ATSAnalysisConfig, ATSAnalysisRun
from .matcher import score_candidate
from .schemas import (
    MatchResultRead, AnalysisConfigCreate, AnalysisConfigUpdate,
    AnalysisConfigRead, AnalysisRunRead, AnalyzeRequest, JobMatchSummary,
)

router = APIRouter(prefix="/api/ats", tags=["ATS Matching"])


def _get_username(request: Request) -> str:
    try:
        from auth import decode_token
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            return decode_token(auth[7:]).get("sub", "Unknown")
    except Exception:
        pass
    return "Unknown"


def _run_analysis(db: Session, job_id: uuid.UUID, triggered_by: str = "manual",
                  trigger_type: str = "manual"):
    """
    Core analysis: score ALL active candidates against a specific job.
    Stores results in ats_match_results, logs the run.
    """
    start_time = time.time()

    # Get job data using raw SQL (jobs table uses different ORM base)
    job_row = db.execute(
        text("SELECT id, job_title, company, skills, location, employment_type, "
             "required_qualification, job_description, experience, status "
             "FROM jobs WHERE id = :jid"),
        {"jid": str(job_id)}
    ).mappings().first()

    if not job_row:
        raise HTTPException(status_code=404, detail="Job not found")

    if job_row["status"] not in ("POSTED", "DRAFT", "HOLD"):
        raise HTTPException(status_code=400, detail="Job is not active")

    job = dict(job_row)

    # Get config (or use defaults)
    config = db.query(ATSAnalysisConfig).filter(
        ATSAnalysisConfig.job_id == job_id
    ).first()

    min_threshold = config.min_score_threshold if config else 40

    # Get all candidates with skills
    candidates = db.execute(text(
        "SELECT cp.id, cp.first_name, cp.last_name, cp.email, cp.phone, "
        "cp.address, cp.qualification, "
        "csp.job_title, csp.tech_skills, csp.years_of_experience, csp.certifications "
        "FROM candidate_profile cp "
        "LEFT JOIN candidate_skills_profile csp ON csp.candidate_id = cp.id "
        "WHERE cp.resume_parse_status = 'completed' "
        "AND cp.first_name IS NOT NULL AND cp.first_name != ''"
    )).mappings().all()

    # Check which candidates already applied
    applied_ids = set()
    app_rows = db.execute(text(
        "SELECT DISTINCT candidate_email FROM job_applications WHERE job_id = :jid"
    ), {"jid": str(job_id)}).all()
    applied_emails = {r[0].lower() for r in app_rows if r[0]}

    # Create analysis run log
    run = ATSAnalysisRun(
        job_id=job_id,
        job_title=job.get("job_title"),
        trigger_type=trigger_type,
        triggered_by=triggered_by,
        status="running",
    )
    db.add(run)
    db.flush()

    # Delete old results for this job
    db.query(ATSMatchResult).filter(ATSMatchResult.job_id == job_id).delete()
    db.flush()

    # Score each candidate
    results = []
    best_count = 0
    good_count = 0

    for cand in candidates:
        cand_dict = dict(cand)
        skills_dict = {
            "job_title": cand_dict.get("job_title"),
            "tech_skills": cand_dict.get("tech_skills"),
            "years_of_experience": cand_dict.get("years_of_experience"),
            "certifications": cand_dict.get("certifications"),
        }

        scores = score_candidate(job, cand_dict, skills_dict, config)

        if scores["overall_score"] < min_threshold:
            continue

        is_applied = (cand_dict.get("email") or "").lower() in applied_emails

        match = ATSMatchResult(
            job_id=job_id,
            candidate_id=cand_dict["id"],
            overall_score=scores["overall_score"],
            skills_score=scores["skills_score"],
            experience_score=scores["experience_score"],
            location_score=scores["location_score"],
            education_score=scores["education_score"],
            title_score=scores["title_score"],
            match_tier=scores["match_tier"],
            job_title=job.get("job_title"),
            candidate_name=scores["candidate_name"],
            candidate_email=scores["candidate_email"],
            candidate_skills=scores["candidate_skills"],
            matched_skills=scores["matched_skills"],
            missing_skills=scores["missing_skills"],
            is_applied=is_applied,
            analysis_run_id=run.id,
        )
        db.add(match)
        results.append(match)

        if scores["match_tier"] == "best_match":
            best_count += 1
        elif scores["match_tier"] == "good_match":
            good_count += 1

    duration = round(time.time() - start_time, 2)

    # Update run log
    run.candidates_analyzed = len(candidates)
    run.matches_found = len(results)
    run.best_matches = best_count
    run.good_matches = good_count
    run.duration_seconds = duration
    run.status = "completed"

    # Update config
    if config:
        config.last_run_at = datetime.now(timezone.utc)
        config.total_matches = len(results)

    db.commit()

    return {
        "run_id": str(run.id),
        "job_id": str(job_id),
        "job_title": job.get("job_title"),
        "candidates_analyzed": len(candidates),
        "matches_found": len(results),
        "best_matches": best_count,
        "good_matches": good_count,
        "duration_seconds": duration,
    }


# ═══════════════════════════════════════════════════
# ANALYSIS TRIGGER
# ═══════════════════════════════════════════════════

@router.post("/analyze", summary="Run candidate-job matching analysis")
def analyze_job(payload: AnalyzeRequest, request: Request, db: Session = Depends(get_db)):
    username = _get_username(request)

    # Check if results exist and are recent (skip if not force_refresh)
    if not payload.force_refresh:
        existing = db.query(ATSMatchResult).filter(
            ATSMatchResult.job_id == payload.job_id
        ).first()
        if existing:
            return {
                "status": "cached",
                "message": "Results already exist. Use force_refresh=true to re-analyze.",
                "job_id": str(payload.job_id),
            }

    return _run_analysis(db, payload.job_id, triggered_by=username, trigger_type="manual")


@router.post("/analyze-all", summary="Run analysis for all enabled auto-run jobs")
def analyze_all_jobs(request: Request, db: Session = Depends(get_db)):
    username = _get_username(request)
    configs = db.query(ATSAnalysisConfig).filter(
        ATSAnalysisConfig.is_enabled == True,
        ATSAnalysisConfig.auto_run == True,
    ).all()

    results = []
    for cfg in configs:
        try:
            r = _run_analysis(db, cfg.job_id, triggered_by=username, trigger_type="auto")
            results.append(r)
        except Exception as e:
            results.append({"job_id": str(cfg.job_id), "error": str(e)})

    return {"jobs_analyzed": len(results), "results": results}


# ═══════════════════════════════════════════════════
# MATCH RESULTS
# ═══════════════════════════════════════════════════

@router.get("/matches/{job_id}", response_model=List[MatchResultRead],
            summary="Get match results for a job")
def get_matches(
    job_id: str,
    tier: Optional[str] = Query(None, description="best_match, good_match, partial_match, low_match"),
    min_score: Optional[int] = Query(None),
    applied_only: Optional[bool] = Query(None),
    shortlisted_only: Optional[bool] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    try:
        jid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID")

    query = db.query(ATSMatchResult).filter(ATSMatchResult.job_id == jid)
    if tier:
        query = query.filter(ATSMatchResult.match_tier == tier)
    if min_score:
        query = query.filter(ATSMatchResult.overall_score >= min_score)
    if applied_only:
        query = query.filter(ATSMatchResult.is_applied == True)
    if shortlisted_only:
        query = query.filter(ATSMatchResult.is_shortlisted == True)

    return query.order_by(desc(ATSMatchResult.overall_score)).offset(offset).limit(limit).all()


@router.get("/matches/{job_id}/summary", response_model=JobMatchSummary,
            summary="Get match summary stats for a job")
def get_match_summary(job_id: str, db: Session = Depends(get_db)):
    try:
        jid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID")

    results = db.query(ATSMatchResult).filter(ATSMatchResult.job_id == jid).all()

    # Get job title
    job_row = db.execute(text("SELECT job_title FROM jobs WHERE id = :jid"),
                          {"jid": str(jid)}).first()
    title = job_row[0] if job_row else None

    config = db.query(ATSAnalysisConfig).filter(ATSAnalysisConfig.job_id == jid).first()

    return JobMatchSummary(
        job_id=jid,
        job_title=title,
        total_candidates=len(results),
        best_matches=sum(1 for r in results if r.match_tier == "best_match"),
        good_matches=sum(1 for r in results if r.match_tier == "good_match"),
        partial_matches=sum(1 for r in results if r.match_tier == "partial_match"),
        low_matches=sum(1 for r in results if r.match_tier == "low_match"),
        applied=sum(1 for r in results if r.is_applied),
        shortlisted=sum(1 for r in results if r.is_shortlisted),
        last_analyzed=config.last_run_at if config else None,
        is_auto_enabled=config.auto_run if config else False,
    )


@router.patch("/matches/{match_id}/shortlist", summary="Toggle shortlist status")
def toggle_shortlist(match_id: str, db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(match_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    m = db.query(ATSMatchResult).filter(ATSMatchResult.id == uid).first()
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    m.is_shortlisted = not m.is_shortlisted
    db.commit()
    return {"id": str(m.id), "is_shortlisted": m.is_shortlisted}


# ═══════════════════════════════════════════════════
# ANALYSIS CONFIG (Admin)
# ═══════════════════════════════════════════════════

@router.get("/config", response_model=List[AnalysisConfigRead],
            summary="List all analysis configs")
def list_configs(db: Session = Depends(get_db)):
    return db.query(ATSAnalysisConfig).order_by(desc(ATSAnalysisConfig.updated_at)).all()


@router.get("/config/{job_id}", response_model=Optional[AnalysisConfigRead],
            summary="Get analysis config for a job")
def get_config(job_id: str, db: Session = Depends(get_db)):
    try:
        jid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    return db.query(ATSAnalysisConfig).filter(ATSAnalysisConfig.job_id == jid).first()


@router.post("/config", response_model=AnalysisConfigRead,
             status_code=status.HTTP_201_CREATED, summary="Create analysis config for a job")
def create_config(payload: AnalysisConfigCreate, request: Request,
                  db: Session = Depends(get_db)):
    existing = db.query(ATSAnalysisConfig).filter(
        ATSAnalysisConfig.job_id == payload.job_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Config already exists for this job")
    cfg = ATSAnalysisConfig(**payload.model_dump(), created_by=_get_username(request))
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg


@router.put("/config/{config_id}", response_model=AnalysisConfigRead,
            summary="Update analysis config")
def update_config(config_id: str, payload: AnalysisConfigUpdate,
                  db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(config_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    cfg = db.query(ATSAnalysisConfig).filter(ATSAnalysisConfig.id == uid).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Config not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(cfg, k, v)
    db.commit()
    db.refresh(cfg)
    return cfg


@router.delete("/config/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_config(config_id: str, db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(config_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    cfg = db.query(ATSAnalysisConfig).filter(ATSAnalysisConfig.id == uid).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Config not found")
    db.delete(cfg)
    db.commit()
    return None


# ═══════════════════════════════════════════════════
# ANALYSIS RUNS (History)
# ═══════════════════════════════════════════════════

@router.get("/runs", response_model=List[AnalysisRunRead],
            summary="List recent analysis runs")
def list_runs(
    job_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(ATSAnalysisRun)
    if job_id:
        try:
            query = query.filter(ATSAnalysisRun.job_id == uuid.UUID(job_id))
        except ValueError:
            pass
    return query.order_by(desc(ATSAnalysisRun.created_at)).limit(limit).all()


# ═══════════════════════════════════════════════════
# DASHBOARD
# ═══════════════════════════════════════════════════

@router.get("/dashboard", summary="ATS overview dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    total_matches = db.query(func.count(ATSMatchResult.id)).scalar() or 0
    best = db.query(func.count(ATSMatchResult.id)).filter(
        ATSMatchResult.match_tier == "best_match").scalar() or 0
    good = db.query(func.count(ATSMatchResult.id)).filter(
        ATSMatchResult.match_tier == "good_match").scalar() or 0
    shortlisted = db.query(func.count(ATSMatchResult.id)).filter(
        ATSMatchResult.is_shortlisted == True).scalar() or 0

    jobs_analyzed = db.query(func.count(func.distinct(ATSMatchResult.job_id))).scalar() or 0
    auto_configs = db.query(func.count(ATSAnalysisConfig.id)).filter(
        ATSAnalysisConfig.auto_run == True).scalar() or 0
    total_runs = db.query(func.count(ATSAnalysisRun.id)).scalar() or 0

    return {
        "total_matches": total_matches,
        "best_matches": best,
        "good_matches": good,
        "shortlisted": shortlisted,
        "jobs_analyzed": jobs_analyzed,
        "auto_configs": auto_configs,
        "total_runs": total_runs,
    }
