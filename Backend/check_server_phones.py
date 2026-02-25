"""Check if server API returns phone numbers for the 13 affected candidates."""
import json
import urllib.request

data = json.loads(
    urllib.request.urlopen(
        "http://kprmtglobalsolutions.duckdns.org:8002/candidates?limit=200", timeout=30
    ).read()
)

targets = [
    "KAVYA-JAVA Resume.docx",
    "ResumePavaniP.pdf",
    "ResumeRamPolsani.pdf",
    "ResumeSolGar.pdf",
    "PranavResume.docx",
    "Prashanth CV.docx",
    "ResumeJagadeeshK.pdf",
    "ResumePavaniGoli.pdf",
    "Abhiram full stack .Net Developer updated.docx",
    "Bharadwaj P .net.docx",
    "ResumeVidyaSagarAshamgari.pdf",
    "TejaswiniPullaResume.docx",
    "Akhil Gotteparthi.docx",
]

# Print all available fields for the first candidate to see schema
if data:
    print("Available fields:", list(data[0].keys()))
    print()

for c in data:
    rf = (c.get("resume_filename") or "").replace("resumes_cache/", "")
    if rf in targets:
        phone = c.get("phone") or c.get("phone_number") or "(none)"
        location = c.get("location") or c.get("address") or "(none)"
        print(f"{rf}:")
        print(f"  phone    = {phone}")
        print(f"  location = {location}")
        print()
