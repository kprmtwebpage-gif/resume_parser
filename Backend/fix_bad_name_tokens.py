"""
fix_bad_name_tokens.py
─────────────────────
Finds every candidate whose first_name or last_name contains a job-title /
tech-stack token and re-parses them from their resume file.
"""
import sys, os, re, pathlib
from contextlib import contextmanager

for l in (pathlib.Path(__file__).parent / ".env").read_text().splitlines():
    l = l.strip()
    if l and not l.startswith("#") and "=" in l:
        k, _, v = l.partition("=")
        os.environ.setdefault(k.strip(), v.strip())

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import psycopg2, psycopg2.extras

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


from parser import extract_name, infer_name_from_filename, _pick_best_name_pair

# ── Bad-token detection ────────────────────────────────────────────────────────
_BAD_EXACT = {
    "net", "dotnet", "java", "python", "react", "angular", "aws", "azure",
    "sql", "bi", "developer", "engineer", "analyst", "architect", "consultant",
    "specialist", "administrator", "manager", "lead", "intern", "senior",
    "junior", "fullstack", "backend", "frontend", "stack", "full",
    "msc", "bsc", "btech", "mtech", "com", "resume", "cv", "profile",
    "candidate", "tracking", "used", "technical", "proficiencies",
}
_BAD_SUFFIXES = ("developer", "engineer", "analyst", "architect",
                 "consultant", "specialist", "administrator")


def _is_bad_token(tok: str) -> bool:
    t = (tok or "").strip().casefold()
    if not t or t.startswith("#"):
        return True
    if t in _BAD_EXACT:
        return True
    if any(t.endswith(sfx) for sfx in _BAD_SUFFIXES) and len(t) > min(len(s) for s in _BAD_SUFFIXES):
        return True
    return False


def name_needs_fix(first, last):
    return (not (first or "").strip()) or _is_bad_token(first) or _is_bad_token(last)


# ── Text extraction ────────────────────────────────────────────────────────────

def extract_text(file_path: str):
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
        print(f"  [WARN] {p.name}: {e}")
        return None


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT id, first_name, last_name, email, phone, resume_filename FROM {CANDIDATES_TABLE} ORDER BY id")
            rows = cur.fetchall()

        print(f"Scanning {len(rows)} candidates...\n")
        updated = skipped = 0

        for row in rows:
            cid      = row["id"]
            first    = row["first_name"] or ""
            last     = row["last_name"] or ""
            email    = row["email"] or ""
            phone    = row["phone"]
            rfn      = row["resume_filename"] or ""

            if not name_needs_fix(first, last):
                continue

            print(f"ID {cid:4d}  '{first} {last}'  ({rfn[-45:]})")

            text = None
            for cp in [BACKEND_DIR / rfn, RESUMES_DIR / pathlib.Path(rfn).name, pathlib.Path(rfn)]:
                text = extract_text(str(cp))
                if text:
                    break

            if not text:
                print(f"       [SKIP] no text\n")
                skipped += 1
                continue

            body   = extract_name(text, email=email)
            fguess = infer_name_from_filename(rfn, email=email)
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

            new_first, new_last = merged
            if not new_first or _is_bad_token(new_first):
                print(f"       [FAIL] parser returned {merged}\n")
                skipped += 1
                continue

            print(f"       -> '{new_first} {new_last}'\n")
            with conn.cursor() as wcur:
                wcur.execute(f"UPDATE {CANDIDATES_TABLE} SET first_name=%s, last_name=%s WHERE id=%s",
                             (new_first, new_last, cid))
            conn.commit()
            updated += 1

        print(f"Done. Updated {updated}, skipped {skipped}.")


if __name__ == "__main__":
    main()
