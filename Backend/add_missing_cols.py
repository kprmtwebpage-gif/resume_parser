import psycopg2, psycopg2.extras
from dotenv import load_dotenv
import os
load_dotenv(dotenv_path=r'C:\Users\User\Desktop\resume_parser\Backend\.env', override=True)

conn = psycopg2.connect(
    dbname=os.getenv('DB_NAME','resume_db'),
    user=os.getenv('DB_USER','postgres'),
    password=os.getenv('DB_PASSWORD','admin'),
    host=os.getenv('DB_HOST','localhost'),
    port=os.getenv('DB_PORT','5432'),
)
cur = conn.cursor()

# Add missing columns
for col_def in [
    ("resume_parse_status", "TEXT DEFAULT 'completed'"),
    ("parse_failure_reason", "TEXT"),
    ("education_structured", "JSONB"),
    ("work_experience_structured", "JSONB"),
]:
    col_name, col_type = col_def
    cur.execute(f"""
        DO $$ BEGIN
            ALTER TABLE candidate_profile ADD COLUMN {col_name} {col_type};
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$
    """)
    print(f"Ensured column: {col_name}")

conn.commit()

# Verify
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'candidate_profile' ORDER BY ordinal_position")
cols = [r[0] for r in cur.fetchall()]
print("Columns:", cols)
conn.close()
