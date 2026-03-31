"""
Add OAuth2 columns to user_email_settings table.
Run this once to migrate the existing table schema.
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Add Backend to path
sys.path.insert(0, os.path.dirname(__file__))

import psycopg2

DB_NAME = os.getenv("DB_NAME", "resume_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "admin")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

conn = psycopg2.connect(
    dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD, host=DB_HOST, port=DB_PORT
)
conn.autocommit = True
cur = conn.cursor()

columns_to_add = [
    ("oauth_access_token", "TEXT"),
    ("oauth_refresh_token", "TEXT"),
    ("oauth_expires_at", "TIMESTAMPTZ"),
]

for col_name, col_type in columns_to_add:
    try:
        cur.execute(f"""
            ALTER TABLE user_email_settings
            ADD COLUMN IF NOT EXISTS {col_name} {col_type};
        """)
        print(f"[OK] Column '{col_name}' ensured on user_email_settings")
    except Exception as e:
        print(f"[WARN] Column '{col_name}': {e}")

cur.close()
conn.close()
print("\n[DONE] OAuth2 columns migration complete.")
