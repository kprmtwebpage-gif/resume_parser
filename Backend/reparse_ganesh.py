"""
Force re-parse of Ganesh Nakkala's resume by running parser.main()
with SKIP_EXISTING=0 and RESUME_PROCESS_ONLY set to just this file.
The INSERT uses ON CONFLICT (resume_sha256) DO UPDATE, so keeping the SHA
means the existing record gets updated (not duplicated).
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

import psycopg2
import psycopg2.extras
import pathlib

# ── Step 1: Find the resume filename from DB ─────────────────────────────
conn = psycopg2.connect(
    dbname=os.getenv('DB_NAME', 'postgres'),
    user=os.getenv('DB_USER', 'postgres'),
    password=os.getenv('DB_PASSWORD', 'admin'),
    host=os.getenv('DB_HOST', 'localhost'),
    port=int(os.getenv('DB_PORT', '5432'))
)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT id, first_name, last_name, email, phone, address,
           qualification, linkedin, visa_support, work_authorization_type,
           resume_filename, resume_sha256
    FROM candidate_profile
    WHERE lower(first_name) LIKE '%ganesh%' OR lower(last_name) LIKE '%nakkala%'
    ORDER BY id
""")
rows = cur.fetchall()
conn.close()

if not rows:
    print("No Ganesh Nakkala record found in DB!")
    sys.exit(1)

print("=== CURRENT DB STATE ===")
for row in rows:
    for k, v in row.items():
        print(f"  {k:30s}: {repr(v)}")

# Get just the filename (strip folder prefix)
fname_full = rows[0]['resume_filename'] or ''
just_filename = pathlib.Path(fname_full).name
print(f"\nFile to re-parse: {just_filename!r}")

if not just_filename:
    print("!! No resume_filename — cannot re-parse.")
    sys.exit(1)

# Verify file exists
resume_path = os.path.join(os.path.dirname(__file__), 'resumes_cache', just_filename)
if not os.path.exists(resume_path):
    print(f"!! File not found: {resume_path}")
    sys.exit(1)

# ── Step 2: Run parser.main() on just this file ──────────────────────────
# SKIP_EXISTING=0 means it won't skip even if SHA already in DB.
# ON CONFLICT (resume_sha256) DO UPDATE will refresh all fields.
os.environ['SKIP_EXISTING'] = '0'
os.environ['RESUME_PROCESS_ONLY'] = just_filename
os.environ['RESUME_INPUT_DIR'] = os.path.join(os.path.dirname(__file__), 'resumes_cache')
os.environ['QUIET'] = '0'

print(f"\nRunning parser.main() — SKIP_EXISTING=0, RESUME_PROCESS_ONLY={just_filename!r}")
import parser as p
exit_code = p.main()
print(f"\nparser.main() returned: {exit_code}")

# ── Step 3: Show final DB state ───────────────────────────────────────────
conn2 = psycopg2.connect(
    dbname=os.getenv('DB_NAME', 'postgres'),
    user=os.getenv('DB_USER', 'postgres'),
    password=os.getenv('DB_PASSWORD', 'admin'),
    host=os.getenv('DB_HOST', 'localhost'),
    port=int(os.getenv('DB_PORT', '5432'))
)
cur2 = conn2.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
cur2.execute("""
    SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.address,
           c.qualification, c.linkedin, c.visa_support, c.work_authorization_type,
           s.job_title, s.tech_skills, s.years_of_experience
    FROM candidate_profile c
    LEFT JOIN candidate_skills_profile s ON c.id = s.candidate_id
    WHERE lower(c.first_name) LIKE '%ganesh%' OR lower(c.last_name) LIKE '%nakkala%'
""")
print("\n=== FINAL DB STATE ===")
for row in cur2.fetchall():
    for k, v in row.items():
        if v not in (None, ''):
            print(f"  {k:30s}: {repr(v)[:120]}")
conn2.close()
