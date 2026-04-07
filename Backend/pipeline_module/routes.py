"""
FastAPI router — Interview Pipeline Kanban board endpoints.
Handles stage transitions, feedback, scorecards, and board view.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc

from .database import get_db
from .models import (
    PipelineCandidate, PipelineStageHistory, PipelineFeedback, PipelineScorecard,
    PipelineStageConfig, DEFAULT_PIPELINE_STAGES, DEFAULT_STAGE_LABELS,
    RANKING_TIERS, RANKING_LABELS,
)
from .schemas import (
    PipelineCandidateCreate, PipelineCandidateUpdate, PipelineCandidateRead,
    PipelineCandidateListRead, StageTransition, StageFeedbackCreate,
    StageFeedbackUpdate, StageConfigCreate, StageConfigUpdate, StageConfigRead,
    FeedbackRead, ScorecardRead, StageHistoryRead,
    PipelineBoardView, StageColumn, PipelineAnalytics,
)

router = APIRouter(prefix="/api/pipeline", tags=["Interview Pipeline"])


def _get_username(request: Request) -> str:
    try:
        from auth import decode_token
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            return decode_token(auth_header[7:]).get("sub", "Unknown")
    except Exception:
        pass
    return "Unknown"


def _recalc_scorecard(db: Session, pc: PipelineCandidate):
    """Recalculate scorecard from all feedback entries."""
    feedbacks = db.query(PipelineFeedback).filter(
        PipelineFeedback.pipeline_candidate_id == pc.id
    ).all()

    if not feedbacks:
        return

    def avg_field(field):
        vals = [getattr(f, field) for f in feedbacks if getattr(f, field) is not None]
        return round(sum(vals) / len(vals), 1) if vals else None

    tech = avg_field("technical_rating")
    comm = avg_field("communication_rating")
    prob = avg_field("problem_solving_rating")
    cult = avg_field("cultural_fit_rating")
    ovrl = avg_field("overall_rating")

    # Weighted final score (0-100)
    weights = [(tech, 0.30), (prob, 0.25), (comm, 0.20), (cult, 0.15), (ovrl, 0.10)]
    scored = [(v, w) for v, w in weights if v is not None]
    if scored:
        total_w = sum(w for _, w in scored)
        final = sum(v * w for v, w in scored) / total_w * 20  # Scale 1-5 to 0-100
    else:
        final = None

    # Auto-rank based on final score
    if final is not None:
        if final >= 80:
            ranking = "potential_candidate"
        elif final >= 60:
            ranking = "average"
        elif final >= 40:
            ranking = "below_average"
        elif final >= 20:
            ranking = "poor"
        else:
            ranking = "fake_or_not_recommended"
    else:
        ranking = None

    # Count unique stages with feedback
    stages_done = len(set(f.stage for f in feedbacks))

    # Upsert scorecard
    sc = db.query(PipelineScorecard).filter(
        PipelineScorecard.pipeline_candidate_id == pc.id
    ).first()
    if not sc:
        sc = PipelineScorecard(pipeline_candidate_id=pc.id)
        db.add(sc)

    sc.technical_avg = tech
    sc.communication_avg = comm
    sc.problem_solving_avg = prob
    sc.cultural_fit_avg = cult
    sc.overall_avg = ovrl
    sc.final_score = round(final, 1) if final else None
    sc.ranking = ranking
    sc.review_count = len(feedbacks)
    sc.stages_completed = stages_done

    # Update parent
    pc.overall_score = sc.final_score
    pc.ranking = ranking

    # Check recommendations for override
    recs = [f.recommendation for f in feedbacks if f.recommendation]
    if recs:
        if "fake_or_not_recommended" in recs:
            pc.ranking = "fake_or_not_recommended"
            sc.ranking = "fake_or_not_recommended"

    db.flush()


def _get_active_stages(db: Session) -> list[dict]:
    """Get stages from DB config, falling back to defaults if none configured."""
    rows = db.query(PipelineStageConfig).filter(
        PipelineStageConfig.is_active == True
    ).order_by(asc(PipelineStageConfig.stage_order)).all()
    if rows:
        return [{"stage": r.stage_key, "label": r.label, "order": r.stage_order,
                 "color": r.color, "is_terminal": r.is_terminal} for r in rows]
    return [{"stage": s, "label": DEFAULT_STAGE_LABELS[s], "order": i,
             "color": "#6366f1", "is_terminal": s == "onboarding_completed"}
            for i, s in enumerate(DEFAULT_PIPELINE_STAGES)]


def _seed_default_stages(db: Session):
    """Seed default stages if table is empty."""
    if db.query(PipelineStageConfig).count() == 0:
        colors = ["#3b82f6","#8b5cf6","#06b6d4","#f59e0b","#ef4444","#10b981","#6366f1","#059669"]
        for i, key in enumerate(DEFAULT_PIPELINE_STAGES):
            db.add(PipelineStageConfig(
                stage_key=key, label=DEFAULT_STAGE_LABELS[key],
                stage_order=i, color=colors[i] if i < len(colors) else "#6366f1",
                is_terminal=(key == "onboarding_completed"),
            ))
        db.commit()


# ═══════════════════════════════════════════════════
# STAGE CONFIGURATION (Admin)
# ═══════════════════════════════════════════════════

@router.get("/stages", summary="Get pipeline stage definitions (from DB config)")
def get_stages(db: Session = Depends(get_db)):
    _seed_default_stages(db)
    return _get_active_stages(db)


@router.get("/stages/all", response_model=List[StageConfigRead],
            summary="Get all stages including inactive (admin)")
def get_all_stages(db: Session = Depends(get_db)):
    _seed_default_stages(db)
    return db.query(PipelineStageConfig).order_by(asc(PipelineStageConfig.stage_order)).all()


@router.post("/stages", response_model=StageConfigRead,
             status_code=status.HTTP_201_CREATED, summary="Add a new pipeline stage (admin)")
def create_stage(payload: StageConfigCreate, request: Request, db: Session = Depends(get_db)):
    existing = db.query(PipelineStageConfig).filter(
        PipelineStageConfig.stage_key == payload.stage_key).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Stage '{payload.stage_key}' already exists")
    stage = PipelineStageConfig(**payload.model_dump(), created_by=_get_username(request))
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


@router.put("/stages/{stage_id}", response_model=StageConfigRead,
            summary="Update a pipeline stage (admin)")
def update_stage(stage_id: str, payload: StageConfigUpdate, db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(stage_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    stage = db.query(PipelineStageConfig).filter(PipelineStageConfig.id == uid).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(stage, k, v)
    db.commit()
    db.refresh(stage)
    return stage


@router.delete("/stages/{stage_id}", status_code=status.HTTP_204_NO_CONTENT,
               summary="Delete a pipeline stage (admin)")
def delete_stage(stage_id: str, db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(stage_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    stage = db.query(PipelineStageConfig).filter(PipelineStageConfig.id == uid).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    db.delete(stage)
    db.commit()
    return None


@router.post("/stages/reorder", summary="Reorder pipeline stages (admin)")
def reorder_stages(stage_order: List[str] = [], db: Session = Depends(get_db)):
    """Accept list of stage_keys in desired order."""
    for i, key in enumerate(stage_order):
        stage = db.query(PipelineStageConfig).filter(PipelineStageConfig.stage_key == key).first()
        if stage:
            stage.stage_order = i
    db.commit()
    return {"status": "ok", "order": stage_order}


@router.get("/rankings", summary="Get ranking tier definitions")
def get_rankings():
    return [{"key": k, "label": v} for k, v in RANKING_LABELS.items()]


# ═══════════════════════════════════════════════════
# BOARD VIEW (Kanban) — uses DB stage config
# ═══════════════════════════════════════════════════

@router.get("/board", response_model=PipelineBoardView, summary="Get Kanban board view")
def get_board(
    job_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    _seed_default_stages(db)
    stages = _get_active_stages(db)

    query = db.query(PipelineCandidate).filter(
        PipelineCandidate.is_active == True,
        PipelineCandidate.is_archived == False,
    )
    if job_id:
        try:
            query = query.filter(PipelineCandidate.job_id == uuid.UUID(job_id))
        except ValueError:
            pass
    if search:
        like = f"%{search}%"
        query = query.filter(
            PipelineCandidate.candidate_name.ilike(like) |
            PipelineCandidate.candidate_email.ilike(like) |
            PipelineCandidate.job_title.ilike(like)
        )

    all_candidates = query.order_by(asc(PipelineCandidate.updated_at)).all()

    columns = []
    total = 0
    for s in stages:
        stage_candidates = [c for c in all_candidates if c.current_stage == s["stage"]]
        columns.append(StageColumn(
            stage=s["stage"],
            label=s["label"],
            order=s["order"],
            candidates=[PipelineCandidateListRead.model_validate(c) for c in stage_candidates],
            count=len(stage_candidates),
        ))
        total += len(stage_candidates)

    return PipelineBoardView(columns=columns, total_candidates=total)


# ═══════════════════════════════════════════════════
# CANDIDATE CRUD
# ═══════════════════════════════════════════════════

@router.post("/candidates", response_model=PipelineCandidateRead,
             status_code=status.HTTP_201_CREATED,
             summary="Add candidate to pipeline")
def add_to_pipeline(payload: PipelineCandidateCreate, request: Request,
                    db: Session = Depends(get_db)):
    username = _get_username(request)

    # Check if already in pipeline for same job
    existing = db.query(PipelineCandidate).filter(
        PipelineCandidate.candidate_id == payload.candidate_id,
        PipelineCandidate.job_id == payload.job_id,
        PipelineCandidate.is_active == True,
    ).first()
    if existing:
        raise HTTPException(status_code=409,
                            detail="Candidate is already in the pipeline for this job")

    stage_idx = PIPELINE_STAGES.index(payload.current_stage) if payload.current_stage in PIPELINE_STAGES else 0

    pc = PipelineCandidate(
        **payload.model_dump(),
        stage_order=stage_idx,
        added_by=username,
    )
    db.add(pc)
    db.flush()

    # Record initial stage
    history = PipelineStageHistory(
        pipeline_candidate_id=pc.id,
        from_stage=None,
        to_stage=payload.current_stage,
        action="added",
        moved_by=username,
    )
    db.add(history)
    db.commit()
    db.refresh(pc)
    return pc


@router.get("/candidates", response_model=List[PipelineCandidateListRead],
            summary="List pipeline candidates")
def list_pipeline_candidates(
    stage: Optional[str] = Query(None),
    ranking: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(PipelineCandidate).filter(PipelineCandidate.is_active == True)
    if stage:
        query = query.filter(PipelineCandidate.current_stage == stage)
    if ranking:
        query = query.filter(PipelineCandidate.ranking == ranking)
    if search:
        like = f"%{search}%"
        query = query.filter(PipelineCandidate.candidate_name.ilike(like))
    return query.order_by(desc(PipelineCandidate.updated_at)).offset(offset).limit(limit).all()


@router.get("/candidates/{pc_id}", response_model=PipelineCandidateRead,
            summary="Get pipeline candidate detail with history + feedback + scorecard")
def get_pipeline_candidate(pc_id: str, db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(pc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    pc = db.query(PipelineCandidate).filter(PipelineCandidate.id == uid).first()
    if not pc:
        raise HTTPException(status_code=404, detail="Pipeline candidate not found")
    return pc


@router.delete("/candidates/{pc_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_pipeline(pc_id: str, db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(pc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    pc = db.query(PipelineCandidate).filter(PipelineCandidate.id == uid).first()
    if not pc:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(pc)
    db.commit()
    return None


# ═══════════════════════════════════════════════════
# STAGE TRANSITIONS (drag-and-drop backend)
# ═══════════════════════════════════════════════════

@router.post("/candidates/{pc_id}/move", response_model=PipelineCandidateRead,
             summary="Move candidate to a different stage (drag-and-drop)")
def move_candidate(pc_id: str, transition: StageTransition, request: Request,
                   db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(pc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    pc = db.query(PipelineCandidate).filter(PipelineCandidate.id == uid).first()
    if not pc:
        raise HTTPException(status_code=404, detail="Not found")

    valid_keys = [s["stage"] for s in _get_active_stages(db)]
    if transition.to_stage not in valid_keys:
        raise HTTPException(status_code=400,
                            detail=f"Invalid stage. Must be one of: {', '.join(valid_keys)}")

    username = _get_username(request)
    old_stage = pc.current_stage
    new_idx = PIPELINE_STAGES.index(transition.to_stage)

    # Record history
    history = PipelineStageHistory(
        pipeline_candidate_id=pc.id,
        from_stage=old_stage,
        to_stage=transition.to_stage,
        action=transition.action,
        notes=transition.notes,
        moved_by=username,
    )
    db.add(history)

    # Update candidate
    pc.current_stage = transition.to_stage
    pc.stage_order = new_idx
    pc.stage_status = "active"

    db.commit()
    db.refresh(pc)
    return pc


# ═══════════════════════════════════════════════════
# FEEDBACK
# ═══════════════════════════════════════════════════

@router.post("/candidates/{pc_id}/feedback", response_model=FeedbackRead,
             status_code=status.HTTP_201_CREATED,
             summary="Add stage feedback for a candidate")
def add_stage_feedback(pc_id: str, payload: StageFeedbackCreate,
                       db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(pc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    pc = db.query(PipelineCandidate).filter(PipelineCandidate.id == uid).first()
    if not pc:
        raise HTTPException(status_code=404, detail="Not found")

    fb = PipelineFeedback(pipeline_candidate_id=pc.id, **payload.model_dump())
    db.add(fb)
    db.flush()

    # Recalculate scorecard
    _recalc_scorecard(db, pc)

    db.commit()
    db.refresh(fb)
    return fb


@router.get("/candidates/{pc_id}/feedback", response_model=List[FeedbackRead])
def list_candidate_feedback(pc_id: str, db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(pc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    return db.query(PipelineFeedback).filter(
        PipelineFeedback.pipeline_candidate_id == uid
    ).order_by(desc(PipelineFeedback.created_at)).all()


@router.put("/feedback/{feedback_id}", response_model=FeedbackRead,
            summary="Edit/correct existing feedback")
def update_feedback(feedback_id: str, payload: StageFeedbackUpdate,
                    db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(feedback_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    fb = db.query(PipelineFeedback).filter(PipelineFeedback.id == uid).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(fb, k, v)
    db.flush()
    # Recalculate scorecard
    pc = db.query(PipelineCandidate).filter(PipelineCandidate.id == fb.pipeline_candidate_id).first()
    if pc:
        _recalc_scorecard(db, pc)
    db.commit()
    db.refresh(fb)
    return fb


@router.delete("/feedback/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT,
               summary="Delete feedback entry")
def delete_feedback(feedback_id: str, db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(feedback_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    fb = db.query(PipelineFeedback).filter(PipelineFeedback.id == uid).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    pc_id = fb.pipeline_candidate_id
    db.delete(fb)
    db.flush()
    pc = db.query(PipelineCandidate).filter(PipelineCandidate.id == pc_id).first()
    if pc:
        _recalc_scorecard(db, pc)
    db.commit()
    return None


# ═══════════════════════════════════════════════════
# SCORECARD
# ═══════════════════════════════════════════════════

@router.get("/candidates/{pc_id}/scorecard", response_model=Optional[ScorecardRead])
def get_scorecard(pc_id: str, db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(pc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    sc = db.query(PipelineScorecard).filter(
        PipelineScorecard.pipeline_candidate_id == uid
    ).first()
    if not sc:
        return None
    return sc


# ═══════════════════════════════════════════════════
# ANALYTICS
# ═══════════════════════════════════════════════════

@router.get("/analytics", response_model=PipelineAnalytics)
def get_pipeline_analytics(db: Session = Depends(get_db)):
    active = db.query(PipelineCandidate).filter(PipelineCandidate.is_active == True)
    total = active.count()

    by_stage = {}
    for row in active.with_entities(
        PipelineCandidate.current_stage, func.count(PipelineCandidate.id)
    ).group_by(PipelineCandidate.current_stage).all():
        by_stage[row[0]] = row[1]

    by_ranking = {}
    for row in active.filter(PipelineCandidate.ranking.isnot(None)).with_entities(
        PipelineCandidate.ranking, func.count(PipelineCandidate.id)
    ).group_by(PipelineCandidate.ranking).all():
        by_ranking[row[0]] = row[1]

    avg_score = db.query(func.avg(PipelineScorecard.final_score)).filter(
        PipelineScorecard.final_score.isnot(None)
    ).scalar()

    # Conversion rates: % that reached each stage
    conversion = {}
    if total > 0:
        for stage in PIPELINE_STAGES:
            idx = PIPELINE_STAGES.index(stage)
            count = active.filter(PipelineCandidate.stage_order >= idx).count()
            conversion[stage] = round(count / total * 100, 1)

    # Recent moves
    recent = db.query(PipelineStageHistory).order_by(
        desc(PipelineStageHistory.created_at)
    ).limit(10).all()
    recent_moves = [
        {
            "candidate_id": str(m.pipeline_candidate_id),
            "from": m.from_stage,
            "to": m.to_stage,
            "action": m.action,
            "by": m.moved_by,
            "at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in recent
    ]

    return PipelineAnalytics(
        total_in_pipeline=total,
        by_stage=by_stage,
        by_ranking=by_ranking,
        avg_score=round(float(avg_score), 1) if avg_score else None,
        conversion_rates=conversion,
        recent_moves=recent_moves,
    )
