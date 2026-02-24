import psycopg2
conn = psycopg2.connect(dbname="postgres", user="postgres", password="admin", host="localhost", port=5432)
cur = conn.cursor()
cur.execute("SELECT id, first_name, last_name, qualification FROM candidate_profile ORDER BY id")
rows = cur.fetchall()
with_qual = [(r[0], (r[1] or "")+" "+(r[2] or ""), r[3]) for r in rows if r[3]]
null_qual  = [(r[0], (r[1] or "")+" "+(r[2] or "")) for r in rows if not r[3]]
print(f"Total: {len(rows)}, With qualification: {len(with_qual)}, NULL: {len(null_qual)}\n")
for cid, name, q in with_qual:
    print(f"  {cid:>5}  {name.strip():<32}  {repr(q)}")
print(f"\nNULL ({len(null_qual)}):")
for cid, name in null_qual:
    print(f"  {cid:>5}  {name.strip()}")
cur.close(); conn.close()
