import psycopg2, sys

try:
    conn = psycopg2.connect(dbname="postgres", user="postgres", password="admin", host="localhost", port=5432)
    cur = conn.cursor()
    cur.execute("ALTER TABLE candidate_profile ADD COLUMN IF NOT EXISTS resume_parse_status TEXT DEFAULT 'completed'")
    cur.execute("ALTER TABLE candidate_profile ADD COLUMN IF NOT EXISTS parse_failure_reason TEXT")
    cur.execute("ALTER TABLE candidate_profile ADD COLUMN IF NOT EXISTS parsed_at TIMESTAMP")
    cur.execute("ALTER TABLE candidate_profile ADD COLUMN IF NOT EXISTS resume_sha256 TEXT")
    conn.commit()
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='candidate_profile' ORDER BY column_name")
    print("Columns:", [r[0] for r in cur.fetchall()])
    conn.close()
    print("SUCCESS - all columns added!")
except Exception as e:
    print("ERROR:", e, file=sys.stderr)
    sys.exit(1)
