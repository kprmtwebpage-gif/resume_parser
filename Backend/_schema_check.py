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
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='candidate_profile' ORDER BY ordinal_position")
print([r[0] for r in cur.fetchall()])
conn.close()
