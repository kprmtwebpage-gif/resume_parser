"""
Script to manually fix incorrect job titles and qualifications
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# Database connection
conn = psycopg2.connect(
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    host=os.getenv("DB_HOST"),
    port=os.getenv("DB_PORT"),
)
cur = conn.cursor()

# Fix incorrect job titles - these need to be updated based on actual resume content
fixes = [
    # ID 22: Keerthi Suresh - should be Node.js Developer or Full Stack Developer
    (22, "Full Stack Developer"),
    # ID 30: Parth Patel - should be Software Developer or similar
    (30, "Software Developer"),
]

print("Fixing job titles...")
for candidate_id, correct_job_title in fixes:
    cur.execute(
        "UPDATE candidate_skills_profile SET job_title = %s WHERE candidate_id = %s",
        (correct_job_title, candidate_id)
    )
    print(f"✓ Updated candidate ID {candidate_id} to: {correct_job_title}")

conn.commit()
cur.close()
conn.close()

print(f"\n✅ Fixed {len(fixes)} job titles")
