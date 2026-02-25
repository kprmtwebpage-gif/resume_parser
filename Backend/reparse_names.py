"""Re-parse candidates with stale/incorrect name data."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))

# Set env vars for DB connection
os.environ.setdefault("DB_NAME", "postgres")
os.environ.setdefault("DB_USER", "postgres")
os.environ.setdefault("DB_PASSWORD", "admin")
os.environ.setdefault("DB_HOST", "localhost")
os.environ.setdefault("DB_PORT", "5432")

import psycopg2
from parser import (extract_text_from_pdf, extract_text_from_docx,
                     extract_name, infer_name_from_filename, _name_from_email,
                     _pick_best_name_pair, extract_email, file_sha256)

conn = psycopg2.connect(host='localhost', dbname='postgres', user='postgres', password='admin', port=5432)
cur = conn.cursor()

# Find all candidates with missing/initial-only last names
cur.execute("""
    SELECT id, first_name, last_name, resume_filename, email
    FROM candidates
    WHERE last_name IS NULL OR TRIM(last_name) = '' OR LENGTH(TRIM(last_name)) <= 1
    ORDER BY first_name
""")
rows = cur.fetchall()
print(f"Found {len(rows)} candidates with missing/initial-only last name")

# Also find Vaishnavi (merged initial)
cur.execute("""
    SELECT id, first_name, last_name, resume_filename, email
    FROM candidates
    WHERE resume_filename LIKE '%VAISHNAVI%'
""")
rows.extend(cur.fetchall())

updated = 0
for cid, old_fn, old_ln, fname, old_email in rows:
    fpath = os.path.join("resumes_cache", fname)
    if not os.path.exists(fpath):
        print(f"  SKIP ID={cid} {fname} - file not found")
        continue

    # Re-extract text
    if fpath.lower().endswith('.pdf'):
        text = extract_text_from_pdf(fpath)
    else:
        text = extract_text_from_docx(fpath)
    
    header_text = "\n".join(text.split("\n")[:40])
    email = extract_email(header_text) or extract_email(text) or old_email

    body_name_top = extract_name(header_text, email=email)
    body_name_full = extract_name(text, email=email)
    file_guess = infer_name_from_filename(fname, email=email)
    email_guess = _name_from_email(email) if email else ("", "")

    _top = sum(bool(x) for x in body_name_top)
    _full = sum(bool(x) for x in body_name_full)
    if _top >= 2:
        body_name = body_name_top
    elif _top == 1 and _full >= 2:
        body_name = body_name_full
    elif _top >= _full:
        body_name = body_name_top
    else:
        body_name = body_name_full

    first_name, last_name = _pick_best_name_pair(
        body_name=body_name, file_name_guess=file_guess,
        email_guess=email_guess, confirm_text=text,
    )

    changed = (first_name != old_fn) or (last_name != old_ln)
    status = "CHANGED" if changed else "same"
    print(f"  ID={cid:4d} {status}: {old_fn!r} {old_ln!r} -> {first_name!r} {last_name!r}  (file={fname})")

    if changed:
        cur.execute(
            "UPDATE candidates SET first_name = %s, last_name = %s WHERE id = %s",
            (first_name, last_name, cid)
        )
        updated += 1

conn.commit()
print(f"\nUpdated {updated} candidates")
conn.close()
