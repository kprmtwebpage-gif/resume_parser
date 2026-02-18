from parser import extract_pdf_with_timeout, extract_text_from_docx
import os

resumes = [
    ('resumes/ResumeAngirgeMukesh.docx', 'docx'),
    ('resumes/ResumeGUSTAVOFÉLIX.pdf', 'pdf'),
    ('resumes/ResumeKeerthiK.pdf', 'pdf'),
    ('resumes/ResumeParthPatel.docx', 'docx'),
    ('resumes/ResumeNagaGudibandla.pdf', 'pdf'),
]

for filepath, filetype in resumes:
    print(f"\n{'='*80}")
    print(f"FILE: {filepath}")
    print('='*80)
    try:
        if filetype == 'docx':
            text = extract_text_from_docx(filepath)
        else:
            text = extract_pdf_with_timeout(filepath, timeout=10)
        
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        # Print first 20 lines
        for line in lines[:20]:
            print(line)
    except Exception as e:
        print(f"ERROR: {e}")
