#!/usr/bin/env python3
"""
bulk_hf_enhance.py
==================
Bulk process ALL local resume files using HuggingFace AI for high-accuracy
skill extraction, job title detection, and AI summary generation.
"""

import os, sys, time, argparse, logging, psycopg2
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("bulk_hf_enhance.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

DB_CONFIG = dict(
    dbname=os.getenv("DB_NAME", "postgres"),
    user=os.getenv("DB_USER", "postgres"),
    password=os.getenv("DB_PASSWORD", "admin"),
    host=os.getenv("DB_HOST", "localhost"),
    port=int(os.getenv("DB_PORT", "5432")),
)

RESUMES_DIR = Path(__file__).parent / "resumes_cache"
CANDIDATES_TABLE = os.getenv("CANDIDATES_TABLE", "candidates")
SKILLS_TABLE = os.getenv("NEW_SKILLS_TABLE", os.getenv("SKILLS_TABLE", "candidate_skills_profile"))
HF_DELAY_SECONDS = float(os.getenv("HF_DELAY_SECONDS", "1.5"))

def get_db():
    return psycopg2.connect(**DB_CONFIG)

def ensure_ai_columns(cur):
    for col_sql in [
        f"ALTER TABLE {CANDIDATES_TABLE} ADD COLUMN IF NOT EXISTS ai_summary TEXT",
        f"ALTER TABLE {CANDIDATES_TABLE} ADD COLUMN IF NOT EXISTS ai_enhanced_at TIMESTAMP",
        f"ALTER TABLE {SKILLS_TABLE} ADD COLUMN IF NOT EXISTS ai_skills TEXT",
    ]:
        try:
            cur.execute(col_sql)
        except Exception as e:
            log.warning("Column migration skipped: %s", e)

def extract_text(file_path: Path) -> str:
    suffix = file_path.suffix.lower()
    try:
        if suffix == ".pdf":
            from parser import extract_text_from_pdf
            return extract_text_from_pdf(str(file_path))
        elif suffix in (".docx",):
            from parser import extract_text_from_docx
            return extract_text_from_docx(str(file_path))
        elif suffix in (".doc",):
            from parser import extract_text_from_doc
            return extract_text_from_doc(str(file_path))
        else:
            return ""
    except Exception as e:
        log.warning("Text extraction failed for %s: %s", file_path.name, e)
        return ""

def extract_basic_fields(text: str, filename: str):
    email, phone, first_name, last_name = "", "", "", ""
    try:
        from parser import extract_email, extract_phone, extract_name
        email = extract_email(text) or ""
        phone = extract_phone(text) or ""
        first_name, last_name = extract_name(text, email=email or None)
    except Exception as e:
        log.debug("Basic field extraction error for %s: %s", filename, e)
    return first_name, last_name, email, phone

def find_resume_file(resume_filename: str) -> Path | None:
    if not resume_filename:
        return None
    name = Path(resume_filename).name
    candidate = RESUMES_DIR / name
    if candidate.exists():
        return candidate
    for p in RESUMES_DIR.rglob(name):
        return p
    return None

def _upsert_candidate(cur, conn, *, first_name, last_name, email, phone,
                      resume_filename, ai_summary, job_title, tech_skills):
    """Insert or update candidate + skills_profile row."""
    now = datetime.now()

    existing_id = None
    if email:
        cur.execute(
            f"SELECT id FROM {CANDIDATES_TABLE} WHERE LOWER(email) = LOWER(%s) LIMIT 1",
            (email.strip(),)
        )
        row = cur.fetchone()
        if row:
            existing_id = row[0]

    if existing_id is None and first_name and last_name and len(last_name) > 1:
        cur.execute(
            f"SELECT id FROM {CANDIDATES_TABLE} WHERE LOWER(first_name)=LOWER(%s) AND LOWER(last_name)=LOWER(%s) LIMIT 1",
            (first_name, last_name)
        )
        row = cur.fetchone()
        if row:
            existing_id = row[0]

    if existing_id:
        cur.execute(
            f"""UPDATE {CANDIDATES_TABLE}
                SET first_name=%s, last_name=%s, phone=%s, email=%s,
                    resume_filename=%s, ai_summary=%s, ai_enhanced_at=%s
                WHERE id=%s RETURNING id""",
            (first_name or None, last_name or None, phone or None, email or None,
             resume_filename, ai_summary or None, now, existing_id)
        )
        candidate_id = existing_id
    else:
        cur.execute(
            f"""INSERT INTO {CANDIDATES_TABLE}
                (first_name, last_name, phone, email, resume_filename, ai_summary, ai_enhanced_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                RETURNING id""",
            (first_name or None, last_name or None, phone or None, email or None,
             resume_filename, ai_summary or None, now)
        )
        row = cur.fetchone()
        candidate_id = row[0] if row else None

    if candidate_id:
        cur.execute(
            f"""INSERT INTO {SKILLS_TABLE}
                (candidate_id, job_title, tech_skills, ai_skills, parsed_at)
                VALUES (%s,%s,%s,%s,%s)
                ON CONFLICT (candidate_id) DO UPDATE SET
                    job_title = EXCLUDED.job_title,
                    tech_skills = EXCLUDED.tech_skills,
                    ai_skills = EXCLUDED.ai_skills,
                    parsed_at = EXCLUDED.parsed_at""",
            (candidate_id, job_title or None, tech_skills or None, tech_skills or None, now)
        )
        conn.commit()

def parse_and_enhance(conn, hf, dry_run: bool = False, limit: int = 0):
    files = sorted(
        p for p in RESUMES_DIR.iterdir()
        if p.suffix.lower() in {".pdf", ".docx", ".doc"} and p.is_file()
    )
    if limit:
        files = files[:limit]

    total = len(files)
    log.info("Found %d resume files to process", total)

    stats = {"processed": 0, "skipped": 0, "errors": 0, "hf_enhanced": 0}
    cur = conn.cursor()

    for idx, fpath in enumerate(files, 1):
        log.info("[%d/%d] %s", idx, total, fpath.name)

        text = extract_text(fpath)
        if not text or len(text.strip()) < 50:
            log.warning("  Skipping (no text): %s", fpath.name)
            stats["skipped"] += 1
            continue

        first_name, last_name, email, phone = extract_basic_fields(text, fpath.name)

        if not dry_run:
            hf_skills = ""
            hf_job_title = ""
            ai_summary = ""

            if hf and hf.is_available():
                try:
                    hf_skills = hf.extract_skills(text) or ""
                    time.sleep(HF_DELAY_SECONDS)
                    ai_summary = hf.summarize_resume(text) or ""
                    time.sleep(HF_DELAY_SECONDS)
                    stats["hf_enhanced"] += 1
                    log.info("  HF enhanced: %d skills extracted", len(hf_skills.split(",")) if hf_skills else 0)
                except Exception as e:
                    log.warning("  HF enhancement failed: %s", e)

            if not hf_skills:
                try:
                    from parser import extract_skills, extract_job_title
                    hf_skills = ", ".join(extract_skills(text)) if extract_skills(text) else ""
                    if not hf_job_title:
                        hf_job_title = extract_job_title(text, first_name=first_name, last_name=last_name) or ""
                except Exception:
                    pass

            try:
                _upsert_candidate(
                    cur, conn,
                    first_name=first_name,
                    last_name=last_name,
                    email=email,
                    phone=phone,
                    resume_filename=f"resumes_cache/{fpath.name}",
                    ai_summary=ai_summary,
                    job_title=hf_job_title,
                    tech_skills=hf_skills,
                )
                stats["processed"] += 1
            except Exception as e:
                log.error("  DB write failed: %s", e)
                conn.rollback()
                stats["errors"] += 1
        else:
            log.info("  [DRY RUN] Would process: first=%r last=%r email=%r", first_name, last_name, email)
            stats["processed"] += 1

    cur.close()
    return stats

def main():
    parser = argparse.ArgumentParser(description="Bulk HuggingFace resume enhancer")
    parser.add_argument("--mode", choices=["parse"], default="parse")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-hf", action="store_true")
    args = parser.parse_args()

    log.info("=" * 60)
    log.info("Bulk HuggingFace Resume Enhancer | Limit: %s", args.limit or "ALL")
    log.info("=" * 60)

    hf = None
    if not args.no_hf:
        from hf_ai_enhancer import HFAIEnhancer
        hf_key = os.getenv("HF_API_KEY")
        if not hf_key:
            log.error("HF_API_KEY not set")
            sys.exit(1)
        hf = HFAIEnhancer(api_key=hf_key, model=os.getenv("HF_MODEL", "Qwen/Qwen2.5-72B-Instruct"))
        if not hf.is_available():
            log.error("HuggingFace init failed")
            sys.exit(1)
        log.info("HuggingFace connected: %s", hf.model)

    try:
        conn = get_db()
        log.info("Database connected: %s@%s/%s", DB_CONFIG["user"], DB_CONFIG["host"], DB_CONFIG["dbname"])
    except Exception as e:
        log.error("DB connection failed: %s", e)
        sys.exit(1)

    if not args.dry_run:
        cur = conn.cursor()
        ensure_ai_columns(cur)
        conn.commit()
        cur.close()
        log.info("AI columns ready")

    start_time = time.time()
    stats = parse_and_enhance(conn, hf, dry_run=args.dry_run, limit=args.limit)
    conn.close()

    elapsed = time.time() - start_time
    log.info("\n" + "=" * 60)
    log.info("COMPLETED in %.1fs", elapsed)
    log.info("  Processed : %d", stats["processed"])
    log.info("  HF enhanced: %d", stats["hf_enhanced"])
    log.info("  Skipped   : %d", stats["skipped"])
    log.info("  Errors    : %d", stats["errors"])
    log.info("=" * 60)

if __name__ == "__main__":
    main()
