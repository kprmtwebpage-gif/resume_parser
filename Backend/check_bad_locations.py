"""Find all DB records still carrying skill-token locations, then fix them."""
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))

import psycopg2, os, sys
from dotenv import load_dotenv
load_dotenv()

conn = psycopg2.connect(
    dbname=os.getenv("DB_NAME", "postgres"),
    user=os.getenv("DB_USER", "postgres"),
    password=os.getenv("DB_PASSWORD", "admin"),
    host=os.getenv("DB_HOST", "localhost"),
    port=int(os.getenv("DB_PORT", 5432)),
)
cur = conn.cursor()

# ── Step 1: show how many bad records exist ───────────────────────────────────
cur.execute("""
    SELECT id, first_name, last_name, location
    FROM candidate_profile
    WHERE location ILIKE '%xunit%'
       OR location ILIKE '%xaml%'
       OR location ILIKE '%integration testing%'
       OR location ILIKE '%nunit%'
       OR location ILIKE '%junit%'
       OR location ILIKE '%mstest%'
       OR location ILIKE '%selenium%'
       OR location ILIKE '%moq%'
       OR location ILIKE '%wpf%'
       OR location ILIKE '%blazor%'
       OR location ILIKE '%testing%'
       OR location ILIKE '%automation%'
    ORDER BY id
""")
bad_rows = cur.fetchall()
print(f"Bad location rows: {len(bad_rows)}")
for row in bad_rows:
    print(f"  id={row[0]}  {row[1]} {row[2]}  location={row[3]!r}")

conn.close()
