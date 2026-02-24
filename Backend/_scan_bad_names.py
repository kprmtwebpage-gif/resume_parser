import psycopg2, os, pathlib, re

for l in (pathlib.Path('.') / '.env').read_text().splitlines():
    l = l.strip()
    if l and not l.startswith('#') and '=' in l:
        k, _, v = l.partition('=')
        os.environ.setdefault(k.strip(), v.strip())

conn = psycopg2.connect(
    dbname=os.getenv('DB_NAME'), user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'), host=os.getenv('DB_HOST'), port=os.getenv('DB_PORT')
)
cur = conn.cursor()
cur.execute("SELECT id, first_name, last_name, resume_filename FROM candidate_profile ORDER BY id")
rows = cur.fetchall()

# Patterns that should never appear as a name token
BAD_LAST_PATTERNS = [
    r"developer", r"developer\.", r"dev", r"dotnet", r"\.net", r"^net$",
    r"java", r"python", r"react", r"angular", r"fullstack", r"full", r"stack",
    r"engineer", r"analyst", r"architect", r"consultant", r"specialist", r"manager",
    r"senior", r"junior", r"lead", r"intern", r"associate", r"fresher",
    r"^sr\.?$", r"^jr\.?$",
    r"msc", r"bsc", r"btech", r"mtech", r"mba", r"phd",
    r"resume", r"cv", r"profile",
]
bad_re = re.compile(r"(?i)^(?:" + "|".join(BAD_LAST_PATTERNS) + r")$")

for row in rows:
    cid, fn, ln, fname = row
    fn = (fn or "").strip()
    ln = (ln or "").strip()
    full = f"{fn} {ln}".strip()
    issues = []
    if bad_re.search(ln):
        issues.append(f"BAD_LAST='{ln}'")
    # Check for concatenated job-title surnames like "Dotnetdeveloper", "Javadeveloper"
    if re.search(r"(?i)(developer|engineer|analyst|architect|consultant|specialist)$", ln) and len(ln) > 9:
        issues.append(f"CONCAT_LAST='{ln}'")
    if issues:
        print(f"ID {cid:4d}  name='{full}'  file='{(fname or '')[-45:]}'  -> {', '.join(issues)}")

conn.close()
print(f"\nScanned {len(rows)} rows.")
