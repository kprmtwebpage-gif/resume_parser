"""
db_cleanup.py - Truncate all resume-parsing tables for a fresh start.

Usage:
    # Clean local DB (reads Backend/.env by default)
    python db_cleanup.py

    # Clean dev DB (use .env.dev)
    python db_cleanup.py --env ../.env.dev

    # Skip confirmation prompt
    python db_cleanup.py --yes
"""
import argparse
import os
import sys

import psycopg2
from dotenv import load_dotenv


TABLES = [
    "candidate_skills_profile",  # FK → candidate_profile, truncate first
    "candidate_profile",
    "job_titles",
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Truncate resume-parsing tables")
    parser.add_argument("--env", default=".env",
                        help="Path to .env file (default: Backend/.env)")
    parser.add_argument("--yes", "-y", action="store_true",
                        help="Skip confirmation prompt")
    args = parser.parse_args()

    # Resolve .env path relative to this script's directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(script_dir, args.env)
    if not os.path.exists(env_path):
        # Try as-is (absolute or relative to cwd)
        env_path = args.env
    load_dotenv(env_path, override=True)

    db_name = os.getenv("DB_NAME", "postgres")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_user = os.getenv("DB_USER", "postgres")
    db_pass = os.getenv("DB_PASSWORD", "")

    print(f"Target DB: {db_name}@{db_host}:{db_port}")
    print(f"Tables to truncate: {', '.join(TABLES)}")

    if not args.yes:
        confirm = input("\nThis will DELETE ALL DATA. Continue? [y/N] ").strip().lower()
        if confirm != "y":
            print("Aborted.")
            return 0

    try:
        conn = psycopg2.connect(
            dbname=db_name, user=db_user, password=db_pass,
            host=db_host, port=db_port,
        )
    except psycopg2.OperationalError as e:
        print(f"ERROR: Cannot connect to {db_name}@{db_host}:{db_port}")
        print(f"  {e}")
        return 1

    with conn:
        with conn.cursor() as cur:
            for tbl in TABLES:
                cur.execute(f"TRUNCATE TABLE {tbl} CASCADE")
                print(f"  ✓ Truncated {tbl}")
            # Reset ID sequences
            for seq in ("candidate_profile_id_seq", "job_titles_id_seq"):
                try:
                    cur.execute(f"ALTER SEQUENCE {seq} RESTART WITH 1")
                    print(f"  ✓ Reset {seq}")
                except Exception:
                    conn.rollback()  # needed to continue after error
                    print(f"  - Sequence {seq} not found (OK)")
            print("  ✓ Sequences reset")

    conn.close()
    print(f"\n✅ Database '{db_name}' cleaned — ready for fresh resumes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
