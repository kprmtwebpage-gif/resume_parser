"""Check server DB for candidates with missing/short last names."""
import requests

r = requests.get('http://kprmtglobalsolutions.duckdns.org:8002/candidates/', timeout=30)
data = r.json()

# Search for specific names the user mentioned
print("=== Search for vaishnavi/prashanthi/raviteja (SERVER) ===")
for c in data:
    fn = (c.get('first_name') or '').lower()
    ln = (c.get('last_name') or '').lower()
    fname = (c.get('resume_filename') or '').lower()
    if any(x in fn or x in ln or x in fname for x in ['vaishnavi', 'prashanthi', 'raviteja']):
        cid = c['id']
        cfn = c.get('first_name', '')
        cln = c.get('last_name', '')
        cfile = c.get('resume_filename', '')
        cemail = c.get('email', '')
        print(f"  ID={cid:4d}  first={cfn!r:20s}  last={cln!r:15s}  file={cfile!r}  email={cemail!r}")

print()
print("=== ALL candidates with missing/short last name (SERVER) ===")
for c in data:
    ln = (c.get('last_name') or '').strip()
    if not ln or len(ln) <= 1:
        cid = c['id']
        cfn = c.get('first_name', '')
        cln = c.get('last_name', '')
        cfile = c.get('resume_filename', '')
        cemail = c.get('email', '')
        print(f"  ID={cid:4d}  first={cfn!r:20s}  last={cln!r:15s}  file={cfile!r}  email={cemail!r}")

print(f"\nTotal candidates on server: {len(data)}")
