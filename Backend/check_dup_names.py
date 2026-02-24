"""Find records where first_name == last_name (likely same-name duplication bug)"""
import psycopg2, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

conn = psycopg2.connect(
    dbname=os.getenv('DB_NAME','postgres'),
    user=os.getenv('DB_USER','postgres'),
    password=os.getenv('DB_PASSWORD','admin'),
    host=os.getenv('DB_HOST','localhost'),
    port=os.getenv('DB_PORT','5432')
)
cur = conn.cursor()
cur.execute("""
    SELECT id, first_name, last_name, email, resume_filename
    FROM candidate_profile
    WHERE lower(first_name) = lower(last_name) AND first_name IS NOT NULL AND first_name != ''
    ORDER BY id
""")
rows = cur.fetchall()
if rows:
    print(f"Found {len(rows)} records where first_name == last_name:")
    for r in rows:
        print(f"  ID={r[0]}  '{r[1]} {r[2]}'  email={r[3]}  file={r[4]}")
else:
    print("No duplicate first=last name records found!")
conn.close()
