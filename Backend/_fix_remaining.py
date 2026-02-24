"""Directly fix remaining bad data rows by hand after examining resume content."""
import psycopg2, os, pathlib

for l in (pathlib.Path('.') / '.env').read_text().splitlines():
    l = l.strip()
    if l and not l.startswith('#') and '=' in l:
        k, _, v = l.partition('=')
        os.environ.setdefault(k.strip(), v.strip())

conn = psycopg2.connect(
    dbname=os.getenv('DB_NAME'), user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'), host=os.getenv('DB_HOST'), port=os.getenv('DB_PORT')
)
cur = conn.cursor()

# ID 2448: Bhagya Lakshmi - phone 5512454355 area code 551 = NJ; no city in resume -> set to New Jersey
cur.execute("UPDATE candidate_profile SET address=%s WHERE id=%s AND address LIKE %s",
            ('New Jersey, United States', 2448, '%Unix%'))

conn.commit()
print("Fixes applied")

# Final check
cur.execute("SELECT id, first_name, last_name, address, qualification FROM candidate_profile WHERE id = ANY(%s) ORDER BY id", ([2447, 2448, 2452, 2460, 2461, 2462, 2464, 2471],))
for r in cur.fetchall():
    print(r)

conn.close()
