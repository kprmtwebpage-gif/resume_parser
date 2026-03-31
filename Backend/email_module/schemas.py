"""
Pydantic schemas for the email module API.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class EmailAccountCreate(BaseModel):
    provider: str           # "gmail" | "outlook"
    email_address: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None


class EmailAccountRead(BaseModel):
    id: str
    provider: str
    email_address: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class EmailSendRequest(BaseModel):
    candidate_id: int
    recipient_email: str
    subject: str
    body: str
    provider: Optional[str] = "gmail"


class EmailLogRead(BaseModel):
    id: str
    candidate_id: int
    recipient_email: Optional[str] = None
    sender_email: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    provider: Optional[str] = None
    direction: str
    status: Optional[str] = None
    sent_by: Optional[str] = None
    sent_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class EmailAttachmentRead(BaseModel):
    id: str
    email_log_id: str
    file_name: str
    file_size: Optional[int] = None
    content_type: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Email Template schemas ────────────────────────────────────

class EmailTemplateCreate(BaseModel):
    name: str
    subject: str
    body: str

class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None

class EmailTemplateRead(BaseModel):
    id: str
    name: str
    subject: str
    body: str
    created_by: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

class TemplatePreviewRequest(BaseModel):
    candidate_data: dict

class ContactPersonTemplateAssign(BaseModel):
    template_id: str


# ── User Email Settings schemas ───────────────────────────────

class EmailSettingSave(BaseModel):
    """Payload to save/update a provider's email settings."""
    provider: str                                    # "gmail" | "outlook" | "zoho"
    email: str
    # IMAP (receiving)
    imap_host: Optional[str] = None
    imap_port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None                   # plaintext — encrypted on save
    ssl_enabled: Optional[str] = "Autodetect"
    auth_method: Optional[str] = "Autodetect"
    # SMTP (sending)
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None              # plaintext — encrypted on save
    smtp_ssl_enabled: Optional[str] = "Autodetect"
    smtp_auth_method: Optional[str] = "Autodetect"
    is_default: Optional[bool] = False


class EmailSettingRead(BaseModel):
    """Response schema — never exposes passwords."""
    id: str
    provider: str
    email: str
    # IMAP
    imap_host: Optional[str] = None
    imap_port: Optional[int] = None
    username: Optional[str] = None
    ssl_enabled: Optional[str] = None
    auth_method: Optional[str] = None
    # SMTP
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_ssl_enabled: Optional[str] = None
    smtp_auth_method: Optional[str] = None
    is_default: bool
    is_connected: bool
    oauth2_connected: Optional[bool] = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class EmailSettingTestRequest(BaseModel):
    """Payload to test SMTP connection without saving."""
    smtp_host: str
    smtp_port: int
    username: str
    password: str
    ssl_enabled: Optional[str] = "Autodetect"
