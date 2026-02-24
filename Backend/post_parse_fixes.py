"""
post_parse_fixes.py
===================
All manual data corrections keyed by resume_filename (not DB id).
Run automatically after every ingestion pass so any environment stays in sync.

Root-cause context
------------------
The parser code is identical on local and server.
The differences were caused by:
  1. spaCy missing on server (commented out in requirements.txt) ->
     validate_name() NER cross-check disabled -> some names parsed differently.
  2. Manual fix scripts (fix_job_titles_batch.py, normalize_job_titles.py,
     fix_bad_name_tokens.py, fix_keerthi_job_title.py, fix_shiva.py, etc.)
     all used hardcoded LOCAL DB ids and were never run on the server.

This file replaces all those one-off scripts.  It is keyed by resume_filename
(stable across environments) so it works on any DB without id translation.
"""
from __future__ import annotations
import os, psycopg2, psycopg2.extras
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

# -----------------------------------------------------------------------
# Corrections: resume_filename -> (first_name, last_name, job_title)
# Use None for a field to leave it unchanged.
# Use "" for last_name to clear a spurious last-name token.
# -----------------------------------------------------------------------
CORRECTIONS: dict[str, tuple[str | None, str | None, str | None]] = {
    "resumes_cache/ResumeDileepKumar.pdf":                         (None,          None,           "Senior Data Engineer"),
    "resumes_cache/ResumeHARSHAK.pdf":                            ("Harsha",       "K",            None),
    "resumes_cache/ResumeJASWANTHN.pdf":                          ("Jaswanth",     "",             "Senior Data Engineer"),
    "resumes_cache/ResumeKeerthiK.pdf":                           ("Keerthi",      "",             None),
    "resumes_cache/ResumeLohithakshA.pdf":                        (None,           None,           "Senior Data Engineer"),
    "resumes_cache/ResumeNikhilaRayala.docx":                     (None,           None,           "Senior Data Engineer"),
    "resumes_cache/ResumePavaniP.pdf":                            ("Pavani",       "",             None),
    "resumes_cache/ResumePrasanthiV.docx":                        ("Prasanthi",    "",             "Data Scientist"),
    "resumes_cache/ResumeVarunReddy.pdf":                         (None,           None,           "Senior Big Data Engineer"),
    "resumes_cache/ResumeVidyaSagarAshamgari.pdf":                (None,           None,           "Senior .NET Developer"),
    "resumes_cache/ResumeRavitejaK.pdf":                          ("Raviteja",     "",             "Azure Data Engineer"),
    "resumes_cache/ResumeApoorvaShete.pdf":                       (None,           None,           "Data Scientist"),
    "resumes_cache/ResumeVAISHNAVIK.pdf":                         ("Vaishnavi",    "",             None),
    "resumes_cache/ResumeCristianHernandez.pdf":                  (None,           None,           "Full Stack Developer and AI Engineer"),
    "resumes_cache/ResumeHarishKarneti.pdf":                      (None,           None,           "Software Developer"),
    "resumes_cache/ResumePavaniGoli.pdf":                         (None,           None,           "Full Stack .NET Developer"),
    "resumes_cache/Abhiram full stack .Net Developer updated.docx": ("Abhiram",   "",             "Full Stack .NET Developer"),
    "resumes_cache/Akshith_Dotnet Resume.docx":                   (None,           None,           "Senior .NET Full Stack Developer"),
    "resumes_cache/Aravind_.Net Developer.pdf":                   (None,           None,           "Software Developer"),
    "resumes_cache/AT_Resume.pdf":                                (None,           None,           "Senior Software Engineer"),
    "resumes_cache/balakrishna full STACk Java Resume.docx":      ("Balakrishna",  "",             None),
    "resumes_cache/Bhagya_Lakshmi_.Netresume.docx":              ("Bhagya",       "Lakshmi",      "Full Stack .NET Developer"),
    "resumes_cache/Bharadwaj P .net.docx":                        ("Bharadwaj",    "",             "Full Stack Developer"),
    "resumes_cache/Chandan_Dhonadhi_Resume.pdf":                  (None,           None,           "Senior Developer"),
    "resumes_cache/CVBambotRonald.pdf":                           (None,           None,           "DevOps Engineer"),
    "resumes_cache/CVCharlieMaere.pdf":                           (None,           None,           "Global Director, AI Expert & Digital Health Leader"),
    "resumes_cache/Daudul_Resume.docx":                           (None,           None,           "Full Stack .NET Developer"),
    "resumes_cache/Divya.Resume.docx":                            (None,           None,           "Senior Dot Net Developer"),
    "resumes_cache/GEETHA TELLAGORLA.pdf":                        (None,           None,           "Full-Stack Developer"),
    "resumes_cache/Giri .Net Developer.docx":                     (None,           None,           "Senior Full Stack .NET Developer"),
    "resumes_cache/GouthamReddy_DotNet Developer.docx":           (None,           None,           "Full Stack .NET Developer"),
    "resumes_cache/java resume new.pdf":                          (None,           None,           "Senior Java Full Stack Developer"),
    "resumes_cache/KAVYA-JAVA Resume.docx":                       ("Kavya",        "",             "Senior Java Full Stack Developer"),
    "resumes_cache/MahithaSai_.NetFullStack.docx":                (None,           None,           "Full Stack Developer"),
    "resumes_cache/Namitha_Jammula_Resume.docx":                  (None,           None,           "Full Stack .NET Developer"),
    "resumes_cache/NiharikaPoreddy_ .NET Developer.pdf":          (None,           None,           "Implementation Engineer II"),
    "resumes_cache/Nitin banswani-ResumeP.docx":                  (None,           None,           "Software Consultant - Lead"),
    "resumes_cache/Pankaj Goel - Resume.pdf":                     (None,           None,           ".NET Full Stack Developer"),
    "resumes_cache/PranavResume.docx":                            (None,           None,           "Full Stack .NET Developer"),
    "resumes_cache/Prashanth CV.docx":                            (None,           None,           "Senior Java Developer"),
    "resumes_cache/Praveen Chintada(.net Developer).docx":        (None,           None,           "Full Stack Developer"),
    "resumes_cache/Praveen Reddy.Net Resume.docx":                (None,           None,           "Full Stack Developer"),
    "resumes_cache/PriyankaAdhikari_Dotnet_Developer.docx":       ("Priyanka",     "Adhikari",     "Senior .NET Developer"),
    "resumes_cache/ResumeAravindReddyMudela.pdf":                 (None,           None,           "Big Data Engineer"),
    "resumes_cache/ResumeDivyaJava.pdf":                          ("Divya",        "",             None),
    "resumes_cache/ResumeJagadeeshK.pdf":                         (None,           None,           "Java Full Stack Developer"),
    "resumes_cache/ResumeSatyaChelluboina.docx":                  ("Satyaveni",    "Chelluboina",  None),
    "resumes_cache/Rupesh_Resume.docx":                           ("Rupesh",       "",             "Senior Net Full Stack Developer"),
    "resumes_cache/Saikrishna_Sr. Dot Net Developer.docx":        (None,           None,           "Senior .NET Developer"),
    "resumes_cache/Salman_FullTIme.docx":                         (None,           None,           "Full Stack Developer"),
    "resumes_cache/SATWIK .NET RESUME.pdf":                       ("Satwik",       "",             "Senior .NET Developer"),
    "resumes_cache/shiva-Yadhav.docx":                            (None,           None,           "Senior Full Stack .NET Developer"),
    "resumes_cache/SoftwareEngineer_Niharika_Resume.docx":        ("Niharika",     "A",            "Software Engineer"),
    "resumes_cache/soufyane-resume.pdf":                          (None,           None,           "Full Stack .NET Developer"),
    "resumes_cache/SreejaDotnetdeveloper 1.docx":                 ("Sreeja",       "",             "Dot Net Full Stack Developer"),
    "resumes_cache/Sridher_Reddy_k.pdf":                          (None,           None,           "Senior .NET Developer"),
    "resumes_cache/Tajah Daley Resume.pdf":                       (None,           None,           "Full Stack Software Developer"),
    "resumes_cache/TEJA'S resume.docx":                           ("Teja",         "",             "Software Developer"),
    "resumes_cache/TejaswiniPullaResume.docx":                    (None,           None,           "Software Engineer III"),
    "resumes_cache/Vani_Atmakur_Dot_Net_Resume.docx":             (None,           None,           "Senior Full Stack .NET Developer"),
    "resumes_cache/VaralakshmiPuppala_Resume.docx":               (None,           None,           "Senior .NET Developer"),
    "resumes_cache/Venkat_M-CV.pdf":                              ("Venkat",       "",             "Full-Stack Software Developer"),
    "resumes_cache/yu_zhong_resume.pdf":                          (None,           None,           "Software Developer"),
    "resumes_cache/Ushasree__Kamala__Resume.pdf":                 (None,           None,           ".NET Developer"),
}


def apply_fixes() -> None:
    """Apply all corrections to the database. Called after every ingestion pass."""
    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        cursor_factory=psycopg2.extras.RealDictCursor,
    )
    PROFILE_TABLE = os.getenv("NEW_CANDIDATES_TABLE", "candidate_profile")
    SKILLS_TABLE  = os.getenv("NEW_SKILLS_TABLE",      "candidate_skills_profile")
    fixed = 0
    try:
        with conn:
            with conn.cursor() as cur:
                for filename, (fn, ln, job) in CORRECTIONS.items():
                    cur.execute(
                        f"SELECT id FROM {PROFILE_TABLE} WHERE resume_filename = %s",
                        (filename,),
                    )
                    row = cur.fetchone()
                    if not row:
                        continue
                    cid = row["id"]
                    if fn is not None or ln is not None:
                        cur.execute(
                            f"UPDATE {PROFILE_TABLE} SET first_name=%s, last_name=%s WHERE id=%s",
                            (fn or None, ln if ln != "" else None, cid),
                        )
                    if job is not None:
                        cur.execute(
                            f"UPDATE {SKILLS_TABLE} SET job_title=%s WHERE candidate_id=%s",
                            (job or None, cid),
                        )
                    fixed += 1
    finally:
        conn.close()
    print(f"[post_parse_fixes] Applied corrections to {fixed} candidates.")


if __name__ == "__main__":
    apply_fixes()
