"""
FastAPI routes for the email module.
Handles email sending, provider management, and email history.
"""

import logging
import os
import re
import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from sqlalchemy import desc
from sqlalchemy.orm import Session

from .database import get_db
from .models import EmailAccount, EmailAttachment, EmailLog, UserEmailConfig
from .schemas import (
    EmailAccountCreate,
    EmailAccountRead,
    EmailLogRead,
    EmailSendRequest,
)

load_dotenv()
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email", tags=["email"])

# ── SMTP Config ──────────────────────────────────────────────────────────────
# Gmail
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

# Outlook
OUTLOOK_SMTP_HOST = os.getenv("OUTLOOK_SMTP_HOST", "smtp.office365.com")
OUTLOOK_SMTP_PORT = int(os.getenv("OUTLOOK_SMTP_PORT", "587"))
OUTLOOK_SMTP_USER = os.getenv("OUTLOOK_SMTP_USER", "")
OUTLOOK_SMTP_PASSWORD = os.getenv("OUTLOOK_SMTP_PASSWORD", "")


def _get_smtp_config(provider: str = "gmail", db: Session = None, user_id: int = None):
    """Return (host, port, user, password) for the requested provider.

    Resolution order:
      1. Per-user DB config (user_email_configs table)
      2. Global .env fallback
    """
    # Try per-user config from DB
    if db and user_id:
        try:
            user_cfg = (
                db.query(UserEmailConfig)
                .filter(UserEmailConfig.user_id == user_id, UserEmailConfig.is_active == True)
                .first()
            )
            if user_cfg:
                if provider == "outlook" and user_cfg.outlook_email and user_cfg.outlook_password:
                    return OUTLOOK_SMTP_HOST, OUTLOOK_SMTP_PORT, user_cfg.outlook_email, user_cfg.outlook_password
                if user_cfg.gmail_email and user_cfg.gmail_password:
                    return SMTP_HOST, SMTP_PORT, user_cfg.gmail_email, user_cfg.gmail_password
        except Exception as e:
            logger.warning("Failed to load user email config: %s", e)

    # Fallback to global .env config
    if provider == "outlook" and OUTLOOK_SMTP_USER and OUTLOOK_SMTP_PASSWORD:
        return OUTLOOK_SMTP_HOST, OUTLOOK_SMTP_PORT, OUTLOOK_SMTP_USER, OUTLOOK_SMTP_PASSWORD
    # Default to Gmail
    return SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD


# ── Startup diagnostic ──────────────────────────────────────────────────────
if SMTP_USER and SMTP_PASSWORD:
    logger.info("[EMAIL] Gmail SMTP configured — user: %s, host: %s:%s", SMTP_USER, SMTP_HOST, SMTP_PORT)
else:
    logger.warning("[EMAIL] Gmail SMTP NOT configured — SMTP_USER or SMTP_PASSWORD is empty.")

if OUTLOOK_SMTP_USER and OUTLOOK_SMTP_PASSWORD:
    logger.info("[EMAIL] Outlook SMTP configured — user: %s, host: %s:%s", OUTLOOK_SMTP_USER, OUTLOOK_SMTP_HOST, OUTLOOK_SMTP_PORT)
else:
    logger.warning("[EMAIL] Outlook SMTP NOT configured — OUTLOOK_SMTP_USER or OUTLOOK_SMTP_PASSWORD is empty.")

# ── Upload config ────────────────────────────────────────────────────────────
UPLOAD_DIR = Path(os.getenv("EMAIL_ATTACHMENTS_DIR", "uploads/email_attachments"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_ATTACHMENTS = 5


# ── Gmail-safe HTML formatter ────────────────────────────────────────────────
def _format_email_html(body_html: str) -> str:
    """Wrap editor HTML in a Gmail/Outlook-compatible email structure.

    Email clients strip <style> blocks, CSS classes, data-* attributes, and
    <div> wrappers.  Everything must use inline styles and table-based layout.

    This function:
      - Removes TipTap wrapper divs (tableWrapper)
      - Removes <colgroup> blocks
      - Strips data-* attributes
      - Adds border/cellpadding attributes to content tables
      - Injects inline styles on td/th while preserving existing background-color
      - Inlines font + color on <p>, <h1>-<h3>, <li>, <a> tags
      - Wraps in centered 800px outer table for consistent rendering
      - Converts multiple spaces to &nbsp;

    NOTE: If the frontend already sent a fully-processed email document
    (i.e. prepareEmailHtml() ran on the client side), the HTML will start
    with <!DOCTYPE html> or contain <html …>.  In that case skip all regex
    processing to avoid double-wrapping and just return it as-is.
    """
    stripped = body_html.lstrip()
    if stripped.lower().startswith('<!doctype html') or '<html' in stripped[:200].lower():
        # Already a complete email-safe HTML document from the frontend pipeline.
        return body_html

    h = body_html

    # ── Clean up editor artifacts ───────────────────────────────────────
    # Remove TipTap wrapper <div class="tableWrapper">
    h = re.sub(r'<div\s+class="tableWrapper"[^>]*>(.*?)</div>', r'\1', h, flags=re.IGNORECASE | re.DOTALL)

    # Remove <colgroup> blocks (Gmail ignores them)
    h = re.sub(r'<colgroup[^>]*>.*?</colgroup>', '', h, flags=re.IGNORECASE | re.DOTALL)

    # Remove data-* attributes
    h = re.sub(r'\s+data-[\w-]+="[^"]*"', '', h)

    # Remove table-layout:fixed (TipTap artifact — causes tiny columns in email)
    h = re.sub(r'table-layout\s*:\s*fixed\s*;?', '', h, flags=re.IGNORECASE)
    # Remove min-width constraints from TipTap cells
    h = re.sub(r'min-width\s*:\s*\d+px\s*;?', '', h, flags=re.IGNORECASE)

    # ── Tables ──────────────────────────────────────────────────────────
    _FONT = 'font-family:Arial,Helvetica,sans-serif;font-size:14px;'

    def _fix_table(m):
        tag = m.group(0)
        if 'cellpadding' not in tag:
            tag = tag.replace('<table', '<table cellpadding="8"', 1)
        if 'cellspacing' not in tag:
            tag = tag.replace('<table', '<table cellspacing="0"', 1)
        if 'border' not in tag:
            tag = tag.replace('<table', '<table border="1"', 1)
        if 'width=' not in tag.lower():
            tag = tag.replace('<table', '<table width="100%"', 1)
        base = f'border-collapse:collapse;width:100%;{_FONT}'
        if 'style="' in tag:
            tag = tag.replace('style="', f'style="{base}', 1)
        else:
            tag = tag.replace('<table', f'<table style="{base}"', 1)
        return tag

    h = re.sub(r'<table[^>]*>', _fix_table, h, flags=re.IGNORECASE)

    # ── TD: border + padding, PRESERVE existing inline styles ───────────
    def _fix_td(m):
        tag = m.group(0)
        base = 'border:1px solid #000;padding:8px;word-break:break-word;vertical-align:top;'
        if 'style="' in tag:
            # Prepend our base styles before the existing ones so existing
            # background-color, color, text-align, etc. are preserved at the end
            tag = tag.replace('style="', f'style="{base}', 1)
        elif "style='" in tag:
            tag = tag.replace("style='", f"style='{base}", 1)
        else:
            tag = tag.replace('<td', f'<td style="{base}"', 1)
        return tag

    h = re.sub(r'<td[^>]*>', _fix_td, h, flags=re.IGNORECASE)

    # ── TH ──────────────────────────────────────────────────────────────
    def _fix_th(m):
        tag = m.group(0)
        base = 'border:1px solid #000;padding:8px;font-weight:bold;word-break:break-word;vertical-align:top;'
        if 'background' not in tag.lower():
            base += 'background-color:#f2f2f2;'
        if 'style="' in tag:
            tag = tag.replace('style="', f'style="{base}', 1)
        elif "style='" in tag:
            tag = tag.replace("style='", f"style='{base}", 1)
        else:
            tag = tag.replace('<th', f'<th style="{base}"', 1)
        return tag

    h = re.sub(r'<th[^>]*>', _fix_th, h, flags=re.IGNORECASE)

    # ── Paragraphs: inline font + preserve text-align / color ───────────
    def _fix_p(m):
        tag = m.group(0)
        base = f'{_FONT}margin:0 0 8px 0;line-height:1.6;'
        if 'style="' in tag:
            tag = tag.replace('style="', f'style="{base}', 1)
        elif "style='" in tag:
            tag = tag.replace("style='", f"style='{base}", 1)
        else:
            tag = tag.replace('<p', f'<p style="{base}"', 1)
        return tag

    h = re.sub(r'<p[^>]*>', _fix_p, h, flags=re.IGNORECASE)

    # ── Headings ────────────────────────────────────────────────────────
    def _fix_heading(m):
        tag_name = m.group(1).lower()
        tag = m.group(0)
        sizes = {'h1': '24px', 'h2': '20px', 'h3': '16px'}
        size = sizes.get(tag_name, '16px')
        base = f'{_FONT}font-size:{size};font-weight:bold;margin:0 0 10px 0;line-height:1.4;'
        if 'style="' in tag:
            tag = tag.replace('style="', f'style="{base}', 1)
        elif "style='" in tag:
            tag = tag.replace("style='", f"style='{base}", 1)
        else:
            tag = tag.replace(f'<{m.group(1)}', f'<{m.group(1)} style="{base}"', 1)
        return tag

    h = re.sub(r'<(h[1-3])[^>]*>', _fix_heading, h, flags=re.IGNORECASE)

    # ── List items ──────────────────────────────────────────────────────
    def _fix_li(m):
        tag = m.group(0)
        base = f'{_FONT}line-height:1.6;'
        if 'style="' not in tag and "style='" not in tag:
            tag = tag.replace('<li', f'<li style="{base}"', 1)
        return tag

    h = re.sub(r'<li[^>]*>', _fix_li, h, flags=re.IGNORECASE)

    # ── Links: keep color, add underline ────────────────────────────────
    def _fix_a(m):
        tag = m.group(0)
        base = 'color:#2563eb;text-decoration:underline;'
        if 'style="' not in tag and "style='" not in tag:
            tag = tag.replace('<a', f'<a style="{base}"', 1)
        return tag

    h = re.sub(r'<a\s[^>]*>', _fix_a, h, flags=re.IGNORECASE)

    # ── Preserve multiple spaces (Gmail collapses them) ─────────────────
    h = re.sub(r'  +', lambda m: '&nbsp;' * len(m.group(0)), h)

    # ── Wrap in outer email-safe structure ──────────────────────────────
    return f"""\
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;{_FONT}line-height:1.6;color:#1e293b;background-color:#ffffff;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;padding:0;background-color:#ffffff;">
<tr><td align="center" style="padding:16px;">
<table width="800" cellpadding="0" cellspacing="0" border="0" style="max-width:800px;width:100%;">
<tr><td align="left" style="{_FONT}line-height:1.6;color:#1e293b;">
{h}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""


def _get_username_from_request(request: Request) -> str:
    """Extract username from JWT token in request."""
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


def _get_user_id_from_request(request: Request) -> Optional[int]:
    """Look up user_id by decoding JWT username, since token doesn't carry user_id."""
    try:
        from auth import decode_token, get_user_by_username
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            payload = decode_token(token)
            username = payload.get("sub")
            if username:
                user = get_user_by_username(username)
                if user:
                    return user.get("id") or user.get("user_id")
    except Exception as e:
        logger.warning("Failed to extract user_id from request: %s", e)
    return None


# ══════════════════════════════════════════════════════════════════════════════
# EMAIL PROVIDER MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/provider", response_model=EmailAccountRead, status_code=201)
def register_email_provider(
    payload: EmailAccountCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Register or update an email provider for the current user."""
    user_id = _get_user_id_from_request(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Check if provider already registered
    existing = (
        db.query(EmailAccount)
        .filter(
            EmailAccount.user_id == user_id,
            EmailAccount.provider == payload.provider,
        )
        .first()
    )

    if existing:
        existing.email_address = payload.email_address or existing.email_address
        existing.access_token = payload.access_token or existing.access_token
        existing.refresh_token = payload.refresh_token or existing.refresh_token
        existing.is_active = True
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing

    account = EmailAccount(
        user_id=user_id,
        provider=payload.provider,
        email_address=payload.email_address,
        access_token=payload.access_token,
        refresh_token=payload.refresh_token,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.get("/provider", response_model=List[EmailAccountRead])
def get_email_providers(
    request: Request,
    db: Session = Depends(get_db),
):
    """Get all registered email providers for the current user."""
    user_id = _get_user_id_from_request(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    accounts = (
        db.query(EmailAccount)
        .filter(EmailAccount.user_id == user_id, EmailAccount.is_active == True)
        .all()
    )
    return accounts


@router.get("/provider/check")
def check_email_provider(
    request: Request,
    db: Session = Depends(get_db),
):
    """Check if user has any registered email provider. Returns provider info or null."""
    user_id = _get_user_id_from_request(request)
    logger.info("Provider check — user_id resolved: %s", user_id)
    if not user_id:
        # Still return false instead of 401 so frontend can show provider modal
        return {"has_provider": False, "provider": None}

    account = (
        db.query(EmailAccount)
        .filter(EmailAccount.user_id == user_id, EmailAccount.is_active == True)
        .first()
    )

    if account:
        logger.info("Found provider %s for user %s", account.provider, user_id)
        return {
            "has_provider": True,
            "provider": account.provider,
            "email_address": account.email_address,
        }
    logger.info("No provider found for user %s", user_id)
    return {"has_provider": False, "provider": None}


# ══════════════════════════════════════════════════════════════════════════════
# SENDER INFO — tells frontend which "from" emails are available
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/sender-info")
def get_sender_info(
    request: Request,
    db: Session = Depends(get_db),
):
    """Return the configured sender emails for each provider.

    Resolution order per provider:
      1. Per-user DB config  (user_email_configs)
      2. Global .env fallback
    """
    user_id = _get_user_id_from_request(request)

    gmail_email = SMTP_USER
    outlook_email = OUTLOOK_SMTP_USER

    # Try per-user overrides
    if user_id:
        try:
            user_cfg = (
                db.query(UserEmailConfig)
                .filter(UserEmailConfig.user_id == user_id, UserEmailConfig.is_active == True)
                .first()
            )
            if user_cfg:
                if user_cfg.gmail_email:
                    gmail_email = user_cfg.gmail_email
                if user_cfg.outlook_email:
                    outlook_email = user_cfg.outlook_email
        except Exception as e:
            logger.warning("Failed to load user email config for sender-info: %s", e)

    return {
        "gmail": {
            "email": gmail_email,
            "configured": bool(gmail_email),
        },
        "outlook": {
            "email": outlook_email,
            "configured": bool(outlook_email),
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# USER EMAIL CONFIG — per-user SMTP credentials (Admin UI)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/user-config")
def get_user_email_config(
    request: Request,
    db: Session = Depends(get_db),
):
    """Get the current user's email configuration."""
    user_id = _get_user_id_from_request(request)
    if not user_id:
        return {"gmail_email": SMTP_USER, "outlook_email": OUTLOOK_SMTP_USER, "source": "env"}

    user_cfg = (
        db.query(UserEmailConfig)
        .filter(UserEmailConfig.user_id == user_id, UserEmailConfig.is_active == True)
        .first()
    )
    if user_cfg:
        return {
            "gmail_email": user_cfg.gmail_email or SMTP_USER,
            "outlook_email": user_cfg.outlook_email or OUTLOOK_SMTP_USER,
            "source": "user",
        }
    return {"gmail_email": SMTP_USER, "outlook_email": OUTLOOK_SMTP_USER, "source": "env"}


@router.post("/user-config")
def save_user_email_config(
    request: Request,
    db: Session = Depends(get_db),
    gmail_email: str = Query(None),
    gmail_password: str = Query(None),
    outlook_email: str = Query(None),
    outlook_password: str = Query(None),
):
    """Save or update per-user email SMTP credentials."""
    user_id = _get_user_id_from_request(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    existing = (
        db.query(UserEmailConfig)
        .filter(UserEmailConfig.user_id == user_id)
        .first()
    )

    if existing:
        if gmail_email is not None:
            existing.gmail_email = gmail_email
        if gmail_password is not None:
            existing.gmail_password = gmail_password
        if outlook_email is not None:
            existing.outlook_email = outlook_email
        if outlook_password is not None:
            existing.outlook_password = outlook_password
        existing.is_active = True
        existing.updated_at = datetime.now(timezone.utc)
    else:
        existing = UserEmailConfig(
            user_id=user_id,
            gmail_email=gmail_email,
            gmail_password=gmail_password,
            outlook_email=outlook_email,
            outlook_password=outlook_password,
        )
        db.add(existing)

    db.commit()
    db.refresh(existing)
    return {"status": "saved", "user_id": user_id}


# ══════════════════════════════════════════════════════════════════════════════
# SEND EMAIL
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/send")
def send_email(
    payload: EmailSendRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Send an email to a candidate and log it."""
    username = _get_username_from_request(request)
    user_id = _get_user_id_from_request(request)
    logger.info("[EMAIL SEND] to=%s, subject=%s, user=%s, provider=%s", payload.recipient_email, payload.subject, username, payload.provider)

    # Resolve SMTP config based on provider + per-user config
    smtp_host, smtp_port, smtp_user, smtp_password = _get_smtp_config(payload.provider or "gmail", db=db, user_id=user_id)

    # Fail fast if SMTP is not configured
    if not smtp_user or not smtp_password:
        logger.error("[EMAIL SEND] SMTP not configured for provider=%s", payload.provider)
        raise HTTPException(
            status_code=503,
            detail=f"Email service not configured for {payload.provider or 'gmail'}. Set SMTP credentials in the server .env file.",
        )

    # Build MIME message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = payload.subject
    msg["From"] = smtp_user
    msg["To"] = payload.recipient_email

    # Wrap body with Gmail-compatible HTML styling
    styled_body = _format_email_html(payload.body)

    msg.attach(MIMEText(styled_body, "html"))

    status = "sent"
    try:
        logger.info("[EMAIL SEND] Connecting to %s:%s ...", smtp_host, smtp_port)
        with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
            server.set_debuglevel(1)
            server.starttls()
            logger.info("[EMAIL SEND] STARTTLS OK, logging in as %s ...", smtp_user)
            server.login(smtp_user, smtp_password)
            logger.info("[EMAIL SEND] Login OK, sending to %s ...", payload.recipient_email)
            server.sendmail(smtp_user, payload.recipient_email, msg.as_string())
            logger.info("[EMAIL SEND] SMTP sendmail completed successfully")
    except smtplib.SMTPAuthenticationError as e:
        logger.error("[EMAIL SEND] SMTP authentication failed: %s", e)
        status = "failed"
    except smtplib.SMTPRecipientsRefused as e:
        logger.error("[EMAIL SEND] Recipient refused: %s", e)
        status = "failed"
    except Exception as e:
        logger.error("[EMAIL SEND] Failed to send email to %s: %s", payload.recipient_email, e)
        status = "failed"

    # Log email
    email_log = EmailLog(
        candidate_id=payload.candidate_id,
        recipient_email=payload.recipient_email,
        sender_email=smtp_user,
        subject=payload.subject,
        body=payload.body,
        provider=payload.provider or "gmail",
        direction="sent",
        status=status,
        sent_by=username,
    )
    db.add(email_log)
    db.commit()
    db.refresh(email_log)

    if status == "failed":
        raise HTTPException(
            status_code=500,
            detail="Failed to send email. Check server logs for SMTP errors.",
        )

    logger.info("[EMAIL SEND] Email delivered — id=%s, status=%s", email_log.id, status)
    return {
        "id": str(email_log.id),
        "candidate_id": email_log.candidate_id,
        "recipient_email": email_log.recipient_email,
        "sender_email": email_log.sender_email,
        "subject": email_log.subject,
        "body": email_log.body,
        "provider": email_log.provider,
        "direction": email_log.direction,
        "status": email_log.status,
        "sent_by": email_log.sent_by,
        "sent_at": email_log.sent_at.isoformat() if email_log.sent_at else None,
    }


@router.post("/send-with-attachments")
async def send_email_with_attachments(
    candidate_id: int = Query(...),
    recipient_email: str = Query(...),
    subject: str = Query(...),
    body: str = Query(...),
    provider: str = Query("gmail"),
    files: List[UploadFile] = File(default=[]),
    request: Request = None,
    db: Session = Depends(get_db),
):
    """Send an email with file attachments."""
    username = _get_username_from_request(request)
    user_id = _get_user_id_from_request(request)

    # Resolve SMTP config based on provider + per-user config
    smtp_host, smtp_port, smtp_user, smtp_password = _get_smtp_config(provider, db=db, user_id=user_id)

    if len(files) > MAX_ATTACHMENTS:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_ATTACHMENTS} attachments allowed",
        )

    # Build MIME message
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = smtp_user
    msg["To"] = recipient_email

    styled_body = _format_email_html(body)
    msg.attach(MIMEText(styled_body, "html"))

    # Create email log first
    email_log = EmailLog(
        candidate_id=candidate_id,
        recipient_email=recipient_email,
        sender_email=smtp_user,
        subject=subject,
        body=body,
        provider=provider,
        direction="sent",
        status="pending",
        sent_by=username,
    )
    db.add(email_log)
    db.flush()

    # Process attachments
    for f in files:
        contents = await f.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}' exceeds 10MB limit",
            )

        # Save file
        safe_name = f"{uuid.uuid4().hex}_{f.filename}"
        file_path = UPLOAD_DIR / safe_name
        with open(file_path, "wb") as out:
            out.write(contents)

        # Create attachment record
        attachment = EmailAttachment(
            email_log_id=email_log.id,
            file_name=f.filename,
            file_path=str(file_path),
            file_size=len(contents),
            content_type=f.content_type,
        )
        db.add(attachment)

        # Attach to MIME message
        part = MIMEBase("application", "octet-stream")
        part.set_payload(contents)
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f'attachment; filename="{f.filename}"')
        msg.attach(part)

    # Fail fast if SMTP is not configured
    if not smtp_user or not smtp_password:
        logger.error("[EMAIL SEND] SMTP not configured for provider=%s — cannot send attachment email", provider)
        raise HTTPException(
            status_code=503,
            detail=f"Email service not configured for {provider}. Set SMTP credentials in the server .env file.",
        )

    # Send
    try:
        logger.info("[EMAIL SEND+ATTACH] Connecting to %s:%s ...", smtp_host, smtp_port)
        with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
            server.set_debuglevel(1)
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, recipient_email, msg.as_string())
            logger.info("[EMAIL SEND+ATTACH] Sent OK to %s", recipient_email)
        email_log.status = "sent"
    except smtplib.SMTPAuthenticationError as e:
        logger.error("[EMAIL SEND+ATTACH] SMTP auth failed: %s", e)
        email_log.status = "failed"
    except Exception as e:
        logger.error("[EMAIL SEND+ATTACH] Failed: %s", e)
        email_log.status = "failed"

    db.commit()
    db.refresh(email_log)

    if email_log.status == "failed":
        raise HTTPException(status_code=500, detail="Failed to send email. Check server logs for SMTP errors.")

    return {
        "id": str(email_log.id),
        "candidate_id": email_log.candidate_id,
        "recipient_email": email_log.recipient_email,
        "sender_email": email_log.sender_email,
        "subject": email_log.subject,
        "body": email_log.body,
        "provider": email_log.provider,
        "direction": email_log.direction,
        "status": email_log.status,
        "sent_by": email_log.sent_by,
        "sent_at": email_log.sent_at.isoformat() if email_log.sent_at else None,
    }


# ══════════════════════════════════════════════════════════════════════════════
# EMAIL HISTORY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/history/{candidate_id}")
def get_email_history(
    candidate_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    provider: str = Query(None),
    db: Session = Depends(get_db),
):
    """Get email history for a specific candidate, optionally filtered by provider."""
    query = db.query(EmailLog).filter(EmailLog.candidate_id == candidate_id)
    if provider:
        query = query.filter(EmailLog.provider == provider)
    emails = (
        query
        .order_by(desc(EmailLog.sent_at))
        .offset(offset)
        .limit(limit)
        .all()
    )

    result = []
    for e in emails:
        result.append({
            "id": str(e.id),
            "candidate_id": e.candidate_id,
            "recipient_email": e.recipient_email,
            "sender_email": e.sender_email,
            "subject": e.subject,
            "body": e.body,
            "provider": e.provider,
            "direction": e.direction,
            "status": e.status,
            "sent_by": e.sent_by,
            "sent_at": e.sent_at.isoformat() if e.sent_at else None,
        })

    # Return mock data if empty (for testing / demo purposes)
    if not result:
        logger.info("No emails found for candidate %s — returning mock data", candidate_id)
        now = datetime.now(timezone.utc).isoformat()
        result = [
            {
                "id": "mock-1",
                "candidate_id": candidate_id,
                "recipient_email": "candidate@example.com",
                "sender_email": SMTP_USER or "recruiter@company.com",
                "subject": "Interview Invitation - Software Engineer Role",
                "body": "<p>Hi,</p><p>We'd like to invite you for an interview for the <strong>Software Engineer</strong> position at our company.</p><p>Please let us know your availability for next week.</p><p>Best regards,<br/>HR Team</p>",
                "provider": "gmail",
                "direction": "sent",
                "status": "sent",
                "sent_by": "admin",
                "sent_at": now,
            },
            {
                "id": "mock-2",
                "candidate_id": candidate_id,
                "recipient_email": SMTP_USER or "recruiter@company.com",
                "sender_email": "candidate@example.com",
                "subject": "Re: Interview Invitation - Software Engineer Role",
                "body": "<p>Hello,</p><p>Thank you for reaching out! I'm very interested in the role.</p><p>I'm available on <strong>Tuesday</strong> or <strong>Wednesday</strong> next week, anytime between 10 AM - 4 PM.</p><p>Looking forward to it!</p>",
                "provider": "gmail",
                "direction": "received",
                "status": "sent",
                "sent_by": None,
                "sent_at": now,
            },
        ]

    return result


@router.get("/history/{candidate_id}/count")
def get_email_count(
    candidate_id: int,
    db: Session = Depends(get_db),
):
    """Get total email count for a candidate."""
    count = (
        db.query(EmailLog)
        .filter(EmailLog.candidate_id == candidate_id)
        .count()
    )
    return {"count": count}


# ══════════════════════════════════════════════════════════════════════════════
# ATTACHMENTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/attachments/{email_id}")
def get_email_attachments(
    email_id: str,
    db: Session = Depends(get_db),
):
    """Get attachments for a specific email."""
    attachments = (
        db.query(EmailAttachment)
        .filter(EmailAttachment.email_log_id == email_id)
        .all()
    )
    return attachments
