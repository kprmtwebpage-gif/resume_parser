"""
add_education_structured_column.py
────────────────────────────────────
One-time migration: adds the `education_structured` JSONB column to
candidate_profile and back-fills it for all existing records using
the new education_parser module.

Run once:
    python add_education_structured_column.py
"""
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

import psycopg2
from psycopg2.extras import Json

from education_parser import (
    parse_education_section,
    education_to_flat_string,
)

DB_CONFIG = dict(
    dbname="postgres", user="postgres",
    password="admin", host="localhost", port=5432,
)
CACHE_DIR = os.path.join(SCRIPT_DIR, "resumes_cache")


def _extract_text(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    try:
        if ext == ".pdf":
            import pdfplumber
            parts = []
            with pdfplumber.open(path) as pdf:
                for page in pdf.pages:
                    t = page.extract_text(x_tolerance=2, y_tolerance=3) or ""
                    parts.append(t)
            return "\n".join(parts)
        if ext in (".docx", ".doc"):
            from docx import Document
            return "\n".join(p.text for p in Document(path).paragraphs)
    except Exception as e:
        print(f"    [text error] {e}")
    return ""


def main():
    conn = psycopg2.connect(**DB_CONFIG)
    cur  = conn.cursor()

    # ── Add column if missing ────────────────────────────────────────────────
    cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'candidate_profile'
          AND column_name = 'education_structured'
    """)
    if not cur.fetchone():
        print("Adding education_structured JSONB column …")
        cur.execute("""
            ALTER TABLE candidate_profile
            ADD COLUMN education_structured JSONB
        """)
        conn.commit()
        print("Column added.")
    else:
        print("Column already exists — skipping ALTER TABLE.")

    # ── Back-fill existing rows ──────────────────────────────────────────────
    cur.execute("""
        SELECT id, first_name, last_name, qualification, resume_filename
        FROM candidate_profile
        WHERE education_structured IS NULL
        ORDER BY id
    """)
    rows = cur.fetchall()
    updated = skipped = 0

    for cid, fn, ln, qual, resume_fn in rows:
        name = f"{fn or ''} {ln or ''}".strip()

        # Build resume path
        res_path = None
        if resume_fn:
            fname = os.path.basename(resume_fn)
            p = os.path.join(CACHE_DIR, fname)
            if not os.path.exists(p):
                for f in (os.listdir(CACHE_DIR) if os.path.isdir(CACHE_DIR) else []):
                    if f.lower() == fname.lower():
                        p = os.path.join(CACHE_DIR, f)
                        break
            if os.path.exists(p):
                res_path = p

        try:
            text = _extract_text(res_path) if res_path else ""
        except Exception as e:
            print(f"  [{cid:>5}] {name:<30}  SKIP — text error: {e}")
            skipped += 1
            continue

        try:
            entries = parse_education_section(text) if text else []
        except Exception as e:
            print(f"  [{cid:>5}] {name:<30}  SKIP — parse error: {e}")
            skipped += 1
            continue

        # If parse returned nothing but we have a flat qualification string,
        # try parsing that string as a mini-"resume" text
        if not entries and qual:
            try:
                entries = parse_education_section(qual)
            except Exception:
                pass

        if not entries:
            skipped += 1
            continue

        # Strip raw_line before storing
        clean_entries = [
            {k: v for k, v in e.items() if k != "raw_line"}
            for e in entries
        ]

        cur.execute(
            "UPDATE candidate_profile SET education_structured=%s WHERE id=%s",
            (Json(clean_entries), cid),
        )
        print(f"  [{cid:>5}] {name:<30}  {len(clean_entries)} entries")
        updated += 1

    conn.commit()
    print(f"\n✓ Back-filled {updated} records.  Skipped {skipped} (no resume text).")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
