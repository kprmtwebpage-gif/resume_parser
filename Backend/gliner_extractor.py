"""
gliner_extractor.py
===================
Zero-shot NER for resume field extraction using the GLiNER model.

GLiNER (Generalist and Lightweight Named Entity Recognition) performs
open-vocabulary NER — you define the entity labels at inference time, no
training required.  It outperforms spaCy en_core_web_sm on resume-domain
names, job titles, and locations by a wide margin.

Model: urchade/gliner_multi-v2.1  (~500 MB, loaded once, cached in memory)
       Falls back to urchade/gliner_small-v2.1 (~100 MB) if multi is unavailable.

Usage (called from parser.py):
    from gliner_extractor import gliner_extract_header

    result = gliner_extract_header(header_text)
    # result = {
    #   "first_name": "Praveen",
    #   "last_name":  "Kumar",
    #   "job_title":  "Senior Data Engineer",
    #   "location":   "Chennai, Tamil Nadu",
    #   "skills":     ["Python", "AWS", "Spark"],
    # }
    # Any field not found is None / empty list.

Environment variables:
    GLINER_ENABLED      1|0  (default: 1 — auto-enabled when package is installed)
    GLINER_MODEL        model name (default: urchade/gliner_multi-v2.1)
    GLINER_THRESHOLD    confidence threshold 0-1 (default: 0.45)
    GLINER_HEADER_CHARS chars of header to scan (default: 600)
"""

from __future__ import annotations

import logging
import os
import re
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Model loader — loaded once per process, graceful fallback
# ─────────────────────────────────────────────────────────────────────────────

_GLINER_MODEL: Any = None
_GLINER_AVAILABLE: bool = False
_GLINER_LOAD_ATTEMPTED: bool = False


def _load_gliner() -> Any:
    """Load GLiNER model once; return None if unavailable."""
    global _GLINER_MODEL, _GLINER_AVAILABLE, _GLINER_LOAD_ATTEMPTED
    if _GLINER_LOAD_ATTEMPTED:
        return _GLINER_MODEL

    _GLINER_LOAD_ATTEMPTED = True

    if os.getenv("GLINER_ENABLED", "1").strip() in ("0", "false", "off", "no"):
        logger.info("gliner: disabled via GLINER_ENABLED=0")
        return None

    # Disable symlinks warning — not needed on Windows (we use local_dir instead)
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

    preferred = os.getenv("GLINER_MODEL", "urchade/gliner_multi-v2.1").strip()
    fallback = "urchade/gliner_small-v2.1"

    try:
        from gliner import GLiNER  # type: ignore
    except ImportError:
        logger.warning(
            "gliner: package not installed — run: pip install gliner  "
            "(NER-based extraction disabled, falling back to regex)"
        )
        return None

    # On Windows, HuggingFace symlink-based caching fails without Developer Mode.
    # Use a local_dir inside the project to store model files directly (no symlinks).
    _base_dir = os.path.dirname(os.path.abspath(__file__))
    _models_dir = os.path.join(_base_dir, "gliner_models")
    os.makedirs(_models_dir, exist_ok=True)

    for model_name in [preferred, fallback]:
        # Local directory name: replace "/" with "__" to make a valid path
        _slug = model_name.replace("/", "__")
        _local_path = os.path.join(_models_dir, _slug)
        try:
            logger.info("gliner: loading model '%s' …", model_name)
            # Try loading from local path first (fast after first download)
            if os.path.isdir(_local_path) and os.listdir(_local_path):
                model = GLiNER.from_pretrained(_local_path)
            else:
                # Download model directly to local_dir (avoids symlinks)
                from huggingface_hub import snapshot_download  # type: ignore
                snapshot_download(
                    repo_id=model_name,
                    local_dir=_local_path,
                    local_dir_use_symlinks=False,
                )
                model = GLiNER.from_pretrained(_local_path)
            _GLINER_MODEL = model
            _GLINER_AVAILABLE = True
            logger.info("gliner: model '%s' loaded successfully", model_name)
            return model
        except Exception as exc:
            logger.warning("gliner: failed to load '%s': %s", model_name, exc)

    logger.warning("gliner: all models failed to load — NER disabled")
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Entity labels — defines WHAT we ask GLiNER to extract
# ─────────────────────────────────────────────────────────────────────────────

_NAME_LABELS = ["person name", "full name", "candidate name"]
_TITLE_LABELS = ["job title", "job position", "professional title", "occupation", "current role", "designation"]
_LOCATION_LABELS = ["current city", "current location", "present location", "city", "city and state"]
_SKILL_LABELS = ["technical skill", "programming language", "technology", "framework", "tool"]


# ─────────────────────────────────────────────────────────────────────────────
# Post-processing helpers
# ─────────────────────────────────────────────────────────────────────────────

def _split_name(full_name: str) -> tuple[str, str]:
    """Split 'Praveen Kumar' → ('Praveen', 'Kumar'). Handles initials."""
    parts = full_name.strip().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0].title(), ""
    # Last token is the last name; everything before is first name
    first = " ".join(parts[:-1]).title()
    last = parts[-1].title()
    return first, last


def _is_junk_entity(text: str) -> bool:
    """Return True for entities that are clearly not a name/title/location."""
    t = text.strip().casefold()
    if len(t) < 2:
        return True
    # Common false positives from GLiNER on resume headers
    junk = {
        "resume", "cv", "curriculum vitae", "profile", "summary", "objective",
        "email", "phone", "mobile", "contact", "linkedin", "github",
        "skills", "experience", "education", "certifications", "projects",
        "null", "none", "n/a", "na",
    }
    return t in junk


def _clean_title(title: str) -> str:
    """Strip common resume-header noise from extracted job titles."""
    t = title.strip()
    # Strip leading bullets/symbols
    t = re.sub(r"^[•▪■◦\-–—]+\s*", "", t)
    # Strip trailing date ranges or location hints
    t = re.sub(r"\s*[\|/]\s*.*$", "", t)
    # Strip leading "Objective:" / "Title:"
    t = re.sub(r"(?i)^(objective|title|role|position|designation)\s*[:–—]\s*", "", t)
    return t.strip()


def _clean_location(loc: str) -> str:
    """Normalize extracted location string."""
    t = loc.strip()
    # Remove leading/trailing noise chars
    t = re.sub(r"^[•▪■◦\-–—:|]+\s*", "", t)
    t = re.sub(r"\s*[•▪■◦\-–—:|]+$", "", t)
    return t.strip()


# ─────────────────────────────────────────────────────────────────────────────
# Main extraction function
# ─────────────────────────────────────────────────────────────────────────────

def gliner_extract_header(header_text: str) -> dict:
    """
    Run GLiNER NER on the resume header block.

    Returns a dict with keys:
        first_name  str | ""
        last_name   str | ""
        job_title   str | ""
        location    str | ""
        skills      list[str]

    All values default to "" / [] when not found or when GLiNER is unavailable.
    Never raises — any internal error returns empty defaults.
    """
    result: dict = {
        "first_name": "",
        "last_name": "",
        "job_title": "",
        "location": "",
        "skills": [],
    }

    if not header_text or not header_text.strip():
        return result

    model = _load_gliner()
    if model is None:
        return result

    max_chars = int(os.getenv("GLINER_HEADER_CHARS", "600"))
    threshold = float(os.getenv("GLINER_THRESHOLD", "0.45"))

    # Scan only the header — prevents body-text locations / past-job titles
    # from polluting the extraction
    text_to_scan = header_text[:max_chars]

    try:
        # ── Pass 1a: Name only (isolated to avoid title/name confusion) ──────
        name_entities = model.predict_entities(
            text_to_scan,
            _NAME_LABELS,
            threshold=threshold,
        )

        # ── Pass 1b: Title + Location (separate from names) ─────────────────
        title_loc_entities = model.predict_entities(
            text_to_scan,
            _TITLE_LABELS + _LOCATION_LABELS,
            threshold=threshold,
        )

        best_name: tuple[str, float] = ("", 0.0)
        best_title: tuple[str, float] = ("", 0.0)
        best_location: tuple[str, float] = ("", 0.0)

        for ent in name_entities:
            text = (ent.get("text") or "").strip()
            label = (ent.get("label") or "").casefold()
            score = float(ent.get("score") or 0.0)
            if _is_junk_entity(text):
                continue
            if any(l in label for l in ("person", "full name", "candidate")):
                if score > best_name[1] and len(text.split()) >= 1:
                    best_name = (text, score)

        for ent in title_loc_entities:
            text = (ent.get("text") or "").strip()
            label = (ent.get("label") or "").casefold()
            score = float(ent.get("score") or 0.0)
            if _is_junk_entity(text):
                continue
            if any(l in label for l in ("job title", "job position", "occupation", "professional", "current role", "designation")):
                cleaned = _clean_title(text)
                if cleaned and score > best_title[1]:
                    best_title = (cleaned, score)
            elif any(l in label for l in ("city", "location", "present")):
                cleaned = _clean_location(text)
                if cleaned and score > best_location[1] and len(cleaned) >= 4:
                    best_location = (cleaned, score)

        # ── Assign name ──────────────────────────────────────────────────────
        if best_name[0]:
            fn, ln = _split_name(best_name[0])
            result["first_name"] = fn
            result["last_name"] = ln

        if best_title[0]:
            result["job_title"] = best_title[0]

        if best_location[0]:
            result["location"] = best_location[0]

        # ── Pass 2: Skills (separate pass for accuracy) ──────────────────────
        skill_entities = model.predict_entities(
            text_to_scan,
            _SKILL_LABELS,
            threshold=threshold + 0.05,  # slightly stricter for skills
        )

        seen_skills: set[str] = set()
        skills: list[str] = []
        # Exclude job title text from skills to prevent double-classification
        title_lower = best_title[0].casefold() if best_title[0] else ""
        for ent in skill_entities:
            sk = (ent.get("text") or "").strip()
            sk_lower = sk.casefold()
            if (sk and sk_lower not in seen_skills and len(sk) >= 2
                    and not _is_junk_entity(sk)
                    and sk_lower != title_lower):
                seen_skills.add(sk_lower)
                skills.append(sk)

        result["skills"] = skills

        logger.debug(
            "gliner: name=(%s, %s) title=%s loc=%s skills=%d",
            result["first_name"], result["last_name"],
            result["job_title"], result["location"], len(skills),
        )

    except Exception as exc:
        logger.warning("gliner: prediction failed: %s", exc)

    return result
