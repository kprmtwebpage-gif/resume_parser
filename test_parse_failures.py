#!/usr/bin/env python3
"""Run parser verbosely on each unique failing file to find actual errors."""
import subprocess, os, hashlib

VOLUME = '/var/lib/docker/volumes/resume-dev_resume_cache/_data'

# Files not in DB by SHA (from previous analysis) - pick one per unique SHA
candidates = [
    "Arun.doc",
    "BATTULA DRUVANA- Senior AI-ML Engineer.docx",
    "ChetanNag_Resume.pdf",
    "Divya_Angular_Developer.docx",
    "KPRMT _ Devi Sudha Lam _ .Net architect (1).docx",
    "KPRMT _ Divya _ Ui Ang dev.docx",
    "KPRMT _ Karthik_Ui Angular dev.docx",
    "Keerthi Resume updated (1).pdf",
    "Keerthi Resume updated.pdf",
    "LAKSHMI RESHMA AIML.docx",
    "Manickam C_Senior QA Engineer.docx",
    "Nikhil-Resume.docx",
    "Raghuram_Bhagawatula_Architect.docx",
    "Rama_Resume_Databricks_PySpark_SoluArch (1) (1).docx",
    "Ramyasri Karuturi Java Full Stack Developer with (AI-LLM).docx",
    "Resume_Arpish Chatterjee_Feb2026.docx",
    "ResumeMirTalpur.pdf",
    "SANDEEP_Lead Business Analyst_QA.docx",
    "Sasikala_Sr .Net React developer.docx",
    "Senior_Windows_Engineer_Resume_OPT - Copy.docx",
    "Srinath Scrum CV (1) (1).docx",
    "Srinivas_ Data Scientist Resume.docx",
    "Suresh Kumar B .Net  resume.docx",
    "Vamshi_Senior_Network_CloudEngineer_Resume - Copy.docx",
    "Vijay Gollapalli Resume.docx",
    "Vijay_ Lead Fullstack Java_UI Developer.docx",
    "claireliResume.docx",
]

print(f"Testing {len(candidates)} unique failing files...\n")

for fname in candidates:
    r = subprocess.run(
        ['docker', 'exec',
         '-e', 'RESUME_INPUT_DIR=/app/Backend/resumes_cache',
         '-e', f'RESUME_PROCESS_ONLY={fname}',
         '-e', 'QUIET=0',
         '-e', 'PYTHONIOENCODING=utf-8',
         'resume-api-dev', 'python', '/app/Backend/parser.py'],
        capture_output=True, text=True, timeout=90
    )
    output = (r.stdout + r.stderr).strip()
    # Show key lines only
    key_lines = []
    for line in output.splitlines():
        low = line.lower()
        if any(k in low for k in ['skip', 'error', 'warn', 'fail', 'empty', 'no text', 'insufficient',
                                    'inserted', 'updated', 'upsert', 'parsing', 'exception', 'traceback']):
            key_lines.append(line.strip())
    
    status = "✅" if r.returncode == 0 else "❌"
    print(f"{status} {fname}")
    for l in key_lines[-5:]:
        print(f"   {l}")
    if not key_lines:
        print(f"   [no key output] last line: {output.splitlines()[-1] if output else '(empty)'}")
    print()
