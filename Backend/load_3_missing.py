"""Parse and load 3 specific missing resumes into the database"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

# Import with timeout to avoid hangs
from parser import (
    extract_pdf_with_timeout,
    extract_text_from_docx,
    normalize_text,
    _build_header_text,
    file_sha256,
    extract_email,
    extract_name,
    infer_name_from_filename,
    _name_from_email,
    _pick_best_name_pair,
    extract_phone,
    format_phone_display,
    extract_address,
    extract_linkedin,
    extract_skills,
    extract_experience_years,
    extract_visa,
    extract_certifications,
    extract_job_title,
)
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

def load_missing_resumes():
    load_dotenv()

    # Database connection
    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
    )

    CANDIDATES_TABLE = "candidate_profile"
    SKILLS_TABLE = "candidate_skills_profile"

    missing_files = [
        "ResumeIgorZivkovic.pdf",
        "ResumeKaylaRelyea.pdf",
        "ResumeNagaGudibandla.pdf",
    ]

    pdf_timeout = 45.0
    resumes_dir = Path("resumes")

    print("=" * 70)
    print(f"Parsing and loading {len(missing_files)} missing resumes:")
    for f in missing_files:
        print(f"  • {f}")
    print("=" * 70)

    loaded_count = 0

    for file in missing_files:
        path = resumes_dir / file
        if not path.exists():
            print(f"❌ File not found: {file}")
            continue

        print(f"\n📄 Processing: {file}")
        
        try:
            # Extract text
            suffix = path.suffix.lower()
            if suffix == ".pdf":
                resume_text, links, first_page_text = extract_pdf_with_timeout(str(path), timeout_seconds=pdf_timeout)
            else:
                resume_text = extract_text_from_docx(str(path))
                links = []
                first_page_text = ""
            
            resume_text = normalize_text(resume_text)
            extraction_text = resume_text + ("\n" + "\n".join(links) if links else "")
            
            # Build header text
            priority_source_text = normalize_text(first_page_text) if (suffix == ".pdf" and first_page_text) else resume_text
            header_text, header_extraction_text = _build_header_text(
                priority_source_text,
                links,
                max_lines=120,
                max_chars=4500,
                fraction=1.0 if (suffix == ".pdf" and first_page_text) else 0.30,
            )
            
            # Extract fields
            resume_sha256 = file_sha256(str(path))
            email = extract_email(header_extraction_text) or extract_email(extraction_text)
            
            body_name_top = extract_name(header_text, email=email)
            body_name_full = extract_name(resume_text, email=email)
            body_name = body_name_top if sum(bool(x) for x in body_name_top) >= sum(bool(x) for x in body_name_full) else body_name_full
            file_name_guess = infer_name_from_filename(file, email=email)
            email_guess = _name_from_email(email) if email else ("", "")
            first_name, last_name = _pick_best_name_pair(
                body_name=body_name,
                file_name_guess=file_name_guess,
                email_guess=email_guess,
                confirm_text=resume_text,
            )
            
            phone = extract_phone(resume_text)
            phone_display = format_phone_display(phone) if phone else None
            address = extract_address(header_text, first_name=first_name, last_name=last_name, phone=phone_display)
            if not address:
                address = extract_address(resume_text, first_name=first_name, last_name=last_name, phone=phone_display)
            
            qualification = None  # Will be extracted by triggers
            linkedin = extract_linkedin(extraction_text)
            tech_skills = extract_skills(resume_text)
            years_exp = extract_experience_years(resume_text)
            visa_support, work_auth = extract_visa(resume_text)
            certifications = extract_certifications(resume_text)
            job_title = extract_job_title(resume_text, first_name=first_name, last_name=last_name)
            
            # Insert into candidate_profile
            cursor = conn.cursor()
            cursor.execute(
                f"""
                INSERT INTO {CANDIDATES_TABLE} (
                    first_name, last_name, email, phone, address, qualification,
                    linkedin, visa_support, work_authorization, resume_filename,
                    resume_sha256, parsed_at, profile_picture_url
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, NOW(), NULL
                )
                ON CONFLICT (resume_sha256) DO UPDATE SET
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    email = EXCLUDED.email,
                    phone = EXCLUDED.phone,
                    address = EXCLUDED.address,
                    qualification = EXCLUDED.qualification,
                    linkedin = EXCLUDED.linkedin,
                    visa_support = EXCLUDED.visa_support,
                    work_authorization = EXCLUDED.work_authorization,
                    resume_filename = EXCLUDED.resume_filename,
                    parsed_at = NOW()
                RETURNING id
                """,
                (
                    first_name or None,
                    last_name or None,
                    email,
                    phone_display,
                    address or None,
                    qualification,
                    linkedin,
                    visa_support,
                    work_auth,
                    f"resumes/{file}",
                    resume_sha256,
                ),
            )
            
            candidate_id = cursor.fetchone()[0]
            
            # Insert into candidate_skills_profile
            cursor.execute(
                f"""
                INSERT INTO {SKILLS_TABLE} (
                    candidate_id, job_title, certifications, tech_skills,
                    professional_experience, parsed_at
                ) VALUES (
                    %s, %s, %s, %s, %s, NOW()
                )
                ON CONFLICT (candidate_id) DO UPDATE SET
                    job_title = EXCLUDED.job_title,
                    certifications = EXCLUDED.certifications,
                    tech_skills = EXCLUDED.tech_skills,
                    professional_experience = EXCLUDED.professional_experience,
                    parsed_at = NOW()
                """,
                (
                    candidate_id,
                    job_title or None,
                    certifications,
                    tech_skills,
                    str(years_exp) if years_exp is not None else None,
                ),
            )
            
            conn.commit()
            loaded_count += 1
            print(f"✅ Loaded: ID={candidate_id}, Name={first_name} {last_name}, Job={job_title}")
            
        except Exception as e:
            print(f"❌ Error: {e.__class__.__name__}: {e}")
            conn.rollback()
            continue

    conn.close()

    print("\n" + "=" * 70)
    print(f"✅ Successfully loaded {loaded_count}/{len(missing_files)} resumes")

    # Verify final count
    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
    )
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM candidate_profile")
    total = cursor.fetchone()[0]
    conn.close()

    print(f"📊 Total candidates in database: {total}")
    if total == 55:
        print("🎉 All 55 resumes successfully loaded!")
    else:
        print(f"⚠️  Expected 55, found {total}")
    print("=" * 70)

if __name__ == '__main__':
    load_missing_resumes()

