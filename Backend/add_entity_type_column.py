"""
Add entity_type column to customers table.
Run once to migrate the existing schema.

entity_type values: 'client' | 'vendor'
Default: 'client' (all existing customers become clients)
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))

import psycopg2

DB_NAME     = os.getenv("DB_NAME",     "resume_db")
DB_USER     = os.getenv("DB_USER",     "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "admin")
DB_HOST     = os.getenv("DB_HOST",     "localhost")
DB_PORT     = os.getenv("DB_PORT",     "5432")

conn = psycopg2.connect(
    dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
    host=DB_HOST, port=DB_PORT,
)
conn.autocommit = True
cur = conn.cursor()

try:
    cur.execute("""
        ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20) NOT NULL DEFAULT 'client';
    """)
    print("[OK] Column 'entity_type' ensured on customers table")
except Exception as e:
    print(f"[WARN] entity_type: {e}")

# Ensure existing rows without a value get 'client'
try:
    cur.execute("""
        UPDATE customers
        SET entity_type = 'client'
        WHERE entity_type IS NULL OR entity_type = '';
    """)
    print("[OK] Backfilled entity_type='client' for existing rows")
except Exception as e:
    print(f"[WARN] Backfill: {e}")

cur.close()
conn.close()
print("\n[DONE] entity_type column migration complete.")
