import os
from collections import Counter

import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    host=os.getenv("DB_HOST"),
    port=os.getenv("DB_PORT"),
)

with conn:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT resume_filename, first_name, last_name, address, phone, email, linkedin, qualification, visa_support, work_authorization_type, parsed_at "
            "FROM candidate_profile ORDER BY id"
        )
        rows = cur.fetchall()

print("candidate_profile rows:", len(rows))

blank_counts = Counter()
for (
    resume_filename,
    first_name,
    last_name,
    address,
    phone,
    email,
    linkedin,
    qualification,
    visa_support,
    work_auth,
    parsed_at,
) in rows:
    if not first_name:
        blank_counts["first_name"] += 1
    if not last_name:
        blank_counts["last_name"] += 1
    if not address:
        blank_counts["address"] += 1
    if not phone or phone == 0:
        blank_counts["phone"] += 1
    if not email:
        blank_counts["email"] += 1
    if not linkedin:
        blank_counts["linkedin"] += 1
    if not qualification:
        blank_counts["qualification"] += 1
    if not work_auth:
        blank_counts["work_authorization_type"] += 1

print("blank summary:")
for k, v in blank_counts.most_common():
    print(f"  {k}: {v}")

print("\nSample rows:")
for r in rows[:8]:
    print(r)

with conn:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT cp.resume_filename, cs.candidate_id, cs.job_id, cs.job_title, cs.tech_skills, cs.certifications "
            "FROM candidate_profile cp "
            "JOIN candidate_skills_profile cs ON cs.candidate_id = cp.id "
            "ORDER BY cp.id"
        )
        rows2 = cur.fetchall()

print("\ncandidate_skills_profile rows:", len(rows2))
for r in rows2[:8]:
    print(r)

conn.close()
