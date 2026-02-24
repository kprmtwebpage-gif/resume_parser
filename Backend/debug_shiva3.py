"""Deep debug of extract_name for shiva-Yadhav.docx"""
import os, sys, re
import unicodedata
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

import docx2txt
import parser as p

resume_path = os.path.join(os.path.dirname(__file__), 'resumes_cache', 'shiva-Yadhav.docx')
text = docx2txt.process(resume_path)

# Show what non_empty_lines + _segment_compact_line gives for the first 20 lines
print("=== PROCESSED LINES (first 20) ===")
processed = [p._segment_compact_line(ln) for ln in p.non_empty_lines(text)]
for i, line in enumerate(processed[:20]):
    print(f"  [{i:2d}] {repr(line)}")

# Re-implement the candidates loop with debug output
print("\n=== CANDIDATES FROM BODY ===")
