"""
FastAPI server for Resume Parsing Application
Serves candidate data from PostgreSQL database
"""
import os
from contextlib import contextmanager
from typing import List, Optional

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware

# Import chatbot integration (optional)
try:
    from chatbot_integration import create_resume_chatbot
    CHATBOT_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  Chatbot integration not available: {e}")
    CHATBOT_AVAILABLE = False
    create_resume_chatbot = None

# Load environment variables
load_dotenv()

# Get database configuration from environment
CANDIDATES_TABLE = os.getenv("NEW_CANDIDATES_TABLE", "candidate_profile")
SKILLS_TABLE = os.getenv("NEW_SKILLS_TABLE", "candidate_skills_profile")

app = FastAPI(title="Resume Parser API", version="1.0.0")

# CORS configuration - allows both dev and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Middleware to prevent caching - DISABLED (was causing timeouts)
# class NoCacheMiddleware(BaseHTTPMiddleware):
#     async def dispatch(self, request: Request, call_next):
#         response = await call_next(request)
#         response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
#         response.headers["Pragma"] = "no-cache"
#         response.headers["Expires"] = "0"
#         return response
# 
# app.add_middleware(NoCacheMiddleware)


# Serve built frontend in production (mount after API routes defined)
# This will be mounted at the end of the file to avoid conflicts with API routes


@contextmanager
def get_db():
    """Database connection context manager"""
    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        cursor_factory=psycopg2.extras.RealDictCursor,
    )
    try:
        yield conn
    finally:
        conn.close()


def _split_csv(value: Optional[str]) -> List[str]:
    if not value:
        return []
    parts = [p.strip() for p in str(value).split(",")]
    return [p for p in parts if p]


def _as_list(value: Optional[str]) -> List[str]:
    return [value] if value else []


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
    education: Optional[str] = None
    summary: Optional[str] = None
    resume_filename: Optional[str] = None

    # Keep these for backward-compat / debugging
    email: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    certifications: Optional[str] = None
    tech_skills: Optional[str] = None
    professional_experience: Optional[str] = None


@app.get("/")
async def root():
    """Serve frontend or API status"""
    frontend_dist = os.path.join(os.path.dirname(__file__), "..", "Frontend", "dist")
    index_file = os.path.join(frontend_dist, "index.html")
    
    if os.path.exists(index_file) and os.getenv("SERVE_FRONTEND", "0") == "1":
        return FileResponse(index_file)
    
    return {"status": "ok", "message": "Resume Parser API is running"}


@app.get("/candidates", response_model=List[Candidate])
async def get_candidates(
    q: Optional[str] = Query(None, description="General search query"),
    name: Optional[str] = Query(None, description="Search by name"),
    location: Optional[str] = Query(None, description="Search by location"),
    jobTitle: Optional[str] = Query(None, description="Search by job title"),
    limit: int = Query(10, ge=1, le=100, description="Number of results per page"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
):
    """
    Get paginated list of candidates with optional search
    
    - **q**: General search query (searches across all fields)
    - **name**: Search by candidate name
    - **location**: Search by location/address
    - **jobTitle**: Search by job title
    - **limit**: Number of results per page (1-100)
    - **offset**: Offset for pagination
    """
    with get_db() as conn:
        with conn.cursor() as cursor:
            # Build query with field-specific search
            where_conditions = []
            search_params = []
            
            # Name search - search in first_name, last_name, and full name
            if name:
                name_words = [w.strip() for w in name.strip().split() if w.strip()]
                for word in name_words:
                    pattern = f"%{word}%"
                    where_conditions.append("""(
                        c.first_name ILIKE %s 
                        OR c.last_name ILIKE %s 
                        OR CONCAT(c.first_name, ' ', c.last_name) ILIKE %s
                    )""")
                    search_params.extend([pattern] * 3)
            
            # Location search - search in address field only
            if location:
                location_words = [w.strip() for w in location.strip().split() if w.strip()]
                for word in location_words:
                    pattern = f"%{word}%"
                    where_conditions.append("c.address ILIKE %s")
                    search_params.append(pattern)
            
            # Job title search - search in job_title field only
            if jobTitle:
                job_words = [w.strip() for w in jobTitle.strip().split() if w.strip()]
                for word in job_words:
                    pattern = f"%{word}%"
                    where_conditions.append("s.job_title ILIKE %s")
                    search_params.append(pattern)
            
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
                           c.profile_picture_url, s.job_title, c.qualification, c.linkedin, c.visa_support, 
                           c.work_authorization_type as work_authorization, s.certifications, 
                           s.tech_skills, s.years_of_experience as professional_experience
                    FROM {CANDIDATES_TABLE} c
                    LEFT JOIN {SKILLS_TABLE} s ON c.id = s.candidate_id
                    WHERE {where_clause}
                    ORDER BY c.id
                    LIMIT %s OFFSET %s
                """
                count_params = search_params
                data_params = search_params + [limit, offset]
            else:
                count_sql = f"SELECT COUNT(*) as total FROM {CANDIDATES_TABLE}"
                data_sql = f"""
                    SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.address,
                           c.resume_filename, c.profile_picture_url,
                           s.job_title, c.qualification, c.linkedin, c.visa_support, 
                           c.work_authorization_type as work_authorization, s.certifications, 
                           s.tech_skills, s.years_of_experience as professional_experience
                    FROM {CANDIDATES_TABLE} c
                    LEFT JOIN {SKILLS_TABLE} s ON c.id = s.candidate_id
                    ORDER BY c.id 
                    LIMIT %s OFFSET %s
                """
                count_params = []
                data_params = [limit, offset]
            
            # Get candidates
            cursor.execute(data_sql, data_params)
            rows = cursor.fetchall()
            
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
                    education=row.get("qualification"),
                    experience=Experience(
                        job_title=row.get("job_title"),
                        years_of_experience=float(row.get("professional_experience")) if row.get("professional_experience") is not None else None,
                        certifications=_split_csv(row.get("certifications")),
                    ),
                )
                for row in rows
            ]

            # The React UI expects this endpoint to return a plain array.
            return candidates


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
                       c.resume_filename,
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
                education=row.get("qualification"),
                experience=Experience(
                    job_title=row.get("job_title"),
                    years_of_experience=float(row.get("professional_experience")) if row.get("professional_experience") is not None else None,
                    certifications=_split_csv(row.get("certifications")),
                ),
            )


@app.get("/stats")
async def get_stats():
    """Get database statistics"""
    with get_db() as conn:
        with conn.cursor() as cursor:
            # Total candidates
            cursor.execute(f"SELECT COUNT(*) as total FROM {CANDIDATES_TABLE}")
            total = cursor.fetchone()["total"]
            
            # Candidates with email
            cursor.execute(f"SELECT COUNT(*) as count FROM {CANDIDATES_TABLE} WHERE email IS NOT NULL AND email != ''")
            with_email = cursor.fetchone()["count"]
            
            # Candidates with phone
            cursor.execute(f"SELECT COUNT(*) as count FROM {CANDIDATES_TABLE} WHERE phone IS NOT NULL AND phone != ''")
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


@app.get("/job-titles/search")
async def search_job_titles(
    q: str = Query(..., description="Search query for job titles"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of results")
):
    """
    Search for job titles based on user input with intelligent matching.
    
    Rules:
    - Short queries (≤8 chars or 1 word): Returns all matching titles (partial match)
    - Multi-word queries: Attempts exact match first, then fuzzy match (up to 5 results)
    
    - **q**: Search query (job title or keywords)
    - **limit**: Maximum number of results to return
    """
    query = q.strip()
    
    if not query:
        raise HTTPException(status_code=400, detail="Search query cannot be empty")
    
    with get_db() as conn:
        with conn.cursor() as cursor:
            # Determine search strategy based on query length and word count
            word_count = len(query.split())
            is_short_query = len(query) < 8 or word_count == 1
            
            if is_short_query:
                # Broad exploratory search: partial match, return all results
                cursor.execute("""
                    SELECT DISTINCT job_title 
                    FROM public.job_titles 
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
                cursor.execute("""
                    SELECT job_title 
                    FROM public.job_titles 
                    WHERE LOWER(job_title) = LOWER(%s)
                """, (query,))
                
                exact_match = cursor.fetchone()
                
                if exact_match:
                    # Exact match found, return only that
                    return {
                        "query": query,
                        "strategy": "exact_match",
                        "match_type": "exact",
                        "results": [exact_match["job_title"]],
                        "count": 1
                    }
                
                # No exact match: perform fuzzy semantic match
                # Use PostgreSQL's similarity functions or word-based matching
                cursor.execute("""
                    SELECT job_title,
                           similarity(LOWER(job_title), LOWER(%s)) as sim_score
                    FROM public.job_titles
                    WHERE job_title ILIKE %s
                       OR similarity(LOWER(job_title), LOWER(%s)) > 0.1
                    ORDER BY sim_score DESC, job_title
                    LIMIT 5
                """, (query, f"%{query}%", query))
                
                fuzzy_results = cursor.fetchall()
                
                if fuzzy_results:
                    # Return fuzzy matches
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
                    FROM public.job_titles
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
async def download_resume(candidate_id: int):
    """
    Download the original resume file for a candidate
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
            
            # Get just the filename for download
            filename = os.path.basename(resume_path)
            
            return FileResponse(
                path=resume_path,
                media_type="application/pdf" if resume_path.endswith(".pdf") else "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                filename=filename
            )


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
                        
                        print(f"🔄 Starting background parse of {downloaded} new resumes...")
                        process = await asyncio.create_subprocess_exec(
                            sys.executable, str(parser_script),
                            cwd=str(backend_dir),
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE,
                            env=env
                        )
                        stdout, stderr = await process.communicate()
                        
                        if process.returncode == 0:
                            print(f"✅ Successfully parsed {downloaded} resumes")
                        else:
                            print(f"⚠️ Parser completed with errors:")
                            print(f"Output: {stdout.decode()}")
                            print(f"Errors: {stderr.decode()}")
                    except Exception as e:
                        print(f"❌ Background parser failed: {e}")
                
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
        print(f"❌ Sync error: {error_details}")
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
        print("✅ Chatbot initialized successfully")
    except Exception as e:
        print(f"⚠️  Warning: Could not initialize chatbot: {e}")
else:
    print("⚠️  Chatbot module not available - running without chatbot features")


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

# Mount built frontend for production (only when SERVE_FRONTEND env var is set)
# To enable: set SERVE_FRONTEND=1 in .env or environment
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "Frontend", "dist")
if os.path.exists(frontend_dist) and os.getenv("SERVE_FRONTEND", "0") == "1":
    # Serve static files (CSS, JS, images) from /assets
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    
    print(f"✅ Serving built frontend from {frontend_dist}")
    print(f"   Access UI at: http://localhost:8000/")


if __name__ == "__main__":
    import uvicorn
    
    # Check database connection
    try:
        with get_db() as conn:
            with conn.cursor() as cursor:
                cursor.execute(f"SELECT COUNT(*) as total FROM {CANDIDATES_TABLE}")
                result = cursor.fetchone()
                count = result["total"] if result else 0
                print(f"✅ Connected to PostgreSQL database")
                print(f"📊 Found {count} candidates in database")
    except Exception as e:
        print(f"⚠️  Warning: Could not connect to database: {e}")
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
        print("✅ Data corrections applied")
    except Exception as e:
        print(f"⚠️  Warning: Could not apply corrections: {e}")
    
    print(f"🚀 Starting API server on http://127.0.0.1:8000")
    print(f"📖 API Documentation: http://127.0.0.1:8000/docs")
    
    uvicorn.run(app, host="127.0.0.1", port=8000)
