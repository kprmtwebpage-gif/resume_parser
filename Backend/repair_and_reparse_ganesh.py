"""Replace corrupted PDF with repaired version and update DB sha256, then re-parse."""
import shutil, hashlib, psycopg2, psycopg2.extras, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

import pikepdf

SRC_FILE = 'resumes_cache/GANESH_NAKKALA -Resume- 2024.pdf'
REPAIRED  = 'resumes_cache/GANESH_NAKKALA -Resume- 2024_repaired.pdf'

# Step 1: Repair the corrupted PDF with pikepdf
print("Repairing PDF...")
try:
    pdf = pikepdf.open(SRC_FILE, suppress_warnings=True)
    pdf.save(REPAIRED)
    pdf.close()
    print(f"  Repaired -> {REPAIRED}")
except Exception as e:
    print(f"  Repair failed: {e}")
    sys.exit(1)

# Verify repaired file
import pdfplumber
with pdfplumber.open(REPAIRED) as p:
    pg_count = len(p.pages)
    preview = p.pages[0].extract_text()[:100] if pg_count > 0 else ''
print(f"  Repaired file: {pg_count} pages, preview: {repr(preview)}")

if pg_count == 0:
    print("Repair did not produce readable pages — cannot continue.")
    sys.exit(1)

# Step 2: Replace the original with the repaired file
shutil.copy2(REPAIRED, SRC_FILE)
os.remove(REPAIRED)
print(f"Replaced original with repaired file.")

# Step 3: Compute new sha256
with open(SRC_FILE, 'rb') as f:
    new_sha = hashlib.sha256(f.read()).hexdigest()
print(f"New sha256: {new_sha}")

# Step 4: Update DB sha256 so ON CONFLICT (resume_sha256) DO UPDATE works correctly
conn = psycopg2.connect(
    dbname=os.getenv('DB_NAME', 'postgres'),
    user=os.getenv('DB_USER', 'postgres'),
    password=os.getenv('DB_PASSWORD', 'admin'),
    host=os.getenv('DB_HOST', 'localhost'),
    port=int(os.getenv('DB_PORT', '5432'))
)
cur = conn.cursor()
cur.execute(
    "UPDATE candidate_profile SET resume_sha256 = %s WHERE id = 2455 RETURNING id",
    (new_sha,)
)
updated = cur.fetchall()
conn.commit()
conn.close()
print(f"Updated sha256 for IDs: {[r[0] for r in updated]}")

# Step 5: Re-parse using parser.main()
os.environ['SKIP_EXISTING'] = '0'
os.environ['RESUME_PROCESS_ONLY'] = 'GANESH_NAKKALA -Resume- 2024.pdf'
os.environ['RESUME_INPUT_DIR'] = os.path.join(os.path.dirname(__file__), 'resumes_cache')
os.environ['QUIET'] = '0'

print("\nRunning parser.main()...")
import parser as p
exit_code = p.main()
print(f"parser.main() returned: {exit_code}")

# Step 6: Show final DB state
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
    WHERE c.id = 2455
""")
print("\n=== FINAL DB STATE ===")
for row in cur2.fetchall():
    for k, v in row.items():
        if v not in (None, ''):
            print(f"  {k:30s}: {repr(v)[:120]}")
conn2.close()
