from location_parser import detect_location_from_phone, location_result_to_string
r = detect_location_from_phone("12815450160")
print("phone_result:", location_result_to_string(r) if r else "None")

from parser import extract_phone, extract_address, extract_name, extract_text_from_docx, extract_email
import os

# Test KAVYA
fpath = "resumes_cache/KAVYA-JAVA Resume.docx"
if os.path.exists(fpath):
    text = extract_text_from_docx(fpath)
    email = extract_email(text)
    fn, ln = extract_name(text, email=email)
    phone = extract_phone(text)
    print(f"KAVYA phone={phone}")
    addr_with = extract_address(text, first_name=fn, last_name=ln, phone=phone)
    addr_without = extract_address(text, first_name=fn, last_name=ln)
    print(f"KAVYA addr_with_phone=[{addr_with}]")
    print(f"KAVYA addr_without_phone=[{addr_without}]")
else:
    print("KAVYA file not found")

# Test ResumeSolGar
fpath2 = "resumes_cache/ResumeSolGar.pdf"
if os.path.exists(fpath2):
    from parser import extract_text_from_pdf
    text2 = extract_text_from_pdf(fpath2)
    phone2 = extract_phone(text2)
    fn2, ln2 = extract_name(text2)
    addr2 = extract_address(text2, first_name=fn2, last_name=ln2, phone=phone2)
    print(f"SolGar phone={phone2} addr=[{addr2}]")
else:
    print("SolGar file not found")
