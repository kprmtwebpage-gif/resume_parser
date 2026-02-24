"""
fix_bad_locations.py

Find every candidate_profile row whose address field was incorrectly set
to a skill/tool name (e.g. "Xunit, Mississippi, United States") and either
re-extract the correct location from the cached resume, or NULL the field
so the next Google Drive sync / re-parse will populate it correctly.

Run:
    python fix_bad_locations.py
"""

import os, sys, re, glob, traceback
sys.path.insert(0, os.path.dirname(__file__))

import psycopg2
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()

# DB connection
def _get_conn():
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME", "postgres"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "admin"),
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
    )

SKILL_CITIES = frozenset([
    "xunit","nunit","junit","testng","mstest","xaml","wpf","winforms","blazor",
    "tdd","bdd","selenium","angular","react","redux","vue","svelte","jquery",
    "typescript","nodejs","terraform","ansible","devops","cicd","agile","scrum","kanban",
    "specflow","playwright","moq","mockito","kubernetes","docker","jenkins","fiddler",
    "kibana","grafana","splunk","postman","swagger","jira","confluence","git",
    "testing","automation","integration testing","unit testing","automation testing",
    "epsilon oh","edward jones",
])

def city_is_bad(address):
    if not address:
        return False
    city = address.split(",")[0].strip().lower()
    return city in SKILL_CITIES

def _find_cache_file(backend_dir, resume_filename):
    if not resume_filename:
        return None
    # DB stores paths like "resumes_cache/file.docx" — strip the prefix so we
    # don't build a double path: Backend/resumes_cache/resumes_cache/file.docx
    basename = os.path.basename(resume_filename)
    cache_dir = os.path.join(backend_dir, "resumes_cache")
    full_path = os.path.join(cache_dir, basename)
    if os.path.exists(full_path):
        return full_path
    # Partial stem match as fallback
    stem = os.path.splitext(basename)[0]
    matches = glob.glob(os.path.join(cache_dir, f"{stem}*"))
    return matches[0] if matches else None

def main():
    try:
        from location_parser import detect_location_with_fallback, location_result_to_string
    except ImportError:
        print("ERROR: location_parser.py not found.")
        sys.exit(1)

    backend_dir = os.path.dirname(os.path.abspath(__file__))
    conn = _get_conn()
    cur = conn.cursor()

    cur.execute("SELECT id, first_name, last_name, address, resume_filename, phone FROM candidate_profile WHERE address IS NOT NULL ORDER BY id")
    rows = cur.fetchall()
    bad_rows = [r for r in rows if city_is_bad(r[3])]
    print(f"Scanned {len(rows)} records - found {len(bad_rows)} bad.\n")

    if not bad_rows:
        print("Nothing to fix.")
        conn.close()
        return

    fixed = cleared = 0
    for (cid, fname, lname, old_addr, resume_fname, phone) in bad_rows:
        print(f"  BAD [{cid}] {fname} {lname}: {old_addr!r}  =>  ", end="")
        new_addr = None
        cache_path = _find_cache_file(backend_dir, resume_fname)
        if cache_path:
            try:
                with open(cache_path, encoding="utf-8", errors="ignore") as fh:
                    text = fh.read()
                if text:
                    result = detect_location_with_fallback(text, str(phone) if phone else None)
                    cs = location_result_to_string(result)
                    if cs:
                        new_city = cs.split(",")[0].strip().lower()
                        if new_city not in SKILL_CITIES and len(new_city) > 1:
                            new_addr = cs
            except Exception:
                traceback.print_exc()

        if new_addr and new_addr.lower() != old_addr.lower():
            cur.execute("UPDATE candidate_profile SET address = %s WHERE id = %s", (new_addr, cid))
            print(f"FIXED => {new_addr!r}")
            fixed += 1
        else:
            cur.execute("UPDATE candidate_profile SET address = NULL WHERE id = %s", (cid,))
            print(f"CLEARED")
            cleared += 1

    conn.commit()
    conn.close()
    print(f"\nDone - Fixed: {fixed}  Cleared: {cleared}")

if __name__ == "__main__":
    main()
