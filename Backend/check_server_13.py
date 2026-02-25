"""Check server data for the 13 candidates missing locations."""
import json
import urllib.request

data = json.loads(
    urllib.request.urlopen(
        "http://kprmtglobalsolutions.duckdns.org:8002/candidates?limit=200", timeout=30
    ).read()
)

missing_loc_files = [
    "Abhiram full stack .Net Developer updated.docx",
    "Akhil Gotteparthi.docx",
    "Bharadwaj P .net.docx",
    "KAVYA-JAVA Resume.docx",
    "PranavResume.docx",
    "Prashanth CV.docx",
    "ResumeJagadeeshK.pdf",
    "ResumePavaniGoli.pdf",
    "ResumePavaniP.pdf",
    "ResumeRamPolsani.pdf",
    "ResumeSolGar.pdf",
    "ResumeVidyaSagarAshamgari.pdf",
    "TejaswiniPullaResume.docx",
]

for c in data:
    rf = (c.get("resume_filename") or "").replace("resumes_cache/", "")
    if rf in missing_loc_files:
        print(f"{rf}")
        print(f"  name     = {c.get('first_name', '')} {c.get('last_name', '')}")
        print(f"  job_title= {c.get('job_title', '')}")
        print(f"  location = [{c.get('location', '')}]")
        print()
