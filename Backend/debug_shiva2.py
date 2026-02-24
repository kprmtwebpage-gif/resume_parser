"""Debug extract_name result for shiva-Yadhav.docx"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

import docx2txt
import parser as p

resume_path = os.path.join(os.path.dirname(__file__), 'resumes_cache', 'shiva-Yadhav.docx')
text = docx2txt.process(resume_path)

# What does extract_name return?
fn, ln = p.extract_name(text)
print(f"extract_name => first='{fn}'  last='{ln}'")

# Also show infer_name_from_filename separately
ffn, fln = p.infer_name_from_filename('shiva-Yadhav.docx')
print(f"infer_name_from_filename => first='{ffn}'  last='{fln}'")
