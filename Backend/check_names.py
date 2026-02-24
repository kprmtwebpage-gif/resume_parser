import psycopg2, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

conn = psycopg2.connect(
    dbname=os.getenv('DB_NAME','postgres'),
    user=os.getenv('DB_USER','postgres'),
    password=os.getenv('DB_PASSWORD','admin'),
    host=os.getenv('DB_HOST','localhost'),
    port=os.getenv('DB_PORT','5432')
)
cur = conn.cursor()
cur.execute('SELECT id, first_name, last_name, resume_filename FROM candidate_profile ORDER BY id')
rows = cur.fetchall()

BAD_EXACT = {
    'net','dotnet','java','python','react','angular','aws','azure','sql','bi',
    'developer','engineer','analyst','architect','consultant','specialist',
    'administrator','manager','lead','intern','senior','junior',
    'fullstack','backend','frontend','stack','full',
    'msc','bsc','btech','mtech','com','resume','cv','profile','candidate',
    'tracking','used','technical','proficiencies','dotnetdeveloper',
    'javadeveloper','reactdeveloper'
}
BAD_SFXS = ('developer','engineer','analyst','architect','consultant','specialist','administrator')

def is_bad(tok):
    t = tok.lower().strip('., ')
    if t in BAD_EXACT:
        return True
    if any(t.endswith(s) and len(t) > len(s) for s in BAD_SFXS):
        return True
    return False

print('=== ALL RECORDS ===')
bad = []
for id_, fn, ln, rf in rows:
    fn2 = fn or ''
    ln2 = ln or ''
    parts = (fn2 + ' ' + ln2).split()
    if any(is_bad(p) for p in parts):
        bad.append((id_, fn2, ln2, rf))
        print(f'  BAD  ID {id_:5d}  "{fn2} {ln2}"   file={rf}')

print()
# Also show specific IDs we care about
print('=== KEY IDs (939, 2449, 2514, 2518) ===')
for id_, fn, ln, rf in rows:
    if id_ in (939, 2449, 2514, 2518):
        print(f'  ID {id_:5d}  first="{fn}"  last="{ln}"  file={rf}')

if not bad:
    print('ALL CLEAN - no bad name tokens found!')
else:
    print(f'\nTotal bad: {len(bad)}')

conn.close()
