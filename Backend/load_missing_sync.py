"""
Load the 3 missing PDF resumes using synchronous parsing (no multiprocessing).
This avoids Windows multiprocessing spawn issues.
"""
import os
os.environ["PDF_TIMEOUT_SECONDS"] = "0"  # Disable multiprocessing

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import pdfplumber
from parser import (
    normalize_text,
    file_sha256,
    extract_links_from_pdf,
    _build_header_text,
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

def extract_text_from_pdf_sync(path: str) -> tuple[str, list[str], str]:
    """Extract PDF text synchronously (no multiprocessing)"""
    text_parts = []
    first_page_text = ""
    links = []
    
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages):
            extracted = page.extract_text() or ""
            if not extracted:
                for kwargs in (
                    {"x_tolerance": 1, "y_tolerance": 1},
                    {"layout": True},
                    {"layout": True, "x_tolerance": 1, "y_tolerance": 1},
                ):
                    try:
                        extracted = page.extract_text(**kwargs) or ""
                    except Exception:
                        extracted = ""
                    if extracted:
                        break
            
            if extracted:
                text_parts.append(extracted)
                if i == 0:
                    first_page_text = extracted
            elif i == 0:
                first_page_text = ""
        
        # Extract hyperlinks
        for page in pdf.pages:
            for link in getattr(page, "hyperlinks", []) or []:
                uri = link.get("uri")
                if uri:
                    links.append(str(uri))
    
    full_text = "\n".join(text_parts)
    
    # Dedupe links
    seen = set()
    unique_links = []
    for u in links:
        if u not in seen:
            seen.add(u)
            unique_links.append(u)
    
    return full_text, unique_links, first_page_text


def main():
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
    
    resumes_dir = Path("resumes")
    
    print("=" * 70)
    print(f"Loading {len(missing_files)} missing PDF resumes (synchronous mode)")
    for f in missing_files:
        print(f"  • {f}")
    print("=" * 70)
    
    loaded_count = 0
    
    for file in missing_files:
        path = resumes_dir / file
        if not path.exists():
            print(f"\n❌ File not found: {file}")
            continue
        
        print(f"\n📄 Processing: {file}")
        
        try:
            # Extract text synchronously (no multiprocessing)
            resume_text, links, first_page_text = extract_text_from_pdf_sync(str(path))
            
            resume_text = normalize_text(resume_text)
            extraction_text = resume_text + ("\n" + "\n".join(links) if links else "")
            
            # Build header text
            priority_source_text = normalize_text(first_page_text) if first_page_text else resume_text
            header_text, header_extraction_text = _build_header_text(
                priority_source_text,
                links,
                max_lines=120,
                max_chars=4500,
                fraction=1.0 if first_page_text else 0.30,
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
                    linkedin, visa_support, work_authorization_type, resume_filename,
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
                    work_authorization_type = EXCLUDED.work_authorization_type,
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
                    years_of_experience, parsed_at
                ) VALUES (
                    %s, %s, %s, %s, %s, NOW()
                )
                ON CONFLICT (candidate_id) DO UPDATE SET
                    job_title = EXCLUDED.job_title,
                    certifications = EXCLUDED.certifications,
                    tech_skills = EXCLUDED.tech_skills,
                    years_of_experience = EXCLUDED.years_of_experience,
                    parsed_at = NOW()
                """,
                (
                    candidate_id,
                    job_title or None,
                    certifications,
                    tech_skills,
                    years_exp,
                ),
            )
            
            conn.commit()
            loaded_count += 1
            print(f"   ✅ Loaded: ID={candidate_id}, Name={first_name} {last_name}, Job={job_title}")
            
        except Exception as e:
            print(f"   ❌ Error: {e.__class__.__name__}: {e}")
            import traceback
            traceback.print_exc()
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
        print("🎉 ALL 55 RESUMES SUCCESSFULLY LOADED!")
    else:
        print(f"⚠️  Expected 55, found {total}")
    print("=" * 70)

if __name__ == '__main__':
    main()
