"""
FastAPI router — Interview Scheduling CRUD + analytics endpoints.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc, asc, extract

from .database import get_db
from .models import Interview, InterviewPanel, InterviewerAvailability, InterviewFeedback
from .schemas import (
    InterviewCreate, InterviewUpdate, InterviewRead, InterviewListRead,
    PanelMemberCreate, PanelMemberRead,
    FeedbackCreate, FeedbackRead,
    AvailabilityCreate, AvailabilityRead,
    InterviewAnalytics,
)

router = APIRouter(prefix="/api/interviews", tags=["Interviews"])


def _get_username(request: Request) -> str:
    try:
        from auth import decode_token
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            payload = decode_token(auth_header[7:])
            return payload.get("sub", "Unknown")
    except Exception:
        pass
    return "Unknown"


def _generate_meeting_link(platform: str = "zoom") -> str:
    meeting_id = str(uuid.uuid4())[:8]
    links = {
        "zoom": f"https://zoom.us/j/{meeting_id}",
        "teams": f"https://teams.microsoft.com/l/meetup-join/{meeting_id}",
        "google_meet": f"https://meet.google.com/{meeting_id}",
        "webex": f"https://webex.com/meet/{meeting_id}",
    }
    return links.get(platform, links["zoom"])


# ═══════════════════════════════════════════════════
# INTERVIEW CRUD
# ═══════════════════════════════════════════════════

@router.post("", response_model=InterviewRead, status_code=status.HTTP_201_CREATED,
             summary="Schedule a new interview")
def create_interview(payload: InterviewCreate, request: Request, db: Session = Depends(get_db)):
    username = _get_username(request)

    panel_data = payload.panel_members or []
    data = payload.model_dump(exclude={"panel_members"}, exclude_unset=True)
    data["created_by"] = username

    # Auto-generate meeting link if platform provided but no link
    if data.get("meeting_platform") and not data.get("meeting_link"):
        data["meeting_link"] = _generate_meeting_link(data["meeting_platform"])
        data["meeting_id"] = str(uuid.uuid4())[:12]

    # Auto-calculate end time from duration
    if data.get("scheduled_date") and not data.get("scheduled_end"):
        dur = data.get("duration_minutes", 60)
        data["scheduled_end"] = data["scheduled_date"] + timedelta(minutes=dur)

    interview = Interview(**data)
    db.add(interview)
    db.flush()

    for pm in panel_data:
        panel = InterviewPanel(interview_id=interview.id, **pm.model_dump())
        db.add(panel)

    db.commit()
    db.refresh(interview)
    return interview


@router.get("", response_model=List[InterviewListRead], summary="List interviews")
def list_interviews(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    interview_type: Optional[str] = Query(None, alias="type"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    candidate_id: Optional[int] = Query(None),
    job_id: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("scheduled_date"),
    sort_order: Optional[str] = Query("desc"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Interview)

    if status_filter and status_filter != "all":
        query = query.filter(Interview.status == status_filter)
    if interview_type:
        query = query.filter(Interview.interview_type == interview_type)
    if candidate_id:
        query = query.filter(Interview.candidate_id == candidate_id)
    if job_id:
        try:
            query = query.filter(Interview.job_id == uuid.UUID(job_id))
        except ValueError:
            pass
    if date_from:
        try:
            query = query.filter(Interview.scheduled_date >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            query = query.filter(Interview.scheduled_date <= datetime.fromisoformat(date_to))
        except ValueError:
            pass
    if search:
        like = f"%{search}%"
        query = query.filter(or_(
            Interview.candidate_name.ilike(like),
            Interview.candidate_email.ilike(like),
            Interview.job_title.ilike(like),
        ))

    col = getattr(Interview, sort_by, Interview.scheduled_date)
    query = query.order_by(desc(col) if sort_order == "desc" else asc(col))

    return query.offset(offset).limit(limit).all()


@router.get("/analytics", response_model=InterviewAnalytics, summary="Interview analytics")
def get_analytics(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    total = db.query(func.count(Interview.id)).scalar() or 0
    scheduled = db.query(func.count(Interview.id)).filter(Interview.status == "scheduled").scalar() or 0
    completed = db.query(func.count(Interview.id)).filter(Interview.status == "completed").scalar() or 0
    cancelled = db.query(func.count(Interview.id)).filter(Interview.status == "cancelled").scalar() or 0
    no_show = db.query(func.count(Interview.id)).filter(Interview.status == "no_show").scalar() or 0

    avg_rating = db.query(func.avg(Interview.overall_rating)).filter(
        Interview.overall_rating.isnot(None)).scalar()

    passed = db.query(func.count(Interview.id)).filter(Interview.outcome == "passed").scalar() or 0
    with_outcome = db.query(func.count(Interview.id)).filter(Interview.outcome.isnot(None)).scalar() or 0
    pass_rate = (passed / with_outcome * 100) if with_outcome > 0 else None

    this_week = db.query(func.count(Interview.id)).filter(
        Interview.scheduled_date >= week_ago).scalar() or 0
    this_month = db.query(func.count(Interview.id)).filter(
        Interview.scheduled_date >= month_ago).scalar() or 0

    by_type = {}
    for row in db.query(Interview.interview_type, func.count(Interview.id)).group_by(Interview.interview_type).all():
        by_type[row[0]] = row[1]

    by_outcome = {}
    for row in db.query(Interview.outcome, func.count(Interview.id)).filter(
            Interview.outcome.isnot(None)).group_by(Interview.outcome).all():
        by_outcome[row[0]] = row[1]

    load_rows = db.query(
        InterviewPanel.interviewer_name,
        func.count(InterviewPanel.id)
    ).join(Interview).filter(
        Interview.status.in_(["scheduled", "confirmed"])
    ).group_by(InterviewPanel.interviewer_name).order_by(
        desc(func.count(InterviewPanel.id))
    ).limit(10).all()

    interviewer_load = [{"name": r[0], "count": r[1]} for r in load_rows]

    return InterviewAnalytics(
        total_interviews=total, scheduled=scheduled, completed=completed,
        cancelled=cancelled, no_show=no_show,
        avg_rating=round(float(avg_rating), 1) if avg_rating else None,
        pass_rate=round(pass_rate, 1) if pass_rate else None,
        interviews_this_week=this_week, interviews_this_month=this_month,
        by_type=by_type, by_outcome=by_outcome, interviewer_load=interviewer_load,
    )


# ═══════════════════════════════════════════════════
# AVAILABILITY (must be before /{interview_id} to avoid path conflict)
# ═══════════════════════════════════════════════════

@router.post("/availability", response_model=AvailabilityRead,
             status_code=status.HTTP_201_CREATED)
def add_availability(payload: AvailabilityCreate, db: Session = Depends(get_db)):
    avail = InterviewerAvailability(**payload.model_dump())
    db.add(avail)
    db.commit()
    db.refresh(avail)
    return avail


@router.get("/availability", response_model=List[AvailabilityRead])
def list_availability(
    email: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(InterviewerAvailability).filter(InterviewerAvailability.is_active == True)
    if email:
        query = query.filter(InterviewerAvailability.interviewer_email == email)
    if date_from:
        try:
            query = query.filter(InterviewerAvailability.available_date >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            query = query.filter(InterviewerAvailability.available_end <= datetime.fromisoformat(date_to))
        except ValueError:
            pass
    return query.order_by(asc(InterviewerAvailability.available_date)).all()


@router.delete("/availability/{avail_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_availability(avail_id: str, db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(avail_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID")
    avail = db.query(InterviewerAvailability).filter(InterviewerAvailability.id == uid).first()
    if not avail:
        raise HTTPException(status_code=404, detail="Availability slot not found")
    db.delete(avail)
    db.commit()
    return None


# ═══════════════════════════════════════════════════
# CONFLICT DETECTION (must be before /{interview_id})
# ═══════════════════════════════════════════════════

@router.get("/conflicts/check", summary="Check for scheduling conflicts")
def check_conflicts(
    interviewer_email: str = Query(...),
    start: datetime = Query(...),
    end: datetime = Query(...),
    exclude_interview_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Interview).join(InterviewPanel).filter(
        InterviewPanel.interviewer_email == interviewer_email,
        Interview.status.in_(["scheduled", "confirmed"]),
        Interview.scheduled_date < end,
        Interview.scheduled_end > start,
    )
    if exclude_interview_id:
        try:
            query = query.filter(Interview.id != uuid.UUID(exclude_interview_id))
        except ValueError:
            pass

    conflicts = query.all()
    return {
        "has_conflict": len(conflicts) > 0,
        "conflicts": [
            {
                "interview_id": str(c.id),
                "candidate_name": c.candidate_name,
                "scheduled_date": c.scheduled_date.isoformat() if c.scheduled_date else None,
                "scheduled_end": c.scheduled_end.isoformat() if c.scheduled_end else None,
            }
            for c in conflicts
        ],
    }


# ═══════════════════════════════════════════════════
# INTERVIEW DETAIL + UPDATE + DELETE (dynamic {interview_id} routes)
# ═══════════════════════════════════════════════════

@router.get("/{interview_id}", response_model=InterviewRead, summary="Get interview details")
def get_interview(interview_id: str, db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(interview_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid interview ID")
    interview = db.query(Interview).filter(Interview.id == uid).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview


@router.put("/{interview_id}", response_model=InterviewRead, summary="Update interview")
def update_interview(interview_id: str, payload: InterviewUpdate, request: Request,
                     db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(interview_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid interview ID")

    interview = db.query(Interview).filter(Interview.id == uid).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(interview, key, val)

    db.commit()
    db.refresh(interview)
    return interview


@router.delete("/{interview_id}", status_code=status.HTTP_204_NO_CONTENT,
               summary="Delete interview")
def delete_interview(interview_id: str, db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(interview_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid interview ID")
    interview = db.query(Interview).filter(Interview.id == uid).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    db.delete(interview)
    db.commit()
    return None


# ── Status transitions ──────────────────────────────

@router.post("/{interview_id}/confirm", response_model=InterviewRead)
def confirm_interview(interview_id: str, db: Session = Depends(get_db)):
    interview = _get_or_404(db, interview_id)
    interview.status = "confirmed"
    interview.candidate_notified = True
    interview.interviewer_notified = True
    db.commit()
    db.refresh(interview)
    return interview


@router.post("/{interview_id}/cancel", response_model=InterviewRead)
def cancel_interview(interview_id: str, reason: Optional[str] = Query(None),
                     db: Session = Depends(get_db)):
    interview = _get_or_404(db, interview_id)
    interview.status = "cancelled"
    interview.cancellation_reason = reason
    db.commit()
    db.refresh(interview)
    return interview


@router.post("/{interview_id}/complete", response_model=InterviewRead)
def complete_interview(interview_id: str, outcome: Optional[str] = Query(None),
                       rating: Optional[int] = Query(None),
                       db: Session = Depends(get_db)):
    interview = _get_or_404(db, interview_id)
    interview.status = "completed"
    if outcome:
        interview.outcome = outcome
    if rating:
        interview.overall_rating = rating
    db.commit()
    db.refresh(interview)
    return interview


@router.post("/{interview_id}/reschedule", response_model=InterviewRead)
def reschedule_interview(interview_id: str, new_date: datetime = Query(...),
                         new_end: Optional[datetime] = Query(None),
                         db: Session = Depends(get_db)):
    interview = _get_or_404(db, interview_id)
    interview.scheduled_date = new_date
    if new_end:
        interview.scheduled_end = new_end
    else:
        interview.scheduled_end = new_date + timedelta(minutes=interview.duration_minutes)
    interview.status = "rescheduled"
    interview.candidate_notified = False
    interview.interviewer_notified = False
    db.commit()
    db.refresh(interview)
    return interview


# ═══════════════════════════════════════════════════
# PANEL MEMBERS
# ═══════════════════════════════════════════════════

@router.post("/{interview_id}/panel", response_model=PanelMemberRead,
             status_code=status.HTTP_201_CREATED)
def add_panel_member(interview_id: str, payload: PanelMemberCreate,
                     db: Session = Depends(get_db)):
    interview = _get_or_404(db, interview_id)
    panel = InterviewPanel(interview_id=interview.id, **payload.model_dump())
    db.add(panel)
    db.commit()
    db.refresh(panel)
    return panel


@router.delete("/{interview_id}/panel/{panel_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_panel_member(interview_id: str, panel_id: str, db: Session = Depends(get_db)):
    try:
        pid = uuid.UUID(panel_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid panel member ID")
    panel = db.query(InterviewPanel).filter(InterviewPanel.id == pid).first()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel member not found")
    db.delete(panel)
    db.commit()
    return None


# ═══════════════════════════════════════════════════
# FEEDBACK
# ═══════════════════════════════════════════════════

@router.post("/{interview_id}/feedback", response_model=FeedbackRead,
             status_code=status.HTTP_201_CREATED)
def add_feedback(interview_id: str, payload: FeedbackCreate, db: Session = Depends(get_db)):
    interview = _get_or_404(db, interview_id)
    fb = InterviewFeedback(interview_id=interview.id, **payload.model_dump())
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return fb


@router.get("/{interview_id}/feedback", response_model=List[FeedbackRead])
def list_feedback(interview_id: str, db: Session = Depends(get_db)):
    interview = _get_or_404(db, interview_id)
    return db.query(InterviewFeedback).filter(
        InterviewFeedback.interview_id == interview.id
    ).order_by(desc(InterviewFeedback.created_at)).all()


# ── Helpers ────────────────────────────────────────

def _get_or_404(db: Session, interview_id: str) -> Interview:
    try:
        uid = uuid.UUID(interview_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid interview ID")
    interview = db.query(Interview).filter(Interview.id == uid).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview
