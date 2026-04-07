"""
validation_layer.py  -  v2  (NLP-enhanced)
==========================================
Post-processing validation and cleaning layer for extracted resume fields.

Key design rules:
  * Do NOT touch extraction functions - only run AFTER extraction.
  * Prefer NULL over wrong data; optimise for precision.
  * Never hallucinate or infer missing information.
  * spaCy NER is used when available; degrades gracefully without it.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Optional, Tuple

# ---------------------------------------------------------------------------
# Optional spaCy NER (name & location hints)
# ---------------------------------------------------------------------------
try:
    import spacy as _spacy                               # type: ignore
    _NLP = _spacy.load("en_core_web_sm")
    _SPACY_AVAILABLE = True
except Exception:
    _NLP = None
    _SPACY_AVAILABLE = False


def _cf(s: str) -> str:
    """Casefold + strip."""
    return (s or "").casefold().strip()


# ===========================================================================
# Reference data
# ===========================================================================

_US_STATES: frozenset = frozenset({
    "alabama","alaska","arizona","arkansas","california","colorado",
    "connecticut","delaware","florida","georgia","hawaii","idaho",
    "illinois","indiana","iowa","kansas","kentucky","louisiana",
    "maine","maryland","massachusetts","michigan","minnesota",
    "mississippi","missouri","montana","nebraska","nevada",
    "new hampshire","new jersey","new mexico","new york",
    "north carolina","north dakota","ohio","oklahoma","oregon",
    "pennsylvania","rhode island","south carolina","south dakota",
    "tennessee","texas","utah","vermont","virginia","washington",
    "west virginia","wisconsin","wyoming","district of columbia",
    "al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","in",
    "ia","ks","ky","la","me","md","ma","mi","mn","ms","mo","mt","ne","nv",
    "nh","nj","nm","ny","nc","nd","oh","ok","or","pa","ri","sc","sd","tn",
    "tx","ut","vt","va","wa","wv","wi","wy","dc",
})

_COUNTRIES: frozenset = frozenset({
    "united states","usa","us","united kingdom","uk","canada","australia",
    "india","germany","france","spain","italy","netherlands","sweden",
    "norway","denmark","finland","switzerland","austria","belgium",
    "portugal","ireland","new zealand","singapore","malaysia","indonesia",
    "philippines","thailand","vietnam","south korea","japan","china",
    "hong kong","taiwan","united arab emirates","uae","saudi arabia",
    "qatar","bahrain","kuwait","oman","israel","turkey","south africa",
    "nigeria","kenya","ghana","egypt","brazil","mexico","argentina",
    "chile","colombia","peru","venezuela","pakistan","bangladesh",
    "sri lanka","nepal","ethiopia","tanzania","uganda","cameroon",
    "ivory coast","senegal","morocco","algeria","tunisia","libya",
    "jordan","lebanon","iraq","iran","russia","ukraine","poland",
    "czech republic","hungary","romania","bulgaria","serbia","croatia",
    "slovakia","slovenia","greece","cyprus",
})

# Major Indian cities - very common in tech resumes
_INDIAN_CITIES: frozenset = frozenset({
    "hyderabad","bangalore","bengaluru","mumbai","chennai","pune","delhi",
    "new delhi","noida","gurgaon","gurugram","kolkata","ahmedabad","jaipur",
    "chandigarh","coimbatore","kochi","cochin","thiruvananthapuram","trivandrum",
    "nagpur","surat","visakhapatnam","vizag","indore","bhopal","vadodara",
    "lucknow","kanpur","patna","bhubaneswar","raipur","ranchi",
    "mysore","mysuru","hubli","mangalore","mangaluru","salem","tiruchirappalli",
    "madurai","vijayawada","guntur","warangal","nellore","rajkot",
    "amritsar","ludhiana","agra","meerut","varanasi","allahabad","prayagraj",
    "secunderabad","ghaziabad","faridabad","srinagar","jammu","dehradun",
    "haridwar","rishikesh","jodhpur","udaipur","ajmer","nashik",
})

# Spot-check major world cities
_MAJOR_CITIES: frozenset = frozenset({
    "new york","los angeles","chicago","houston","phoenix","philadelphia",
    "san antonio","san diego","dallas","san jose","austin","jacksonville",
    "san francisco","columbus","fort worth","charlotte","indianapolis",
    "seattle","denver","boston","nashville","portland","las vegas",
    "memphis","louisville","baltimore","atlanta","milwaukee","albuquerque",
    "tucson","fresno","sacramento","mesa","kansas city","omaha","raleigh",
    "miami","cleveland","minneapolis","tampa","orlando","st. louis",
    "london","toronto","sydney","melbourne","berlin","paris","amsterdam",
    "dubai","singapore","tokyo","shanghai","beijing",
})

_ALL_GEO: frozenset = _US_STATES | _COUNTRIES | _INDIAN_CITIES | _MAJOR_CITIES

# Pre-compiled word-boundary pattern for geo lookup (much faster than repeated
# substring-in-string checks, and avoids false positives like "in" ⊆ "invalid").
_GEO_PATTERN: re.Pattern = re.compile(
    r"\b(" + "|".join(re.escape(g) for g in sorted(_ALL_GEO, key=len, reverse=True)) + r")\b",
    re.IGNORECASE,
)

# Company-suffix patterns - should never appear in a real location
_COMPANY_SUFFIXES: re.Pattern = re.compile(
    r"\b(inc|llc|ltd|pvt|corp|corporation|co\.|company|group|technologies|"
    r"solutions|services|systems|consulting|enterprises|associates|"
    r"partners|limited|private\s+limited|plc|gmbh|ag|sa|srl|bv|nv)\b",
    re.IGNORECASE,
)

# Technology / tool tokens that cannot be location names.
# Also includes common org/doc-artifact words that appear as fake city prefixes
# (e.g. "Entity Framework, Mississippi" or "Clients. Plano, Texas").
_TECH_TOKENS: frozenset = frozenset({
    "python","java","javascript","typescript","react","angular","vue",
    "node","nodejs","express","django","flask","fastapi","spring",
    "hibernate","sql","mysql","postgresql","mongodb","redis","kafka",
    "docker","kubernetes","aws","azure","gcp","git","linux","unix",
    "windows","macos","android","ios","html","css","sass","graphql",
    "rest","soap","api","ci","cd","jenkins","terraform","ansible",
    "hadoop","spark","tableau","powerbi","excel","access","sap",
    "salesforce","jira","confluence","agile","scrum","kanban",
    "tensorflow","pytorch","keras","sklearn","pandas","numpy","selenium",
    "postman","figma","sketch","photoshop","illustrator",
    "machine learning","deep learning","nlp","ai","power bi",
    "ms office","microsoft office","ms excel","ms word",
    # .NET / web framework tokens that commonly prefix US cities in resume headers
    "entity","framework",".net","dotnet","mvc","wpf","blazor","xaml",
    # Org words that appear before real cities ("Abbott Laboratories, KS")
    "abbott","laboratories","laboratory","virtusa","staffing",
    "infosys","wipro","tcs","cognizant","capgemini",
    # Document / project artifact words ("Clients. Plano, TX")
    "clients","client","employers","employer",
})

# Employment context words - indicate work history, NOT residence
_EMPLOYMENT_CONTEXT: re.Pattern = re.compile(
    r"\b(worked\s+at|joined|employed|employment|employer|organization|"
    r"corporation|office|branch|campus|headquarters?|hq)\b",
    re.IGNORECASE,
)

# Experience section headers
_EXPERIENCE_HEADERS: re.Pattern = re.compile(
    r"^(work\s+experience|professional\s+experience|employment\s+history|"
    r"experience|career\s+history|work\s+history|relevant\s+experience|"
    r"professional\s+background|job\s+history)\s*[:\-]?\s*$",
    re.IGNORECASE | re.MULTILINE,
)

# Bare degree words with NO domain
_BARE_DEGREE_RE: re.Pattern = re.compile(
    r"^(bachelor\'?s?|master\'?s?|doctorate|phd|ph\.d\.?|associate\'?s?|"
    r"diploma|degree|b\.?a\.?|b\.?s\.?|b\.?e\.?|b\.?tech\.?|"
    r"m\.?a\.?|m\.?s\.?|m\.?e\.?|m\.?tech\.?|mba|m\.?b\.?a\.?|"
    r"b\.?c\.?a\.?|m\.?c\.?a\.?|b\.?s\.?c\.?|m\.?s\.?c\.?)\s*$",
    re.IGNORECASE,
)

# Explicit application phrases (used as a bonus signal)
_APPLICATION_PHRASES: re.Pattern = re.compile(
    r"\b(applying\s+for|applied\s+for|seeking|looking\s+for|"
    r"position\s*:|role\s*:|objective\s*:|career\s+objective|"
    r"professionally\s+seeking|interested\s+in\s+(?:the\s+)?(?:position|role|opportunity))\b",
    re.IGNORECASE,
)

# Role signal - must appear in a real job title
_ROLE_SIGNAL: re.Pattern = re.compile(
    r"\b(developer|engineer|analyst|architect|consultant|tester|"
    r"administrator|specialist|devops|sre|manager|intern|sde|sdet|"
    r"data\s+scientist|data\s+engineer|full\s*stack|frontend|backend|"
    r"front\s+end|back\s+end|product\s+manager|project\s+manager|"
    r"program\s+manager|business\s+analyst|etl\s+developer|etl\s+engineer|"
    r"scrum\s+master|product\s+owner|qa\s+engineer|qa\s+tester|qa\s+lead|"
    r"lead|director|head\s+of|coordinator|owner|"
    r"principal\s+engineer|staff\s+engineer|cloud\s+engineer|"
    r"data\s+architect|solutions\s+architect|security\s+engineer|"
    r"technical\s+lead|team\s+lead|tech\s+lead|delivery\s+manager|"
    r"dba|database\s+administrator|network\s+engineer|"
    r"automation\s+engineer|test\s+engineer|infrastructure\s+engineer|"
    r"ux\s+designer|ui\s+designer|technical\s+writer|"
    # Additional common roles
    r"recruiter|trainer|officer|strategist|designer|researcher|"
    r"scientist|programmer|technician|supervisor|"
    r"vice\s+president|vp|cto|cio|ceo|cfo|"
    r"presales|pre\s*sales|account\s+manager|sales\s+manager|"
    r"it\s+recruiter|technical\s+recruiter|hr\s+manager)\b",
    re.IGNORECASE,
)

# Tokens that are NEVER part of a person's name
_BAD_NAME_WORDS: frozenset = frozenset({
    "resume","cv","curriculum","vitae","biodata","profile",
    "document","page","candidate","applicant","name","apply",
    "submission","submitted","attached","attaching","revised",
    "updated","latest","new","final","draft","copy","gmail",
    "yahoo","hotmail","outlook","linkedin","github",
    # Contact labels that sometimes survive stripping and bleed into name fields.
    "email","phone","mobile","location","address","contact",
    # Common English words that appear near names in resume headers.
    "remote","work","hybrid","onsite","contract","freelance",
    "requisition","position","available","immediate","joiner",
    "loved","ones","dear","hiring","company","team","notice",
    # Partial DevOps split / employment-type / junk tokens.
    # NOTE: _BAD_NAME_WORDS uses SUBSTRING matching, so only add long/unambiguous
    # tokens here.  Short tokens like "ai", "dev", "job" must go in _ROLE_TOKENS
    # (exact match) instead to avoid false positives on "Sai", "Devin", etc.
    "full-time","part-time","fulltime","parttime",
    "description","conducted","comprehensive","responsible",
})

_ROLE_TOKENS: frozenset = frozenset({
    "developer","engineer","analyst","architect","consultant","tester",
    "qa","manager","administrator","specialist","lead","intern","senior",
    "junior","data","net","software","development","solutions","operations",
    "stack","full","backend","frontend","java","python","react","angular",
    "node","nodejs","aws","azure","dotnet","spark","hive",
    # Tech compound-word components that NER can mistake for person-name tokens.
    "web","based","machine","learning","cloud","watch","entity","framework",
    "reduce","map","intranet","extranet","portal","platform",
    "server","client","service","system","database","network",
    # Civil-status / immigration tokens.
    "citizen","permanent","resident","authorized","authorization",
    # Common role abbreviations.
    "fsd",
    # Microsoft / web tech tokens.
    "asp","mvc","visual","studio",
    # Tokens that were slipping through validation.
    "ops","devops","devsecops","sre","mlops","engineering",
    "de","da","se","sde","sdet",
    "us","usa","uk","uae",
    "remote","work","hybrid","onsite","contract","freelance",
    "requisition","programmer","designer","trainer","recruiter",
    "coordinator","officer","strategist","technician","researcher",
    "hadoop","kafka","tableau","power","bi","etl","sap","oracle",
    "salesforce","sharepoint","pipeline","warehouse",
    # Partial DevOps split / employment-type tokens.
    "dev","time","full-time","part-time","fulltime","parttime","wells",
    "ai","job","description","conducted","comprehensive","responsible",
    # Common English words never used as names.
    "and","the","for","with","scripts","day",
    "troubleshoot","issues","implement","maintain","deploy","monitor",
    "configure","ensure","support","manage","collaborate",
})

_NAME_HONORIFICS: re.Pattern = re.compile(
    r"^(mr\.?|ms\.?|mrs\.?|dr\.?|prof\.?|er\.?)\s+",
    re.IGNORECASE,
)


# ===========================================================================
# 1. NAME VALIDATION
# ===========================================================================

def validate_name(
    first_name: Optional[str],
    last_name: Optional[str],
) -> Tuple[Optional[str], Optional[str]]:
    """
    Multi-layer name validation: pattern rules + optional spaCy NER.

    Returns (first_name, last_name) if valid, else (None, None).
    Never infers or corrects the name.

    Catches:
      - "Candidate #2471"  (digit + bad word)
      - "Tejayv @gmail"    (@-sign)
      - "Bhagya Netresume" (contains "resume")
      - "Sai @gmail"       (@-sign)
      - "john doe"         (all lowercase)
      - All-upper-case tokens longer than 3 chars (likely section headers)
    """
    fn = (first_name or "").strip()
    ln = (last_name or "").strip()

    if not fn:
        return None, None

    # Strip honorifics
    fn = _NAME_HONORIFICS.sub("", fn).strip()
    ln = _NAME_HONORIFICS.sub("", ln).strip()

    combined = f"{fn} {ln}".strip()

    # --- Hard rejects ---

    # Email / domain artifacts
    if "@" in combined:
        return None, None
    if re.search(r"\.(com|net|org|io|co|in)\b", combined, re.IGNORECASE):
        return None, None

    # Digits anywhere in the name
    if re.search(r"\d", combined):
        return None, None

    # Disallowed special characters (allow only hyphens, apostrophes, periods)
    if re.search(r"[^A-Za-z\s\-\'\.]", combined):
        return None, None

    # Non-ASCII content that doesn't normalise cleanly
    try:
        combined.encode("ascii")
    except UnicodeEncodeError:
        normalised = unicodedata.normalize("NFKD", combined).encode("ascii", "ignore").decode()
        if len(normalised.strip()) < len(combined.strip()) * 0.70:
            return None, None

    # --- Token-level checks ---
    tokens = combined.split()
    if not tokens:
        return None, None

    # Too many tokens -> likely a sentence or skill list
    if len(tokens) > 5:
        return None, None

    for i, tok in enumerate(tokens):
        tok_lower = _cf(tok)
        alpha = re.sub(r"[^A-Za-z]", "", tok)
        is_last_token = (i == len(tokens) - 1)

        # Bad-word substring (catches "Netresume", "Biodata", "Candidate", "gmail")
        if any(bad in tok_lower for bad in _BAD_NAME_WORDS):
            return None, None

        # Role / skill tokens are never name tokens
        if tok_lower in _ROLE_TOKENS:
            return None, None
        # Handle hyphenated tokens: check each sub-part against role tokens.
        # E.g. "Full-time" → check "full" and "time".
        if "-" in tok_lower:
            if any(sub in _ROLE_TOKENS for sub in tok_lower.split("-") if sub):
                return None, None

        # Single-letter token: allowed as a last-position initial (South Asian naming
        # convention e.g. "Akhil D", "Keerthi K") but not allowed elsewhere.
        if len(alpha) == 1:
            if is_last_token and i >= 1:
                # Accept single-letter initial as the last token: preserve it as
                # last_name (South Asian naming convention: "Harsha K", "Akhil D").
                # ln is already set from the input — just break to accept as-is.
                break
            else:
                return None, None

        # Empty alpha after stripping
        if len(alpha) < 2:
            return None, None

        # Too long for a real name token
        if len(tok) > 30:
            return None, None

        # All-lowercase -> not a proper name
        if alpha and alpha == alpha.lower():
            return None, None

        # All-uppercase AND length > 3 -> likely header/acronym, not a name
        if alpha == alpha.upper() and len(alpha) > 3:
            return None, None

    # First token must start with uppercase
    if fn and not fn[0].isupper():
        return None, None

    # First name must have at least 2 alphabetic characters
    fn_alpha = re.sub(r"[^A-Za-z]", "", fn)
    if len(fn_alpha) < 2:
        return None, None

    # --- spaCy NER cross-check (soft gate) ---
    # NOTE: spaCy en_core_web_sm frequently misclassifies South Asian /
    # East Asian personal names as ORG (e.g. "Bhagya Lakshmi" → ORG).
    # Short name strings (≤ 3 tokens) that already passed all pattern-based
    # checks above are very likely real person names, so we only reject when
    # the string is longer (more likely a sentence / company name) and spaCy
    # confirms the ORG classification.
    if _SPACY_AVAILABLE and _NLP is not None:
        try:
            doc = _NLP(combined[:200])
            ents = [e for e in doc.ents]
            person_ents = [e for e in ents if e.label_ == "PERSON"]
            org_product_ents = [e for e in ents if e.label_ in ("ORG", "PRODUCT", "WORK_OF_ART")]
            # If no PERSON entity found but ORG/PRODUCT found -> reject,
            # BUT only for longer strings (> 3 tokens).  Short title-cased
            # name strings pass through even if spaCy misclassifies them.
            if not person_ents and org_product_ents and len(tokens) > 3:
                return None, None
        except Exception:
            pass  # NER errors are non-fatal

    # Accept
    clean_fn = fn if fn else None
    clean_ln = ln if ln else None
    return clean_fn, clean_ln


# ===========================================================================
# 2. LOCATION VALIDATION
# ===========================================================================

def validate_location(location_string: Optional[str]) -> Optional[str]:
    """
    Validate an extracted location using geo-database + spaCy GPE entities.

    Returns the location string if it represents a real geographical place,
    else None.  Never guesses or infers.

    Catches:
      - "Access, Mississippi, United States"  (Access = MS Access tool)
      - "Infosys Pvt Ltd, Hyderabad"          (company suffix)
      - "Python, Django"                      (tech tokens)
    """
    if not location_string:
        return None

    loc = location_string.strip()
    if not loc or len(loc) < 3:
        return None

    # Hard rejects
    if _COMPANY_SUFFIXES.search(loc):
        return None
    if _EMPLOYMENT_CONTEXT.search(loc):
        return None
    if "@" in loc or re.search(r"https?://|www\.", loc, re.IGNORECASE):
        return None

    # Tokenise on separators
    raw_tokens = [t.strip() for t in re.split(r"[,|/\n;]", loc) if t.strip()]
    tokens_cf  = [_cf(t) for t in raw_tokens]

    # ── Tech-word guard with first-segment salvage ─────────────────────────
    # Strip punctuation before matching so "clients." still hits "clients".
    def _word_has_tech(word: str) -> bool:
        clean = re.sub(r"[^a-z0-9]", "", word.casefold())
        return clean in _TECH_TOKENS or word.casefold() in _TECH_TOKENS

    def _seg_has_tech(seg_cf: str) -> bool:
        return any(_word_has_tech(w) for w in seg_cf.split())

    bad_idx = [i for i, tok in enumerate(tokens_cf) if _seg_has_tech(tok)]
    if bad_idx:
        # If ONLY the first segment is bad and ≥2 segments remain, strip it.
        # Try to salvage clean words within the first segment so we don't
        # lose the real city (e.g. "Clients. Plano" → keep "Plano").
        if bad_idx == [0] and len(raw_tokens) >= 2:
            first_words = raw_tokens[0].split()
            salvaged = [
                w for w in first_words
                if not _word_has_tech(w)
                and len(re.sub(r"[^a-z]", "", w.casefold())) >= 2
            ]
            if salvaged:
                raw_tokens[0] = " ".join(salvaged)
                tokens_cf[0]  = _cf(" ".join(salvaged))
            else:
                raw_tokens = raw_tokens[1:]
                tokens_cf  = tokens_cf[1:]
            loc = ", ".join(raw_tokens)
        else:
            return None

    # spaCy GPE / LOC entity assist
    spacy_geo_found = False
    if _SPACY_AVAILABLE and _NLP is not None:
        try:
            doc = _NLP(loc[:300])
            if any(e.label_ in {"GPE", "LOC", "FAC"} for e in doc.ents):
                spacy_geo_found = True
            # ORG entity with no GPE/LOC -> probably a company, not a location
            if (any(e.label_ == "ORG" for e in doc.ents)
                    and not spacy_geo_found):
                return None
        except Exception:
            pass

    # Geo-database lookup (word-boundary aware — avoids "in" matching "invalid")
    loc_lower = loc.lower()
    has_known_geo = (
        spacy_geo_found
        or bool(_GEO_PATTERN.search(loc_lower))
    )

    if not has_known_geo:
        # Last chance: "TitleCase City, TitleCase State/Country" pattern
        if re.match(
            r"^[A-Z][a-zA-Z\s\-]{1,40},\s*[A-Z][a-zA-Z\s]{1,40}$",
            loc.strip(),
        ):
            has_known_geo = True

    return loc if has_known_geo else None


# ===========================================================================
# 3. DEGREE / QUALIFICATION VALIDATION
# ===========================================================================

def validate_degree(degree: Optional[str]) -> Optional[str]:
    """
    Accept degree strings that contain BOTH a degree type AND a domain.

    Returns None for bare generic strings like "Bachelor's Degree" or "Master".
    Never infers the missing domain.

    Valid examples:
      Bachelor of Science in Computer Science
      M.S. Computer Engineering
      MBA Finance
      B.Tech Information Technology
      MCA Computer Applications
    """
    if not degree:
        return None

    deg = degree.strip()
    if len(deg) < 4:
        return None

    # Reject bare degree word with no domain
    if _BARE_DEGREE_RE.fullmatch(deg.rstrip(".")):
        return None

    # Pattern 1: "Bachelor of Science in Computer Science"
    has_in_domain     = bool(re.search(r"\bin\b\s+\w{3,}", deg, re.IGNORECASE))

    # Pattern 2: "M.S. Computer Engineering" / "B.Tech Electronics"
    has_direct_domain = bool(re.search(
        r"\b(b\.?s\.?|b\.?a\.?|b\.?e\.?|b\.?tech\.?|b\.?c\.?a\.?|b\.?s\.?c\.?|"
        r"m\.?s\.?|m\.?a\.?|m\.?e\.?|m\.?tech\.?|m\.?c\.?a\.?|m\.?s\.?c\.?|"
        r"phd|ph\.?d\.?|mba|m\.?b\.?a\.?)\s+[A-Za-z]{3,}",
        deg, re.IGNORECASE,
    ))

    # Pattern 3: "Bachelor of <discipline>"
    has_of_domain     = bool(re.search(r"\bof\b\s+[A-Za-z]{3,}", deg, re.IGNORECASE))

    # Pattern 4: Indian abbreviation + field ("MBA Finance", "MCA Computer Applications")
    has_abbrev_domain = bool(re.search(
        r"\b(mba|mca|bca|bsc|msc|btech|mtech|be|me|bcom|mcom|bba|pgdm)\s+[A-Za-z]{3,}",
        deg, re.IGNORECASE,
    ))

    # Pattern 5: Known standalone degree labels that are acceptable without a domain
    # e.g. "Associate Degree", "Associate/Diploma", "Bachelor's Degree", "Master's Degree"
    is_known_label = bool(re.search(
        r"(?i)\b(associate'?s?\s+degree|associate\s*/\s*diploma|"
        r"bachelor'?s?\s+degree|master'?s?\s+degree|"
        r"bachelor\s+of\s+science|bachelor\s+of\s+arts|"
        r"bachelor\s+of\s+commerce|master\s+of\s+science)\b",
        deg,
    ))

    return deg if (has_in_domain or has_direct_domain or has_of_domain or has_abbrev_domain or is_known_label) else None


# ===========================================================================
# 4. APPLIED JOB TITLE VALIDATION  (position-aware NLP approach)
# ===========================================================================

def validate_applied_title(
    title: Optional[str],
    resume_text: Optional[str],
) -> Optional[str]:
    """
    Validate an extracted job title using position-aware logic.

    Accept if:
      - Title appears in the TOP 35% of the resume (header / objective area), OR
      - An explicit application phrase is present anywhere, OR
      - Title is structurally clean and no experience section was found.

    Reject if:
      - No role signal (not a real job title),
      - Too long / looks like a responsibility sentence,
      - Title appears ONLY inside the experience section (past role, not applied role).

    Does NOT require "Seeking / Applying for" — most resumes don't use those words.
    """
    if not title:
        return None

    title_s = title.strip()
    if not title_s:
        return None

    # Must contain a role signal
    if not _ROLE_SIGNAL.search(title_s):
        return None

    # Reject overly long strings (responsibility sentences).
    # For pipe-separated multi-title strings like
    # "Full Stack Developer | Java Developer | Cloud Engineer",
    # check the longest *individual* segment rather than the whole string.
    if "|" in title_s:
        _longest_seg = max(
            (seg.strip() for seg in title_s.split("|")),
            key=lambda s: len(s.split()),
        )
        word_count = len(_longest_seg.split())
    else:
        word_count = len(title_s.split())
    if word_count > 10:
        return None

    # Reject skill-list-like strings
    if title_s.count(",") >= 2 or ";" in title_s:
        return None

    # Reject responsibility verb fragments
    if re.search(
        r"\b(responsible|implemented|developed|built|led|managed|"
        r"utilizing|leveraging|designed|deployed|maintained|"
        r"collaborated|worked\s+on|working\s+on|experienced\s+in)\b",
        title_s, re.IGNORECASE,
    ):
        return None

    if not resume_text:
        return title_s  # no context -> accept structurally plausible title

    title_cf    = title_s.lower()
    # Also create a no-space variant for matching glued PDF text
    # e.g. "Senior Android Developer" -> "seniorandroiddeveloper"
    title_cf_nospace = re.sub(r"\s+", "", title_cf)
    text_lines  = resume_text.splitlines()
    total_lines = max(len(text_lines), 1)

    # Find first occurrence of title in document (with and without spaces)
    first_occ: Optional[int] = None
    for i, line in enumerate(text_lines):
        ll = line.lower()
        ll_nospace = re.sub(r"\s+", "", ll)
        if title_cf in ll or title_cf_nospace in ll_nospace:
            first_occ = i
            break

    # Find start of experience section
    exp_start: Optional[int] = None
    for i, line in enumerate(text_lines):
        if _EXPERIENCE_HEADERS.match(line.strip()):
            exp_start = i
            break

    # ---- Decision logic ----

    # Title in top 35% of document -> header / objective area -> accept
    if first_occ is not None and first_occ < total_lines * 0.35:
        return title_s

    # Explicit application phrase present anywhere -> accept
    if _APPLICATION_PHRASES.search(resume_text):
        return title_s

    # Title not found in document -> cannot verify -> accept (parser already extracted it)
    if first_occ is None:
        return title_s

    # Title appears ONLY after the experience section header -> past role -> reject
    if exp_start is not None and first_occ > exp_start:
        # Double-check: is there also a mention BEFORE the exp section?
        pre_exp = "\n".join(text_lines[:exp_start]).lower()
        pre_exp_nospace = re.sub(r"\s+", "", pre_exp)
        if title_cf not in pre_exp and title_cf_nospace not in pre_exp_nospace:
            return None

    # Default: accept
    return title_s


# ===========================================================================
# 5. CONFIDENCE SCORING
# ===========================================================================

def get_confidence(value: Optional[str], field: str) -> float:
    """
    Confidence score after validation.

    1.0  - present and well-formed
    0.8  - present but borderline
    0.6  - minimal indicators
    0.0  - rejected (None)
    """
    if value is None:
        return 0.0

    v = value.strip()

    if field == "name":
        return 1.0 if len(v.split()) >= 2 else 0.8

    if field == "location":
        return 1.0 if "," in v else 0.8

    if field == "degree":
        return 1.0 if re.search(r"\bin\b", v, re.IGNORECASE) else 0.8

    if field == "job_title":
        wc = len(v.split())
        return 1.0 if 2 <= wc <= 6 else 0.6

    return 0.8
