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
    WHERE lower(first_name) LIKE '%shiva%' OR lower(last_name) LIKE '%shiva%'
    ORDER BY id
""")
rows = cur.fetchall()
for r in rows:
    print(f"ID={r[0]}  first='{r[1]}'  last='{r[2]}'  email={r[3]}  file={r[4]}")
conn.close()
