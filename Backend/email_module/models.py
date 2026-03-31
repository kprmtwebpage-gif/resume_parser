"""
SQLAlchemy ORM models for the email module.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Text, DateTime, BigInteger, Integer, Boolean,
    ForeignKey, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from .database import Base


def _now():
    return datetime.now(timezone.utc)


class EmailAccount(Base):
    """Stores authenticated email provider info per user."""
    __tablename__ = "email_accounts"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, nullable=False, index=True)
    provider = Column(String(50), nullable=False)          # "gmail" | "outlook"
    email_address = Column(String(255), nullable=True)     # user's email address
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)


class EmailLog(Base):
    """Tracks all sent and received emails."""
    __tablename__ = "email_logs"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(Integer, nullable=False, index=True)
    recipient_email = Column(String(255), nullable=True)
    sender_email = Column(String(255), nullable=True)
    subject = Column(String(500), nullable=True)
    body = Column(Text, nullable=True)
    provider = Column(String(50), nullable=True)           # "gmail" | "outlook"
    direction = Column(String(20), nullable=False)         # "sent" | "received"
    status = Column(String(20), default="sent")            # "sent" | "failed" | "pending"
    sent_by = Column(String(255), nullable=True)           # username
    sent_at = Column(DateTime(timezone=True), default=_now)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)


class EmailAttachment(Base):
    """Tracks file attachments on emails."""
    __tablename__ = "email_attachments"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email_log_id = Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    file_name = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    content_type = Column(String(200), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), default=_now)


class EmailTemplate(Base):
    """Reusable email templates with {{variable}} placeholders."""
    __tablename__ = "email_templates"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    created_by = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)


class UserEmailConfig(Base):
    """Per-user SMTP email configuration. Falls back to .env if not set."""
    __tablename__ = "user_email_configs"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_email_config"),
    )

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, nullable=False, index=True)
    gmail_email = Column(String(255), nullable=True)
    gmail_password = Column(String(255), nullable=True)
    outlook_email = Column(String(255), nullable=True)
    outlook_password = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)


class UserEmailSetting(Base):
    """Per-user, per-provider email settings (IMAP + SMTP).

    Each user can configure multiple providers (gmail, outlook, zoho),
    but only ONE can be the default at any time.
    Passwords are stored encrypted via Fernet symmetric encryption.
    """
    __tablename__ = "user_email_settings"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", name="uq_user_provider"),
    )

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, nullable=False, index=True)
    provider = Column(String(50), nullable=False)          # "gmail" | "outlook" | "zoho"
    email = Column(String(255), nullable=False)
    imap_host = Column(String(255), nullable=True)
    imap_port = Column(Integer, nullable=True)
    smtp_host = Column(String(255), nullable=True)
    smtp_port = Column(Integer, nullable=True)
    # IMAP credentials
    username = Column(String(255), nullable=True)           # IMAP username
    password_encrypted = Column(Text, nullable=True)        # IMAP password (Fernet-encrypted)
    ssl_enabled = Column(String(50), default="Autodetect")  # IMAP SSL
    auth_method = Column(String(50), default="Autodetect")  # IMAP auth method
    # SMTP credentials (separate from IMAP, like SignalHire)
    smtp_username = Column(String(255), nullable=True)
    smtp_password_encrypted = Column(Text, nullable=True)   # Fernet-encrypted
    smtp_ssl_enabled = Column(String(50), default="Autodetect")
    smtp_auth_method = Column(String(50), default="Autodetect")
    # OAuth2 tokens
    oauth_access_token = Column(Text, nullable=True)        # Fernet-encrypted OAuth2 access token
    oauth_refresh_token = Column(Text, nullable=True)       # Fernet-encrypted OAuth2 refresh token
    oauth_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_default = Column(Boolean, default=False)
    is_connected = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)


class ContactPersonTemplate(Base):
    """Maps email templates to contact persons (HR) — many-to-many."""
    __tablename__ = "contact_person_templates"
    __table_args__ = (
        UniqueConstraint("contact_person_id", "template_id", name="uq_cp_template"),
    )

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contact_person_id = Column(
        PG_UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    template_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("email_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
