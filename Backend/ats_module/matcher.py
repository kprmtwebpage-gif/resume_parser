"""
ATS Matching Engine — scores candidates against job requirements.
Uses skills overlap, experience, location, education, and title similarity.
"""

import re
from difflib import SequenceMatcher


def _normalize_skill(s):
    """Normalize a skill string for comparison."""
    return re.sub(r'[^a-z0-9#+.]', '', s.lower().strip())


def _parse_skills(text):
    """Parse comma/semicolon separated skills into a normalized set."""
    if not text:
        return set()
    raw = re.split(r'[,;|]+', text)
    return {_normalize_skill(s) for s in raw if _normalize_skill(s)}


def _title_similarity(title1, title2):
    """Fuzzy title match using SequenceMatcher (0-100)."""
    if not title1 or not title2:
        return 0
    t1 = title1.lower().strip()
    t2 = title2.lower().strip()
    if t1 == t2:
        return 100
    # Check if one contains the other
    if t1 in t2 or t2 in t1:
        return 85
    ratio = SequenceMatcher(None, t1, t2).ratio()
    return round(ratio * 100)


def _location_match(job_location, candidate_location, job_employment_type=None):
    """Score location compatibility (0-100)."""
    if not job_location:
        return 80  # No location requirement = mostly compatible

    jl = (job_location or '').lower().strip()
    cl = (candidate_location or '').lower().strip()
    emp = (job_employment_type or '').lower()

    # Remote jobs match everyone
    if 'remote' in jl or 'remote' in emp:
        return 100

    if not cl:
        return 30  # No candidate location = low match

    # Exact city match
    if jl == cl:
        return 100

    # State match
    j_parts = [p.strip() for p in re.split(r'[,|]', jl)]
    c_parts = [p.strip() for p in re.split(r'[,|]', cl)]

    # Check state overlap
    j_state = j_parts[-1] if len(j_parts) > 1 else ''
    c_state = c_parts[-1] if len(c_parts) > 1 else ''

    if j_state and c_state and j_state == c_state:
        return 80

    # Same country
    if any(p in cl for p in j_parts):
        return 60

    # Hybrid = partial match if same state
    if 'hybrid' in jl or 'hybrid' in emp:
        return 50

    return 20


def _experience_match(required_exp_text, candidate_years):
    """Score experience match (0-100)."""
    if candidate_years is None:
        return 50  # Unknown = neutral

    # Try to extract required years from job description/skills
    req_years = 0
    if required_exp_text:
        m = re.search(r'(\d+)\+?\s*(?:years?|yrs?)', str(required_exp_text), re.I)
        if m:
            req_years = int(m.group(1))

    if req_years == 0:
        return 80  # No specific requirement

    cand = float(candidate_years)
    if cand >= req_years:
        return 100
    elif cand >= req_years * 0.75:
        return 80
    elif cand >= req_years * 0.5:
        return 60
    elif cand >= req_years * 0.25:
        return 40
    return 20


def _education_match(required_qual, candidate_qual):
    """Score education match (0-100)."""
    if not required_qual:
        return 80  # No requirement

    rq = (required_qual or '').lower()
    cq = (candidate_qual or '').lower()

    if not cq:
        return 30

    # Degree hierarchy
    levels = {
        'phd': 5, 'doctorate': 5, 'doctor': 5,
        'master': 4, 'mba': 4, 'msc': 4, 'ms': 4, 'mtech': 4,
        'bachelor': 3, 'bsc': 3, 'bs': 3, 'btech': 3, 'be': 3, 'bca': 3,
        'associate': 2, 'diploma': 2,
        'high school': 1, 'ged': 1,
    }

    def _get_level(text):
        for key, lvl in levels.items():
            if key in text:
                return lvl
        return 2  # Default to associate level

    req_lvl = _get_level(rq)
    cand_lvl = _get_level(cq)

    if cand_lvl >= req_lvl:
        return 100
    elif cand_lvl == req_lvl - 1:
        return 70
    return 40


def score_candidate(job, candidate, skills_profile, config=None):
    """
    Score a single candidate against a job.

    Args:
        job: dict with keys: job_title, skills, location, employment_type,
             required_qualification, job_description, experience
        candidate: dict with keys: first_name, last_name, email, phone,
                   address, qualification
        skills_profile: dict with keys: job_title, tech_skills,
                        years_of_experience, certifications
        config: optional ATSAnalysisConfig with custom weights

    Returns:
        dict with all scores and metadata
    """
    # Default weights
    w_skills = (config.weight_skills if config else 40) / 100
    w_exp = (config.weight_experience if config else 20) / 100
    w_loc = (config.weight_location if config else 15) / 100
    w_edu = (config.weight_education if config else 10) / 100
    w_title = (config.weight_title if config else 15) / 100

    # --- Skills matching ---
    job_skills_text = (job.get('skills') or '') + ' ' + (job.get('job_description') or '')
    job_skills = _parse_skills(job.get('skills') or '')
    cand_skills = _parse_skills(skills_profile.get('tech_skills') or '')

    if job_skills:
        matched = job_skills & cand_skills
        skills_score = round(len(matched) / len(job_skills) * 100) if job_skills else 0
        matched_list = sorted(matched)
        missing_list = sorted(job_skills - cand_skills)
    else:
        # No specific skills listed — do keyword overlap with description
        desc_words = _parse_skills(job_skills_text)
        matched = desc_words & cand_skills
        skills_score = min(100, round(len(matched) / max(len(desc_words), 1) * 100))
        matched_list = sorted(matched)
        missing_list = []

    # --- Title matching ---
    title_score = _title_similarity(
        job.get('job_title'),
        skills_profile.get('job_title')
    )

    # --- Experience matching ---
    exp_text = str(job.get('experience') or '') + ' ' + str(job.get('job_description') or '')
    experience_score = _experience_match(
        exp_text,
        skills_profile.get('years_of_experience')
    )

    # --- Location matching ---
    location_score = _location_match(
        job.get('location'),
        candidate.get('address'),
        job.get('employment_type')
    )

    # --- Education matching ---
    education_score = _education_match(
        job.get('required_qualification'),
        candidate.get('qualification')
    )

    # --- Weighted overall score ---
    overall = round(
        skills_score * w_skills +
        experience_score * w_exp +
        location_score * w_loc +
        education_score * w_edu +
        title_score * w_title
    )
    overall = max(0, min(100, overall))

    # --- Match tier ---
    if overall >= 80:
        tier = "best_match"
    elif overall >= 60:
        tier = "good_match"
    elif overall >= 40:
        tier = "partial_match"
    else:
        tier = "low_match"

    return {
        "overall_score": overall,
        "skills_score": skills_score,
        "experience_score": experience_score,
        "location_score": location_score,
        "education_score": education_score,
        "title_score": title_score,
        "match_tier": tier,
        "matched_skills": ", ".join(matched_list) if matched_list else "",
        "missing_skills": ", ".join(missing_list[:10]) if missing_list else "",
        "candidate_name": f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip(),
        "candidate_email": candidate.get('email', ''),
        "candidate_skills": skills_profile.get('tech_skills', ''),
    }
