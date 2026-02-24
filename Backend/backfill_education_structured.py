"""
backfill_education_structured.py
─────────────────────────────────
Fast backfill of `education_structured` JSONB from existing `qualification` TEXT.

For records that already have a `qualification` string, parse that directly —
no PDF reading needed, runs in seconds.
For records with NULL qualification, skip (they will be populated the next time
the resume is re-parsed through the main ingestion pipeline).
"""
import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

import psycopg2

from education_parser import parse_education_section

DB_CONFIG = dict(
    dbname="postgres", user="postgres",
    password="admin", host="localhost", port=5432,
)


def main():
    conn = psycopg2.connect(**DB_CONFIG)
    cur  = conn.cursor()

    cur.execute("""
        SELECT id, first_name, last_name, qualification
        FROM candidate_profile
        WHERE qualification IS NOT NULL
          AND education_structured IS NULL
        ORDER BY id
    """)
    rows = cur.fetchall()
    print(f"Records to backfill: {len(rows)}")

    done = 0
    for cid, fn, ln, qual in rows:
        name = f"{fn or ''} {ln or ''}".strip()
        try:
            entries = parse_education_section(qual)
        except Exception as e:
            print(f"  [{cid:>5}] {name:<30}  ERROR: {e}")
            continue

        if not entries:
            continue

        clean = [{k: v for k, v in e.items() if k != "raw_line"} for e in entries]
        cur.execute(
            "UPDATE candidate_profile SET education_structured = %s::jsonb WHERE id = %s",
            (json.dumps(clean), cid),
        )
        print(f"  [{cid:>5}] {name:<30}  {len(clean)} entries -> {clean[0].get('degree', '')} | {clean[0].get('specialization', '')}")
        done += 1

        # Commit every 10 rows so progress is saved even if interrupted
        if done % 10 == 0:
            conn.commit()
            print(f"  [checkpoint] committed {done} rows")

    conn.commit()
    print(f"\nDone. Backfilled {done}/{len(rows)} records.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
