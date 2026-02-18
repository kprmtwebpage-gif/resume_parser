import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()
conn = psycopg2.connect(
    host=os.getenv('DB_HOST'),
    database=os.getenv('DB_NAME'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD')
)
cur = conn.cursor()

# Known fixes from resume verification
fixes = [
    (30, 'https://www.linkedin.com/in/parth-patel-70552924b/', 'Parth', 'Patel'),
    (19, 'https://www.linkedin.com/in/karysse-hay-43811b197/', 'Karysse', 'Hay'),
]

print("Current LinkedIn URLs:")
print("=" * 80)
for cid, correct_url, first, last in fixes:
    cur.execute('SELECT linkedin FROM candidate_profile WHERE id = %s', (cid,))
    current = cur.fetchone()[0]
    print(f"ID {cid}: {first} {last}")
    print(f"  Current: {current}")
    print(f"  Correct: {correct_url}")
    print()

print("=" * 80)
print("Applying fixes...")
print("=" * 80)

for cid, correct_url, first, last in fixes:
    cur.execute('UPDATE candidate_profile SET linkedin = %s WHERE id = %s', (correct_url, cid))
    print(f"✓ ID {cid}: {first} {last} -> {correct_url}")

conn.commit()

print("\n" + "=" * 80)
print("Verification:")
print("=" * 80)

for cid, expected_url, first, last in fixes:
    cur.execute('SELECT linkedin FROM candidate_profile WHERE id = %s', (cid,))
    actual = cur.fetchone()[0]
    status = "✓" if actual == expected_url else "✗"
    print(f"{status} ID {cid}: {first} {last}")
    print(f"   {actual}")

cur.close()
conn.close()

print("\n✓ LinkedIn URLs fixed! The links should now work correctly.")
