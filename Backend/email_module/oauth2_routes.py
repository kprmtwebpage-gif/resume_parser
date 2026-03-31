"""
FastAPI routes for Microsoft Outlook OAuth2 authentication.

Endpoints:
  GET  /email/oauth2/status         — Check if OAuth2 is configured + user's connection status
  GET  /email/oauth2/authorize      — Get the Microsoft sign-in URL
  GET  /email/oauth2/callback       — Handle the redirect from Microsoft after sign-in
  POST /email/oauth2/disconnect     — Remove OAuth2 tokens for Outlook
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from .database import get_db
from .models import UserEmailSetting
from . import oauth2_outlook as oauth2

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/email/oauth2", tags=["email-oauth2"])


# ── Helper: extract user_id from JWT ─────────────────────────────────────────

def _get_user_id(request: Request) -> int:
    """Extract user_id from the JWT token."""
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


# ══════════════════════════════════════════════════════════════════════════════
# CHECK OAUTH2 STATUS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/status")
def oauth2_status(request: Request, db: Session = Depends(get_db)):
    """Check if Azure AD OAuth2 is configured and user's Outlook OAuth status."""
    user_id = _get_user_id(request)

    configured = oauth2.is_configured()

    # Check if user has OAuth tokens stored
    setting = (
        db.query(UserEmailSetting)
        .filter(
            UserEmailSetting.user_id == user_id,
            UserEmailSetting.provider == "outlook",
        )
        .first()
    )

    oauth_connected = bool(
        setting
        and setting.auth_method == "OAuth2"
        and setting.oauth_refresh_token
        and setting.is_connected
    )

    return {
        "oauth2_available": configured,
        "oauth2_connected": oauth_connected,
        "email": setting.email if oauth_connected else None,
    }


# ══════════════════════════════════════════════════════════════════════════════
# GET AUTHORIZATION URL
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/authorize")
def get_authorize_url(request: Request):
    """Generate the Microsoft OAuth2 sign-in URL.

    The frontend should redirect or open a popup to this URL.
    """
    user_id = _get_user_id(request)

    if not oauth2.is_configured():
        raise HTTPException(
            status_code=503,
            detail="OAuth2 is not configured. Set AZURE_CLIENT_ID and AZURE_CLIENT_SECRET in the server .env file.",
        )

    auth_url = oauth2.generate_auth_url(user_id)
    return {"auth_url": auth_url}


# ══════════════════════════════════════════════════════════════════════════════
# OAUTH2 CALLBACK (Microsoft redirects here after sign-in)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/callback")
async def oauth2_callback(
    code: str = None,
    state: str = None,
    error: str = None,
    error_description: str = None,
    db: Session = Depends(get_db),
):
    """Handle the OAuth2 callback from Microsoft.

    This is called by Microsoft after the user signs in.
    It exchanges the authorization code for tokens and stores them.
    Returns an HTML page that sends a message to the parent window.
    """
    if error:
        logger.error("[OAUTH2 CALLBACK] Error from Microsoft: %s — %s", error, error_description)
        return _callback_html(success=False, message=error_description or error)

    if not code or not state:
        return _callback_html(success=False, message="Missing authorization code or state parameter.")

    # Validate CSRF state
    user_id = oauth2.validate_state(state)
    if user_id is None:
        return _callback_html(success=False, message="Invalid or expired state. Please try again.")

    try:
        # Exchange code for tokens
        token_data = await oauth2.exchange_code_for_tokens(code)

        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)

        if not access_token or not refresh_token:
            return _callback_html(success=False, message="Microsoft did not return required tokens. Please try again with 'consent' prompt.")

        # Get user's email from Microsoft Graph
        email = await oauth2.get_user_email(access_token)
        if not email:
            return _callback_html(success=False, message="Could not retrieve email address from Microsoft.")

        # Save tokens to database
        oauth2.save_oauth_tokens(
            db=db,
            user_id=user_id,
            email=email,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in,
        )

        return _callback_html(success=True, message=f"Outlook account {email} connected successfully!")

    except Exception as e:
        logger.error("[OAUTH2 CALLBACK] Token exchange failed: %s", e)
        return _callback_html(success=False, message=f"Authentication failed: {str(e)}")


# ══════════════════════════════════════════════════════════════════════════════
# DISCONNECT OAUTH2
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/disconnect")
def oauth2_disconnect(request: Request, db: Session = Depends(get_db)):
    """Remove OAuth2 tokens for Outlook (reverts to disconnected state)."""
    user_id = _get_user_id(request)

    setting = (
        db.query(UserEmailSetting)
        .filter(
            UserEmailSetting.user_id == user_id,
            UserEmailSetting.provider == "outlook",
        )
        .first()
    )

    if not setting:
        raise HTTPException(status_code=404, detail="No Outlook settings found")

    setting.oauth_access_token = None
    setting.oauth_refresh_token = None
    setting.oauth_expires_at = None
    setting.auth_method = "Autodetect"
    setting.is_connected = False
    db.commit()

    return {"status": "disconnected", "message": "Outlook OAuth2 connection removed."}


# ── HTML response for callback popup ─────────────────────────────────────────

def _callback_html(success: bool, message: str) -> HTMLResponse:
    """Return an HTML page that notifies the opener window and closes."""
    status = "success" if success else "error"
    # Escape for safe HTML embedding
    safe_message = message.replace("'", "\\'").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")
    html = f"""<!DOCTYPE html>
<html>
<head><title>Outlook OAuth2</title></head>
<body style="font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8fafc;">
  <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 420px;">
    <div style="font-size: 48px; margin-bottom: 16px;">{"✅" if success else "❌"}</div>
    <h2 style="color: {"#059669" if success else "#dc2626"}; margin: 0 0 8px;">{"Connected!" if success else "Connection Failed"}</h2>
    <p style="color: #64748b; font-size: 14px;">{safe_message}</p>
    <p style="color: #94a3b8; font-size: 12px; margin-top: 16px;">This window will close automatically...</p>
  </div>
  <script>
    if (window.opener) {{
      window.opener.postMessage({{ type: 'oauth2_callback', status: '{status}', message: '{safe_message}' }}, '*');
      setTimeout(() => window.close(), 2000);
    }}
  </script>
</body>
</html>"""
    return HTMLResponse(content=html)
