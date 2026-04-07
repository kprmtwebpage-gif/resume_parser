"""
FastAPI routes for User Email Settings.
Handles per-user, per-provider SMTP/IMAP configuration with encrypted passwords.
"""

import logging
import smtplib
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .crypto import decrypt_password, encrypt_password
from .database import get_db
from .models import UserEmailSetting
from .schemas import EmailSettingRead, EmailSettingSave, EmailSettingTestRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email/settings", tags=["email-settings"])


# ── Helper: extract user_id from JWT ─────────────────────────────────────────

def _get_user_id(request: Request) -> int:
    """Extract user_id from the JWT token. Raises 401 if unauthenticated."""
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
        logger.warning("Failed to extract user_id: %s", e)
    raise HTTPException(status_code=401, detail="Authentication required")


def _setting_to_read(s: UserEmailSetting) -> dict:
    """Convert ORM object to response dict (never exposing password or tokens)."""
    return {
        "id": str(s.id),
        "provider": s.provider,
        "email": s.email,
        # IMAP
        "imap_host": s.imap_host,
        "imap_port": s.imap_port,
        "username": s.username,
        "ssl_enabled": s.ssl_enabled,
        "auth_method": s.auth_method,
        # SMTP
        "smtp_host": s.smtp_host,
        "smtp_port": s.smtp_port,
        "smtp_username": s.smtp_username,
        "smtp_ssl_enabled": s.smtp_ssl_enabled,
        "smtp_auth_method": s.smtp_auth_method,
        # Status
        "is_default": s.is_default,
        "is_connected": s.is_connected,
        "oauth2_connected": bool(
            s.smtp_auth_method == "OAuth2" and s.oauth_refresh_token
        ) or bool(
            s.auth_method == "OAuth2" and s.oauth_refresh_token
        ),
        "created_at": s.created_at,
        "updated_at": s.updated_at,
    }


# ══════════════════════════════════════════════════════════════════════════════
# GET ALL SETTINGS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=List[EmailSettingRead])
def get_all_settings(request: Request, db: Session = Depends(get_db)):
    """Return all configured email providers for the current user."""
    user_id = _get_user_id(request)
    settings = (
        db.query(UserEmailSetting)
        .filter(UserEmailSetting.user_id == user_id)
        .order_by(UserEmailSetting.created_at)
        .all()
    )
    return [_setting_to_read(s) for s in settings]


# ══════════════════════════════════════════════════════════════════════════════
# GET SINGLE PROVIDER SETTING
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/{provider}", response_model=EmailSettingRead)
def get_setting(provider: str, request: Request, db: Session = Depends(get_db)):
    """Return settings for a specific provider."""
    user_id = _get_user_id(request)
    setting = (
        db.query(UserEmailSetting)
        .filter(UserEmailSetting.user_id == user_id, UserEmailSetting.provider == provider)
        .first()
    )
    if not setting:
        raise HTTPException(status_code=404, detail=f"No settings found for provider '{provider}'")
    return _setting_to_read(setting)


# ══════════════════════════════════════════════════════════════════════════════
# SAVE / UPDATE SETTINGS (Connect Account)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("", response_model=EmailSettingRead)
def save_setting(
    payload: EmailSettingSave,
    request: Request,
    db: Session = Depends(get_db),
):
    """Save or update email settings for a provider. Encrypts passwords before storage."""
    user_id = _get_user_id(request)
    provider = payload.provider.lower().strip()

    if provider not in ("gmail", "outlook", "zoho"):
        raise HTTPException(status_code=400, detail="Provider must be 'gmail', 'outlook', or 'zoho'")

    # Encrypt IMAP password
    encrypted_imap_pwd = encrypt_password(payload.password) if payload.password else None
    # Encrypt SMTP password — if not explicitly provided, reuse IMAP password
    smtp_raw = payload.smtp_password or payload.password
    encrypted_smtp_pwd = encrypt_password(smtp_raw) if smtp_raw else None

    # If this is the user's first provider OR explicitly marked as default, handle default logic
    existing_count = (
        db.query(UserEmailSetting)
        .filter(UserEmailSetting.user_id == user_id)
        .count()
    )
    is_first = existing_count == 0
    should_be_default = payload.is_default or is_first

    # If setting as default, clear other defaults
    if should_be_default:
        db.query(UserEmailSetting).filter(
            UserEmailSetting.user_id == user_id,
            UserEmailSetting.provider != provider,
        ).update({"is_default": False})

    # Upsert
    existing = (
        db.query(UserEmailSetting)
        .filter(UserEmailSetting.user_id == user_id, UserEmailSetting.provider == provider)
        .first()
    )

    if existing:
        existing.email = payload.email
        existing.imap_host = payload.imap_host
        existing.imap_port = payload.imap_port
        existing.smtp_host = payload.smtp_host
        existing.smtp_port = payload.smtp_port
        existing.username = payload.username
        if encrypted_imap_pwd:
            existing.password_encrypted = encrypted_imap_pwd
        existing.ssl_enabled = payload.ssl_enabled
        existing.auth_method = payload.auth_method
        existing.smtp_username = payload.smtp_username
        if encrypted_smtp_pwd:
            existing.smtp_password_encrypted = encrypted_smtp_pwd
        existing.smtp_ssl_enabled = payload.smtp_ssl_enabled
        existing.smtp_auth_method = payload.smtp_auth_method
        existing.is_default = should_be_default
        existing.is_connected = True
        existing.updated_at = datetime.now(timezone.utc)
    else:
        # Check if this is now the first setting (no existing for any provider, but also
        # the one we're about to insert counts)
        if not should_be_default and existing_count == 0:
            should_be_default = True

        existing = UserEmailSetting(
            user_id=user_id,
            provider=provider,
            email=payload.email,
            imap_host=payload.imap_host,
            imap_port=payload.imap_port,
            smtp_host=payload.smtp_host,
            smtp_port=payload.smtp_port,
            username=payload.username,
            password_encrypted=encrypted_imap_pwd,
            ssl_enabled=payload.ssl_enabled,
            auth_method=payload.auth_method,
            smtp_username=payload.smtp_username,
            smtp_password_encrypted=encrypted_smtp_pwd,
            smtp_ssl_enabled=payload.smtp_ssl_enabled,
            smtp_auth_method=payload.smtp_auth_method,
            is_default=should_be_default,
            is_connected=True,
        )
        db.add(existing)

    # Also update legacy user_email_configs table for backwards compatibility
    _sync_legacy_config(db, user_id, provider, payload.email, payload.smtp_password or payload.password)

    db.commit()
    db.refresh(existing)

    logger.info("[EMAIL SETTINGS] Saved %s config for user %s", provider, user_id)
    return _setting_to_read(existing)


def _sync_legacy_config(db, user_id, provider, email, password):
    """Keep the old user_email_configs table in sync for backwards compat."""
    try:
        from .models import UserEmailConfig
        legacy = (
            db.query(UserEmailConfig)
            .filter(UserEmailConfig.user_id == user_id)
            .first()
        )
        if not legacy:
            legacy = UserEmailConfig(user_id=user_id, is_active=True)
            db.add(legacy)

        if provider == "gmail":
            legacy.gmail_email = email
            legacy.gmail_password = password
        elif provider == "outlook":
            legacy.outlook_email = email
            legacy.outlook_password = password
        legacy.updated_at = datetime.now(timezone.utc)
    except Exception as e:
        logger.warning("Failed to sync legacy email config: %s", e)


# ══════════════════════════════════════════════════════════════════════════════
# SET DEFAULT PROVIDER
# ══════════════════════════════════════════════════════════════════════════════

@router.put("/{provider}/set-default")
def set_default_provider(provider: str, request: Request, db: Session = Depends(get_db)):
    """Set a provider as the default for email sending."""
    user_id = _get_user_id(request)
    setting = (
        db.query(UserEmailSetting)
        .filter(UserEmailSetting.user_id == user_id, UserEmailSetting.provider == provider)
        .first()
    )
    if not setting:
        raise HTTPException(status_code=404, detail=f"Provider '{provider}' not configured")

    # Clear all defaults, then set this one
    db.query(UserEmailSetting).filter(
        UserEmailSetting.user_id == user_id,
    ).update({"is_default": False})

    setting.is_default = True
    setting.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"status": "ok", "default_provider": provider}


# ══════════════════════════════════════════════════════════════════════════════
# DISCONNECT (Delete) PROVIDER
# ══════════════════════════════════════════════════════════════════════════════

@router.delete("/{provider}")
def disconnect_provider(provider: str, request: Request, db: Session = Depends(get_db)):
    """Remove a provider's email settings."""
    user_id = _get_user_id(request)
    setting = (
        db.query(UserEmailSetting)
        .filter(UserEmailSetting.user_id == user_id, UserEmailSetting.provider == provider)
        .first()
    )
    if not setting:
        raise HTTPException(status_code=404, detail=f"Provider '{provider}' not configured")

    was_default = setting.is_default
    db.delete(setting)
    db.commit()

    # If deleted provider was default, promote the next one
    if was_default:
        next_setting = (
            db.query(UserEmailSetting)
            .filter(UserEmailSetting.user_id == user_id)
            .order_by(UserEmailSetting.created_at)
            .first()
        )
        if next_setting:
            next_setting.is_default = True
            db.commit()

    return {"status": "disconnected", "provider": provider}


# ══════════════════════════════════════════════════════════════════════════════
# TEST CONNECTION
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/test-connection")
def test_connection(payload: EmailSettingTestRequest, request: Request):
    """Test SMTP connection without saving. Returns success/failure."""
    _get_user_id(request)  # Auth check

    try:
        with smtplib.SMTP(payload.smtp_host, payload.smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(payload.username, payload.password)
        return {"status": "success", "message": "Connection successful! SMTP login verified."}
    except smtplib.SMTPAuthenticationError as e:
        error_str = str(e)
        error_lower = error_str.lower()
        if "basic authentication is disabled" in error_lower or "5.7.139" in error_str:
            return {
                "status": "error",
                "message": (
                    "Microsoft has permanently disabled Basic Authentication (username + password) for Outlook.com. "
                    "This cannot be re-enabled. Please use Gmail (with an App Password) or another provider instead."
                ),
            }
        if "smtpclientauthentication is disabled" in error_lower:
            return {
                "status": "error",
                "message": (
                    "SMTP client authentication is disabled for this mailbox. "
                    "For personal Outlook.com: go to https://outlook.live.com > Settings > "
                    "Mail > Sync email > enable POP/IMAP toggles > Save. Wait 15-30 minutes. "
                    "If it still fails, Microsoft may have fully disabled Basic Auth — use Gmail instead."
                ),
            }
        if "authentication unsuccessful" in error_lower or "authentication failed" in error_lower or "5.7.3" in error_str:
            return {"status": "error", "message": "Invalid login. Check your password. If two-step verification is on, generate an App Password at https://account.live.com/proofs/AppPassword"}
        return {"status": "error", "message": f"Authentication failed: {error_str}"}
    except smtplib.SMTPConnectError:
        return {"status": "error", "message": f"Could not connect to {payload.smtp_host}:{payload.smtp_port}. Check server address and port."}
    except Exception as e:
        return {"status": "error", "message": f"Connection failed: {str(e)}"}


# ══════════════════════════════════════════════════════════════════════════════
# HELPER: Get SMTP credentials for sending (used by email routes.py)
# ══════════════════════════════════════════════════════════════════════════════

def get_user_smtp_config(db: Session, user_id: int, provider: str):
    """Return (host, port, user, password) from user_email_settings.
    Returns None if the provider is not configured.
    Prefers SMTP-specific credentials; falls back to IMAP creds for backward compat.
    """
    setting = (
        db.query(UserEmailSetting)
        .filter(
            UserEmailSetting.user_id == user_id,
            UserEmailSetting.provider == provider,
            UserEmailSetting.is_connected == True,
        )
        .first()
    )
    if not setting:
        return None

    # Prefer SMTP-specific password, fall back to IMAP password
    pwd_field = setting.smtp_password_encrypted or setting.password_encrypted
    if not pwd_field:
        return None

    try:
        password = decrypt_password(pwd_field)
    except Exception:
        logger.error("Failed to decrypt password for user %s provider %s", user_id, provider)
        return None

    # Prefer SMTP-specific username, fall back to IMAP username, fall back to email
    smtp_user = setting.smtp_username or setting.username or setting.email

    return (
        setting.smtp_host,
        setting.smtp_port,
        smtp_user,
        password,
    )
