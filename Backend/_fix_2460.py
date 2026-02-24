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
# ID 2460: resume says "SaiVenkat", email prefix is "saivenkata" -> Sai Venkata
cur.execute("UPDATE candidate_profile SET first_name=%s, last_name=%s WHERE id=%s", ('Sai', 'Venkata', 2460))
conn.commit()
print("Updated ID 2460: Sai Venkata")
cur.close()
conn.close()
