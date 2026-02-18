"""Find which resume files are not in the database"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# Get all resume files from directory
resumes_dir = "resumes"
resume_files = set(os.listdir(resumes_dir))

# Get all resume filenames from database
conn = psycopg2.connect(
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    host=os.getenv("DB_HOST"),
    port=os.getenv("DB_PORT"),
)
cur = conn.cursor()
cur.execute("SELECT resume_filename FROM candidate_profile")
db_resumes = set(row[0].replace("resumes/", "") for row in cur.fetchall() if row[0])
conn.close()

# Find missing files
missing = resume_files - db_resumes

print(f"Total resume files in directory: {len(resume_files)}")
print(f"Total resumes in database: {len(db_resumes)}")
print(f"\nMissing from database ({len(missing)} files):")
for filename in sorted(missing):
    print(f"  - {filename}")
