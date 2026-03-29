"""
Batch upload 1000 resumes through the API and track results.
"""
import os
import sys
import json
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

API_BASE = "http://127.0.0.1:8000"
RESUME_DIR = "bulk_resumes"
BATCH_SIZE = 20  # concurrent uploads
MAX_WAIT_SECONDS = 120  # max wait per resume for parsing

def get_token():
    r = requests.post(f"{API_BASE}/api/auth/login",
                      data={"username": "admin", "password": "Admin@123"})
    r.raise_for_status()
    return r.json()["access_token"]

def upload_one(filepath, token):
    headers = {"Authorization": f"Bearer {token}"}
    filename = os.path.basename(filepath)
    try:
        with open(filepath, "rb") as f:
            r = requests.post(f"{API_BASE}/upload-resume",
                              headers=headers,
                              files={"file": (filename, f, "application/pdf")},
                              timeout=MAX_WAIT_SECONDS)
        if r.status_code == 200:
            data = r.json()
            return {"file": filename, "status": "ok", "id": data.get("id"), "data": data}
        else:
            return {"file": filename, "status": "error", "code": r.status_code, "detail": r.text[:200]}
    except Exception as e:
        return {"file": filename, "status": "exception", "detail": str(e)[:200]}

def main():
    token = get_token()
    print(f"Authenticated. Token: {token[:20]}...")

    files = sorted([
        os.path.join(RESUME_DIR, f) for f in os.listdir(RESUME_DIR)
        if f.endswith(".pdf")
    ])
    total = len(files)
    print(f"Found {total} PDF files to upload")

    results = []
    ok = 0
    fail = 0
    start = time.time()

    with ThreadPoolExecutor(max_workers=BATCH_SIZE) as pool:
        futures = {pool.submit(upload_one, fp, token): fp for fp in files}
        for i, future in enumerate(as_completed(futures), 1):
            result = future.result()
            results.append(result)
            if result["status"] == "ok":
                ok += 1
            else:
                fail += 1
            if i % 50 == 0 or i == total:
                elapsed = time.time() - start
                rate = i / elapsed if elapsed > 0 else 0
                print(f"  [{i}/{total}] OK={ok} FAIL={fail} ({rate:.1f} resumes/sec)")

    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"BATCH UPLOAD COMPLETE")
    print(f"{'='*60}")
    print(f"Total:   {total}")
    print(f"Success: {ok}")
    print(f"Failed:  {fail}")
    print(f"Time:    {elapsed:.0f}s ({total/elapsed:.1f} resumes/sec)")

    # Save results
    with open(f"{RESUME_DIR}/upload_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to {RESUME_DIR}/upload_results.json")

    # Print failures
    failures = [r for r in results if r["status"] != "ok"]
    if failures:
        print(f"\n--- FAILURES ({len(failures)}) ---")
        for f in failures[:20]:
            print(f"  {f['file']}: [{f['status']}] {f.get('detail','')[:100]}")
        if len(failures) > 20:
            print(f"  ... and {len(failures)-20} more")

if __name__ == "__main__":
    main()
