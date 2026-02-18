import argparse
import os
import re

import psycopg2
from dotenv import load_dotenv


def safe_ident(value: str, *, label: str) -> str:
    if not value:
        raise SystemExit(f"Missing {label}")
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise SystemExit(f"Unsafe SQL identifier for {label}: {value!r}")
    return value


def main() -> int:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Create two new resume parsing tables in Postgres")
    parser.add_argument("--candidates", default=os.getenv("NEW_CANDIDATES_TABLE", "candidate_profile"))
    parser.add_argument("--skills", default=os.getenv("NEW_SKILLS_TABLE", "candidate_skills_profile"))
    args = parser.parse_args()

    candidates_table = safe_ident(args.candidates, label="candidates table")
    skills_table = safe_ident(args.skills, label="skills table")

    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
    )

    with conn:
        with conn.cursor() as cur:
            # Keep this script aligned with the current schema used by parser/reload scripts.
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS public.job_titles (
                    id SERIAL PRIMARY KEY,
                    job_title TEXT UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
                """
            )

            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {candidates_table} (
                    id SERIAL PRIMARY KEY,
                    first_name TEXT,
                    last_name TEXT,
                    address TEXT,
                    phone TEXT,
                    email TEXT,
                    qualification TEXT,
                    visa_support BOOLEAN,
                    work_authorization_type TEXT,
                    linkedin TEXT,
                    profile_picture_url TEXT,
                    resume_filename TEXT,
                    resume_sha256 TEXT UNIQUE,
                    parsed_at TIMESTAMP
                )
                """
            )

            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {skills_table} (
                    candidate_id INTEGER PRIMARY KEY REFERENCES {candidates_table}(id) ON DELETE CASCADE,
                    job_id INTEGER REFERENCES public.job_titles(id),
                    job_title TEXT,
                    tech_skills TEXT,
                    years_of_experience NUMERIC,
                    certifications TEXT,
                    parsed_at TIMESTAMP
                )
                """
            )

            cur.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{skills_table}_candidate_id ON {skills_table}(candidate_id)"
            )
            cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{skills_table}_job_id ON {skills_table}(job_id)")

    print(f"✅ Ready: {candidates_table}, {skills_table}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
