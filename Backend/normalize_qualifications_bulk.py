"""
normalize_qualifications_bulk.py
─────────────────────────────────
Applies post_normalize_qualification to every record in candidate_profile:
  • Records WITH a qualification  → post-normalize the current value
  • Records WITH NULL/empty qual  → re-extract from the cached resume file,
                                    then post-normalize the result

Run once, inspect output, then confirm to commit the DB changes.
"""

import os
import sys
import re
import textwrap

# ── path setup ──────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

import psycopg2
from data_normalization import post_normalize_qualification, extract_qualification

# ── config ──────────────────────────────────────────────────────────────────
DB_CONFIG = dict(
    dbname="postgres", user="postgres",
    password="admin", host="localhost", port=5432,
)
CACHE_DIR = os.path.join(SCRIPT_DIR, "resumes_cache")


# ── text-extraction helpers (mirrors parser.py logic) ────────────────────────

def _extract_text_pdf(path: str) -> str:
    try:
        import pdfplumber
        lines: list[str] = []
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                t = page.extract_text(x_tolerance=2, y_tolerance=3) or ""
                lines.append(t)
        return "\n".join(lines)
    except Exception as e:
        print(f"    [pdf error] {e}")
        return ""


def _extract_text_docx(path: str) -> str:
    try:
        from docx import Document
        doc = Document(path)
        return "\n".join(p.text for p in doc.paragraphs)
    except Exception as e:
        print(f"    [docx error] {e}")
        return ""


def extract_text(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        return _extract_text_pdf(path)
    if ext in (".docx", ".doc"):
        return _extract_text_docx(path)
    return ""


def find_resume(filename: str) -> str | None:
    """Return absolute path to the cached resume, or None."""
    if not filename:
        return None
    p = os.path.join(CACHE_DIR, filename)
    if os.path.exists(p):
        return p
    # Case-insensitive scan
    try:
        for f in os.listdir(CACHE_DIR):
            if f.lower() == filename.lower():
                return os.path.join(CACHE_DIR, f)
    except Exception:
        pass
    return None


# ── main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    conn = psycopg2.connect(**DB_CONFIG)
    cur  = conn.cursor()

    cur.execute("""
        SELECT c.id,
               c.first_name,
               c.last_name,
               c.qualification,
               c.resume_filename
        FROM   candidate_profile c
        ORDER  BY c.id
    """)
    rows = cur.fetchall()

    changes: list[tuple[int, str | None, str]] = []   # (id, old_val, new_val)
    skipped_null: list[tuple[int, str]]        = []   # (id, reason)

    print(f"\n{'─'*72}")
    print(f"{'ID':>6}  {'Name':<30}  {'Old → New'}")
    print(f"{'─'*72}")

    for cid, fname, lname, qual, resume_fn in rows:
        name = f"{fname or ''} {lname or ''}".strip()

        if qual:
            # ── post-normalize existing value ────────────────────────────
            new_val = post_normalize_qualification(qual)
        else:
            # ── attempt to re-extract from resume ───────────────────────
            res_path = find_resume(resume_fn)
            if not res_path:
                skipped_null.append((cid, "no cached file"))
                continue
            text = extract_text(res_path)
            if not text.strip():
                skipped_null.append((cid, "could not read text"))
                continue
            raw = extract_qualification(text)
            if not raw:
                skipped_null.append((cid, "extractor returned empty"))
                continue
            new_val = post_normalize_qualification(raw)
            if not new_val:
                skipped_null.append((cid, "post-norm returned empty"))
                continue

        # Skip if nothing changed
        if new_val == (qual or "").strip():
            continue

        changes.append((cid, qual, new_val))
        old_disp = repr(qual) if qual else "NULL"
        new_disp = repr(new_val)
        print(f"{cid:>6}  {name:<30}  {old_disp}")
        print(f"{'':>6}  {'':30}  → {new_disp}")
        print()

    print(f"\n{'─'*72}")
    print(f"Changes to apply : {len(changes)}")
    print(f"NULL still unresolved : {len(skipped_null)}")
    if skipped_null:
        print("\nUnresolved NULL records:")
        for sid, reason in skipped_null:
            print(f"  ID {sid:>5}  — {reason}")

    if not changes:
        print("\nNothing to update. All qualifications already correct.")
        cur.close()
        conn.close()
        return

    answer = input("\nCommit these changes to the database? [y/N] ").strip().lower()
    if answer != "y":
        print("Aborted — no changes written.")
        cur.close()
        conn.close()
        return

    updated = 0
    for cid, _old, new_val in changes:
        cur.execute(
            "UPDATE candidate_profile SET qualification = %s WHERE id = %s",
            (new_val or None, cid),
        )
        updated += 1

    conn.commit()
    print(f"\n✓ Updated {updated} records.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
