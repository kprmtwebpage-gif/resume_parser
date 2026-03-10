import psycopg2

conn = psycopg2.connect(dbname='postgres', user='postgres', password='admin', host='localhost', port=5432)
cur = conn.cursor()
cur.execute("""
    SELECT table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
    FROM information_schema.tables 
    WHERE table_schema='public' 
    ORDER BY table_name
""")
rows = cur.fetchall()
for r in rows:
    print(r)
conn.close()
