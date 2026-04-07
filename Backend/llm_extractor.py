"""
llm_extractor.py
================
Enterprise-grade LLM-powered extraction layer for the resume parser.

Opt-in via environment variables:
    LLM_EXTRACT_ENABLED=true          – enable (default: false)
    LLM_PROVIDER=openai               – openai | anthropic | openai-compatible
    OPENAI_API_KEY=sk-...             – required for openai / openai-compatible
    ANTHROPIC_API_KEY=sk-ant-...      – required for anthropic
    LLM_MODEL=gpt-4o-mini             – model name (provider default if omitted)
    LLM_BASE_URL=https://...          – custom base URL for openai-compatible APIs
                                        (e.g., Groq → https://api.groq.com/openai/v1)
    LLM_TIMEOUT=30                    – request timeout in seconds (default 30)
    LLM_COMPACT_PROMPT=true           – use short ~300-token prompt (default: true)
                                        set false to use the full verbose prompt
    LLM_RATE_DELAY=10                 – minimum seconds between calls (default: 10)
                                        protects free-tier TPM limits; set 0 to disable

Returns a dict with keys:
    job_title            : str | None
    job_title_confidence : float | None
    linkedin_url         : str | None
    certifications       : list[dict]   (name, issuer, normalized_name, confidence)
    education            : list[dict]   (degree, normalized_degree, field_of_study,
                                         level, confidence)

Returns None when disabled or on any error — callers must handle None gracefully.
"""

from __future__ import annotations

import concurrent.futures
import json
import logging
import os
import time
from typing import Any

logger = logging.getLogger(__name__)

# Module-level timestamp for rate-limit enforcement (thread-safe read/write via GIL)
_last_call_time: float = 0.0

# ---------------------------------------------------------------------------
# Extraction prompt  (verbatim as specified)
# ---------------------------------------------------------------------------

_EXTRACTION_PROMPT_TEMPLATE = """\
You are an expert resume parsing and entity extraction engine designed for enterprise-grade candidate data extraction.

Your task is to extract, normalize, and return structured candidate information from resume text and OCR text (including certification badges from images).

STRICT EXTRACTION RULES:

1. Extract only information explicitly present in the resume text or OCR text.
2. DO NOT hallucinate, assume, or invent any information.
3. If multiple values exist, prefer the most recent and most relevant.
4. Normalize extracted entities into standardized formats.
5. Use OCR text to extract certifications and LinkedIn URLs that appear in images or badges.
6. Prefer explicit applied job title or resume headline over inferred job title.
7. Reject incomplete, invalid, or irrelevant entries.
8. Return ONLY valid JSON. Do not include explanations or comments.
9. If a field is not found, return null.
10. Assign confidence scores based on clarity and reliability of source.

--------------------------------------------------
INPUT DATA:

Resume Text:
{resume_text}

OCR Text:
{ocr_text}

--------------------------------------------------
EXTRACTION REQUIREMENTS:

=====================
JOB TITLE EXTRACTION
=====================

Extract the candidate's intended or primary job title using priority order:

Priority 1: Explicit applied role:
Examples:
Applying for Data Engineer
Position: Software Engineer
Role Applied: Backend Developer

Priority 2: Resume headline or summary:
Examples:
Senior Data Engineer
Java Developer
Cloud Engineer

Priority 3: Most recent experience job title:
Examples:
Microsoft – Azure Data Engineer
Google – Software Engineer

Normalize job titles into standard form:
Examples:
Sr Software Engineer → Senior Software Engineer
Azure Data Engineer → Data Engineer
Java Developer → Software Engineer

Assign job_title_confidence:

Explicit applied role → 0.95
Headline → 0.90
Recent experience → 0.85
Weak inference → 0.70

=====================
LINKEDIN EXTRACTION
=====================

Extract LinkedIn profile URLs from resume text or OCR text.

Accept formats:
linkedin.com/in/username
https://linkedin.com/in/username
www.linkedin.com/in/username
LinkedIn: linkedin.com/in/username

Normalize to:
https://www.linkedin.com/in/username

Reject:
linkedin.com/company/
linkedin.com/jobs/
invalid or incomplete links

=====================
CERTIFICATION EXTRACTION
=====================

Extract professional certifications from resume text and OCR text.

This includes certifications visible in image badges such as:

Microsoft Certified: Azure Data Engineer Associate
Microsoft Certified: Azure Administrator Associate
AWS Certified Solutions Architect Associate
Certified Kubernetes Administrator

OCR text may contain partial text such as:
Microsoft Certified
Azure Data Engineer Associate

Normalize certification into:

name: full certification name
issuer: issuing organization
normalized_name: standardized short name
confidence: extraction confidence

Examples:

Azure Data Engineer Associate → Microsoft Certified: Azure Data Engineer Associate
AZ-104 → Microsoft Certified: Azure Administrator Associate
AZ-305 → Microsoft Certified: Azure Solutions Architect Expert

Reject:

Course completion certificates
Udemy courses
Coursera courses (unless explicitly labeled as professional certification)

=====================
EDUCATION EXTRACTION AND NORMALIZATION
=====================

Extract education degrees and normalize into standard format.

Examples:

Bachelor of Commerce → normalized_degree: Bachelor's Degree, level: Bachelor, field_of_study: Commerce
B.Com → Bachelor's Degree
B.Tech Computer Science → Bachelor's Degree, field_of_study: Computer Science
MBA → Master's Degree
M.Tech → Master's Degree
PhD → Doctorate

Normalize:

B.E, B.Tech, B.Sc, B.Com → Bachelor's Degree
M.E, M.Tech, MBA, M.Sc → Master's Degree
PhD → Doctorate

Assign confidence based on clarity.

=====================
CONFIDENCE SCORING RULES
=====================

Explicit structured section → 0.95
Clear OCR extraction → 0.90
Clear but inferred → 0.85
Weak inference → 0.70
Ambiguous → 0.60

--------------------------------------------------
OUTPUT FORMAT (STRICT JSON ONLY):

{{
  "job_title": string or null,
  "job_title_confidence": number or null,

  "linkedin_url": string or null,

  "certifications": [
    {{
      "name": string,
      "issuer": string,
      "normalized_name": string,
      "confidence": number
    }}
  ],

  "education": [
    {{
      "degree": string,
      "normalized_degree": string,
      "field_of_study": string or null,
      "level": string,
      "confidence": number
    }}
  ]
}}

Return empty arrays if certifications or education are not found.
Return null for missing single-value fields.

Return ONLY JSON.
"""

# ---------------------------------------------------------------------------
# Compact prompt  (~300 instruction tokens — use with LLM_COMPACT_PROMPT=true)
# ---------------------------------------------------------------------------

_COMPACT_PROMPT_TEMPLATE = """\
Extract from the resume below and return ONLY valid JSON with these fields:

{{
  "job_title": string or null,
  "job_title_confidence": number or null,
  "linkedin_url": string or null,
  "location": string or null,
  "certifications": [{{"name": string, "issuer": string, "normalized_name": string, "confidence": number}}],
  "education": [{{"degree": string, "normalized_degree": string, "field_of_study": string or null, "university": string or null, "level": string, "confidence": number}}]
}}

Rules:
- job_title: normalize (Sr->Senior, no company prefix). Confidence: 0.95 explicit, 0.90 headline, 0.85 experience, 0.70 inferred.
- linkedin_url: full https://www.linkedin.com/in/username format, null if absent.
- location: candidate's current city/location as "City, State/Province, Country". Use full names (Texas not TX, India not IN). Examples: "Hyderabad, Telangana, India", "Austin, Texas, United States". Null if not present.
- certifications: professional certs only (AWS, PMP, CFA, etc.), empty array if none.
- education: normalize degree names (B.Tech->Bachelor of Technology). Include university/institution name. Levels: High School, Associate, Bachelor, Master, Doctoral, Other.
- Only extract what is explicitly present. No hallucination.

Resume Text:
{resume_text}

OCR Text (certification badges/images):
{ocr_text}

Return ONLY JSON."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_enabled() -> bool:
    # Master switch — USE_LLM=false disables ALL LLM calls regardless of other settings
    master = os.getenv("USE_LLM", "false").strip().casefold()
    if master not in {"1", "true", "yes", "on"}:
        return False
    return os.getenv("LLM_EXTRACT_ENABLED", "false").strip().casefold() in {
        "1", "true", "yes", "on"
    }


def _provider() -> str:
    return os.getenv("LLM_PROVIDER", "openai").strip().casefold()


def _model() -> str:
    p = _provider()
    default = {
        "openai": "gpt-4o-mini",
        "anthropic": "claude-3-haiku-20240307",
        "openai-compatible": "llama3-8b-8192",
    }
    return os.getenv("LLM_MODEL", default.get(p, "gpt-4o-mini")).strip()


def _timeout() -> float:
    try:
        return float(os.getenv("LLM_TIMEOUT", "30"))
    except ValueError:
        return 30.0


def _truncate(text: str, max_chars: int = 12_000) -> str:
    """Trim to max_chars while preserving whole lines."""
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    last_nl = truncated.rfind("\n")
    return (truncated[:last_nl] if last_nl > 0 else truncated) + "\n[...truncated for LLM context...]"


def _rate_delay() -> None:
    """Enforce minimum gap between LLM calls (configurable via LLM_RATE_DELAY env var).

    Default is 10 seconds — safe for Groq free-tier TPM limits.
    Set LLM_RATE_DELAY=0 to disable (paid tiers / local models).
    """
    global _last_call_time
    try:
        delay = float(os.getenv("LLM_RATE_DELAY", "10"))
    except ValueError:
        delay = 10.0
    if delay > 0 and _last_call_time > 0:
        elapsed = time.perf_counter() - _last_call_time
        if elapsed < delay:
            wait = delay - elapsed
            logger.debug("LLM extractor: rate-limit delay %.1fs", wait)
            time.sleep(wait)
    _last_call_time = time.perf_counter()


def _build_prompt(resume_text: str, ocr_text: str) -> str:
    use_compact = os.getenv("LLM_COMPACT_PROMPT", "true").strip().casefold() in {
        "1", "true", "yes", "on"
    }
    template = _COMPACT_PROMPT_TEMPLATE if use_compact else _EXTRACTION_PROMPT_TEMPLATE
    return template.format(
        resume_text=_truncate(resume_text, 10_000),
        ocr_text=_truncate(ocr_text, 3_000),
    )


def _parse_json_response(raw: str) -> dict[str, Any] | None:
    """Extract JSON from LLM reply (may be wrapped in ```json ... ``` fences)."""
    text = raw.strip()
    # Strip markdown code fences
    for fence in ("```json", "```"):
        if text.startswith(fence):
            text = text[len(fence):]
            break
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find the first {...} block
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass
    logger.warning("LLM extractor: could not parse JSON from response")
    return None


# ---------------------------------------------------------------------------
# Provider implementations
# ---------------------------------------------------------------------------

def _call_openai(prompt: str) -> str | None:
    """Call OpenAI (or any OpenAI-compatible) API."""
    try:
        import openai  # type: ignore
    except ImportError:
        logger.warning("LLM extractor: 'openai' package not installed. "
                       "Run: pip install openai")
        return None

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        logger.warning("LLM extractor: OPENAI_API_KEY not set")
        return None

    kwargs: dict[str, Any] = {
        "api_key": api_key,
        "timeout": _timeout(),
    }
    base_url = os.getenv("LLM_BASE_URL", "").strip()
    if base_url:
        kwargs["base_url"] = base_url

    _rate_delay()
    hard_timeout = _timeout() + 5  # 5s grace on top of HTTP timeout

    def _call() -> str | None:
        client = openai.OpenAI(**kwargs)
        response = client.chat.completions.create(
            model=_model(),
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert resume parsing engine. "
                        "You extract structured data and return ONLY valid JSON."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0,
            max_tokens=2048,
            timeout=_timeout(),
        )
        return response.choices[0].message.content

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(_call)
            return future.result(timeout=hard_timeout)
    except concurrent.futures.TimeoutError:
        logger.warning("LLM extractor (openai): hard timeout after %.0fs", hard_timeout)
        return None
    except Exception as e:
        logger.warning("LLM extractor (openai): %s: %s", type(e).__name__, e)
        return None


def _call_anthropic(prompt: str) -> str | None:
    """Call Anthropic Claude API."""
    try:
        import anthropic  # type: ignore
    except ImportError:
        logger.warning("LLM extractor: 'anthropic' package not installed. "
                       "Run: pip install anthropic")
        return None

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        logger.warning("LLM extractor: ANTHROPIC_API_KEY not set")
        return None

    _rate_delay()
    hard_timeout = _timeout() + 5

    def _call() -> str | None:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model=_model(),
            max_tokens=2048,
            system=(
                "You are an expert resume parsing engine. "
                "You extract structured data and return ONLY valid JSON."
            ),
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text if message.content else None

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(_call)
            return future.result(timeout=hard_timeout)
    except concurrent.futures.TimeoutError:
        logger.warning("LLM extractor (anthropic): hard timeout after %.0fs", hard_timeout)
        return None
    except Exception as e:
        logger.warning("LLM extractor (anthropic): %s: %s", type(e).__name__, e)
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def llm_extract(
    resume_text: str,
    ocr_text: str = "",
) -> dict[str, Any] | None:
    """
    Run LLM-powered extraction on resume text + optional OCR text.
    Uses llm_provider_chain (Ollama → Cerebras → Groq) when LLM_PROVIDERS is set.
    """
    if not resume_text or not resume_text.strip():
        return None

    # master switch
    master = os.getenv("USE_LLM", "false").strip().casefold()
    if master not in {"1", "true", "yes", "on"}:
        return None

    prompt = _build_prompt(resume_text, ocr_text or "")

    # Use provider chain (Ollama / Cerebras / Groq) when configured
    _providers = os.getenv("LLM_PROVIDERS", "").strip()
    result = None
    if _providers and _providers.lower() not in {"none", "off", "false", "0", ""}:
        try:
            from llm_provider_chain import call_llm_chain
            _rate_delay()
            result = call_llm_chain(prompt, source_file="llm_extractor")
        except Exception as _chain_err:
            logger.warning("LLM extractor: provider chain error: %s", _chain_err)
            result = None
    else:
        provider = _provider()
        if provider == "anthropic":
            raw = _call_anthropic(prompt)
        else:
            raw = _call_openai(prompt)
        if not raw:
            return None
        result = _parse_json_response(raw)

    if not isinstance(result, dict):
        return None

    # Normalise / sanitise the retrieved dict
    def _str_or_none(v: Any) -> str | None:
        return str(v).strip() if v else None

    def _float_or_none(v: Any) -> float | None:
        try:
            return float(v) if v is not None else None
        except (TypeError, ValueError):
            return None

    def _list_of_dicts(v: Any) -> list[dict]:
        if isinstance(v, list):
            return [d for d in v if isinstance(d, dict)]
        return []

    return {
        "job_title":            _str_or_none(result.get("job_title")),
        "job_title_confidence": _float_or_none(result.get("job_title_confidence")),
        "linkedin_url":         _str_or_none(result.get("linkedin_url")),
        "certifications":       _list_of_dicts(result.get("certifications", [])),
        "education":            _list_of_dicts(result.get("education", [])),
    }


# ---------------------------------------------------------------------------
# Selective mode prompt + extractor
# ---------------------------------------------------------------------------

_SELECTIVE_PROMPT_TEMPLATE = """\
You are an expert resume parser. Extract ONLY the fields listed below from the resume text.
Return ONLY valid JSON matching this exact schema — no extra fields, no explanations.

{{
  "first_name": string or null,
  "last_name": string or null,
  "job_title": string or null,
  "job_title_confidence": number (0.0-1.0),
  "skills": [string],
  "certifications": [{{"name": string, "issuer": string or null, "normalized_name": string, "confidence": number}}],
  "education": [{{"degree": string, "normalized_degree": string, "field_of_study": string or null, "university": string or null, "grad_year": string or null, "level": string, "confidence": number}}]
}}

=== RULES ===

NAME:
- The candidate's full legal name is almost always the VERY FIRST line of the resume.
- Split into first_name (first word) and last_name (all remaining words joined).
- For single-word names, set first_name = that word, last_name = null.
- DO NOT use company names, email addresses, job titles, section headers, or URLs as name.
- The filename may hint at the name: "{filename_hint}" — use as secondary confirmation only.

JOB TITLE:
- Extract the candidate's PRIMARY current/most recent job title.
- Priority: 1. Headline at top (conf 0.95)  2. Most recent position (conf 0.90)  3. Target role (conf 0.80)
- Normalize: Sr->Senior, Jr->Junior, Mgr->Manager. Keep the FULL specific title.
- Do NOT generalize or shorten. Pick single most prominent title.

SKILLS:
- Extract ALL technical skills, tools, frameworks, methodologies explicitly mentioned.
- Include domain-specific terms from all sections: skill sidebar, experience bullets, summary.
- Normalize to lowercase. Remove duplicates. Do NOT invent skills.

CERTIFICATIONS:
- Extract ALL professional certifications with issuing organization.
- Normalize: AZ-900->Microsoft Azure Fundamentals, PMP->Project Management Professional, CSM->Certified ScrumMaster.
- Confidence 0.95 for explicitly stated, 0.70 for inferred.

EDUCATION:
- Extract ALL degrees with institution names.
- Normalize: B.Tech->Bachelor of Technology, MBA->Master of Business Administration.
- Levels: High School, Associate, Bachelor, Master, Doctoral, Other.
- Include grad_year if mentioned.

=== STRICT ===
- Only extract what is EXPLICITLY written. Do NOT hallucinate.
- Return ONLY valid JSON. No markdown fences, no comments.

Resume Text:
{resume_text}

OCR Text (certification badges):
{ocr_text}

Return ONLY JSON."""


def _build_selective_prompt(resume_text: str, ocr_text: str, filename: str = "") -> str:
    """Build the selective-mode prompt (name + job_title + skills + certs + education)."""
    import re
    clean = resume_text
    clean = re.sub(r'[\u200b\u200c\u200d\u200e\u200f\ufeff]', '', clean)
    clean = re.sub(r'[^\x20-\x7e\n\r\t\u00a0-\u024f\u0370-\u03ff\u0400-\u04ff\u2000-\u206f\u2190-\u21ff]', ' ', clean)
    clean = re.sub(r' {3,}', '  ', clean)
    fname_hint = ""
    if filename:
        fname_hint = re.sub(r'\.(pdf|docx?|txt|rtf)$', '', filename, flags=re.IGNORECASE)
        fname_hint = re.sub(r'_?\d{5,}', '', fname_hint)
        fname_hint = re.sub(r'\s*\(\d+\)\s*', '', fname_hint)
        fname_hint = fname_hint.strip(' _-')
    return _SELECTIVE_PROMPT_TEMPLATE.format(
        resume_text=_truncate(clean, 8_000),
        ocr_text=_truncate(ocr_text or "", 2_000),
        filename_hint=fname_hint or "(not available)",
    )


def llm_extract_selective(
    resume_text: str,
    ocr_text: str = "",
    filename: str = "",
) -> dict[str, Any] | None:
    """Selective LLM extraction — name, job_title, skills, certifications, education.

    Used by PARSE_MODE=selective. NLP handles name/email/phone/location/linkedin/exp_years;
    LLM handles job_title/skills/certifications/education.
    Returns None when disabled, unconfigured, or on error.
    """
    if not _is_enabled():
        return None
    if not resume_text or not resume_text.strip():
        return None

    prompt = _build_selective_prompt(resume_text, ocr_text or "", filename=filename)

    _providers = os.getenv("LLM_PROVIDERS", "").strip()
    result = None
    if _providers and _providers.lower() not in {"none", "off", "false", "0", ""}:
        try:
            from llm_provider_chain import call_llm_chain
            _rate_delay()
            result = call_llm_chain(prompt, source_file="llm_extractor_selective")
        except Exception as _chain_err:
            logger.warning("LLM selective extractor: provider chain error: %s", _chain_err)
            result = None
    else:
        provider = _provider()
        if provider == "anthropic":
            raw = _call_anthropic(prompt)
        else:
            raw = _call_openai(prompt)
        if not raw:
            return None
        result = _parse_json_response(raw)

    if not isinstance(result, dict):
        return None

    def _str_or_none(v: Any) -> str | None:
        return str(v).strip() if v else None

    def _float_or_none(v: Any) -> float | None:
        try:
            return float(v) if v is not None else None
        except (TypeError, ValueError):
            return None

    def _list_of_strings(v: Any) -> list[str]:
        if isinstance(v, list):
            return [str(s).strip().lower() for s in v if s and str(s).strip()]
        return []

    def _list_of_dicts(v: Any) -> list[dict]:
        if isinstance(v, list):
            return [d for d in v if isinstance(d, dict)]
        return []

    return {
        "first_name":           _str_or_none(result.get("first_name")),
        "last_name":            _str_or_none(result.get("last_name")),
        "job_title":            _str_or_none(result.get("job_title")),
        "job_title_confidence": _float_or_none(result.get("job_title_confidence")),
        "skills":               _list_of_strings(result.get("skills", [])),
        "certifications":       _list_of_dicts(result.get("certifications", [])),
        "education":            _list_of_dicts(result.get("education", [])),
    }
