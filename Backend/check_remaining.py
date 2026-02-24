"""
Quick check: which files in resumes_cache haven't been parsed yet (or need re-parse),
and what's been done so far in today's run.
"""
import sys, os, psycopg2
from pathlib import Path

BASE = Path(r"C:\Users\prave\PycharmProjects\Resume_Parsing -Latest -Updated_UI_190226\Resume_Parsing -Latest -Updated_UI\Backend")
sys.path.insert(0, str(BASE))

env_path = BASE / ".env"
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); v = v.split("#")[0].strip()
            os.environ.setdefault(k.strip(), v)

conn = psycopg2.connect(
    dbname=os.getenv("DB_NAME","postgres"), user=os.getenv("DB_USER","postgres"),
    password=os.getenv("DB_PASSWORD","admin"), host=os.getenv("DB_HOST","localhost"),
    port=os.getenv("DB_PORT","5432"),
)
cur = conn.cursor()

# All files on disk
cache = BASE / "resumes_cache"
disk_files = sorted(f.name for f in cache.iterdir() if f.suffix.lower() in {".pdf",".docx"})
print(f"Files on disk: {len(disk_files)}")

# All filenames in DB (resume_filename may be "resumes_cache/filename.pdf" or just filename)
cur.execute("SELECT resume_filename, parsed_at FROM candidate_profile ORDER BY parsed_at")
db_rows = cur.fetchall()

# Extract basename for comparison
import posixpath
db_map = {}
for fname, pat in db_rows:
    if fname:
        basename = Path(fname).name
        db_map[basename] = pat

RUN_START = "2026-02-23 19:11:00"
from datetime import datetime
run_start_dt = datetime(2026, 2, 23, 19, 11, 0)

parsed_today = {k for k, v in db_map.items() if v and v >= run_start_dt}
parsed_before = {k for k, v in db_map.items() if v and v < run_start_dt}
never_parsed = set(disk_files) - db_map.keys()

print(f"Parsed in today's LLM run : {len(parsed_today)}")
print(f"Parsed before today       : {len(parsed_before)}")
print(f"Never parsed / missing    : {len(never_parsed)}")
print(f"Total needing processing  : {len(set(disk_files) - parsed_today)}")

# Find what's next to process (alphabetical order, skipping already done today)
remaining = sorted(set(disk_files) - parsed_today)
print(f"\nNext files to process ({len(remaining)} remaining):")
for f in remaining[:20]:
    status = "never" if f in never_parsed else "needs-update"
    print(f"  [{status}] {f}")
if len(remaining) > 20:
    print(f"  ... and {len(remaining)-20} more")

conn.close()
