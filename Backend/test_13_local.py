"""Test local parsing of the 13 candidates with missing locations on server."""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from parser import (
    extract_text_from_pdf,
    extract_text_from_docx,
    extract_name,
    infer_name_from_filename,
    extract_address,
    extract_email,
)

test_files = [
    "resumes_cache/PranavResume.docx",
    "resumes_cache/KAVYA-JAVA Resume.docx",
    "resumes_cache/Abhiram full stack .Net Developer updated.docx",
    "resumes_cache/Bharadwaj P .net.docx",
    "resumes_cache/Prashanth CV.docx",
    "resumes_cache/ResumeJagadeeshK.pdf",
    "resumes_cache/ResumePavaniGoli.pdf",
    "resumes_cache/ResumePavaniP.pdf",
    "resumes_cache/ResumeRamPolsani.pdf",
    "resumes_cache/ResumeSolGar.pdf",
    "resumes_cache/ResumeVidyaSagarAshamgari.pdf",
    "resumes_cache/TejaswiniPullaResume.docx",
    "resumes_cache/Akhil Gotteparthi.docx",
]

for fpath in test_files:
    if not os.path.exists(fpath):
        print(f"NOT FOUND: {fpath}\n")
        continue

    if fpath.endswith(".docx"):
        text = extract_text_from_docx(fpath)
    else:
        text = extract_text_from_pdf(fpath)

    email = extract_email(text)
    fn, ln = extract_name(text, email=email)
    if not fn:
        fn2, ln2 = infer_name_from_filename(os.path.basename(fpath), email=email)
        if fn2:
            fn, ln = fn2, ln2

    addr = extract_address(text, first_name=fn, last_name=ln)

    print(f"{os.path.basename(fpath)}:")
    print(f"  name     = {fn} {ln}")
    print(f"  location = [{addr}]")
    # Show first 10 lines of text to see what the parser is working with
    lines = text.split("\n")[:15]
    for i, line in enumerate(lines):
        print(f"  line[{i:2d}]: {line.rstrip()[:100]}")
    print()
