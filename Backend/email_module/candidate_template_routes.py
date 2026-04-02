"""
FastAPI routes for candidate-only email templates.
"""

import logging
import re
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .database import get_db
from .models import CandidateEmailTemplate
from .schemas import (
    CandidateEmailTemplateCreate,
    CandidateEmailTemplateRead,
    CandidateEmailTemplateUpdate,
    TemplatePreviewRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/candidate-templates", tags=["candidate-templates"])


def _get_username_from_request(request: Request) -> str:
    try:
        from auth import decode_token

        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            payload = decode_token(token)
            return payload.get("sub", "unknown")
    except Exception:
        pass
    return "unknown"


def _substitute_variables(text: str, data: dict) -> str:
    # Strip HTML tags from inside {{ }} placeholders (editor fragmentation)
    text = re.sub(
        r"\{\{(.*?)\}\}",
        lambda m: "{{" + re.sub(r"<[^>]*>", "", m.group(1)).strip() + "}}",
        text,
        flags=re.DOTALL,
    )

    def replacer(match):
        key = match.group(1).strip()
        # Try exact key, then lowercase, then with underscores for spaces
        val = data.get(key) or data.get(key.lower()) or data.get(key.lower().replace(" ", "_"))
        return str(val) if val is not None else match.group(0)
    return re.sub(r"\{\{(\s*[\w\s]+\s*)\}\}", replacer, text)


def _candidate_template_to_dict(t: CandidateEmailTemplate) -> dict:
    return {
        "id": str(t.id),
        "name": t.name,
        "subject": t.subject,
        "body": t.body,
        "created_by": t.created_by,
        "is_active": t.is_active,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    }


@router.post("", response_model=CandidateEmailTemplateRead, status_code=201)
def create_candidate_template(
    payload: CandidateEmailTemplateCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    username = _get_username_from_request(request)
    template = CandidateEmailTemplate(
        name=payload.name,
        subject=payload.subject,
        body=payload.body,
        created_by=username,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return _candidate_template_to_dict(template)


@router.get("", response_model=List[CandidateEmailTemplateRead])
def list_candidate_templates(db: Session = Depends(get_db)):
    templates = (
        db.query(CandidateEmailTemplate)
        .filter(CandidateEmailTemplate.is_active == True)
        .order_by(CandidateEmailTemplate.created_at.desc())
        .all()
    )
    return [_candidate_template_to_dict(t) for t in templates]


@router.get("/{template_id}", response_model=CandidateEmailTemplateRead)
def get_candidate_template(template_id: str, db: Session = Depends(get_db)):
    template = db.query(CandidateEmailTemplate).filter(
        CandidateEmailTemplate.id == uuid.UUID(template_id),
        CandidateEmailTemplate.is_active == True,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Candidate template not found")
    return _candidate_template_to_dict(template)


@router.put("/{template_id}", response_model=CandidateEmailTemplateRead)
def update_candidate_template(
    template_id: str,
    payload: CandidateEmailTemplateUpdate,
    db: Session = Depends(get_db),
):
    template = db.query(CandidateEmailTemplate).filter(
        CandidateEmailTemplate.id == uuid.UUID(template_id),
        CandidateEmailTemplate.is_active == True,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Candidate template not found")
    if payload.name is not None:
        template.name = payload.name
    if payload.subject is not None:
        template.subject = payload.subject
    if payload.body is not None:
        template.body = payload.body
    db.commit()
    db.refresh(template)
    return _candidate_template_to_dict(template)


@router.delete("/{template_id}", status_code=200)
def delete_candidate_template(template_id: str, db: Session = Depends(get_db)):
    template = db.query(CandidateEmailTemplate).filter(
        CandidateEmailTemplate.id == uuid.UUID(template_id),
        CandidateEmailTemplate.is_active == True,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Candidate template not found")
    template.is_active = False
    db.commit()
    return {"detail": "Candidate template deleted"}


@router.post("/{template_id}/preview")
def preview_candidate_template(
    template_id: str,
    payload: TemplatePreviewRequest,
    db: Session = Depends(get_db),
):
    template = db.query(CandidateEmailTemplate).filter(
        CandidateEmailTemplate.id == uuid.UUID(template_id),
        CandidateEmailTemplate.is_active == True,
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Candidate template not found")

    subject = _substitute_variables(template.subject, payload.candidate_data)
    body = _substitute_variables(template.body, payload.candidate_data)

    return {"subject": subject, "body": body}
