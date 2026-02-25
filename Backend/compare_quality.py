"""Compare local vs server API data — find where server is worse."""
import json
import urllib.request

LOCAL  = "http://127.0.0.1:8000/candidates?limit=200"
SERVER = "http://kprmtglobalsolutions.duckdns.org:8002/candidates?limit=200"

def fetch(url):
    return json.loads(urllib.request.urlopen(url, timeout=30).read())

def main():
    local_data  = fetch(LOCAL)
    server_data = fetch(SERVER)
    print(f"Local: {len(local_data)} candidates | Server: {len(server_data)} candidates\n")

    # ── 1. Find placeholder "Candidate #N" names on server ──
    placeholders = [c for c in server_data if (c.get("first_name") or "").startswith("Candidate")]
    print(f"=== SERVER: Placeholder names ({len(placeholders)}) ===")

    local_by_file = {c.get("resume_filename", ""): c for c in local_data}

    for c in placeholders:
        fn = c.get("first_name", "")
        ln = c.get("last_name", "")
        rf = c.get("resume_filename", "")
        jt = c.get("job_title", "")
        loc = c.get("location", "")
        lc = local_by_file.get(rf)
        print(f"  id={c['id']}  server_name=\"{fn} {ln}\"  jt=\"{jt}\"  loc=\"{loc}\"")
        print(f"    file: {rf}")
        if lc:
            print(f"    LOCAL: name=\"{lc.get('first_name','')} {lc.get('last_name','')}\"  jt=\"{lc.get('job_title','')}\"  loc=\"{lc.get('location','')}\"")
        else:
            print(f"    LOCAL: (not found)")
        print()

    # ── 2. Full comparison: where server is WORSE ──
    fields = ["first_name", "last_name", "job_title", "location"]
    server_by_file = {c.get("resume_filename", ""): c for c in server_data}

    server_worse = []   # server empty / placeholder, local has real data
    local_worse = []    # local empty, server has real data
    both_diff = []      # both have data but different

    for fname in sorted(set(local_by_file) | set(server_by_file)):
        if not fname:
            continue
        lc = local_by_file.get(fname)
        sc = server_by_file.get(fname)
        if not lc or not sc:
            continue

        for fld in fields:
            lv = (lc.get(fld) or "").strip()
            sv = (sc.get(fld) or "").strip()
            if lv == sv:
                continue
            is_server_placeholder = sv.startswith("Candidate") or sv == "Singleton"
            if (not sv and lv) or (is_server_placeholder and lv):
                server_worse.append((fname, fld, lv, sv))
            elif (not lv and sv):
                local_worse.append((fname, fld, lv, sv))
            else:
                both_diff.append((fname, fld, lv, sv))

    print(f"\n{'='*80}")
    print(f"SERVER WORSE (missing/placeholder where local has real data): {len(server_worse)}")
    print(f"LOCAL WORSE (missing where server has data):                  {len(local_worse)}")
    print(f"BOTH DIFFERENT (both have data, different values):            {len(both_diff)}")
    print(f"{'='*80}")

    if server_worse:
        print(f"\n--- SERVER WORSE ({len(server_worse)}) ---")
        for fname, fld, lv, sv in server_worse:
            short = fname.replace("resumes_cache/", "")
            print(f"  {short:50s} {fld:15s} LOCAL=\"{lv}\"  SERVER=\"{sv}\"")

    if local_worse:
        print(f"\n--- LOCAL WORSE ({len(local_worse)}) ---")
        for fname, fld, lv, sv in local_worse:
            short = fname.replace("resumes_cache/", "")
            print(f"  {short:50s} {fld:15s} LOCAL=\"{lv}\"  SERVER=\"{sv}\"")

    if both_diff:
        print(f"\n--- BOTH DIFFERENT ({len(both_diff)}) ---")
        for fname, fld, lv, sv in both_diff:
            short = fname.replace("resumes_cache/", "")
            print(f"  {short:50s} {fld:15s} LOCAL=\"{lv}\"  SERVER=\"{sv}\"")

if __name__ == "__main__":
    main()
