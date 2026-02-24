"""
fix_existing_data.py
──────────────────────
Re-parses every candidate whose resume file still exists and updates the DB
with corrected name / location / education values from the improved parser.
Run once from the Backend/ directory.
"""

import sys
import os
import re
import pathlib
from contextlib import contextmanager

# Load .env from Backend directory
_env_path = pathlib.Path(__file__).parent / ".env"
if _env_path.exists():
    for _line in _env_path.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

sys.path.insert(0, os.path.dirname(__file__))

import psycopg2
import psycopg2.extras

BACKEND_DIR = pathlib.Path(__file__).parent
RESUMES_DIR = BACKEND_DIR / "resumes_cache"
CANDIDATES_TABLE = os.getenv("NEW_CANDIDATES_TABLE", "candidate_profile")

@contextmanager
def get_db():
    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME", "postgres"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "admin"),
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        cursor_factory=psycopg2.extras.RealDictCursor,
    )
    try:
        yield conn
    finally:
        conn.close()

from parser import extract_name, extract_address, infer_name_from_filename, _pick_best_name_pair
from data_normalization import extract_qualification

# ─── helpers ──────────────────────────────────────────────────────────────────

def is_bad_name(first, last):
    bad = {
        "used", "tracking", "technical", "proficiencies", "core",
        "msc", "bsc", "btech", "mtech", "com", "stack",
        "candidate", "resume", "profile",
    }
    fn = (first or "").strip().lower()
    ln = (last or "").strip().lower()
    return fn in bad or ln in bad or fn == "" or fn.startswith("#")

def is_bad_location(loc):
    if not loc:
        return False
    l = loc.lower()
    noise = ["corporation", " inc", " llc", " ltd", "technologies", "solutions",
             "consulting", "services", " corp", "systems", "software"]
    return any(x in l for x in noise)

def is_bad_education(edu):
    if not edu:
        return False
    e = edu.lower()
    return ("b.e in b.e" in e or "b.e. in b.e" in e or
            re.search(r"\bmsc\b", e) is not None or
            re.search(r"\bbtech\b", e) is not None or
            re.search(r"\bb\.tech\b", e) is not None and "bachelor" not in e)

# ─── extract text from a resume file ─────────────────────────────────────────

def extract_text(file_path: str) -> str | None:
    p = pathlib.Path(file_path)
    if not p.exists():
        return None
    try:
        if p.suffix.lower() == ".pdf":
            import pdfplumber
            with pdfplumber.open(str(p)) as pdf:
                return "\n".join(page.extract_text() or "" for page in pdf.pages)
        elif p.suffix.lower() in (".docx", ".doc"):
            import docx2txt
            return docx2txt.process(str(p))
        else:
            return p.read_text(errors="ignore")
    except Exception as e:
        print(f"  [WARN] Could not extract text from {p.name}: {e}")
        return None

# ─── main ─────────────────────────────────────────────────────────────────────

def main():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT id, first_name, last_name, email, phone, address,
                       qualification, resume_filename
                FROM {CANDIDATES_TABLE}
                ORDER BY id
            """)
            rows = cur.fetchall()

        print(f"Loaded {len(rows)} candidates from DB\n")
        updated = 0
        skipped = 0

        for row in rows:
            cid       = row["id"]
            first     = row["first_name"] or ""
            last      = row["last_name"] or ""
            email     = row["email"] or ""
            phone     = row["phone"]
            location  = row["address"] or ""
            education = row["qualification"] or ""
            resume_fn = row["resume_filename"] or ""

            needs_name = is_bad_name(first, last)
            needs_loc  = is_bad_location(location)
            needs_edu  = is_bad_education(education)

            if not (needs_name or needs_loc or needs_edu):
                continue

            issues = []
            if needs_name: issues.append(f"name='{first} {last}'")
            if needs_loc:  issues.append(f"loc='{location}'")
            if needs_edu:  issues.append(f"edu='{education[:50]}'")
            print(f"ID {cid:4d}  {', '.join(issues)}")

            # Locate the resume file
            text = None
            if resume_fn:
                for cp in [
                    BACKEND_DIR / resume_fn,
                    RESUMES_DIR / pathlib.Path(resume_fn).name,
                    pathlib.Path(resume_fn),
                ]:
                    text = extract_text(str(cp))
                    if text:
                        break

            if not text:
                print(f"       [SKIP] no text available")
                skipped += 1
                continue

            new_first, new_last = first, last
            new_loc  = location
            new_edu  = education

            # Fix name
            if needs_name:
                body   = extract_name(text, email=email)
                fguess = infer_name_from_filename(resume_fn, email=email)
                eguess = ("", "")
                if email:
                    local = email.split("@", 1)[0]
                    parts = [p for p in re.split(r"[._\-]", re.sub(r"\d+", "", local)) if len(p) >= 3]
                    if len(parts) >= 2:
                        eguess = (parts[0].title(), parts[-1].title())
                    elif len(parts) == 1:
                        eguess = (parts[0].title(), "")
                merged = _pick_best_name_pair(
                    body_name=body,
                    file_name_guess=fguess,
                    email_guess=eguess,
                    confirm_text=text[:3000],
                )
                if merged[0] and not is_bad_name(merged[0], merged[1]):
                    new_first, new_last = merged
                    print(f"       name  -> '{new_first} {new_last}'")
                else:
                    print(f"       name  -> could not fix (got {merged})")

            # Fix location
            if needs_loc:
                loc = extract_address(text, phone=phone)
                if loc and not is_bad_location(loc):
                    new_loc = loc
                    print(f"       loc   -> '{new_loc}'")
                else:
                    print(f"       loc   -> could not fix (got '{loc}')")

            # Fix education
            if needs_edu:
                edu = extract_qualification(text)
                if edu:
                    new_edu = edu
                    print(f"       edu   -> '{new_edu[:70]}'")
                else:
                    print(f"       edu   -> could not fix")

            # Write back
            with conn.cursor() as wcur:
                wcur.execute(f"""
                    UPDATE {CANDIDATES_TABLE}
                       SET first_name = %s,
                           last_name  = %s,
                           address    = %s,
                           qualification = %s
                     WHERE id = %s
                """, (new_first, new_last, new_loc, new_edu, cid))
            conn.commit()
            updated += 1

        print(f"\nDone. Updated {updated} rows, skipped {skipped}.")

if __name__ == "__main__":
    main()
