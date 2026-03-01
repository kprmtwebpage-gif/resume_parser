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
    # fmt: (first_name, last_name, job_title)
    # None = leave unchanged, "" = clear last_name to NULL
    #
    # ── Audit fixes (2026-03-01) ──────────────────────────────────────────
    # Missing last names (inferred from resume text / email / filename)
    "resumes_cache/Madhav_Lead Data Engineer_15 Years_H1B.docx":               ("Madhav",     "Kanahosur",   None),
    "resumes_cache/Resume_BI_Engineer_Nisar_Mohammad_CV.docx":                 ("Nisar",      "Mohammad",    None),
    "resumes_cache/Nikhilsai Resume_2024.pdf":                                 ("Nikhilsai",  "Pachipulusu", None),
    "resumes_cache/Sravanthi _DA_.docx":                                       ("Sravanthi",  "Myneni",      None),
    # Missing job title
    "resumes_cache/Ravi Palmieri Full-Time Resume .docx (1).pdf":              (None,         None,          "Data Scientist"),
    # Vamshi: last_name "BA" is from filename, real name is "Vamshi Bandaru"
    "resumes_cache/vamshi_BA_Resume.pdf":                                      ("Vamshi",     "Bandaru",     None),
    "resumes_cache/Abhiram full stack .Net Developer updated.docx": (None,            None,           "Full Stack .NET Developer"),
    "resumes_cache/Akshith_Dotnet Resume.docx":                    ("Akshith",       "Paspula",      "Senior .NET Full Stack Developer"),
    "resumes_cache/Aravind_.Net Developer.pdf":                    ("Aravind",       "Mallaiahgari", "Software Developer"),
    "resumes_cache/AT_Resume.pdf":                                 ("Aravind",       "Thota",        "Senior Software Engineer"),
    "resumes_cache/balakrishna full STACk Java Resume.docx":       (None,            None,           None),
    "resumes_cache/Bhagya_Lakshmi_.Netresume.docx":                (None,            None,           "Full Stack .NET Developer"),
    "resumes_cache/Bharadwaj P .net.docx":                         (None,            None,           "Full Stack Developer"),
    "resumes_cache/Chandan_Dhonadhi_Resume.pdf":                   (None,            None,           "Senior Developer"),
    "resumes_cache/CVBambotRonald.pdf":                            ("Bambot",        "Ronald",       "DevOps Engineer"),
    "resumes_cache/CVCharlieMaere.pdf":                            (None,            None,           "Global Director, AI Expert & Digital Health Leader"),
    "resumes_cache/Daudul_Resume.docx":                            (None,            None,           "Full Stack .NET Developer"),
    "resumes_cache/Divya.Resume.docx":                             (None,            None,           "Senior .NET Developer"),
    "resumes_cache/GEETHA TELLAGORLA.pdf":                         ("Geethanjali",   "Tellagorla",   "Full-Stack Developer"),
    "resumes_cache/Giri .Net Developer.docx":                      ("Giri",          "Sheluvari",    "Senior Full Stack .NET Developer"),
    "resumes_cache/GouthamReddy_DotNet Developer.docx":            ("Goutham",       "Reddy",        "Full Stack .NET Developer"),
    "resumes_cache/java resume new.pdf":                           ("Sai",           "Venkat",       "Senior Java Full Stack Developer"),
    "resumes_cache/KAVYA-JAVA Resume.docx":                        (None,            None,           "Senior Java Full Stack Developer"),
    "resumes_cache/MahithaSai_.NetFullStack.docx":                 ("Mahitha",       "Sai",          "Full Stack Developer"),
    "resumes_cache/Namitha_Jammula_Resume.docx":                   (None,            None,           "Full Stack .NET Developer"),
    "resumes_cache/NiharikaPoreddy_ .NET Developer.pdf":           (None,            None,           "Implementation Engineer II"),
    "resumes_cache/Nitin banswani-ResumeP.docx":                   (None,            None,           "Software Consultant - Lead"),
    "resumes_cache/Pankaj Goel - Resume.pdf":                      (None,            None,           ".NET Full Stack Developer"),
    "resumes_cache/PranavResume.docx":                             (None,            None,           "Full Stack .NET Developer"),
    "resumes_cache/Prashanth CV.docx":                             ("Prashanth",     "Vadla",        "Senior Java Developer"),
    "resumes_cache/Praveen Chintada(.net Developer).docx":         ("Praveen",       "Chintada",     "Full Stack Developer"),
    "resumes_cache/Praveen Reddy.Net Resume.docx":                 ("Praveen",       "Talupu",       "Full Stack Developer"),
    "resumes_cache/PriyankaAdhikari_Dotnet_Developer.docx":        ("Priyanka",      "Adhikari",     "Senior .NET Developer"),
    "resumes_cache/Pruthvik_K.docx":                               ("Pruthvik",      "Kakadiya",     "Java Full Stack Developer"),
    "resumes_cache/Ranajith_Reddy_Resume.pdf":                     ("Ranajith",      "Reddy",        "Full Stack Developer"),
    "resumes_cache/ResumeApoorvaShete.pdf":                        ("Apoorva",       "Shete",        "Data Scientist"),
    "resumes_cache/ResumeAravindReddyMudela.pdf":                  ("Aravind",       "Mudela",       "Big Data Engineer"),
    "resumes_cache/ResumeChristopherAhn.pdf":                      ("Christopher",   "Ahn",          "Senior Software Engineer"),
    "resumes_cache/ResumeCristianHernandez.pdf":                   (None,            None,           "Full Stack Developer and AI Engineer"),
    "resumes_cache/ResumeDileepKumar.pdf":                         ("Dileep",        "Kumar",        "Senior Data Engineer"),
    "resumes_cache/ResumeDivyaJava.pdf":                           (None,            None,           None),
    "resumes_cache/ResumeHarishKarneti.pdf":                       ("Harish",        "Karneti",      "Software Developer"),
    "resumes_cache/ResumeHARSHAK.pdf":                             ("Harsha",        "K",            None),
    "resumes_cache/ResumeJagadeeshK.pdf":                          ("Jagadeesh",     "Nunna",        "Java Full Stack Developer"),
    "resumes_cache/ResumeJASWANTHN.pdf":                           (None,            None,           "Senior Data Engineer"),
    "resumes_cache/ResumeKeerthiK.pdf":                            ("Keerthi",       "K",            None),
    "resumes_cache/ResumeLohithakshA.pdf":                         (None,            None,           "Senior Data Engineer"),
    "resumes_cache/ResumeNikhilaRayala.docx":                      (None,            None,           "Senior Data Engineer"),
    "resumes_cache/ResumePavaniGoli.pdf":                          (None,            None,           "Full Stack .NET Developer"),
    "resumes_cache/ResumePavaniP.pdf":                             ("Pavani",        "P",            None),
    "resumes_cache/ResumePrasanthiV.docx":                         (None,            None,           "Data Scientist"),
    "resumes_cache/ResumeRavitejaK.pdf":                           (None,            None,           "Azure Data Engineer"),
    "resumes_cache/ResumeSadiqM.pdf":                              ("Sadiq",         "M",            None),
    "resumes_cache/ResumeSaiJanapala.pdf":                         ("Sai",           "Janapala",     None),
    "resumes_cache/ResumeSatyaChelluboina.docx":                   ("Satyaveni",     "Chelluboina",  None),
    "resumes_cache/ResumeShirishGanta.pdf":                        ("Shirish",       "Ganta",        "Java Full Stack Developer"),
    "resumes_cache/ResumeVAISHNAVIK.pdf":                          (None,            None,           None),
    "resumes_cache/ResumeVarunReddy.pdf":                          (None,            None,           "Senior Big Data Engineer"),
    "resumes_cache/ResumeVidyaSagarAshamgari.pdf":                 (None,            None,           "Senior .NET Developer"),
    "resumes_cache/Rupesh_Resume.docx":                            (None,            None,           "Senior .NET Full Stack Developer"),
    "resumes_cache/Saikrishna_Sr. Dot Net Developer.docx":         ("Sai",           "Krishna",      "Senior .NET Developer"),
    "resumes_cache/Salman_FullTIme.docx":                          ("Mohammed",      "Salman",       "Full Stack Developer"),
    "resumes_cache/SATWIK .NET RESUME.pdf":                        (None,            None,           "Senior .NET Developer"),
    "resumes_cache/shiva-Yadhav.docx":                             ("Shiva",         "Yadhav",       "Senior Full Stack .NET Developer"),
    "resumes_cache/SoftwareEngineer_Niharika_Resume.docx":         ("Niharika",      "A",            "Software Engineer"),
    "resumes_cache/soufyane-resume.pdf":                           ("Soufyane",      "Naciri",       "Full Stack .NET Developer"),
    "resumes_cache/SreejaDotnetdeveloper 1.docx":                  (None,            None,           ".NET Full Stack Developer"),
    "resumes_cache/Sridher_Reddy_k.pdf":                           ("Sridher",       "Kankanala",    "Senior .NET Developer"),
    "resumes_cache/Tajah Daley Resume.pdf":                        ("Tajah",         "Daley",        "Full Stack Software Developer"),
    "resumes_cache/TEJA'S resume.docx":                            ("Tejavardhan",   "Kallur",       "Software Developer"),
    "resumes_cache/TejaswiniPullaResume.docx":                     (None,            None,           "Software Engineer III"),
    "resumes_cache/Vani_Atmakur_Dot_Net_Resume.docx":              ("Vani",          "Atmakur",      "Senior Full Stack .NET Developer"),
    "resumes_cache/VaralakshmiPuppala_Resume.docx":                ("Varalakshmi",   "Puppala",      "Senior .NET Developer"),
    "resumes_cache/Venkat_M-CV.pdf":                               (None,            None,           "Full-Stack Software Developer"),
    "resumes_cache/Viradia Priyank-Full Stack Developer Updated.pdf": ("Viradia",   "Priyank",       "Full Stack Developer"),
    "resumes_cache/yu_zhong_resume.pdf":                           (None,            None,           "Software Developer"),
    "resumes_cache/Ushasree__Kamala__Resume.pdf":                  (None,            None,           ".NET Developer"),
    "resumes_cache/ResumeSaiSanthosh (1).pdf":                     ("Sai",           "Santhosh",     "Senior Data Engineer"),
    "resumes_cache/ResumeSuryaPrakash_1771934430.pdf":             (None,            None,           ".NET Full Stack Developer"),
}

# -----------------------------------------------------------------------
# Extended corrections for fields beyond name/job_title.
# resume_filename -> dict of column->value for candidate_profile or
#   candidate_skills_profile updates.
# Keys prefixed with "cp." update candidate_profile, "csp." for skills.
# -----------------------------------------------------------------------
EXTENDED_CORRECTIONS: dict[str, dict[str, object]] = {
    # Shraddha Sharma: missing email + address (PDF split the text across lines)
    "resumes_cache/Shraddha Sharma Resume PDF.pdf": {
        "cp.email":   "sharmashraddha281@gmail.com",
        "cp.address": "Ghaziabad, Uttar Pradesh, India",
    },
    # Poorvi Raut: 39.5 years is wrong, actual ~3.5 years
    "resumes_cache/Poorvi_Raut_Updated (1).pdf": {
        "csp.years_of_experience": 3.5,
    },
    # Brandon Dutcher: missing YOE (Apr 2024 – Present ≈ 2 years)
    "resumes_cache/Brandon Dutcher-Data Analyst Resume.pdf": {
        "csp.years_of_experience": 2.0,
    },
    # Charita Tummala: missing YOE (01/2019 – Present ≈ 7 years)
    "resumes_cache/Charita.pdf": {
        "csp.years_of_experience": 7.0,
    },
    # Yukti Doshi: missing YOE (intern-level, ~1 year total)
    "resumes_cache/YUKTI DOSHI_Resume_Data.pdf": {
        "csp.years_of_experience": 1.0,
    },
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

                # ── Extended corrections ──────────────────────────────────
                for filename, updates in EXTENDED_CORRECTIONS.items():
                    cur.execute(
                        f"SELECT id FROM {PROFILE_TABLE} WHERE resume_filename = %s",
                        (filename,),
                    )
                    row = cur.fetchone()
                    if not row:
                        continue
                    cid = row["id"]
                    cp_sets, cp_vals = [], []
                    csp_sets, csp_vals = [], []
                    for key, val in updates.items():
                        tbl, col = key.split(".", 1)
                        if tbl == "cp":
                            cp_sets.append(f"{col} = %s")
                            cp_vals.append(val)
                        elif tbl == "csp":
                            csp_sets.append(f"{col} = %s")
                            csp_vals.append(val)
                    if cp_sets:
                        cur.execute(
                            f"UPDATE {PROFILE_TABLE} SET {', '.join(cp_sets)} WHERE id = %s",
                            cp_vals + [cid],
                        )
                    if csp_sets:
                        cur.execute(
                            f"UPDATE {SKILLS_TABLE} SET {', '.join(csp_sets)} WHERE candidate_id = %s",
                            csp_vals + [cid],
                        )
                    fixed += 1
    finally:
        conn.close()
    print(f"[post_parse_fixes] Applied corrections to {fixed} candidates.")


if __name__ == "__main__":
    apply_fixes()
