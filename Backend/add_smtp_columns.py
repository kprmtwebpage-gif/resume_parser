"""
Add separate SMTP credential columns to user_email_settings table.
(IMAP fields already exist as username, password_encrypted, ssl_enabled, auth_method)
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()
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
    ("smtp_username", "VARCHAR(255)"),
    ("smtp_password_encrypted", "TEXT"),
    ("smtp_ssl_enabled", "VARCHAR(50) DEFAULT 'Autodetect'"),
    ("smtp_auth_method", "VARCHAR(50) DEFAULT 'Autodetect'"),
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
print("\n[DONE] SMTP columns migration complete.")
