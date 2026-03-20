"""
sync_new_resumes.py
Downloads new resumes from the production server to localhost.
Read-only on production: only uses ssh ls + scp.
Also copies each new file into Backend/resumes_cache/ for the parser.

Usage:
    python sync_new_resumes.py            # download + parse
    python sync_new_resumes.py --no-parse # download only
"""

import os
import sys
import shutil
import subprocess

# ── Config ──────────────────────────────────────────────────────────────────
SSH_KEY     = os.path.expandvars(r"%USERPROFILE%\.ssh\id_ed25519")
SERVER      = "root@89.167.60.41"
SERVER_VOL  = "/var/lib/docker/volumes/resume-prod_resume_cache/_data"

PROJECT     = r"C:\Users\prave\PycharmProjects\Resume_Parsing -Latest -Testing-Purpose"
LOCAL_DEST  = os.path.join(PROJECT, "Resumes_Production_downloaded")
CACHE_DIR   = os.path.join(PROJECT, r"Resume_Parsing -Latest -Updated_UI\Backend\resumes_cache")
BACKEND_DIR = os.path.join(PROJECT, r"Resume_Parsing -Latest -Updated_UI\Backend")
VENV_PY     = os.path.join(PROJECT, r".venv\Scripts\python.exe")

DB_NAME     = "postgres"
DB_USER     = "postgres"
DB_PASSWORD = "admin"
DB_HOST     = "127.0.0.1"
DB_PORT     = "5432"
# ────────────────────────────────────────────────────────────────────────────

SKIP_PARSE = "--no-parse" in sys.argv

print()
print("=" * 46)
print("  Sync New Resumes: Production -> Localhost")
print("=" * 46)
print()

# Validate paths
for p in [SSH_KEY, LOCAL_DEST, CACHE_DIR, BACKEND_DIR]:
    if not os.path.exists(p):
        print(f"ERROR: path not found: {p}")
        sys.exit(1)

# ── 1. List remote files (read-only SSH) ────────────────────────────────────
print("[1/4] Listing files on production server...")
r = subprocess.run(
    ["ssh", "-i", SSH_KEY, "-o", "StrictHostKeyChecking=no",
     SERVER, f"ls -1 {SERVER_VOL}"],
    capture_output=True, text=True
)
if r.returncode != 0:
    print("SSH connection failed:", r.stderr.strip())
    sys.exit(1)

RESUME_EXTS = (".pdf", ".docx", ".doc")
remote_files = {
    line.strip() for line in r.stdout.strip().splitlines()
    if line.strip() and line.strip().lower().endswith(RESUME_EXTS)
}
print(f"  Production: {len(remote_files)} resume files")

# ── 2. Compare ───────────────────────────────────────────────────────────────
print("[2/4] Comparing with local copies...")
local_files = set(os.listdir(LOCAL_DEST))
new_files   = sorted(remote_files - local_files)

print(f"  Local  : {len(local_files)} files")
print(f"  NEW    : {len(new_files)} file(s) to download")

if not new_files:
    print()
    print("  Already up-to-date. No new resumes on production.")
    sys.exit(0)

print()
for f in new_files:
    print(f"    + {f}")
print()

# ── 3. Download via SCP ──────────────────────────────────────────────────────
print(f"[3/4] Downloading {len(new_files)} file(s)...")
downloaded = []
failed     = []

for fname in new_files:
    remote_path = f"{SERVER}:{SERVER_VOL}/{fname}"
    local_path  = os.path.join(LOCAL_DEST, fname)
    cache_path  = os.path.join(CACHE_DIR,  fname)

    print(f"  {fname}", end="", flush=True)
    res = subprocess.run(
        ["scp", "-q", "-i", SSH_KEY, "-o", "StrictHostKeyChecking=no",
         remote_path, local_path],
        capture_output=True
    )
    if res.returncode == 0 and os.path.exists(local_path):
        shutil.copy2(local_path, cache_path)
        downloaded.append(fname)
        print(" [OK]")
    else:
        failed.append(fname)
        err = res.stderr.decode(errors="replace").strip()[:80]
        print(f" [FAILED] {err}")

print()
print(f"  Downloaded: {len(downloaded)}  |  Failed: {len(failed)}")
if failed:
    print("  Failed files:")
    for f in failed:
        print(f"    - {f}")

if not downloaded:
    print("Nothing downloaded successfully. Exiting.")
    sys.exit(1)

# ── 4. Parse only the new files ──────────────────────────────────────────────
if SKIP_PARSE:
    print()
    print("Skipping parse (--no-parse). Run without --no-parse to also parse.")
    sys.exit(0)

print()
print(f"[4/4] Parsing {len(downloaded)} new file(s)...")

env = {
    **os.environ,
    "DB_NAME":             DB_NAME,
    "DB_USER":             DB_USER,
    "DB_PASSWORD":         DB_PASSWORD,
    "DB_HOST":             DB_HOST,
    "DB_PORT":             DB_PORT,
    "RESUME_INPUT_DIR":    CACHE_DIR,
    "RESUME_INPUT_MODE":   "local",
    "RESUME_PROCESS_ONLY": ";".join(downloaded),
    "DEPLOY_ENV":          "dev",
    "QUIET":               "0",
}

parse_result = subprocess.run(
    [VENV_PY, "parser.py"],
    cwd=BACKEND_DIR,
    env=env
)

print()
if parse_result.returncode == 0:
    # Count total in DB
    db_env = {**os.environ, "PGPASSWORD": DB_PASSWORD}
    cnt = subprocess.run(
        [r"C:\Program Files\PostgreSQL\18\bin\psql.exe",
         "-U", DB_USER, "-h", DB_HOST, "-p", DB_PORT, "-d", DB_NAME,
         "-t", "-A", "--pset=pager=off",
         "-c", "SELECT COUNT(*) FROM candidate_profile;"],
        capture_output=True, text=True, env=db_env
    ).stdout.strip()

    print("=" * 46)
    print("  Sync Complete!")
    print(f"  New files downloaded : {len(downloaded)}")
    print(f"  Total in DB now      : {cnt}")
    print("=" * 46)
else:
    print(f"Parser exited with code {parse_result.returncode} - check logs above.")

print()
