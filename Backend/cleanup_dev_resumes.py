"""
cleanup_dev_resumes.py
======================
Removes all uploaded resumes from the LOCAL dev environment:
  - Deletes all rows from candidate_profile, candidate_skills_profile, job_titles tables
  - Clears physical files: resumes/, resumes_cache/, unprocessed_resumes/, uploads/

Safe to run multiple times. Does NOT touch the jobs or users tables.
"""

import os
import shutil
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

import psycopg2

DB_CONFIG = {
    "dbname":   os.getenv("DB_NAME", "postgres"),
    "user":     os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "admin"),
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     int(os.getenv("DB_PORT", "5432")),
}

CANDIDATES_TABLE = os.getenv("NEW_CANDIDATES_TABLE", "candidate_profile")
SKILLS_TABLE     = os.getenv("NEW_SKILLS_TABLE",     "candidate_skills_profile")

# Directories (relative to this script's location = Backend/)
BACKEND_DIR = Path(__file__).parent
FILE_DIRS = [
    BACKEND_DIR / "resumes",
    BACKEND_DIR / "resumes_cache",
    BACKEND_DIR / "unprocessed_resumes",
    BACKEND_DIR / "uploads",
]


def clear_db():
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cur:
            # Delete all candidate skill records first (FK child)
            cur.execute(f"SELECT COUNT(*) FROM {SKILLS_TABLE}")
            skills_count = cur.fetchone()[0]
            cur.execute(f"TRUNCATE TABLE {SKILLS_TABLE} CASCADE")
            print(f"  [DB] Deleted {skills_count} rows from {SKILLS_TABLE}")

            # Delete all candidate profile records
            cur.execute(f"SELECT COUNT(*) FROM {CANDIDATES_TABLE}")
            profile_count = cur.fetchone()[0]
            cur.execute(f"TRUNCATE TABLE {CANDIDATES_TABLE} RESTART IDENTITY CASCADE")
            print(f"  [DB] Deleted {profile_count} rows from {CANDIDATES_TABLE}")

        conn.commit()
        print("  [DB] Commit OK")
    except Exception as e:
        conn.rollback()
        print(f"  [DB ERROR] {e}")
    finally:
        conn.close()


def clear_files():
    for directory in FILE_DIRS:
        if not directory.exists():
            print(f"  [FILES] Skipping (not found): {directory}")
            continue

        deleted = 0
        for item in list(directory.iterdir()):
            try:
                if item.is_file():
                    item.unlink()
                    deleted += 1
                elif item.is_dir():
                    shutil.rmtree(item)
                    deleted += 1
            except Exception as e:
                print(f"  [FILES] Could not delete {item}: {e}")

        print(f"  [FILES] Removed {deleted} items from {directory.name}/")


if __name__ == "__main__":
    print("=" * 55)
    print("  DEV Resume Cleanup")
    print(f"  DB: {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['dbname']}")
    print("=" * 55)

    print("\n[1/2] Clearing database records...")
    clear_db()

    print("\n[2/2] Clearing resume files...")
    clear_files()

    print("\n✅  Dev environment cleaned. Ready for fresh uploads.")
