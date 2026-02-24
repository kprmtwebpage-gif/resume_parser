import psycopg2, json
conn = psycopg2.connect(dbname="postgres", user="postgres", password="admin", host="localhost", port=5432)
cur = conn.cursor()

# Check which records are still NULL despite having qualification
cur.execute("""
    SELECT id, first_name, last_name, qualification
    FROM candidate_profile
    WHERE qualification IS NOT NULL AND education_structured IS NULL
    ORDER BY id
""")
print("=== Records still un-structured ===")
for row in cur.fetchall():
    print(f"  ID {row[0]:>5}  {row[1] or ''} {row[2] or '':<20}  qual={repr(row[3])[:80]}")

print()

# Sample 5 structured entries to check quality
cur.execute("""
    SELECT id, first_name, last_name, qualification, education_structured
    FROM candidate_profile
    WHERE education_structured IS NOT NULL
    ORDER BY id
    LIMIT 8
""")
print("=== Sample structured entries ===")
for row in cur.fetchall():
    name = f"{row[1] or ''} {row[2] or ''}".strip()
    edu = row[4]  # psycopg2 returns JSONB as Python dict/list already
    print(f"\n  ID {row[0]:>5}  {name}")
    print(f"  qual:  {repr(row[3])[:80]}")
    print(f"  struct: {json.dumps(edu, indent=4)[:300]}")

cur.close(); conn.close()
