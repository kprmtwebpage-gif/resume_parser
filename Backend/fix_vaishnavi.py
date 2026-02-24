"""Fix ID 939: Vaishnavi ( -> Vaishnavi (blank)"""
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

# Check current state
cur.execute("SELECT id, first_name, last_name FROM candidate_profile WHERE id = 939")
row = cur.fetchone()
print(f"Before: ID {row[0]}  first='{row[1]}'  last='{row[2]}'")

# Fix: clear the bad parenthesis from last_name
# Also try to see if 'K' makes more sense as a last initial
# For now, clear it - 'Vaishnavi' is the safe clean result
cur.execute("UPDATE candidate_profile SET last_name = '' WHERE id = 939 AND last_name = '('")
affected = cur.rowcount
conn.commit()

cur.execute("SELECT id, first_name, last_name FROM candidate_profile WHERE id = 939")
row = cur.fetchone()
print(f"After:  ID {row[0]}  first='{row[1]}'  last='{row[2]}'")
print(f"Rows updated: {affected}")

conn.close()
