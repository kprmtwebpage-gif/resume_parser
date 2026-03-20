#!/usr/bin/env python3
"""Analyze why 71 files on disk were not parsed into candidate_profile."""
import subprocess, hashlib, os

VOLUME = '/var/lib/docker/volumes/resume-dev_resume_cache/_data'

# Get all parsed filenames and their SHA256s from DB
r1 = subprocess.run(
    ['docker', 'exec', 'resume-db-dev', 'psql', '-U', 'postgres', '-d', 'resume_dev',
     '-t', '-c', 'SELECT resume_filename, resume_sha256 FROM candidate_profile;'],
    capture_output=True, text=True
)
parsed_names = set()
parsed_sha256s = set()
for line in r1.stdout.splitlines():
    line = line.strip()
    if '|' in line:
        fname, sha = line.split('|', 1)
        parsed_names.add(fname.strip().replace('resumes_cache/', ''))
        if sha.strip():
            parsed_sha256s.add(sha.strip())

# Get all files on disk
all_files = sorted(os.listdir(VOLUME))
failed_files = [f for f in all_files if f not in parsed_names]

print(f"Total files on disk: {len(all_files)}")
print(f"Parsed in DB:        {len(parsed_names)}")
print(f"Not in DB:           {len(failed_files)}")
print()

# Categorize
sha_dupes = []
doc_old = []
others = []

import re
timestamp_re = re.compile(r'_\d{7,13}(\.[^.]+)$')

for fname in failed_files:
    fpath = os.path.join(VOLUME, fname)
    ext = os.path.splitext(fname)[1].lower()

    # Compute SHA256
    try:
        with open(fpath, 'rb') as f:
            sha = hashlib.sha256(f.read()).hexdigest()
    except Exception as e:
        others.append((fname, f'READ ERROR: {e}'))
        continue

    if sha in parsed_sha256s:
        sha_dupes.append(fname)
    elif ext == '.doc':
        doc_old.append(fname)
    else:
        others.append((fname, f'SHA={sha[:12]}... ext={ext}'))

print(f"--- Category 1: SHA256 duplicates (same content already in DB): {len(sha_dupes)} ---")
for f in sha_dupes:
    print(f"  {f}")

print()
print(f"--- Category 2: Old .doc format (needs LibreOffice): {len(doc_old)} ---")
for f in doc_old:
    print(f"  {f}")

print()
print(f"--- Category 3: Genuine parse failures ({len(others)} files) ---")
for f, reason in others:
    print(f"  {f}  [{reason}]")
