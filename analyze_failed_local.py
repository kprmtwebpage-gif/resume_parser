"""
Analyse the locally downloaded failed resumes to categorise why they fail.
Run from the project root: python analyze_failed_local.py
"""
import sys, warnings, os, glob, logging

sys.path.insert(0, 'Backend')
warnings.filterwarnings('ignore')
logging.disable(logging.CRITICAL)

failed_dir = r'C:\Users\prave\PycharmProjects\failed_resumes_local\failed_resumes'
all_files = (
    glob.glob(os.path.join(failed_dir, '*.pdf')) +
    glob.glob(os.path.join(failed_dir, '*.PDF')) +
    glob.glob(os.path.join(failed_dir, '*.docx')) +
    glob.glob(os.path.join(failed_dir, '*.doc'))
)

from parser import _is_pdf_password_protected, extract_text_from_pdf

pw_protected, extractable, truly_empty, non_pdf, errored = [], [], [], [], []

for f in all_files:
    name = os.path.basename(f)
    suffix = os.path.splitext(name)[1].lower()
    if suffix not in ('.pdf',):
        non_pdf.append(name)
        continue
    try:
        if _is_pdf_password_protected(f):
            pw_protected.append(name)
            continue
        text = extract_text_from_pdf(f).strip()
        (extractable if text else truly_empty).append(name)
    except Exception as e:
        errored.append((name, str(e)[:100]))

print(f"\n{'='*60}")
print(f"FAILED RESUME ANALYSIS ({len(all_files)} total files)")
print(f"{'='*60}")
print(f"  Password-protected (can't parse): {len(pw_protected)}")
print(f"  Extractable locally (text works):  {len(extractable)}")
print(f"  Image-only / truly empty:          {len(truly_empty)}")
print(f"  Non-PDF (docx/doc):                {len(non_pdf)}")
print(f"  Errors during extraction:          {len(errored)}")
print()

if pw_protected:
    print(f"--- Password-protected ({len(pw_protected)}) ---")
    for f in pw_protected:
        print(f"  {f}")
    print()

if truly_empty:
    print(f"--- Image-only / no text layer ({len(truly_empty)}) ---")
    for f in truly_empty:
        print(f"  {f}")
    print()

if errored:
    print(f"--- Extraction errors ({len(errored)}) ---")
    for f, e in errored:
        print(f"  [{e}] {f}")
    print()

if extractable:
    print(f"--- Extractable (failure was on server, not the file) ({len(extractable)}) ---")
    for f in extractable:
        print(f"  {f}")
