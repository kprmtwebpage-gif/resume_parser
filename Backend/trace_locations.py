"""Trace extract_address for the 13 problem candidates to find root cause."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))

from parser import (
    extract_text_from_pdf,
    extract_text_from_docx,
    extract_name,
    infer_name_from_filename,
    extract_address,
    extract_email,
    extract_phone,
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

# Also check if location_parser is available
try:
    from location_parser import (
        detect_location_with_fallback,
        detect_location_from_phone,
        location_result_to_string,
    )
    LP_AVAILABLE = True
    print("location_parser: AVAILABLE")
except ImportError as e:
    LP_AVAILABLE = False
    print(f"location_parser: NOT AVAILABLE ({e})")

# Check spaCy
try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
    print(f"spaCy: AVAILABLE (model loaded)")
except Exception as e:
    print(f"spaCy: NOT AVAILABLE ({e})")

print()

for fpath in test_files:
    if not os.path.exists(fpath):
        print(f"NOT FOUND: {fpath}\n")
        continue

    fname = os.path.basename(fpath)
    if fpath.endswith(".docx"):
        text = extract_text_from_docx(fpath)
    else:
        text = extract_text_from_pdf(fpath)

    email = extract_email(text)
    fn, ln = extract_name(text, email=email)
    if not fn:
        fn2, ln2 = infer_name_from_filename(fname, email=email)
        if fn2:
            fn, ln = fn2, ln2

    phone = extract_phone(text)

    # Test extract_address WITH phone (as main() does)
    addr_with_phone = extract_address(text, first_name=fn, last_name=ln, phone=phone)
    # Test extract_address WITHOUT phone
    addr_no_phone = extract_address(text, first_name=fn, last_name=ln)

    # Test location_parser phone fallback directly
    lp_phone_result = None
    if LP_AVAILABLE and phone:
        lp_phone_result = detect_location_from_phone(str(phone))

    print(f"{fname}:")
    print(f"  phone              = {phone}")
    print(f"  addr WITH phone    = [{addr_with_phone}]")
    print(f"  addr WITHOUT phone = [{addr_no_phone}]")
    if LP_AVAILABLE and phone:
        if lp_phone_result:
            print(f"  phone area code    = {location_result_to_string(lp_phone_result)}")
        else:
            print(f"  phone area code    = (no mapping)")
    print()
