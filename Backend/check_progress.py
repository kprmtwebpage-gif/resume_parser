import sys, os, psycopg2
sys.path.insert(0, os.path.dirname(__file__))

env_path = os.path.join(os.path.dirname(__file__), ".env")
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); v = v.split("#")[0].strip()
            os.environ.setdefault(k.strip(), v)

conn = psycopg2.connect(
    dbname=os.getenv("DB_NAME","postgres"), user=os.getenv("DB_USER","postgres"),
    password=os.getenv("DB_PASSWORD","admin"), host=os.getenv("DB_HOST","localhost"),
    port=os.getenv("DB_PORT","5432"),
)
cur = conn.cursor()

RUN_START = "2026-02-23 19:11:00"

cur.execute(f"SELECT COUNT(*) FROM candidate_profile WHERE parsed_at >= '{RUN_START}'")
updated = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM candidate_profile")
total = cur.fetchone()[0]

# Overall stats (all records)
cur.execute("SELECT COUNT(*) FROM candidate_skills_profile WHERE job_title IS NOT NULL AND job_title != ''")
jt_all = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM candidate_profile WHERE linkedin IS NOT NULL AND linkedin != ''")
li_all = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM candidate_skills_profile WHERE certifications IS NOT NULL AND certifications != ''")
cert_all = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM candidate_profile WHERE education_structured IS NOT NULL")
edu_all = cur.fetchone()[0]

# Stats for records updated THIS run
cur.execute(f"""
    SELECT COUNT(*) FROM candidate_skills_profile csp
    JOIN candidate_profile cp ON cp.id = csp.candidate_id
    WHERE cp.parsed_at >= '{RUN_START}'
    AND csp.certifications IS NOT NULL AND csp.certifications != ''
""")
new_certs = cur.fetchone()[0]

cur.execute(f"""
    SELECT COUNT(*) FROM candidate_profile
    WHERE parsed_at >= '{RUN_START}' AND linkedin IS NOT NULL AND linkedin != ''
""")
new_li = cur.fetchone()[0]

print("=" * 65)
print(f"  Records updated this run : {updated}/{total}")
print(f"  Still processing         : {total - updated} remaining")
print()
print(f"  OVERALL STATS (all {total} records):")
print(f"    job_title filled        : {jt_all}/{total}  ({100*jt_all//total if total else 0}%)")
print(f"    linkedin filled         : {li_all}/{total}  ({100*li_all//total if total else 0}%)")
print(f"    certifications filled   : {cert_all}/{total}  ({100*cert_all//total if total else 0}%)")
print(f"    education_structured    : {edu_all}/{total}  ({100*edu_all//total if total else 0}%)")
print()
print(f"  IN THIS RUN ({updated} records):")
print(f"    with linkedin           : {new_li}")
print(f"    with certifications     : {new_certs}")
print("=" * 65)

print("\nMost recently parsed:")
cur.execute(f"""
    SELECT cp.first_name, COALESCE(cp.last_name,''),
           csp.job_title, cp.linkedin, csp.certifications,
           to_char(cp.parsed_at,'HH24:MI:SS')
    FROM candidate_profile cp
    JOIN candidate_skills_profile csp ON cp.id = csp.candidate_id
    WHERE cp.parsed_at >= '{RUN_START}'
    ORDER BY cp.parsed_at DESC LIMIT 15
""")
for r in cur.fetchall():
    name = (r[0] + " " + r[1]).strip()[:22]
    jt = (r[2] or "none")[:28]
    li = "Y" if r[3] else "N"
    cert = (r[4] or "none")[:38]
    print(f"  [{r[5]}] {name:22s} | {jt:28s} | LI:{li} | {cert}")

conn.close()
