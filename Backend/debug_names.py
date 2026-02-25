"""Debug: find candidates with missing/initial-only last names and trace the issue."""
import psycopg2, os, sys
sys.path.insert(0, os.path.dirname(__file__))

from parser import (extract_text_from_pdf, extract_text_from_docx,
                     extract_name, infer_name_from_filename, _name_from_email,
                     _pick_best_name_pair, extract_email)

conn = psycopg2.connect(host='localhost', dbname='postgres', user='postgres', password='admin', port=5432)
cur = conn.cursor()

# 1. All candidates with missing or single-char last name
cur.execute("""
    SELECT id, first_name, last_name, resume_filename, email
    FROM candidates
    WHERE last_name IS NULL OR TRIM(last_name) = '' OR LENGTH(TRIM(last_name)) <= 1
    ORDER BY first_name
""")
rows = cur.fetchall()
print(f"=== DB Candidates with missing/initial-only last name ({len(rows)}) ===")
for r in rows:
    print(f"  ID={r[0]:4d}  first={r[1]!r:20s}  last={r[2]!r:10s}  file={r[3]!r}")

# 2. Also check VAISHNAVI (first_name='Vaishnavik' means initial was merged into name)
cur.execute("""SELECT id, first_name, last_name, resume_filename, email FROM candidates
              WHERE resume_filename LIKE '%VAISHNAVI%'""")
for r in cur.fetchall():
    print(f"  ID={r[0]:4d}  first={r[1]!r:20s}  last={r[2]!r:10s}  file={r[3]!r}  ** initial merged into first_name")

# 3. Trace extraction for specific problem resume FILES (whether in DB or not)
problem_files = [
    "ResumeVAISHNAVIK.pdf",
    "ResumePavaniP.pdf",
    "ResumeVishalB.pdf",
    "ResumeLohithakshA.pdf",
    "ResumeAshvithR.docx",
    "ResumeRavitejaK.pdf",
    "Prashanth CV.docx",
]

print("\n\n=== TRACING extract_name for problem files ===")
for fname in problem_files:
    fpath = os.path.join("resumes_cache", fname)
    if not os.path.exists(fpath):
        print(f"\n  --- {fname} --- FILE NOT FOUND, skipping")
        continue
    try:
        if fpath.lower().endswith('.pdf'):
            text = extract_text_from_pdf(fpath)
        else:
            text = extract_text_from_docx(fpath)
        
        # Show first 5 header lines
        header_lines = text.split("\n")[:5]
        print(f"\n  --- {fname} ---")
        for i, l in enumerate(header_lines):
            print(f"    line {i}: {l!r}")

        # Extract email from header
        header_text = "\n".join(text.split("\n")[:40])
        email = extract_email(header_text) or extract_email(text) or None

        # Trace each step
        body_name_top = extract_name(header_text, email=email)
        body_name_full = extract_name(text, email=email)
        file_guess = infer_name_from_filename(fname, email=email)
        email_guess = _name_from_email(email) if email else ("", "")

        print(f"    email          = {email!r}")
        print(f"    extract_name(header) = {body_name_top}")
        print(f"    extract_name(full)   = {body_name_full}")
        print(f"    filename_guess       = {file_guess}")
        print(f"    email_guess          = {email_guess}")

        # Choose body_name as parser does
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
        print(f"    chosen body_name     = {body_name}")

        best = _pick_best_name_pair(
            body_name=body_name, file_name_guess=file_guess,
            email_guess=email_guess, confirm_text=text,
        )
        print(f"    _pick_best_name_pair = {best}")
        
        # Flag issue
        if not best[1] or len(best[1].strip()) <= 1:
            print(f"    ** PROBLEM: last name is missing or just an initial!")
    except Exception as e:
        import traceback
        print(f"  Error: {e}")
        traceback.print_exc()

conn.close()
