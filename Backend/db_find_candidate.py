import argparse
import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv


def _connect():
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
    )


def main() -> int:
    load_dotenv(dotenv_path=str(Path.cwd() / ".env"), override=False)

    ap = argparse.ArgumentParser(description="Find candidate_profile rows by name or resume filename")
    ap.add_argument("--first", default="", help="first_name contains (case-insensitive)")
    ap.add_argument("--last", default="", help="last_name contains (case-insensitive)")
    ap.add_argument("--file", default="", help="resume_filename contains (case-insensitive)")
    ap.add_argument("--limit", type=int, default=25)
    args = ap.parse_args()

    if not (args.first or args.last or args.file):
        ap.error("Provide --first and/or --last and/or --file")

    where = []
    params: list[str] = []

    if args.first:
        where.append("cp.first_name ILIKE %s")
        params.append(f"%{args.first}%")
    if args.last:
        where.append("cp.last_name ILIKE %s")
        params.append(f"%{args.last}%")
    if args.file:
        where.append("cp.resume_filename ILIKE %s")
        params.append(f"%{args.file}%")

    q = (
        "SELECT cp.id, cp.resume_filename, cp.first_name, cp.last_name, cp.email, cp.phone, cp.address "
        "FROM candidate_profile cp WHERE "
        + " AND ".join(where)
        + " ORDER BY cp.id LIMIT %s"
    )
    params.append(str(int(args.limit)))

    conn = _connect()
    try:
        with conn.cursor() as cur:
            cur.execute(q, tuple(params))
            rows = cur.fetchall()
    finally:
        conn.close()

    for r in rows:
        print(r)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
