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
    # ID 6: Angirge Mukesh - should be "Sr. C# .NET Full Stack Developer"
    (6, "Sr. C# .NET Full Stack Developer"),
    # ID 14: Gustavo Felix - need to check resume
    # ID 22: Keerthi Suresh - should be "Node.js Backend Developer" 
    (22, "Node.js Backend Developer"),
    # ID 30: Parth Patel - should be "Junior Software Developer"
    (30, "Junior Software Developer"),
    # ID 28: Sivasai Gudibandla - need to check resume (might be Naga Gudibandla)
]

print("Fixing job titles...")
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
print("Verification:")
print("=" * 80)
for candidate_id, new_title in corrections:
    cur.execute('''
        SELECT cp.first_name, cp.last_name, csp.job_title
        FROM candidate_profile cp
        JOIN candidate_skills_profile csp ON cp.id = csp.candidate_id
        WHERE cp.id = %s
    ''', (candidate_id,))
    result = cur.fetchone()
    if result:
        print(f"ID {candidate_id}: {result[0]} {result[1]} -> \"{result[2]}\"")

cur.close()
conn.close()
print("\n✓ All job titles updated successfully!")
