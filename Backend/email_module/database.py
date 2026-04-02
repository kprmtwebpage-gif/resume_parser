"""
SQLAlchemy engine + session factory for the email module.
Re-uses the same DB credentials as the rest of the application.
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = (
    f"postgresql://{os.getenv('DB_USER', 'postgres')}"
    f":{os.getenv('DB_PASSWORD', 'admin')}"
    f"@{os.getenv('DB_HOST', 'localhost')}"
    f":{os.getenv('DB_PORT', '5432')}"
    f"/{os.getenv('DB_NAME', 'postgres')}"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=3, max_overflow=5)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_db():
    """Initialize database tables for email module."""
    from . import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _seed_default_templates()


def _seed_default_templates():
    """Create or update the four default email templates."""
    from .models import EmailTemplate

    _DEFAULTS = [
        ("TYPE A — Candidate Submission",
         "Candidate Submission: {{candidate_name}}",
         _TYPE_A_BODY),
        ("TYPE B — Candidate Submission Details",
         "Candidate Submission Details: {{candidate_name}}",
         _TYPE_B_BODY),
        ("TYPE C — Personal & Submittal Details",
         "Candidate Details: {{candidate_name}}",
         _TYPE_C_BODY),
        ("TYPE D — Skills & Submission Details",
         "Candidate Submission: {{candidate_name}}",
         _TYPE_D_BODY),
    ]

    db = SessionLocal()
    try:
        for name, subject, body in _DEFAULTS:
            existing = db.query(EmailTemplate).filter_by(name=name).first()
            if existing is None:
                db.add(EmailTemplate(
                    name=name, subject=subject, body=body, created_by="System",
                ))
            elif "<table" not in (existing.body or ""):
                existing.body = body
        db.commit()
        print("[OK] Seeded / verified default email templates")
    except Exception as e:
        db.rollback()
        print(f"[WARN] Failed to seed templates: {e}")
    finally:
        db.close()


_TYPE_A_BODY = """\
<p>Hi,</p>
<p>Please find the candidate details below:</p>

<table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">
  <tr>
    <td style="border: 1px solid #000; padding: 8px; background-color: #e6e6e6; width: 40%;"><strong>Candidate Full Name:</strong></td>
    <td style="border: 1px solid #000; padding: 8px; background-color: #e6e6e6;">{{candidate_name}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Best Contact # and Alternate #:</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{phone}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>E-mail ID:</strong></td>
    <td style="border: 1px solid #000; padding: 8px;"><a href="mailto:{{email}}" style="color: blue;">{{email}}</a></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Work Authorization: If H1b/EAD valid till month/year</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{work_auth}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Current Location:</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{location}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Experience in Years:</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{experience}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>LinkedIn Profile:</strong></td>
    <td style="border: 1px solid #000; padding: 8px;"><a href="{{linkedin}}" target="_blank" style="color: blue;">{{linkedin}}</a></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Vendor (your company name):</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">KPRMT</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Rate:</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{rate}}</td>
  </tr>
</table>

<br>
<p>Thanks &amp; Regards,<br>Your Name</p>
"""

# ── TYPE B: Detailed Candidate Submission Details ─────────────
_TYPE_B_BODY = """\
<table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">
  <tr>
    <td colspan="2" style="border: 1px solid #000; padding: 10px; background-color: #4a90d9; color: #fff; text-align: center; font-size: 15px;"><strong>Candidate Submission Details</strong></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px; width: 40%;"><strong>Full Name(As per SSN):</strong></td>
    <td style="border: 1px solid #000; padding: 8px;"><em>{{candidate_name}}</em></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Present location (city and state):</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{location}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Phone#</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{phone}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Email ID</strong></td>
    <td style="border: 1px solid #000; padding: 8px;"><a href="mailto:{{email}}" style="color: blue;">{{email}}</a></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Willingness to relocate:</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{willingness_to_relocate}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Work Authorization and Validity</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{work_auth}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Any visa extensions in progress (if applicable)</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{visa_validity}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Total Experience</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{experience}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Onsite (US) Experience</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{us_experience}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Passport No:</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{passport}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>LinkedIn-ID:</strong></td>
    <td style="border: 1px solid #000; padding: 8px;"><a href="{{linkedin}}" target="_blank" style="color: blue;">{{linkedin}}</a></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Rate:</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{rate}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Full Education Detail:(Degree with Specialization and college/university and year)</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{education}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Any Interviews Pending/Offers in hand:</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">No</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Availability for interview (Preferred Time):</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{availability}}</td>
  </tr>
</table>
<br>
<p>Thanks &amp; Regards,<br>Your Name</p>
"""

# ── TYPE C: Personal + Educational + Submittal Details ────────
_TYPE_C_BODY = """\
<table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">
  <tr>
    <td colspan="2" style="border: 1px solid #000; padding: 8px; background-color: #f0f0f0;"><strong>Personal Details:</strong></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px; width: 45%;"><strong>Full name of Candidate</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{candidate_name}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Current location (City, State and Zip code)</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{location}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Phone</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{phone}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Email</strong></td>
    <td style="border: 1px solid #000; padding: 8px;"><a href="mailto:{{email}}" style="color: blue;">{{email}}</a></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>DOB</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{dob}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>LinkedIn URL</strong></td>
    <td style="border: 1px solid #000; padding: 8px;"><a href="{{linkedin}}" target="_blank" style="color: blue;">{{linkedin}}</a></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Is the candidate aware of Video interview and ready to take video interview on Webex / Zoom?</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">yes</td>
  </tr>
  <tr>
    <td colspan="2" style="border: 1px solid #000; padding: 8px; background-color: #f0f0f0;"><strong>Educational Details:</strong></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Bachelor's degree in</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{education}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>University</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{university}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Year of completion</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{year_of_completion}}</td>
  </tr>
  <tr>
    <td colspan="2" style="border: 1px solid #000; padding: 8px; background-color: #f0f0f0;"><strong>Submittal Details:</strong></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Submittal type (C2C or FTE)</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{submittal_type}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Is the candidate authorized to work legally in the United States?</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">yes</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Does the candidate require any sponsorship (now or in future) to legally work in the United States?</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">no</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Work authorization type</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{work_auth}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Rate (per hour on C2C) OR Salary</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{rate}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Available to join (including relocation time):</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{availability}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Passport #:</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{passport}}</td>
  </tr>
</table>
<br>
<p>Thanks &amp; Regards,<br>Your Name</p>
"""

# ── TYPE D: Skills + Candidate Submission Details ─────────────
_TYPE_D_BODY = """\
<table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">
  <tr>
    <td style="border: 1px solid #000; padding: 8px; background-color: #4a90d9; color: #fff; font-weight: bold;">Skills</td>
    <td style="border: 1px solid #000; padding: 8px; background-color: #4a90d9; color: #fff; font-weight: bold;">Year of Experience</td>
    <td style="border: 1px solid #000; padding: 8px; background-color: #4a90d9; color: #fff; font-weight: bold;">Last Used</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;">{{skills}}</td>
    <td style="border: 1px solid #000; padding: 8px;">{{experience}}</td>
    <td style="border: 1px solid #000; padding: 8px;"></td>
  </tr>
</table>

<br>

<table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">
  <tr>
    <td colspan="2" style="border: 1px solid #000; padding: 10px; background-color: #4a90d9; color: #fff; text-align: center; font-size: 15px;"><strong>Candidate Submission Details</strong></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px; width: 40%;"><strong>Full Name(As per SSN):</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{candidate_name}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Present location (city and state):</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{location}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Phone#</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{phone}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Email ID</strong></td>
    <td style="border: 1px solid #000; padding: 8px;"><a href="mailto:{{email}}" style="color: blue;">{{email}}</a></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Willingness to relocate:</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{willingness_to_relocate}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Work Authorization and Validity</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{work_auth}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Any visa extensions in progress (if applicable)</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{visa_validity}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Total Experience</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{experience}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Onsite (US) Experience</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{us_experience}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Passport No:</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{passport}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>LinkedIn-ID:</strong></td>
    <td style="border: 1px solid #000; padding: 8px;"><a href="{{linkedin}}" target="_blank" style="color: blue;">{{linkedin}}</a></td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Rate:</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{rate}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Full Education Detail:(Degree with Specialization and college/university and year)</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{education}}</td>
  </tr>
  <tr>
    <td style="border: 1px solid #000; padding: 8px;"><strong>Availability for Interview (Preferred Time)</strong></td>
    <td style="border: 1px solid #000; padding: 8px;">{{availability}}</td>
  </tr>
</table>
<br>
<p>Thanks &amp; Regards,<br>Your Name</p>
"""


def get_db():
    """FastAPI dependency - yields a DB session, auto-closes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
