import psycopg2
from dotenv import load_dotenv
import os
from parser import extract_pdf_with_timeout, extract_text_from_docx

load_dotenv()

# Extract job titles from resumes
print("Extracting job titles from resumes...")
print("=" * 80)

# Angirge Mukesh
text = extract_text_from_docx('resumes/ResumeAngirgeMukesh.docx')
lines = [l.strip() for l in text.split('\n') if l.strip()]
print(f"Angirge Mukesh (ID 6):")
for i, line in enumerate(lines[:10]):
    print(f"  {line}")
    if 'developer' in line.lower() or '.net' in line.lower():
        print(f"  >>> JOB TITLE FOUND: {line}")
        break

print("\n" + "=" * 80)

# Gustavo Felix  
try:
    text = extract_pdf_with_timeout('resumes/ResumeGUSTAVOFÉLIX.pdf', timeout_seconds=10)
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    print(f"Gustavo Felix (ID 14):")
    for i, line in enumerate(lines[:15]):
        print(f"  {line}")
        if 'engineer' in line.lower() or 'developer' in line.lower():
            print(f"  >>> JOB TITLE FOUND: {line}")
            break
except Exception as e:
    print(f"Gustavo Felix (ID 14): ERROR - {e}")

print("\n" + "=" * 80)

# Keerthi Suresh
try:
    text = extract_pdf_with_timeout('resumes/ResumeKeerthiK.pdf', timeout_seconds=10)
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    print(f"Keerthi Suresh (ID 22):")
    for i, line in enumerate(lines[:15]):
        print(f"  {line}")
        if 'developer' in line.lower() or 'engineer' in line.lower():
            print(f"  >>> JOB TITLE FOUND: {line}")
            break
except Exception as e:
    print(f"Keerthi Suresh (ID 22): ERROR - {e}")

print("\n" + "=" * 80)

# Parth Patel
text = extract_text_from_docx('resumes/ResumeParthPatel.docx')
lines = [l.strip() for l in text.split('\n') if l.strip()]
print(f"Parth Patel (ID 30):")
for i, line in enumerate(lines[:15]):
    print(f"  {line}")
    if 'developer' in line.lower() or 'engineer' in line.lower():
        print(f"  >>> JOB TITLE FOUND: {line}")
        break

print("\n" + "=" * 80)

# Sivasai Gudibandla (Naga Gudibandla)
try:
    text = extract_pdf_with_timeout('resumes/ResumeNagaGudibandla.pdf', timeout_seconds=10)
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    print(f"Sivasai Gudibandla / Naga Gudibandla (ID 28):")
    for i, line in enumerate(lines[:15]):
        print(f"  {line}")
        if 'developer' in line.lower() or 'engineer' in line.lower() or 'analyst' in line.lower():
            print(f"  >>> JOB TITLE FOUND: {line}")
            break
except Exception as e:
    print(f"Sivasai Gudibandla (ID 28): ERROR - {e}")
