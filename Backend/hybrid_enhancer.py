"""
hybrid_enhancer.py
==================
Per-field quality validation + targeted LLM enhancement for resume parsing.

Architecture:
    1. Receives all regex-extracted fields
    2. Runs per-field quality checks (detects garbage names, bad locations, etc.)
    3. Identifies which specific fields need LLM help
    4. Makes a SINGLE targeted LLM call for only the weak fields
    5. Merges LLM results with regex results (best-of-both)

Token efficiency:
    - Only sends first ~1500 chars to LLM (contact info is always at top)
    - Only asks for fields that actually need help
    - Most resumes need 0 LLM calls (regex passes validation)
    - ~15-25% might need 1 targeted call for 1-3 weak fields

Usage:
    from hybrid_enhancer import enhance_extraction
    
    result = enhance_extraction(
        resume_text=resume_text,
        first_name=first_name, last_name=last_name,
        email=email, phone=phone, job_title=job_title,
        address=address, linkedin=linkedin,
        source_file=file
    )
    # result contains corrected fields + metadata
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Name Quality Validation
# ─────────────────────────────────────────────────────────────────────────────

# Words that should NEVER be a first name (common parser errors)
_BAD_FIRST_NAMES = {
    "about", "url", "http", "https", "www", "none", "null", "n/a",
    "resume", "curriculum", "vitae", "cv", "summary", "profile",
    "objective", "experience", "education", "skills", "contact",
    "professional", "personal", "details", "information", "career",
    "page", "phone", "email", "address", "linkedin", "github",
    "portfolio", "references", "certifications", "achievements",
    "work", "history", "employment", "technical", "project",
    "projects", "technologies", "tools", "languages", "database",
    "framework", "software", "application", "developer", "engineer",
    "analyst", "manager", "consultant", "architect", "designer",
    "senior", "junior", "lead", "principal", "staff",
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
    # ── Phase-14: marketing / business section-heading tokens ──
    "promotional", "channels", "marketing", "campaign", "campaigns",
    "brand", "branding", "digital", "media", "social", "advertising",
    "analytics", "insights", "metrics", "roi", "revenue", "sales",
    "growth", "acquisition", "retention", "funnel", "conversion",
    "engagement", "content", "seo", "sem", "ppc", "crm", "erp",
    "overview", "highlights", "introduction", "vision", "mission",
    "scope", "approach", "methodology", "deliverable", "deliverables",
    "outcome", "outcomes", "impact", "contribution", "contributions",
    "accomplishment", "accomplishments", "recommendation", "background",
}

# Characters that indicate garbled text (OCR artifacts)
_GARBLED_PATTERN = re.compile(
    r'[^\w\s\'\-\.]'  # non-word non-space non-apostrophe non-hyphen non-dot
    r'|'
    r'\d{2,}'          # 2+ consecutive digits in a name
    r'|'
    r'(.)\1{3,}',      # 4+ repeated chars ("aaaa")
    re.UNICODE
)

# Patterns that indicate a name is actually a tech term or garbled text
_TECH_NAME_PATTERN = re.compile(
    r'^(?:ios|api|sql|aws|gcp|css|html|xml|json|sdk|llm|etl|crm|'
    r'sap|sas|php|asp|mvc|orm|ci|cd|qa|ux|ui|http|ftp|ssh|tcp|udp)$',
    re.IGNORECASE
)


# Values the LLM may return that are actually empty/unknown
_NULL_LIKE = {
    "null", "none", "n/a", "na", "unknown", "not found",
    "not available", "not specified", "not provided", "not listed",
    "nil", "undefined", "—", "-", "--", "",
}


def _is_null_like(value: str | None) -> bool:
    """Return True if value is None or a null-like placeholder."""
    if not value:
        return True
    return value.strip().lower().rstrip(".") in _NULL_LIKE


def _is_garbled_name(name: str, allow_single_char: bool = False) -> bool:
    """Check if a name looks like garbled/corrupted text.
    
    Args:
        allow_single_char: If True, single characters are OK (for last name initials).
    """
    if not name:
        return True
    # Single character initials (V, K, M) are valid for South Asian names
    if len(name) == 1 and name.isalpha():
        return not allow_single_char
    # Too short (but not single initial)
    if len(name) < 2:
        return True
    # Only consonants (no vowels) and > 3 chars → likely garbled
    vowels = set("aeiouAEIOU")
    if len(name) > 3 and not any(c in vowels for c in name):
        return True
    # Has digits mixed in
    if re.search(r'\d', name):
        return True
    # Mostly non-alpha
    alpha_ratio = sum(1 for c in name if c.isalpha()) / max(len(name), 1)
    if alpha_ratio < 0.7:
        return True
    return False


def _validate_name_quality(first_name: str | None, last_name: str | None,
                          email: str | None) -> dict:
    """
    Validate name quality. Returns dict with:
        - is_valid: bool
        - issues: list of issue descriptions
        - suggested_fix: 'llm' | 'email' | None
    """
    issues = []
    fn = (first_name or "").strip()
    ln = (last_name or "").strip()
    
    # Check for completely missing name
    if not fn and not ln:
        issues.append("both_names_missing")
        return {"is_valid": False, "issues": issues, "suggested_fix": "llm"}
    
    # Check for bad first names
    if fn.lower() in _BAD_FIRST_NAMES:
        issues.append(f"bad_first_name:{fn}")
    
    # Check for tech terms as names
    if _TECH_NAME_PATTERN.match(fn):
        issues.append(f"tech_term_first_name:{fn}")
    if ln and _TECH_NAME_PATTERN.match(ln):
        issues.append(f"tech_term_last_name:{ln}")
    
    # Check for garbled text
    if _is_garbled_name(fn):
        issues.append(f"garbled_first_name:{fn}")
    if ln and _is_garbled_name(ln, allow_single_char=True):
        issues.append(f"garbled_last_name:{ln}")
    
    # Check for "None" as last name
    if ln.lower() in ("none", "null", "n/a", ""):
        issues.append("missing_last_name")
    
    # Check for duplicate first/last
    if fn and ln and fn.lower() == ln.lower():
        issues.append(f"duplicate_name:{fn}")
    
    # Check for name that's too long (likely a sentence)
    if len(fn) > 25 or (ln and len(ln) > 25):
        issues.append("name_too_long")
    
    # Check for ALL-CAPS (might need casing fix only)
    if fn and fn == fn.upper() and len(fn) > 1:
        issues.append("all_caps_first")
    if ln and ln == ln.upper() and len(ln) > 1:
        issues.append("all_caps_last")
    
    if issues:
        # Try email-based fix first for missing last names
        email_fix = _try_name_from_email(email) if email else None
        has_serious = any(i.startswith(("bad_first", "tech_term", "garbled",
                                         "both_names", "missing_last")) for i in issues)
        suggested = "llm" if has_serious else ("email" if email_fix else None)
        return {"is_valid": False, "issues": issues, "suggested_fix": suggested,
                "email_name": email_fix}
    
    return {"is_valid": True, "issues": [], "suggested_fix": None}


def _try_name_from_email(email: str) -> tuple[str, str] | None:
    """Try to extract a name from email address (e.g., john.doe@gmail.com)."""
    if not email or "@" not in email:
        return None
    local = email.split("@")[0]
    # Remove digits and common suffixes
    local = re.sub(r'\d+$', '', local)
    local = re.sub(r'[_\-]', '.', local)
    
    parts = [p for p in local.split('.') if len(p) >= 2 and p.isalpha()]
    if len(parts) >= 2:
        return (parts[0].title(), parts[-1].title())
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Location Quality Validation
# ─────────────────────────────────────────────────────────────────────────────

# Words that should NOT appear in a location string
_LOCATION_GARBAGE_PATTERNS = [
    r'\byears?\s+(?:of\s+)?experience\b',
    r'\bactivity\s+diagrams?\b',
    r'\busing\s+',
    r'\blost\s+works?\b',
    r'\bresponsib(?:le|ility|ilities)\b',
    r'\bdevelop(?:ed|ing|ment)?\b',
    r'\bimplemented?\b',
    r'\bmanag(?:ed|ing|ement)?\b',
    r'\bproject\s+',
    r'\bdesign(?:ed|ing)?\b',
    r'\bassist(?:ed|ing)?\b',
    r'\bexperience\s+in\b',
    r'\bworked?\s+(?:as|with|on|in)\b',
    r'\bsupport(?:ed|ing)?\b',
    r'\bcompon(?:ent|ents)\b',
    r'\bservice[s]?\b',
    r'\bdiagram[s]?\b',
]
_LOCATION_GARBAGE_RE = re.compile(
    '|'.join(_LOCATION_GARBAGE_PATTERNS), re.IGNORECASE
)

# Valid US states for cross-validation
_US_STATES = {
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
    "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
    "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana",
    "maine", "maryland", "massachusetts", "michigan", "minnesota",
    "mississippi", "missouri", "montana", "nebraska", "nevada",
    "new hampshire", "new jersey", "new mexico", "new york",
    "north carolina", "north dakota", "ohio", "oklahoma", "oregon",
    "pennsylvania", "rhode island", "south carolina", "south dakota",
    "tennessee", "texas", "utah", "vermont", "virginia", "washington",
    "west virginia", "wisconsin", "wyoming", "district of columbia",
}

_COUNTRIES = {
    "united states", "canada", "india", "united kingdom", "uk",
    "australia", "germany", "france", "singapore", "japan",
    "china", "brazil", "mexico", "south korea", "netherlands",
    "sweden", "switzerland", "ireland", "israel", "uae",
}


def _validate_location_quality(address: str | None, 
                               first_name: str | None = None,
                               last_name: str | None = None) -> dict:
    """
    Validate location quality. Returns dict with:
        - is_valid: bool
        - issues: list
        - cleaned: str | None (cleaned version if salvageable)
        - suggested_fix: 'llm' | 'clean' | None
    """
    issues = []
    
    if not address or not address.strip():
        issues.append("location_missing")
        return {"is_valid": False, "issues": issues, "cleaned": None, "suggested_fix": "llm"}
    
    addr = address.strip()
    
    # Check for name mixed into location
    if first_name and last_name:
        full_name = f"{first_name} {last_name}".strip()
        if full_name and full_name.lower() in addr.lower():
            cleaned = addr.replace(full_name, "").replace(first_name, "").replace(last_name, "").strip()
            cleaned = re.sub(r'^[\s,]+|[\s,]+$', '', cleaned)
            if cleaned:
                issues.append(f"name_in_location:{full_name}")
                return {"is_valid": False, "issues": issues, "cleaned": cleaned, 
                        "suggested_fix": "clean"}
    
    # Check for garbage text in location
    if _LOCATION_GARBAGE_RE.search(addr):
        issues.append("garbage_text_in_location")
        # Try to salvage city/state from the string
        cleaned = _try_salvage_location(addr)
        if cleaned:
            return {"is_valid": False, "issues": issues, "cleaned": cleaned,
                    "suggested_fix": "clean"}
        return {"is_valid": False, "issues": issues, "cleaned": None, 
                "suggested_fix": "llm"}
    
    # Check for too-generic location (just "United States" or a country)
    addr_lower = addr.lower().strip()
    parts = [p.strip() for p in addr.split(",")]
    if len(parts) == 1 and addr_lower in _COUNTRIES:
        issues.append("too_generic_country_only")
        return {"is_valid": False, "issues": issues, "cleaned": addr,
                "suggested_fix": "llm"}
    
    # Check for single state without city
    if len(parts) <= 2 and parts[0].lower().strip() in _US_STATES:
        issues.append("state_without_city")
        return {"is_valid": False, "issues": issues, "cleaned": addr,
                "suggested_fix": "llm"}
    
    return {"is_valid": True, "issues": [], "cleaned": addr, "suggested_fix": None}


def _try_salvage_location(addr: str) -> str | None:
    """Try to extract a valid City, State from a garbage-contaminated address."""
    # Strategy 0: Strip known garbage prefixes first, then look for clean location
    stripped = _LOCATION_GARBAGE_RE.sub('', addr).strip()
    stripped = re.sub(r'^[\s,]+|[\s,]+$', '', stripped)  # clean leading/trailing commas
    if stripped and stripped != addr:
        # Try to find City, State, Country in the stripped version
        m = re.match(
            r'^([A-Z][a-zA-Z .\'-]+),\s*([A-Z][a-zA-Z ]+),\s*(United States|Canada|India|UK)$',
            stripped, re.IGNORECASE
        )
        if m:
            city = m.group(1).strip()
            state = m.group(2).strip()
            country = m.group(3).strip()
            if len(city) >= 2 and not _LOCATION_GARBAGE_RE.search(city):
                return f"{city}, {state}, {country}"
    
    # Strategy 1: Find "City, State, Country" pattern (greedy match on city)
    city_state_country = re.search(
        r'([A-Z][a-zA-Z .\'-]{1,30}),\s*([A-Z][a-zA-Z ]{2,25}),\s*(United States|Canada|India|UK)',
        addr, re.IGNORECASE
    )
    if city_state_country:
        city = city_state_country.group(1).strip()
        state = city_state_country.group(2).strip()
        country = city_state_country.group(3).strip()
        if not _LOCATION_GARBAGE_RE.search(city) and len(city) >= 2:
            return f"{city}, {state}, {country}"
    
    # Strategy 2: Find "City, State" where State is a known US state
    for state in _US_STATES:
        # Match city before the state name
        pattern = re.compile(
            r'([A-Z][a-zA-Z .]{1,30}),\s*' + re.escape(state) + r'\b',
            re.IGNORECASE
        )
        m = pattern.search(addr)
        if m:
            city = m.group(1).strip()
            if not _LOCATION_GARBAGE_RE.search(city) and len(city) >= 2:
                return f"{city}, {state.title()}, United States"
    
    # Strategy 3: Just find the state name
    for state in _US_STATES:
        if state.lower() in addr.lower():
            return f"{state.title()}, United States"
    
    return None


# ─────────────────────────────────────────────────────────────────────────────
# LinkedIn Quality Validation
# ─────────────────────────────────────────────────────────────────────────────

def _validate_linkedin_quality(linkedin: str | None,
                              first_name: str | None = None,
                              last_name: str | None = None) -> dict:
    """
    Validate LinkedIn URL quality. Cross-validates slug against candidate name.
    """
    issues = []
    
    if not linkedin:
        # Not necessarily an error — many resumes don't have LinkedIn
        return {"is_valid": True, "issues": [], "suggested_fix": None}
    
    # Basic URL validation
    if "linkedin.com/in/" not in linkedin.lower():
        issues.append("invalid_linkedin_format")
        return {"is_valid": False, "issues": issues, "suggested_fix": "llm"}
    
    # Extract slug
    slug_match = re.search(r'linkedin\.com/in/([a-zA-Z0-9\-_%]+)', linkedin, re.IGNORECASE)
    if not slug_match:
        issues.append("no_slug_found")
        return {"is_valid": False, "issues": issues, "suggested_fix": "llm"}
    
    slug = slug_match.group(1).lower().replace('-', '').replace('_', '').replace('%20', '')
    
    # Cross-validate: does the slug match the candidate's name?
    if first_name and last_name:
        fn_lower = first_name.lower().replace(' ', '')
        ln_lower = last_name.lower().replace(' ', '')
        
        # Check if ANY part of the name appears in the slug
        # Use at least 4 chars or full name if shorter, to avoid false matches
        fn_check = fn_lower[:4] if len(fn_lower) >= 4 else fn_lower
        ln_check = ln_lower[:4] if len(ln_lower) >= 4 else ln_lower
        name_in_slug = (
            fn_lower in slug or
            ln_lower in slug or
            (len(fn_check) >= 4 and slug.startswith(fn_check)) or
            (len(ln_check) >= 4 and ln_check in slug)
        )
        
        if not name_in_slug and len(fn_lower) >= 3 and len(ln_lower) >= 3:
            issues.append(f"slug_name_mismatch:slug={slug},name={fn_lower}_{ln_lower}")
            return {"is_valid": False, "issues": issues, "suggested_fix": "llm"}
    
    return {"is_valid": True, "issues": [], "suggested_fix": None}


# ─────────────────────────────────────────────────────────────────────────────
# Job Title Quality Validation
# ─────────────────────────────────────────────────────────────────────────────

_TITLE_GARBAGE_PATTERN = re.compile(
    r'[➢►▸▹→■●•]'           # special bullets/arrows
    r'|'
    r'\bproject\s+action\s+plan\b'
    r'|'
    r'\boutlining\b'
    r'|'
    r'\bcapture\b'
    r'|'
    r'\bassist(?:ed|ing)\b',
    re.IGNORECASE
)


def _validate_job_title_quality(job_title: str | None) -> dict:
    """Validate job title quality."""
    issues = []
    
    if not job_title or not job_title.strip():
        issues.append("title_missing")
        return {"is_valid": False, "issues": issues, "suggested_fix": "llm"}
    
    title = job_title.strip()
    
    # Check for special characters / bullets
    if _TITLE_GARBAGE_PATTERN.search(title):
        issues.append("garbage_chars_in_title")
        # Try to clean it
        cleaned = re.sub(r'^[➢►▸▹→■●•\s\-]+', '', title).strip()
        if cleaned and len(cleaned) >= 5:
            # After cleaning, re-check length/sentence quality
            if len(cleaned) > 60:
                issues.append("title_too_long_after_clean")
                # Try to extract first role segment before | or 'in'
                segments = re.split(r'\s*[|/]\s*|\s+in\s+', cleaned)
                if segments and len(segments[0].strip()) >= 5:
                    cleaned = segments[0].strip()
                else:
                    return {"is_valid": False, "issues": issues, "cleaned": None,
                            "suggested_fix": "llm"}
            return {"is_valid": False, "issues": issues, "cleaned": cleaned,
                    "suggested_fix": "clean"}
        return {"is_valid": False, "issues": issues, "cleaned": None,
                "suggested_fix": "llm"}
    
    # Check for way too long title (likely a sentence fragment)
    if len(title) > 60:
        issues.append("title_too_long")
        return {"is_valid": False, "issues": issues, "cleaned": None,
                "suggested_fix": "llm"}
    
    # Check for title that's really a sentence
    sentence_indicators = [' in ', ' to ', ' for ', ' with ', ' and ', ' the ']
    sentence_count = sum(1 for si in sentence_indicators if si in title.lower())
    if sentence_count >= 2 and len(title) > 40:
        issues.append("title_is_sentence")
        return {"is_valid": False, "issues": issues, "cleaned": None,
                "suggested_fix": "llm"}
    
    return {"is_valid": True, "issues": [], "suggested_fix": None}


# ─────────────────────────────────────────────────────────────────────────────
# Name Casing Fixer
# ─────────────────────────────────────────────────────────────────────────────

def _fix_name_casing(name: str) -> str:
    """Fix ALL-CAPS or all-lowercase names to Title Case."""
    if not name:
        return name
    # If it's all caps or all lowercase and > 1 char, title-case it
    if (name == name.upper() or name == name.lower()) and len(name) > 1:
        # Handle McNames, O'Names etc.
        result = name.title()
        # Fix common patterns
        result = re.sub(r"\bMc(\w)", lambda m: "Mc" + m.group(1).upper(), result)
        result = re.sub(r"\bO'(\w)", lambda m: "O'" + m.group(1).upper(), result)
        result = re.sub(r"\bMac(\w)", lambda m: "Mac" + m.group(1).upper(), result)
        return result
    return name


# ─────────────────────────────────────────────────────────────────────────────
# Targeted LLM Extraction
# ─────────────────────────────────────────────────────────────────────────────

_TARGETED_PROMPT_TEMPLATE = """\
Extract ONLY the requested fields from this resume header text.
Return ONLY valid JSON. No explanation.

Fields to extract: {fields_list}

JSON schema:
{{
{json_schema}
}}

Rules:
- Extract only from the text below. Do NOT hallucinate.
- For name: extract the person's actual name (first and last), not titles or headings.
- For location: extract city, state/province, and country. Format as "City, State, Country".
- For job_title: extract the candidate's primary role/title, not employer descriptions.
- For linkedin: extract the LinkedIn profile URL, normalize to https://www.linkedin.com/in/username
- For email: extract the candidate's email address.
- For phone: extract the candidate's phone number.
- Return null for fields not found.

Resume text:
{resume_text}

Return ONLY JSON."""

_FIELD_SCHEMAS = {
    "name": '"first_name": "string or null",\n  "last_name": "string or null"',
    "location": '"location": "string or null (format: City, State, Country)"',
    "job_title": '"job_title": "string or null",\n  "job_title_confidence": "number 0.0-1.0 or null"',
    "linkedin": '"linkedin_url": "string or null (format: https://www.linkedin.com/in/username)"',
    "email": '"email": "string or null"',
    "phone": '"phone": "string or null"',
}


def _build_targeted_prompt(resume_text: str, weak_fields: list[str]) -> str:
    """Build a prompt that only asks for specific weak fields."""
    fields_list = ", ".join(weak_fields)
    schema_parts = [_FIELD_SCHEMAS[f] for f in weak_fields if f in _FIELD_SCHEMAS]
    json_schema = "  " + ",\n  ".join(schema_parts)
    
    # Only send first ~2000 chars (contact info is always at top)
    text = resume_text[:2000]
    if len(resume_text) > 2000:
        text += "\n[...truncated...]"
    
    return _TARGETED_PROMPT_TEMPLATE.format(
        fields_list=fields_list,
        json_schema=json_schema,
        resume_text=text
    )


def _call_targeted_llm(resume_text: str, weak_fields: list[str], source_file: str = "") -> dict | None:
    """
    Make a targeted LLM call for specific weak fields.

    Uses the multi-provider chain (HuggingFace → Groq → NLP-only fallback).
    Never raises — returns None on all failure paths so callers always
    fall back to regex/NLP results gracefully.
    """
    from llm_provider_chain import call_llm_chain

    prompt = _build_targeted_prompt(resume_text, weak_fields)
    return call_llm_chain(prompt, source_file=source_file)


# ─────────────────────────────────────────────────────────────────────────────
# Main Enhancement Pipeline
# ─────────────────────────────────────────────────────────────────────────────

def enhance_extraction(
    *,
    resume_text: str,
    first_name: str | None = None,
    last_name: str | None = None,
    email: str | None = None,
    phone: str | None = None,
    job_title: str | None = None,
    address: str | None = None,
    linkedin: str | None = None,
    source_file: str = "",
) -> dict:
    """
    Validate and enhance regex-extracted fields using per-field quality checks
    and targeted LLM calls.
    
    Returns dict with:
        - first_name, last_name, email, phone, job_title, address, linkedin
        - enhancement_log: list of changes made
        - llm_called: bool
        - weak_fields: list of fields that had issues
    """
    from llm_usage_tracker import record_llm_call, check_llm_limit
    
    log_prefix = f"HYBRID [{source_file}]"
    enhancements = []
    weak_fields = []
    llm_called = False
    
    # ── Step 1: Per-field validation ──────────────────────────────────────
    
    # Validate name
    name_check = _validate_name_quality(first_name, last_name, email)
    if not name_check["is_valid"]:
        logger.info("%s name issues: %s", log_prefix, name_check["issues"])
        
        # Try email-based fix first (free, no LLM needed)
        if name_check.get("suggested_fix") == "email" and name_check.get("email_name"):
            email_fn, email_ln = name_check["email_name"]
            # Only use email-derived name if current parsing clearly failed
            if any(i.startswith("missing_last") for i in name_check["issues"]):
                if not last_name or last_name.lower() in ("none", "null", ""):
                    last_name = email_ln
                    enhancements.append(f"name:email_fix:{first_name} {last_name}")
                    logger.info("%s fixed last_name from email: %s", log_prefix, last_name)
                    # Re-validate
                    name_check = _validate_name_quality(first_name, last_name, email)
        
        # If still bad, mark for LLM
        if not name_check["is_valid"] and name_check.get("suggested_fix") == "llm":
            weak_fields.append("name")
    
    # Fix name casing (always, free operation)
    if first_name:
        fixed_fn = _fix_name_casing(first_name)
        if fixed_fn != first_name:
            enhancements.append(f"name:casing:{first_name}->{fixed_fn}")
            first_name = fixed_fn
    if last_name:
        fixed_ln = _fix_name_casing(last_name)
        if fixed_ln != last_name:
            enhancements.append(f"name:casing:{last_name}->{fixed_ln}")
            last_name = fixed_ln
    
    # Validate location
    loc_check = _validate_location_quality(address, first_name, last_name)
    if not loc_check["is_valid"]:
        logger.info("%s location issues: %s", log_prefix, loc_check["issues"])
        
        if loc_check.get("suggested_fix") == "clean" and loc_check.get("cleaned"):
            old_addr = address
            address = loc_check["cleaned"]
            enhancements.append(f"location:cleaned:{old_addr}->{address}")
            logger.info("%s cleaned location: %s -> %s", log_prefix, old_addr, address)
        elif loc_check.get("suggested_fix") == "llm":
            weak_fields.append("location")
    
    # Validate LinkedIn
    li_check = _validate_linkedin_quality(linkedin, first_name, last_name)
    if not li_check["is_valid"]:
        logger.info("%s linkedin issues: %s", log_prefix, li_check["issues"])
        if li_check.get("suggested_fix") == "llm":
            weak_fields.append("linkedin")
            # Clear bad LinkedIn to avoid storing wrong person's URL
            if any("mismatch" in i for i in li_check["issues"]):
                old_li = linkedin
                linkedin = None
                enhancements.append(f"linkedin:cleared_mismatch:{old_li}")
                logger.info("%s cleared mismatched LinkedIn: %s", log_prefix, old_li)
    
    # Validate job title
    title_check = _validate_job_title_quality(job_title)
    if not title_check["is_valid"]:
        logger.info("%s title issues: %s", log_prefix, title_check["issues"])
        
        if title_check.get("suggested_fix") == "clean" and title_check.get("cleaned"):
            old_title = job_title
            job_title = title_check["cleaned"]
            enhancements.append(f"title:cleaned:{old_title}->{job_title}")
            logger.info("%s cleaned title: %s -> %s", log_prefix, old_title, job_title)
        elif title_check.get("suggested_fix") == "llm":
            weak_fields.append("job_title")
    
    # Also check: missing LinkedIn when resume might have one
    if not linkedin and resume_text:
        # Quick check if "linkedin" appears in text but wasn't extracted
        if re.search(r'linkedin', resume_text[:3000], re.IGNORECASE):
            if "linkedin" not in weak_fields:
                weak_fields.append("linkedin")
    
    # ── Step 2: Targeted LLM call (only if needed) ────────────────────────
    
    _use_llm = (os.getenv("USE_LLM", "false").strip().lower() in ("1", "true", "yes"))

    if weak_fields:
        logger.info("%s weak fields detected: %s", log_prefix, weak_fields)

        if not _use_llm:
            logger.info("%s USE_LLM=false — skipping LLM enhancement for: %s", log_prefix, weak_fields)
        else:
            # Check daily limit
            llm_allowed, llm_status = check_llm_limit()
            if not llm_allowed:
                logger.warning("%s LLM limit reached: %s", log_prefix, llm_status)
            else:
                # Rate delay — only when actually calling LLM
                import time
                try:
                    delay = float(os.getenv("LLM_RATE_DELAY", "2"))
                except ValueError:
                    delay = 2.0
                if delay > 0:
                    time.sleep(delay)

                # Make targeted LLM call
                llm_result = _call_targeted_llm(resume_text, weak_fields, source_file=source_file)
                llm_called = True
                
                if llm_result:
                    logger.info("%s LLM response for %s: %s", log_prefix, weak_fields,
                               {k: v for k, v in llm_result.items() if v is not None})
                    
                    # Merge LLM results (with null-rejection)
                    if "name" in weak_fields:
                        llm_fn = (llm_result.get("first_name") or "").strip().rstrip(".")
                        llm_ln = (llm_result.get("last_name") or "").strip().rstrip(".")
                        # Reject null-like LLM responses
                        if _is_null_like(llm_fn):
                            llm_fn = ""
                        if _is_null_like(llm_ln):
                            llm_ln = ""
                        # Also reject if LLM returned something that looks garbled
                        if llm_fn and _is_garbled_name(llm_fn):
                            llm_fn = ""
                        if llm_ln and _is_garbled_name(llm_ln, allow_single_char=True):
                            llm_ln = ""
                        if llm_fn and llm_ln:
                            old_name = f"{first_name} {last_name}"
                            first_name = _fix_name_casing(llm_fn)
                            last_name = _fix_name_casing(llm_ln)
                            enhancements.append(f"name:llm:{old_name}->{first_name} {last_name}")
                            logger.info("%s LLM name: %s %s", log_prefix, first_name, last_name)
                        elif llm_fn:
                            first_name = _fix_name_casing(llm_fn)
                            enhancements.append(f"name:llm_partial:{first_name}")
                    
                    if "location" in weak_fields:
                        llm_loc = (llm_result.get("location") or "").strip()
                        # Reject null-like or too-short locations
                        if _is_null_like(llm_loc):
                            llm_loc = ""
                        if llm_loc and len(llm_loc) >= 3:
                            old_addr = address
                            address = llm_loc
                            enhancements.append(f"location:llm:{old_addr}->{address}")
                            logger.info("%s LLM location: %s", log_prefix, address)
                    
                    if "linkedin" in weak_fields:
                        llm_li = (llm_result.get("linkedin_url") or "").strip()
                        if llm_li and "linkedin.com/in/" in llm_li.lower():
                            # Normalize
                            slug_m = re.search(r'linkedin\.com/in/([a-zA-Z0-9\-_%]+)', llm_li, re.IGNORECASE)
                            if slug_m:
                                normalized = f"https://www.linkedin.com/in/{slug_m.group(1)}"
                                old_li = linkedin
                                linkedin = normalized
                                enhancements.append(f"linkedin:llm:{old_li}->{linkedin}")
                                logger.info("%s LLM linkedin: %s", log_prefix, linkedin)
                    
                    if "job_title" in weak_fields:
                        llm_jt = (llm_result.get("job_title") or "").strip()
                        if _is_null_like(llm_jt):
                            llm_jt = ""
                        if llm_jt and 3 <= len(llm_jt) <= 60:
                            old_title = job_title
                            job_title = llm_jt
                            enhancements.append(f"title:llm:{old_title}->{job_title}")
                            logger.info("%s LLM title: %s", log_prefix, job_title)
                    
                    if "email" in weak_fields:
                        llm_email = (llm_result.get("email") or "").strip()
                        if _is_null_like(llm_email):
                            llm_email = ""
                        if llm_email and "@" in llm_email:
                            old_email = email
                            email = llm_email
                            enhancements.append(f"email:llm:{old_email}->{email}")
                    
                    if "phone" in weak_fields:
                        llm_phone = (llm_result.get("phone") or "").strip()
                        if _is_null_like(llm_phone):
                            llm_phone = ""
                        if llm_phone:
                            old_phone = phone
                            phone = llm_phone
                            enhancements.append(f"phone:llm:{old_phone}->{phone}")
                else:
                    logger.warning("%s LLM returned no results for: %s", log_prefix, weak_fields)
    
    # Record LLM usage
    record_llm_call(
        used_llm=llm_called,
        extraction_method="hybrid_enhanced" if llm_called else "regex_validated",
        confidence_score=1.0 if not weak_fields else 0.5
    )
    
    if enhancements:
        logger.info("%s enhancements applied: %s", log_prefix, enhancements)
    else:
        logger.debug("%s all fields passed validation", log_prefix)
    
    return {
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "phone": phone,
        "job_title": job_title,
        "address": address,
        "linkedin": linkedin,
        "enhancement_log": enhancements,
        "llm_called": llm_called,
        "weak_fields": weak_fields,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Module test
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    
    print("=== Hybrid Enhancer Self-Test ===\n")
    
    # Test 1: Good data (should pass through unchanged)
    r1 = enhance_extraction(
        resume_text="John Doe\njohn.doe@gmail.com\n+1-555-123-4567\nSan Francisco, CA",
        first_name="John", last_name="Doe",
        email="john.doe@gmail.com", phone="+1-555-123-4567",
        job_title="Senior Software Engineer",
        address="San Francisco, California, United States",
        linkedin="https://www.linkedin.com/in/johndoe",
        source_file="test_good.pdf"
    )
    print(f"Test 1 (good): weak={r1['weak_fields']}, llm={r1['llm_called']}, changes={len(r1['enhancement_log'])}")
    
    # Test 2: Bad name
    r2 = enhance_extraction(
        resume_text="About Me\nSenior Data Analyst\nBay Area, CA",
        first_name="About", last_name=None,
        email=None, phone=None,
        job_title="Senior Data Analyst",
        address="Bay Area, California, United States",
        linkedin=None,
        source_file="test_bad_name.pdf"
    )
    print(f"Test 2 (bad name): weak={r2['weak_fields']}, issues detected")
    
    # Test 3: Garbage location
    r3 = enhance_extraction(
        resume_text="Daniel Perez\ndperez@caltech.edu\n512-431-4592\nNashville, TN",
        first_name="Daniel", last_name="Perez",
        email="dperez@caltech.edu", phone="+1-512-431-4592",
        job_title="Mobile Developer",
        address="Years Experience Nashville, Tennessee, United States",
        linkedin=None,
        source_file="test_bad_location.pdf"
    )
    print(f"Test 3 (bad location): addr='{r3['address']}', changes={r3['enhancement_log']}")
    
    # Test 4: Wrong LinkedIn
    r4 = enhance_extraction(
        resume_text="Chad Parr\nchad.parr@icloud.com\n801-921-1005",
        first_name="Chad", last_name="Parr",
        email="chad.parr@icloud.com", phone="+1-801-921-1005",
        job_title="iOS Developer",
        address="South St. Paul, Minnesota, United States",
        linkedin="https://www.linkedin.com/in/charles-mcturland",
        source_file="test_bad_linkedin.pdf"
    )
    print(f"Test 4 (wrong LinkedIn): li='{r4['linkedin']}', changes={r4['enhancement_log']}")
    
    # Test 5: ALL CAPS name
    r5 = enhance_extraction(
        resume_text="HUY DUONG\nhuyduong380@gmail.com",
        first_name="HUY", last_name="Duong",
        email="huyduong380@gmail.com", phone="+1-641-819-1135",
        job_title="Mobile Developer",
        address="Dallas, Texas, United States",
        linkedin="https://www.linkedin.com/in/huyduong380",
        source_file="test_caps.pdf"
    )
    print(f"Test 5 (ALL CAPS): name='{r5['first_name']} {r5['last_name']}', changes={r5['enhancement_log']}")
    
    # Test 6: Name in location
    r6 = enhance_extraction(
        resume_text="Manikandan Lingi\nLivermore, CA",
        first_name="Manikandan", last_name="Lingi",
        email=None, phone="+1-608-698-3920",
        job_title="Developer",
        address="Manikandan Lingi Livermore, California, United States",
        linkedin=None,
        source_file="test_name_in_loc.pdf"
    )
    print(f"Test 6 (name in loc): addr='{r6['address']}', changes={r6['enhancement_log']}")
    
    # Test 7: Garbled title
    r7 = enhance_extraction(
        resume_text="Abhijeeth Reddy\n",
        first_name="Abhijeeth", last_name="Reddy",
        email="abhijeeth@test.com", phone="+1-201-510-7991",
        job_title="➢ Assisted Project Manager | Product Owner in Outlining Detailed Project Action Plans to Capture",
        address="Charlotte, North Carolina, United States",
        linkedin=None,
        source_file="test_bad_title.pdf"
    )
    print(f"Test 7 (bad title): title='{r7['job_title']}', changes={r7['enhancement_log']}")
    
    print("\n=== Self-Test Complete ===")
