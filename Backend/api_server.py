"""
FastAPI server for Resume Parsing Application
Serves candidate data from PostgreSQL database
"""
import asyncio
import json
import os
from contextlib import contextmanager
from typing import Any, List, Optional

try:
    from education_parser import parse_education_section
    _EDU_PARSER_AVAILABLE = True
except ImportError:
    _EDU_PARSER_AVAILABLE = False

import psycopg2
import psycopg2.extras
import psycopg2.pool
from dotenv import load_dotenv
import tempfile
import shutil

from fastapi import FastAPI, File, HTTPException, Query, Request, BackgroundTasks, UploadFile, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# --- helpers ---------------------------------------------------------------
_NO_CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
}

def _html_response(path: str) -> Response:
    """Return an index.html FileResponse with no-cache headers
    so deploy changes are picked up immediately."""
    resp = FileResponse(path, media_type="text/html")
    for k, v in _NO_CACHE_HEADERS.items():
        resp.headers[k] = v
    return resp
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware

# Import chatbot integration (optional)
try:
    from chatbot_integration import create_resume_chatbot
    CHATBOT_AVAILABLE = True
except ImportError as e:
    print(f"[WARN] Chatbot integration not available: {e}")
    CHATBOT_AVAILABLE = False
    create_resume_chatbot = None

# Import auth module
try:
    from auth import router as auth_router, get_current_user, get_current_admin, decode_token, get_user_by_username
    AUTH_AVAILABLE = True
except ImportError as e:
    print(f"[WARN] Auth module not available: {e}")
    AUTH_AVAILABLE = False
    auth_router = None
    decode_token = None
    get_user_by_username = None

# Load environment variables
load_dotenv()

# Get database configuration from environment
CANDIDATES_TABLE = os.getenv("NEW_CANDIDATES_TABLE", "candidate_profile")
SKILLS_TABLE = os.getenv("NEW_SKILLS_TABLE", "candidate_skills_profile")

app = FastAPI(title="Resume Parser API", version="1.0.0")

# Limit concurrent resume-parse subprocesses (prevents 50+ parser.py processes at once)
_parse_semaphore = asyncio.Semaphore(int(os.getenv("PARSE_CONCURRENCY", "8")))
_parse_waiting = 0   # tasks queued, waiting for a semaphore slot
_parse_active  = 0   # tasks currently holding the semaphore (actively parsing)

# ── Resume Download Quota Tracking ────────────────────────────────────────────
DAILY_DOWNLOAD_LIMIT = 10
_http_bearer_optional = HTTPBearer(auto_error=False)

def _ensure_download_logs_table():
    """Idempotent: create resume_download_logs table for daily quota tracking."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS resume_download_logs (
                    id            SERIAL PRIMARY KEY,
                    user_id       INTEGER NOT NULL,
                    download_date DATE NOT NULL DEFAULT CURRENT_DATE,
                    count         INTEGER NOT NULL DEFAULT 0,
                    UNIQUE (user_id, download_date)
                )
            """)
        conn.commit()

try:
    _ensure_download_logs_table()
except Exception:
    pass

def _get_today_download_count(user_id: int) -> int:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT count FROM resume_download_logs WHERE user_id = %s AND download_date = CURRENT_DATE",
                (user_id,),
            )
            row = cur.fetchone()
            return row["count"] if row else 0

def _increment_download_count(user_id: int, amount: int = 1):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO resume_download_logs (user_id, download_date, count)
                VALUES (%s, CURRENT_DATE, %s)
                ON CONFLICT (user_id, download_date) DO UPDATE
                SET count = resume_download_logs.count + EXCLUDED.count
                """,
                (user_id, amount),
            )
        conn.commit()

async def _get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_http_bearer_optional),
) -> Optional[dict]:
    """Dependency: returns the user dict if a valid Bearer token is provided, else None."""
    if not credentials or not AUTH_AVAILABLE or decode_token is None:
        return None
    try:
        payload = decode_token(credentials.credentials)
        username = payload.get("sub")
        if not username:
            return None
        return get_user_by_username(username)
    except Exception:
        return None

def _enforce_download_limit(current_user: Optional[dict], amount: int = 1):
    """Raise 429 if a non-superuser user exceeds their daily download quota."""
    if not current_user:
        return
    role = current_user.get("role", "user")
    if role in ("superuser", "admin"):
        return  # unlimited
    user_id = current_user["id"]
    current_count = _get_today_download_count(user_id)
    remaining = DAILY_DOWNLOAD_LIMIT - current_count
    if remaining <= 0:
        raise HTTPException(
            status_code=429,
            detail=f"Daily download limit of {DAILY_DOWNLOAD_LIMIT} resumes reached. Try again tomorrow.",
        )
    if amount > remaining:
        raise HTTPException(
            status_code=429,
            detail=f"This would exceed your daily limit. You can download {remaining} more resume(s) today.",
        )
    _increment_download_count(user_id, amount)

# CORS configuration - allows dev, production, and server IP
_extra_origins = [o.strip() for o in os.getenv("EXTRA_CORS_ORIGINS", "").split(",") if o.strip()]
_cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://89.167.60.41:8000",
    "http://89.167.60.41",
    "https://kprmtglobalsolutions.duckdns.org",
    "http://kprmtglobalsolutions.duckdns.org",
] + _extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Lightweight no-cache middleware for API JSON endpoints only.
# The previous middleware was disabled because it applied to all responses
# (including chunked static files) and caused timeouts.  This version only
# targets API paths so static/HTML serving is unaffected.
class APINoCacheMiddleware(BaseHTTPMiddleware):
    _API_PREFIXES = ("/candidates", "/chatbot", "/job-titles",
                     "/skills", "/locations", "/chat")

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if any(request.url.path.startswith(p) for p in self._API_PREFIXES):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response

app.add_middleware(APINoCacheMiddleware)

# Register auth router (login, logout, me, admin user management)
if AUTH_AVAILABLE and auth_router is not None:
    app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

# ── Jobs CRUD router (SQLAlchemy) ──────────────────────────────
try:
    from jobs_module import jobs_router, public_jobs_router          # noqa: E402
    app.include_router(jobs_router)
    app.include_router(public_jobs_router)  # Public job portal routes
except Exception as e:
    print(f"[WARN] Jobs module not available: {e}")

# ── Standalone Comments router ─────────────────────────────────
try:
    from comment_standalone_module import standalone_comments_router  # noqa: E402
    app.include_router(standalone_comments_router)
except Exception as e:
    print(f"[WARN] Standalone comments module not available: {e}")

# ── Candidate Comments router ──────────────────────────────────
try:
    from candidate_comments_module import candidate_comments_router   # noqa: E402
    app.include_router(candidate_comments_router)
except Exception as e:
    print(f"[WARN] Candidate comments module not available: {e}")

# ── Company Jobs router ────────────────────────────────────────
try:
    from company_jobs_module import company_jobs_router               # noqa: E402
    app.include_router(company_jobs_router)
except Exception as e:
    print(f"[WARN] Company jobs module not available: {e}")

# ── Job Applications API ───────────────────────────────────────
from fastapi import Form as FastAPIForm
from typing import Optional as OptionalType
import uuid as uuid_module

@app.post("/api/applications/apply", tags=["Applications"])
async def apply_for_job_api(
    job_id: str = FastAPIForm(...),
    first_name: str = FastAPIForm(...),
    last_name: str = FastAPIForm(...),
    candidate_email: str = FastAPIForm(...),
    candidate_phone: str = FastAPIForm(...),
    address: OptionalType[str] = FastAPIForm(None),
    education: OptionalType[str] = FastAPIForm(None),
    citizenship: OptionalType[str] = FastAPIForm(None),
    experience: OptionalType[str] = FastAPIForm(None),
    linkedin_url: OptionalType[str] = FastAPIForm(None),
    resume: OptionalType[UploadFile] = File(None),
):
    """Submit a job application with all candidate details."""
    from jobs_module.database import SessionLocal
    from jobs_module.models import Job, JobApplication
    from pathlib import Path as _Path
    import uuid as _uuid

    db = SessionLocal()
    try:
        try:
            job_uuid = _uuid.UUID(job_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid job_id format")

        job = db.query(Job).filter(Job.id == job_uuid).first()
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

        if not first_name.strip() or not last_name.strip():
            raise HTTPException(status_code=422, detail="first_name and last_name are required")
        if not candidate_email.strip():
            raise HTTPException(status_code=422, detail="email is required")
        if not candidate_phone.strip():
            raise HTTPException(status_code=422, detail="phone is required")

        existing = db.query(JobApplication).filter(
            JobApplication.job_id == job_uuid,
            JobApplication.candidate_email == candidate_email.strip(),
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="This candidate has already applied for this job")

        exp_int = None
        if experience and experience.strip():
            try:
                exp_int = int(float(experience.strip()))
            except (ValueError, TypeError):
                exp_int = None

        resume_url = None
        resume_filename = None
        upload_dir = _Path(__file__).resolve().parent / "uploads" / "applications"
        upload_dir.mkdir(parents=True, exist_ok=True)
        if resume and resume.filename:
            file_ext = _Path(resume.filename).suffix or ".pdf"
            unique_filename = f"{_uuid.uuid4()}{file_ext}"
            file_path = upload_dir / unique_filename
            with open(file_path, "wb") as f:
                content = await resume.read()
                f.write(content)
            resume_url = f"/uploads/applications/{unique_filename}"
            resume_filename = resume.filename

        application = JobApplication(
            job_id=job_uuid,
            candidate_name=f"{first_name.strip()} {last_name.strip()}",
            candidate_email=candidate_email.strip(),
            candidate_phone=candidate_phone.strip(),
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            address=address,
            education=education,
            citizenship=citizenship,
            experience=exp_int,
            linkedin_url=linkedin_url,
            resume_url=resume_url,
            resume_filename=resume_filename,
        )

        db.add(application)
        db.commit()
        db.refresh(application)

        return {"message": "Application submitted successfully"}
    finally:
        db.close()

# ── Static file serving for uploads ────────────────────────────
from pathlib import Path as _UploadPath
_UPLOAD_DIR = _UploadPath(__file__).resolve().parent / "uploads"
_UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_UPLOAD_DIR)), name="uploads")

@app.post("/upload")
async def upload_editor_image(image: UploadFile = File(...)):
    """Upload an editor image and return a public URL."""
    from pathlib import Path as _EdPath
    import uuid

    allowed = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
    suffix = _EdPath(image.filename or "").suffix.lower()
    if suffix not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    editor_dir = _EdPath(__file__).resolve().parent / "uploads" / "editor"
    editor_dir.mkdir(parents=True, exist_ok=True)

    unique_name = f"{uuid.uuid4()}{suffix}"
    file_path = editor_dir / unique_name
    contents = await image.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    return {"url": f"/uploads/editor/{unique_name}"}


# Serve built frontend in production (mount after API routes defined)
# This will be mounted at the end of the file to avoid conflicts with API routes


# ── Connection pool (lazy-initialized at first use / startup) ─────────────────
# NOTE: NOT initialized at module level — doing so caused the worker process to
# crash when the DB was briefly unavailable during container start / restart,
# leading to the entire backend going into a crash-loop (show-stopper bug).
import threading as _threading
_db_pool: psycopg2.pool.ThreadedConnectionPool | None = None
_db_pool_lock = _threading.Lock()


def _build_pool() -> psycopg2.pool.ThreadedConnectionPool:
    """Create a connection pool with TCP keepalives to prevent stale connections."""
    return psycopg2.pool.ThreadedConnectionPool(
        minconn=2,
        maxconn=50,
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        cursor_factory=psycopg2.extras.RealDictCursor,
        # TCP keepalives: detect silently-dropped idle connections.
        # Without this, connections idle for >5 min on the VPS are killed by
        # the firewall/NAT, filling the pool with dead connections until all
        # 20 slots are unusable and every request returns 500.
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
    )


def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    """Return the singleton pool, creating it if necessary (thread-safe)."""
    global _db_pool
    if _db_pool is not None:
        return _db_pool
    with _db_pool_lock:
        if _db_pool is None:
            _db_pool = _build_pool()
    return _db_pool


@contextmanager
def get_db():
    """Database connection context manager with stale-connection recovery.

    Root-cause fix: psycopg2 connections can go dead when the VPS firewall/NAT
    kills idle TCP connections.  Previously, dead connections were returned to
    the pool unchanged and re-issued to the next request, causing every request
    to fail once all pool slots were stale.  Now we:
      1. Rollback on ANY exception so connections are never left in a broken
         transaction state (InFailedSqlTransaction).
      2. On OperationalError (broken pipe / connection reset) the connection is
         discarded from the pool (close=True) rather than being recycled.
      3. If the pool itself is exhausted or not yet initialised we rebuild it
         once and retry, so a transient DB blip during container startup no
         longer takes the whole worker down permanently.
      4. Retry with backoff when the pool is temporarily exhausted (bulk uploads).
    """
    import time as _time
    pool = _get_pool()
    conn = None
    # Retry up to 5 times with increasing backoff when pool is exhausted
    for _attempt in range(5):
        try:
            conn = pool.getconn()
            break
        except psycopg2.pool.PoolError:
            if _attempt < 4:
                _time.sleep(0.3 * (2 ** _attempt))  # 0.3s, 0.6s, 1.2s, 2.4s
            else:
                raise
    if conn is None:
        raise psycopg2.pool.PoolError("connection pool exhausted after retries")
    try:
        yield conn
    except psycopg2.OperationalError:
        # Connection is dead — discard it so the pool allocates a fresh one.
        try:
            conn.rollback()
        except Exception:
            pass
        pool.putconn(conn, close=True)
        conn = None  # mark as already returned
        raise
    except Exception:
        # For all other exceptions rollback the transaction before returning.
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        if conn is not None:
            pool.putconn(conn)


def _split_csv(value: Optional[str]) -> List[str]:
    if not value:
        return []
    parts = [p.strip() for p in str(value).split(",")]
    return [p for p in parts if p]


def _as_list(value: Optional[str]) -> List[str]:
    return [value] if value else []


def _build_education(row: dict) -> Any:
    """Return the best available education representation for a DB row.

    Priority:
    1. education_structured JSONB column (list of dicts) — clean structured data.
    2. On-the-fly parse of the qualification flat string via education_parser.
    3. Raw qualification string as plain fallback.
    """
    edu_s = row.get("education_structured")
    if edu_s:
        # psycopg2 RealDictCursor with JSONB returns already-decoded Python objects
        if isinstance(edu_s, list) and edu_s:
            return edu_s
        if isinstance(edu_s, str):
            try:
                parsed = json.loads(edu_s)
                if isinstance(parsed, list) and parsed:
                    return parsed
            except (json.JSONDecodeError, ValueError):
                pass

    # Try live parse of the flat qualification string
    qual = row.get("qualification")
    if qual and _EDU_PARSER_AVAILABLE:
        try:
            entries = parse_education_section(qual)
            if entries:
                return [{k: v for k, v in e.items() if k != "raw_line"} for e in entries]
        except Exception:
            pass

    # Final fallback: return the flat string (backward-compat)
    return qual or None


def _build_education_fast(row: dict) -> Any:
    """Fast education builder for list endpoints — uses only pre-parsed
    education_structured column; skips slow text-parsing fallback.
    The detail endpoint (/candidates/{id}) still uses the full _build_education."""
    edu_s = row.get("education_structured")
    if edu_s:
        if isinstance(edu_s, list) and edu_s:
            return edu_s
        if isinstance(edu_s, str):
            try:
                parsed = json.loads(edu_s)
                if isinstance(parsed, list) and parsed:
                    return parsed
            except (json.JSONDecodeError, ValueError):
                pass
    return None


class Experience(BaseModel):
    job_title: Optional[str] = None
    years_of_experience: Optional[float] = None
    certifications: List[str] = []


class Candidate(BaseModel):
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    address: Optional[str] = None
    qualification: Optional[str] = None
    linkedin: Optional[str] = None
    profile_picture_url: Optional[str] = None
    visa_support: Optional[str] = None
    work_authorization: Optional[str] = None

    # Fields the frontend expects
    location: Optional[str] = None
    company: Optional[str] = None
    emails: List[str] = []
    phones: List[str] = []
    skills: List[str] = []
    experience: Optional[Experience] = None
    # education is a structured list when education_structured is populated,
    # otherwise falls back to the flat qualification string.
    education: Optional[Any] = None
    summary: Optional[str] = None
    resume_filename: Optional[str] = None

    # Keep these for backward-compat / debugging
    email: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    certifications: Optional[str] = None
    tech_skills: Optional[str] = None
    professional_experience: Optional[str] = None
    # Parse status — lets the UI flag candidates whose resume failed to parse
    parse_status: Optional[str] = None
    parse_failure_reason: Optional[str] = None


import subprocess as _subprocess

def _git_commit_hash() -> str:
    """Return the short git commit hash of the running code, or 'unknown'."""
    try:
        result = _subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, timeout=5,
            cwd=os.path.dirname(__file__),
        )
        return result.stdout.strip() if result.returncode == 0 else "unknown"
    except Exception:
        return "unknown"

_COMMIT_HASH: str | None = None  # lazily cached

def _get_commit() -> str:
    global _COMMIT_HASH
    if _COMMIT_HASH is None:
        _COMMIT_HASH = _git_commit_hash()
    return _COMMIT_HASH


@app.on_event("startup")
async def _create_indexes():
    """Create performance indexes and add missing columns on first start (idempotent)."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{CANDIDATES_TABLE}_first_name ON {CANDIDATES_TABLE}(LOWER(first_name))")
                cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{CANDIDATES_TABLE}_last_name ON {CANDIDATES_TABLE}(LOWER(last_name))")
                cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{CANDIDATES_TABLE}_email ON {CANDIDATES_TABLE}(LOWER(email))")
                cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{CANDIDATES_TABLE}_resume_sha256 ON {CANDIDATES_TABLE}(resume_sha256)")
                cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{CANDIDATES_TABLE}_parsed_at ON {CANDIDATES_TABLE}(parsed_at DESC)")
                cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{SKILLS_TABLE}_job_title_lower ON {SKILLS_TABLE}(LOWER(job_title))")
                cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{CANDIDATES_TABLE}_parse_status ON {CANDIDATES_TABLE}(resume_parse_status)")
                cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{SKILLS_TABLE}_candidate_id ON {SKILLS_TABLE}(candidate_id)")
                # Add resume_parse_status column if missing
                cur.execute(f"""
                    DO $$ BEGIN
                        ALTER TABLE {CANDIDATES_TABLE} ADD COLUMN resume_parse_status TEXT DEFAULT 'completed';
                    EXCEPTION WHEN duplicate_column THEN NULL;
                    END $$
                """)
                # Add parse_failure_reason column if missing
                cur.execute(f"""
                    DO $$ BEGIN
                        ALTER TABLE {CANDIDATES_TABLE} ADD COLUMN parse_failure_reason TEXT;
                    EXCEPTION WHEN duplicate_column THEN NULL;
                    END $$
                """)
                # Add education_structured column if missing (needed by LinkedIn extension)
                cur.execute(f"""
                    DO $$ BEGIN
                        ALTER TABLE {CANDIDATES_TABLE} ADD COLUMN education_structured JSONB;
                    EXCEPTION WHEN duplicate_column THEN NULL;
                    END $$
                """)
                # Add work_experience_structured column if missing (needed by LinkedIn extension)
                cur.execute(f"""
                    DO $$ BEGIN
                        ALTER TABLE {CANDIDATES_TABLE} ADD COLUMN work_experience_structured JSONB;
                    EXCEPTION WHEN duplicate_column THEN NULL;
                    END $$
                """)
                # Add linkedin column if missing
                cur.execute(f"""
                    DO $$ BEGIN
                        ALTER TABLE {CANDIDATES_TABLE} ADD COLUMN linkedin TEXT;
                    EXCEPTION WHEN duplicate_column THEN NULL;
                    END $$
                """)
            conn.commit()
        print("[OK] Performance indexes and schema verified")
    except Exception as e:
        print(f"[WARN] Could not create indexes: {e}")

    # Delete any candidates stuck in 'processing' state — these are rows where the
    # ingestion service was killed mid-parse and the status was never updated.
    # Since failed parses are not stored, these orphan rows are also removed.
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(f"DELETE FROM {CANDIDATES_TABLE} WHERE resume_parse_status IN ('processing', 'not_a_resume')")
                stuck = cur.rowcount
            conn.commit()
        if stuck:
            print(f"[OK] Deleted {stuck} stuck/non-resume placeholder(s) on startup")
    except Exception as e:
        print(f"[WARN] Could not clean up stuck processing records: {e}")

    # Warm up parser subprocess so spaCy/pdfplumber are already loaded in the OS
    # disk cache before the first real upload arrives. This cuts first-parse latency
    # from ~5s (cold) to <1s (warm).
    try:
        import subprocess as _warmup_sp
        import sys as _warmup_sys
        _warmup_env = os.environ.copy()
        _warmup_env["RESUME_INPUT_DIR"] = "/tmp"
        _warmup_env["RESUME_PROCESS_ONLY"] = "__warmup__"
        _warmup_env["QUIET"] = "1"
        _warmup_env["PYTHONIOENCODING"] = "utf-8"
        _warmup_proc = _warmup_sp.Popen(
            [_warmup_sys.executable, str(_UploadPath(__file__).parent / "parser.py")],
            env=_warmup_env,
            stdout=_warmup_sp.DEVNULL,
            stderr=_warmup_sp.DEVNULL,
            cwd=str(_UploadPath(__file__).parent),
        )
        # Don't wait — fire and forget; just importing & loading spaCy warms the cache
        asyncio.get_event_loop().run_in_executor(None, _warmup_proc.wait)
        print("[OK] Parser warmup subprocess launched")
    except Exception as _we:
        print(f"[WARN] Parser warmup failed: {_we}")

    # Ensure the download-quota table exists (the module-level call at import
    # time was a no-op because get_db() wasn't defined yet).
    try:
        _ensure_download_logs_table()
        print("[OK] Download logs table verified")
    except Exception as e:
        print(f"[WARN] Could not create download_logs table: {e}")


@app.get("/health")
async def health_check():
    """Docker health check endpoint — also verifies DB connectivity.

    Previously the health check returned 200 even when the DB connection pool
    was full of stale/dead connections, so Docker's healthcheck never caught
    pool exhaustion.  Now we run a lightweight SELECT 1 to confirm the DB is
    reachable; if it fails the endpoint returns 503 and Docker restarts the
    container (rather than leaving a permanently-broken instance running).
    """
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
    except Exception as exc:
        return Response(
            content=f'{{"status":"error","detail":"{exc}","commit":"{_get_commit()}"}}',
            status_code=503,
            media_type="application/json",
        )
    return {"status": "ok", "commit": _get_commit()}


@app.get("/version")
async def version():
    """Return the deployed git commit hash for deployment verification."""
    return {"commit": _get_commit()}


@app.get("/")
async def root():
    """Serve frontend or API status"""
    frontend_dist = os.path.join(os.path.dirname(__file__), "..", "Frontend", "dist")
    index_file = os.path.join(frontend_dist, "index.html")
    
    if os.path.exists(index_file) and os.getenv("SERVE_FRONTEND", "0") == "1":
        return _html_response(index_file)
    
    return {"status": "ok", "message": "Resume Parser API is running"}


@app.get("/candidates")
async def get_candidates(
    q: Optional[str] = Query(None, description="General search query"),
    name: Optional[str] = Query(None, description="Search by name"),
    location: Optional[str] = Query(None, description="Search by location"),
    jobTitle: Optional[str] = Query(None, description="Search by job title (comma-separated for multiple)"),
    keywords: Optional[str] = Query(None, description="Search by skills/keywords (comma-separated)"),
    experienceYears: Optional[float] = Query(None, description="Minimum years of experience (joint with jobTitle, legacy)"),
    experienceFrom: Optional[float] = Query(None, description="Minimum years of experience (joint with jobTitle)"),
    experienceTo: Optional[float] = Query(None, description="Maximum years of experience (joint with jobTitle)"),
    limit: int = Query(10, ge=1, le=10000, description="Number of results per page"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
):
    """
    Get paginated list of candidates with optional search
    
    - **q**: General search query (searches across all fields)
    - **name**: Search by candidate name
    - **location**: Search by location/address
    - **jobTitle**: Search by job title (comma-separated for multiple)
    - **keywords**: Search by skills/keywords (comma-separated, matches tech_skills)
    - **experienceFrom**: Minimum years of experience (used jointly with jobTitle)
    - **experienceTo**: Maximum years of experience (used jointly with jobTitle)
    - **experienceYears**: Legacy minimum years of experience param (joint with jobTitle)
    - **limit**: Number of results per page (1-10000)
    - **offset**: Offset for pagination
    """
    with get_db() as conn:
        with conn.cursor() as cursor:
            # Build query with field-specific search
            where_conditions = []
            search_params = []

            # Only show successfully parsed candidates — failed/processing rows are not stored
            # but guard here as a safety net in case any slip through.
            where_conditions.append("c.resume_parse_status = 'completed'")

            # Exclude duplicate profiles — show only newest record per email
            where_conditions.append(f"""(c.email IS NULL OR c.email = '' OR NOT EXISTS (
                SELECT 1 FROM {CANDIDATES_TABLE} newer
                WHERE LOWER(newer.email) = LOWER(c.email) AND newer.id > c.id
            ))""")
            
            # Name search - supports comma-separated names with OR logic
            if name:
                name_tags = [n.strip() for n in name.split(",") if n.strip()]
                if len(name_tags) == 1:
                    name_words = [w.strip() for w in name_tags[0].split() if w.strip()]
                    for word in name_words:
                        pattern = f"%{word}%"
                        where_conditions.append("""(
                            c.first_name ILIKE %s 
                            OR c.last_name ILIKE %s 
                            OR CONCAT(c.first_name, ' ', c.last_name) ILIKE %s
                        )""")
                        search_params.extend([pattern] * 3)
                else:
                    # Multiple names: match any of them (OR logic)
                    name_conditions = []
                    for n in name_tags:
                        name_conditions.append("""(
                            c.first_name ILIKE %s 
                            OR c.last_name ILIKE %s 
                            OR CONCAT(c.first_name, ' ', c.last_name) ILIKE %s
                        )""")
                        search_params.extend([f"%{n}%"] * 3)
                    where_conditions.append(f"({' OR '.join(name_conditions)})")
            
            # Location search - supports comma-separated locations with OR logic
            # Uses word-boundary regex (\m / \M) so "India" won't match "Indiana"
            if location:
                loc_tags = [l.strip() for l in location.split(",") if l.strip()]
                if len(loc_tags) == 1:
                    location_words = [w.strip() for w in loc_tags[0].split() if w.strip()]
                    for word in location_words:
                        where_conditions.append(r"c.address ~* %s")
                        search_params.append(r'\m' + word + r'\M')
                else:
                    # Multiple locations: match any of them (OR logic)
                    loc_conditions = []
                    for loc in loc_tags:
                        loc_conditions.append(r"c.address ~* %s")
                        search_params.append(r'\m' + loc.strip() + r'\M')
                    where_conditions.append(f"({' OR '.join(loc_conditions)})")
            
            # Job title search - supports multiple comma-separated titles
            if jobTitle:
                titles = [t.strip() for t in jobTitle.split(",") if t.strip()]
                if len(titles) == 1:
                    job_words = [w.strip() for w in titles[0].split() if w.strip()]
                    for word in job_words:
                        pattern = f"%{word}%"
                        where_conditions.append("s.job_title ILIKE %s")
                        search_params.append(pattern)
                else:
                    # Multiple titles: match any of them
                    title_conditions = []
                    for t in titles:
                        title_conditions.append("s.job_title ILIKE %s")
                        search_params.append(f"%{t}%")
                    where_conditions.append(f"({' OR '.join(title_conditions)})")
            
            # Experience years filter — works independently, no longer requires jobTitle
            exp_min = experienceFrom if experienceFrom is not None else experienceYears
            exp_max = experienceTo
            if exp_min is not None:
                where_conditions.append("s.years_of_experience >= %s")
                search_params.append(exp_min)
            if exp_max is not None:
                where_conditions.append("s.years_of_experience <= %s")
                search_params.append(exp_max)
            
            # Skills / keywords search - matches against tech_skills column
            if keywords:
                kw_list = [k.strip() for k in keywords.split(",") if k.strip()]
                for kw in kw_list:
                    where_conditions.append("s.tech_skills ILIKE %s")
                    search_params.append(f"%{kw}%")
            
            # General search (fallback to old behavior if using q parameter)
            if q and not (name or location or jobTitle):
                words = [w.strip() for w in q.strip().split() if w.strip()]
                for word in words:
                    pattern = f"%{word}%"
                    where_conditions.append("""(
                        c.first_name ILIKE %s 
                        OR c.last_name ILIKE %s 
                        OR CONCAT(c.first_name, ' ', c.last_name) ILIKE %s
                        OR c.address ILIKE %s 
                        OR s.job_title ILIKE %s
                    )""")
                    search_params.extend([pattern] * 5)
            
            # Build WHERE clause
            if where_conditions:
                where_clause = " AND ".join(where_conditions)
                
                count_sql = f"""
                    SELECT COUNT(DISTINCT c.id) as total FROM {CANDIDATES_TABLE} c
                    LEFT JOIN {SKILLS_TABLE} s ON c.id = s.candidate_id
                    WHERE {where_clause}
                """
                data_sql = f"""
                    SELECT DISTINCT c.id, c.first_name, c.last_name, c.email, c.phone, c.address, 
                           c.resume_filename, c.profile_picture_url, s.job_title, c.qualification,
                           c.education_structured,
                           c.linkedin, c.visa_support, 
                           c.work_authorization_type as work_authorization, s.certifications, 
                           s.tech_skills, s.years_of_experience as professional_experience,
                           c.resume_parse_status, c.parse_failure_reason
                    FROM {CANDIDATES_TABLE} c
                    LEFT JOIN {SKILLS_TABLE} s ON c.id = s.candidate_id
                    WHERE {where_clause}
                    ORDER BY c.id
                    LIMIT %s OFFSET %s
                """
                count_params = search_params
                data_params = search_params + [limit, offset]
            else:
                count_sql = f"SELECT COUNT(*) as total FROM {CANDIDATES_TABLE} WHERE resume_parse_status = 'completed'"
                data_sql = f"""
                    SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.address,
                           c.resume_filename, c.profile_picture_url,
                           s.job_title, c.qualification, c.education_structured,
                           c.linkedin, c.visa_support, 
                           c.work_authorization_type as work_authorization, s.certifications, 
                           s.tech_skills, s.years_of_experience as professional_experience,
                           c.resume_parse_status, c.parse_failure_reason
                    FROM {CANDIDATES_TABLE} c
                    LEFT JOIN {SKILLS_TABLE} s ON c.id = s.candidate_id
                    WHERE c.resume_parse_status = 'completed'
                    ORDER BY c.id 
                    LIMIT %s OFFSET %s
                """
                count_params = []
                data_params = [limit, offset]
            
            # Get candidates
            cursor.execute(data_sql, data_params)
            rows = cursor.fetchall()

            # Get grand total — completed candidates only, deduplicated by email
            cursor.execute(f"""SELECT COUNT(*) as total FROM {CANDIDATES_TABLE} c
                WHERE c.resume_parse_status = 'completed'
                  AND (c.email IS NULL OR c.email = '' OR NOT EXISTS (
                    SELECT 1 FROM {CANDIDATES_TABLE} newer
                    WHERE LOWER(newer.email) = LOWER(c.email) AND newer.id > c.id
                ))""")
            grand_total = cursor.fetchone()["total"]
            
            candidates = [
                Candidate(
                    id=row["id"],
                    first_name=row.get("first_name"),
                    last_name=row.get("last_name"),
                    address=row.get("address"),
                    location=row.get("address"),
                    resume_filename=row.get("resume_filename"),
                    profile_picture_url=row.get("profile_picture_url"),
                    job_title=row.get("job_title"),
                    qualification=row.get("qualification"),
                    linkedin=row.get("linkedin"),
                    visa_support="Yes" if row.get("visa_support") else "No" if row.get("visa_support") is not None else None,
                    work_authorization=row.get("work_authorization"),

                    email=row.get("email"),
                    phone=row.get("phone"),
                    emails=_as_list(row.get("email")),
                    phones=_as_list(row.get("phone")),
                    certifications=row.get("certifications"),
                    tech_skills=row.get("tech_skills"),
                    skills=_split_csv(row.get("tech_skills")),
                    professional_experience=str(row.get("professional_experience")) if row.get("professional_experience") is not None else None,
                    education=_build_education_fast(row),  # fast: no text-parsing in list view
                    experience=Experience(
                        job_title=row.get("job_title"),
                        years_of_experience=float(row.get("professional_experience")) if row.get("professional_experience") is not None else None,
                        certifications=_split_csv(row.get("certifications")),
                    ),
                    parse_status=row.get("resume_parse_status"),
                    parse_failure_reason=row.get("parse_failure_reason"),
                )
                for row in rows
            ]

            # Return candidates with grand total for UI filter count display
            return {"candidates": candidates, "total": grand_total}


# ── Bulk resume download (ZIP) ──────────────────────────────────────────────
import zipfile
from io import BytesIO

class BulkDownloadRequest(BaseModel):
    candidate_ids: List[int]

@app.post("/candidates/bulk-download")
async def bulk_download_resumes(
    body: BulkDownloadRequest,
    current_user: Optional[dict] = Depends(_get_optional_user),
):
    """
    Download multiple resumes as a single ZIP archive.
    Accepts a JSON body with { "candidate_ids": [1, 2, 3, ...] }.
    Non-superuser accounts are limited to 10 resumes per day.
    """
    if not body.candidate_ids:
        raise HTTPException(status_code=400, detail="No candidate IDs provided")
    if len(body.candidate_ids) > 200:
        raise HTTPException(status_code=400, detail="Maximum 200 candidates per download")

    # Enforce daily download quota (counted before zipping to avoid partial work)
    _enforce_download_limit(current_user, amount=len(body.candidate_ids))

    with get_db() as conn:
        with conn.cursor() as cursor:
            placeholders = ",".join(["%s"] * len(body.candidate_ids))
            cursor.execute(
                f"SELECT id, first_name, last_name, resume_filename FROM {CANDIDATES_TABLE} WHERE id IN ({placeholders})",
                body.candidate_ids,
            )
            rows = cursor.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No candidates found")

    buf = BytesIO()
    missing = []
    added = 0
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for row in rows:
            resume_filename = row.get("resume_filename")
            if not resume_filename:
                missing.append(row.get("id"))
                continue
            resume_path = os.path.join(os.path.dirname(__file__), resume_filename)
            if not os.path.exists(resume_path):
                missing.append(row.get("id"))
                continue
            fname = os.path.basename(resume_path)
            fn = (row.get("first_name") or "").strip()
            ln = (row.get("last_name") or "").strip()
            if fn or ln:
                ext = os.path.splitext(fname)[1]
                archive_name = f"{fn}_{ln}{ext}".replace(" ", "_")
            else:
                archive_name = fname
            existing_names = set(zf.namelist())
            base, ext = os.path.splitext(archive_name)
            counter = 1
            while archive_name in existing_names:
                archive_name = f"{base}_{counter}{ext}"
                counter += 1
            zf.write(resume_path, archive_name)
            added += 1

    if added == 0:
        raise HTTPException(status_code=404, detail="No resume files found for the selected candidates")

    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="selected_resumes.zip"',
            "X-Missing-Count": str(len(missing)),
        },
    )


@app.get("/candidates/{candidate_id}", response_model=Candidate)
async def get_candidate(candidate_id: int):
    """
    Get detailed information for a specific candidate
    
    - **candidate_id**: The ID of the candidate
    """
    with get_db() as conn:
        with conn.cursor() as cursor:
            cursor.execute(f"""
                SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.address,
                       c.resume_filename, c.education_structured,
                       s.job_title, c.qualification, c.linkedin, c.visa_support, 
                       c.work_authorization_type as work_authorization, s.certifications, 
                       s.tech_skills, s.years_of_experience as professional_experience
                FROM {CANDIDATES_TABLE} c
                LEFT JOIN {SKILLS_TABLE} s ON c.id = s.candidate_id
                WHERE c.id = %s
            """, (candidate_id,))
            row = cursor.fetchone()
            
            if not row:
                raise HTTPException(status_code=404, detail="Candidate not found")
            
            return Candidate(
                id=row["id"],
                first_name=row.get("first_name"),
                last_name=row.get("last_name"),
                address=row.get("address"),
                location=row.get("address"),
                resume_filename=row.get("resume_filename"),
                job_title=row.get("job_title"),
                qualification=row.get("qualification"),
                linkedin=row.get("linkedin"),
                visa_support="Yes" if row.get("visa_support") else "No" if row.get("visa_support") is not None else None,
                work_authorization=row.get("work_authorization"),

                email=row.get("email"),
                phone=row.get("phone"),
                emails=_as_list(row.get("email")),
                phones=_as_list(row.get("phone")),
                certifications=row.get("certifications"),
                tech_skills=row.get("tech_skills"),
                skills=_split_csv(row.get("tech_skills")),
                professional_experience=str(row.get("professional_experience")) if row.get("professional_experience") is not None else None,
                education=_build_education(row),
                experience=Experience(
                    job_title=row.get("job_title"),
                    years_of_experience=float(row.get("professional_experience")) if row.get("professional_experience") is not None else None,
                    certifications=_split_csv(row.get("certifications")),
                ),
            )


@app.delete("/candidates/{candidate_id}")
async def delete_candidate(
    candidate_id: int,
    _: dict = Depends(get_current_admin),
):
    """Delete a candidate, their skills, and their resume file from disk. Superuser/admin only."""
    from pathlib import Path
    resume_filename = None
    with get_db() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                f"SELECT id, resume_filename FROM {CANDIDATES_TABLE} WHERE id = %s",
                (candidate_id,),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Candidate not found")
            resume_filename = row.get("resume_filename")
            cursor.execute(f"DELETE FROM {SKILLS_TABLE} WHERE candidate_id = %s", (candidate_id,))
            cursor.execute(f"DELETE FROM {CANDIDATES_TABLE} WHERE id = %s", (candidate_id,))
        conn.commit()

    # Remove the physical resume file so the ingestion service doesn't re-index it.
    if resume_filename:
        backend_dir = Path(__file__).resolve().parent
        candidate_file = backend_dir / resume_filename
        try:
            if candidate_file.exists():
                candidate_file.unlink()
        except Exception:
            pass  # Non-fatal — DB record is already deleted

    return {"success": True, "deleted_id": candidate_id}


@app.get("/stats")
async def get_stats():
    """Get database statistics"""
    with get_db() as conn:
        with conn.cursor() as cursor:
            # Total successfully parsed candidates
            cursor.execute(f"SELECT COUNT(*) as total FROM {CANDIDATES_TABLE} WHERE resume_parse_status = 'completed'")
            total = cursor.fetchone()["total"]
            
            # Candidates with email
            cursor.execute(f"SELECT COUNT(*) as count FROM {CANDIDATES_TABLE} WHERE resume_parse_status = 'completed' AND email IS NOT NULL AND email != ''")
            with_email = cursor.fetchone()["count"]
            
            # Candidates with phone
            cursor.execute(f"SELECT COUNT(*) as count FROM {CANDIDATES_TABLE} WHERE resume_parse_status = 'completed' AND phone IS NOT NULL AND phone != ''")
            with_phone = cursor.fetchone()["count"]
            
            # Top job titles
            cursor.execute(f"""
                SELECT job_title, COUNT(*) as count 
                FROM {SKILLS_TABLE}
                WHERE job_title IS NOT NULL AND job_title != ''
                GROUP BY job_title 
                ORDER BY count DESC 
                LIMIT 5
            """)
            top_jobs = [{"title": row["job_title"], "count": row["count"]} for row in cursor.fetchall()]
            
            return {
                "total_candidates": total,
                "with_email": with_email,
                "with_phone": with_phone,
                "top_job_titles": top_jobs
            }


# ------------------------------------------------------------------
# Job-titles & skills lookup endpoints
# ------------------------------------------------------------------

@app.get("/job-titles/all")
async def get_all_job_titles():
    """Return every distinct job title from the job_titles reference table.

    Only returns *real* job titles that actually exist in the
    candidate_skills_profile table so the dropdown never suggests
    titles no candidate currently holds.  Titles are de-duplicated
    case-insensitively (the most common capitalisation is kept).
    Obvious parser-noise entries are filtered out.
    """
    with get_db() as conn:
        with conn.cursor() as cursor:
            # Pull titles that candidates actually have
            cursor.execute(f"""
                SELECT job_title, COUNT(*) AS cnt
                FROM {SKILLS_TABLE}
                WHERE job_title IS NOT NULL AND job_title != ''
                GROUP BY job_title
                ORDER BY cnt DESC
            """)
            raw = cursor.fetchall()

            # --- noise filter -------------------------------------------------
            import re as _re
            _NOISE = _re.compile(
                r"(^.{0,3}$"                         # too short
                r"|^.{80,}$"                          # too long
                r"|[(){}\[\]]"                        # contains brackets
                r"|\bsuch as\b|\bwithin\b|\bframework like\b"
                r"|\bexperienced? with\b"
                r"|\band backend\b|\band frontend\b"
                r"|\bservices\)"                       # fragment
                r")",
                _re.IGNORECASE,
            )

            # Case-insensitive de-duplication: keep the variant with highest count
            seen: dict[str, str] = {}  # lower -> best-variant
            for row in raw:
                title = row["job_title"].strip()
                if _NOISE.search(title):
                    continue
                key = title.lower()
                if key not in seen:
                    seen[key] = title

            titles = sorted(seen.values(), key=str.lower)
            return {"results": titles, "count": len(titles)}


@app.get("/skills/all")
async def get_all_skills():
    """Return every distinct skill found across all candidates.

    Skills are stored as comma-separated values in the tech_skills column
    of the skills table; this endpoint splits, deduplicates (case-insensitively)
    and sorts them.
    """
    with get_db() as conn:
        with conn.cursor() as cursor:
            cursor.execute(f"""
                SELECT DISTINCT tech_skills
                FROM {SKILLS_TABLE}
                WHERE tech_skills IS NOT NULL AND tech_skills != ''
            """)
            # Case-insensitive dedup: keep the most-common capitalisation
            from collections import Counter as _Counter
            _counts: _Counter = _Counter()
            _best: dict[str, str] = {}   # lower -> best variant
            for row in cursor.fetchall():
                raw = row["tech_skills"]
                if raw:
                    for s in raw.split(","):
                        s = s.strip()
                        if not s or len(s) < 2:
                            continue
                        key = s.lower()
                        _counts[key] += 1
                        if key not in _best or _counts[key] > _counts.get(key, 0):
                            _best[key] = s
            sorted_skills = sorted(_best.values(), key=str.lower)
            return {"results": sorted_skills, "count": len(sorted_skills)}


def _is_valid_location_string(addr: str) -> bool:
    """Return True only if addr looks like a real geographic location string.

    Rejects skill fragments, tech phrases, and sentences accidentally stored
    in the address column (e.g. 'Activity Diagrams Using', 'Full Stack Developer').
    """
    import re as _re
    a = (addr or "").strip()
    if not a or len(a) > 100:
        return False
    al = a.lower()

    # Reject phrases containing verb-context tech words that are never geographic
    _BAD_WORDS = {
        "using", "working", "developing", "building", "managing", "designing",
        "developer", "engineer", "architect", "analyst", "consultant", "specialist",
        "software", "hardware", "diagrams", "framework", "database", "testing",
        "deployment", "integration", "migration", "automation", "implementation",
        "experience", "years", "skills", "responsibilities", "summary", "objective",
        "activity", "module", "system", "platform", "solution", "process",
    }
    for bad in _BAD_WORDS:
        if _re.search(rf'\b{bad}\b', al):
            return False

    # A valid location must match at least one of:
    # 1. Contains a comma → "City, State" / "City, Country"
    if "," in a:
        return True
    # 2. Is or contains a known country name
    _COUNTRIES = {
        "united states", "usa", "u.s.a", "india", "canada", "australia",
        "united kingdom", "uk", "germany", "france", "singapore", "dubai",
        "uae", "pakistan", "china", "japan", "netherlands", "ireland",
        "new zealand", "south africa", "malaysia", "philippines",
    }
    if any(_re.search(rf'\b{_re.escape(c)}\b', al) for c in _COUNTRIES):
        return True
    # 3. Is or contains a US state full name
    _US_STATES = {
        "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
        "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
        "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana",
        "maine", "maryland", "massachusetts", "michigan", "minnesota",
        "mississippi", "missouri", "montana", "nebraska", "nevada",
        "new hampshire", "new jersey", "new mexico", "new york",
        "north carolina", "north dakota", "ohio", "oklahoma", "oregon",
        "pennsylvania", "rhode island", "south carolina", "south dakota",
        "tennessee", "texas", "utah", "vermont", "virginia", "washington",
        "west virginia", "wisconsin", "wyoming",
    }
    if any(_re.search(rf'\b{_re.escape(s)}\b', al) for s in _US_STATES):
        return True
    # 4. Contains a US ZIP code pattern
    if _re.search(r'\b\d{5}(?:-\d{4})?\b', a):
        return True
    # 5. Two-word city names like "New York" or "Los Angeles" — single-token cities
    #    that passed all bad-word checks are likely valid (e.g. "Mumbai", "London").
    words = a.split()
    if len(words) <= 3:
        return True

    return False


@app.get("/locations/all")
async def get_all_locations():
    """Return distinct, validated location/address values from candidate profiles."""
    with get_db() as conn:
        with conn.cursor() as cursor:
            cursor.execute(f"""
                SELECT DISTINCT address
                FROM {CANDIDATES_TABLE}
                WHERE address IS NOT NULL AND address != ''
                  AND length(address) <= 100
                ORDER BY address
            """)
            # Apply Python-level geographic validation to strip non-location garbage
            locations = [
                row["address"]
                for row in cursor.fetchall()
                if _is_valid_location_string(row["address"])
            ]
            return {"results": locations, "count": len(locations)}


@app.get("/job-titles/search")
async def search_job_titles(
    q: str = Query(..., description="Search query for job titles"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of results")
):
    """
    Search for job titles based on user input with intelligent matching.
    
    Queries the live candidate_skills_profile table so results always reflect
    the current database state (no stale reference table).
    
    Rules:
    - Short queries (<=8 chars or 1 word): Returns all matching titles (partial match)
    - Multi-word queries: Attempts exact match first, then fuzzy match (up to 5 results)
    
    - **q**: Search query (job title or keywords)
    - **limit**: Maximum number of results to return
    """
    query = q.strip()
    
    if not query:
        raise HTTPException(status_code=400, detail="Search query cannot be empty")
    
    # Use the live skills table so results are always current
    _TITLE_SRC = f"""(SELECT DISTINCT job_title FROM {SKILLS_TABLE}
                      WHERE job_title IS NOT NULL AND job_title != '')"""

    with get_db() as conn:
        with conn.cursor() as cursor:
            # Determine search strategy based on query length and word count
            word_count = len(query.split())
            is_short_query = len(query) < 8 or word_count == 1
            
            if is_short_query:
                # Broad exploratory search: partial match, return all results
                cursor.execute(f"""
                    SELECT DISTINCT job_title 
                    FROM {_TITLE_SRC} AS t
                    WHERE job_title ILIKE %s
                    ORDER BY job_title
                    LIMIT %s
                """, (f"%{query}%", limit))
                
                results = [row["job_title"] for row in cursor.fetchall()]
                
                return {
                    "query": query,
                    "strategy": "broad_search",
                    "match_type": "partial",
                    "results": results,
                    "count": len(results)
                }
            
            else:
                # Multi-word query: try exact match first
                cursor.execute(f"""
                    SELECT job_title 
                    FROM {_TITLE_SRC} AS t
                    WHERE LOWER(job_title) = LOWER(%s)
                """, (query,))
                
                exact_match = cursor.fetchone()
                
                if exact_match:
                    return {
                        "query": query,
                        "strategy": "exact_match",
                        "match_type": "exact",
                        "results": [exact_match["job_title"]],
                        "count": 1
                    }
                
                # No exact match: perform fuzzy semantic match
                cursor.execute(f"""
                    SELECT job_title,
                           similarity(LOWER(job_title), LOWER(%s)) as sim_score
                    FROM {_TITLE_SRC} AS t
                    WHERE job_title ILIKE %s
                       OR similarity(LOWER(job_title), LOWER(%s)) > 0.1
                    ORDER BY sim_score DESC, job_title
                    LIMIT 5
                """, (query, f"%{query}%", query))
                
                fuzzy_results = cursor.fetchall()
                
                if fuzzy_results:
                    return {
                        "query": query,
                        "strategy": "fuzzy_match",
                        "match_type": "fuzzy",
                        "results": [row["job_title"] for row in fuzzy_results],
                        "count": len(fuzzy_results)
                    }
                
                # Fallback: try token-based matching
                query_words = query.lower().split()
                conditions = " AND ".join([f"LOWER(job_title) LIKE %s" for _ in query_words])
                params = [f"%{word}%" for word in query_words]
                
                cursor.execute(f"""
                    SELECT DISTINCT job_title
                    FROM {_TITLE_SRC} AS t
                    WHERE {conditions}
                    ORDER BY job_title
                    LIMIT 5
                """, params)
                
                token_results = [row["job_title"] for row in cursor.fetchall()]
                
                return {
                    "query": query,
                    "strategy": "token_match",
                    "match_type": "token",
                    "results": token_results,
                    "count": len(token_results)
                }


@app.get("/candidates/{candidate_id}/resume")
async def download_resume(
    candidate_id: int,
    inline: bool = Query(False, description="Serve inline for viewing instead of download"),
    current_user: Optional[dict] = Depends(_get_optional_user),
):
    """
    Serve the original resume file for a candidate.
    Pass ?inline=true to display in browser (PDF preview); omit for download.
    Non-superuser accounts are limited to 10 downloads per day (inline views are free).
    """
    # Enforce daily quota only for actual downloads (not inline preview)
    if not inline:
        _enforce_download_limit(current_user, amount=1)

    with get_db() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                f"SELECT resume_filename FROM {CANDIDATES_TABLE} WHERE id = %s",
                (candidate_id,)
            )
            row = cursor.fetchone()
            
            if not row or not row.get("resume_filename"):
                raise HTTPException(status_code=404, detail="Resume file not found")
            
            resume_path = os.path.join(os.path.dirname(__file__), row["resume_filename"])
            
            if not os.path.exists(resume_path):
                raise HTTPException(status_code=404, detail="Resume file does not exist on disk")
            
            filename = os.path.basename(resume_path)
            ext = os.path.splitext(resume_path)[1].lower()
            mime_map = {
                ".pdf": "application/pdf",
                ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".doc": "application/msword",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".gif": "image/gif",
                ".bmp": "image/bmp",
                ".webp": "image/webp",
                ".tif": "image/tiff",
                ".tiff": "image/tiff",
                ".txt": "text/plain",
                ".rtf": "application/rtf",
            }
            media_type = mime_map.get(ext, "application/octet-stream")
            
            disposition = "inline" if inline else "attachment"
            headers = {"Content-Disposition": f'{disposition}; filename="{filename}"'}
            
            return FileResponse(
                path=resume_path,
                media_type=media_type,
                headers=headers,
            )


@app.get("/candidates/{candidate_id}/resume-text")
async def get_resume_text(candidate_id: int):
    """
    Extract and return plain text from a .doc resume for preview purposes.
    Returns JSON with extracted text wrapped in basic HTML.
    """
    with get_db() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                f"SELECT resume_filename FROM {CANDIDATES_TABLE} WHERE id = %s",
                (candidate_id,)
            )
            row = cursor.fetchone()

            if not row or not row.get("resume_filename"):
                raise HTTPException(status_code=404, detail="Resume file not found")

            resume_path = os.path.join(os.path.dirname(__file__), row["resume_filename"])

            if not os.path.exists(resume_path):
                raise HTTPException(status_code=404, detail="Resume file does not exist on disk")

            ext = os.path.splitext(resume_path)[1].lower()
            if ext != ".doc":
                raise HTTPException(status_code=400, detail="This endpoint is only for .doc files")

            try:
                from parser import extract_text_from_doc
                text = extract_text_from_doc(resume_path)
                if not text or len(text.strip()) < 10:
                    return {"html": "<p style='color:#64748b;'>Could not extract readable text from this .doc file.</p>"}
                # Convert plain text to simple HTML with line breaks
                import html as html_mod
                safe_text = html_mod.escape(text)
                html_content = "<div style='white-space:pre-wrap;font-family:Georgia,serif;font-size:14px;line-height:1.7;'>" + safe_text + "</div>"
                return {"html": html_content}
            except Exception as e:
                return {"html": f"<p style='color:#64748b;'>Could not extract text: preview unavailable.</p>"}


class CandidateUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    job_title: Optional[str] = None
    location: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    skills: Optional[List[str]] = None


@app.patch("/candidates/{candidate_id}")
async def update_candidate(candidate_id: int, data: CandidateUpdate):
    """Update candidate profile fields in the database."""
    with get_db() as conn:
        with conn.cursor() as cursor:
            # Check candidate exists
            cursor.execute(f"SELECT id FROM {CANDIDATES_TABLE} WHERE id = %s", (candidate_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Candidate not found")

            # Build SET clause for candidate_profile
            profile_fields = {}
            if data.first_name is not None:
                profile_fields["first_name"] = data.first_name.strip()
            if data.last_name is not None:
                profile_fields["last_name"] = data.last_name.strip()
            if data.email is not None:
                profile_fields["email"] = data.email.strip() or None
            if data.phone is not None:
                profile_fields["phone"] = data.phone.strip() or None
            if data.linkedin is not None:
                profile_fields["linkedin"] = data.linkedin.strip() or None
            if data.location is not None:
                profile_fields["address"] = data.location.strip() or None

            if profile_fields:
                set_clause = ", ".join(f"{col} = %s" for col in profile_fields)
                values = list(profile_fields.values()) + [candidate_id]
                cursor.execute(
                    f"UPDATE {CANDIDATES_TABLE} SET {set_clause} WHERE id = %s",
                    values
                )

            # Build SET clause for candidate_skills_profile
            skills_fields = {}
            if data.job_title is not None:
                skills_fields["job_title"] = data.job_title.strip() or None
            if data.skills is not None:
                clean_skills = [s.strip() for s in data.skills if s.strip()]
                skills_fields["tech_skills"] = ", ".join(clean_skills) if clean_skills else None

            if skills_fields:
                # Upsert into skills table
                cursor.execute(
                    f"SELECT candidate_id FROM {SKILLS_TABLE} WHERE candidate_id = %s",
                    (candidate_id,)
                )
                if cursor.fetchone():
                    set_clause = ", ".join(f"{col} = %s" for col in skills_fields)
                    values = list(skills_fields.values()) + [candidate_id]
                    cursor.execute(
                        f"UPDATE {SKILLS_TABLE} SET {set_clause} WHERE candidate_id = %s",
                        values
                    )
                else:
                    cols = ["candidate_id"] + list(skills_fields.keys())
                    placeholders = ", ".join(["%s"] * len(cols))
                    values = [candidate_id] + list(skills_fields.values())
                    cursor.execute(
                        f"INSERT INTO {SKILLS_TABLE} ({', '.join(cols)}) VALUES ({placeholders})",
                        values
                    )

            conn.commit()
            return {"success": True, "id": candidate_id}


async def _dedup_candidate(candidate_id: int, label: str = ""):
    """Remove duplicate candidate records (same email), keeping the newest.

    Waits briefly so concurrent parsers have time to commit their data,
    then uses FOR UPDATE locking to safely deduplicate.
    """
    await asyncio.sleep(3)
    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    f"SELECT email, first_name, last_name FROM {CANDIDATES_TABLE} WHERE id = %s",
                    (candidate_id,),
                )
                rec = cursor.fetchone()
                if not rec:
                    return

                _email = (rec.get("email") or "").strip()
                _fn = (rec.get("first_name") or "").strip()
                _ln = (rec.get("last_name") or "").strip()

                dup_ids = []
                keep_id = candidate_id

                if _email:
                    cursor.execute(
                        f"""SELECT id FROM {CANDIDATES_TABLE}
                            WHERE LOWER(email) = LOWER(%s)
                            ORDER BY id DESC
                            FOR UPDATE""",
                        (_email,),
                    )
                    all_ids = [r["id"] for r in cursor.fetchall()]
                    if len(all_ids) > 1:
                        keep_id = all_ids[0]
                        dup_ids = all_ids[1:]

                if not dup_ids and _fn and _ln and len(_ln) > 1:
                    cursor.execute(
                        f"""SELECT id FROM {CANDIDATES_TABLE}
                            WHERE LOWER(first_name) = LOWER(%s)
                              AND LOWER(last_name) = LOWER(%s)
                            ORDER BY id DESC
                            FOR UPDATE""",
                        (_fn, _ln),
                    )
                    all_ids = [r["id"] for r in cursor.fetchall()]
                    if len(all_ids) > 1:
                        keep_id = all_ids[0]
                        dup_ids = all_ids[1:]

                if dup_ids:
                    for did in dup_ids:
                        cursor.execute(
                            f"UPDATE {SKILLS_TABLE} SET candidate_id = %s WHERE candidate_id = %s",
                            (keep_id, did),
                        )
                        cursor.execute(
                            f"DELETE FROM {CANDIDATES_TABLE} WHERE id = %s",
                            (did,),
                        )
                    print(f"[DEDUP] {label} — kept id={keep_id}, removed {len(dup_ids)} duplicate(s) for {_fn} {_ln} <{_email}>", flush=True)
            conn.commit()
    except Exception:
        import traceback
        traceback.print_exc()


@app.post("/upload-resume")
async def upload_resume_endpoint(request: Request, background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Upload a resume file, save it, and parse in background. Returns immediately."""
    import subprocess
    import sys
    from pathlib import Path

    print(f"[UPLOAD RECEIVED] filename={file.filename!r}", flush=True)

    MAX_CONCURRENT_UPLOADS = 50  # per-user limit to prevent pool exhaustion

    allowed = {".pdf", ".doc", ".docx"}
    suffix = Path(file.filename).suffix.lower()
    if suffix not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}. Use PDF, DOC, or DOCX.")

    # Enforce per-user concurrent upload limit
    auth_header = request.headers.get("Authorization", "")
    _uploader_id = None
    if AUTH_AVAILABLE and auth_header.startswith("Bearer "):
        try:
            from auth import decode_token, get_user_by_username
            payload = decode_token(auth_header[7:])
            uname = payload.get("sub")
            if uname:
                u = get_user_by_username(uname)
                if u:
                    _uploader_id = u.get("id")
        except Exception:
            pass

    if _uploader_id:
        with get_db() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    f"SELECT COUNT(*) as cnt FROM {CANDIDATES_TABLE} WHERE uploaded_by = %s AND resume_parse_status = 'processing'",
                    (_uploader_id,),
                )
                row = cursor.fetchone()
                processing_count = row["cnt"] if row else 0
        if processing_count >= MAX_CONCURRENT_UPLOADS:
            raise HTTPException(
                status_code=429,
                detail=f"You already have {processing_count} resumes being processed. Please wait for them to finish before uploading more (limit: {MAX_CONCURRENT_UPLOADS})."
            )

    backend_dir = Path(__file__).resolve().parent
    cache_dir = backend_dir / "resumes_cache"
    cache_dir.mkdir(exist_ok=True)

    # NOTE: Filename-based duplicate check removed — same filename (e.g. "Resume.pdf")
    # can belong to completely different candidates. Only content (SHA-256) is reliable.

    contents = await file.read()

    dest_path = cache_dir / file.filename
    if dest_path.exists():
        base = Path(file.filename).stem
        dest_path = cache_dir / f"{base}_{int(os.path.getmtime(str(dest_path)))}{suffix}"

    # SHA-256 duplicate check
    import hashlib as _hashlib
    file_sha256 = _hashlib.sha256(contents).hexdigest()
    with get_db() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                f"""SELECT c.id, c.first_name, c.last_name, c.email, c.resume_parse_status, s.job_title
                    FROM {CANDIDATES_TABLE} c
                    LEFT JOIN {SKILLS_TABLE} s ON c.id = s.candidate_id
                    WHERE c.resume_sha256 = %s
                    LIMIT 1""",
                (file_sha256,)
            )
            sha_existing = cursor.fetchone()
    if sha_existing:
        # If the previous upload failed, delete the failed row so user can re-upload
        if sha_existing.get("resume_parse_status") in ("failed", "processing"):
            failed_id = sha_existing["id"]
            with get_db() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(f"DELETE FROM {SKILLS_TABLE} WHERE candidate_id = %s", (failed_id,))
                    cursor.execute(f"DELETE FROM {CANDIDATES_TABLE} WHERE id = %s", (failed_id,))
                conn.commit()
            print(f"[RE-UPLOAD] Deleted failed row id={failed_id} for file={file.filename}, allowing re-upload", flush=True)
            # Fall through to normal upload flow below
        else:
            full_name = " ".join(filter(None, [sha_existing.get("first_name"), sha_existing.get("last_name")])) or None
            return {
                "status": "duplicate",
                "message": "This exact resume has already been uploaded (content match)",
                "id": sha_existing["id"],
                "name": full_name,
                "email": sha_existing.get("email"),
                "job_title": sha_existing.get("job_title"),
            }

    dest_path = cache_dir / file.filename
    if dest_path.exists():
        base = Path(file.filename).stem
        dest_path = cache_dir / f"{base}_{int(os.path.getmtime(str(dest_path)))}{suffix}"

    with open(dest_path, "wb") as f:
        f.write(contents)

    save_name = dest_path.name
    relative_filename = f"resumes_cache/{save_name}"

    # Insert a placeholder row WITH SHA256 so parser.py's ON CONFLICT (resume_sha256)
    # updates the placeholder in-place instead of creating a separate row.
    with get_db() as conn:
        with conn.cursor() as cursor:
            try:
                cursor.execute(
                    f"""INSERT INTO {CANDIDATES_TABLE} (resume_filename, resume_sha256, resume_parse_status)
                        VALUES (%s, %s, 'processing')
                        RETURNING id""",
                    (relative_filename, file_sha256),
                )
                placeholder_row = cursor.fetchone()
                conn.commit()
            except Exception as _insert_exc:
                conn.rollback()
                # Concurrent upload of same file — race between SHA256 check and INSERT
                if 'unique' in str(_insert_exc).lower() or 'duplicate' in str(_insert_exc).lower():
                    cursor.execute(
                        f"""SELECT c.id, c.first_name, c.last_name, c.email, s.job_title, c.resume_parse_status
                            FROM {CANDIDATES_TABLE} c
                            LEFT JOIN {SKILLS_TABLE} s ON c.id = s.candidate_id
                            WHERE c.resume_sha256 = %s LIMIT 1""",
                        (file_sha256,),
                    )
                    dup = cursor.fetchone()
                    if dup:
                        _n = " ".join(filter(None, [dup.get("first_name"), dup.get("last_name")])) or None
                        return {
                            "status": dup.get("resume_parse_status") or "completed",
                            "message": "This exact resume is already being processed",
                            "id": dup["id"], "name": _n,
                            "email": dup.get("email"), "job_title": dup.get("job_title"),
                            "duplicate": True,
                        }
                raise

    placeholder_id = placeholder_row["id"]

    # Parse in background — returns immediately to frontend
    async def _background_parse():
        global _parse_waiting, _parse_active
        import subprocess as _sp
        env = os.environ.copy()
        env["RESUME_INPUT_DIR"] = str(cache_dir)
        env["RESUME_PROCESS_ONLY"] = save_name
        env["QUIET"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"
        # Web-uploaded files are always resumes — skip the non-resume content filter
        env["IS_WEB_UPLOAD"] = "1"

        def _run_parser():
            return _sp.run(
                [sys.executable, str(backend_dir / "parser.py")],
                env=env,
                capture_output=True,
                cwd=str(backend_dir),
                timeout=600,  # 10 min — allows LLM-powered parsing to complete
            )

        _parse_waiting += 1
        try:
            async with _parse_semaphore:
                _parse_waiting -= 1
                _parse_active += 1
                try:
                    loop = asyncio.get_event_loop()
                    result = await loop.run_in_executor(None, _run_parser)
                    returncode = result.returncode
                    stderr_text = (result.stderr or b"").decode("utf-8", errors="replace")
                finally:
                    _parse_active -= 1

            if returncode != 0:
                # Extract a concise reason from stderr (or stdout for parse errors)
                stdout_text = (result.stdout or b"").decode("utf-8", errors="replace")
                _reason_lines = [l.strip() for l in stderr_text.splitlines() if l.strip() and not l.startswith(' ')]
                if not _reason_lines:
                    _reason_lines = [l.strip() for l in stdout_text.splitlines() if l.strip() and ("error" in l.lower() or "skip" in l.lower() or "password" in l.lower() or "encrypt" in l.lower())]
                _reason = _reason_lines[0][:300] if _reason_lines else f"Parser exited with code {returncode}"
                print(f"[PARSER FAILED] file={save_name} rc={returncode} reason={_reason}\nSTDERR: {stderr_text[:500]}", flush=True)
                # Delete the placeholder — failed parses are not stored in DB so user can re-upload
                with get_db() as conn:
                    with conn.cursor() as cursor:
                        cursor.execute(f"DELETE FROM {CANDIDATES_TABLE} WHERE id = %s", (placeholder_id,))
                    conn.commit()
                return

            # Parser succeeded.
            # With SHA256 on the placeholder, parser's ON CONFLICT (resume_sha256)
            # updates the placeholder in-place (most common case).
            # If parser matched by email/name, it may have updated a different row instead.
            with get_db() as conn:
                with conn.cursor() as cursor:
                    # Check if parser created / updated a DIFFERENT row (email/name match case)
                    cursor.execute(
                        f"""SELECT id FROM {CANDIDATES_TABLE}
                            WHERE resume_filename = %s AND id != %s
                            ORDER BY id DESC LIMIT 1""",
                        (relative_filename, placeholder_id),
                    )
                    parser_row = cursor.fetchone()

                    if parser_row:
                        parser_id = parser_row["id"]
                        # Parser matched an existing record by email/name — merge into placeholder
                        cursor.execute(
                            f"""SELECT first_name, last_name, address, phone, email,
                                       qualification, visa_support, work_authorization_type,
                                       linkedin, profile_picture_url, parsed_at
                                FROM {CANDIDATES_TABLE} WHERE id = %s""",
                            (parser_id,),
                        )
                        parsed_data = cursor.fetchone()

                        # Guard against email collision: if another completed row (not parser_id
                        # or placeholder_id) already owns this email, discard the placeholder
                        # and point to the existing record instead.
                        _parsed_email = (parsed_data or {}).get("email")
                        _collision_id = None
                        if _parsed_email and _parsed_email.strip():
                            cursor.execute(
                                f"""SELECT id FROM {CANDIDATES_TABLE}
                                    WHERE LOWER(email) = LOWER(%s)
                                      AND id NOT IN (%s, %s)
                                    LIMIT 1""",
                                (_parsed_email.strip(), parser_id, placeholder_id),
                            )
                            _col = cursor.fetchone()
                            if _col:
                                _collision_id = _col["id"] if isinstance(_col, dict) else _col[0]

                        if _collision_id:
                            # A completed row already exists for this email — delete both
                            # the placeholder and the parser row, keep the original.
                            cursor.execute(f"DELETE FROM {SKILLS_TABLE} WHERE candidate_id = %s", (placeholder_id,))
                            cursor.execute(f"DELETE FROM {CANDIDATES_TABLE} WHERE id = %s", (placeholder_id,))
                            if parser_id != _collision_id:
                                cursor.execute(f"DELETE FROM {SKILLS_TABLE} WHERE candidate_id = %s", (parser_id,))
                                cursor.execute(f"DELETE FROM {CANDIDATES_TABLE} WHERE id = %s", (parser_id,))
                            print(f"[DEDUP] email collision for {_parsed_email!r} — kept id={_collision_id}, discarded placeholder={placeholder_id}", flush=True)
                            final_candidate_id = _collision_id
                        else:
                            # Delete placeholder's skills row first (if any) to avoid PK conflict,
                            # then re-point parser's skills row to placeholder_id.
                            cursor.execute(f"DELETE FROM {SKILLS_TABLE} WHERE candidate_id = %s", (placeholder_id,))
                            cursor.execute(
                                f"UPDATE {SKILLS_TABLE} SET candidate_id = %s WHERE candidate_id = %s",
                                (placeholder_id, parser_id),
                            )
                            cursor.execute(f"DELETE FROM {CANDIDATES_TABLE} WHERE id = %s", (parser_id,))
                            if parsed_data:
                                cursor.execute(
                                    f"""UPDATE {CANDIDATES_TABLE}
                                        SET first_name = %s, last_name = %s, address = %s,
                                            phone = %s, email = %s, qualification = %s,
                                            visa_support = %s, work_authorization_type = %s,
                                            linkedin = %s, profile_picture_url = %s,
                                            parsed_at = %s, resume_parse_status = 'completed'
                                        WHERE id = %s""",
                                    (parsed_data["first_name"], parsed_data["last_name"],
                                     parsed_data["address"], parsed_data["phone"],
                                     parsed_data["email"], parsed_data["qualification"],
                                     parsed_data["visa_support"], parsed_data["work_authorization_type"],
                                     parsed_data["linkedin"], parsed_data["profile_picture_url"],
                                     parsed_data["parsed_at"], placeholder_id),
                                )
                            else:
                                cursor.execute(
                                    f"UPDATE {CANDIDATES_TABLE} SET resume_parse_status = 'completed' WHERE id = %s",
                                    (placeholder_id,),
                                )
                            final_candidate_id = placeholder_id
                    else:
                        # Parser updated placeholder in-place via ON CONFLICT — verify it has data
                        cursor.execute(
                            f"SELECT parsed_at FROM {CANDIDATES_TABLE} WHERE id = %s",
                            (placeholder_id,),
                        )
                        check = cursor.fetchone()
                        if check and check.get("parsed_at"):
                            cursor.execute(
                                f"UPDATE {CANDIDATES_TABLE} SET resume_parse_status = 'completed' WHERE id = %s",
                                (placeholder_id,),
                            )
                        else:
                            # Check first: did the parser reject this as not a resume?
                            _nar_lines = [l for l in stderr_text.splitlines() if "NotAResume:" in l]
                            if _nar_lines:
                                _nar_reason = _nar_lines[0].split("NotAResume:", 1)[-1].strip()[:300]
                                print(f"[NOT-A-RESUME] file={save_name} reason={_nar_reason} — deleting placeholder", flush=True)
                                # Delete the placeholder so not-a-resume files are never stored in DB
                                cursor.execute(f"DELETE FROM {SKILLS_TABLE} WHERE candidate_id = %s", (placeholder_id,))
                                cursor.execute(f"DELETE FROM {CANDIDATES_TABLE} WHERE id = %s", (placeholder_id,))
                                conn.commit()
                                return
                            # Parser returned rc=0 but didn't populate placeholder.
                            # Likely a transient text extraction failure (resource contention).
                            # Retry once with semaphore + delay so other parsers finish first.
                            _skip_reason = "Parser skipped file (text extraction failed — will retry)"
                            print(f"[PARSE RETRY] file={save_name} — parser skipped file, retrying once", flush=True)
                            conn.commit()  # commit current state before retry
                            try:
                                await asyncio.sleep(2)  # brief delay to let other parsers finish
                                _parse_waiting += 1
                                async with _parse_semaphore:
                                    _parse_waiting -= 1
                                    _parse_active += 1
                                    try:
                                        retry_result = await loop.run_in_executor(None, _run_parser)
                                    finally:
                                        _parse_active -= 1
                                retry_rc = retry_result.returncode
                                retry_stderr = (retry_result.stderr or b"").decode("utf-8", errors="replace")
                                if retry_rc != 0:
                                    print(f"[PARSE RETRY FAILED] file={save_name} rc={retry_rc}\nSTDERR: {retry_stderr[:500]}", flush=True)
                            except Exception as retry_err:
                                print(f"[PARSE RETRY ERROR] file={save_name} {retry_err}", flush=True)
                                retry_rc = -1

                            # Re-check placeholder after retry
                            with get_db() as conn2:
                                with conn2.cursor() as cur2:
                                    # Check for parser row from retry (email/name match)
                                    cur2.execute(
                                        f"""SELECT id FROM {CANDIDATES_TABLE}
                                            WHERE resume_filename = %s AND id != %s
                                            ORDER BY id DESC LIMIT 1""",
                                        (relative_filename, placeholder_id),
                                    )
                                    retry_parser_row = cur2.fetchone()
                                    if retry_parser_row:
                                        rpid = retry_parser_row["id"]
                                        cur2.execute(
                                            f"""SELECT first_name, last_name, address, phone, email,
                                                       qualification, visa_support, work_authorization_type,
                                                       linkedin, profile_picture_url, parsed_at
                                                FROM {CANDIDATES_TABLE} WHERE id = %s""",
                                            (rpid,),
                                        )
                                        rpdata = cur2.fetchone()
                                        # Check placeholder still exists before migrating skills
                                        # (a concurrent dedup may have already deleted it)
                                        cur2.execute(
                                            f"SELECT id FROM {CANDIDATES_TABLE} WHERE id = %s",
                                            (placeholder_id,),
                                        )
                                        placeholder_still_exists = cur2.fetchone() is not None
                                        if placeholder_still_exists:
                                            cur2.execute(f"DELETE FROM {SKILLS_TABLE} WHERE candidate_id = %s", (placeholder_id,))
                                            cur2.execute(
                                                f"UPDATE {SKILLS_TABLE} SET candidate_id = %s WHERE candidate_id = %s",
                                                (placeholder_id, rpid),
                                            )
                                            cur2.execute(f"DELETE FROM {CANDIDATES_TABLE} WHERE id = %s", (rpid,))
                                            if rpdata:
                                                cur2.execute(
                                                    f"""UPDATE {CANDIDATES_TABLE}
                                                        SET first_name=%s, last_name=%s, address=%s,
                                                            phone=%s, email=%s, qualification=%s,
                                                            visa_support=%s, work_authorization_type=%s,
                                                            linkedin=%s, profile_picture_url=%s,
                                                            parsed_at=%s, resume_parse_status='completed'
                                                        WHERE id=%s""",
                                                    (rpdata["first_name"], rpdata["last_name"],
                                                     rpdata["address"], rpdata["phone"],
                                                     rpdata["email"], rpdata["qualification"],
                                                     rpdata["visa_support"], rpdata["work_authorization_type"],
                                                     rpdata["linkedin"], rpdata["profile_picture_url"],
                                                     rpdata["parsed_at"], placeholder_id),
                                                )
                                            else:
                                                cur2.execute(
                                                    f"UPDATE {CANDIDATES_TABLE} SET resume_parse_status='completed' WHERE id=%s",
                                                    (placeholder_id,),
                                                )
                                        else:
                                            # Placeholder was deleted by concurrent dedup — use rpid directly
                                            print(f"[RETRY MERGE] placeholder_id={placeholder_id} gone, using rpid={rpid} as final", flush=True)
                                            if rpdata:
                                                cur2.execute(
                                                    f"UPDATE {CANDIDATES_TABLE} SET resume_parse_status='completed' WHERE id=%s",
                                                    (rpid,),
                                                )
                                            final_candidate_id = rpid
                                    else:
                                        cur2.execute(
                                            f"SELECT parsed_at FROM {CANDIDATES_TABLE} WHERE id = %s",
                                            (placeholder_id,),
                                        )
                                        recheck = cur2.fetchone()
                                        if recheck and recheck.get("parsed_at"):
                                            cur2.execute(
                                                f"UPDATE {CANDIDATES_TABLE} SET resume_parse_status='completed' WHERE id=%s",
                                                (placeholder_id,),
                                            )
                                        else:
                                            print(f"[PARSE RETRY EXHAUSTED] file={save_name} — deleting placeholder after retry", flush=True)
                                            # Delete the placeholder — failed parses are not stored so user can re-upload
                                            cur2.execute(
                                                f"DELETE FROM {CANDIDATES_TABLE} WHERE id = %s",
                                                (placeholder_id,),
                                            )
                                conn2.commit()
                            # Skip the outer conn.commit() — already committed above
                            final_candidate_id = placeholder_id
                            # Jump past the outer commit
                            conn.commit()

                            # Person-level dedup (same as main path)
                            await _dedup_candidate(final_candidate_id, f"file={save_name}")

                            # Stamp uploaded_by
                            if AUTH_AVAILABLE and auth_header.startswith("Bearer "):
                                try:
                                    from auth import decode_token, get_user_by_username
                                    payload = decode_token(auth_header[7:])
                                    uploader_username = payload.get("sub")
                                    if uploader_username:
                                        uploader = get_user_by_username(uploader_username)
                                        if uploader and uploader.get("id"):
                                            uploader_id = uploader["id"]
                                            with get_db() as conn:
                                                with conn.cursor() as cursor:
                                                    cursor.execute(
                                                        f"UPDATE {CANDIDATES_TABLE} SET uploaded_by = %s WHERE id = %s",
                                                        (uploader_id, final_candidate_id),
                                                    )
                                                    cursor.execute(
                                                        "UPDATE users SET resumes_uploaded = resumes_uploaded + 1 WHERE id = %s",
                                                        (uploader_id,),
                                                    )
                                                    cursor.execute("""
                                                        UPDATE login_sessions
                                                        SET resumes_uploaded_this_session = resumes_uploaded_this_session + 1
                                                        WHERE id = (
                                                            SELECT id FROM login_sessions
                                                            WHERE user_id = %s
                                                            ORDER BY logged_in_at DESC
                                                            LIMIT 1
                                                        )
                                                    """, (uploader_id,))
                                                conn.commit()
                                except Exception:
                                    import traceback
                                    traceback.print_exc()
                            return

                        final_candidate_id = placeholder_id
                conn.commit()

            # ── Person-level de-duplication ──────────────────────────────
            await _dedup_candidate(final_candidate_id, f"file={save_name}")

            # Stamp uploaded_by
            if AUTH_AVAILABLE and auth_header.startswith("Bearer "):
                try:
                    from auth import decode_token, get_user_by_username
                    payload = decode_token(auth_header[7:])
                    uploader_username = payload.get("sub")
                    if uploader_username:
                        uploader = get_user_by_username(uploader_username)
                        if uploader and uploader.get("id"):
                            uploader_id = uploader["id"]
                            with get_db() as conn:
                                with conn.cursor() as cursor:
                                    cursor.execute(
                                        f"UPDATE {CANDIDATES_TABLE} SET uploaded_by = %s WHERE id = %s",
                                        (uploader_id, final_candidate_id),
                                    )
                                    cursor.execute(
                                        "UPDATE users SET resumes_uploaded = resumes_uploaded + 1 WHERE id = %s",
                                        (uploader_id,),
                                    )
                                    cursor.execute("""
                                        UPDATE login_sessions
                                        SET resumes_uploaded_this_session = resumes_uploaded_this_session + 1
                                        WHERE id = (
                                            SELECT id FROM login_sessions
                                            WHERE user_id = %s
                                            ORDER BY logged_in_at DESC
                                            LIMIT 1
                                        )
                                    """, (uploader_id,))
                                conn.commit()
                except Exception:
                    import traceback
                    traceback.print_exc()

        except Exception as e:
            import traceback
            print(f"[BG PARSE ERROR] {save_name}: {e}\n{traceback.format_exc()}", flush=True)
            _bg_reason = f"{e.__class__.__name__}: {str(e)[:250]}"
            try:
                with get_db() as conn:
                    with conn.cursor() as cursor:
                        cursor.execute(
                            f"UPDATE {CANDIDATES_TABLE} SET resume_parse_status = 'failed', parse_failure_reason = %s WHERE id = %s",
                            (_bg_reason, placeholder_id),
                        )
                    conn.commit()
            except Exception:
                pass

    background_tasks.add_task(_background_parse)

    return {
        "status": "processing",
        "message": "Resume uploaded — parsing in background",
        "id": placeholder_id,
        "filename": save_name,
    }


@app.get("/upload-status/{candidate_id}")
async def get_upload_status(candidate_id: int):
    """Poll the parse status of a recently uploaded resume."""
    with get_db() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                f"""SELECT c.id, c.first_name, c.last_name, c.email, c.resume_parse_status,
                           c.parse_failure_reason, s.job_title
                    FROM {CANDIDATES_TABLE} c
                    LEFT JOIN {SKILLS_TABLE} s ON c.id = s.candidate_id
                    WHERE c.id = %s""",
                (candidate_id,),
            )
            row = cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Candidate not found")

    status = row.get("resume_parse_status", "completed")
    result = {"id": row["id"], "status": status}

    if status == "processing":
        result["queue_ahead"] = _parse_waiting + _parse_active

    if status == "completed":
        full_name = " ".join(filter(None, [row.get("first_name"), row.get("last_name")])) or None
        result.update({
            "name": full_name,
            "email": row.get("email"),
            "job_title": row.get("job_title"),
        })
    elif status == "not_a_resume":
        failure_reason = row.get("parse_failure_reason")
        result["message"] = failure_reason or "This file does not appear to be a resume"
    elif status == "failed":
        failure_reason = row.get("parse_failure_reason")
        result["message"] = failure_reason or "Resume parsing failed"

    return result


# Google Drive Integration Endpoints
@app.get("/gdrive/status")
async def gdrive_status():
    """Check Google Drive integration configuration status"""
    try:
        from pathlib import Path
        
        folder_id = os.getenv("GDRIVE_FOLDER_ID", "").strip()
        creds_json = os.getenv("GDRIVE_CREDENTIALS_JSON", "").strip()
        download_dir = os.getenv("GDRIVE_DOWNLOAD_DIR", "resumes_cache").strip()
        
        # Check if credentials file exists
        creds_path = Path(creds_json) if creds_json else None
        if creds_path and not creds_path.is_absolute():
            creds_path = Path(__file__).parent / creds_path
        
        return {
            "configured": bool(folder_id and creds_json),
            "folder_id": folder_id if folder_id else None,
            "credentials_file": creds_json if creds_json else None,
            "credentials_exists": creds_path.exists() if creds_path else False,
            "download_directory": download_dir,
            "download_dir_exists": Path(download_dir).exists() if download_dir else False
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/gdrive/sync")
async def gdrive_sync():
    """Trigger Google Drive folder sync"""
    try:
        from pathlib import Path
        from google_drive_sync import sync_drive_folder
        
        folder_id = os.getenv("GDRIVE_FOLDER_ID", "").strip()
        creds_json_name = os.getenv("GDRIVE_CREDENTIALS_JSON", "").strip()
        token_json_name = os.getenv("GDRIVE_TOKEN_JSON", ".gdrive_token.json").strip()
        download_dir_name = os.getenv("GDRIVE_DOWNLOAD_DIR", "resumes_cache").strip()
        
        if not folder_id:
            raise HTTPException(status_code=400, detail="GDRIVE_FOLDER_ID not configured")
        if not creds_json_name:
            raise HTTPException(status_code=400, detail="GDRIVE_CREDENTIALS_JSON not configured")
        
        # Resolve paths relative to Backend folder
        backend_dir = Path(__file__).parent
        creds_json = backend_dir / creds_json_name
        token_json = backend_dir / token_json_name
        download_dir = backend_dir / download_dir_name
        
        if not creds_json.exists():
            raise HTTPException(
                status_code=400, 
                detail=f"Credentials file not found: {creds_json_name}"
            )
        
        # Perform sync
        scanned, downloaded = sync_drive_folder(
            folder_id=folder_id,
            download_dir=download_dir,
            credentials_json=creds_json,
            token_json=token_json,
            allowed_exts={".pdf", ".docx"}
        )
        
        return {
            "success": True,
            "scanned": scanned,
            "downloaded": downloaded,
            "download_directory": str(download_dir),
            "message": f"Scanned {scanned} files, downloaded {downloaded} new/updated files"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@app.post("/gdrive/sync-and-parse")
async def gdrive_sync_and_parse(background_tasks: BackgroundTasks):
    """Sync from Google Drive and immediately parse new resumes"""
    try:
        from pathlib import Path
        from google_drive_sync import sync_drive_folder
        import asyncio
        import sys
        
        folder_id = os.getenv("GDRIVE_FOLDER_ID", "").strip()
        creds_json_name = os.getenv("GDRIVE_CREDENTIALS_JSON", "").strip()
        token_json_name = os.getenv("GDRIVE_TOKEN_JSON", ".gdrive_token.json").strip()
        download_dir_name = os.getenv("GDRIVE_DOWNLOAD_DIR", "resumes_cache").strip()
        
        if not folder_id or not creds_json_name:
            raise HTTPException(
                status_code=400, 
                detail="Google Drive not configured (missing GDRIVE_FOLDER_ID or GDRIVE_CREDENTIALS_JSON)"
            )
        
        # Resolve paths
        backend_dir = Path(__file__).parent
        creds_json = backend_dir / creds_json_name
        token_json = backend_dir / token_json_name
        download_dir = backend_dir / download_dir_name
        
        if not creds_json.exists():
            raise HTTPException(
                status_code=400, 
                detail=f"Credentials file not found: {creds_json_name}"
            )
        
        # Perform sync
        scanned, downloaded = sync_drive_folder(
            folder_id=folder_id,
            download_dir=download_dir,
            credentials_json=creds_json,
            token_json=token_json,
            allowed_exts={".pdf", ".docx"}
        )
        
        # If new files were downloaded, run parser in background
        parsed_count = 0
        if downloaded > 0:
            parser_script = backend_dir / "parser.py"
            if parser_script.exists():
                # Run parser in background task
                async def run_parser_async():
                    try:
                        env = os.environ.copy()
                        env["RESUME_INPUT_DIR"] = str(download_dir)
                        env["SKIP_EXISTING"] = "1"
                        
                        print(f"[OK] Starting background parse of {downloaded} new resumes...")
                        process = await asyncio.create_subprocess_exec(
                            sys.executable, str(parser_script),
                            cwd=str(backend_dir),
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE,
                            env=env
                        )
                        stdout, stderr = await process.communicate()
                        
                        if process.returncode == 0:
                            print(f"[OK] Successfully parsed {downloaded} resumes")
                        else:
                            print(f"[WARN] Parser completed with errors:")
                            print(f"Output: {stdout.decode()}")
                            print(f"Errors: {stderr.decode()}")
                    except Exception as e:
                        print(f"[ERROR] Background parser failed: {e}")
                
                background_tasks.add_task(run_parser_async)
                parsed_count = downloaded  # Will be parsed in background
        
        return {
            "success": True,
            "scanned": scanned,
            "downloaded": downloaded,
            "parsed": parsed_count,
            "download_directory": str(download_dir),
            "message": f"Scanned {scanned} files, downloaded {downloaded} new files, parsed {parsed_count} resumes"
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"[ERROR] Sync error: {error_details}")
        raise HTTPException(status_code=500, detail=f"Sync and parse failed: {str(e)}")


# Initialize Chatbot
chatbot_instance = None
if CHATBOT_AVAILABLE:
    try:
        chatbot_instance = create_resume_chatbot(
            lambda: psycopg2.connect(
                dbname=os.getenv("DB_NAME"),
                user=os.getenv("DB_USER"),
                password=os.getenv("DB_PASSWORD"),
                host=os.getenv("DB_HOST"),
                port=os.getenv("DB_PORT")
            ),
            CANDIDATES_TABLE,
            SKILLS_TABLE
        )
        print("[OK] Chatbot initialized successfully")
    except Exception as e:
        print(f"[WARN] Warning: Could not initialize chatbot: {e}")
else:
    print("[WARN] Chatbot module not available - running without chatbot features")


# Chatbot API Endpoints
@app.post("/chatbot/message")
async def chatbot_message(request: Request):
    """Process a chatbot message"""
    if not chatbot_instance:
        raise HTTPException(status_code=503, detail="Chatbot not available")
    
    try:
        data = await request.json()
        message = data.get("message", "")
        user_id = data.get("user_id")
        
        if not message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        response = chatbot_instance.process_message(message, user_id)
        return response
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/chatbot/greeting")
async def chatbot_greeting():
    """Get initial chatbot greeting message"""
    if not chatbot_instance:
        raise HTTPException(status_code=503, detail="Chatbot not available")
    
    return chatbot_instance.get_greeting()


@app.get("/chatbot/history")
async def chatbot_history():
    """Get conversation history"""
    if not chatbot_instance:
        raise HTTPException(status_code=503, detail="Chatbot not available")
    
    return {
        "history": chatbot_instance.conversation_history[-20:]  # Last 20 messages
    }


@app.post("/chatbot/clear")
async def chatbot_clear():
    """Clear conversation history"""
    if not chatbot_instance:
        raise HTTPException(status_code=503, detail="Chatbot not available")
    
    chatbot_instance.clear_history()
    return {"message": "History cleared"}


@app.get("/chatbot/roles")
async def chatbot_roles():
    """Return distinct job titles for chatbot role-picker UI.

    Applies the same noise filtering and case-insensitive de-duplication
    as the /job-titles/all endpoint so both UIs show consistent data.
    """
    import re as _re
    _NOISE = _re.compile(
        r"(^.{0,3}$"                         # too short
        r"|^.{80,}$"                          # too long
        r"|[(){}\[\]]"                        # contains brackets
        r"|\bsuch as\b|\bwithin\b|\bframework like\b"
        r"|\bexperienced? with\b"
        r"|\band backend\b|\band frontend\b"
        r"|\bservices\)"                       # fragment
        r")",
        _re.IGNORECASE,
    )
    with get_db() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                f"""SELECT job_title, COUNT(*) AS cnt
                    FROM {SKILLS_TABLE}
                    WHERE job_title IS NOT NULL AND job_title != ''
                    GROUP BY job_title
                    ORDER BY cnt DESC"""
            )
            raw = cursor.fetchall()

    # Case-insensitive de-duplication: keep the variant with highest count
    seen: dict[str, str] = {}  # lower -> best-variant
    for row in raw:
        title = row["job_title"].strip()
        if _NOISE.search(title):
            continue
        key = title.lower()
        if key not in seen:
            seen[key] = title

    return sorted(seen.values(), key=str.lower)


@app.get("/chatbot/search")
async def chatbot_search(q: str = ""):
    """Search candidates by query string (name, job title, skills, location)"""
    query = q.strip()
    if not query:
        return []

    words = [w for w in query.split() if w]
    with get_db() as conn:
        with conn.cursor() as cursor:
            conditions = []
            params = []
            for word in words:
                pattern = f"%{word}%"
                conditions.append(
                    """(
                        c.first_name ILIKE %s
                        OR c.last_name ILIKE %s
                        OR CONCAT(c.first_name, ' ', c.last_name) ILIKE %s
                        OR c.address ILIKE %s
                        OR s.job_title ILIKE %s
                        OR s.tech_skills ILIKE %s
                    )"""
                )
                params.extend([pattern] * 6)

            where_clause = " AND ".join(conditions) if conditions else "TRUE"
            cursor.execute(
                f"""SELECT DISTINCT c.id, c.first_name, c.last_name, c.email, c.phone,
                           c.address, c.resume_filename, c.profile_picture_url,
                           c.linkedin, c.visa_support,
                           c.work_authorization_type as work_authorization,
                           s.job_title, s.tech_skills, s.certifications,
                           s.years_of_experience as professional_experience,
                           c.qualification, c.education_structured
                    FROM {CANDIDATES_TABLE} c
                    LEFT JOIN {SKILLS_TABLE} s ON c.id = s.candidate_id
                    WHERE {where_clause}
                    ORDER BY c.id
                    LIMIT 50""",
                params,
            )
            rows = cursor.fetchall()

    return [
        Candidate(
            id=row["id"],
            first_name=row.get("first_name"),
            last_name=row.get("last_name"),
            address=row.get("address"),
            location=row.get("address"),
            resume_filename=row.get("resume_filename"),
            profile_picture_url=row.get("profile_picture_url"),
            job_title=row.get("job_title"),
            qualification=row.get("qualification"),
            linkedin=row.get("linkedin"),
            visa_support="Yes" if row.get("visa_support") else "No" if row.get("visa_support") is not None else None,
            work_authorization=row.get("work_authorization"),
            email=row.get("email"),
            phone=row.get("phone"),
            emails=_as_list(row.get("email")),
            phones=_as_list(row.get("phone")),
            certifications=row.get("certifications"),
            tech_skills=row.get("tech_skills"),
            skills=_split_csv(row.get("tech_skills")),
            professional_experience=str(row.get("professional_experience")) if row.get("professional_experience") is not None else None,
            education=_build_education(row),
            experience=Experience(
                job_title=row.get("job_title"),
                years_of_experience=float(row.get("professional_experience")) if row.get("professional_experience") is not None else None,
                certifications=_split_csv(row.get("certifications")),
            ),
        )
        for row in rows
    ]


# ---------------------------------------------------------------------------
# Chat session stubs (frontend calls these for session persistence;
# we return lightweight 200 responses so the UI doesn't error)
# ---------------------------------------------------------------------------

@app.post("/chat/session")
async def chat_create_session():
    """Create a new chat session (stub — returns a UUID)"""
    import uuid
    return {"session_id": str(uuid.uuid4()), "status": "ok"}


@app.get("/chat/history/{session_id}")
async def chat_get_history(session_id: str):
    """Get chat history for a session (stub — returns empty)"""
    return {"messages": [], "session_id": session_id}


@app.post("/chat/message/{session_id}")
async def chat_post_message(session_id: str, request: Request):
    """Persist a chat message (stub — no-op)"""
    return {"status": "ok", "session_id": session_id}


@app.delete("/chat/history/{session_id}")
async def chat_delete_history(session_id: str):
    """Delete chat history for a session (stub — no-op)"""
    return {"status": "ok", "session_id": session_id}


# ---------------------------------------------------------------------------
# EMAIL GENERATION
# ---------------------------------------------------------------------------

class GenerateEmailRequest(BaseModel):
    # Personal / Contact
    name: Optional[str] = None
    location: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    linkedin: Optional[str] = None
    dob_year: Optional[str] = None
    video_interview: Optional[str] = None
    # Education
    degree: Optional[str] = None
    specialization: Optional[str] = None
    university: Optional[str] = None
    campus: Optional[str] = None
    grad_year: Optional[str] = None
    # Work / Submission
    job_title: Optional[str] = None
    experience_years: Optional[str] = None
    submittal_type: Optional[str] = None
    authorized: Optional[str] = None
    sponsorship: Optional[str] = None
    work_authorization: Optional[str] = None
    rate: Optional[str] = None
    availability: Optional[str] = None
    passport: Optional[str] = None
    # Signature
    recruiter_name: Optional[str] = None


# ── HTML email helpers ────────────────────────────────────────────────────────

def _esc(s: str) -> str:
    """Minimal HTML escape."""
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# Inline styles — no external CSS so Outlook renders correctly
_TABLE_STYLE = (
    'border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;'
    'font-size:11pt;'
)
_LABEL_CELL = (
    'border:1px solid #000;padding:6px 10px;background:#D9E1F2;'
    'font-weight:normal;width:50%;vertical-align:top;'
)
_VALUE_CELL = (
    'border:1px solid #000;padding:6px 10px;background:#FFFFFF;'
    'width:50%;vertical-align:top;'
)


def _html_table(rows: list, caption: str = "") -> str:
    """
    Build one Excel-style HTML table.
    rows = list of (label, value) tuples.
    """
    parts = []
    if caption:
        parts.append(
            f'<p style="margin:8px 0 2px 0;font-family:Calibri,Arial,sans-serif;'
            f'font-size:11pt;font-weight:bold;">{_esc(caption)}</p>'
        )
    parts.append(f'<table style="{_TABLE_STYLE}">')
    for label, value in rows:
        parts.append(
            f'<tr>'
            f'<td style="{_LABEL_CELL}">{_esc(label)}</td>'
            f'<td style="{_VALUE_CELL}">{_esc(value)}</td>'
            f'</tr>'
        )
    parts.append('</table>')
    return "\n".join(parts)


def _compose_email(data: GenerateEmailRequest) -> dict:
    """Return subject + html_body with three Excel-style HTML tables."""
    name = (data.name or "").strip() or "Candidate"
    job  = (data.job_title or "").strip()

    subject = (
        f"Candidate Submission: {name} - {job}"
        if job
        else f"Candidate Submission: {name}"
    )

    # ── Section 1 : Personal / Contact ───────────────────────────────────────
    personal_rows = [
        ("Full name of Candidate",                           name),
        ("Current location (City, State and Zip code)",      data.location or ""),
        ("Phone(s)",                                         data.phone or ""),
        ("E-mail ID(s)",                                     data.email or ""),
        ("Date of birth (year) if provided by candidate: -", data.dob_year or ""),
        ("LinkedIn URL",                                     data.linkedin or ""),
        (
            "Is the candidate aware of Video interview and ready to take "
            "video interview on Webex / Zoom?",
            data.video_interview or "Yes",
        ),
    ]

    # ── Section 2 : Education ────────────────────────────────────────────────
    degree_label = data.degree or ""
    if data.specialization:
        degree_label = f"{degree_label} {data.specialization}".strip()
    degree_value = f"{degree_label} / {data.campus}".strip(" /") if data.campus else degree_label

    edu_rows = [
        ("Bachelor's degree in",  degree_value),
        ("University",            data.university or ""),
        ("Year of completion",    data.grad_year or ""),
        ("Highest Education",     degree_label),
        ("University",            data.university or ""),
        ("Year of completion",    data.grad_year or ""),
    ]

    # ── Section 3 : Work / Submission ────────────────────────────────────────
    work_rows = [
        ("Submittal type (C2C or FTE to CitiusTech)",                data.submittal_type or ""),
        ("Is the candidate authorized to work legally in the US?",   data.authorized or "Yes"),
        ("Does the candidate require any sponsorship (now or future)?", data.sponsorship or "No"),
        ("Work authorization type",                                  data.work_authorization or ""),
        ("Rate (per hour on C2C to CitiusTech)",                     data.rate or ""),
        ("Available to join (including relocation time):",           data.availability or ""),
        ("Passport Number",                                          data.passport or ""),
    ]

    # ── Assemble full HTML body ───────────────────────────────────────────────
    sig = _esc(data.recruiter_name) if data.recruiter_name else ""
    html_body = f"""<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt;">
<p>Hello,</p>
<p>Please find below the candidate details for your review:</p>

{_html_table(personal_rows)}

<br/>
{_html_table(edu_rows)}

<br/>
{_html_table(work_rows)}

<p>Please let me know if you need any additional information.</p>
<p>Best regards{"<br/>" + sig if sig else ""}</p>
</div>"""

    return {"subject": subject, "html_body": html_body}


@app.post("/email/generate")
async def generate_email(data: GenerateEmailRequest):
    """Generate a formatted candidate-submission email subject + body."""
    return _compose_email(data)


@app.post("/email/parse-document")
async def parse_additional_document(file: UploadFile = File(...)):
    """
    Accept an uploaded PDF or DOCX file; extract key fields using the
    existing parser and return them as a flat JSON object that the
    frontend can merge into the compose form.
    """
    allowed = {".pdf", ".docx", ".doc"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Please upload PDF or DOCX.",
        )

    # Save to temp file
    suffix = ext
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        # Import parser functions lazily so the endpoint starts even if
        # optional deps are missing.
        from parser import (
            extract_text_from_docx,
            extract_text_from_pdf,
            extract_email,
            extract_phone,
            extract_name,
        )
        from education_parser import parse_education_section

        if ext == ".pdf":
            text = extract_text_from_pdf(tmp_path)
        else:
            text = extract_text_from_docx(tmp_path)

        email_val = (extract_email(text) or [None])[0]
        phone_val = (extract_phone(text) or [None])[0]
        first, last = extract_name(text, email=email_val)
        name = f"{first} {last}".strip() or None

        edu_entries = []
        try:
            raw_edu = parse_education_section(text)
            edu_entries = [{k: v for k, v in e.items() if k != "raw_line"} for e in raw_edu]
        except Exception:
            pass

        first_edu = edu_entries[0] if edu_entries else {}

        return {
            "name": name,
            "email": email_val,
            "phone": phone_val,
            "degree": first_edu.get("degree"),
            "specialization": first_edu.get("specialization"),
            "university": first_edu.get("university"),
            "education_list": edu_entries,
            "raw_text_preview": text[:500] if text else "",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Parsing failed: {exc}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# Mount built frontend for production (only when SERVE_FRONTEND env var is set)
# To enable: set SERVE_FRONTEND=1 in .env or environment
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "Frontend", "dist")
if os.path.exists(frontend_dist) and os.getenv("SERVE_FRONTEND", "0") == "1":
    # Serve static files (CSS, JS, images) from /assets
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    
    print(f"[OK] Serving built frontend from {frontend_dist}")
    print(f"   Access UI at: http://localhost:8000/")

# ── Admin: User stats endpoint ────────────────────────────────────────────────
# NOTE: Admin endpoints MUST be registered BEFORE the SPA catch-all below,
# otherwise "/{full_path:path}" will intercept /api/admin/* requests.
@app.get("/api/admin/users")
async def admin_get_users(request: Request):
    """
    Admin dashboard query — returns all users with their upload counts,
    login counts, and last login time.

    This runs the query:
        SELECT u.username, u.email, u.role, u.last_login,
               u.total_logins, COUNT(cp.id) AS resumes_uploaded
        FROM users u
        LEFT JOIN candidate_profile cp ON cp.uploaded_by = u.id
        GROUP BY u.id
        ORDER BY u.created_at;

    Used by: Frontend AdminDashboard page → axios.get("/api/admin/users")
    Called when: Admin opens the user management / stats page.

    Production note:
        - uploads done via /upload-resume set cp.uploaded_by = user_id
        - uploads done before auth existed have cp.uploaded_by = NULL (not counted here)
        - COUNT(cp.id) only counts resumes uploaded AFTER auth was introduced
    """
    with get_db() as conn:
        with conn.cursor() as cursor:
            # Check users table exists (migration may not have run yet)
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'users'
                )
            """)
            if not cursor.fetchone()["exists"]:
                raise HTTPException(
                    status_code=503,
                    detail="Auth tables not set up yet. Run: python migrate_auth.py"
                )

            cursor.execute("""
                SELECT
                    u.id,
                    u.username,
                    u.email,
                    u.role,
                    u.is_active,
                    u.total_logins,
                    u.last_login,
                    u.last_ip,
                    u.created_at,
                    COUNT(cp.id) AS resumes_uploaded
                FROM users u
                LEFT JOIN candidate_profile cp ON cp.uploaded_by = u.id
                    AND (cp.resume_parse_status IS NULL OR cp.resume_parse_status = 'completed')
                GROUP BY u.id
                ORDER BY u.created_at
            """)
            rows = cursor.fetchall()

    return [
        {
            "id":               r["id"],
            "username":         r["username"],
            "email":            r["email"],
            "role":             r["role"],
            "is_active":        r["is_active"],
            "total_logins":     r["total_logins"],
            "last_login":       r["last_login"].isoformat() if r["last_login"] else None,
            "last_ip":          r["last_ip"],
            "created_at":       r["created_at"].isoformat() if r["created_at"] else None,
            "resumes_uploaded": r["resumes_uploaded"],
        }
        for r in rows
    ]


@app.get("/api/admin/upload-metrics")
async def admin_upload_metrics(request: Request):
    """Return upload time-series data grouped by user for the Upload Metrics dashboard."""
    from datetime import datetime, timedelta
    with get_db() as conn:
        with conn.cursor() as cursor:
            # Get all users
            cursor.execute("SELECT id, username FROM users ORDER BY created_at")
            users_rows = cursor.fetchall()
            if not users_rows:
                return {"users": [], "dailyData": [], "weeklyData": [], "monthlyData": [], "yearlyData": [], "userSummaries": []}

            user_map = {r["id"]: r["username"] for r in users_rows}
            user_ids = list(user_map.keys())

            # Grand total of unique successfully parsed resumes in DB.
            # Deduped by email (same as People Search) — same person uploaded twice counts once.
            cursor.execute(f"""SELECT COUNT(*) AS total FROM {CANDIDATES_TABLE} c
                WHERE c.resume_parse_status = 'completed'
                  AND (c.email IS NULL OR c.email = '' OR NOT EXISTS (
                    SELECT 1 FROM {CANDIDATES_TABLE} newer
                    WHERE LOWER(newer.email) = LOWER(c.email) AND newer.id > c.id
                ))""")
            total_resumes = cursor.fetchone()["total"]

            # Get daily upload counts per user for last 90 days (completed only)
            # Counts every successful upload — dedup is intentionally NOT applied here
            # because metrics track user activity (how many resumes were processed),
            # Deduped by email — same person uploaded twice counts once (on the day of the newer upload).
            cursor.execute(f"""
                SELECT DATE(c.parsed_at) as day, c.uploaded_by, COUNT(*) as cnt
                FROM {CANDIDATES_TABLE} c
                WHERE c.parsed_at IS NOT NULL AND c.uploaded_by IS NOT NULL
                  AND c.resume_parse_status = 'completed'
                  AND c.parsed_at >= CURRENT_DATE - INTERVAL '90 days'
                  AND (c.email IS NULL OR c.email = '' OR NOT EXISTS (
                    SELECT 1 FROM {CANDIDATES_TABLE} newer
                    WHERE LOWER(newer.email) = LOWER(c.email) AND newer.id > c.id
                  ))
                GROUP BY DATE(c.parsed_at), c.uploaded_by
                ORDER BY day
            """)
            daily_rows = cursor.fetchall()

            # Build daily data keyed by date
            today = datetime.now().date()
            daily_map = {}
            for r in daily_rows:
                day_str = r["day"].strftime("%Y-%m-%d")
                if day_str not in daily_map:
                    daily_map[day_str] = {"date": day_str}
                uname = user_map.get(r["uploaded_by"], "unknown")
                daily_map[day_str][uname] = r["cnt"]

            # Fill in missing days for last 90 days
            daily_data = []
            for i in range(90, -1, -1):
                d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
                entry = daily_map.get(d, {"date": d})
                entry["date"] = d
                daily_data.append(entry)

            # Aggregate weekly (last 24 weeks)
            weekly_data = []
            for w in range(23, -1, -1):
                week_start = today - timedelta(weeks=w, days=today.weekday())
                week_end = week_start + timedelta(days=6)
                label = f"W{week_start.isocalendar()[1]} {week_start.year}"
                entry = {"date": label}
                for uid, uname in user_map.items():
                    total = 0
                    for dd in daily_data:
                        dd_date = datetime.strptime(dd["date"], "%Y-%m-%d").date()
                        if week_start <= dd_date <= week_end:
                            total += dd.get(uname, 0)
                    if total > 0:
                        entry[uname] = total
                weekly_data.append(entry)

            # Aggregate monthly (last 12 months)
            monthly_data = []
            for m in range(11, -1, -1):
                month_date = today.replace(day=1) - timedelta(days=m * 28)
                month_date = month_date.replace(day=1)
                label = month_date.strftime("%b %Y")
                entry = {"date": label}
                for uid, uname in user_map.items():
                    total = 0
                    for dd in daily_data:
                        dd_date = datetime.strptime(dd["date"], "%Y-%m-%d").date()
                        if dd_date.year == month_date.year and dd_date.month == month_date.month:
                            total += dd.get(uname, 0)
                    if total > 0:
                        entry[uname] = total
                monthly_data.append(entry)

            # Aggregate yearly (last 3 years)
            yearly_data = []
            for y in range(2, -1, -1):
                year = today.year - y
                label = str(year)
                entry = {"date": label}
                for uid, uname in user_map.items():
                    total = 0
                    for dd in daily_data:
                        dd_date = datetime.strptime(dd["date"], "%Y-%m-%d").date()
                        if dd_date.year == year:
                            total += dd.get(uname, 0)
                    if total > 0:
                        entry[uname] = total
                yearly_data.append(entry)

            # User summaries
            user_colors = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EC4899", "#14B8A6", "#6366F1", "#EF4444"]
            today_str = today.strftime("%Y-%m-%d")
            users_list = []
            user_summaries = []
            for idx, (uid, uname) in enumerate(user_map.items()):
                color = user_colors[idx % len(user_colors)]
                users_list.append({"id": uid, "name": uname, "color": color})

                today_count = daily_map.get(today_str, {}).get(uname, 0)
                last7 = sum(daily_map.get((today - timedelta(days=i)).strftime("%Y-%m-%d"), {}).get(uname, 0) for i in range(7))
                last30 = sum(daily_map.get((today - timedelta(days=i)).strftime("%Y-%m-%d"), {}).get(uname, 0) for i in range(30))
                total = sum(dd.get(uname, 0) for dd in daily_data)

                # Weekly trend: (this week - last week) / last week * 100
                this_week = sum(daily_map.get((today - timedelta(days=i)).strftime("%Y-%m-%d"), {}).get(uname, 0) for i in range(7))
                last_week = sum(daily_map.get((today - timedelta(days=i)).strftime("%Y-%m-%d"), {}).get(uname, 0) for i in range(7, 14))
                weekly_trend = round(((this_week - last_week) / max(last_week, 1)) * 100)

                # Monthly trend
                this_month = sum(daily_map.get((today - timedelta(days=i)).strftime("%Y-%m-%d"), {}).get(uname, 0) for i in range(30))
                last_month = sum(daily_map.get((today - timedelta(days=i)).strftime("%Y-%m-%d"), {}).get(uname, 0) for i in range(30, 60))
                monthly_trend = round(((this_month - last_month) / max(last_month, 1)) * 100)

                user_summaries.append({
                    "id": uid, "name": uname, "color": color,
                    "today": today_count, "last7": last7, "last30": last30, "total": total,
                    "weeklyTrend": weekly_trend, "monthlyTrend": monthly_trend,
                })

            return {
                "users": users_list,
                "dailyData": daily_data,
                "weeklyData": weekly_data,
                "monthlyData": monthly_data,
                "yearlyData": yearly_data,
                "userSummaries": user_summaries,
                "total_resumes": total_resumes,
            }


# ─── LinkedIn Extension: Add candidate from LinkedIn profile ──────────
class LinkedInCandidate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    headline: Optional[str] = None
    current_company: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    skills: Optional[List[str]] = None
    experience: Optional[List[dict]] = None
    education: Optional[List[dict]] = None
    years_of_experience: Optional[float] = None
    about: Optional[str] = None


@app.post("/api/linkedin/parse")
async def linkedin_parse(data: LinkedInCandidate, current_user: dict = Depends(get_current_user)):
    """Add a candidate extracted from LinkedIn via KPRMT Chrome extension."""
    if not data.first_name or not data.first_name.strip():
        raise HTTPException(status_code=400, detail="First name is required")

    import json as _json

    # Ensure required columns exist (idempotent — safe to run on every call)
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                for col_sql in [
                    f"ALTER TABLE {CANDIDATES_TABLE} ADD COLUMN education_structured JSONB",
                    f"ALTER TABLE {CANDIDATES_TABLE} ADD COLUMN work_experience_structured JSONB",
                    f"ALTER TABLE {CANDIDATES_TABLE} ADD COLUMN linkedin TEXT",
                ]:
                    cur.execute(f"""
                        DO $$ BEGIN {col_sql};
                        EXCEPTION WHEN duplicate_column THEN NULL; END $$
                    """)
            conn.commit()
    except Exception:
        pass

    with get_db() as conn:
        with conn.cursor() as cursor:
            # ── Duplicate detection: try linkedin_url first, then full name ──
            existing = None
            if data.linkedin_url:
                norm_url = data.linkedin_url.rstrip('/')
                cursor.execute(
                    f"SELECT id FROM {CANDIDATES_TABLE} WHERE RTRIM(linkedin, '/') = %s ORDER BY id DESC LIMIT 1",
                    (norm_url,),
                )
                existing = cursor.fetchone()

            if not existing and data.first_name:
                fn = data.first_name.strip().lower()
                ln = (data.last_name or "").strip().lower()
                cursor.execute(
                    f"""SELECT id FROM {CANDIDATES_TABLE}
                        WHERE LOWER(TRIM(first_name)) = %s AND LOWER(TRIM(last_name)) = %s
                        ORDER BY id DESC LIMIT 1""",
                    (fn, ln),
                )
                existing = cursor.fetchone()

            if existing:
                candidate_id = existing["id"]
                fn_clean = data.first_name.strip().lower()
                ln_clean = (data.last_name or "").strip().lower()
                cursor.execute(
                    f"""DELETE FROM {SKILLS_TABLE}
                        WHERE candidate_id IN (
                            SELECT id FROM {CANDIDATES_TABLE}
                            WHERE LOWER(TRIM(first_name)) = %s
                              AND LOWER(TRIM(last_name)) = %s
                              AND id != %s
                        )""",
                    (fn_clean, ln_clean, candidate_id),
                )
                cursor.execute(
                    f"""DELETE FROM {CANDIDATES_TABLE}
                        WHERE LOWER(TRIM(first_name)) = %s
                          AND LOWER(TRIM(last_name)) = %s
                          AND id != %s""",
                    (fn_clean, ln_clean, candidate_id),
                )
                upd_edu_structured = None
                if data.education:
                    norm = []
                    for edu in data.education:
                        if isinstance(edu, dict):
                            norm.append({
                                "university": edu.get("school") or edu.get("university", ""),
                                "degree": edu.get("degree", ""),
                                "specialization": edu.get("field") or edu.get("specialization", ""),
                                "grad_year": edu.get("graduationYear") or edu.get("grad_year", ""),
                                "dates": edu.get("dates", ""),
                            })
                    if norm:
                        upd_edu_structured = _json.dumps(norm)
                upd_work_exp = _json.dumps(data.experience) if data.experience else None
                cursor.execute(
                    f"""UPDATE {CANDIDATES_TABLE}
                        SET first_name = %s, last_name = %s,
                            email = COALESCE(%s, email),
                            phone = COALESCE(%s, phone),
                            address = COALESCE(%s, address),
                            linkedin = %s,
                            education_structured = COALESCE(%s::jsonb, education_structured),
                            work_experience_structured = COALESCE(%s::jsonb, work_experience_structured),
                            parsed_at = NOW(),
                            resume_parse_status = 'completed'
                        WHERE id = %s""",
                    (
                        data.first_name.strip(),
                        data.last_name.strip() if data.last_name else "",
                        data.email.strip() if data.email else None,
                        data.phone.strip() if data.phone else None,
                        data.location.strip() if data.location else None,
                        data.linkedin_url,
                        upd_edu_structured,
                        upd_work_exp,
                        candidate_id,
                    ),
                )
                job_title = data.job_title or data.headline or ""
                tech_skills = ", ".join(data.skills) if data.skills else None
                cursor.execute(f"SELECT candidate_id FROM {SKILLS_TABLE} WHERE candidate_id = %s", (candidate_id,))
                if cursor.fetchone():
                    cursor.execute(
                        f"""UPDATE {SKILLS_TABLE}
                            SET job_title = %s, tech_skills = %s,
                                years_of_experience = %s, parsed_at = NOW()
                            WHERE candidate_id = %s""",
                        (job_title, tech_skills, data.years_of_experience, candidate_id),
                    )
                else:
                    cursor.execute(
                        f"""INSERT INTO {SKILLS_TABLE}
                            (candidate_id, job_title, tech_skills, years_of_experience, parsed_at)
                            VALUES (%s, %s, %s, %s, NOW())""",
                        (candidate_id, job_title, tech_skills, data.years_of_experience),
                    )
                conn.commit()
                print(f"[LINKEDIN] Updated id={candidate_id} ({data.first_name} {data.last_name}) by {current_user.get('username', '?')}", flush=True)
                return {"success": True, "candidate_id": candidate_id, "action": "updated", "message": "Candidate updated in People Search"}

            # ── Insert new candidate ──
            edu_structured = None
            if data.education:
                normalized_edu = []
                for edu in data.education:
                    if isinstance(edu, dict):
                        normalized_edu.append({
                            "university": edu.get("school") or edu.get("university", ""),
                            "degree": edu.get("degree", ""),
                            "specialization": edu.get("field") or edu.get("specialization", ""),
                            "grad_year": edu.get("graduationYear") or edu.get("grad_year", ""),
                            "dates": edu.get("dates", ""),
                        })
                if normalized_edu:
                    edu_structured = _json.dumps(normalized_edu)
            work_exp_structured = _json.dumps(data.experience) if data.experience else None
            cursor.execute(
                f"""INSERT INTO {CANDIDATES_TABLE}
                    (first_name, last_name, email, phone, address, linkedin,
                     education_structured, work_experience_structured, parsed_at, resume_parse_status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, NOW(), 'completed')
                    RETURNING id""",
                (
                    data.first_name.strip(),
                    data.last_name.strip() if data.last_name else "",
                    data.email.strip() if data.email else None,
                    data.phone.strip() if data.phone else None,
                    data.location.strip() if data.location else None,
                    data.linkedin_url or None,
                    edu_structured,
                    work_exp_structured,
                ),
            )
            new_row = cursor.fetchone()
            candidate_id = new_row["id"]
            job_title = data.job_title or data.headline or ""
            tech_skills = ", ".join(data.skills) if data.skills else None
            cursor.execute(
                f"""INSERT INTO {SKILLS_TABLE}
                    (candidate_id, job_title, tech_skills, years_of_experience, parsed_at)
                    VALUES (%s, %s, %s, %s, NOW())""",
                (candidate_id, job_title, tech_skills, data.years_of_experience),
            )
            conn.commit()
            print(f"[LINKEDIN] Created id={candidate_id} ({data.first_name} {data.last_name}) by {current_user.get('username', '?')}", flush=True)
            return {"success": True, "candidate_id": candidate_id, "action": "created", "message": "Candidate added to People Search"}


# SPA catch-all: serve index.html for any non-API, non-asset path
# This supports React-Router client-side routing (page refresh on /jobs, /upload, etc.)
# MUST be the very last route registered — after all API endpoints.
if os.path.exists(frontend_dist) and os.getenv("SERVE_FRONTEND", "0") == "1":
    @app.get("/{full_path:path}")
    async def spa_catch_all(full_path: str):
        index_file_path = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file_path):
            return _html_response(index_file_path)
        raise HTTPException(status_code=404, detail="Not found")


if __name__ == "__main__":
    import uvicorn
    
    # Check database connection
    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                cursor.execute(f"SELECT COUNT(*) as total FROM {CANDIDATES_TABLE}")
                result = cursor.fetchone()
                count = result["total"] if result else 0
                print(f"[OK] Connected to PostgreSQL database")
                print(f"📊 Found {count} candidates in database")
    except Exception as e:
        print(f"[WARN] Warning: Could not connect to database: {e}")
        print("Please check your database configuration in .env file")
        print("Database tables:", CANDIDATES_TABLE, SKILLS_TABLE)
    
    # Apply corrections on startup to ensure data consistency
    try:
        import subprocess
        import sys
        correction_script = os.path.join(os.path.dirname(__file__), "apply_corrections.py")
        print("🔧 Applying data corrections...")
        subprocess.run([sys.executable, correction_script], 
                      cwd=os.path.dirname(__file__), 
                      capture_output=True, 
                      check=False)
        print("[OK] Data corrections applied")
    except Exception as e:
        print(f"[WARN] Warning: Could not apply corrections: {e}")
    
    api_host = os.getenv("API_HOST", "127.0.0.1")
    api_port = int(os.getenv("API_PORT", "8000"))
    print(f"[OK] Starting API server on http://{api_host}:{api_port}")
    print(f"[OK] API Documentation: http://{api_host}:{api_port}/docs")
    
    uvicorn.run(app, host=api_host, port=api_port)
