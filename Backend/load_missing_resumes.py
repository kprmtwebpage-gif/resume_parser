"""Parse and load the 3 missing resumes into the database"""
import sys
import os

# Set environment to parse only specific files
missing_files = [
    "resumes/ResumeIgorZivkovic.pdf",
    "resumes/ResumeKaylaRelyea.pdf",
    "resumes/ResumeNagaGudibandla.pdf"
]

print("=" * 60)
print("Loading 3 missing resumes into database:")
for f in missing_files:
    print(f"  - {os.path.basename(f)}")
print("=" * 60)

# Run parser for these specific files
from parser import main

# Temporarily override sys.argv to pass the files
original_argv = sys.argv
sys.argv = ['parser.py'] + missing_files

try:
    exit_code = main()
    print(f"\nParser completed with exit code: {exit_code}")
except Exception as e:
    print(f"\nError running parser: {e}")
    import traceback
    traceback.print_exc()
finally:
    sys.argv = original_argv

# Verify they were added
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    host=os.getenv("DB_HOST"),
    port=os.getenv("DB_PORT"),
)
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM candidate_profile")
total = cur.fetchone()[0]
conn.close()

print(f"\n✅ Total candidates in database: {total}")
if total == 55:
    print("✅ All 55 resumes successfully loaded!")
else:
    print(f"⚠️  Expected 55, but found {total}")
