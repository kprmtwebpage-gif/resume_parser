"""
Microsoft Outlook OAuth2 (Azure AD) integration.

Implements the Authorization Code flow:
  1. Generate auth URL → user signs in via Microsoft
  2. Callback receives authorization code → exchange for tokens
  3. Use access_token with XOAUTH2 SMTP authentication
  4. Refresh tokens automatically when expired

Azure AD App Registration requirements:
  - Redirect URI: http://localhost:8000/email/oauth2/callback (for dev)
  - API Permissions: SMTP.Send, offline_access, User.Read
  - Platform: Web
"""

import base64
import logging
import os
import secrets
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import httpx
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from .crypto import encrypt_password, decrypt_password
from .models import UserEmailSetting

load_dotenv()

logger = logging.getLogger(__name__)

# ── Azure AD configuration ────────────────────────────────────────────────────

AZURE_CLIENT_ID = os.getenv("AZURE_CLIENT_ID", "")
AZURE_CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET", "")
AZURE_TENANT = os.getenv("AZURE_TENANT", "common")  # "common" for personal + work accounts
AZURE_REDIRECT_URI = os.getenv("AZURE_REDIRECT_URI", "http://localhost:8000/email/oauth2/callback")

AUTHORITY = f"https://login.microsoftonline.com/{AZURE_TENANT}"
AUTHORIZE_URL = f"{AUTHORITY}/oauth2/v2.0/authorize"
TOKEN_URL = f"{AUTHORITY}/oauth2/v2.0/token"

# Scopes needed for SMTP sending via OAuth2
SCOPES = [
    "https://outlook.office365.com/SMTP.Send",
    "offline_access",     # Required for refresh tokens
    "User.Read",          # To read user's email address
]

# In-memory state store (maps state → user_id) for CSRF protection
_pending_states: dict[str, int] = {}


def is_configured() -> bool:
    """Check if Azure AD OAuth2 credentials are set."""
    return bool(AZURE_CLIENT_ID and AZURE_CLIENT_SECRET)


def generate_auth_url(user_id: int) -> str:
    """Generate the Microsoft OAuth2 authorization URL.

    The user will be redirected to this URL to sign in with Microsoft.
    Returns the full URL to redirect to.
    """
    if not is_configured():
        raise ValueError("Azure AD OAuth2 is not configured. Set AZURE_CLIENT_ID and AZURE_CLIENT_SECRET in .env")

    state = secrets.token_urlsafe(32)
    _pending_states[state] = user_id

    params = {
        "client_id": AZURE_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": AZURE_REDIRECT_URI,
        "scope": " ".join(SCOPES),
        "state": state,
        "response_mode": "query",
        "prompt": "consent",  # Always ask for consent to ensure refresh_token
    }
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


def validate_state(state: str) -> int | None:
    """Validate and consume a state parameter. Returns user_id or None."""
    return _pending_states.pop(state, None)


async def exchange_code_for_tokens(code: str) -> dict:
    """Exchange the authorization code for access + refresh tokens.

    Returns dict with: access_token, refresh_token, expires_in, id_token
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            TOKEN_URL,
            data={
                "client_id": AZURE_CLIENT_ID,
                "client_secret": AZURE_CLIENT_SECRET,
                "code": code,
                "redirect_uri": AZURE_REDIRECT_URI,
                "grant_type": "authorization_code",
                "scope": " ".join(SCOPES),
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        return resp.json()


async def refresh_access_token(encrypted_refresh_token: str) -> dict:
    """Use a refresh token to get a new access token.

    Returns dict with: access_token, refresh_token (rotated), expires_in
    """
    refresh_token = decrypt_password(encrypted_refresh_token)

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            TOKEN_URL,
            data={
                "client_id": AZURE_CLIENT_ID,
                "client_secret": AZURE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
                "scope": " ".join(SCOPES),
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        return resp.json()


async def get_user_email(access_token: str) -> str:
    """Fetch the authenticated user's email address from Microsoft Graph."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("mail") or data.get("userPrincipalName", "")


def save_oauth_tokens(
    db: Session,
    user_id: int,
    email: str,
    access_token: str,
    refresh_token: str,
    expires_in: int,
):
    """Save or update OAuth tokens for the Outlook provider.

    Tokens are encrypted before storage using the same Fernet key as passwords.
    """
    encrypted_access = encrypt_password(access_token)
    encrypted_refresh = encrypt_password(refresh_token)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    existing = (
        db.query(UserEmailSetting)
        .filter(
            UserEmailSetting.user_id == user_id,
            UserEmailSetting.provider == "outlook",
        )
        .first()
    )

    if existing:
        existing.email = email
        existing.username = email
        existing.smtp_host = "smtp.office365.com"
        existing.smtp_port = 587
        existing.imap_host = "outlook.office365.com"
        existing.imap_port = 993
        existing.ssl_enabled = "STARTTLS"
        existing.auth_method = "OAuth2"
        existing.oauth_access_token = encrypted_access
        existing.oauth_refresh_token = encrypted_refresh
        existing.oauth_expires_at = expires_at
        existing.is_connected = True
        existing.updated_at = datetime.now(timezone.utc)
    else:
        # Check if this should be default
        existing_count = (
            db.query(UserEmailSetting)
            .filter(UserEmailSetting.user_id == user_id)
            .count()
        )
        is_first = existing_count == 0

        if is_first:
            pass  # Will be default
        else:
            # Clear other defaults if this is the first
            pass

        existing = UserEmailSetting(
            user_id=user_id,
            provider="outlook",
            email=email,
            username=email,
            smtp_host="smtp.office365.com",
            smtp_port=587,
            imap_host="outlook.office365.com",
            imap_port=993,
            ssl_enabled="STARTTLS",
            auth_method="OAuth2",
            oauth_access_token=encrypted_access,
            oauth_refresh_token=encrypted_refresh,
            oauth_expires_at=expires_at,
            is_connected=True,
            is_default=is_first,
        )
        db.add(existing)

    db.commit()
    db.refresh(existing)
    logger.info("[OAUTH2] Saved Outlook OAuth tokens for user %s (%s)", user_id, email)
    return existing


async def get_valid_access_token(db: Session, setting: UserEmailSetting) -> str:
    """Get a valid access token, refreshing if expired.

    Returns the decrypted access token ready for SMTP XOAUTH2.
    """
    if not setting.oauth_access_token or not setting.oauth_refresh_token:
        raise ValueError("No OAuth tokens stored for this setting")

    # Check expiry (with 5-minute buffer)
    if setting.oauth_expires_at and setting.oauth_expires_at > datetime.now(timezone.utc) + timedelta(minutes=5):
        return decrypt_password(setting.oauth_access_token)

    # Token expired — refresh it
    logger.info("[OAUTH2] Access token expired for user %s, refreshing...", setting.user_id)
    try:
        token_data = await refresh_access_token(setting.oauth_refresh_token)

        new_access = token_data["access_token"]
        new_refresh = token_data.get("refresh_token", decrypt_password(setting.oauth_refresh_token))
        expires_in = token_data.get("expires_in", 3600)

        setting.oauth_access_token = encrypt_password(new_access)
        setting.oauth_refresh_token = encrypt_password(new_refresh)
        setting.oauth_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        setting.updated_at = datetime.now(timezone.utc)
        db.commit()

        logger.info("[OAUTH2] Token refreshed successfully for user %s", setting.user_id)
        return new_access
    except Exception as e:
        logger.error("[OAUTH2] Token refresh failed for user %s: %s", setting.user_id, e)
        raise ValueError(f"OAuth token refresh failed: {e}. Please reconnect your Outlook account.")


def build_xoauth2_string(user_email: str, access_token: str) -> str:
    """Build the XOAUTH2 authentication string for SMTP.

    Format: "user=<email>\\x01auth=Bearer <token>\\x01\\x01"
    Returns base64-encoded string.
    """
    auth_string = f"user={user_email}\x01auth=Bearer {access_token}\x01\x01"
    return base64.b64encode(auth_string.encode("utf-8")).decode("utf-8")
