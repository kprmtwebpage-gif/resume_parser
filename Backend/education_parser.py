"""
education_parser.py
────────────────────────────────────────────────────────────────────────────
Production-ready structured education extraction for the resume parser.

Public API
──────────
    detect_degree_level(text)   → "Bachelor" | "Master" | "PhD" | "Diploma" | None
    normalize_degree(text)      → "Bachelor of Engineering" | "Master of Science" | …
    extract_specialization(text)→ "Computer Science" | "Information Technology" | …
    extract_university(text)    → "Anna University" | "University of Texas" | …
    parse_education_section(resume_text) → List[EducationEntry]

EducationEntry is a TypedDict:
    {
        "degree_level":    str | None,   # "Bachelor" / "Master" / "PhD" / "Diploma"
        "degree":          str | None,   # "Bachelor of Engineering"
        "specialization":  str | None,   # "Computer Science"
        "university":      str | None,   # "Anna University"
        "raw_line":        str,          # original source line (debug aid)
    }

spaCy integration
─────────────────
The module lazily loads spaCy (en_core_web_sm) for ORG-entity university
detection when available.  If spaCy / the model is absent or incompatible
(e.g. Python 3.14), it falls back automatically to the regex-only path with
no loss of regex-derived accuracy.

Compatibility
─────────────
Requires: Python ≥ 3.10, no mandatory third-party deps beyond the stdlib.
Tested with: Python 3.14, spaCy 3.7 (where available).
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any, TypedDict

# ─────────────────────────────────────────────────────────────────────────────
# Optional spaCy import — graceful degradation
# ─────────────────────────────────────────────────────────────────────────────

_nlp: Any = None   # will hold spaCy Language object when available


def _load_spacy() -> Any:
    global _nlp
    if _nlp is not None:
        return _nlp
    try:
        import spacy  # noqa: PLC0415
        _nlp = spacy.load("en_core_web_sm")
    except Exception:
        _nlp = False   # sentinel: tried, not available
    return _nlp


# ─────────────────────────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────────────────────────

def _ns(s: str) -> str:
    """Normalize whitespace."""
    return re.sub(r"\s+", " ", (s or "").strip())


def _deglue(s: str) -> str:
    """Re-insert spaces eaten by PDF/DOCX extractors and fix Unicode."""
    s = unicodedata.normalize("NFKC", s)
    for bad, good in [
        ("\u2019", "'"), ("\u2018", "'"), ("\u201c", '"'), ("\u201d", '"'),
        ("\u2013", "-"), ("\u2014", "-"),
    ]:
        s = s.replace(bad, good)
    # Strip possessive / encoding-ligature suffixes from degree keywords
    # "Bachelor's" → "Bachelor",  "BachelorÆs" (win-1252 corruption) → "Bachelor"
    s = re.sub(r"(?i)\b(bachelor|master)\xc6?'?s\b", r"\1", s)
    # "Masters in X" → "Master of Science in X"  (informal "masters in" phrasing)
    s = re.sub(r"(?i)\bmaster\s+in\s+", "Master of Science in ", s)
    # Glued forms: "BachelorOf", "ComputerScience"
    s = re.sub(r"(?i)(bachelor|master|doctor)of", r"\1 of", s)
    s = re.sub(r"(?i)universityof", "university of", s)
    s = re.sub(r"(?i)of(science|arts|engineering|technology|business|commerce)", r"of \1", s)
    s = re.sub(r"(?i)(science|arts|engineering|technology|business)in\b", r"\1 in", s)
    s = re.sub(r"(?i)\bmaster\s+in\s+science\b",      "Master of Science", s)
    s = re.sub(r"(?i)\bbachelor\s+in\s+science\b",    "Bachelor of Science", s)
    s = re.sub(r"(?i)\bmaster\s+in\s+engineering\b",  "Master of Engineering", s)
    s = re.sub(r"(?i)\bbachelor\s+in\s+technology\b", "Bachelor of Technology", s)
    # CamelCase split
    s = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", s)
    s = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", s)
    return s


# ─────────────────────────────────────────────────────────────────────────────
# Degree-level & normalization tables
# ─────────────────────────────────────────────────────────────────────────────

# Maps normalised token → (degree_level, canonical_degree_name)
_DEGREE_MAP: list[tuple[re.Pattern, str, str]] = [
    # PhD / Doctorate — check before "master"
    (re.compile(r"(?i)\bph\.?\s*d\b|\bdoctorate\b|\bdoctor\s+of\s+philosophy\b"),
     "PhD", "Doctor of Philosophy"),

    # Master-level
    (re.compile(r"(?i)\bmaster\s+of\s+science\b|\bm\.?\s*sc\b|\bmsc\b"),
     "Master", "Master of Science"),
    (re.compile(r"(?i)\bmaster\s+of\s+technology\b|\bm\.?\s*tech\b|\bmtech\b"),
     "Master", "Master of Technology"),
    (re.compile(r"(?i)\bmaster\s+of\s+engineering\b|\bm\.?\s*e\b|\bm\.?\s*eng\b|\bmeng\b"),
     "Master", "Master of Engineering"),
    (re.compile(r"(?i)\bmaster\s+of\s+business\s+administration\b|\bmba\b"),
     "Master", "Master of Business Administration"),
    (re.compile(r"(?i)\bmaster\s+of\s+computer\s+applications\b|\bmca\b"),
     "Master", "Master of Computer Applications"),
    (re.compile(r"(?i)\bmaster\s+of\s+arts\b|\bm\.?\s*a\b"),
     "Master", "Master of Arts"),
    # Generic M.S / MS — must come after specialised M.Sc / M.Tech
    (re.compile(r"(?i)\bm\.?\s*s\b|\bms\b"),
     "Master", "Master of Science"),
    # Generic "master" fallback
    (re.compile(r"(?i)\bmaster'?s?\b|\bm\.?\s*degree\b"),
     "Master", "Master"),

    # Bachelor-level
    (re.compile(r"(?i)\bbachelor\s+of\s+engineering\b|\bb\.?e\b"),
     "Bachelor", "Bachelor of Engineering"),
    (re.compile(r"(?i)\bbachelor\s+of\s+technology\b|\bb\.?\s*tech\b|\bbtech\b"),
     "Bachelor", "Bachelor of Technology"),
    (re.compile(r"(?i)\bbachelor\s+of\s+science\b|\bb\.?\s*sc\b|\bbsc\b"),
     "Bachelor", "Bachelor of Science"),
    (re.compile(r"(?i)\bbachelor\s+of\s+arts\b|\bb\.?\s*a\b(?!\s+[a-z])"),
     "Bachelor", "Bachelor of Arts"),
    (re.compile(r"(?i)\bbachelor\s+of\s+commerce\b|\bb\.?\s*com\b|\bbcom\b"),
     "Bachelor", "Bachelor of Commerce"),
    (re.compile(r"(?i)\bbachelor\s+of\s+computer\s+applications\b|\bbca\b"),
     "Bachelor", "Bachelor of Computer Applications"),
    (re.compile(r"(?i)\bbachelor\s+of\s+business\s+administration\b|\bbba\b"),
     "Bachelor", "Bachelor of Business Administration"),
    # Generic B.S / BS — after specialised ones
    (re.compile(r"(?i)\bb\.?\s*s\b|\bbs\b"),
     "Bachelor", "Bachelor of Science"),
    # Generic "bachelor" fallback
    (re.compile(r"(?i)\bbachelor'?s?\b|\bhonours?\s+degree\b"),
     "Bachelor", "Bachelor"),

    # Diploma / Associate
    (re.compile(r"(?i)\bdiploma\b"), "Diploma", "Diploma"),
    (re.compile(r"(?i)\bassociate\b"), "Diploma", "Associate Degree"),
]

# Degree-abbreviation tokens to strip when they appear as majors
_DEGREE_ABBR_STRIP_RE = re.compile(
    r"(?i)^\s*(?:b\.?\s*e|b\.?\s*tech|btech|b\.?\s*sc|bsc|b\.?\s*s|b\.?\s*a|b\.?\s*com|bcom|"
    r"m\.?\s*e|m\.?\s*eng|m\.?\s*tech|mtech|m\.?\s*sc|msc|m\.?\s*s|ms|mba|mca|bca|bba|"
    r"ph\.?\s*d|phd|bachelor|master|masters|doctorate)\b"
)


# ─────────────────────────────────────────────────────────────────────────────
# Specialization tables
# ─────────────────────────────────────────────────────────────────────────────

# Phrases matched (longest first wins).  Each entry: (pattern str, canonical name)
_SPECIALIZATION_TABLE: list[tuple[str, str]] = [
    # CS variants
    ("computer science and engineering",       "Computer Science and Engineering"),
    ("computer science & engineering",         "Computer Science and Engineering"),
    ("computer science engineering",           "Computer Science and Engineering"),
    ("computer science",                       "Computer Science"),
    ("computer engineering",                   "Computer Engineering"),
    ("computer applications",                  "Computer Applications"),
    ("software engineering",                   "Software Engineering"),
    ("software development",                   "Software Development"),
    # IT variants
    ("information technology and management",  "Information Technology and Management"),
    ("information technology",                 "Information Technology"),
    ("information science",                    "Information Science"),
    ("information systems and business analytics", "Information Systems and Business Analytics"),
    ("information systems",                    "Information Systems"),
    ("information communication engineering",  "Information Communication Engineering"),
    ("management information systems",         "Management Information Systems"),
    ("management information science",         "Management Information Science"),
    # AI / Data
    ("artificial intelligence and data science",  "Artificial Intelligence and Data Science"),
    ("artificial intelligence and machine learning", "Artificial Intelligence and Machine Learning"),
    ("artificial intelligence",                "Artificial Intelligence"),
    ("machine learning",                       "Machine Learning"),
    ("data science and analytics",             "Data Science and Analytics"),
    ("data science",                           "Data Science"),
    ("data analytics",                         "Data Analytics"),
    ("data engineering",                       "Data Engineering"),
    ("business analytics",                     "Business Analytics"),
    ("business intelligence",                  "Business Intelligence"),
    # Electronics
    ("electronics and communication engineering", "Electronics and Communication Engineering"),
    ("electronics and communication",          "Electronics and Communication"),
    ("electronics and telecommunications",     "Electronics and Telecommunications"),
    ("electrical and electronics engineering", "Electrical and Electronics Engineering"),
    ("electrical engineering",                 "Electrical Engineering"),
    ("electronics engineering",                "Electronics Engineering"),
    ("electronics",                            "Electronics"),
    # Mechanical / Civil
    ("mechanical engineering",                 "Mechanical Engineering"),
    ("civil engineering",                      "Civil Engineering"),
    ("structural engineering",                 "Structural Engineering"),
    # Business
    ("business administration",                "Business Administration"),
    ("finance and accounting",                 "Finance and Accounting"),
    ("accounting",                             "Accounting"),
    ("finance",                                "Finance"),
    ("marketing",                              "Marketing"),
    ("economics",                              "Economics"),
    ("commerce",                               "Commerce"),
    # Science
    ("mathematics and statistics",             "Mathematics and Statistics"),
    ("statistics",                             "Statistics"),
    ("mathematics",                            "Mathematics"),
    ("physics",                                "Physics"),
    ("chemistry",                              "Chemistry"),
    ("biology",                                "Biology"),
    # Health
    ("pharmacy",                               "Pharmacy"),
    ("nursing",                                "Nursing"),
    # Other engineering
    ("industrial engineering",                 "Industrial Engineering"),
    ("aerospace engineering",                  "Aerospace Engineering"),
    ("chemical engineering",                   "Chemical Engineering"),
    ("biomedical engineering",                 "Biomedical Engineering"),
    ("environmental engineering",              "Environmental Engineering"),
    # Generic catch-all for "X engineering" not already listed
]

_SPEC_RE_LIST: list[tuple[re.Pattern, str]] = [
    (re.compile(r"(?i)\b" + re.escape(phrase) + r"\b"), canon)
    for phrase, canon in _SPECIALIZATION_TABLE
]

# Abbreviation → canonical specialization
_SPEC_ABBR: dict[str, str] = {
    "CSE": "Computer Science and Engineering",
    "CS":  "Computer Science",
    "IT":  "Information Technology",
    "SE":  "Software Engineering",
    "IS":  "Information Systems",
    "MIS": "Management Information Systems",
    "ECE": "Electronics and Communication Engineering",
    "EEE": "Electrical and Electronics Engineering",
    "EE":  "Electrical Engineering",
    "ME":  "Mechanical Engineering",
    "CE":  "Civil Engineering",
    "AI":  "Artificial Intelligence",
    "DS":  "Data Science",
    "ML":  "Machine Learning",
}


# ─────────────────────────────────────────────────────────────────────────────
# University extraction tables
# ─────────────────────────────────────────────────────────────────────────────

# Known university keywords — if these appear in a token/phrase, it's an institution
_UNI_KEYWORDS = {
    "university", "universities", "college", "institute", "institution",
    "polytechnic", "academy", "school of", "faculty", "campus",
}

# Common name patterns for universities
_UNI_PATTERN_RE = re.compile(
    r"""(?ix)
    (?:
        # "University of X" / "X University"
        University\s+of\s+[\w\s,.-]{2,60}
        | (?-i:[A-Z]\w+(?:\s+[A-Z]\w+){0,4})\s+University
        # "X Institute of Technology" / "Indian Institute of Technology X"
        | (?:Indian\s+)?Institute\s+of\s+Technology(?:\s+[\w\s]{1,40})?
        | [\w\s]{2,50}\s+Institute\s+of\s+Technology
        # "X College of Engineering / Science / Arts"
        | [\w\s]{2,50}\s+College\s+of\s+(?:Engineering|Science|Arts|Commerce|Technology|Management)
        | [\w\s]{2,50}\s+College
        # National / State / City colleges
        | (?:National|State|City)\s+[\w\s]{2,50}\s+(?:University|College|Institute|Academy)
        # IIT / NIT / BITS shorthands
        | \b(?:IIT|NIT|BITS\s+Pilani|IIIT|IIMK?)\s+[\w\s]*
        # "X Academy" / "X School of …"
        | [\w\s]{2,40}\s+Academy(?:\s+of\s+[\w\s]{2,40})?
        | [\w\s]{2,40}\s+School\s+of\s+[\w\s]{2,40}
    )
    """,
    re.VERBOSE | re.IGNORECASE,
)

# False-positive institution strings (skills / companies that look like unis)
_UNI_FALSE_POSITIVE_RE = re.compile(
    r"(?i)\b("
    r"scrum|agile|git|github|gitlab|jira|jenkins|docker|kubernetes|aws|azure|gcp|"
    r"oracle|microsoft|google|amazon|apple|facebook|netflix|uber|linkedin|"
    r"coursera|udemy|pluralsight|edx|cert|certification|training|bootcamp|"
    r"bachelor|master|degree|diploma|gpa|cgpa|percentage|grade|score|marks|"
    r"jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec"
    r")\b"
)

# ─────────────────────────────────────────────────────────────────────────────
# Bad-specialization guard
# ─────────────────────────────────────────────────────────────────────────────

# Specialization strings that start with these verbs/patterns are job-description
# fragments, not academic fields.
_BAD_SPEC_START_RE = re.compile(
    r"""(?ix)^
    (?:
        working|using|creating|developing|writing|preparing|building|
        designing|implementing|integrating|connecting|migrating|deploying|
        managing|handling|analyzing|testing|debugging|configuring|
        responsible|collaborated|participated|involved|exposure|
        maintaining|monitoring|providing|performing|supporting|utilized|
        experience|expertise|proficient|knowledge|skilled|familiar|
        hands[- ]on|the\s|of\s+(?!course|science|technology|engineering|arts|business|commerce)
    )
    """
)

# Spec strings containing these tech-product tokens are job-description noise
_BAD_SPEC_TECH_RE = re.compile(
    r"""(?ix)\b(?:
        sql\s+server|my\s*sql|postgresql|oracle\s*sql|
        azure\s+dev|devops|oracle\b|tableau|kibana|selenium|
        jenkins|docker|kubernetes|aws|azure|gcp|terraform|ansible|
        gitlab|github|jira|confluence|splunk|grafana|postman|swagger|
        salesforce|servicenow|sharepoint|sap\b|datadog|dynatrace|
        asp\.net|asp\b|ado\.net|ado\b|linq|wcf|mvc|mvvm|wpf|xaml|
        ms\s+build|msbuild|ssis|ssrs|ssas|nhibernate|hibernate|
        relational\s+dbms|nosql|mongodb|cassandra|redis|db2
    )\b"""
)


def _is_valid_specialization(text: str) -> bool:
    """Return True only if *text* looks like a real academic field name."""
    if not text:
        return False
    words = text.split()
    # Too long (> 6 words) — likely a sentence fragment
    if len(words) > 6:
        return False
    # Starts with action verb / noise prefix
    if _BAD_SPEC_START_RE.match(text):
        return False
    # Contains technology product names that aren't field names
    if _BAD_SPEC_TECH_RE.search(text):
        return False
    return True


# Noise that often appears appended to institution names
_UNI_TRAILER_STRIP_RE = re.compile(
    r"""(?ix)
    \s*[,|•·–—]\s*.*$              # everything after separator
    | \s*\((?:present|current|till\s+date)[^)]*\)  # "(present)"
    | \s*\d{4}\s*[-–—]\s*(?:\d{4}|present|current)\s*$  # date range
    | \s*\d{4}\s*$                 # trailing year
    | ,\s*(?:\w+\s*,?\s*){1,3}$   # trailing city / state / country
    """,
    re.VERBOSE | re.IGNORECASE,
)

# Education-section heading pattern
_EDU_HEADING_RE = re.compile(
    r"(?i)^\s*(?:"
    r"education(?:al)?(?:\s+(?:background|details?|history|summary|info(?:rmation)?|"
    r"qualifications?|section|overview|profile))?"
    r"|academics?(?:\s+(?:background|qualifications?|history|profile|details?))?"
    r"|academic\s+(?:background|qualifications?|history|details?|profile|info(?:rmation)?)"
    r"|educational\s+(?:qualifications?|background|details?|history|profile)"
    r"|degrees?\s+(?:earned|obtained|awarded)?"
    r"|qualifications?"
    r"|scholastic\s+(?:details?|background|record|profile)"
    r"|professional\s+education"
    r"|education\s*[&+]\s*certifications?"
    r")\s*[:\-–]?\s*$"
)

# Stop-section headings (marks end of education section)
_STOP_SECTION_RE = re.compile(
    r"(?i)^\s*(?:experience|work\s+experience|total\s+work\s+experience|employment|professional\s+experience|"
    r"projects?\s*(?:details?|overview)?|skills?\b|technical\s+skills?|certifications?|publications?|"
    r"awards?|achievements?|interests?|languages?|references?|summary|objective|"
    r"profile|personal\s+details?|key\s+responsibilities)\s*[:\-\u2013]?\s*$"
)

# Lines that should be ignored inside the education block
_EDU_NOISE_RE = re.compile(
    r"(?i)\b("
    r"cgpa|gpa|percentage|score|marks|grade|result|pass|fail|"
    r"expected\s+graduation|graduation\s+date|expected\s+year|"
    r"jan|january|feb|february|mar|march|apr|april|jun|june|"
    r"jul|july|aug|august|sep|september|oct|october|nov|november|dec|december"
    r")\b"
)


# ─────────────────────────────────────────────────────────────────────────────
# TypedDict for structured output
# ─────────────────────────────────────────────────────────────────────────────

class EducationEntry(TypedDict, total=False):
    degree_level:   str | None
    degree:         str | None
    specialization: str | None
    university:     str | None
    raw_line:       str


# ─────────────────────────────────────────────────────────────────────────────
# 1.  detect_degree_level
# ─────────────────────────────────────────────────────────────────────────────

def detect_degree_level(text: str) -> str | None:
    """Return the degree level found in *text*.

    Returns one of: "PhD", "Master", "Bachelor", "Diploma", or None.

    The function applies patterns in priority order so that a line containing
    both "B.Tech" and "M.Tech" (e.g., a dual-degree resume section) returns
    the first (highest) match.

    Examples
    --------
    >>> detect_degree_level("B.Tech in Computer Science")
    'Bachelor'
    >>> detect_degree_level("Master of Science, Data Science")
    'Master'
    >>> detect_degree_level("PhD in Machine Learning")
    'PhD'
    >>> detect_degree_level("Diploma in Information Technology")
    'Diploma'
    """
    if not text:
        return None
    t = _deglue(text)
    for pattern, level, _ in _DEGREE_MAP:
        if pattern.search(t):
            return level
    return None


# ─────────────────────────────────────────────────────────────────────────────
# 2.  normalize_degree
# ─────────────────────────────────────────────────────────────────────────────

def normalize_degree(text: str) -> str | None:
    """Return the canonical full-form degree name found in *text*.

    Strips spurious abbreviations, CamelCase gluing, and redundant majors
    embedded in the degree token.

    Examples
    --------
    >>> normalize_degree("Btech Computer Science")
    'Bachelor of Technology'
    >>> normalize_degree("M.Sc. in Data Science")
    'Master of Science'
    >>> normalize_degree("Bachelor of Engineering in CSE")
    'Bachelor of Engineering'
    >>> normalize_degree("msc msc computer science")   # dup prevention
    'Master of Science'
    """
    if not text:
        return None
    t = _deglue(text)

    # Deduplicate: "Msc Msc" / "B.E B.E" → handle by testing each token pair
    t = re.sub(
        r"(?i)\b(m\.?\s*sc|m\.?\s*tech|m\.?\s*e|m\.?\s*s|b\.?\s*tech|b\.?\s*e|b\.?\s*sc)\b"
        r"\s+\1",
        r"\1",
        t,
    )

    for pattern, _, canonical in _DEGREE_MAP:
        if pattern.search(t):
            return canonical
    return None


# ─────────────────────────────────────────────────────────────────────────────
# 3.  extract_specialization
# ─────────────────────────────────────────────────────────────────────────────

def extract_specialization(text: str) -> str | None:
    """Return the academic specialization / major found in *text*.

    Strategy (in order):
    1. Scan for known multi-word phrases (longest-first lookup).
    2. Look for " in <phrase>" after a degree token.
    3. Look for abbreviations (CSE, IT, ECE …).
    4. Pattern-match "X engineering" not in the table.

    Examples
    --------
    >>> extract_specialization("Bachelor of Engineering in Computer Science")
    'Computer Science'
    >>> extract_specialization("M.Tech CSE from IIT Bombay")
    'Computer Science and Engineering'
    >>> extract_specialization("MS in Data Science, University of Texas")
    'Data Science'
    """
    if not text:
        return None
    t = _deglue(text)
    tl = t.lower()

    # 1. Phrase table (longest → shortest, guaranteed by table order)
    for pat, canon in _SPEC_RE_LIST:
        if pat.search(tl):
            return canon

    # 2. Extract what follows " in " / " of " after a degree token
    m = re.search(
        r"(?i)\b(?:in|major(?:\s+in)?|specialization(?:\s+in)?|concentration(?:\s+in)?)\s+"
        r"([A-Za-z][A-Za-z\s&/,'-]{2,80})",
        t,
    )
    if m:
        candidate = _clean_spec_candidate(m.group(1))
        if candidate:
            # Try to match the extracted fragment against the table
            for pat, canon in _SPEC_RE_LIST:
                if pat.search(candidate.lower()):
                    return canon
            # Generic fallback: title-case the cleaned fragment —
            # only accept if it looks like a real academic field
            titled = _titlecase_spec(candidate)
            if _is_valid_specialization(titled):
                return titled

    # 3. Abbreviation lookup (e.g., standalone "CSE", "IT", "ECE")
    for abbr, full in _SPEC_ABBR.items():
        if re.search(rf"(?i)\b{re.escape(abbr)}\b", t):
            return full

    # 4. Generic "X engineering" not in table
    m2 = re.search(r"(?i)([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+engineering\b", t)
    if m2:
        prefix = m2.group(1).lower()
        if prefix not in {"bachelor of", "master of", "bachelor", "master",
                          "b", "m", "software", "computer"}:
            return _titlecase_spec(m2.group(0))

    return None


def _clean_spec_candidate(raw: str) -> str:
    """Strip noise from a raw specialization candidate string."""
    s = _ns(raw)
    # Remove leading degree abbreviations ("B.e Computer Science" → "Computer Science")
    s = re.sub(
        r"(?i)^\s*(?:b\.?\s*e|b\.?\s*tech|btech|b\.?\s*sc|bsc|b\.?\s*s|b\.?\s*a|"
        r"m\.?\s*e|m\.?\s*tech|mtech|m\.?\s*sc|msc|m\.?\s*s|ms|mba|mca|"
        r"ph\.?\s*d|phd)\b\s*",
        "", s,
    ).strip()
    # Cut at common delimiters
    s = re.split(r"\s*,\s*", s)[0]
    s = re.split(r"\s*[-–—]\s*", s)[0]
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"\[[^\]]*\]", " ", s)
    s = re.split(r"(?i)\b(?:university|college|institute|school|cgpa|gpa|from|at)\b", s)[0]
    s = _ns(s).strip(" ,;:.-()")
    # Strip trailing years
    s = re.sub(r"\b\d{4}\b", "", s).strip()
    # Drop if remaining text is purely a degree abbreviation
    if _DEGREE_ABBR_STRIP_RE.fullmatch(s.strip()):
        return ""
    return _ns(s)


def _titlecase_spec(s: str) -> str:
    """Title-case a specialization string, preserving known uppercase acronyms."""
    _UPPER = {"CS", "CSE", "IT", "IS", "MIS", "AI", "ML", "NLP", "UI", "UX", "BI"}
    return " ".join(
        t.upper() if t.upper() in _UPPER else t.title()
        for t in s.split()
        if t
    )


# ─────────────────────────────────────────────────────────────────────────────
# 4.  extract_university
# ─────────────────────────────────────────────────────────────────────────────

def extract_university(text: str, *, use_spacy: bool = True) -> str | None:
    """Return the university / institution name in *text*.

    Strategy
    ────────
    1. Regex patterns ("X University", "University of X", "IIT X", etc.)
    2. Keyword scan: any token-group containing "university / college / institute / …"
    3. spaCy ORG NER (when available) as a secondary confirmation pass.

    The function explicitly avoids:
    - Company names (Amazon, Google, Microsoft …)
    - Skill tokens and certification names
    - Date / score strings

    Examples
    --------
    >>> extract_university("Anna University, Chennai – 2019")
    'Anna University'
    >>> extract_university("University of Texas at Austin")
    'University of Texas at Austin'
    >>> extract_university("IIT Bombay, 2021")
    'IIT Bombay'
    """
    if not text:
        return None
    t = _deglue(text)

    # ── 0. Well-known abbreviated Indian / US university names ─────────────
    _ABBR_UNI_MAP = {
        r"\bJNTU[-\s]?H\b": "JNTU Hyderabad",
        r"\bJNTU[-\s]?K\b": "JNTU Kakinada",
        r"\bJNTU[-\s]?A\b": "JNTU Anantapur",
        r"\bJNTUH\b": "JNTU Hyderabad",
        r"\bJNTUK\b": "JNTU Kakinada",
        r"\bJNTUA\b": "JNTU Anantapur",
        r"\bJNTU\b": "JNTU",
        r"\bVTU\b": "Visvesvaraya Technological University",
        r"\bOSU\b": "Ohio State University",
        r"\bMIT\b": "MIT",
        r"\bCMU\b": "Carnegie Mellon University",
        r"\bUCLA\b": "UCLA",
        r"\bNYU\b": "New York University",
        r"\bUSC\b": "University of Southern California",
        r"\bGTU\b": "Gujarat Technological University",
        r"\bAPJ\s+Abdul\s+Kalam": "APJ Abdul Kalam Technological University",
        r"\bSVU\b": "Sri Venkateswara University",
        r"\bOU\b": "Osmania University",
        r"\bRGPV\b": "Rajiv Gandhi Proudyogiki Vishwavidyalaya",
        r"\bAKTU\b": "Dr. A.P.J. Abdul Kalam Technical University",
    }
    for pat, full_name in _ABBR_UNI_MAP.items():
        if re.search(pat, t, re.IGNORECASE):
            return full_name

    # ── 1. Regex structural patterns ─────────────────────────────────────────
    for m in _UNI_PATTERN_RE.finditer(t):
        candidate = _clean_uni(m.group(0))
        if candidate and not _UNI_FALSE_POSITIVE_RE.search(candidate):
            return candidate

    # ── 2. Keyword scan ───────────────────────────────────────────────────────
    # Split into comma/pipe/bullet segments and test each
    for segment in re.split(r"[,|•·\n]", t):
        seg = _ns(segment)
        seg_l = seg.lower()
        if any(kw in seg_l for kw in _UNI_KEYWORDS):
            if not _UNI_FALSE_POSITIVE_RE.search(seg):
                cleaned = _clean_uni(seg)
                if cleaned and len(cleaned.split()) >= 2:
                    return cleaned

    # ── 3. spaCy ORG NER fallback ─────────────────────────────────────────────
    if use_spacy:
        nlp = _load_spacy()
        if nlp:
            doc = nlp(t[:512])   # limit to avoid slow NLP on long texts
            for ent in doc.ents:
                if ent.label_ == "ORG":
                    candidate_text = _clean_uni(ent.text)
                    if not candidate_text:
                        continue
                    cl = candidate_text.lower()
                    if any(kw in cl for kw in _UNI_KEYWORDS):
                        if not _UNI_FALSE_POSITIVE_RE.search(candidate_text):
                            return candidate_text

    return None


def _clean_uni(raw: str) -> str:
    """Strip noise appended to an extracted institution candidate."""
    s = _ns(raw)
    # Strip trailing date ranges, city, score
    s = _UNI_TRAILER_STRIP_RE.sub("", s)
    # Strip leading filler
    s = re.sub(r"(?i)^\s*(?:from|at|the)\s+", "", s).strip()
    # Strip spec text before "from": "CS Engineering from Annamacharya" → "Annamacharya"
    m = re.match(r"(?i)^(.+?)\s+from\s+(.+)$", s)
    if m:
        prefix, suffix = m.group(1).strip(), m.group(2).strip()
        if not re.search(r"(?i)\b(?:university|college|institute|school|academy)\b", prefix):
            s = suffix
    # Strip leading academic-field words bleeding from the degree line (glued DOCX text)
    s = re.sub(
        r"(?i)^(?:computer(?:\s+(?:and\s+)?(?:information\s+)?(?:science|engineering))?|"
        r"information\s+(?:science|technology|systems)|"
        r"(?:electrical|electronics|mechanical|software|civil|chemical|biomedical|"
        r"environmental|industrial|data)\s+(?:science|engineering|analytics)?|"
        r"business\s+administration|management(?:\s+information\s+systems)?|"
        r"engineering\b)\s+",
        "", s
    ).strip()
    # Remove years isolated mid-string
    s = re.sub(r"\b\d{4}\b", "", s)
    s = _ns(s).strip(" ,;:.-()")
    # Cap at 8 words — long strings are usually spec+university glued together
    # and the institution part is typically the last N words after a field keyword
    words = s.split()
    if len(words) > 8:
        # Try to find a "University/College/Institute" word and take context around it
        for end_i, w in enumerate(words):
            if any(kw in w.lower() for kw in ('university', 'college', 'institute', 'polytechnic')):
                # Take up to 5 words before + this word as the name
                start_i = max(0, end_i - 4)
                s = ' '.join(words[start_i:end_i + 1])
                break
        else:
            # No institution keyword found — keep first 6 words
            s = ' '.join(words[:6])
        s = _ns(s).strip(" ,;:.-()")
    # Must have at least 2 words and some alpha content
    if len(s.split()) < 2 or not re.search(r"[A-Za-z]{3}", s):
        return ""
    # Does it still contain an institution keyword?  Accept even if not (good regex match)
    return s


# ─────────────────────────────────────────────────────────────────────────────
# Section slicer helpers
# ─────────────────────────────────────────────────────────────────────────────

def _slice_education_section(lines: list[str]) -> list[str]:
    """Return lines belonging to the education section.

    Looks for an explicit 'EDUCATION' heading and collects lines until the
    next section heading or until a heuristic cutoff. Falls back to a broad
    keyword scan of the full resume when no heading is found.
    """
    # ── Try to find an explicit education heading ─────────────────────────
    start_idx = None
    for i, ln in enumerate(lines):
        if _EDU_HEADING_RE.match(ln):
            start_idx = i
            break

    if start_idx is not None:
        block: list[str] = []
        # Secondary stop: lines that begin with common non-education section
        # headings followed by a colon and trailing content, e.g.:
        # "Total Work Experience: 4.5+ years..."  or  "Projects Details: ..."
        _INLINE_STOP_RE = re.compile(
            r"(?i)^\s*(?:total\s+work\s+experience|work\s+experience|"
            r"projects?\s*(?:details?|overview)?|key\s+responsibilities|"
            r"professional\s+experience|employment\s+history)\s*:"
        )
        for ln in lines[start_idx + 1:]:
            if _STOP_SECTION_RE.match(ln) or _INLINE_STOP_RE.match(ln):
                break
            block.append(ln)
        # Keep up to 60 lines from the section (avoid runaway)
        return block[:60]

    # ── Fallback: keyword scan of full resume ─────────────────────────────
    # Use a STRICT degree pattern so we never match "master pages", "MS-DOS",
    # "MS SQL Server", "master list", "Scrum Master" etc. as degree lines.
    # "master" / "bachelor" alone is NOT sufficient — we require either
    #   • degree-phrase context: "master of", "master in", "masters in",
    #     "bachelor of", "bachelor in", "bachelor's"
    #   • OR unambiguous abbreviations: B.Tech, M.Sc, MBA, PhD …
    #   • OR institution keywords: university, college, institute
    _STRONG_DEGREE_RE = re.compile(
        r"(?i)"
        # bachelor in degree phrase or clear abbreviation
        r"\bbachelor'?s?\s+(?:of|in)\s|\bbachelor'?s\b|"
        r"\bb\.?\s*tech\b|\bbtech\b|"
        r"\bb\.?\s*sc\b|\bbsc\b|\bb\.?\s*s\b(?!\s*\w)|\bbs\b(?!\s*\w)|\bb\.?\s*com\b|\bbcom\b|"
        r"\bbca\b|\bbba\b|"
        # master in degree phrase or clear abbreviation (must have "of/in" or end of standalone)
        r"\bmaster'?s?\s+(?:of|in)\s|"
        r"\bm\.?\s*tech\b|\bmtech\b|\bm\.?\s*sc\b|\bmsc\b|\bmba\b|\bmca\b|\bmcom\b|"
        # PhD / doctorate
        r"\bph\.?\s*d\b|\bphd\b|\bdoctorate\b|"
        # unambiguous keywords
        r"\bdiploma\b|\bassociate\s+degree\b|"
        # institution markers (for uni-only lines)
        r"\buniversity\b|\bcollege\b|\binstitute\b|\binstitution\b"
    )

    # Quick-exit terms that are unambiguous without regex
    _QUICK_EDU = {"education", "graduation", "graduated", "b.tech", "btech",
                  "m.tech", "mtech", "mba", "mca", "phd", "diploma", "bachelor's",
                  "master's", "masters degree", "bachelors degree",
                  "bachelor degree", "bachelor's degree", "associate degree"}

    def _has_edu_term(ln: str) -> bool:
        # Normalize Unicode quotes so "Bachelor\u2019s" matches "bachelor's"
        # but do NOT call _deglue (which strips possessives entirely).
        ln_n = ln.replace("\u2019", "'").replace("\u2018", "'")
        ll = ln_n.lower()
        if any(t in ll for t in _QUICK_EDU):
            return True
        return bool(_STRONG_DEGREE_RE.search(ln_n))

    return [ln for ln in lines[:350] if len(ln) <= 200 and _has_edu_term(ln)]


# ─────────────────────────────────────────────────────────────────────────────
# Merging context — look-ahead for multi-line entries
# ─────────────────────────────────────────────────────────────────────────────

def _build_context_windows(lines: list[str]) -> list[tuple[str, str | None, str | None]]:
    """Return (line, prev_line|None, next_line|None) triples for all lines."""
    return [
        (lines[i],
         lines[i - 1] if i > 0 else None,
         lines[i + 1] if i + 1 < len(lines) else None)
        for i in range(len(lines))
    ]


# ─────────────────────────────────────────────────────────────────────────────
# 5.  parse_education_section  (main entry point)
# ─────────────────────────────────────────────────────────────────────────────

def parse_education_section(resume_text: str) -> list[EducationEntry]:
    """Parse the resume text and return a list of structured education entries.

    Each entry is an :class:`EducationEntry` dict with keys:
      - ``degree_level``   : "Bachelor" / "Master" / "PhD" / "Diploma"
      - ``degree``         : canonical degree name
      - ``specialization`` : academic specialization / major
      - ``university``     : institution name
      - ``raw_line``       : source line (useful for debugging)

    Duplicate entries (same degree + specialization) are removed.

    Examples
    --------
    >>> entries = parse_education_section(resume_text)
    >>> for e in entries:
    ...     print(e['degree'], '-', e['specialization'], '@', e['university'])
    Bachelor of Engineering - Computer Science @ Anna University
    Master of Science - Data Science @ University of Texas

    Returns
    -------
    list[EducationEntry]
        May be empty if no education information is found.
    """
    if not resume_text:
        return []

    # ── Pre-process ────────────────────────────────────────────────────────
    raw_lines = [_ns(ln) for ln in resume_text.split("\n") if _ns(ln)]
    edu_lines = _slice_education_section(raw_lines)
    contexts = _build_context_windows(edu_lines)

    degree_signal_re = re.compile(
        r"(?i)\b(bachelors?'?|masters?'?|ph\.?\s*d|phd|doctorate|b\.?\s*tech|btech|b\.?e\b|"
        r"b\.?\s*sc\b|bsc\b|b\.?\s*s\b|\bbs\b|b\.?\s*com\b|bcom\b|b\.?\s*a\b|"
        r"m\.?\s*s(?![\-]?sql)(?![\-]?dos)(?![\-]?office)(?![\-]?access)(?![\-]?excel)(?![\-]?word)\b|"
        r"\bms(?![\-]?sql)(?![\-]?dos)(?![\-]?office)(?![\-]?access)(?![\-]?excel)(?![\-]?word)\b|"
        r"m\.?\s*sc\b|\bmsc\b|m\.?\s*tech|mtech|"
        r"mba|mca|mcom\b|m\.?\s*com\b|bca\b|bba\b|diploma|associate)\b"
    )

    entries: list[EducationEntry] = []
    seen: set[tuple[str | None, str | None]] = set()

    def _add(entry: EducationEntry) -> None:
        key = (
            (entry.get("degree") or "").lower(),
            (entry.get("specialization") or "").lower(),
        )
        if key in seen:
            return
        seen.add(key)
        entries.append(entry)

    for ln, prev_ln, next_ln in contexts:
        # Normalise the line before degree detection to handle Unicode ligatures
        # like "BachelorÆs" and variants like "Masters in..."
        ln_norm = _deglue(ln)

        # Skip pure noise lines (GPA scores, dates, etc.)
        if _EDU_NOISE_RE.search(ln) and not degree_signal_re.search(ln_norm):
            continue

        # ── Quickly skip lines without any degree signal ──────────────────
        if not degree_signal_re.search(ln_norm):
            # Maybe the institution line carries a university keyword;
            # try to attach it to the last  entry
            uni = extract_university(ln, use_spacy=True)
            if uni and entries and entries[-1].get("university") is None:
                entries[-1]["university"] = uni
            continue

        # ── Guard: false-positive "master" contexts ───────────────────────
        # "Scrum Master", "Master Data Management", "Mastercard", etc.
        if re.search(
            r"(?i)\b(scrum\s+master|master\s+data|mastercard|master\s*class|"
            r"webmaster|postmaster|taskmaster|grand\s*master|game\s*master)\b",
            ln_norm,
        ) and not re.search(
            r"(?i)\b(university|college|institute|education|degree|"
            r"bachelor|b\.?\s*tech|diploma)\b",
            ln_norm,
        ):
            continue

        # ── A line has a degree signal → extract fields ───────────────────
        degree_level = detect_degree_level(ln)
        degree_name  = normalize_degree(ln)
        # Combine with next line for specialization extraction (but NOT
        # university — next_ln often belongs to the next education entry
        # and causes cross-contamination).
        combined_for_spec = ln + " | " + next_ln if next_ln else ln
        spec = extract_specialization(combined_for_spec)

        # University: try same line first, then previous line, then next line.
        # Many resumes put the institution name on the line BEFORE the degree:
        #   "University of X"
        #   "Bachelor of Science in CS"
        uni = extract_university(ln)
        if uni is None and prev_ln:
            # Only use prev_ln if it does NOT contain a degree signal itself
            # (otherwise it belongs to a different education entry)
            prev_norm = _deglue(prev_ln)
            if not degree_signal_re.search(prev_norm):
                uni = extract_university(prev_ln)
        if uni is None and next_ln:
            # Only use next_ln if it does NOT contain a degree signal itself
            next_norm = _deglue(next_ln)
            if not degree_signal_re.search(next_norm):
                uni = extract_university(next_ln)

        # Guard: if spec looks like a company line → discard
        # (but preserve known academic field words even if they contain
        # "systems", "solutions", "technologies" etc.)
        if spec and re.search(
            r"(?i)\b(software|solutions|systems|technologies|consulting|"
            r"services|pvt|ltd|inc|corp|llc|group|limited)\b",
            spec,
        ) and not re.search(
            r"(?i)\b(engineering|science|technology|information|management|"
            r"analytics|architecture|administration|intelligence|design)\b",
            spec
        ):
            spec = None

        entry: EducationEntry = {
            "degree_level":   degree_level,
            "degree":         degree_name,
            "specialization": spec,
            "university":     uni,
            "raw_line":       ln,
        }
        _add(entry)

    # ── Post-process: fill missing universities via context scan ─────────
    # Sometimes the institution name sits on a separate line above OR below the degree
    for i, entry in enumerate(entries):
        if entry.get("university") is not None:
            continue
        try:
            raw_idx = edu_lines.index(entry["raw_line"])
        except ValueError:
            continue
        # Scan the 3 lines BEFORE the degree line (university often appears above)
        for j in range(raw_idx - 1, max(raw_idx - 4, -1), -1):
            candidate_ln = edu_lines[j]
            if degree_signal_re.search(_deglue(candidate_ln)):
                break   # hit previous degree line
            uni = extract_university(candidate_ln)
            if uni:
                entries[i]["university"] = uni
                break
        if entries[i].get("university") is not None:
            continue
        # Scan the 3 lines AFTER the degree line
        for j in range(raw_idx + 1, min(raw_idx + 4, len(edu_lines))):
            candidate_ln = edu_lines[j]
            if degree_signal_re.search(_deglue(candidate_ln)):
                break   # hit next degree line
            uni = extract_university(candidate_ln)
            if uni:
                entries[i]["university"] = uni
                break

    # ── Post-process: drop entries with no useful info ────────────────────
    entries = [
        e for e in entries
        if e.get("degree") or e.get("specialization") or e.get("university")
    ]

    # ── Post-process: keep best entry per degree_level ────────────────────
    # When the same level appears multiple times (from broad fallback scan),
    # prefer the entry with the most non-null fields (spec + uni + degree).
    def _score(e: EducationEntry) -> int:
        return sum(1 for k in ("degree", "specialization", "university") if e.get(k))

    best: dict[str | None, EducationEntry] = {}
    for e in entries:
        lvl = e.get("degree_level")
        # Treat same level + same degree as duplicates — keep highest score
        existing = best.get(lvl)
        if existing is None or _score(e) > _score(existing):
            best[lvl] = e
        elif _score(e) == _score(existing):
            # Prefer the one with a university
            if e.get("university") and not existing.get("university"):
                best[lvl] = e

    entries = list(best.values())

    # ── Final clean-up: remove raw_line from public output (optional) ─────
    # Keep raw_line so callers can debug; callers may pop() it themselves.

    return entries


# ─────────────────────────────────────────────────────────────────────────────
# Convenience: flat string summary (backward-compatible with extract_qualification)
# ─────────────────────────────────────────────────────────────────────────────

def education_to_flat_string(entries: list[EducationEntry]) -> str:
    """Convert structured entries back to the flat "Degree in Spec" string
    used by the legacy ``qualification`` column.

    >>> education_to_flat_string([
    ...     {"degree": "Bachelor of Engineering", "specialization": "Computer Science"},
    ...     {"degree": "Master of Science", "specialization": "Data Science"},
    ... ])
    'Bachelor of Engineering in Computer Science / Master of Science in Data Science'
    """
    parts: list[str] = []
    seen: set[str] = set()
    for e in entries:
        deg  = (e.get("degree") or "").strip()
        spec = (e.get("specialization") or "").strip()
        s = f"{deg} in {spec}" if deg and spec else deg or spec
        sk = s.lower()
        if s and sk not in seen:
            seen.add(sk)
            parts.append(s)
    return " / ".join(parts)
