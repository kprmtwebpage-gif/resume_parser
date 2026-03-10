"""
Confidence Scoring Module for Resume Extraction

Evaluates the quality of regex-based field extraction to determine
when LLM fallback is needed (Scenario A: 90% regex + 10% LLM fallback).

Usage:
    from confidence_scorer import calculate_extraction_confidence
    
    score = calculate_extraction_confidence(
        name=(first_name, last_name),
        email=email,
        phone=phone,
        job_title=job_title,
        address=address
    )
    
    if score < 0.75:  # Low confidence threshold
        # Call LLM for enrichment
        llm_result = llm_extract(resume_text)
"""

import re
from typing import Optional, Tuple


def calculate_extraction_confidence(
    *,
    name: Optional[Tuple[str, str]] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    job_title: Optional[str] = None,
    address: Optional[str] = None,
    education: Optional[str] = None,
    certifications: Optional[str] = None,
    skills: Optional[str] = None,
    experience_years: Optional[int] = None,
) -> float:
    """
    Calculate confidence score (0.0 to 1.0) for regex-based extraction.
    
    Higher scores = good extraction, no LLM needed
    Lower scores (<0.75) = poor extraction, use LLM fallback
    
    Args:
        name: Tuple of (first_name, last_name)
        email: Email address
        phone: Phone number
        job_title: Job title/role
        address: Location/address
        education: Educational qualification
        certifications: Certifications string
        skills: Skills string
        experience_years: Years of experience
        
    Returns:
        float: Confidence score between 0.0 and 1.0
    """
    score = 0.0
    max_possible = 0.0
    
    # Name scoring (weight: 0.25)
    max_possible += 0.25
    if name:
        first_name, last_name = name
        first_name = (first_name or "").strip()
        last_name = (last_name or "").strip()
        
        if first_name and last_name:
            # Full name extracted
            if len(first_name) >= 2 and len(last_name) >= 2:
                score += 0.25
            elif len(first_name) >= 2:
                # First name only or last initial
                score += 0.15
        elif first_name and len(first_name) >= 2:
            # First name only, better than nothing
            score += 0.10
    
    # Email scoring (weight: 0.20)
    max_possible += 0.20
    if email and _is_valid_email(email):
        score += 0.20
    elif email:
        # Email present but questionable format
        score += 0.10
    
    # Phone scoring (weight: 0.15)
    max_possible += 0.15
    if phone:
        digits = re.sub(r'\D', '', str(phone))
        if 10 <= len(digits) <= 15:
            score += 0.15
        elif len(digits) >= 7:
            score += 0.08
    
    # Job title scoring (weight: 0.20)
    max_possible += 0.20
    if job_title:
        job_title_clean = job_title.strip()
        word_count = len(job_title_clean.split())
        
        # Good job titles are 2-5 words with role keywords
        if 2 <= word_count <= 5 and _has_role_keywords(job_title_clean):
            score += 0.20
        elif 1 <= word_count <= 7:
            # Acceptable title but may be generic/incomplete
            score += 0.12
        elif job_title_clean:
            # Title present but looks suspicious (very long/short)
            score += 0.05
    
    # Address scoring (weight: 0.10)
    max_possible += 0.10
    if address:
        address_clean = address.strip()
        # Good addresses have city/state/country components
        comma_count = address_clean.count(',')
        if comma_count >= 2:
            # Full "City, State, Country" format
            score += 0.10
        elif comma_count == 1:
            # Partial location
            score += 0.06
        elif address_clean:
            # Location present but minimal
            score += 0.03
    
    # Education scoring (weight: 0.05)
    max_possible += 0.05
    if education and education.strip():
        score += 0.05
    
    # Certifications scoring (weight: 0.03)
    max_possible += 0.03
    if certifications and certifications.strip():
        cert_count = certifications.count(',') + 1  # Rough cert count
        if cert_count >= 2:
            score += 0.03
        else:
            score += 0.02
    
    # Skills scoring (weight: 0.02)
    max_possible += 0.02
    if skills and skills.strip():
        skill_count = len(skills.split(','))
        if skill_count >= 5:
            score += 0.02
        elif skill_count >= 2:
            score += 0.01
    
    # Normalize to 0.0-1.0 scale
    if max_possible > 0:
        normalized_score = score / max_possible
    else:
        normalized_score = 0.0
    
    return min(1.0, normalized_score)


def _is_valid_email(email: str) -> bool:
    """Quick email format validation."""
    if not email or '@' not in email:
        return False
    
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email.strip()))


def _has_role_keywords(title: str) -> bool:
    """Check if job title contains common role keywords."""
    title_lower = title.lower()
    
    role_keywords = [
        'developer', 'engineer', 'analyst', 'architect', 'consultant',
        'manager', 'director', 'lead', 'specialist', 'administrator',
        'designer', 'programmer', 'tester', 'scientist', 'coordinator',
        'intern', 'trainee', 'associate', 'senior', 'junior', 'principal',
        'devops', 'sre', 'qa', 'scrum', 'product owner', 'team lead',
        'data', 'software', 'full stack', 'backend', 'frontend', 'web',
        'cloud', 'database', 'network', 'security', 'infrastructure',
    ]
    
    return any(keyword in title_lower for keyword in role_keywords)


def should_use_llm_fallback(
    confidence_score: float,
    *,
    threshold: float = 0.75,
    force_llm_for_missing_fields: bool = True,
    missing_critical_fields: int = 0
) -> bool:
    """
    Determine if LLM fallback should be triggered.
    
    Args:
        confidence_score: Score from calculate_extraction_confidence()
        threshold: Confidence threshold below which to trigger LLM (default: 0.75)
        force_llm_for_missing_fields: Always use LLM when critical fields missing
        missing_critical_fields: Count of missing critical fields (name, email, title)
        
    Returns:
        bool: True if LLM should be called, False otherwise
    """
    # Critical fields check: if name or email or title is completely missing
    if force_llm_for_missing_fields and missing_critical_fields >= 2:
        return True
    
    # Confidence-based check
    return confidence_score < threshold


def get_confidence_category(score: float) -> str:
    """
    Categorize confidence score into human-readable labels.
    
    Args:
        score: Confidence score from 0.0 to 1.0
        
    Returns:
        str: Category label (high/medium/low)
    """
    if score >= 0.85:
        return "high"
    elif score >= 0.70:
        return "medium"
    else:
        return "low"


# Example usage for testing
if __name__ == "__main__":
    # Test Case 1: Good extraction (high confidence)
    score1 = calculate_extraction_confidence(
        name=("John", "Doe"),
        email="john.doe@gmail.com",
        phone="+1234567890",
        job_title="Senior Software Engineer",
        address="San Francisco, CA, United States"
    )
    print(f"Test 1 - Good extraction: {score1:.2f} ({get_confidence_category(score1)})")
    print(f"  Should use LLM: {should_use_llm_fallback(score1)}")
    
    # Test Case 2: Partial extraction (medium confidence)
    score2 = calculate_extraction_confidence(
        name=("John", ""),
        email="john@example.com",
        phone="123456",
        job_title="Engineer",
        address="California"
    )
    print(f"\nTest 2 - Partial extraction: {score2:.2f} ({get_confidence_category(score2)})")
    print(f"  Should use LLM: {should_use_llm_fallback(score2)}")
    
    # Test Case 3: Poor extraction (low confidence)
    score3 = calculate_extraction_confidence(
        name=("", ""),
        email=None,
        phone=None,
        job_title="",
        address=None
    )
    print(f"\nTest 3 - Poor extraction: {score3:.2f} ({get_confidence_category(score3)})")
    print(f"  Should use LLM: {should_use_llm_fallback(score3)}")
