"""
FastAPI routes for email template management.
CRUD for templates + preview with variable substitution + contact-person mapping.
"""

import logging
import re
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from .database import get_db
from .models import EmailTemplate, ContactPersonTemplate
from .schemas import (
    EmailTemplateCreate,
    EmailTemplateRead,
    EmailTemplateUpdate,
    TemplatePreviewRequest,
    ContactPersonTemplateAssign,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email/templates", tags=["email-templates"])


def _normalize_template_type(raw: Optional[str]) -> str:
    ttype = (raw or "COMMON").upper()
    if ttype not in ("COMMON", "CANDIDATE"):
        raise HTTPException(status_code=400, detail="Invalid template type. Use COMMON or CANDIDATE")
    return ttype


def _ensure_common_template_type(raw: Optional[str]) -> str:
    ttype = _normalize_template_type(raw)
    if ttype != "COMMON":
        raise HTTPException(
            status_code=400,
            detail="Candidate templates are managed via /api/candidate-templates",
        )
    return ttype


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


# ══════════════════════════════════════════════════════════════════════════════
# TEMPLATE CRUD
# ══════════════════════════════════════════════════════════════════════════════

@router.post("", response_model=EmailTemplateRead, status_code=201)
def create_template(
    payload: EmailTemplateCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Create a new email template."""
    username = _get_username_from_request(request)
    _ensure_common_template_type(payload.type or payload.template_type)
    template = EmailTemplate(
        name=payload.name,
        subject=payload.subject,
        body=payload.body,
        template_type="COMMON",
        created_by=username,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return _template_to_dict(template)


@router.get("", response_model=List[EmailTemplateRead])
def list_templates(
    type: Optional[str] = Query(None, description="Filter by type: COMMON"),
    db: Session = Depends(get_db),
):
    """List all active email templates, optionally filtered by type."""
    q = db.query(EmailTemplate).filter(
        EmailTemplate.is_active == True,
        EmailTemplate.template_type == "COMMON",
    )
    if type:
        _ensure_common_template_type(type)
    templates = q.order_by(EmailTemplate.created_at.desc()).all()
    return [_template_to_dict(t) for t in templates]


@router.get("/{template_id}", response_model=EmailTemplateRead)
def get_template(template_id: str, db: Session = Depends(get_db)):
    """Get a single template by ID."""
    template = db.query(EmailTemplate).filter(
        EmailTemplate.id == uuid.UUID(template_id),
        EmailTemplate.is_active == True,
        EmailTemplate.template_type == "COMMON",
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return _template_to_dict(template)


@router.put("/{template_id}", response_model=EmailTemplateRead)
def update_template(
    template_id: str,
    payload: EmailTemplateUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing template."""
    template = db.query(EmailTemplate).filter(
        EmailTemplate.id == uuid.UUID(template_id),
        EmailTemplate.is_active == True,
        EmailTemplate.template_type == "COMMON",
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if payload.name is not None:
        template.name = payload.name
    if payload.subject is not None:
        template.subject = payload.subject
    if payload.body is not None:
        template.body = payload.body
    if payload.type is not None or payload.template_type is not None:
        _ensure_common_template_type(payload.type or payload.template_type)
        template.template_type = "COMMON"
    db.commit()
    db.refresh(template)
    return _template_to_dict(template)


@router.delete("/{template_id}", status_code=200)
def delete_template(template_id: str, db: Session = Depends(get_db)):
    """Soft-delete a template (set is_active=False)."""
    template = db.query(EmailTemplate).filter(
        EmailTemplate.id == uuid.UUID(template_id),
        EmailTemplate.is_active == True,
        EmailTemplate.template_type == "COMMON",
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    template.is_active = False
    db.commit()
    return {"detail": "Template deleted"}


# ══════════════════════════════════════════════════════════════════════════════
# TEMPLATE PREVIEW (variable substitution)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/{template_id}/preview")
def preview_template(
    template_id: str,
    payload: TemplatePreviewRequest,
    db: Session = Depends(get_db),
):
    """Substitute {{variables}} with candidate data and return filled subject + body."""
    template = db.query(EmailTemplate).filter(
        EmailTemplate.id == uuid.UUID(template_id),
        EmailTemplate.is_active == True,
        EmailTemplate.template_type == "COMMON",
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    subject = _substitute_variables(template.subject, payload.candidate_data)
    body = _substitute_variables(template.body, payload.candidate_data)

    return {"subject": subject, "body": body}


def _substitute_variables(text: str, data: dict) -> str:
    """Replace all {{key}} placeholders with values from data dict."""
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


# ══════════════════════════════════════════════════════════════════════════════
# CONTACT-PERSON ↔ TEMPLATE MAPPING
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/contact-person/{cp_id}")
def get_cp_templates(cp_id: str, db: Session = Depends(get_db)):
    """List all templates mapped to a contact person."""
    mappings = (
        db.query(ContactPersonTemplate)
        .filter(ContactPersonTemplate.contact_person_id == uuid.UUID(cp_id))
        .all()
    )
    template_ids = [m.template_id for m in mappings]
    if not template_ids:
        return []

    templates = (
        db.query(EmailTemplate)
        .filter(
            EmailTemplate.id.in_(template_ids),
            EmailTemplate.is_active == True,
            EmailTemplate.template_type == "COMMON",
        )
        .all()
    )
    return [_template_to_dict(t) for t in templates]


@router.post("/contact-person/{cp_id}", status_code=201)
def assign_cp_template(
    cp_id: str,
    payload: ContactPersonTemplateAssign,
    db: Session = Depends(get_db),
):
    """Assign a template to a contact person."""
    # Check template exists
    template = db.query(EmailTemplate).filter(
        EmailTemplate.id == uuid.UUID(payload.template_id),
        EmailTemplate.is_active == True,
        EmailTemplate.template_type == "COMMON",
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Check for duplicate
    existing = db.query(ContactPersonTemplate).filter(
        ContactPersonTemplate.contact_person_id == uuid.UUID(cp_id),
        ContactPersonTemplate.template_id == uuid.UUID(payload.template_id),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Template already assigned")

    mapping = ContactPersonTemplate(
        contact_person_id=uuid.UUID(cp_id),
        template_id=uuid.UUID(payload.template_id),
    )
    db.add(mapping)
    db.commit()
    return {"detail": "Template assigned"}


@router.delete("/contact-person/{cp_id}/{template_id}", status_code=200)
def unassign_cp_template(
    cp_id: str,
    template_id: str,
    db: Session = Depends(get_db),
):
    """Remove a template mapping from a contact person."""
    mapping = db.query(ContactPersonTemplate).filter(
        ContactPersonTemplate.contact_person_id == uuid.UUID(cp_id),
        ContactPersonTemplate.template_id == uuid.UUID(template_id),
    ).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    db.delete(mapping)
    db.commit()
    return {"detail": "Template unassigned"}


def _template_to_dict(t: EmailTemplate) -> dict:
    template_type = getattr(t, "template_type", "COMMON") or "COMMON"
    return {
        "id": str(t.id),
        "name": t.name,
        "subject": t.subject,
        "body": t.body,
        "type": template_type,
        "template_type": template_type,
        "created_by": t.created_by,
        "is_active": t.is_active,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    }
