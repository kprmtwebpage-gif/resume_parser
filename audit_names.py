import os, psycopg2
conn = psycopg2.connect(
    dbname=os.environ['DB_NAME'],
    user=os.environ['DB_USER'],
    password=os.environ['DB_PASSWORD'],
    host=os.environ['DB_HOST'],
    port=os.environ['DB_PORT'],
)
cur = conn.cursor()
cur.execute("SELECT id, first_name, last_name, resume_filename FROM candidate_profile ORDER BY id")
rows = cur.fetchall()
print("ID | FIRST_NAME | LAST_NAME | FILE")
print("-" * 80)
for row in rows:
    id_, fn, ln, fname = row
    fn = (fn or '').strip()
    ln = (ln or '').strip()
    # Flag suspicious entries
    suspect = ''
    if not fn:
        suspect = ' *** MISSING FIRST NAME'
    elif len(fn) <= 1:
        suspect = ' *** INITIAL ONLY'
    elif fn.lower() in ('the','and','or','in','at','as','of','to','for','a','an'):
        suspect = ' *** WORD AS NAME'
    elif any(c.isdigit() for c in fn):
        suspect = ' *** HAS DIGIT'
    elif '@' in fn or '@' in ln:
        suspect = ' *** EMAIL TOKEN'
    ln_lower = ln.lower()
    fn_lower = fn.lower()
    geo_words = {'delaware','wilmington','irving','fairfield','plaines','texas','illinois','iowa',
                 'california','arizona','georgia','virginia','florida','ohio','michigan','indiana',
                 'atlanta','chicago','dallas','houston','austin','seattle','boston','phoenix',
                 'denver','portland','nashville','charlotte','minneapolis','detroit','newark',
                 'jersey','citizen','state','states','united','county'}
    tech_words = {'asp','mvc','visual','studio','cloud','watch','entity','framework',
                  'machine','learning','web','based','java','python','net','dotnet','sql',
                  'react','angular','software','developer','engineer','analyst','architect'}
    if ln_lower in geo_words:
        suspect = ' *** GEO AS LAST_NAME'
    elif ln_lower in tech_words:
        suspect = ' *** TECH AS LAST_NAME'
    elif fn_lower in tech_words:
        suspect = ' *** TECH AS FIRST_NAME'
    print(f"{id_:4d} | {fn:20s} | {ln:20s} | {fname}{suspect}")
cur.close()
conn.close()
print(f"\nTotal: {len(rows)} candidates")
