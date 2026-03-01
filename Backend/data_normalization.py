"""
data_normalization.py
─────────────────────
Shared canonicalization & education-extraction helpers used by parser.py.

Improvements over original:
  • extract_qualification – handles "Msc" / "Btech" without explicit major,
    normalises "B.E in B.e Computer Science" duplication, falls back to
    degree-only label when no plausible major is found.
  • canonicalize_job_title – unchanged (stable API).
  • canonicalize_skill_list – unchanged (stable API).
"""

import re
import unicodedata
from typing import Iterable

# education_parser provides the richer structured path;
# imported here so callers can do `from data_normalization import parse_education_section`
try:
    from education_parser import (                              # noqa: F401
        detect_degree_level,
        normalize_degree,
        extract_specialization,
        extract_university,
        parse_education_section,
        education_to_flat_string,
        EducationEntry,
    )
    _EDUCATION_PARSER_AVAILABLE = True
except ImportError:
    _EDUCATION_PARSER_AVAILABLE = False


# ─────────────────────────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────────────────────────

def normalize_spaces(value: str) -> str:
    """Collapse internal whitespace and trim leading/trailing spaces."""
    return re.sub(r"\s+", " ", (value or "").strip())


def _dedupe_preserve_order(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for v in values:
        k = v.casefold()
        if not k or k in seen:
            continue
        seen.add(k)
        out.append(v)
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Job-title canonicalization
# ─────────────────────────────────────────────────────────────────────────────

def canonicalize_job_title(title: str) -> str:
    """Normalize common abbreviations and dedupe slash-separated variants.

    Example: "Senior Data Engineer /Sr Data Engineer" -> "Senior Data Engineer"
    """
    title = normalize_spaces(title)
    if not title:
        return ""

    # Normalize pipe separators to slash for consistent multi-role display
    # e.g. "Cloud Engineer | DevOps Engineer" → "Cloud Engineer / DevOps Engineer"
    title = re.sub(r"\s*\|\s*", " / ", title)
    title = normalize_spaces(title)

    raw_parts = [normalize_spaces(p) for p in re.split(r"\s*/\s*", title) if normalize_spaces(p)]
    if not raw_parts:
        raw_parts = [title]

    # Drop slash-parts that are ONLY a programming language/tech abbreviation prefix
    # when at least one other part looks like a proper role title.
    # e.g. "C#/.Net Developer" → [".Net Developer"]
    # e.g. "Java/Spring Developer" → kept unchanged (Spring is not a bare language name)
    _LANG_ONLY_TOKENS = {
        "c#", "c++", "c", "java", "python", "ruby", "php", "go", "scala",
        "kotlin", "swift", "r", "vb", "vb.net", "typescript", "ts", "js",
        "javascript", "perl", "groovy",
    }
    _ROLE_KEYWORDS = {
        "developer", "engineer", "architect", "analyst", "lead", "manager",
        "consultant", "specialist", "administrator", "devops", "scientist",
        "designer", "programmer", "tester", "qa",
    }

    def _is_lang_only(p: str) -> bool:
        tokens = p.casefold().split()
        return len(tokens) <= 2 and all(t in _LANG_ONLY_TOKENS for t in tokens)

    def _has_role_keyword(p: str) -> bool:
        return any(kw in p.casefold() for kw in _ROLE_KEYWORDS)

    if len(raw_parts) > 1:
        has_role_part = any(_has_role_keyword(p) for p in raw_parts)
        if has_role_part:
            filtered = [p for p in raw_parts if not _is_lang_only(p)]
            if filtered:
                raw_parts = filtered

    def norm_part(p: str) -> str:
        p = normalize_spaces(p)

        # ── Fix common mixed-case typos BEFORE CamelCase splitting ──
        # Resumes sometimes have "ENGINeer", "DEVeloper", etc. from bad formatting.
        # Normalize these to proper case first so CamelCase splitting doesn't mangle them.
        _mixed_case_fixes = [
            (re.compile(r"(?i)\bengineer\b"), "Engineer"),
            (re.compile(r"(?i)\bdeveloper\b"), "Developer"),
            (re.compile(r"(?i)\barchitect\b"), "Architect"),
            (re.compile(r"(?i)\banalyst\b"), "Analyst"),
            (re.compile(r"(?i)\bconsultant\b"), "Consultant"),
            (re.compile(r"(?i)\bspecialist\b"), "Specialist"),
            (re.compile(r"(?i)\bmanager\b"), "Manager"),
            (re.compile(r"(?i)\bdesigner\b"), "Designer"),
            (re.compile(r"(?i)\bdirector\b"), "Director"),
            (re.compile(r"(?i)\bcoordinator\b"), "Coordinator"),
            (re.compile(r"(?i)\badministrator\b"), "Administrator"),
            (re.compile(r"(?i)\bprogrammer\b"), "Programmer"),
            (re.compile(r"(?i)\bscientist\b"), "Scientist"),
        ]
        for pat, replacement in _mixed_case_fixes:
            p = pat.sub(replacement, p)

        # ── Protect compound tech terms from CamelCase splitting ──
        # Replace with ALL-CAPS placeholders (no [a-z] chars = no CamelCase splits).
        _compound_protect = [
            (re.compile(r"(?i)\bdevsecops\b"), "ZDEVSECOPSZ"),
            (re.compile(r"(?i)\bdevops\b"),    "ZDEVOPSZ"),
            (re.compile(r"(?i)\bmlops\b"),     "ZMLOPSZ"),
            (re.compile(r"(?i)\bfinops\b"),    "ZFINOPSZ"),
            (re.compile(r"(?i)\bdataops\b"),   "ZDATAOPSZ"),
        ]
        _compound_restore = {
            "ZDEVSECOPSZ": "DevSecOps",
            "ZDEVOPSZ":    "DevOps",
            "ZMLOPSZ":     "MLOps",
            "ZFINOPSZ":    "FinOps",
            "ZDATAOPSZ":   "DataOps",
        }
        for pat, placeholder in _compound_protect:
            p = pat.sub(placeholder, p)

        # ── CamelCase splitting (1st pass — handles file-derived compact strings) ──
        p = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", p)
        p = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", p)
        p = normalize_spaces(p)

        # ── Merge space-separated compound ops terms before abbreviation expansion ──
        # "Dev Sec Ops" → "DevSecOps", "Dev Ops" → "DevOps", etc.
        p = re.sub(r"(?i)\bdev\s+sec\s+ops\b", "DevSecOps", p)
        p = re.sub(r"(?i)\bdev\s+ops\b", "DevOps", p)
        p = re.sub(r"(?i)\bml\s+ops\b", "MLOps", p)
        p = re.sub(r"(?i)\bfin\s+ops\b", "FinOps", p)
        p = re.sub(r"(?i)\bdata\s+ops\b", "DataOps", p)

        # ── Abbreviation expansion ──
        p = re.sub(r"(?i)\bsr\.?\b", "Senior", p)
        p = re.sub(r"(?i)\bjr\.?\b", "Junior", p)
        p = re.sub(r"(?i)\bfull\s*stack\b", "Full Stack", p)
        p = re.sub(r"(?i)\bfront\s*end\b", "Frontend", p)
        p = re.sub(r"(?i)\bback\s*end\b", "Backend", p)

        # ── "Dot Net" / "DotNet" / bare "Net" → ".NET" ──
        p = re.sub(r"(?i)\bdot\s*net\b", ".NET", p)
        p = re.sub(r"(?i)\bdotnet\b", ".NET", p)
        # Bare "Net" before a role word — but NOT if already preceded by a dot
        p = re.sub(r"(?i)(?<!\.)(?<!\w)Net\s+(?=(?:Full Stack|Developer|Engineer|Architect|Consultant|Lead|Manager|Specialist|Administrator))", ".NET ", p)

        # Re-protect in case the expansions created new compound words (e.g. "SeniorDevOps").
        for pat, placeholder in _compound_protect:
            p = pat.sub(placeholder, p)

        # ── CamelCase splitting (2nd pass after expansions, e.g. "SeniorNet") ──
        p = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", p)
        p = normalize_spaces(p)

        # Restore compound words now that all CamelCase splitting is done.
        for placeholder, real_term in _compound_restore.items():
            p = p.replace(placeholder, real_term)
        p = normalize_spaces(p)

        # ── Full-string .NET Developer shortcut ──
        if re.fullmatch(r"(?i)\.?net\s+developer", p):
            p = ".NET Developer"

        # ── Broader ".NET" normalization for multi-word titles ──
        # "Senior Net Full Stack Developer" → "Senior .NET Full Stack Developer"
        p = re.sub(r"(?i)(?<!\.)(?<!\w)Dot\s*Net(?=\b)", ".NET", p)
        p = re.sub(r"(?i)(?<!\.)(?<!\w)Dotnet(?=\b)", ".NET", p)
        # Ensure lone "Net" before role keywords becomes ".NET" — skip if already ".NET"
        p = re.sub(
            r"(?i)(?<!\.)(?<!\w)Net\b(?=\s+(?:Full Stack|Developer|Engineer|Architect|Consultant|Programmer|Lead|Manager|Specialist|Administrator))",
            ".NET", p
        )

        p = normalize_spaces(p)

        # ── Token-level normalization ──
        keep_upper = {
            "QA", "SQL", "AWS", "GCP", "AI", "ML", "NLP", "BI", "UI", "UX",
            "IT", "CS", "CSE", "SRE", "ETL", "API", "APIs", "CI/CD",
        }
        # Compound tech words: casefold → correct form.
        compound_tokens = {
            "devops": "DevOps",
            "devsecops": "DevSecOps",
            "mlops": "MLOps",
            "finops": "FinOps",
            "dataops": "DataOps",
            "github": "GitHub",
            "gitlab": "GitLab",
            "cicd": "CI/CD",
            "kubernetes": "Kubernetes",
            "elasticsearch": "Elasticsearch",
        }
        # Connector words that stay lowercase when not at the start of a title.
        connectors = {"and", "or", "of", "in", "at", "the", "to", "for", "a", "an", "with"}
        # Roman numerals used in seniority/level designations.
        roman_numerals = {"II", "III", "IV", "VI", "VII", "VIII", "IX"}

        tokens: list[str] = []
        for i, tok in enumerate(p.split(" ")):
            if not tok:
                continue

            # Exact keep-upper set
            if tok in keep_upper or tok == ".NET":
                tokens.append(tok)
                continue

            # .Net / .net / .NET → .NET
            if re.fullmatch(r"(?i)\.net", tok):
                tokens.append(".NET")
                continue

            # Roman numerals → uppercase
            tok_up = tok.upper()
            if tok_up in roman_numerals:
                tokens.append(tok_up)
                continue

            # Short all-caps abbreviations (2–5 chars, alpha only)
            # BUT do NOT preserve case for known role words that happened to be
            # typed in ALL-CAPS in the resume (e.g. "OWNER", "LEAD", "ADMIN").
            _role_words_lower = {
                "owner", "admin", "lead", "chief", "clerk", "agent", "coach",
                "tutor", "nurse", "buyer", "audit",
            }
            tok_alpha = re.sub(r"[^A-Za-z]", "", tok)
            if tok_alpha and tok_alpha == tok_alpha.upper() and 2 <= len(tok_alpha) <= 5:
                if tok_alpha.lower() not in _role_words_lower:
                    tokens.append(tok)  # preserve existing case (abbreviation)
                    continue

            # Connector words → lowercase (except at start of title)
            tok_cf = tok.casefold()
            if tok_cf in connectors and i > 0:
                tokens.append(tok_cf)
                continue

            # Known compound tech words (case-insensitive lookup → correct form)
            if tok_cf in compound_tokens:
                tokens.append(compound_tokens[tok_cf])
                continue

            # Hyphenated tokens: capitalize each part individually
            if "-" in tok and tok not in ("-", "–", "—"):
                sub_parts = tok.split("-")
                joined = "-".join(
                    sp[:1].upper() + sp[1:].lower() if sp else sp
                    for sp in sub_parts
                )
                tokens.append(joined)
                continue

            # Default: title-case
            tokens.append(tok[:1].upper() + tok[1:].lower() if tok else tok)

        return " ".join(tokens)

    normalized_parts = [norm_part(p) for p in raw_parts]
    normalized_parts = _dedupe_preserve_order(normalized_parts)
    return " / ".join(normalized_parts)


# ─────────────────────────────────────────────────────────────────────────────
# Skill-list canonicalization
# ─────────────────────────────────────────────────────────────────────────────

def canonicalize_skill_list(value: str) -> str:
    """Normalize a comma/semicolon separated list of skills."""

    raw = normalize_spaces(value)
    if not raw:
        return ""

    parts = [normalize_spaces(p) for p in re.split(r"\s*[,;]\s*", raw) if normalize_spaces(p)]
    if not parts:
        return ""

    canon_map = {
        ".net": ".NET",
        "ai": "AI",
        "angular": "Angular",
        "asp.net": "ASP.NET",
        "asp.net mvc": "ASP.NET MVC",
        "aws": "AWS",
        "azure": "Azure",
        "azure aks": "Azure AKS",
        "azure dev ops": "Azure DevOps",
        "azure devops": "Azure DevOps",
        "azureaks": "Azure AKS",
        "ci cd": "CI/CD",
        "ci/cd": "CI/CD",
        "cicd": "CI/CD",
        "css": "CSS",
        "django": "Django",
        "docker": "Docker",
        "excel": "Excel",
        "express.js": "Express.js",
        "expressjs": "Express.js",
        "fastapi": "FastAPI",
        "flask": "Flask",
        "gcp": "GCP",
        "git lab": "GitLab",
        "github": "GitHub",
        "github actions": "GitHub Actions",
        "githubactions": "GitHub Actions",
        "gitlab": "GitLab",
        "gitlab ci": "GitLab CI",
        "gitlabci": "GitLab CI",
        "graphql": "GraphQL",
        "hadoop": "Hadoop",
        "html": "HTML",
        "in vision": "InVision",
        "invision": "InVision",
        "java script": "JavaScript",
        "javascript": "JavaScript",
        "jenkins": "Jenkins",
        "kafka": "Kafka",
        "keras": "Keras",
        "kubernetes": "Kubernetes",
        "langchain": "LangChain",
        "llm": "LLM",
        "ml": "ML",
        "mongodb": "MongoDB",
        "ms excel": "Excel",
        "msexcel": "Excel",
        "mysql": "MySQL",
        "nlp": "NLP",
        "nltk": "NLTK",
        "node": "Node",
        "node.js": "Node.js",
        "nodejs": "Node.js",
        "postgres": "PostgreSQL",
        "postgresql": "PostgreSQL",
        "power bi": "Power BI",
        "powerbi": "Power BI",
        "py tesseract": "PyTesseract",
        "py torch": "PyTorch",
        "pyspark": "PySpark",
        "pytesseract": "PyTesseract",
        "pytorch": "PyTorch",
        "rag": "RAG",
        "react": "React",
        "react.js": "React.js",
        "react js": "React.js",
        "rest": "REST",
        "rest api": "REST",
        "rest ap is": "REST",
        "rest apis": "REST",
        "restapi": "REST",
        "restful": "REST",
        "scikitlearn": "scikit-learn",
        "scikit learn": "scikit-learn",
        "scikit-learn": "scikit-learn",
        "spark": "Spark",
        "spark sql": "Spark SQL",
        "spacy": "spaCy",
        "spring data jpa": "Spring Data JPA",
        "spring mvc": "Spring MVC",
        "spring web flux": "Spring WebFlux",
        "spring webflux": "Spring WebFlux",
        "sql": "SQL",
        "sql server": "SQL Server",
        "sql database": "SQL",
        "tensorflow": "TensorFlow",
        "terraform": "Terraform",
        "type script": "TypeScript",
        "typescript": "TypeScript",
        "awseks": "Amazon EKS",
        "aws eks": "Amazon EKS",
    }

    drop_exact = {"system design", "system-design", "css system design", "css system-design", "database"}
    drop_contains = {"system design"}

    cleaned: list[str] = []
    seen: set[str] = set()
    for p in parts:
        raw_p = p
        if re.fullmatch(r"\s*\d+(?:\.\d+)+\s*", raw_p):
            continue
        if re.fullmatch(r"(?i)\s*(?:e\.?g\.?|eg)\s*\d+(?:\.\d+)+\s*", raw_p):
            continue
        p = re.sub(r"^\s*\(?\d+(?:\.\d+){0,3}\)?\s*[.)\-:]?\s*", "", raw_p).strip()
        if not p:
            continue
        key = p.casefold()
        if key in drop_exact:
            continue
        key2 = key.replace(" ", "")
        p2 = canon_map.get(key) or canon_map.get(key2)
        if p2 is None:
            tokens = []
            for tok in p.split(" "):
                if re.fullmatch(r"[A-Z0-9]{2,}", tok):
                    tokens.append(tok)
                else:
                    tokens.append(tok[:1].upper() + tok[1:] if tok else tok)
            p2 = " ".join(tokens)

        k_raw = p2.casefold()
        if k_raw in drop_exact:
            continue
        if any(x in k_raw for x in drop_contains):
            continue
        if k_raw == "node":
            p2 = "Node.js"

        k = p2.casefold()
        if k and k not in seen:
            seen.add(k)
            cleaned.append(p2)

    cleaned = sorted(cleaned, key=lambda x: x.casefold())
    return ", ".join(cleaned)


# ─────────────────────────────────────────────────────────────────────────────
# Education / qualification extraction
# ─────────────────────────────────────────────────────────────────────────────

# Canonical degree-level labels for display
_DEGREE_FULL_NAMES: dict[str, str] = {
    "b.e":    "Bachelor of Engineering",
    "b.tech": "Bachelor of Technology",
    "b.sc":   "Bachelor of Science",
    "b.s":    "Bachelor of Science",
    "b.a":    "Bachelor of Arts",
    "b.com":  "Bachelor of Commerce",
    "bca":    "Bachelor of Computer Applications",
    "bba":    "Bachelor of Business Administration",
    "m.e":    "Master of Engineering",
    "m.tech": "Master of Technology",
    "m.sc":   "Master of Science",
    "m.s":    "Master of Science",
    "mca":    "Master of Computer Applications",
    "mba":    "Master of Business Administration",
    "phd":    "Doctor of Philosophy",
    "bachelor": "Bachelor",
    "master":   "Master",
    "diploma":  "Diploma",
}


def extract_qualification(text: str) -> str:
    """Return a normalised, human-readable degree summary.

    Improvements:
      • Standalone "Msc", "Btech", "B.E" now return a label even without an
        adjacent major (degree-only fallback).
      • "B.E in B.e Computer Science" is de-glued so the major "B.e" prefix is
        stripped before it is joined to the label.
      • Full-form phrasing ("Bachelor of Engineering in Computer Science") is
        matched and normalised to the compact form ("B.E in Computer Science").
      • Degree labels are expanded to their full English names in the output.
    """
    if not text:
        return ""

    # ── 1. Normalise text ───────────────────────────────────────────────────

    def _normalize_text(s: str) -> str:
        s = unicodedata.normalize("NFKC", s)
        replacements = {
            "\u2019": "'", "\u2018": "'", "\u201c": '"', "\u201d": '"',
            "\u2013": "-", "\u2014": "-",
            "\xe2\x80\x99": "'", "\xe2\x80\x98": "'", "\xe2\x80\x9c": '"',
            "\xe2\x80\x93": "-", "\xe2\x80\x94": "-",
        }
        for bad, good in replacements.items():
            if bad in s:
                s = s.replace(bad, good)
        return s

    def _deglue(s: str) -> str:
        """Re-insert spaces swallowed by PDF/DOCX extractors."""
        s = re.sub(r"(?i)(bachelor|master|doctor)of", r"\1 of", s)
        s = re.sub(r"(?i)universityof", "university of", s)
        s = re.sub(r"(?i)of(science|arts|engineering|technology|business)", r"of \1", s)
        s = re.sub(r"(?i)(science|arts|engineering|technology|business)in", r"\1 in", s)
        s = re.sub(r"(?i)sciencefor", "science for", s)
        s = re.sub(r"(?i)\bmaster\s+in\s+science\b",      "Master of Science", s)
        s = re.sub(r"(?i)\bbachelor\s+in\s+science\b",    "Bachelor of Science", s)
        s = re.sub(r"(?i)\bmaster\s+in\s+engineering\b",  "Master of Engineering", s)
        s = re.sub(r"(?i)\bbachelor\s+in\s+technology\b", "Bachelor of Technology", s)
        s = re.sub(r"(?i)\b(of\s+(?:science|arts|engineering|technology|business))\s+for\b", r"\1 in", s)
        # CamelCase splits: ComputerScience -> Computer Science
        s = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", s)
        s = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", s)
        return s

    text = _deglue(_normalize_text(text))
    lns = [ln.strip() for ln in text.split("\n") if ln.strip()]

    # ── 2. Slice education section ────────────────────────────────────────

    def slice_education(lines: list[str]) -> tuple[list[str], bool]:
        for idx, ln in enumerate(lines):
            if re.search(r"(?i)\beducation\b|\bacademics?\b|\bacademic\s+background\b", ln.strip()):
                return lines[idx: idx + 120], True
        return lines[:220], False

    edu_space, has_explicit_education_section = slice_education(lns)

    # ── 3. Context-word filter ────────────────────────────────────────────

    context_terms = [
        "education", "university", "college", "institute", "school", "degree",
        "bachelor", "bachelor of", "b.tech", "btech", "b.e", "bsc", "b.sc",
        "b.s", "b.a", "masters", "master of", "m.s", "m.sc", "mba", "m.tech",
        "m.e", "m.eng", "mca", "phd", "doctorate", "diploma", "associate",
    ]

    def is_bad_false_positive(line: str) -> bool:
        l = line.lower()
        has_edu_cue = re.search(
            r"(?i)\b(education|university|college|institute|school|degree)\b", line
        ) is not None
        if any(x in l for x in ["ms access", "ms-sql", "ms sql", "mssql", "sql server", "ms office", "office 365"]):
            return not has_edu_cue
        if any(x in l for x in ["scrum master", "master data", "master-data", "mastercard"]):
            return not has_edu_cue
        if any(x in l for x in ["master/slave", "master-slave", "master slave", "master node", "slave node"]):
            return True
        return False

    if has_explicit_education_section:
        cand_lines = [ln for ln in edu_space if not is_bad_false_positive(ln)]
    else:
        cand_lines = []
        for ln in lns[:350]:
            if len(ln) > 180 or is_bad_false_positive(ln):
                continue
            l = ln.lower()
            if any(t in l for t in context_terms):
                cand_lines.append(ln)
                continue
            if re.search(
                r"(?i)\b(b\.\s*tech|btech|b\.\s*e\b|b\.\s*sc\b|bsc\b|b\.\s*s\b|bs\b|b\.\s*a\b|ba\b|"
                r"m\.\s*s\b|ms\b|m\.\s*sc\b|msc\b|m\.\s*tech|mtech\b|mba\b|m\.\s*e\b|m\.\s*eng\b|meng\b|mca\b|"
                r"ph\.\s*d\b|phd\b|doctorate\b|associate\b|diploma\b)\b",
                ln,
            ):
                cand_lines.append(ln)

    # ── 4. Split multi-degree lines ───────────────────────────────────────

    degree_signal_re = re.compile(
        r"(?i)\b(bachelor|master|ph\.?\s*d|phd|doctorate|b\.?\s*tech|btech|b\.?\s*e\b|"
        r"b\.?\s*sc\b|bsc\b|b\.?\s*s\b|\bbs\b|m\.?\s*s\b|\bms\b|m\.?\s*sc\b|\bmsc\b|"
        r"m\.?\s*tech|mtech|mba|mca|bca|bba|diploma|associate)\b"
    )

    def split_multi_degree_lines(lines: list[str]) -> list[str]:
        out: list[str] = []
        for ln in lines:
            if "/" not in ln:
                out.append(ln)
                continue
            parts = [normalize_spaces(p) for p in re.split(r"\s*/\s*", ln) if normalize_spaces(p)]
            if len(parts) <= 1 or sum(1 for p in parts if degree_signal_re.search(p)) < 2:
                out.append(ln)
            else:
                out.extend(parts)
        return out

    cand_lines = split_multi_degree_lines(cand_lines)
    edu_text  = "\n".join(cand_lines)

    # ── 5. Helpers ────────────────────────────────────────────────────────

    def _titlecase_major(m: str) -> str:
        m = normalize_spaces(m)
        if not m:
            return ""
        keep_upper = {"CS", "CSE", "IT", "MIS", "AI", "ML", "NLP", "UI", "UX", "BI", "QA"}
        out: list[str] = []
        for tok in m.split(" "):
            t = tok.strip()
            if not t:
                continue
            if re.fullmatch(r"[A-Z0-9]{2,}", t) or t.upper() in keep_upper:
                out.append(t.upper())
            else:
                out.append(t[:1].upper() + t[1:].lower())
        return " ".join(out)

    def _abbr_major_map(token: str) -> str | None:
        token_u = re.sub(r"[^A-Za-z]", "", token or "").upper()
        abbr_map = {
            "CSE": "computer science",
            "CS":  "computer science",
            "IT":  "information technology",
            "SE":  "software engineering",
            "MIS": "management information systems",
            "IS":  "information systems",
            "ECE": "electronics and communication",
            "EEE": "electrical engineering",
        }
        return abbr_map.get(token_u)

    # Degree-abbreviation tokens that should never be treated as a major name
    _degree_abbr_re = re.compile(
        r"(?i)^\s*(?:b\.?\s*e|b\.?\s*tech|btech|b\.?\s*sc|bsc|b\.?\s*s|b\.?\s*a|b\.?\s*com|bcom|"
        r"m\.?\s*e|m\.?\s*eng|m\.?\s*tech|mtech|m\.?\s*sc|msc|m\.?\s*s|ms|mba|mca|bca|bba|"
        r"ph\.?\s*d|phd|bachelor|master|masters|doctorate)\b"
    )

    def _clean_major(raw: str) -> str:
        s = (raw or "")
        # Strip leading degree abbreviations that sneak in (e.g. "B.E in B.e Computer Science"
        # → after "in", the major capture is "B.e Computer Science"; strip leading "B.e").
        s = re.sub(
            r"(?i)^\s*(?:b\.?\s*e|b\.?\s*tech|btech|b\.?\s*sc|bsc|b\.?\s*s|b\.?\s*a|"
            r"m\.?\s*e|m\.?\s*eng|m\.?\s*tech|mtech|m\.?\s*sc|msc|m\.?\s*s|ms|mba|mca|"
            r"ph\.?\s*d|phd)\b\s*",
            "",
            s,
        ).strip()

        s = s.split(",", 1)[0]
        s = re.sub(r"\([^)]*\)", " ", s)
        s = re.sub(r"\([^)]*$", " ", s)
        s = re.sub(r"\[[^\]]*\]", " ", s)
        s = re.split(r"\s+[-–—]\s+", s, maxsplit=1)[0]
        s = re.split(r"\s*/\s*", s, maxsplit=1)[0]
        s = re.sub(r"(?i)^\s*(?:science|arts|engineering|technology|commerce)\s+in\s+", "", s).strip()
        # Strip "Science: X" / "Technology: X" where the prefix IS the degree type, not the major
        s = re.sub(r"(?i)^\s*(?:science|technology|engineering)\s*:\s*", "", s).strip()
        s = re.split(
            r"(?i)\b(?:university|college|institute|school|cgpa|gpa|graduat(?:e|ion)|expected|year|from)\b",
            s,
        )[0]
        s = re.split(r"[|•·\u2022]", s)[0]
        s = re.split(r"\s{2,}", s)[0]
        s = s.strip(" -:;,.()[]{}\t\r\n")
        s = normalize_spaces(s)
        s = re.sub(r"\b\d{2,4}\b", " ", s)
        s = normalize_spaces(s)

        # Strip trailing location-like tokens that are not academic
        academic_words = {
            "science", "engineering", "technology", "computer", "information",
            "business", "commerce", "management", "mathematics", "statistics",
            "analytics", "data", "pharmacy", "finance", "accounting", "economics",
            "electrical", "electronics", "mechanical", "civil", "communication",
            "marketing", "biology", "chemistry", "physics",
        }
        tokens = [t for t in s.split(" ") if t]
        if len(tokens) >= 3:
            for n in (3, 2, 1):
                if len(tokens) <= n:
                    continue
                tail = tokens[-n:]
                if not all(t[:1].isupper() for t in tail):
                    continue
                tail_clean = re.sub(r"[^A-Za-z ]", " ", " ".join(tail)).strip().casefold()
                if not tail_clean:
                    continue
                if any(w in tail_clean.split() for w in academic_words):
                    continue
                tokens = tokens[:-n]
                s = normalize_spaces(" ".join(tokens))
                break

        # Strip trailing month names
        s = re.sub(
            r"(?i)\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
            r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|"
            r"dec(?:ember)?)\b$",
            "",
            s,
        )
        s = normalize_spaces(s)

        for stop in [
            " from ", " using ", " with ", " tools ", " tool ", " like ",
            " responsible ", " developed ", " implementing ", " implemented ",
            " built ", " working ", " worked ", " experience ", " projects ", " project ",
        ]:
            if stop in f" {s.casefold()} ":
                s = re.split(re.escape(stop.strip()), s, maxsplit=1, flags=re.I)[0]
                s = normalize_spaces(s)
                break

        if re.search(r"(?i)\b in \b", s):
            head, tail = re.split(r"(?i)\b in \b", s, maxsplit=1)
            head = normalize_spaces(head)
            tail_clean = normalize_spaces(re.sub(r"[^A-Za-z ]", " ", tail))
            tail_tokens = [t for t in tail_clean.split() if t]
            if (
                head
                and 1 <= len(tail_tokens) <= 3
                and all(t[:1].isupper() for t in tail_tokens)
                and not any(w in tail_clean.casefold() for w in academic_words)
            ):
                s = head
                s = normalize_spaces(s)

        # If what remains is itself a degree abbreviation, discard (it means there really
        # is no separate major text, e.g. "B.E in B.E" → strip "B.E").
        if _degree_abbr_re.fullmatch(s.strip()):
            return ""

        return s

    def _is_plausible_major(m: str) -> bool:
        m = normalize_spaces(m)
        if not m or len(m) > 60:
            return False
        toks = [t for t in re.split(r"[^A-Za-z]+", m) if t]
        if len(toks) > 8:
            return False
        ml = m.casefold()
        if any(x in ml for x in [" using ", " tools ", " like ", " responsible ",
                                   " developed ", " implemented ", " worked "]):
            return False
        academic_keywords = [
            "science", "engineering", "technology", "computer", "information",
            "business", "commerce", "management", "mathematics", "statistics",
            "analytics", "pharmacy", "finance", "accounting", "economics",
            "electrical", "electronics", "mechanical", "civil", "communication",
            "marketing", "biology", "chemistry", "physics",
        ]
        if any(k in ml for k in academic_keywords):
            return True
        if re.fullmatch(r"[A-Za-z]{2,5}", m) and _abbr_major_map(m):
            return True
        return False

    def _extract_major_from_line(line: str) -> str | None:
        l = line.lower()
        for phrase in [
            "management information systems", "management information science",
            "information science", "information systems", "computer science",
            "software engineering", "information technology", "computer applications",
            "data science", "data analytics", "computer engineering",
            "electrical engineering", "electronics and communication", "electronics",
            "business administration", "commerce", "pharmacy",
        ]:
            if phrase in l:
                return phrase
        m = re.search(r"\(([^)]+)\)", line)
        if m:
            mapped = _abbr_major_map(m.group(1) or "")
            if mapped:
                return mapped
        for tok in re.findall(r"\b[A-Z]{2,5}\b", line):
            mapped = _abbr_major_map(tok)
            if mapped:
                return mapped
        if "engineering" in l and re.search(
            r"(?i)\b(bachelor|master|degree|university|college|education)\b", line
        ):
            return "engineering"
        return None

    def _extract_major_near_degree(line: str, next_line: str | None = None) -> str | None:
        # 1) explicit "in / of / major in" patterns
        for src in [line, next_line or ""]:
            if not src:
                continue
            m = re.search(
                r"(?i)\b(?:in|of|major\s+in|speciali[sz]ation\s+in|concentration\s+in)\b\s+(.{2,80})",
                src,
            )
            if m:
                major = _clean_major(m.group(1))
                if major:
                    return major

        # 2) comma/dash-delimited: "B.Sc, Computer Science" / "B.Tech - CSE"
        for src in [line, next_line or ""]:
            if not src:
                continue
            m = re.search(
                r"(?i)\b(?:b\.?\s*tech|btech|b\.?\s*e\b|b\.?\s*sc\b|bsc\b|b\.?\s*s\b|bs\b|"
                r"b\.?\s*a\b|ba\b|b\.?\s*com\b|bcom\b|m\.?\s*tech|mtech\b|m\.?\s*e\b|"
                r"m\.?\s*eng\b|meng\b|m\.?\s*sc\b|msc\b|m\.?\s*s\b|ms\b|mba\b|bca\b|mca\b|bba\b)\b"
                r"\s*[,\-–—]\s*(.{2,80})",
                src,
            )
            if m:
                major = _clean_major(m.group(1))
                if major:
                    return _abbr_major_map(major) or major

        # 3) phrase-based
        mj = _extract_major_from_line(line)
        if mj:
            return mj
        if next_line:
            mj2 = _extract_major_from_line(next_line)
            if mj2:
                return mj2
        return None

    # ── 6. Expand compact degree label to full English name ───────────────

    def _expand_label(label: str) -> str:
        """'B.E' → 'Bachelor of Engineering', 'M.Sc' → 'Master of Science', etc."""
        key = label.strip().lower()
        return _DEGREE_FULL_NAMES.get(key, label)

    # ── 7. Main extraction loop ───────────────────────────────────────────

    found: list[str] = []

    def add_degree(
        label: str,
        major_raw: str | None,
        *,
        major_required: bool = True,
        fallback_label: str | None = None,
    ) -> None:
        """
        Append a formatted "Label in Major" string (or just label when no major is
        found but major_required=False).

        fallback_label: when set, append this plain label if no major can be found.
        """
        major_clean = _clean_major(major_raw or "")
        expanded_label = _expand_label(label)

        if major_clean:
            if _is_plausible_major(_abbr_major_map(major_clean) or major_clean):
                major_disp = _titlecase_major(_abbr_major_map(major_clean) or major_clean)
                if major_disp:
                    # ── Prevent degree-type word from appearing as the major ──────────
                    # e.g., "Master of Science in Science" → "Master of Science"
                    _ofs_m = re.search(
                        r"(?i)\bof\s+(Science|Technology|Engineering|Arts|Commerce)\b",
                        expanded_label,
                    )
                    if _ofs_m:
                        _dtype = _ofs_m.group(1).casefold()
                        if major_disp.casefold() == _dtype:
                            found.append(fallback_label or expanded_label)
                            return
                        # Strip leading dtype when not followed by And/Or/&
                        # e.g., "Science Computer Science" → "Computer Science"
                        _stripped = normalize_spaces(
                            re.sub(
                                rf"(?i)^\s*{re.escape(_dtype)}\s+(?!(?:and|or|&)\b)",
                                "",
                                major_disp,
                            )
                        )
                        if _stripped and _stripped.casefold() != major_disp.casefold():
                            major_disp = _stripped
                            if major_disp.casefold() == _dtype:
                                found.append(fallback_label or expanded_label)
                                return
                    found.append(f"{expanded_label} in {major_disp}")
                    return
            # Major found but implausible: fall through to degree-only logic

        if major_required:
            # Still try a fallback label (e.g., "M.Sc" without major)
            if not major_required and fallback_label:
                found.append(fallback_label)
            return

        # No major, and that's acceptable
        found.append(fallback_label or expanded_label)

    for i, ln in enumerate(cand_lines):
        if is_bad_false_positive(ln):
            continue

        next_ln = cand_lines[i + 1] if i + 1 < len(cand_lines) else None
        l = ln.lower()
        major_inline = _extract_major_near_degree(ln, next_ln)

        # ── PhD / Doctorate ───────────────────────────────────────────────
        if re.search(r"(?i)\bph\.?\s*d\b|\bdoctorate\b", ln):
            add_degree("PhD", major_inline, major_required=False,
                       fallback_label="Doctor of Philosophy")
            continue

        # ── MBA ───────────────────────────────────────────────────────────
        if re.search(r"(?i)\bmba\b|master\s+of\s+business\s+administration", ln):
            add_degree("MBA", major_inline, major_required=False,
                       fallback_label="Master of Business Administration")
            continue

        # ── Full-form "Bachelor/Master of Engineering/Science/Technology in X" ─
        m_boe = re.search(r"(?i)\bbachelor\s+of\s+engineering\b", ln)
        if m_boe:
            add_degree("b.e", major_inline, major_required=True)
            continue

        m_bot = re.search(r"(?i)\bbachelor\s+of\s+technology\b", ln)
        if m_bot:
            add_degree("b.tech", major_inline, major_required=True)
            continue

        m_bos = re.search(r"(?i)\bbachelor\s+of\s+science\b", ln)
        if m_bos:
            add_degree("b.sc", major_inline, major_required=True)
            continue

        m_mos = re.search(r"(?i)\bmaster\s+of\s+science\b", ln)
        if m_mos:
            add_degree("m.sc", major_inline, major_required=False,
                       fallback_label="Master of Science")
            continue

        m_moe = re.search(r"(?i)\bmaster\s+of\s+engineering\b", ln)
        if m_moe:
            add_degree("m.e", major_inline, major_required=False,
                       fallback_label="Master of Engineering")
            continue

        m_mot = re.search(r"(?i)\bmaster\s+of\s+technology\b", ln)
        if m_mot:
            add_degree("m.tech", major_inline, major_required=False,
                       fallback_label="Master of Technology")
            continue

        # Generic "bachelor of …" (not S/E/T) e.g., "Bachelor of Pharmacy"
        m_bo = re.search(r"(?i)\bbachelor\s+of\s+(.{2,80})", ln)
        if m_bo:
            major_of = _clean_major(m_bo.group(1))
            if major_of.casefold() not in {
                "science", "arts", "engineering", "technology", "business", "commerce"
            }:
                add_degree("Bachelor", major_of, major_required=True)
                continue

        # ── Abbreviated degree patterns ───────────────────────────────────
        # B.Tech  ─ require major
        if re.search(r"(?i)\b(b\.?\s*tech\b|btech\b)\b", ln):
            add_degree("b.tech", major_inline, major_required=False,
                       fallback_label="Bachelor of Technology")
            continue

        # B.E  ─ require major
        if re.search(r"(?i)\b(b\.?\s*e\b)\b", ln):
            add_degree("b.e", major_inline, major_required=False,
                       fallback_label="Bachelor of Engineering")
            continue

        # B.Sc / BS
        if re.search(r"(?i)\b(b\.?\s*sc\b|bsc\b|b\.?\s*s\b|\bbs\b)\b", ln):
            add_degree("b.sc", major_inline, major_required=False,
                       fallback_label="Bachelor of Science")
            continue

        # BCA
        if re.search(r"(?i)\b(bca\b|bachelor\s+of\s+computer\s+applications)\b", ln):
            add_degree("BCA", major_inline, major_required=False,
                       fallback_label="Bachelor of Computer Applications")
            continue

        # BBA
        if re.search(r"(?i)\b(bba\b|bachelor\s+of\s+business\s+administration)\b", ln):
            add_degree("BBA", major_inline, major_required=False,
                       fallback_label="Bachelor of Business Administration")
            continue

        # B.A
        if re.search(r"(?i)\b(b\.?\s*a\b|\bba\b|bachelor\s+of\s+arts)\b", ln):
            add_degree("b.a", major_inline, major_required=False,
                       fallback_label="Bachelor of Arts")
            continue

        # B.Com
        if re.search(r"(?i)\b(b\.?\s*com\b|bcom\b|bachelor\s+of\s+commerce)\b", ln):
            add_degree("b.com", major_inline, major_required=False,
                       fallback_label="Bachelor of Commerce")
            continue

        # Generic "Bachelor" / "Bachelor's"
        if re.search(r"(?i)\b(bachelor|bachelor[\u2019']s|honou?rs\s+degree)\b", ln):
            add_degree("Bachelor", major_inline, major_required=False,
                       fallback_label="Bachelor's Degree")
            continue

        # M.Tech
        if re.search(r"(?i)\b(m\.?\s*tech\b|mtech\b)\b", ln):
            add_degree("m.tech", major_inline, major_required=False,
                       fallback_label="Master of Technology")
            continue

        # M.E
        if re.search(r"(?i)\b(m\.?\s*e\b|m\.?\s*eng\b|meng\b)\b", ln):
            add_degree("m.e", major_inline, major_required=False,
                       fallback_label="Master of Engineering")
            continue

        # MCA
        if re.search(r"(?i)\b(mca\b|master\s+of\s+computer\s+applications)\b", ln):
            add_degree("MCA", major_inline, major_required=False,
                       fallback_label="Master of Computer Applications")
            continue

        # M.Sc / M.S  ─ allow without major (very common as standalone abbreviation)
        if re.search(r"(?i)\b(m\.?\s*sc\b|msc\b|m\.?\s*s\b|\bms\b)\b", ln):
            add_degree("m.sc", major_inline, major_required=False,
                       fallback_label="Master of Science")
            continue

        # Generic "Master" / "Masters" / "Master's"
        if re.search(r"(?i)\b(master|masters|master's|master\s+of)\b", ln):
            add_degree("Master", major_inline, major_required=False,
                       fallback_label="Master's Degree")
            continue

        # Diploma / Associate
        if re.search(r"(?i)\b(diploma|associate)\b", ln):
            add_degree("Diploma", major_inline, major_required=False,
                       fallback_label="Associate/Diploma")
            continue

    found = _dedupe_preserve_order(
        [normalize_spaces(x) for x in found if normalize_spaces(x)]
    )
    if found:
        return " / ".join(found)

    return ""

# ─────────────────────────────────────────────────────────────────────────────
# Post-normalization for stored qualification strings
# ─────────────────────────────────────────────────────────────────────────────

def post_normalize_qualification(value: str) -> str:
    """Normalise an already-stored qualification string.

    Fixes:
    - Expand abbreviations: M.S → Master of Science, B.E → Bachelor of Engineering, etc.
    - Remove standalone placeholder entries ('Master's Degree', "Bachelor's Degree")
    - Strip degree-type word used as major ("Master of Science in Science" → "Master of Science")
    - Strip 'Science: X' prefix in major when degree is of Science
    - Fix 'in X in X' redundancy ("Computer Science In Computer Science & Information")
    - Fix 'Information Technologies' → 'Information Technology'
    - Remove institution names leaking into major (Osmania, JNTU, etc.)
    - 'Bachelor in Engineering' → 'Bachelor of Engineering'
    - 'Bachelor of Technology in Technology And Management' → remove repeated 'Technology'
    """
    if not value:
        return value

    # ── abbreviation prefix expansions (longest/most-specific first) ─────────
    _ABBR_PREFIX: list[tuple[re.Pattern, str]] = [
        (re.compile(r"(?i)^M\.?\s*Tech\b"),  "Master of Technology"),
        (re.compile(r"(?i)^M\.?\s*Sc\b"),    "Master of Science"),
        (re.compile(r"(?i)^M\.?\s*S\b"),     "Master of Science"),
        (re.compile(r"(?i)^M\.?\s*E\b"),     "Master of Engineering"),
        (re.compile(r"(?i)^M\.?\s*Eng\b"),   "Master of Engineering"),
        (re.compile(r"(?i)^B\.?\s*Tech\b"),  "Bachelor of Technology"),
        (re.compile(r"(?i)^B\.?\s*E\b"),     "Bachelor of Engineering"),
        (re.compile(r"(?i)^B\.?\s*Sc\b"),    "Bachelor of Science"),
        (re.compile(r"(?i)^B\.?\s*S\b"),     "Bachelor of Science"),
        (re.compile(r"(?i)^B\.?\s*A\b"),     "Bachelor of Arts"),
        (re.compile(r"(?i)^B\.?\s*Com\b"),   "Bachelor of Commerce"),
        (re.compile(r"(?i)^Ph\.?\s*D\b"),    "Doctor of Philosophy"),
        (re.compile(r"(?i)^MCA\b"),          "Master of Computer Applications"),
        (re.compile(r"(?i)^BCA\b"),          "Bachelor of Computer Applications"),
        (re.compile(r"(?i)^MBA\b"),          "Master of Business Administration"),
    ]

    _PLACEHOLDER_RE = re.compile(
        r"(?i)^\s*(?:master'?s?\s+degree|bachelor'?s?\s+degree|master'?s?|doctorate)\s*$"
    )

    # Known university/institution tokens that commonly leak into major
    _INST_RE = re.compile(
        r"(?i)\b(?:Osmania|JNTU[HKA]?|VTU|GTU|RTU|RGPV|AKTU|KTU|"
        r"Jawaharlal|Amravati|Nagpur|Mumbai|Pune|Hyderabad|Chennai|"
        r"Bangalore|Delhi|Calcutta|Madras|Bombay)\b"
    )

    def _expand_abbr(s: str) -> str:
        """Replace leading abbreviation with full form, keeping the rest intact."""
        for pat, replacement in _ABBR_PREFIX:
            m = pat.match(s)
            if m:
                rest = s[m.end():].lstrip()
                return normalize_spaces(replacement + (" " + rest if rest else ""))
        return s

    def _fix_one(part: str) -> str:
        part = normalize_spaces(part)
        if not part:
            return ""
        # Drop placeholders that carry no information
        if _PLACEHOLDER_RE.match(part):
            return ""
        # Expand leading abbreviation
        part = _expand_abbr(part)
        # Fix "Information Technologies" → "Information Technology"
        part = re.sub(r"(?i)\bInformation\s+Technologies\b",
                      "Information Technology", part)

        # Split on the first " in " delimiter (case-insensitive)
        m = re.match(r"^(.*?)\s+[Ii]n\s+(.+)$", part, re.DOTALL)
        if not m:
            # No "in" — handle "Bachelor in Engineering" → "Bachelor of Engineering"
            part = re.sub(
                r"(?i)^(Bachelor|Master)\s+in\s+"
                r"(Engineering|Technology|Science|Arts|Commerce|Business)\s*$",
                r"\1 of \2",
                part,
            )
            return normalize_spaces(part)

        degree_part = normalize_spaces(m.group(1))
        major_part  = normalize_spaces(m.group(2))

        # Normalise within major too
        major_part = re.sub(r"(?i)\bInformation\s+Technologies\b",
                             "Information Technology", major_part)

        # Strip "Science: X" prefix when degree is 'of Science'
        if re.search(r"(?i)\bof\s+Science\b", degree_part):
            major_part = re.sub(r"(?i)^\s*Science\s*:\s*", "", major_part)
            major_part = normalize_spaces(major_part)

        # Remove institution names from major
        major_part = _INST_RE.sub("", major_part)
        major_part = normalize_spaces(major_part)

        # ── Degree-type == major guard ─────────────────────────────────────
        dtype_m = re.search(
            r"(?i)\bof\s+(Science|Technology|Engineering|Arts|Commerce)\b",
            degree_part,
        )
        dtype = dtype_m.group(1).casefold() if dtype_m else None

        if dtype and major_part:
            if major_part.casefold() == dtype:
                # "Master of Science in Science" → "Master of Science"
                return degree_part

            # Strip leading dtype when NOT followed by And / Or / &
            # e.g., "Science Computer Science" → "Computer Science"
            stripped = normalize_spaces(
                re.sub(
                    rf"(?i)^\s*{re.escape(dtype)}\s+(?!(?:and|or|&)\b)",
                    "",
                    major_part,
                )
            )
            if stripped and stripped.casefold() != major_part.casefold():
                major_part = stripped
                if major_part.casefold() == dtype:
                    return degree_part

        # ── Fix "in X in X" / "in X In X & Y" redundancy ─────────────────
        # e.g., "Computer Science In Computer Science & Information"
        m2 = re.match(r"^(.+?)\s+[Ii]n\s+(.+)$", major_part)
        if m2:
            first_m  = normalize_spaces(m2.group(1))
            second_m = normalize_spaces(m2.group(2))
            fl = first_m.casefold()
            sl = second_m.casefold()
            # Use the second (usually the more complete) segment if it's a superset
            if sl.startswith(fl) or fl in sl:
                major_part = second_m
            elif set(fl.split()).issubset(set(sl.split())):
                major_part = second_m

        major_part = normalize_spaces(major_part)
        if not major_part:
            return degree_part

        # ── "Bachelor in Engineering" (no explicit "of") ─────────────────
        if degree_part.casefold() in {"bachelor", "master"}:
            canonical_types = {
                "engineering", "technology", "science",
                "arts", "commerce", "business",
            }
            if major_part.casefold() in canonical_types:
                return f"{degree_part} of {major_part.title()}"
            # "Bachelor in Technology X Y" → "Bachelor of Technology in X Y"
            dtype_match = re.match(
                r"(?i)^(Engineering|Technology|Science|Arts|Commerce|Business)\s+(.+)$",
                major_part,
            )
            if dtype_match:
                dtype_word = dtype_match.group(1).title()
                rest = normalize_spaces(dtype_match.group(2))
                return f"{degree_part} of {dtype_word} in {rest}"

        return f"{degree_part} in {major_part}"

    # ── Main: split on " / ", clean each entry, deduplicate ─────────────────
    parts   = [normalize_spaces(p) for p in value.split(" / ") if normalize_spaces(p)]
    cleaned = [c for p in parts if (c := _fix_one(p))]
    # If ALL entries were stripped (all were placeholders), keep the originals
    # to avoid losing the only available education info.
    if not cleaned and parts:
        cleaned = parts
    cleaned = _dedupe_preserve_order(cleaned)
    return " / ".join(cleaned)