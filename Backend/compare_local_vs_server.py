"""
compare_local_vs_server.py
==========================
Parses ALL resumes locally using the current parser code,
then fetches the hosted server's API data and compares every field.
No Docker needed — uses Python directly.
"""
import os, sys, json, urllib.request, pathlib, traceback

# Ensure Backend/ imports work
sys.path.insert(0, str(pathlib.Path(__file__).parent))

from parser import (
    extract_name, infer_name_from_filename, extract_email,
    extract_job_title, extract_address, extract_phone,
    extract_text_from_pdf, extract_text_from_docx,
    extract_text_and_first_page_from_pdf,
)

SERVER_URL = "http://kprmtglobalsolutions.duckdns.org:8002/candidates?limit=200"
RESUME_DIR = pathlib.Path(__file__).parent / "resumes_cache"


def fetch_server_data():
    """Fetch all candidates from the hosted server API."""
    req = urllib.request.Request(SERVER_URL)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def parse_resume_locally(filepath):
    """Parse a single resume file and return extracted fields."""
    ext = filepath.suffix.lower()
    first_page = ""
    if ext == ".pdf":
        try:
            text, first_page = extract_text_and_first_page_from_pdf(str(filepath))
        except:
            text = extract_text_from_pdf(str(filepath))
    elif ext in (".docx", ".doc"):
        text = extract_text_from_docx(str(filepath))
    else:
        return None

    if not text or not text.strip():
        return None

    filename = os.path.basename(filepath)
    header_text = first_page if first_page else text[:3000]

    email = extract_email(header_text) or extract_email(text)
    body_name_top = extract_name(header_text, email=email)
    body_name_full = extract_name(text, email=email)

    _top_parts = sum(bool(x) for x in body_name_top)
    _full_parts = sum(bool(x) for x in body_name_full)
    if _top_parts >= 2:
        body_name = body_name_top
    elif _top_parts == 1 and _full_parts >= 2:
        body_name = body_name_full
    elif _top_parts >= _full_parts:
        body_name = body_name_top
    else:
        body_name = body_name_full

    file_name_guess = infer_name_from_filename(filename, email=email)

    # Merge body + filename name (same logic as main() in parser.py)
    b_first, b_last = body_name
    f_first, f_last = file_name_guess
    first_name = b_first or f_first or None
    last_name = b_last or f_last or None

    job_title = extract_job_title(text, first_name=first_name or "", last_name=last_name or "")
    location = extract_address(text, first_name=first_name, last_name=last_name)

    return {
        "first_name": first_name,
        "last_name": last_name,
        "job_title": job_title,
        "location": location,
        "email": email,
    }


def main():
    print("=" * 90)
    print("LOCAL vs SERVER COMPARISON")
    print("=" * 90)

    # Fetch server data
    print("\nFetching server data...")
    server_candidates = fetch_server_data()
    print(f"  Server: {len(server_candidates)} candidates\n")

    # Build server lookup by resume_filename
    server_by_file = {}
    for c in server_candidates:
        fn = c.get("resume_filename", "")
        # Normalize: server stores "resumes_cache/Foo.pdf"
        basename = os.path.basename(fn) if fn else ""
        if basename:
            server_by_file[basename] = c

    # Get all resume files locally
    if not RESUME_DIR.exists():
        print(f"ERROR: Resume directory not found: {RESUME_DIR}")
        return

    resume_files = sorted([
        f for f in RESUME_DIR.iterdir()
        if f.suffix.lower() in ('.pdf', '.docx', '.doc')
    ])
    print(f"Local resumes found: {len(resume_files)}\n")

    # Compare
    match_count = 0
    diff_count = 0
    errors = []
    diffs = []

    for i, fpath in enumerate(resume_files, 1):
        fname = fpath.name
        server_data = server_by_file.get(fname)
        if not server_data:
            errors.append(f"  {fname}: NOT FOUND on server")
            continue

        try:
            local = parse_resume_locally(fpath)
        except Exception as e:
            errors.append(f"  {fname}: LOCAL PARSE ERROR: {e}")
            continue

        if local is None:
            errors.append(f"  {fname}: LOCAL returned no text")
            continue

        # Compare fields
        fields_to_compare = ["first_name", "last_name", "job_title", "location"]
        field_diffs = []
        for field in fields_to_compare:
            local_val = (local.get(field) or "").strip()
            server_val = (server_data.get(field) or "").strip()
            if local_val.lower() != server_val.lower():
                field_diffs.append((field, local_val, server_val))

        if field_diffs:
            diff_count += 1
            diff_lines = [f"  [{diff_count}] {fname}:"]
            for field, lv, sv in field_diffs:
                diff_lines.append(f"      {field:15s}: LOCAL='{lv}'  SERVER='{sv}'")
            diffs.append("\n".join(diff_lines))
        else:
            match_count += 1

        # Progress
        if i % 10 == 0:
            print(f"  Processed {i}/{len(resume_files)}...")

    # Print results
    print(f"\n{'=' * 90}")
    print(f"RESULTS: {match_count} MATCH | {diff_count} DIFFERENT | {len(errors)} ERRORS")
    print(f"{'=' * 90}")

    if diffs:
        print(f"\n--- DIFFERENCES ({diff_count}) ---")
        for d in diffs:
            print(d)

    if errors:
        print(f"\n--- ERRORS ({len(errors)}) ---")
        for e in errors:
            print(e)

    if not diffs and not errors:
        print("\n*** ALL CANDIDATES MATCH PERFECTLY! ***")

    print(f"\n{'=' * 90}")
    accuracy = match_count / (match_count + diff_count) * 100 if (match_count + diff_count) > 0 else 0
    print(f"Match rate: {accuracy:.1f}% ({match_count}/{match_count + diff_count})")
    print(f"{'=' * 90}")


if __name__ == "__main__":
    main()
