"""Audit all qualification values in the DB."""
import psycopg2, psycopg2.extras, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

conn = psycopg2.connect(
    dbname=os.getenv('DB_NAME','postgres'), user=os.getenv('DB_USER','postgres'),
    password=os.getenv('DB_PASSWORD','admin'), host=os.getenv('DB_HOST','localhost'),
    port=int(os.getenv('DB_PORT','5432'))
)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
cur.execute("SELECT id, first_name, last_name, qualification FROM candidate_profile ORDER BY qualification NULLS LAST, id")
rows = cur.fetchall()
conn.close()

print(f"Total records: {len(rows)}")
print()
null_count = 0
for r in rows:
    name = f"{r['first_name'] or ''} {r['last_name'] or ''}".strip()
    q = r['qualification']
    if q is None:
        null_count += 1
    print(f"  ID {r['id']:5d}  {name:28s}  {repr(q)}")

print(f"\nNULL qualification: {null_count}/{len(rows)}")
