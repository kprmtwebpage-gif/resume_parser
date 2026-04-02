"""
API-compatible workflow endpoints for templates and profile submission email flow.

Provides:
- GET  /api/templates?type=COMMON
- POST /api/templates
- POST /api/send-email

Candidate templates are managed via:
- GET  /api/candidate-templates
- POST /api/candidate-templates
"""

import json
import os
import re
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from customer_module.models import ContactPerson

from .database import engine, get_db
from .models import EmailTemplate, CandidateEmailTemplate
from .routes import send_email as send_email_legacy
from .schemas import (
    EmailSendRequest,
    EmailTemplateCreate,
    EmailTemplateRead,
    WorkflowSendEmailRequest,
)
from .template_routes import _template_to_dict, _normalize_template_type

router = APIRouter(prefix="/api", tags=["email-workflow"])

_VALID_TABLE_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


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


def _normalize_recipient_type(raw: str) -> str:
    rtype = (raw or "").strip().lower()
    if rtype not in ("client", "vendor", "own_company", "candidate"):
        raise HTTPException(
            status_code=400,
            detail="Invalid recipientType. Use client, vendor, own_company, or candidate",
        )
    return rtype


def _candidate_table_name() -> str:
    table_name = os.getenv("NEW_CANDIDATES_TABLE", "candidate_profile")
    if not _VALID_TABLE_RE.match(table_name):
        raise HTTPException(status_code=500, detail="Invalid candidate table configuration")
    return table_name


def _fetch_candidate(candidate_id: int) -> dict:
    table_name = _candidate_table_name()
    with engine.connect() as conn:
        row = conn.execute(
            text(f"SELECT * FROM {table_name} WHERE id = :candidate_id"),
            {"candidate_id": candidate_id},
        ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return dict(row)


def _stringify(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value)
    return str(value)


def _extract_skills(value) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return ", ".join(str(v) for v in value if v)
    if isinstance(value, dict):
        return ", ".join(str(v) for v in value.values() if v)
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return ""
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                return ", ".join(str(v) for v in parsed if v)
            if isinstance(parsed, dict):
                return ", ".join(str(v) for v in parsed.values() if v)
        except Exception:
            pass
        return s
    return str(value)


def _candidate_template_vars(candidate: dict) -> dict:
    first_name = _stringify(candidate.get("first_name"))
    last_name = _stringify(candidate.get("last_name"))
    full_name = " ".join(v for v in [first_name, last_name] if v).strip() or _stringify(candidate.get("candidate_name"))

    return {
        "candidate_name": full_name,
        "phone": _stringify(candidate.get("phone")),
        "email": _stringify(candidate.get("email")),
        "location": _stringify(candidate.get("location") or candidate.get("address")),
        "experience": _stringify(candidate.get("experience")),
        "us_experience": _stringify(candidate.get("us_experience")),
        "work_auth": _stringify(candidate.get("work_authorization") or candidate.get("visa_support")),
        "visa_validity": _stringify(candidate.get("visa_validity")),
        "linkedin": _stringify(candidate.get("linkedin")),
        "rate": _stringify(candidate.get("rate")),
        "education": _stringify(candidate.get("qualification") or candidate.get("education")),
        "passport": _stringify(candidate.get("passport")),
        "availability": _stringify(candidate.get("availability")),
        "skills": _extract_skills(candidate.get("skills")),
        "dob": _stringify(candidate.get("dob")),
        "university": _stringify(candidate.get("university")),
        "year_of_completion": _stringify(candidate.get("year_of_completion")),
        "submittal_type": _stringify(candidate.get("submittal_type")),
        "willingness_to_relocate": _stringify(candidate.get("willingness_to_relocate")),
        "ssn_last4": _stringify(candidate.get("ssn_last4")),
    }


def _fill_placeholders(text_value: str, values: dict) -> str:
    rendered = text_value or ""
    for key, value in values.items():
        rendered = re.sub(r"\{\{\s*" + re.escape(key) + r"\s*\}\}", _stringify(value), rendered, flags=re.IGNORECASE)
    return re.sub(r"\{\{\s*\w+\s*\}\}", "", rendered)


@router.get("/templates", response_model=List[EmailTemplateRead])
def list_templates_api(
    type: Optional[str] = Query(None, description="COMMON or CANDIDATE"),
    db: Session = Depends(get_db),
):
    q = db.query(EmailTemplate).filter(
        EmailTemplate.is_active == True,
        EmailTemplate.template_type == "COMMON",
    )
    if type:
        ttype = _normalize_template_type(type)
        if ttype != "COMMON":
            raise HTTPException(
                status_code=400,
                detail="Candidate templates are managed via /api/candidate-templates",
            )
    templates = q.order_by(EmailTemplate.created_at.desc()).all()
    return [_template_to_dict(t) for t in templates]


@router.post("/templates", response_model=EmailTemplateRead, status_code=201)
def create_template_api(
    payload: EmailTemplateCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    username = _get_username_from_request(request)
    template_type = _normalize_template_type(payload.type or payload.template_type)
    if template_type != "COMMON":
        raise HTTPException(
            status_code=400,
            detail="Candidate templates are managed via /api/candidate-templates",
        )

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


@router.post("/send-email")
def send_email_workflow(
    payload: WorkflowSendEmailRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    recipient_type = _normalize_recipient_type(payload.recipientType)

    try:
        template_uuid = uuid.UUID(payload.templateId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid templateId")

    if recipient_type == "candidate":
        template = db.query(CandidateEmailTemplate).filter(
            CandidateEmailTemplate.id == template_uuid,
            CandidateEmailTemplate.is_active == True,
        ).first()
        if not template:
            raise HTTPException(status_code=404, detail="Candidate template not found")
    else:
        template = db.query(EmailTemplate).filter(
            EmailTemplate.id == template_uuid,
            EmailTemplate.is_active == True,
            EmailTemplate.template_type == "COMMON",
        ).first()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

    candidate = _fetch_candidate(payload.candidateId)
    rendered_subject = _fill_placeholders(template.subject, _candidate_template_vars(candidate))
    rendered_body = _fill_placeholders(template.body, _candidate_template_vars(candidate))

    if recipient_type == "candidate":
        recipient_email = (candidate.get("email") or "").strip()
        if not recipient_email:
            raise HTTPException(status_code=400, detail="Candidate email not found")
    else:
        if not payload.companyId:
            raise HTTPException(status_code=400, detail="companyId is required for non-candidate recipient types")
        if not payload.hrId:
            raise HTTPException(status_code=400, detail="hrId is required for non-candidate recipient types")

        try:
            company_uuid = uuid.UUID(payload.companyId)
            hr_uuid = uuid.UUID(payload.hrId)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid companyId or hrId")

        contact = db.query(ContactPerson).filter(ContactPerson.id == hr_uuid).first()
        if not contact:
            raise HTTPException(status_code=404, detail="HR contact not found")
        if contact.customer_id != company_uuid:
            raise HTTPException(status_code=400, detail="Selected HR contact does not belong to selected company")
        if not contact.email:
            raise HTTPException(status_code=400, detail="Selected HR contact does not have an email")

        recipient_email = contact.email

    smtp_payload = EmailSendRequest(
        candidate_id=payload.candidateId,
        recipient_email=recipient_email,
        subject=rendered_subject,
        body=rendered_body,
        provider=payload.provider or "gmail",
    )

    return send_email_legacy(smtp_payload, request=request, db=db)
