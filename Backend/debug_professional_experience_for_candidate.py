raise SystemExit(
    "This script is deprecated: professional_experience has been removed from the schema and parser."
)

import argparse
import os
import re

import psycopg2
from dotenv import load_dotenv

from db_backfill_professional_experience import _read_resume_text_from_disk
from parser import extract_professional_experience


def main() -> int:
    load_dotenv()

    ap = argparse.ArgumentParser(description="Debug professional_experience extraction for a single candidate")
    ap.add_argument("--candidate-id", type=int, required=True)
    ap.add_argument("--show-matching-lines", type=int, default=40)
    args = ap.parse_args()

    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
    )

    with conn:
        with conn.cursor() as cur:
            cur.execute("select resume_filename from candidate_profile where id=%s", (args.candidate_id,))
            row = cur.fetchone()
            if not row:
                print("candidate not found")
                return 1
            resume_ref = row[0] or ""

    conn.close()

    print(f"candidate_id={args.candidate_id}")
    print(f"resume_filename(ref)={resume_ref!r}")
    print(f"RESUME_INPUT_DIR={os.getenv('RESUME_INPUT_DIR', 'resumes')!r}")

    text = _read_resume_text_from_disk(resume_ref)
    if not text:
        print("Could not read resume text from disk for this candidate.")
        return 2

    extracted = extract_professional_experience(text)
    print("\n--- extract_professional_experience output ---")
    print(extracted or "<None>")

    # Show lines that look like they contain dates.
    print("\n--- sample lines with date-like patterns ---")
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    date_re = re.compile(
        r"(?i)(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b\s*'?\d{2,4}|\b\d{1,2}[/-]\d{2,4}\b|\b\d{4}\b|present|current)"
    )

    shown = 0
    for ln in lines:
        if date_re.search(ln):
            print(ln[:240])
            shown += 1
            if shown >= args.show_matching_lines:
                break

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
