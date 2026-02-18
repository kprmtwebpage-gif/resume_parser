import argparse
import csv
import os
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional

from data_normalization import canonicalize_job_title, extract_qualification as extract_qualification_norm

# Reuse the battle-tested heuristics from the DB loader for better accuracy.
from parser import (
    extract_address as db_extract_address,
    extract_email as db_extract_email,
    extract_job_title as db_extract_job_title,
    extract_linkedin as db_extract_linkedin,
    extract_name as db_extract_name,
    extract_phone as db_extract_phone,
    extract_standard_certifications as db_extract_standard_certifications,
    format_phone_display as db_format_phone_display,
    infer_name_from_filename as db_infer_name_from_filename,
)

try:  # Optional but strongly recommended
    import phonenumbers  # type: ignore
except Exception:  # pragma: no cover
    phonenumbers = None


try:
    import pdfplumber  # type: ignore
except Exception:  # pragma: no cover
    pdfplumber = None

try:
    from docx import Document  # type: ignore
except Exception:  # pragma: no cover
    Document = None


DEFAULT_COLUMNS = [
    "first name",
    "last name",
    "address",
    "phone number",
    "email id",
    "qualification(educational )",
    "visa support",
    "work_authorization",
    "linkedin",
    "resume full text",
    "time at resume pasted",
    "job title applied",
    "tech-skills",
    "cerification",
]


US_STATE_ABBRS = {
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
    "DC",
}


COMMON_SKILLS = {
    "python",
    "java",
    "javascript",
    "typescript",
    "react",
    "angular",
    "node",
    "node.js",
    "express",
    "django",
    "flask",
    "fastapi",
    "spring",
    "spring boot",
    "aws",
    "azure",
    "gcp",
    "sql",
    "postgres",
    "postgresql",
    "mysql",
    "mongodb",
    "redis",
    "docker",
    "kubernetes",
    "git",
    "jenkins",
    "terraform",
    "ci/cd",
    "html",
    "css",
    "rest",
    "rest api",
    "graphql",
}


CERT_KEYWORDS = [
    "aws certified",
    "azure fundamentals",
    "azure administrator",
    "gcp",
    "pmp",
    "scrum master",
    "csmi",
    "csm",
    "cka",
    "ckad",
    "ccna",
    "itil",
    "comptia",
    "security+",
    "network+",
    "solutions architect",
]


@dataclass
class Extracted:
    first_name: str = ""
    last_name: str = ""
    address: str = ""
    phone_number: str = ""
    email_id: str = ""
    qualification_educational: str = ""
    visa_support: str = ""
    work_authorization: str = ""
    linkedin: str = ""
    job_title_applied: str = ""
    tech_skills: str = ""
    certification: str = ""
    resume_full_text: str = ""
    parsed_at: str = ""
    source_file: str = ""


def to_output_row(r: Extracted) -> dict[str, str]:
    return {
        "first name": r.first_name,
        "last name": r.last_name,
        "address": r.address,
        "phone number": db_format_phone_display(r.phone_number) or r.phone_number,
        "email id": r.email_id,
        "qualification(educational )": r.qualification_educational,
        "visa support": r.visa_support,
        "work_authorization": r.work_authorization,
        "linkedin": r.linkedin,
        "resume full text": r.resume_full_text,
        "time at resume pasted": r.parsed_at,
        "job title applied": r.job_title_applied,
        "tech-skills": r.tech_skills,
        "cerification": r.certification,
    }


def _read_text_file(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def _read_pdf(path: Path) -> str:
    if pdfplumber is None:
        raise RuntimeError("pdfplumber is not installed. Install it or use DOCX/TXT resumes.")

    text_parts: list[str] = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            extracted = page.extract_text() or ""
            if extracted:
                text_parts.append(extracted)

    return "\n".join(text_parts)


def _read_docx(path: Path) -> str:
    if Document is None:
        raise RuntimeError("python-docx is not installed. Install it or use PDF/TXT resumes.")

    doc = Document(str(path))
    parts: list[str] = []
    for p in doc.paragraphs:
        if p.text and p.text.strip():
            parts.append(p.text)
    return "\n".join(parts)


def extract_resume_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return _read_pdf(path)
    if suffix == ".docx":
        return _read_docx(path)
    if suffix in {".txt", ".text"}:
        return _read_text_file(path)

    raise ValueError(f"Unsupported file type: {suffix} ({path.name})")


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[\t\f\v]+", " ", text)
    # Keep newlines (helps section heuristics), but trim excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def lines(text: str) -> list[str]:
    return [ln.strip() for ln in text.split("\n") if ln.strip()]


def extract_email(text: str) -> str:
    match = re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text, flags=re.I)
    return match.group(0) if match else ""


def extract_phone(text: str) -> str:
    if not text:
        return ""

    default_region = os.getenv("PHONE_DEFAULT_REGION", "US")

    if phonenumbers is not None:
        candidates: list[tuple[int, str]] = []
        try:
            for match in phonenumbers.PhoneNumberMatcher(text, default_region):
                num = match.number
                if not phonenumbers.is_possible_number(num):
                    continue
                if not phonenumbers.is_valid_number(num):
                    continue
                e164 = phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)
                digits = re.sub(r"\D+", "", e164)
                if not digits or not (10 <= len(digits) <= 15):
                    continue
                score = 0
                if e164.startswith("+1"):
                    score += 10
                score += max(0, 20 - match.start)
                candidates.append((score, digits))
        except Exception:
            candidates = []

        if candidates:
            candidates.sort(key=lambda x: x[0], reverse=True)
            return candidates[0][1]

    # Regex fallback (international-ish)
    m = re.search(r"\b\+?\d[\d ()\-]{8,}\d\b", text)
    if m:
        digits = re.sub(r"\D+", "", m.group(0))
        if 10 <= len(digits) <= 15:
            return digits
    m2 = re.search(r"\b\d{10,15}\b", text)
    return m2.group(0) if m2 else ""


def extract_linkedin(text: str) -> str:
    match = re.search(r"(https?://)?(www\.)?linkedin\.com/in/[A-Za-z0-9\-_%]+", text, flags=re.I)
    if not match:
        return ""
    url = match.group(0)
    if not url.lower().startswith("http"):
        url = "https://" + url
    return url


def _looks_like_name(candidate: str) -> bool:
    candidate = candidate.strip()
    if not candidate:
        return False
    if any(k in candidate.lower() for k in ["@", "linkedin", "github", "http", "www."]):
        return False
    if sum(ch.isdigit() for ch in candidate) >= 2:
        return False

    tokens = [t for t in re.split(r"\s+", candidate) if t]
    if not (2 <= len(tokens) <= 4):
        return False

    # Must be mostly alphabetic tokens
    alpha_tokens = 0
    for t in tokens:
        t2 = re.sub(r"[^A-Za-z'-]", "", t)
        if len(t2) >= 2 and re.fullmatch(r"[A-Za-z][A-Za-z'-]*", t2):
            alpha_tokens += 1
    if alpha_tokens < 2:
        return False

    return True


def extract_name(text: str) -> tuple[str, str]:
    top = lines(text)[:12]
    for ln in top:
        if _looks_like_name(ln):
            cleaned = re.sub(r"\s+", " ", ln).strip()
            parts = cleaned.split(" ")
            first = parts[0].strip(" ,")
            last = parts[-1].strip(" ,")
            return first.title(), last.title()
    return "", ""


def infer_name_from_filename(file_name: str) -> tuple[str, str]:
    base = Path(file_name).stem
    base = re.sub(r"(?i)\b(resume|cv|profile)\b", " ", base)
    base = re.sub(r"\b\d{4,}\b", " ", base)
    base = re.sub(r"[_\-]+", " ", base).strip()
    base = re.sub(r"([a-z])([A-Z])", r"\1 \2", base)
    base = re.sub(r"\b\+?\d[\d ()\-]{8,}\d\b", " ", base)
    base = re.sub(r"\s+", " ", base).strip()
    parts = [p for p in base.split() if re.fullmatch(r"[A-Za-z]{2,}", p)]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0].title(), ""
    return parts[0].title(), parts[-1].title()


def pick_best_name(*, body: tuple[str, str], file_guess: tuple[str, str]) -> tuple[str, str]:
    def score(pair: tuple[str, str]) -> int:
        fn, ln = (pair[0] or "").strip(), (pair[1] or "").strip()
        if not fn and not ln:
            return -10
        s = 0
        if fn:
            s += 20
        if ln:
            s += 30
        bad = {"professional", "summary", "profile", "objective", "resume", "developer", "engineer"}
        if fn.casefold() in bad:
            s -= 60
        if ln.casefold() in bad:
            s -= 60
        return s

    return max([body, file_guess], key=score)


def extract_address(text: str) -> str:
    top = lines(text)[:40]

    zip_state_re = re.compile(r"\b(" + "|".join(sorted(US_STATE_ABBRS)) + r")\b\s*\d{5}(?:-\d{4})?\b")

    street_keywords = [
        "street",
        "st",
        "road",
        "rd",
        "avenue",
        "ave",
        "blvd",
        "boulevard",
        "lane",
        "ln",
        "drive",
        "dr",
        "apt",
        "suite",
        "unit",
    ]

    best: Optional[str] = None

    # Avoid picking summary/job-title lines as addresses
    bad_address_words = {
        "experience",
        "years",
        "developer",
        "engineer",
        "full stack",
        "software",
        "summary",
        "objective",
        "professional",
    }

    city_state_re = re.compile(r"\b([A-Za-z][A-Za-z .'-]{1,}),\s*(" + "|".join(sorted(US_STATE_ABBRS)) + r")\b")
    city_state_country_re = re.compile(r"\b([A-Za-z][A-Za-z .'-]{1,}),\s*([A-Za-z .'-]{2,}|[A-Z]{2})\s*,\s*([A-Za-z .'-]{2,})\b")
    country_only_re = re.compile(r"(?i)\b(united states|united states of america|usa|u\.s\.?|u\.s\.a\.?|switzerland|india|pakistan|canada|united kingdom|uk|germany)\b")

    def norm_country(c: str) -> str:
        cc = (c or "").strip()
        key = cc.casefold().strip(".")
        if key in {"usa", "u.s.a", "u.s.a.", "us", "u.s", "u.s.", "united states", "united states of america"}:
            return "United States"
        if key in {"uk", "u.k", "u.k.", "united kingdom"}:
            return "United Kingdom"
        return cc.title() if cc.isalpha() else cc

    for i, ln in enumerate(top):
        lnl = ln.lower()

        # If contact line has separators, try to pull location-ish tail segments
        if "|" in ln:
            segments = [s.strip() for s in ln.split("|") if s.strip()]
            for seg in reversed(segments):
                m3 = city_state_country_re.search(seg)
                if m3:
                    return f"{m3.group(1).title()}, {m3.group(2).title()}, {norm_country(m3.group(3))}"
                m2 = city_state_re.search(seg)
                if m2:
                    return f"{m2.group(1).title()}, {m2.group(2).upper()}, United States"
                if zip_state_re.search(seg.upper()):
                    st = zip_state_re.search(seg.upper()).group(1)
                    return f"{st}, United States"
                mco = country_only_re.search(seg)
                if mco:
                    return norm_country(mco.group(1))

        if any(bad in lnl for bad in ["linkedin", "github", "email", "@", "http"]):
            continue

        if any(w in lnl for w in bad_address_words):
            continue

        looks_like_address = False
        if zip_state_re.search(ln.upper()):
            looks_like_address = True
        if any(re.search(rf"\b{re.escape(k)}\b", lnl) for k in street_keywords) and any(
            ch.isdigit() for ch in ln
        ):
            looks_like_address = True
        # City, State, Country / City, State patterns (usually no digits)
        if city_state_country_re.search(ln) or city_state_re.search(ln):
            looks_like_address = True
        if country_only_re.search(ln) and len(ln) <= 60:
            looks_like_address = True

        if looks_like_address:
            m3 = city_state_country_re.search(ln)
            if m3:
                best = f"{m3.group(1).title()}, {m3.group(2).title()}, {norm_country(m3.group(3))}"
                break
            m2 = city_state_re.search(ln)
            if m2:
                best = f"{m2.group(1).title()}, {m2.group(2).upper()}, United States"
                break
            mco = country_only_re.search(ln)
            if mco:
                best = norm_country(mco.group(1))
                break
            if zip_state_re.search(ln.upper()):
                st = zip_state_re.search(ln.upper()).group(1)
                best = f"{st}, United States"
                break

    return best or ""


def extract_qualification(text: str) -> str:
    # Reuse shared logic (keeps DB + CSV behavior consistent)
    return extract_qualification_norm(text) or ""


def extract_work_auth_and_visa_support(text: str) -> tuple[str, str]:
    t = text.lower()

    # Work auth classification
    work_auth = ""
    if any(k in t for k in ["us citizen", "u.s. citizen", "citizen of the united states"]):
        work_auth = "US Citizen"
    elif any(k in t for k in ["green card", "permanent resident", "lawful permanent resident"]):
        work_auth = "Green Card"
    elif "h1b" in t or "h-1b" in t:
        work_auth = "H1B"
    elif "opt" in t and "adopt" not in t:
        work_auth = "OPT"
    elif "cpt" in t:
        work_auth = "CPT"
    elif "h4" in t or "h-4" in t:
        work_auth = "H4"
    elif "l2" in t or "l-2" in t:
        work_auth = "L2"
    elif "tn" in t or "tn visa" in t:
        work_auth = "TN"

    # Visa support (sponsorship) signal
    visa_support = ""
    if any(k in t for k in ["no sponsorship required", "no sponsorship", "do not require sponsorship"]):
        visa_support = "No"
    elif any(k in t for k in ["sponsorship required", "need sponsorship", "require sponsorship"]):
        visa_support = "Yes"
    else:
        # Infer from work auth if we can
        if work_auth in {"US Citizen", "Green Card"}:
            visa_support = "No"
        elif work_auth in {"OPT", "CPT", "H1B", "H4", "L2", "TN"}:
            visa_support = "Yes"

    return visa_support, work_auth


def extract_job_title_applied(file_name: str, text: str) -> str:
    # Try explicit statements
    patterns = [
        r"(?i)\b(position|role|job title)\s*[:\-]\s*(.{3,80})",
        r"(?i)\b(applied for|applying for|application for|seeking)\b\s*[:\-]?\s*(.{3,80})",
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            title = m.group(m.lastindex or 1).strip()
            title = re.sub(r"\s+", " ", title)
            # Stop at first obvious delimiter
            title = re.split(r"[\n\r\t|•]", title)[0].strip(" -:")
            # Strip embedded phone numbers
            title = re.sub(r"\b\+?\d[\d ()\-]{8,}\d\b", " ", title)
            title = re.sub(r"\s+", " ", title).strip(" -:")
            if 3 <= len(title) <= 80:
                return canonicalize_job_title(title)

    # Fallback: pick a short role-like line from the top of the resume
    role_words = [
        "developer",
        "engineer",
        "analyst",
        "architect",
        "consultant",
        "tester",
        "qa",
        "data scientist",
        "data engineer",
        "full stack",
        "frontend",
        "front end",
        "backend",
        "back end",
    ]
    for ln in lines(text)[:18]:
        lnl = ln.lower()
        if any(w in lnl for w in role_words) and 4 <= len(ln) <= 80:
            if any(x in lnl for x in ["years", "experience", "summary", "objective", "certification", "education", "skills"]):
                continue
            cleaned = re.sub(r"\b\+?\d[\d ()\-]{8,}\d\b", " ", ln)
            cleaned = re.sub(r"\s+", " ", cleaned).strip(" -:")
            # Prefer role before a comma (e.g. "Java Full Stack Developer, Full Stack Engineer")
            if "," in cleaned:
                cleaned = cleaned.split(",", 1)[0].strip()
            if 3 <= len(cleaned) <= 80:
                return canonicalize_job_title(cleaned)

    # Fallback: infer from filename if it contains role words
    base = Path(file_name).stem
    base = re.sub(r"(?i)resume", "", base)
    base = re.sub(r"[_\-]+", " ", base).strip()
    # If base looks like only a name, skip
    if len(base.split()) <= 3 and base.replace(" ", "").isalpha():
        return ""

    return ""


def load_skills_master(skills_path: Path) -> list[str]:
    if not skills_path.exists():
        return []
    raw = skills_path.read_text(encoding="utf-8", errors="ignore")
    skills = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    return skills


def _extract_section_lines(all_lines: list[str], heading_words: Iterable[str]) -> list[str]:
    headings = {h.lower() for h in heading_words}

    start = None
    for i, ln in enumerate(all_lines):
        key = re.sub(r"[^a-zA-Z ]", "", ln).strip().lower()
        if key in headings or any(key.startswith(h + " ") for h in headings):
            start = i + 1
            break

    if start is None:
        return []

    out: list[str] = []
    blanks = 0
    for ln in all_lines[start:]:
        if not ln.strip():
            blanks += 1
            if blanks >= 2:
                break
            continue

        blanks = 0
        # Stop if looks like another heading
        if ln.isupper() and len(ln) <= 40:
            break
        if re.fullmatch(r"[A-Za-z ]{3,40}:", ln.strip()):
            break

        out.append(ln.strip())
        if len(out) >= 12:
            break

    return out


def extract_skills(text: str, skills_master: list[str]) -> str:
    lower = text.lower()

    # Store skills case-insensitively while preserving nicer display
    found_map: dict[str, str] = {}

    # Prefer skills_master.txt if provided
    if skills_master:
        for skill in skills_master:
            s = skill.strip()
            if not s:
                continue
            # word-boundary-ish match to reduce false positives
            if re.search(rf"\b{re.escape(s.lower())}\b", lower):
                key = s.lower()
                found_map.setdefault(key, s)

    # Section-based fallback
    lns = text.split("\n")
    section_lines = _extract_section_lines([ln.strip() for ln in lns], ["skills", "technical skills", "technical"])
    for ln in section_lines:
        # Drop category prefixes like "Frontend:" / "Tools:" / "Cloud & DevOps:" etc.
        if ":" in ln and len(ln.split(":", 1)[0]) <= 28:
            prefix = ln.split(":", 1)[0].strip().lower()
            if any(k in prefix for k in ["frontend", "backend", "cloud", "devops", "tools", "databases", "programming", "testing", "machine learning", "apis"]):
                ln = ln.split(":", 1)[1].strip()

        # Split by common delimiters
        parts = re.split(r"[|,/;•·\u2022]", ln)
        for p in parts:
            p = p.strip().lstrip("•·-–—\uf0b7\u2022\u25cf\u25a0\u25aa\u25ab\u25e6\u2023\u2043\u2219\u00b7\u25cb\u25c6\u25c7\u25c8\u25c9\u25ca\u25cc\uf0a7\uf0d8\uf0fc\uf0a8\uf076\uf0b7\uf0b7\uf0b7\uf0b7\uf0b7\uf0b7\uf0b7\uf0b7\uf0b7")
            if not p:
                continue
            if 2 <= len(p) <= 40:
                key = p.lower()
                found_map.setdefault(key, p)

    # Common skills supplement
    for s in COMMON_SKILLS:
        if re.search(rf"\b{re.escape(s)}\b", lower):
            found_map.setdefault(s.lower(), s)

    cleaned = [re.sub(r"\s+", " ", v).strip() for v in found_map.values() if v.strip()]
    cleaned = sorted(set(cleaned), key=lambda x: x.lower())
    return ", ".join(cleaned)


def extract_certifications(text: str, *, job_title: str = "", skills: str | None = None) -> str:
    # Prefer the shared high-precision extractor used by the DB pipeline.
    # This greatly improves AWS/Azure detection and avoids noisy workshop-style "certificates".
    try:
        from parser import extract_standard_certifications  # type: ignore

        s = extract_standard_certifications(text, job_title=job_title or "", skills=skills)
        if s:
            return s
    except Exception:
        pass

    lns = [ln.strip() for ln in text.split("\n") if ln.strip()]
    section = _extract_section_lines(lns, ["certifications", "certification", "certificates"])

    found: list[str] = []

    for ln in section:
        if len(ln) <= 140:
            found.append(ln)

    # Keyword scan fallback
    lower = text.lower()
    for kw in CERT_KEYWORDS:
        if kw in lower and kw not in " ".join(found).lower():
            found.append(kw)

    # Generic scan
    if not found:
        for ln in lns:
            lnl = ln.lower()
            if any(k in lnl for k in ["certified", "certification", "certificate"]):
                if len(ln) <= 160:
                    found.append(ln)

    # Dedup
    out: list[str] = []
    seen: set[str] = set()
    for item in found:
        key = item.lower()
        if key not in seen:
            seen.add(key)
            out.append(item)

    return "; ".join(out[:8])


def parse_resume(path: Path, skills_master: list[str]) -> Extracted:
    raw_text = normalize_text(extract_resume_text(path))

    email = db_extract_email(raw_text) or ""
    phone_digits = db_extract_phone(raw_text) or ""
    phone = db_format_phone_display(phone_digits) or phone_digits
    linkedin = db_extract_linkedin(raw_text) or ""

    first_name, last_name = db_extract_name(raw_text, email=email or None)
    fn_file, ln_file = db_infer_name_from_filename(path.name)
    if not first_name or (first_name.casefold() in {"about", "professional", "summary", "profile", "objective", "resume"}):
        first_name = fn_file or first_name
    if not last_name or (last_name.casefold() in {"me", "developer", "engineer", "summary", "profile"}):
        last_name = ln_file or last_name

    address = db_extract_address(raw_text)
    qualification = extract_qualification(raw_text)
    visa_support, work_auth = extract_work_auth_and_visa_support(raw_text)
    job_title = db_extract_job_title(raw_text, first_name=first_name, last_name=last_name) or ""
    skills = extract_skills(raw_text, skills_master)
    certs = db_extract_standard_certifications(raw_text, job_title=job_title, skills=skills)

    return Extracted(
        first_name=first_name,
        last_name=last_name,
        address=address,
        phone_number=phone,
        email_id=email,
        qualification_educational=qualification,
        visa_support=visa_support,
        work_authorization=work_auth,
        linkedin=linkedin,
        job_title_applied=job_title,
        tech_skills=skills,
        certification=certs,
        resume_full_text=raw_text,
        parsed_at=datetime.now().isoformat(timespec="seconds"),
        source_file=path.name,
    )


def write_csv(rows: list[Extracted], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=DEFAULT_COLUMNS)
        writer.writeheader()
        for r in rows:
            writer.writerow(to_output_row(r))


def write_excel(rows: list[Extracted], out_path: Path) -> None:
    # Optional dependency (pandas + openpyxl)
    import pandas as pd  # type: ignore

    out_path.parent.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame([to_output_row(r) for r in rows])
    df.to_excel(out_path, index=False)


def main() -> int:
    parser = argparse.ArgumentParser(description="Parse resumes and export to CSV/Excel with requested columns")
    parser.add_argument("--input-dir", default="resumes", help="Folder containing resume files")
    parser.add_argument("--skills", default="skills_master.txt", help="Path to skills_master.txt")
    parser.add_argument("--out-csv", default="parsed_resumes.csv", help="Output CSV path")
    parser.add_argument("--out-xlsx", default="parsed_resumes.xlsx", help="Output Excel (xlsx) path")
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    if not input_dir.exists():
        raise SystemExit(f"Input folder not found: {input_dir}")

    skills_master = load_skills_master(Path(args.skills))

    supported = {".pdf", ".docx", ".txt", ".text"}
    files = [p for p in sorted(input_dir.iterdir()) if p.is_file() and p.suffix.lower() in supported]

    rows: list[Extracted] = []
    for p in files:
        try:
            rows.append(parse_resume(p, skills_master))
            print(f"✅ Parsed: {p.name}")
        except Exception as e:
            print(f"❌ Failed: {p.name}: {e.__class__.__name__}: {e}")

    if not rows:
        print("No resumes parsed.")
        return 2

    write_csv(rows, Path(args.out_csv))
    print(f"🟦 Wrote CSV: {args.out_csv}")

    try:
        write_excel(rows, Path(args.out_xlsx))
        print(f"🟩 Wrote Excel: {args.out_xlsx}")
    except Exception as e:
        print(f"⚠️  Could not write Excel: {e.__class__.__name__}: {e}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
