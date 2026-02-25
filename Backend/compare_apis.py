"""Compare candidate data from local API vs hosted server API."""
import json
import urllib.request

LOCAL_URL = "http://127.0.0.1:8000/candidates?limit=200"
SERVER_URL = "http://kprmtglobalsolutions.duckdns.org:8002/candidates?limit=200"

def fetch(url):
    resp = urllib.request.urlopen(url, timeout=30)
    return json.loads(resp.read())

def main():
    print("Fetching local data...")
    local_data = fetch(LOCAL_URL)
    print(f"  Local candidates: {len(local_data)}")

    print("Fetching server data...")
    server_data = fetch(SERVER_URL)
    print(f"  Server candidates: {len(server_data)}")

    local_by_file = {c.get("resume_filename", ""): c for c in local_data}
    server_by_file = {c.get("resume_filename", ""): c for c in server_data}

    all_files = sorted(set(list(local_by_file.keys()) + list(server_by_file.keys())))

    fields = ["first_name", "last_name", "job_title", "location"]
    matches = 0
    diffs = []
    local_only = []
    server_only = []

    for f in all_files:
        if not f:
            continue
        lc = local_by_file.get(f)
        sc = server_by_file.get(f)
        if lc and not sc:
            local_only.append(f)
            continue
        if sc and not lc:
            server_only.append(f)
            continue
        field_diffs = {}
        for fld in fields:
            lv = (lc.get(fld) or "").strip()
            sv = (sc.get(fld) or "").strip()
            if lv != sv:
                field_diffs[fld] = (lv, sv)
        if field_diffs:
            diffs.append((f, field_diffs))
        else:
            matches += 1

    common = len(all_files) - len(local_only) - len(server_only)
    print(f"\n{'='*80}")
    print(f"Common resumes: {common}")
    print(f"MATCH: {matches} | DIFFERENT: {len(diffs)} | Local-only: {len(local_only)} | Server-only: {len(server_only)}")
    print(f"Match rate: {matches}/{common} = {100*matches/common:.1f}%" if common else "N/A")
    print(f"{'='*80}")

    if diffs:
        print(f"\n--- DIFFERENCES ({len(diffs)}) ---")
        for i, (fname, fd) in enumerate(diffs, 1):
            print(f"  [{i}] {fname}:")
            for fld, (lv, sv) in fd.items():
                print(f'      {fld:15s}: LOCAL="{lv}"')
                print(f'      {" ":15s}  SERVER="{sv}"')

    if server_only:
        print(f"\n--- SERVER-ONLY ({len(server_only)}) ---")
        for f in server_only:
            print(f"  {f}")

    if local_only:
        print(f"\n--- LOCAL-ONLY ({len(local_only)}) ---")
        for f in local_only:
            print(f"  {f}")

    # Summary by field
    print(f"\n--- DIFFERENCE BREAKDOWN BY FIELD ---")
    field_counts = {fld: 0 for fld in fields}
    for _, fd in diffs:
        for fld in fd:
            field_counts[fld] += 1
    for fld, cnt in sorted(field_counts.items(), key=lambda x: -x[1]):
        print(f"  {fld:15s}: {cnt} differences")

if __name__ == "__main__":
    main()
