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

print("Current Job Title:")
print("=" * 80)
cur.execute('''
    SELECT cp.id, cp.first_name, cp.last_name, csp.job_title
    FROM candidate_profile cp
    JOIN candidate_skills_profile csp ON cp.id = csp.candidate_id
    WHERE cp.id = 22
''')
result = cur.fetchone()
print(f"ID {result[0]}: {result[1]} {result[2]} -> \"{result[3]}\"")

print("\nUpdating to correct title...")
print("=" * 80)

# Correct title based on resume: "Full Stack Java Developer" is their current role
correct_title = "Full Stack Java Developer"
cur.execute('''
    UPDATE candidate_skills_profile 
    SET job_title = %s 
    WHERE candidate_id = 22
''', (correct_title,))

conn.commit()

# Verify
cur.execute('''
    SELECT cp.first_name, cp.last_name, csp.job_title
    FROM candidate_profile cp
    JOIN candidate_skills_profile csp ON cp.id = csp.candidate_id
    WHERE cp.id = 22
''')
result = cur.fetchone()
print(f"✓ Updated ID 22: {result[0]} {result[1]} -> \"{result[2]}\"")

cur.close()
conn.close()
print("\n✓ Job title corrected successfully!")
