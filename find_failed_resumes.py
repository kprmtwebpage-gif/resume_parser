#!/usr/bin/env python3
"""Accurate check: which volume files have NO matching SHA256 in the DB?"""
import subprocess, os, hashlib

VOLUME = '/var/lib/docker/volumes/resume-dev_resume_cache/_data'

# Get all SHA256s in the DB
r1 = subprocess.run(
    ['docker', 'exec', 'resume-db-dev', 'psql', '-U', 'postgres', '-d', 'resume_dev',
     '-t', '-c', 'SELECT resume_sha256 FROM candidate_profile;'],
    capture_output=True, text=True
)
db_sha256s = set(line.strip() for line in r1.stdout.splitlines() if line.strip())

print(f"SHA256s in DB: {len(db_sha256s)}")

# Check each file on disk
all_files = sorted(os.listdir(VOLUME))
total = len(all_files)

missing_in_db = []
for fname in all_files:
    fpath = os.path.join(VOLUME, fname)
    with open(fpath, 'rb') as f:
        sha = hashlib.sha256(f.read()).hexdigest()
    if sha not in db_sha256s:
        missing_in_db.append((fname, sha, os.path.splitext(fname)[1].lower()))

print(f"Files on disk: {total}")
print(f"Files with SHA256 NOT in DB: {len(missing_in_db)}")
print()

by_ext = {}
for fname, sha, ext in missing_in_db:
    by_ext.setdefault(ext, []).append(fname)

for ext, files in sorted(by_ext.items()):
    print(f"--- {ext} ({len(files)} files) ---")
    for f in files:
        print(f"  {f}")
    print()

