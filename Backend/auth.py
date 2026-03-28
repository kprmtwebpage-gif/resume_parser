"""
auth.py
=======
JWT + bcrypt helpers for the Resume Parser auth system.

Provides:
  - Password hashing / verification  (bcrypt)
  - JWT creation / decoding          (python-jose)
  - FastAPI dependency get_current_user()
  - DB helpers: get_user_by_username, record_login

Usage in api_server.py:
    from auth import (
        router as auth_router,
        get_current_user, get_current_admin,
        UserOut, Token,
    )
    app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
"""

import os
import random
import smtplib
import logging
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

import bcrypt
import psycopg2
import psycopg2.extras
import psycopg2.pool
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
SECRET_KEY   = os.getenv("JWT_SECRET", "change-me-in-production-32-chars-minimum!")
ALGORITHM    = "HS256"
TOKEN_EXPIRE = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))  # 8 hours default

DB_CONFIG = dict(
    host     = os.getenv("DB_HOST",     "localhost"),
    port     = int(os.getenv("DB_PORT", "5432")),
    dbname   = os.getenv("DB_NAME",     "postgres"),
    user     = os.getenv("DB_USER",     "postgres"),
    password = os.getenv("DB_PASSWORD", "admin"),
)

# â”€â”€ SMTP config (Gmail) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
OTP_EXPIRY_MINUTES = 10

# â”€â”€ OAuth2 scheme (reads token from Authorization: Bearer <token>) â”€â”€â”€â”€â”€â”€â”€â”€â”€  
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# â”€â”€ Pydantic models â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class Token(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    username:     str
    role:         str


class UserOut(BaseModel):
    id:           int
    username:     str
    email:        Optional[str] = None
    role:         str
    is_active:    bool
    total_logins: int
    last_login:   Optional[datetime]
    created_at:   datetime


class UserCreate(BaseModel):
    username: str
    email:    Optional[str] = None
    password: str
    role:     str = "user"


class ChangePassword(BaseModel):
    old_password: str
    new_password: str


# â”€â”€ Connection pool (shared across all auth operations) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
_auth_pool = psycopg2.pool.ThreadedConnectionPool(
    minconn=2,
    maxconn=20,
    **DB_CONFIG,
    cursor_factory=psycopg2.extras.RealDictCursor,
)

# â”€â”€ DB helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _get_conn():
    """Get a connection from the pool."""
    return _auth_pool.getconn()

def _put_conn(conn):
    """Return a connection to the pool."""
    _auth_pool.putconn(conn)

def _db():
    conn = _get_conn()
    try:
        yield conn
    finally:
        _put_conn(conn)


def get_user_by_username(username: str) -> Optional[dict]:
    """Return user row as dict, or None if not found. Lookup is case-insensitive."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(%s)", (username,))
            return cur.fetchone()
    finally:
        _put_conn(conn)


def _ensure_login_sessions_table():
    """Idempotent: create login_sessions table if missing."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS login_sessions (
                    id         SERIAL PRIMARY KEY,
                    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    username   TEXT NOT NULL,
                    ip_address TEXT,
                    logged_in_at TIMESTAMPTZ DEFAULT NOW(),
                    resumes_uploaded_this_session INT DEFAULT 0
                )
            """)
        conn.commit()
    finally:
        _put_conn(conn)

# Ensure table exists at import time
try:
    _ensure_login_sessions_table()
except Exception:
    pass


def _migrate_users_columns():
    """Idempotent: add last_ip and resumes_uploaded columns to users if missing."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip TEXT")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS resumes_uploaded INT DEFAULT 0")
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
    finally:
        _put_conn(conn)

try:
    _migrate_users_columns()
except Exception:
    pass


def _migrate_admin_to_superuser():
    """One-time migration: rename role 'admin' to 'superuser'."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET role = 'superuser' WHERE role = 'admin'")
        conn.commit()
    finally:
        _put_conn(conn)

try:
    _migrate_admin_to_superuser()
except Exception:
    pass


def _ensure_otp_table():
    """Idempotent: create password_reset_otps table if missing."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS password_reset_otps (
                    id         SERIAL PRIMARY KEY,
                    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    otp_code   TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    expires_at TIMESTAMPTZ NOT NULL,
                    used       BOOLEAN DEFAULT FALSE
                )
            """)
        conn.commit()
    finally:
        _put_conn(conn)

try:
    _ensure_otp_table()
except Exception:
    pass


def _generate_otp() -> str:
    """Generate a 6-digit OTP code."""
    return f"{random.randint(100000, 999999)}"


def _send_otp_email(to_email: str, otp_code: str, username: str) -> bool:
    """Send OTP code via Gmail SMTP. Returns True on success."""
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP not configured â€” cannot send OTP email")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "KPRMT Password Reset OTP"
    msg["From"]    = SMTP_USER
    msg["To"]      = to_email

    html = f"""\
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
      <div style="max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
        <h2 style="color: #1e293b; margin-bottom: 8px;">Password Reset</h2>
        <p style="color: #64748b; font-size: 14px;">Hi <strong>{username}</strong>,</p>
        <p style="color: #64748b; font-size: 14px;">Use the OTP below to reset your password. It expires in {OTP_EXPIRY_MINUTES} minutes.</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #6366f1; background: #f1f5f9; padding: 12px 24px; border-radius: 8px;">{otp_code}</span>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">If you did not request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 11px; text-align: center;">KPRMT Global Solutions</p>
      </div>
    </body>
    </html>"""

    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
        return True
    except Exception as e:
        logger.error("Failed to send OTP email to %s: %s", to_email, e)
        return False


def record_login(user_id: int, ip: str):
    """Increment total_logins, update last_login / last_ip, and log session."""
    _ensure_login_sessions_table()
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            # Update user stats
            cur.execute("""
                UPDATE users
                SET total_logins = total_logins + 1,
                    last_login   = NOW(),
                    last_ip      = %s
                WHERE id = %s
                RETURNING username
            """, (ip, user_id))
            row = cur.fetchone()
            username = row["username"] if row else ""
            # Insert session record
            cur.execute("""
                INSERT INTO login_sessions (user_id, username, ip_address)
                VALUES (%s, %s, %s)
            """, (user_id, username, ip))
        conn.commit()
    finally:
        _put_conn(conn)


# â”€â”€ Password helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain password against a bcrypt hash."""
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))


def hash_password(plain: str) -> str:
    """Hash a plain password with bcrypt."""
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


# â”€â”€ JWT helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    expire  = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=TOKEN_EXPIRE))
    payload.update({"exp": expire})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and return token payload, raising HTTPException on failure."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalid or expired",
            headers={"WWW-Authenticate": "Bearer"},
        )


# â”€â”€ FastAPI dependencies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Dependency: validates token, returns user row dict."""
    payload  = decode_token(token)
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = get_user_by_username(username)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Account disabled")
    return user


async def get_current_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency: same as get_current_user but requires role='superuser' (or legacy 'admin')."""
    if current_user["role"] not in ("superuser", "admin"):
        raise HTTPException(status_code=403, detail="Superuser access required")
    return current_user


# â”€â”€ Router â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router = APIRouter()


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    """
    Authenticate user and return a JWT token.

    Frontend calls:
        POST /api/auth/login
        Content-Type: application/x-www-form-urlencoded
        Body: username=...&password=...

    Returns:
        { "access_token": "...", "token_type": "bearer",
          "username": "...", "role": "admin|user" }
    """
    user = get_user_by_username(form_data.username)
    if user is None or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Account disabled")

    client_ip = request.client.host if request.client else "unknown"
    record_login(user["id"], client_ip)

    token = create_access_token({"sub": user["username"], "role": user["role"]})
    return Token(
        access_token=token,
        token_type="bearer",
        username=user["username"],
        role=user["role"],
    )


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Stateless logout â€” client should discard the JWT.
    No server-side state is maintained (tokens are short-lived).
    """
    return {"detail": f"Goodbye, {current_user['username']}!"}


@router.get("/me", response_model=UserOut)
async def me(current_user: dict = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


@router.post("/change-password")
async def change_password(
    body: ChangePassword,
    current_user: dict = Depends(get_current_user),
):
    """Change the logged-in user's password."""
    if not verify_password(body.old_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Old password incorrect")

    new_hash = hash_password(body.new_password)
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET password_hash = %s WHERE id = %s",
                (new_hash, current_user["id"]),
            )
        conn.commit()
    finally:
        _put_conn(conn)
    return {"detail": "Password changed successfully"}


# â”€â”€ Admin-only routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/admin/users")
async def admin_get_users(
    _: dict = Depends(get_current_admin),
):
    """Admin: list all users with their stats."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, username, email, role, is_active, total_logins, 
                       last_login AT TIME ZONE 'UTC' AS last_login,
                       last_ip,
                       created_at AT TIME ZONE 'UTC' AS created_at,
                       resumes_uploaded
                FROM users
                ORDER BY created_at DESC
            """)
            return cur.fetchall()
    finally:
        _put_conn(conn)


@router.post("/admin/create-user", response_model=UserOut)
async def admin_create_user(
    body: UserCreate,
    _: dict = Depends(get_current_admin),
):
    """Admin: create a new user account."""
    # Normalize: trim whitespace, store username as lowercase
    clean_username = body.username.strip().lower()
    clean_email = body.email.strip() if body.email else None
    # Treat empty string as no email
    if not clean_email:
        clean_email = None

    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            # Check username uniqueness (case-insensitive)
            cur.execute("SELECT id, username FROM users WHERE LOWER(username) = LOWER(%s)",
                        (clean_username,))
            existing = cur.fetchone()
            if existing:
                logger.warning("Create user blocked: username '%s' conflicts with existing user id=%s",
                               clean_username, existing["id"])
                raise HTTPException(status_code=409, detail=f"Username '{clean_username}' already exists")

            # Check email uniqueness only if email is provided
            if clean_email:
                cur.execute("SELECT id, email FROM users WHERE LOWER(email) = LOWER(%s)",
                            (clean_email,))
                existing = cur.fetchone()
                if existing:
                    logger.warning("Create user blocked: email '%s' conflicts with existing user id=%s",
                                   clean_email, existing["id"])
                    raise HTTPException(status_code=409, detail=f"Email '{clean_email}' already exists")

            cur.execute("""
                INSERT INTO users (username, email, password_hash, role)
                VALUES (%s, %s, %s, %s)
                RETURNING id, username, email, role, is_active,
                          total_logins, last_login, created_at
            """, (clean_username, clean_email, hash_password(body.password), body.role))
            row = cur.fetchone()
        conn.commit()
    finally:
        _put_conn(conn)
    return row


@router.patch("/admin/toggle-user/{user_id}")
async def admin_toggle_user(
    user_id: int,
    _: dict = Depends(get_current_admin),
):
    """Admin: enable or disable a user account."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE users SET is_active = NOT is_active WHERE id = %s
                RETURNING username, is_active
            """, (user_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="User not found")
        conn.commit()
    finally:
        _put_conn(conn)
    status_str = "enabled" if row["is_active"] else "disabled"
    return {"detail": f"User '{row['username']}' {status_str}"}


@router.delete("/admin/delete-user/{user_id}")
async def admin_delete_user(
    user_id: int,
    _: dict = Depends(get_current_admin),
):
    """Admin: permanently delete a user account."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            # Prevent deleting the last superuser
            cur.execute("SELECT COUNT(*) as cnt FROM users WHERE role IN ('superuser','admin') AND id != %s", (user_id,))
            admin_count = cur.fetchone()["cnt"]
            if admin_count == 0:
                raise HTTPException(status_code=403, detail="Cannot delete the last superuser")
            
            # Get user info before deletion
            cur.execute("SELECT username FROM users WHERE id = %s", (user_id,))
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Nullify uploaded_by references in candidate_profile to avoid FK constraint errors
            cur.execute("UPDATE candidate_profile SET uploaded_by = NULL WHERE uploaded_by = %s", (user_id,))
            
            # Delete the user (cascade deletes related records via ON DELETE CASCADE)
            cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")
    finally:
        _put_conn(conn)
    return {"detail": f"User '{user['username']}' permanently deleted"}


@router.patch("/admin/reset-password/{user_id}")
async def admin_reset_password(
    user_id: int,
    body: dict,          # expects {"new_password": "..."}
    _: dict = Depends(get_current_admin),
):
    """Admin: reset another user's password."""
    new_password = body.get("new_password", "")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET password_hash = %s WHERE id = %s",
                (hash_password(new_password), user_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="User not found")
            # Auto-dismiss any pending reset requests for this user
            cur.execute(
                "UPDATE password_reset_requests SET resolved = TRUE WHERE user_id = %s AND resolved = FALSE",
                (user_id,),
            )
        conn.commit()
    finally:
        _put_conn(conn)
    return {"detail": "Password reset successfully"}


# â”€â”€ Forgot Password flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _ensure_reset_requests_table():
    """Idempotent: create password_reset_requests table if missing."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS password_reset_requests (
                    id           SERIAL PRIMARY KEY,
                    user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    username     TEXT NOT NULL,
                    requested_at TIMESTAMPTZ DEFAULT NOW(),
                    resolved     BOOLEAN DEFAULT FALSE
                )
            """)
        conn.commit()
    finally:
        _put_conn(conn)


@router.post("/forgot-password")
async def forgot_password(body: dict):
    """
    Public (no auth): user submits username to request a password reset.
    - Superuser/admin: If SMTP is configured, sends OTP email directly.
    - Regular user: Always creates a request for admin to handle.
    """
    username = (body.get("username") or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username required")

    _ensure_reset_requests_table()
    _ensure_otp_table()

    user = get_user_by_username(username)
    if user is None:
        return {"detail": "If the account exists and has an email, an OTP has been sent."}

    email = (user.get("email") or "").strip()
    role = (user.get("role") or "").strip().lower()
    is_privileged = role in ("superuser", "admin")

    # Only superuser/admin gets direct OTP reset via email
    if is_privileged and SMTP_USER and SMTP_PASSWORD and email:
        otp_code = _generate_otp()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)

        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE password_reset_otps SET used = TRUE WHERE user_id = %s AND used = FALSE",
                    (user["id"],),
                )
                cur.execute(
                    "INSERT INTO password_reset_otps (user_id, otp_code, expires_at) VALUES (%s, %s, %s)",
                    (user["id"], otp_code, expires_at),
                )
            conn.commit()
        finally:
            _put_conn(conn)

        sent = _send_otp_email(email, otp_code, username)
        if sent:
            parts = email.split("@")
            masked = parts[0][:2] + "***@" + parts[1] if len(parts) == 2 else "***"
            return {"detail": f"OTP sent to {masked}", "otp_sent": True}
        else:
            return {"detail": "Email delivery failed. Contact your admin.", "otp_sent": False}
    else:
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO password_reset_requests (user_id, username)
                    SELECT %s, %s
                    WHERE NOT EXISTS (
                        SELECT 1 FROM password_reset_requests
                        WHERE user_id = %s AND resolved = FALSE
                    )
                """, (user["id"], username, user["id"]))
            conn.commit()
        finally:
            _put_conn(conn)
        return {"detail": "Request submitted. Your admin will reset your password shortly.", "otp_sent": False}


@router.post("/verify-otp")
async def verify_otp(body: dict):
    """Public (no auth): verify OTP code and return a short-lived reset token."""
    username = (body.get("username") or "").strip()
    otp_code = (body.get("otp") or "").strip()
    if not username or not otp_code:
        raise HTTPException(status_code=400, detail="Username and OTP are required")

    _ensure_otp_table()
    user = get_user_by_username(username)
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, otp_code, expires_at FROM password_reset_otps
                WHERE user_id = %s AND used = FALSE
                ORDER BY created_at DESC LIMIT 1
            """, (user["id"],))
            row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=400, detail="No pending OTP found. Request a new one.")
            if row["otp_code"] != otp_code:
                raise HTTPException(status_code=400, detail="Invalid OTP")
            if datetime.now(timezone.utc) > row["expires_at"].replace(tzinfo=timezone.utc):
                raise HTTPException(status_code=400, detail="OTP has expired. Request a new one.")

            cur.execute("UPDATE password_reset_otps SET used = TRUE WHERE id = %s", (row["id"],))
        conn.commit()
    finally:
        _put_conn(conn)

    reset_token = create_access_token(
        {"sub": username, "purpose": "password_reset"},
        expires_delta=timedelta(minutes=15),
    )
    return {"reset_token": reset_token, "detail": "OTP verified"}


@router.post("/reset-password-otp")
async def reset_password_with_otp(body: dict):
    """Public (no auth): reset password using the reset token from verify-otp."""
    token        = (body.get("reset_token") or "").strip()
    new_password = (body.get("new_password") or "").strip()

    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Reset token and new password are required")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    if payload.get("purpose") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid reset token")

    username = payload.get("sub")
    user = get_user_by_username(username)
    if user is None:
        raise HTTPException(status_code=400, detail="User not found")

    new_hash = hash_password(new_password)
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, user["id"]))
            cur.execute(
                "UPDATE password_reset_requests SET resolved = TRUE WHERE user_id = %s AND resolved = FALSE",
                (user["id"],),
            )
        conn.commit()
    finally:
        _put_conn(conn)
    return {"detail": "Password reset successfully. You can now log in."}


@router.get("/admin/reset-requests")
async def admin_get_reset_requests(_: dict = Depends(get_current_admin)):
    """Admin: list all pending (unresolved) password reset requests."""
    _ensure_reset_requests_table()
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, user_id, username, requested_at
                FROM password_reset_requests
                WHERE resolved = FALSE
                ORDER BY requested_at ASC
            """)
            return cur.fetchall()
    finally:
        _put_conn(conn)


@router.delete("/admin/reset-requests/{request_id}")
async def admin_dismiss_reset_request(
    request_id: int,
    _: dict = Depends(get_current_admin),
):
    """Admin: dismiss a password reset request without resetting the password."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE password_reset_requests SET resolved = TRUE WHERE id = %s",
                (request_id,)
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Request not found")
        conn.commit()
    finally:
        _put_conn(conn)
    return {"detail": "Request dismissed"}


# â”€â”€ Login Session History â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/admin/activity-log")
async def admin_activity_log(
    limit: int = 200,
    _: dict = Depends(get_current_admin),
):
    """Admin: get all login sessions across all users (most recent first)."""
    _ensure_login_sessions_table()
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, username, ip_address, logged_in_at,
                       resumes_uploaded_this_session
                FROM login_sessions
                ORDER BY logged_in_at DESC
                LIMIT %s
            """, (limit,))
            return cur.fetchall()
    finally:
        _put_conn(conn)


@router.get("/admin/login-sessions/{user_id}")
async def admin_get_login_sessions(
    user_id: int,
    limit: int = 50,
    _: dict = Depends(get_current_admin),
):
    """Admin: get login history for a specific user (most recent first)."""
    _ensure_login_sessions_table()
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, username, ip_address, logged_in_at, 
                       resumes_uploaded_this_session
                FROM login_sessions
                WHERE user_id = %s
                ORDER BY logged_in_at DESC
                LIMIT %s
            """, (user_id, limit))
            return cur.fetchall()
    finally:
        _put_conn(conn)


@router.post("/admin/update-session-uploads/{session_id}")
async def update_session_uploads(
    session_id: int,
    body: dict,  # expects {"resumes_uploaded": N}
    _: dict = Depends(get_current_user),
):
    """Update resume upload count for a login session."""
    _ensure_login_sessions_table()
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            resumes_uploaded = body.get("resumes_uploaded", 0)
            cur.execute("""
                UPDATE login_sessions 
                SET resumes_uploaded_this_session = %s
                WHERE id = %s
            """, (resumes_uploaded, session_id))
        conn.commit()
        return {"detail": "Session uploads updated"}
    finally:
        _put_conn(conn)


# â”€â”€ Dashboard Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CANDIDATES_TABLE = os.getenv("NEW_CANDIDATES_TABLE", "candidate_profile")

@router.get("/admin/dashboard-stats")
async def admin_dashboard_stats(_: dict = Depends(get_current_admin)):
    """Return aggregated stats for the admin dashboard."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            # Total users
            cur.execute("SELECT COUNT(*) AS total_users FROM users")
            total_users = cur.fetchone()["total_users"]

            # Total successfully parsed resumes
            try:
                cur.execute(f"SELECT COUNT(*) AS total_resumes FROM {CANDIDATES_TABLE} WHERE resume_parse_status = 'completed'")
                total_resumes = cur.fetchone()["total_resumes"]
            except Exception:
                conn.rollback()
                total_resumes = 0

            # Active users today (logged in within last 24h)
            cur.execute("""
                SELECT COUNT(DISTINCT user_id) AS active_today
                FROM login_sessions
                WHERE logged_in_at >= NOW() - INTERVAL '24 hours'
            """)
            active_today = cur.fetchone()["active_today"]

            # Average resumes per user
            avg_resumes = round(total_resumes / total_users, 1) if total_users > 0 else 0

            # Parse success rate (among completed resumes, how many have a name)
            try:
                cur.execute(f"""
                    SELECT 
                        COUNT(*) AS total,
                        COUNT(*) FILTER (WHERE first_name IS NOT NULL AND first_name != '') AS parsed
                    FROM {CANDIDATES_TABLE}
                    WHERE resume_parse_status = 'completed'
                """)
                row = cur.fetchone()
                success_rate = round((row["parsed"] / row["total"] * 100), 1) if row["total"] > 0 else 0
            except Exception:
                conn.rollback()
                success_rate = 0

            # â”€â”€ Trend indicators (compare this week vs last week) â”€â”€â”€â”€â”€â”€â”€â”€â”€
            cur.execute("""
                SELECT COUNT(DISTINCT user_id) AS cnt FROM login_sessions
                WHERE logged_in_at >= date_trunc('week', CURRENT_DATE)
            """)
            users_this_week = cur.fetchone()["cnt"]
            cur.execute("""
                SELECT COUNT(DISTINCT user_id) AS cnt FROM login_sessions
                WHERE logged_in_at >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
                  AND logged_in_at < date_trunc('week', CURRENT_DATE)
            """)
            users_last_week = cur.fetchone()["cnt"]
            users_trend = round(((users_this_week - users_last_week) / max(users_last_week, 1)) * 100, 1)

            try:
                cur.execute(f"""
                    SELECT COUNT(*) AS cnt FROM {CANDIDATES_TABLE}
                    WHERE resume_parse_status = 'completed'
                      AND parsed_at >= date_trunc('week', CURRENT_DATE)
                """)
                resumes_this_week = cur.fetchone()["cnt"]
                cur.execute(f"""
                    SELECT COUNT(*) AS cnt FROM {CANDIDATES_TABLE}
                    WHERE resume_parse_status = 'completed'
                      AND parsed_at >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
                      AND parsed_at < date_trunc('week', CURRENT_DATE)
                """)
                resumes_last_week = cur.fetchone()["cnt"]
                resumes_trend = round(((resumes_this_week - resumes_last_week) / max(resumes_last_week, 1)) * 100, 1)
            except Exception:
                conn.rollback()
                resumes_trend = 0

            # Login activity (daily for last 90 days â€” frontend filters)
            cur.execute("""
                SELECT DATE(logged_in_at) AS date, COUNT(*) AS logins
                FROM login_sessions
                WHERE logged_in_at >= NOW() - INTERVAL '90 days'
                GROUP BY DATE(logged_in_at)
                ORDER BY date ASC
            """)
            login_activity = [
                {"date": str(r["date"]), "logins": r["logins"]}
                for r in cur.fetchall()
            ]

            # Weekly login aggregation
            cur.execute("""
                SELECT date_trunc('week', logged_in_at)::date AS week, COUNT(*) AS logins
                FROM login_sessions
                WHERE logged_in_at >= NOW() - INTERVAL '12 weeks'
                GROUP BY date_trunc('week', logged_in_at)
                ORDER BY week ASC
            """)
            login_weekly = [
                {"date": str(r["week"]), "logins": r["logins"]}
                for r in cur.fetchall()
            ]

            # Monthly login aggregation
            cur.execute("""
                SELECT date_trunc('month', logged_in_at)::date AS month, COUNT(*) AS logins
                FROM login_sessions
                WHERE logged_in_at >= NOW() - INTERVAL '12 months'
                GROUP BY date_trunc('month', logged_in_at)
                ORDER BY month ASC
            """)
            login_monthly = [
                {"date": str(r["month"]), "logins": r["logins"]}
                for r in cur.fetchall()
            ]

            # Resume upload trend (daily for last 90 days — completed only)
            try:
                cur.execute(f"""
                    SELECT DATE(parsed_at) AS date, COUNT(*) AS uploads
                    FROM {CANDIDATES_TABLE}
                    WHERE resume_parse_status = 'completed'
                      AND parsed_at >= NOW() - INTERVAL '90 days'
                    GROUP BY DATE(parsed_at)
                    ORDER BY date ASC
                """)
                upload_trend = [
                    {"date": str(r["date"]), "uploads": r["uploads"]}
                    for r in cur.fetchall()
                ]
            except Exception:
                conn.rollback()
                upload_trend = []

            # Weekly upload aggregation
            try:
                cur.execute(f"""
                    SELECT date_trunc('week', parsed_at)::date AS week, COUNT(*) AS uploads
                    FROM {CANDIDATES_TABLE}
                    WHERE resume_parse_status = 'completed'
                      AND parsed_at >= NOW() - INTERVAL '12 weeks'
                    GROUP BY date_trunc('week', parsed_at)
                    ORDER BY week ASC
                """)
                upload_weekly = [
                    {"date": str(r["week"]), "uploads": r["uploads"]}
                    for r in cur.fetchall()
                ]
            except Exception:
                conn.rollback()
                upload_weekly = []

            # Monthly upload aggregation
            try:
                cur.execute(f"""
                    SELECT date_trunc('month', parsed_at)::date AS month, COUNT(*) AS uploads
                    FROM {CANDIDATES_TABLE}
                    WHERE resume_parse_status = 'completed'
                      AND parsed_at >= NOW() - INTERVAL '12 months'
                    GROUP BY date_trunc('month', parsed_at)
                    ORDER BY month ASC
                """)
                upload_monthly = [
                    {"date": str(r["month"]), "uploads": r["uploads"]}
                    for r in cur.fetchall()
                ]
            except Exception:
                conn.rollback()
                upload_monthly = []

            # User performance (all users with stats + daily/weekly/monthly uploads)
            cur.execute("""
                SELECT u.id, u.username, u.role, u.is_active, u.total_logins,
                       u.last_login, u.resumes_uploaded, u.email, u.created_at
                FROM users u
                ORDER BY u.resumes_uploaded DESC NULLS LAST
            """)
            user_performance = [dict(u) for u in cur.fetchall()]

            # Per-user rich stats (daily/weekly/monthly uploads + frequency metrics)
            cur.execute("""
                SELECT user_id,
                    COALESCE(SUM(resumes_uploaded_this_session) FILTER (
                        WHERE logged_in_at >= CURRENT_DATE
                    ), 0) AS daily_uploads,
                    COALESCE(SUM(resumes_uploaded_this_session) FILTER (
                        WHERE logged_in_at >= date_trunc('week', CURRENT_DATE)
                    ), 0) AS weekly_uploads,
                    COALESCE(SUM(resumes_uploaded_this_session) FILTER (
                        WHERE logged_in_at >= date_trunc('month', CURRENT_DATE)
                    ), 0) AS monthly_uploads,
                    COUNT(*) AS total_sessions,
                    COUNT(DISTINCT DATE(logged_in_at)) AS days_active,
                    MIN(logged_in_at) AS first_login_at,
                    MAX(logged_in_at) FILTER (
                        WHERE resumes_uploaded_this_session > 0
                    ) AS last_upload_at,
                    COALESCE(SUM(resumes_uploaded_this_session), 0) AS session_total_uploads
                FROM login_sessions
                GROUP BY user_id
            """)
            upload_stats = {r["user_id"]: dict(r) for r in cur.fetchall()}

            # Per-user last-30-day upload timeline (for sparkline)
            cur.execute("""
                SELECT user_id,
                       DATE(logged_in_at) AS day,
                       COALESCE(SUM(resumes_uploaded_this_session), 0) AS uploads
                FROM login_sessions
                WHERE logged_in_at >= CURRENT_DATE - 29
                GROUP BY user_id, DATE(logged_in_at)
                ORDER BY day ASC
            """)
            user_timeline_raw = {}
            for r in cur.fetchall():
                uid = r["user_id"]
                if uid not in user_timeline_raw:
                    user_timeline_raw[uid] = {}
                user_timeline_raw[uid][str(r["day"])] = r["uploads"]

            # Build a full 30-day array for each user
            from datetime import date, timedelta
            today = date.today()
            last_30 = [(today - timedelta(days=29 - i)) for i in range(30)]
            last_30_str = [d.isoformat() for d in last_30]

            for u in user_performance:
                s = upload_stats.get(u["id"], {})
                u["daily_uploads"] = s.get("daily_uploads", 0)
                u["weekly_uploads"] = s.get("weekly_uploads", 0)
                u["monthly_uploads"] = s.get("monthly_uploads", 0)
                u["total_sessions"] = s.get("total_sessions", 0)
                u["days_active"] = s.get("days_active", 0)
                u["first_login_at"] = str(s["first_login_at"]) if s.get("first_login_at") else None
                u["last_upload_at"] = str(s["last_upload_at"]) if s.get("last_upload_at") else None
                sess_total = s.get("session_total_uploads", 0)
                total_sess = s.get("total_sessions", 1) or 1
                u["avg_uploads_per_session"] = round(sess_total / total_sess, 1)
                days_a = s.get("days_active", 0) or 1
                u["upload_frequency_per_day"] = round(sess_total / days_a, 1)
                # timeline sparkline data
                tl = user_timeline_raw.get(u["id"], {})
                u["upload_timeline"] = [tl.get(d, 0) for d in last_30_str]

            # Recent activity feed (last 50 login events)
            cur.execute("""
                SELECT ls.username, ls.ip_address, ls.logged_in_at,
                       ls.resumes_uploaded_this_session
                FROM login_sessions ls
                ORDER BY ls.logged_in_at DESC
                LIMIT 50
            """)
            recent_activity = cur.fetchall()

        return {
            "total_users": total_users,
            "total_resumes": total_resumes,
            "active_today": active_today,
            "avg_resumes_per_user": avg_resumes,
            "success_rate": success_rate,
            "users_trend": users_trend,
            "resumes_trend": resumes_trend,
            "login_activity": login_activity,
            "login_weekly": login_weekly,
            "login_monthly": login_monthly,
            "upload_trend": upload_trend,
            "upload_weekly": upload_weekly,
            "upload_monthly": upload_monthly,
            "user_performance": user_performance,
            "recent_activity": [dict(a) for a in recent_activity],
        }
    finally:
        _put_conn(conn)

