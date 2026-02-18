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

# Job title corrections based on resume review
corrections = [
    (6, "Sr. C# .NET Full Stack Developer"),  # Angirge Mukesh
    (14, ".NET Cloud Solutions Engineer"),     # Gustavo Felix 
    (22, "Node.js Backend Developer"),         # Keerthi Suresh
    (30, "Junior Back-End Java Developer"),    # Parth Patel
    (28, "Full Stack Developer"),              # Sivasai Gudibandla (default)
]

print("Current Job Titles:")
print("=" * 80)
for candidate_id, _ in corrections:
    cur.execute('''
        SELECT cp.id, cp.first_name, cp.last_name, csp.job_title
        FROM candidate_profile cp
        LEFT JOIN candidate_skills_profile csp ON cp.id = csp.candidate_id
        WHERE cp.id = %s
    ''', (candidate_id,))
    result = cur.fetchone()
    if result:
        print(f"ID {result[0]}: {result[1]} {result[2]} -> \"{result[3]}\"")

print("\n" + "=" * 80)
print("Applying corrections...")
print("=" * 80)

for candidate_id, new_title in corrections:
    cur.execute('''
        UPDATE candidate_skills_profile 
        SET job_title = %s 
        WHERE candidate_id = %s
    ''', (new_title, candidate_id))
    print(f"✓ Updated ID {candidate_id} to: {new_title}")

conn.commit()

# Verify changes
print("\n" + "=" * 80)
print("Updated Job Titles:")
print("=" * 80)
for candidate_id, expected_title in corrections:
    cur.execute('''
        SELECT cp.first_name, cp.last_name, csp.job_title
        FROM candidate_profile cp
        JOIN candidate_skills_profile csp ON cp.id = csp.candidate_id
        WHERE cp.id = %s
    ''', (candidate_id,))
    result = cur.fetchone()
    if result:
        status = "✓" if result[2] == expected_title else "✗"
        print(f"{status} ID {candidate_id}: {result[0]} {result[1]} -> \"{result[2]}\"")

cur.close()
conn.close()
print("\n✓ All job titles normalized successfully!")
