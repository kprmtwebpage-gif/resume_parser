"""Debug why ID 2515 (shiva-Yadhav.docx) gets first='Shiva' last='Shiva'"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

import docx2txt

resume_path = os.path.join(os.path.dirname(__file__), 'resumes_cache', 'shiva-Yadhav.docx')
text = docx2txt.process(resume_path)
lines = text.split('\n')

print("=== TOP 30 LINES OF RESUME ===")
for i, line in enumerate(lines[:30]):
    stripped = line.strip()
    if stripped:
        print(f"  [{i:3d}] {repr(stripped)}")

# Also check what infer_name_from_filename gives
from parser import infer_name_from_filename
fn, ln = infer_name_from_filename('shiva-Yadhav.docx')
print(f"\n=== infer_name_from_filename('shiva-Yadhav.docx') ===")
print(f"  first='{fn}'  last='{ln}'")
