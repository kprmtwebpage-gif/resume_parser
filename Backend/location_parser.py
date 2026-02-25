"""location_parser.py — Production-ready resume location extraction.

Three public functions
─────────────────────
    extract_location(text)               → LocationResult | None
    detect_location_from_phone(phone)    → LocationResult | None
    detect_location_with_fallback(text, phone=None) → LocationResult

Key design decisions
────────────────────
* Only the **header / contact section** (first ~30 lines or up to the first
  major section heading) is searched for location data.  Skills / Experience /
  Education sections are never consulted.
* A "skill-context guard" rejects any city candidate whose immediately
  preceding token on the same line is a known technology / tool / testing
  framework name.  This eliminates false positives like:
      "Xunit, Mississippi, United States"
      "Xaml, Mississippi, United States"
      "Integration Testing, Mississippi, United States"
* spaCy GPE NER is used **if available** (graceful fallback to regex when
  the library cannot be loaded, e.g. Python 3.14 + pydantic v1 conflict).
* Phone area-code lookup is the **last-resort** fallback with ``confidence="low"``.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any, TypedDict


# ─────────────────────────────────────────────────────────────────────────────
# Output type
# ─────────────────────────────────────────────────────────────────────────────

class LocationResult(TypedDict):
    """Structured location extracted from a resume."""
    city:       str | None    # e.g. "Salt Lake City"
    state:      str | None    # e.g. "Utah"  (always full name, never abbrev)
    country:    str | None    # e.g. "United States"
    confidence: str           # "high" | "medium" | "low"
    source:     str           # "header_regex" | "header_spacy" | "fulltext_regex" | "phone_area_code"


def _empty_result() -> LocationResult:
    return LocationResult(city=None, state=None, country=None, confidence="low", source="none")


# ─────────────────────────────────────────────────────────────────────────────
# spaCy loader  (silent failure)
# ─────────────────────────────────────────────────────────────────────────────

def _load_spacy() -> Any:
    """Return a spaCy NLP model or None if unavailable."""
    try:
        import spacy  # type: ignore
        for model in ("en_core_web_sm", "en_core_web_md", "en_core_web_lg"):
            try:
                return spacy.load(model)
            except Exception:
                continue
    except Exception:
        pass
    return None


# ─────────────────────────────────────────────────────────────────────────────
# US state data
# ─────────────────────────────────────────────────────────────────────────────

_US_STATE_ABBR: dict[str, str] = {
    "AL": "Alabama",       "AK": "Alaska",        "AZ": "Arizona",
    "AR": "Arkansas",      "CA": "California",    "CO": "Colorado",
    "CT": "Connecticut",   "DE": "Delaware",      "FL": "Florida",
    "GA": "Georgia",       "HI": "Hawaii",        "ID": "Idaho",
    "IL": "Illinois",      "IN": "Indiana",       "IA": "Iowa",
    "KS": "Kansas",        "KY": "Kentucky",      "LA": "Louisiana",
    "ME": "Maine",         "MD": "Maryland",      "MA": "Massachusetts",
    "MI": "Michigan",      "MN": "Minnesota",     "MS": "Mississippi",
    "MO": "Missouri",      "MT": "Montana",       "NE": "Nebraska",
    "NV": "Nevada",        "NH": "New Hampshire", "NJ": "New Jersey",
    "NM": "New Mexico",    "NY": "New York",      "NC": "North Carolina",
    "ND": "North Dakota",  "OH": "Ohio",          "OK": "Oklahoma",
    "OR": "Oregon",        "PA": "Pennsylvania",  "RI": "Rhode Island",
    "SC": "South Carolina","SD": "South Dakota",  "TN": "Tennessee",
    "TX": "Texas",         "UT": "Utah",          "VT": "Vermont",
    "VA": "Virginia",      "WA": "Washington",    "WV": "West Virginia",
    "WI": "Wisconsin",     "WY": "Wyoming",       "DC": "District of Columbia",
}
_US_STATE_ABBR_SET: set[str] = set(_US_STATE_ABBR.keys())
_US_STATE_NAMES: dict[str, str] = {v.casefold(): v for v in _US_STATE_ABBR.values()}


def _is_us_state(raw: str) -> bool:
    s = re.sub(r"\s+", " ", (raw or "").strip())
    if not s:
        return False
    if len(s) == 2 and s.upper() in _US_STATE_ABBR_SET:
        return True
    return s.casefold() in _US_STATE_NAMES


def _expand_state(raw: str) -> str:
    s = re.sub(r"\s+", " ", (raw or "").strip())
    abbr = re.sub(r"[^A-Za-z]", "", s).upper()
    if len(abbr) == 2:
        return _US_STATE_ABBR.get(abbr, s)
    return _US_STATE_NAMES.get(s.casefold(), s.title() if s.isalpha() else s)


# ─────────────────────────────────────────────────────────────────────────────
# Country aliases
# ─────────────────────────────────────────────────────────────────────────────

_COUNTRY_ALIASES: dict[str, str] = {
    "usa": "United States", "u.s.a": "United States", "u.s.a.": "United States",
    "us": "United States", "u.s": "United States", "u.s.": "United States",
    "united states": "United States", "united states of america": "United States",
    "uk": "United Kingdom", "u.k": "United Kingdom", "u.k.": "United Kingdom",
    "united kingdom": "United Kingdom", "great britain": "United Kingdom",
    "england": "United Kingdom",
    "india": "India", "pak": "Pakistan", "pakistan": "Pakistan",
    "canada": "Canada", "germany": "Germany", "australia": "Australia",
    "france": "France", "netherlands": "Netherlands", "singapore": "Singapore",
    "switzerland": "Switzerland", "sweden": "Sweden", "norway": "Norway",
    "denmark": "Denmark", "finland": "Finland", "ireland": "Ireland",
    "new zealand": "New Zealand", "south africa": "South Africa",
    "mexico": "Mexico", "brazil": "Brazil", "china": "China",
    "japan": "Japan", "south korea": "South Korea", "korea": "South Korea",
    "uae": "United Arab Emirates", "u.a.e": "United Arab Emirates",
    "united arab emirates": "United Arab Emirates",
    "saudi arabia": "Saudi Arabia", "malaysia": "Malaysia",
    "philippines": "Philippines", "indonesia": "Indonesia",
    "nigeria": "Nigeria", "kenya": "Kenya", "ghana": "Ghana",
    "italy": "Italy", "spain": "Spain", "portugal": "Portugal",
    "poland": "Poland", "ukraine": "Ukraine", "russia": "Russia",
    "israel": "Israel", "egypt": "Egypt",
}


def _normalize_country(raw: str) -> str:
    k = re.sub(r"\s+", " ", (raw or "").strip()).casefold().strip(".")
    return _COUNTRY_ALIASES.get(k, raw.strip().title() if raw else "")


def _is_known_country(raw: str) -> bool:
    k = re.sub(r"\s+", " ", (raw or "").strip()).casefold().strip(".")
    return k in _COUNTRY_ALIASES


# ─────────────────────────────────────────────────────────────────────────────
# Skill / technology context tokens
# These are names that can appear in skills sections immediately before a comma
# and a state name, creating false-positive "City, State" extractions.
# ─────────────────────────────────────────────────────────────────────────────

_SKILL_CONTEXT_TOKENS: frozenset[str] = frozenset({
    # Testing frameworks / tools (the primary reported bugs)
    "xunit", "nunit", "junit", "testng", "mstest", "specflow", "cucumber",
    "selenium", "playwright", "cypress", "puppeteer",
    "moq", "mockito", "rhino", "nsubstitute", "fakeiteasy",
    "jest", "jasmine", "karma", "enzyme", "vitest",
    "pytest", "unittest", "nose", "hypothesis",
    "testing", "automation", "tdd", "bdd", "atdd",
    # .NET / Windows UI tech (XAML, WPF, WinForms appear in skills sections)
    "xaml", "wpf", "winforms", "silverlight", "uwp", "winui",
    "blazor", "razor", "maui",
    # Web / JS frameworks
    "angular", "react", "redux", "vue", "svelte", "nextjs", "nuxt",
    "jquery", "typescript", "javascript", "nodejs", "express",
    # Mobile
    "swift", "kotlin", "flutter", "xamarin", "ionic", "reactnative",
    # Databases
    "sql", "mysql", "postgresql", "oracle", "mongodb", "redis",
    "cassandra", "dynamodb", "elasticsearch", "snowflake", "bigquery",
    "mssql", "sqlite", "mariadb", "sybase", "hbase",
    # Cloud / DevOps
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform",
    "ansible", "puppet", "chef", "jenkins", "gitlab", "github",
    "circleci", "travis", "helm", "prometheus", "grafana",
    # AWS-specific services that spaCy GPE-tags incorrectly
    "kinesis", "lambda", "fargate", "sagemaker", "glue", "athena",
    "redshift", "quicksight", "firehose", "cloudfront", "cloudformation",
    "cloudwatch", "codecommit", "codepipeline", "codebuild", "codestar",
    "dynamodb", "elasticache", "ecs", "eks", "ecr", "emr", "msk",
    "stepfunctions", "eventbridge", "appsync", "amplify",
    # GCP / Azure services
    "bigquery", "dataflow", "pubsub", "spanner", "firestore",
    "databricks", "synapse", "datafactory", "hdinsight",
    # Languages
    "python", "java", "csharp", "golang", "rust", "scala",
    "ruby", "php", "perl", "bash", "powershell", "groovy",
    "cobol", "fortran", "vba", "matlab", "r",
    # Data / AI
    "tensorflow", "pytorch", "keras", "sklearn", "spark", "hadoop",
    "kafka", "airflow", "tableau", "powerbi", "looker", "databricks",
    # Misc tech tokens frequently seen before state names in bullet lists
    "agile", "scrum", "kanban", "devops", "cicd",
    "microservices", "restapi", "graphql", "grpc", "soap",
    "mvc", "mvvm", "mvp", "solid", "oop",
    "git", "svn", "mercurial",
    "postman", "swagger", "openapi", "jira", "confluence",
    "excel", "word", "outlook", "sharepoint", "salesforce",
    "sap", "erp", "crm",
    # Company-ish / role-ish tokens that should never be a city
    "engineering", "developer", "architect", "analyst", "consultant",
    "technologies", "solutions", "systems", "services",
    # Education-ish
    "bachelor", "master", "phd", "degree", "mba", "btech", "mtech",
})


def _norm_tok(s: str) -> str:
    """Normalize a single token for skill-context lookup."""
    return re.sub(r"[^a-z0-9]", "", (s or "").casefold())


def _is_skill_token(token: str) -> bool:
    return _norm_tok(token) in _SKILL_CONTEXT_TOKENS


# ─────────────────────────────────────────────────────────────────────────────
# Plausibility guards
# ─────────────────────────────────────────────────────────────────────────────

# Tokens that can never be a city or region
_BAD_CITY_TOKENS: frozenset[str] = frozenset({
    "inc", "llc", "ltd", "limited", "company", "corporation", "corp",
    "group", "services", "service", "consulting", "technologies", "technology",
    "solutions", "systems", "bank", "labs",
    "university", "college", "financial", "analytics", "health", "insurance",
    "developer", "engineer", "architect", "analyst", "intern", "manager",
    "oracle", "postgres", "postgresql", "mysql", "mssql", "sql", "nosql",
    "mongodb", "snowflake", "aws", "azure", "gcp", "linux",
    "python", "java", "scala", "hadoop", "spark", "kafka",
    # AWS / GCP / Azure specific services often GPE-tagged by spaCy
    "kinesis", "lambda", "fargate", "sagemaker", "glue", "athena",
    "redshift", "quicksight", "firehose", "cloudfront", "cloudformation",
    "cloudwatch", "dynamodb", "elasticache", "emr", "amplify",
    "databricks", "synapse", "datafactory",
    "svn", "git", "github",
    "mail", "email", "phone", "linked", "linkedin",
    "and", "or", "the", "for", "with", "from", "into",
    # Testing / tool names (also block as city candidates)
    "xunit", "nunit", "junit", "testng", "selenium", "moq", "mockito",
    "xaml", "wpf", "winforms", "blazor", "razor",
    "testing", "automation", "agile", "scrum", "devops",
})


def _is_plausible_city(raw: str) -> bool:
    """Return True if *raw* looks like a real city/place name."""
    s = re.sub(r"\s+", " ", (raw or "").strip())
    if not s:
        return False
    if any(ch.isdigit() for ch in s):
        return False
    if len(s) > 45:
        return False
    tokens = [t for t in s.split() if t]
    if not (1 <= len(tokens) <= 6):
        return False
    normed = {_norm_tok(t) for t in tokens}
    if normed & _BAD_CITY_TOKENS:
        return False
    # Single token that is a known skill/tech → reject
    if len(tokens) == 1 and _is_skill_token(tokens[0]):
        return False
    # Multi-token: if 2+ tokens are skills → reject
    if len(tokens) >= 2:
        skill_hits = sum(1 for t in tokens if _is_skill_token(t))
        if skill_hits >= 2:
            return False
    return True


def _is_plausible_region(raw: str) -> bool:
    s = re.sub(r"\s+", " ", (raw or "").strip())
    if not s or len(s) > 35 or any(ch.isdigit() for ch in s):
        return False
    normed = {_norm_tok(t) for t in s.split() if t}
    return not (normed & _BAD_CITY_TOKENS) and not _is_skill_token(s)


# ─────────────────────────────────────────────────────────────────────────────
# Skill-context guard
# ─────────────────────────────────────────────────────────────────────────────

def _preceding_token_is_skill(line: str, match_start: int) -> bool:
    """Return True if the word immediately before *match_start* on the line
    is a known skill/technology/tool name.

    Example:
        "Xunit, Mississippi"
         ^---^ at position 0-5, match_start=7 (Mississippi)
        prefix = "Xunit,"
        last word = "Xunit"
        _is_skill_token("Xunit") → True  →  reject
    """
    prefix = line[:match_start]
    # Strip trailing punctuation/spaces
    prefix = re.sub(r"[\s,;|*\-–—]+$", "", prefix)
    if not prefix:
        return False
    # Get the last whitespace-separated word (possible with dot notation like "Integration.Testing")
    words = re.split(r"[\s,;|]+", prefix)
    words = [w.strip() for w in words if w.strip()]
    if not words:
        return False

    # Check the last 1 and 2 words (catches "Integration Testing" as 2-word skill)
    last1 = words[-1]
    last2 = " ".join(words[-2:]) if len(words) >= 2 else ""

    if _is_skill_token(last1):
        return True
    if last2 and _norm_tok(last2) in _SKILL_CONTEXT_TOKENS:
        return True
    # Check if the last word contains a slash-separated skill pair like "C#/VB.NET"
    for part in re.split(r"[/\\]", last1):
        if _is_skill_token(part.strip()):
            return True
    return False


# ─────────────────────────────────────────────────────────────────────────────
# Section-boundary detection
# ─────────────────────────────────────────────────────────────────────────────

_SECTION_HEADING_RE = re.compile(
    r"(?i)^\s*(?:"
    r"technical\s+skills?|skills?\s*(?:summary|profile)?|core\s+(?:skills?|competencies)|"
    r"key\s+skills?|expertise(?:\s+snapshot)?|competencies|technologies|"
    r"(?:professional\s+)?(?:work\s+)?experience|work\s+history|employment(?:\s+history)?|"
    r"education(?:\s+background)?|academic\s+background|academics?|"
    r"certifications?|licenses?|projects?|training|courses?|awards?"
    r")\s*$",
    re.IGNORECASE,
)


def _get_header_lines(text: str, hard_cap: int = 30) -> list[str]:
    """Return only the header/contact section lines.

    Stops at the first major section heading (Skills, Experience, Education…)
    or at *hard_cap* lines, whichever comes first.  Empty lines are kept as
    separators but never count as headings.
    """
    raw_lines = text.split("\n") if text else []
    result: list[str] = []
    for ln in raw_lines:
        stripped = ln.strip()
        # Section heading boundary → stop (do not include the heading line)
        if stripped and len(stripped) < 70 and _SECTION_HEADING_RE.match(stripped):
            break
        result.append(stripped)
        if len(result) >= hard_cap:
            break
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Regex patterns
# ─────────────────────────────────────────────────────────────────────────────

_ST_ABBR_PAT = "(" + "|".join(sorted(_US_STATE_ABBR_SET)) + ")"

# City, ST 12345[-6789]
_RE_CITY_STATE_ZIP = re.compile(
    r"\b([A-Za-z][A-Za-z .'\-]{1,}?)[,\s]+(?:" + "|".join(sorted(_US_STATE_ABBR_SET)) + r")\s+\d{5}(?:-\d{4})?\b"
)
# City, ST  (2-letter state abbreviation, no zip)
_RE_CITY_ST = re.compile(
    r"\b([A-Za-z][A-Za-z .'\-]{1,}),\s*" + _ST_ABBR_PAT + r"\b"
)
# City, StateName, Country
_RE_CSC = re.compile(
    r"\b([A-Za-z][A-Za-z .'\-]{1,}),\s*([A-Za-z][A-Za-z .'\-]{2,}),\s*([A-Za-z][A-Za-z .'\-]{2,})\b"
)
# City, StateName  (full state name, no country)
_RE_CS_NAME = re.compile(
    r"\b([A-Za-z][A-Za-z .'\-]{1,}),\s*([A-Za-z][A-Za-z .'\-]{2,})\b"
)
# State, Country  (no city)
_RE_SC = re.compile(
    r"\b([A-Za-z][A-Za-z .'\-]{2,}),\s*([A-Za-z][A-Za-z .'\-]{2,})\b"
)
# City, Country  (no state)
_RE_CC = re.compile(
    r"\b([A-Za-z][A-Za-z .'\-]{1,}),\s*([A-Za-z][A-Za-z .'\-]{2,})\b"
)


def _try_parse_line(line: str) -> LocationResult | None:
    """Attempt to extract a valid LocationResult from a single line.

    Applies skill-context guard before accepting any match.
    Returns None if no valid location found.
    """
    # Remove emails, URLs, LinkedIn/GitHub tokens that add noise
    ln = re.sub(r"(?i)\b\S+@\S+\b", " ", line)
    ln = re.sub(r"(?i)https?://\S+|www\.\S+", " ", ln)
    ln = re.sub(r"(?i)\b(?:linkedin|github)\b\S*", " ", ln)
    # Remove label prefixes: "Location: …", "Address: …", "Current Location: …"
    ln = re.sub(r"(?i)^\s*(?:current\s+)?(?:location|address)\s*[:\-]\s*", "", ln)
    # "Currently residing in …" / "Residing in …" / "Currently located in …"
    ln = re.sub(r"(?i)^\s*currently\s+(?:residing|located|based)\s+(?:in|at)\s+", "", ln)
    ln = re.sub(r"(?i)^\s*(?:residing|based|located)\s+(?:in|at)\s+", "", ln)
    ln = re.sub(r"\s+", " ", ln).strip()

    if not ln:
        return None

    # Split on separator glyphs and try each segment (some headers use | ◇ •)
    if any(sep in ln for sep in ["|", "◇", "·", "•", "∙"]):
        segments = [s.strip() for s in re.split(r"[|◇·•∙]", ln) if s.strip()]
        for seg in reversed(segments):
            r = _parse_fragment(seg)
            if r:
                return r
        return None

    return _parse_fragment(ln)


def _parse_fragment(frag: str) -> LocationResult | None:
    """Run all regex patterns against a single text fragment."""
    # ── City, ST ZIP ─────────────────────────────────────────────────────────
    m = re.search(
        r"\b([A-Za-z][A-Za-z .'\-]{1,}),?\s*(?:" + "|".join(sorted(_US_STATE_ABBR_SET)) + r")\b\s*\d{5}",
        frag,
    )
    if m:
        city_raw = m.group(1)
        st_m = re.search("|".join(sorted(_US_STATE_ABBR_SET)), frag[m.start():])
        if st_m and not _preceding_token_is_skill(frag, m.start()):
            city_s = city_raw.strip().title()
            st_raw = st_m.group(0)
            if _is_plausible_city(city_s):
                return LocationResult(
                    city=city_s,
                    state=_expand_state(st_raw),
                    country="United States",
                    confidence="high",
                    source="header_regex",
                )

    # ── City, ST  (abbreviation) ──────────────────────────────────────────────
    for m in _RE_CITY_ST.finditer(frag):
        city_raw, st_raw = m.group(1), m.group(2)
        # Check MS-SQL / similar false-positive (state is not truly "MS")
        tail = frag[m.end(2):m.end(2) + 15]
        if re.match(r"\s*[-/]\s*sql\b", tail, re.I):
            continue
        if _preceding_token_is_skill(frag, m.start()):
            continue
        city = city_raw.strip().title()
        if _is_plausible_city(city):
            return LocationResult(
                city=city,
                state=_expand_state(st_raw),
                country="United States",
                confidence="high",
                source="header_regex",
            )

    # ── City, StateName, Country ──────────────────────────────────────────────
    for m in _RE_CSC.finditer(frag):
        city_raw, state_raw, country_raw = m.group(1), m.group(2), m.group(3)
        if not _is_known_country(country_raw):
            continue
        if _preceding_token_is_skill(frag, m.start()):
            continue
        city = city_raw.strip().title()
        # If state is a US state, normalise; otherwise keep as-is
        state_norm = _expand_state(state_raw) if _is_us_state(state_raw) else state_raw.strip().title()
        country_norm = _normalize_country(country_raw)
        if _is_plausible_city(city) and _is_plausible_region(state_raw):
            return LocationResult(
                city=city,
                state=state_norm,
                country=country_norm,
                confidence="high",
                source="header_regex",
            )
        # City looks like a skill → return state+country only
        if _is_us_state(state_raw) and _is_plausible_region(state_raw):
            return LocationResult(
                city=None,
                state=state_norm,
                country=country_norm,
                confidence="medium",
                source="header_regex",
            )

    # ── City, StateName  (full name, possible US state) ───────────────────────
    for m in _RE_CS_NAME.finditer(frag):
        city_raw, state_raw = m.group(1), m.group(2)
        # Must be an actual US state to avoid random "City, Country" capture
        if not _is_us_state(state_raw):
            # Could be City, Country if the state token is a country
            if _is_known_country(state_raw):
                if _preceding_token_is_skill(frag, m.start()):
                    continue
                city = city_raw.strip().title()
                if _is_us_state(city_raw):
                    return LocationResult(
                        city=None,
                        state=_expand_state(city_raw),
                        country=_normalize_country(state_raw),
                        confidence="medium",
                        source="header_regex",
                    )
                if _is_plausible_city(city):
                    return LocationResult(
                        city=city,
                        state=None,
                        country=_normalize_country(state_raw),
                        confidence="medium",
                        source="header_regex",
                    )
            continue
        if _preceding_token_is_skill(frag, m.start()):
            continue
        city = city_raw.strip().title()
        if _is_plausible_city(city) and _is_plausible_region(state_raw):
            return LocationResult(
                city=city,
                state=_expand_state(state_raw),
                country="United States",
                confidence="high",
                source="header_regex",
            )
        # City candidate is a skill → return only state
        if _is_plausible_region(state_raw):
            return LocationResult(
                city=None,
                state=_expand_state(state_raw),
                country="United States",
                confidence="medium",
                source="header_regex",
            )

    # ── State, Country  (no city) ─────────────────────────────────────────────
    for m in _RE_SC.finditer(frag):
        state_raw, country_raw = m.group(1), m.group(2)
        if _is_known_country(country_raw) and _is_us_state(state_raw):
            if _preceding_token_is_skill(frag, m.start()):
                continue
            if _is_plausible_region(state_raw):
                return LocationResult(
                    city=None,
                    state=_expand_state(state_raw),
                    country=_normalize_country(country_raw),
                    confidence="medium",
                    source="header_regex",
                )

    # ── Standalone country ────────────────────────────────────────────────────
    stripped = frag.strip(" .,;:")
    if _is_known_country(stripped) and len(stripped) <= 60:
        return LocationResult(
            city=None,
            state=None,
            country=_normalize_country(stripped),
            confidence="low",
            source="header_regex",
        )

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Area code → (primary city, state)
# ─────────────────────────────────────────────────────────────────────────────

_AREA_CODE_MAP: dict[str, tuple[str | None, str]] = {
    # Alabama
    "205": ("Birmingham", "Alabama"),    "251": ("Mobile", "Alabama"),
    "256": ("Huntsville", "Alabama"),    "334": ("Montgomery", "Alabama"),
    # Alaska
    "907": ("Anchorage", "Alaska"),
    # Arizona
    "480": ("Scottsdale", "Arizona"),   "520": ("Tucson", "Arizona"),
    "602": ("Phoenix", "Arizona"),      "623": ("Phoenix", "Arizona"),
    "928": ("Flagstaff", "Arizona"),
    # Arkansas
    "479": ("Fayetteville", "Arkansas"), "501": ("Little Rock", "Arkansas"),
    "870": (None, "Arkansas"),
    # California
    "209": ("Modesto", "California"),    "213": ("Los Angeles", "California"),
    "310": ("Los Angeles", "California"),"323": ("Los Angeles", "California"),
    "341": ("Oakland", "California"),    "408": ("San Jose", "California"),
    "415": ("San Francisco", "California"), "424": ("Los Angeles", "California"),
    "442": ("San Diego", "California"),  "510": ("Oakland", "California"),
    "530": ("Sacramento", "California"), "559": ("Fresno", "California"),
    "562": ("Long Beach", "California"), "619": ("San Diego", "California"),
    "626": ("Pasadena", "California"),   "628": ("San Francisco", "California"),
    "650": ("Palo Alto", "California"),  "657": ("Anaheim", "California"),
    "661": ("Bakersfield", "California"),"669": ("San Jose", "California"),
    "707": ("Santa Rosa", "California"), "714": ("Anaheim", "California"),
    "747": ("Los Angeles", "California"),"760": ("Palm Springs", "California"),
    "805": ("Santa Barbara", "California"), "818": ("Los Angeles", "California"),
    "820": ("Santa Barbara", "California"), "831": ("Monterey", "California"),
    "858": ("San Diego", "California"),  "909": ("San Bernardino", "California"),
    "916": ("Sacramento", "California"), "925": ("Walnut Creek", "California"),
    "949": ("Irvine", "California"),     "951": ("Riverside", "California"),
    # Colorado
    "303": ("Denver", "Colorado"),       "719": ("Colorado Springs", "Colorado"),
    "720": ("Denver", "Colorado"),       "970": ("Fort Collins", "Colorado"),
    # Connecticut
    "203": ("Bridgeport", "Connecticut"), "475": ("New Haven", "Connecticut"),
    "860": ("Hartford", "Connecticut"),  "959": ("Hartford", "Connecticut"),
    # Delaware
    "302": ("Wilmington", "Delaware"),
    # District of Columbia
    "202": ("Washington", "District of Columbia"),
    # Florida
    "239": ("Fort Myers", "Florida"),    "305": ("Miami", "Florida"),
    "321": ("Orlando", "Florida"),       "352": ("Gainesville", "Florida"),
    "386": ("Daytona Beach", "Florida"), "407": ("Orlando", "Florida"),
    "561": ("West Palm Beach", "Florida"), "689": ("Orlando", "Florida"),
    "727": ("St. Petersburg", "Florida"), "754": ("Fort Lauderdale", "Florida"),
    "772": ("Port St. Lucie", "Florida"), "786": ("Miami", "Florida"),
    "813": ("Tampa", "Florida"),         "850": ("Tallahassee", "Florida"),
    "863": ("Lakeland", "Florida"),      "904": ("Jacksonville", "Florida"),
    "941": ("Sarasota", "Florida"),      "954": ("Fort Lauderdale", "Florida"),
    # Georgia
    "229": ("Albany", "Georgia"),        "404": ("Atlanta", "Georgia"),
    "470": ("Atlanta", "Georgia"),       "478": ("Macon", "Georgia"),
    "678": ("Atlanta", "Georgia"),       "706": ("Augusta", "Georgia"),
    "762": ("Augusta", "Georgia"),       "770": ("Atlanta", "Georgia"),
    "912": ("Savannah", "Georgia"),
    # Hawaii
    "808": ("Honolulu", "Hawaii"),
    # Idaho
    "208": ("Boise", "Idaho"),           "986": ("Boise", "Idaho"),
    # Illinois
    "217": ("Springfield", "Illinois"),  "224": ("Waukegan", "Illinois"),
    "309": ("Peoria", "Illinois"),       "312": ("Chicago", "Illinois"),
    "331": ("Aurora", "Illinois"),       "618": ("East St. Louis", "Illinois"),
    "630": ("Naperville", "Illinois"),   "708": ("Chicago", "Illinois"),
    "773": ("Chicago", "Illinois"),      "779": ("Rockford", "Illinois"),
    "815": ("Rockford", "Illinois"),     "847": ("Schaumburg", "Illinois"),
    "872": ("Chicago", "Illinois"),
    # Indiana
    "219": ("Gary", "Indiana"),          "260": ("Fort Wayne", "Indiana"),
    "317": ("Indianapolis", "Indiana"),  "463": ("Indianapolis", "Indiana"),
    "574": ("South Bend", "Indiana"),    "765": ("Lafayette", "Indiana"),
    "812": ("Evansville", "Indiana"),    "930": ("Evansville", "Indiana"),
    # Iowa
    "319": ("Cedar Rapids", "Iowa"),     "515": ("Des Moines", "Iowa"),
    "563": ("Davenport", "Iowa"),        "641": (None, "Iowa"),
    "712": ("Sioux City", "Iowa"),
    # Kansas
    "316": ("Wichita", "Kansas"),        "620": (None, "Kansas"),
    "785": ("Topeka", "Kansas"),         "913": ("Kansas City", "Kansas"),
    # Kentucky
    "270": ("Bowling Green", "Kentucky"), "364": (None, "Kentucky"),
    "502": ("Louisville", "Kentucky"),   "606": (None, "Kentucky"),
    "859": ("Lexington", "Kentucky"),
    # Louisiana
    "225": ("Baton Rouge", "Louisiana"), "318": ("Shreveport", "Louisiana"),
    "337": ("Lafayette", "Louisiana"),   "504": ("New Orleans", "Louisiana"),
    "985": ("Baton Rouge", "Louisiana"),
    # Maine
    "207": ("Portland", "Maine"),
    # Maryland
    "240": ("Rockville", "Maryland"),    "301": ("Rockville", "Maryland"),
    "410": ("Baltimore", "Maryland"),    "443": ("Baltimore", "Maryland"),
    "667": ("Baltimore", "Maryland"),
    # Massachusetts
    "339": ("Boston", "Massachusetts"),  "351": (None, "Massachusetts"),
    "413": ("Springfield", "Massachusetts"), "508": ("Worcester", "Massachusetts"),
    "617": ("Boston", "Massachusetts"),  "774": ("Worcester", "Massachusetts"),
    "781": ("Boston", "Massachusetts"),  "857": ("Boston", "Massachusetts"),
    "978": ("Lowell", "Massachusetts"),
    # Michigan
    "231": ("Traverse City", "Michigan"), "248": ("Troy", "Michigan"),
    "269": ("Kalamazoo", "Michigan"),    "313": ("Detroit", "Michigan"),
    "517": ("Lansing", "Michigan"),      "586": ("Sterling Heights", "Michigan"),
    "616": ("Grand Rapids", "Michigan"), "734": ("Ann Arbor", "Michigan"),
    "810": ("Flint", "Michigan"),        "906": ("Marquette", "Michigan"),
    "947": ("Troy", "Michigan"),         "989": (None, "Michigan"),
    # Minnesota
    "218": ("Duluth", "Minnesota"),      "320": (None, "Minnesota"),
    "507": (None, "Minnesota"),          "612": ("Minneapolis", "Minnesota"),
    "651": ("St. Paul", "Minnesota"),    "763": ("Minneapolis", "Minnesota"),
    "952": ("Minneapolis", "Minnesota"),
    # Mississippi
    "228": ("Gulfport", "Mississippi"),  "601": ("Jackson", "Mississippi"),
    "662": ("Tupelo", "Mississippi"),    "769": ("Jackson", "Mississippi"),
    # Missouri
    "314": ("St. Louis", "Missouri"),    "417": ("Springfield", "Missouri"),
    "573": ("Columbia", "Missouri"),     "636": ("St. Louis", "Missouri"),
    "660": (None, "Missouri"),           "816": ("Kansas City", "Missouri"),
    # Montana
    "406": ("Billings", "Montana"),
    # Nebraska
    "308": (None, "Nebraska"),           "402": ("Omaha", "Nebraska"),
    "531": ("Omaha", "Nebraska"),
    # Nevada
    "702": ("Las Vegas", "Nevada"),      "725": ("Las Vegas", "Nevada"),
    "775": ("Reno", "Nevada"),
    # New Hampshire
    "603": ("Manchester", "New Hampshire"),
    # New Jersey
    "201": ("Jersey City", "New Jersey"), "551": ("Jersey City", "New Jersey"),
    "609": ("Trenton", "New Jersey"),    "640": ("Trenton", "New Jersey"),
    "732": ("New Brunswick", "New Jersey"), "848": ("New Brunswick", "New Jersey"),
    "856": ("Camden", "New Jersey"),     "862": ("Newark", "New Jersey"),
    "908": ("Elizabeth", "New Jersey"),  "973": ("Newark", "New Jersey"),
    # New Mexico
    "505": ("Albuquerque", "New Mexico"), "575": (None, "New Mexico"),
    # New York
    "212": ("New York City", "New York"), "315": ("Syracuse", "New York"),
    "332": ("New York City", "New York"), "347": ("New York City", "New York"),
    "516": ("Hempstead", "New York"),    "518": ("Albany", "New York"),
    "585": ("Rochester", "New York"),    "607": ("Binghamton", "New York"),
    "631": ("Islip", "New York"),        "646": ("New York City", "New York"),
    "680": ("Syracuse", "New York"),     "716": ("Buffalo", "New York"),
    "718": ("New York City", "New York"), "838": ("Albany", "New York"),
    "845": ("Poughkeepsie", "New York"), "914": ("Yonkers", "New York"),
    "917": ("New York City", "New York"),"929": ("New York City", "New York"),
    # North Carolina
    "252": (None, "North Carolina"),     "336": ("Greensboro", "North Carolina"),
    "704": ("Charlotte", "North Carolina"), "743": ("Greensboro", "North Carolina"),
    "828": ("Asheville", "North Carolina"), "910": ("Wilmington", "North Carolina"),
    "919": ("Raleigh", "North Carolina"), "980": ("Charlotte", "North Carolina"),
    "984": ("Raleigh", "North Carolina"),
    # North Dakota
    "701": ("Fargo", "North Dakota"),
    # Ohio
    "216": ("Cleveland", "Ohio"),        "220": (None, "Ohio"),
    "234": ("Akron", "Ohio"),            "330": ("Akron", "Ohio"),
    "380": ("Columbus", "Ohio"),         "419": ("Toledo", "Ohio"),
    "440": ("Cleveland", "Ohio"),        "513": ("Cincinnati", "Ohio"),
    "567": ("Toledo", "Ohio"),           "614": ("Columbus", "Ohio"),
    "740": (None, "Ohio"),              "937": ("Dayton", "Ohio"),
    # Oklahoma
    "405": ("Oklahoma City", "Oklahoma"), "539": ("Tulsa", "Oklahoma"),
    "572": ("Oklahoma City", "Oklahoma"), "580": (None, "Oklahoma"),
    "918": ("Tulsa", "Oklahoma"),
    # Oregon
    "458": ("Eugene", "Oregon"),         "503": ("Portland", "Oregon"),
    "541": ("Eugene", "Oregon"),         "971": ("Portland", "Oregon"),
    # Pennsylvania
    "215": ("Philadelphia", "Pennsylvania"), "223": (None, "Pennsylvania"),
    "267": ("Philadelphia", "Pennsylvania"), "272": (None, "Pennsylvania"),
    "412": ("Pittsburgh", "Pennsylvania"),  "445": ("Philadelphia", "Pennsylvania"),
    "484": ("Philadelphia", "Pennsylvania"), "570": ("Scranton", "Pennsylvania"),
    "610": ("Philadelphia", "Pennsylvania"), "717": ("Lancaster", "Pennsylvania"),
    "724": ("Pittsburgh", "Pennsylvania"), "814": (None, "Pennsylvania"),
    "878": ("Pittsburgh", "Pennsylvania"),
    # Rhode Island
    "401": ("Providence", "Rhode Island"),
    # South Carolina
    "803": ("Columbia", "South Carolina"), "843": ("Charleston", "South Carolina"),
    "854": ("Charleston", "South Carolina"), "864": ("Greenville", "South Carolina"),
    # South Dakota
    "605": ("Sioux Falls", "South Dakota"),
    # Tennessee
    "423": ("Chattanooga", "Tennessee"), "615": ("Nashville", "Tennessee"),
    "629": ("Nashville", "Tennessee"),   "731": ("Jackson", "Tennessee"),
    "865": ("Knoxville", "Tennessee"),   "901": ("Memphis", "Tennessee"),
    "931": (None, "Tennessee"),
    # Texas
    "210": ("San Antonio", "Texas"),     "214": ("Dallas", "Texas"),
    "254": ("Waco", "Texas"),            "281": ("Houston", "Texas"),
    "325": (None, "Texas"),             "346": ("Houston", "Texas"),
    "361": ("Corpus Christi", "Texas"),  "409": ("Beaumont", "Texas"),
    "430": ("Tyler", "Texas"),           "432": ("Midland", "Texas"),
    "469": ("Dallas", "Texas"),          "512": ("Austin", "Texas"),
    "682": ("Fort Worth", "Texas"),      "713": ("Houston", "Texas"),
    "737": ("Austin", "Texas"),          "806": ("Lubbock", "Texas"),
    "817": ("Fort Worth", "Texas"),      "830": ("San Antonio", "Texas"),
    "832": ("Houston", "Texas"),         "903": ("Tyler", "Texas"),
    "915": ("El Paso", "Texas"),         "936": ("Conroe", "Texas"),
    "940": ("Denton", "Texas"),          "956": ("Laredo", "Texas"),
    "972": ("Dallas", "Texas"),          "979": ("College Station", "Texas"),
    # Utah
    "385": ("Salt Lake City", "Utah"),   "435": (None, "Utah"),
    "801": ("Salt Lake City", "Utah"),
    # Vermont
    "802": ("Burlington", "Vermont"),
    # Virginia
    "276": (None, "Virginia"),           "434": ("Charlottesville", "Virginia"),
    "540": ("Roanoke", "Virginia"),      "571": ("Arlington", "Virginia"),
    "703": ("Arlington", "Virginia"),    "757": ("Norfolk", "Virginia"),
    "804": ("Richmond", "Virginia"),
    # Washington
    "206": ("Seattle", "Washington"),    "253": ("Tacoma", "Washington"),
    "360": ("Vancouver", "Washington"),  "425": ("Bellevue", "Washington"),
    "509": ("Spokane", "Washington"),    "564": ("Vancouver", "Washington"),
    # West Virginia
    "304": ("Charleston", "West Virginia"), "681": (None, "West Virginia"),
    # Wisconsin
    "262": ("Waukesha", "Wisconsin"),    "414": ("Milwaukee", "Wisconsin"),
    "534": (None, "Wisconsin"),          "608": ("Madison", "Wisconsin"),
    "715": (None, "Wisconsin"),          "920": ("Green Bay", "Wisconsin"),
    # Wyoming
    "307": ("Cheyenne", "Wyoming"),
}


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def extract_location(text: str) -> LocationResult | None:
    """Extract the candidate's primary location from resume text.

    Search strategy (in priority order):
    1. Header / contact section only (first ~30 lines or up to first
       section heading)  — prevents Skills / Experience pollution.
    2. Each header line is tested with ``_try_parse_line()``.
    3. Skill-context guard rejects any city preceded by a tech/tool token.
    4. spaCy GPE NER on the header text as a secondary pass (if available).

    Returns the first high-confidence result, or the best available, or None.
    """
    if not text:
        return None

    header_lines = _get_header_lines(text)
    header_text = "\n".join(ln for ln in header_lines if ln)

    # ── Pass 1 : line-by-line regex ───────────────────────────────────────────
    high: list[LocationResult] = []
    medium: list[LocationResult] = []

    for ln in header_lines:
        if not ln:
            continue
        r = _try_parse_line(ln)
        if r is None:
            continue
        if r["confidence"] == "high":
            high.append(r)
        else:
            medium.append(r)

    if high:
        return _deduplicate(high)[0]
    if medium:
        return _deduplicate(medium)[0]

    # ── Pass 2 : spaCy GPE on header block ────────────────────────────────────
    nlp = _load_spacy()
    if nlp and header_text.strip():
        try:
            doc = nlp(header_text[:512])
            for ent in doc.ents:
                if ent.label_ != "GPE":
                    continue
                ent_text = ent.text.strip()
                # Guard: reject if the token before this entity is a skill
                start_char = ent.start_char
                if _preceding_token_is_skill(header_text, start_char):
                    continue
                if _is_us_state(ent_text):
                    return LocationResult(
                        city=None,
                        state=_expand_state(ent_text),
                        country="United States",
                        confidence="medium",
                        source="header_spacy",
                    )
                if _is_plausible_city(ent_text):
                    return LocationResult(
                        city=ent_text.title(),
                        state=None,
                        country=None,
                        confidence="low",
                        source="header_spacy",
                    )
        except Exception:
            pass

    return None


def detect_location_from_phone(phone: str) -> LocationResult | None:
    """Map a phone number's NANP area code to a US city + state.

    Returns a LocationResult with ``confidence="low"`` and
    ``source="phone_area_code"``, or None if the area code cannot be mapped.
    """
    if not phone:
        return None
    digits = re.sub(r"\D+", "", str(phone))
    if not digits:
        return None

    # Normalise to national number (strip +1 or leading 1 for 11-digit NANP)
    national = digits
    if len(digits) == 11 and digits.startswith("1"):
        national = digits[1:]
    if len(national) < 10:
        return None

    area = national[:3]
    if area not in _AREA_CODE_MAP:
        return None

    city_raw, state_full = _AREA_CODE_MAP[area]
    return LocationResult(
        city=city_raw,
        state=state_full,
        country="United States",
        confidence="low",
        source="phone_area_code",
    )


def detect_location_with_fallback(
    text: str,
    phone: str | None = None,
) -> LocationResult:
    """Primary entry point for resume location extraction.

    Cascading strategy:
    1. ``extract_location(text)``           — header-only, high/medium confidence
    2. Regex scan of the full first page    — still guarded by skill-context check
    3. ``detect_location_from_phone(phone)`` — last resort, low confidence
    4. Empty LocationResult                 — if all else fails

    Returns exactly ONE LocationResult (never duplicates).
    """
    # ── Tier 1 : header section ───────────────────────────────────────────────
    result = extract_location(text)
    if result and result["confidence"] in ("high", "medium"):
        return result

    # ── Tier 2 : full first-page regex (still skill-context guarded) ──────────
    # Limit to first ~150 lines to avoid scanning the entire resume.
    # Stop at any section heading that indicates we're deep into skills/experience.
    all_lines = text.split("\n") if text else []
    HARD_LIMIT = 150
    scan_lines: list[str] = []
    for ln in all_lines[:HARD_LIMIT]:
        stripped = ln.strip()
        # Stop once a skills or experience section starts (same regex as _get_header_lines)
        if stripped and len(stripped) < 70 and _SECTION_HEADING_RE.match(stripped):
            break
        scan_lines.append(stripped)

    for ln in scan_lines:
        if not ln:
            continue
        r = _try_parse_line(ln)
        if r and r["city"] and r["state"]:
            r["confidence"] = "medium"
            r["source"] = "fulltext_regex"
            return r

    # Tier-1 low (header regex found something but just country / state-only)
    if result:
        return result

    # ── Tier 3 : phone area code ──────────────────────────────────────────────
    if phone:
        phone_result = detect_location_from_phone(phone)
        if phone_result:
            return phone_result

    # ── Tier 4 : nothing found ────────────────────────────────────────────────
    return _empty_result()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _deduplicate(results: list[LocationResult]) -> list[LocationResult]:
    """Remove duplicate results keeping the first occurrence of each unique
    (city, state) combination."""
    seen: set[tuple[str | None, str | None]] = set()
    out: list[LocationResult] = []
    for r in results:
        key = (
            (r.get("city") or "").casefold(),
            (r.get("state") or "").casefold(),
        )
        if key not in seen:
            seen.add(key)
            out.append(r)
    return out


def location_result_to_string(r: LocationResult) -> str:
    """Format a LocationResult as a flat "City, State, Country" string
    for backward-compatibility with the ``extract_address()`` flat-string API.
    """
    parts = [p for p in [r.get("city"), r.get("state"), r.get("country")] if p]
    return ", ".join(parts)
