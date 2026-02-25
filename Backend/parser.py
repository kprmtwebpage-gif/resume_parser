import hashlib
import logging
import os
import re
import shutil
import time
import unicodedata
import warnings
import zipfile
from datetime import datetime
import multiprocessing as mp
from pathlib import Path
from functools import lru_cache
from xml.etree import ElementTree as ET

import pdfplumber
import psycopg2
from dotenv import load_dotenv

from data_normalization import (
    canonicalize_job_title,
    canonicalize_skill_list,
    extract_qualification,
)
from education_parser import (
    parse_education_section,
    education_to_flat_string,
)
try:
    from location_parser import (
        detect_location_with_fallback as _detect_loc_with_fallback,
        location_result_to_string as _loc_result_to_str,
    )
    _LOCATION_PARSER_AVAILABLE = True
except ImportError:
    _LOCATION_PARSER_AVAILABLE = False

try:
    from llm_extractor import llm_extract as _llm_extract
    _LLM_EXTRACTOR_AVAILABLE = True
except ImportError:
    _LLM_EXTRACTOR_AVAILABLE = False
    def _llm_extract(*_a, **_k):  # type: ignore[misc]
        return None

try:
    from validation_layer import (
        validate_name,
        validate_location,
        validate_degree,
        validate_applied_title,
        _NLP as _SPACY_NLP,
        _SPACY_AVAILABLE as _SPACY_NER_AVAILABLE,
    )
    _VALIDATION_LAYER_AVAILABLE = True
except ImportError:
    _VALIDATION_LAYER_AVAILABLE = False
    _SPACY_NLP = None
    _SPACY_NER_AVAILABLE = False
    def validate_name(fn, ln):  # type: ignore[misc]
        return fn, ln
    def validate_location(loc):  # type: ignore[misc]
        return loc
    def validate_degree(deg):  # type: ignore[misc]
        return deg
    def validate_applied_title(title, text):  # type: ignore[misc]
        return title


# Shared canonicalization for US state abbreviations.
US_STATE_ABBR_TO_FULL: dict[str, str] = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
    "DC": "District of Columbia",
}

try:  # Optional but strongly recommended for robust international parsing
    import phonenumbers  # type: ignore
except Exception:  # pragma: no cover
    phonenumbers = None

try:  # Optional country list for better address normalization
    import pycountry  # type: ignore
except Exception:  # pragma: no cover
    pycountry = None

try:
    from docx import Document  # type: ignore
except Exception:
    Document = None

# Optional OCR fallback for image-based PDFs.
# IMPORTANT: do not import pytesseract eagerly; it can pull heavy dependencies
# (e.g., pandas) and may fail/hang in some Windows environments.
pytesseract = None


def _lazy_pytesseract():
    global pytesseract
    if pytesseract is not None:
        return pytesseract
    try:
        import pytesseract as _pt  # type: ignore

        pytesseract = _pt
        return pytesseract
    except Exception:
        pytesseract = None
        return None


@lru_cache(maxsize=1)
def _warn_missing_tesseract_once() -> None:
    logging.getLogger(__name__).warning(
        "PDF OCR is enabled, but the 'tesseract' binary was not found. "
        "Install Tesseract OCR or set TESSERACT_CMD to the full path (e.g., C:\\Program Files\\Tesseract-OCR\\tesseract.exe)."
    )

# ---------------- LOAD ENV ----------------
load_dotenv()

# pdfminer/pdfplumber can emit noisy font warnings to stderr for some PDFs.
# In PowerShell, native stderr is promoted to error records (NativeCommandError),
# which can interrupt batch reloads depending on shell configuration.
logging.getLogger("pdfminer").setLevel(logging.ERROR)
logging.getLogger("pdfplumber").setLevel(logging.ERROR)
warnings.filterwarnings("ignore", module=r"pdfminer\\..*")


def _safe_ident(value: str, *, label: str) -> str:
    if not value:
        raise ValueError(f"Missing {label}")
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise ValueError(f"Unsafe SQL identifier for {label}: {value!r}")
    return value

# Target tables (defaults per your requested table names)
CANDIDATES_TABLE = _safe_ident(os.getenv("CANDIDATES_TABLE", "candidate_profile"), label="CANDIDATES_TABLE")
SKILLS_TABLE = _safe_ident(os.getenv("SKILLS_TABLE", "candidate_skills_profile"), label="SKILLS_TABLE")


# ---------------- DE-DUPLICATION (DB) ----------------
# We store a stable fingerprint for each resume so reruns don't insert duplicates.
# This will auto-add the needed columns/index the first time it runs.
def ensure_schema(cursor, conn) -> bool:
    use_db_dedupe = True
    try:
        # User requirement: remove large resume text from the table.
        cursor.execute(f"ALTER TABLE {CANDIDATES_TABLE} DROP COLUMN IF EXISTS resume")
        cursor.execute(f"ALTER TABLE {CANDIDATES_TABLE} ADD COLUMN IF NOT EXISTS resume_filename TEXT")
        cursor.execute(f"ALTER TABLE {CANDIDATES_TABLE} ADD COLUMN IF NOT EXISTS resume_sha256 TEXT")
        cursor.execute(f"ALTER TABLE {CANDIDATES_TABLE} ADD COLUMN IF NOT EXISTS parsed_at TIMESTAMP")
        cursor.execute(
            f"CREATE UNIQUE INDEX IF NOT EXISTS idx_{CANDIDATES_TABLE}_resume_sha256 ON {CANDIDATES_TABLE} (resume_sha256)"
        )
        cursor.execute(f"ALTER TABLE {SKILLS_TABLE} ADD COLUMN IF NOT EXISTS parsed_at TIMESTAMP")
        # Ensure we can UPSERT one skills row per candidate_id (stable id values across reruns).
        cursor.execute(
            f"CREATE UNIQUE INDEX IF NOT EXISTS idx_{SKILLS_TABLE}_candidate_id_unique ON {SKILLS_TABLE} (candidate_id)"
        )
        conn.commit()
    except psycopg2.Error as e:
        use_db_dedupe = False
        conn.rollback()
        print(
            "WARNING: Could not enable DB de-duplication (missing privileges/schema mismatch). "
            f"Will continue without de-dupe. Details: {e.__class__.__name__}"
        )
    return use_db_dedupe


# ---------------- TEXT EXTRACTION ----------------
def _pdf_ocr_enabled() -> bool:
    v = (os.getenv("ENABLE_PDF_OCR", "") or "").strip().casefold()
    return v in {"1", "true", "yes", "y", "on"}


def _pdf_ocr_pages() -> int:
    """How many leading pages to OCR when enabled (default: 1)."""

    try:
        n = int(os.getenv("PDF_OCR_PAGES", "1") or "1")
    except Exception:
        n = 1
    # Keep this bounded but allow larger values when explicitly requested.
    return max(0, min(25, n))


def _pdf_ocr_max_total_pages() -> int:
    """Max number of *any* pages to OCR across the full PDF.

    This is for image-based/scanned PDFs where certifications/experience may be on later pages.
    Default 0 keeps OCR limited to the first-page contact/header heuristic.
    """

    try:
        n = int(os.getenv("PDF_OCR_MAX_TOTAL_PAGES", "0") or "0")
    except Exception:
        n = 0
    return max(0, min(25, n))


def _pdf_ocr_min_page_text_len() -> int:
    try:
        n = int(os.getenv("PDF_OCR_MIN_PAGE_TEXT_LEN", "30") or "30")
    except Exception:
        n = 30
    return max(0, min(400, n))


def _pdf_ocr_mode() -> str:
    """OCR mode: 'header' (crop top) or 'full' (entire page)."""

    v = (os.getenv("PDF_OCR_MODE", "header") or "header").strip().casefold()
    return v if v in {"header", "full"} else "header"


def _text_has_contact_signals(text: str) -> bool:
    t = (text or "")
    if not t:
        return False
    if "@" in t:
        return True

    # Avoid treating date ranges / version numbers as "contact".
    # Only treat something as phone-like if it contains enough digits.
    for m in re.finditer(r"\+?\d[\d\s().+-]{8,}\d", t):
        digits = re.sub(r"\D", "", m.group(0))
        if len(digits) >= 10:
            return True
    return False


def _pdf_should_try_ocr_first_page(extracted_text: str) -> bool:
    """Heuristic: OCR only when the extracted text looks like it's missing contact info."""

    t = (extracted_text or "").strip()
    if not t:
        return True
    # If we already got an email or a phone-like run, skip OCR.
    if "@" in t:
        return False
    for m in re.finditer(r"\+?\d[\d\s().+-]{8,}\d", t):
        digits = re.sub(r"\D", "", m.group(0))
        if len(digits) >= 10:
            return False
    # Otherwise, try OCR. Many PDFs extract the body but drop the header/contact line entirely.
    return True


def _pdf_ocr_page_text(page) -> str:
    """Return OCR text for a pdfplumber page. Returns "" on any failure."""

    pt = _lazy_pytesseract()
    if pt is None:
        return ""
    # Ensure the tesseract engine is available.
    tess_cmd = (os.getenv("TESSERACT_CMD", "") or "").strip()
    if tess_cmd:
        try:
            pt.pytesseract.tesseract_cmd = tess_cmd
        except Exception:
            return ""
    else:
        if shutil.which("tesseract") is None:
            _warn_missing_tesseract_once()
            return ""

    try:
        dpi = int(os.getenv("PDF_OCR_DPI", "200") or "200")
    except Exception:
        dpi = 200
    dpi = max(120, min(350, dpi))

    ocr_page = page
    if _pdf_ocr_mode() == "header":
        # Most resumes keep contact details in the header. Cropping makes OCR much faster.
        try:
            crop_pct = float(os.getenv("PDF_OCR_CROP_TOP_PCT", "0.3") or "0.3")
        except Exception:
            crop_pct = 0.3
        crop_pct = max(0.1, min(1.0, crop_pct))

        if crop_pct < 0.99:
            try:
                ocr_page = page.crop((0, 0, page.width, page.height * crop_pct))
            except Exception:
                ocr_page = page

    try:
        img = ocr_page.to_image(resolution=dpi).original
        txt = pt.image_to_string(img, config="--oem 3 --psm 6") or ""
        txt = normalize_text(txt)
        # Avoid flooding downstream heuristics with huge OCR blobs.
        max_chars = int(os.getenv("PDF_OCR_MAX_CHARS", "8000") or "8000")
        if max_chars > 0 and len(txt) > max_chars:
            txt = txt[:max_chars]
        return txt.strip()
    except Exception:
        return ""


def _extract_via_pypdfium2(path: str) -> str:
    """Fallback PDF text extraction using pypdfium2 (Chrome PDF engine).
    Handles PDFs that pdfplumber/pdfminer cannot parse.
    """
    try:
        import pypdfium2 as pdfium  # type: ignore
        pdf = pdfium.PdfDocument(path)
        parts = []
        for page in pdf:
            textpage = page.get_textpage()
            parts.append(textpage.get_text_range())
        return "\n".join(parts)
    except Exception:
        return ""


def extract_text_from_pdf(path: str) -> str:
    text_parts: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            extracted = page.extract_text() or ""
            if not extracted:
                # Some PDFs (esp. with complex layouts) extract poorly with defaults.
                # Try a couple of alternate settings before giving up.
                for kwargs in (
                    {"x_tolerance": 1, "y_tolerance": 1},
                    {"layout": True},
                    {"layout": True, "x_tolerance": 1, "y_tolerance": 1},
                ):
                    try:
                        extracted = page.extract_text(**kwargs) or ""
                    except Exception:
                        extracted = ""
                    if extracted:
                        break
            if extracted:
                text_parts.append(extracted)
    result = "\n".join(text_parts)
    if not result.strip():
        # pdfplumber returned nothing — try pypdfium2 (Chrome PDF engine)
        result = _extract_via_pypdfium2(path)
    return result


def extract_text_and_first_page_from_pdf(path: str) -> tuple[str, str]:
    """Return (full_text, first_page_text).

    Many resumes put name/contact/location/linkedin + target role on page 1.
    Using the first page as a priority source improves accuracy.
    """

    text_parts: list[str] = []
    first_page_text = ""
    with pdfplumber.open(path) as pdf:
        ocr_enabled = _pdf_ocr_enabled()
        ocr_pages = _pdf_ocr_pages() if ocr_enabled else 0
        ocr_max_total = _pdf_ocr_max_total_pages() if ocr_enabled else 0
        ocr_min_len = _pdf_ocr_min_page_text_len() if ocr_enabled else 0
        ocr_used = 0
        found_contact = False
        for i, page in enumerate(pdf.pages):
            extracted = page.extract_text() or ""
            if not extracted:
                for kwargs in (
                    {"x_tolerance": 1, "y_tolerance": 1},
                    {"layout": True},
                    {"layout": True, "x_tolerance": 1, "y_tolerance": 1},
                ):
                    try:
                        extracted = page.extract_text(**kwargs) or ""
                    except Exception:
                        extracted = ""
                    if extracted:
                        break
            if extracted:
                text_parts.append(extracted)
                if i == 0:
                    first_page_text = extracted
            elif i == 0:
                first_page_text = ""

            # OCR fallback for scanned/image-only pages anywhere in the document.
            if ocr_enabled and ocr_max_total > 0 and ocr_used < ocr_max_total:
                if len((extracted or "").strip()) < ocr_min_len:
                    # Temporarily switch to full-page OCR for deep scans.
                    prev_mode = os.getenv("PDF_OCR_MODE", "")
                    try:
                        os.environ["PDF_OCR_MODE"] = "full"
                        ocr_txt_any = _pdf_ocr_page_text(page)
                    finally:
                        if prev_mode:
                            os.environ["PDF_OCR_MODE"] = prev_mode
                        else:
                            os.environ.pop("PDF_OCR_MODE", None)

                    if ocr_txt_any:
                        ocr_used += 1
                        if i == 0:
                            first_page_text = (first_page_text + "\n" + ocr_txt_any).strip() if first_page_text else ocr_txt_any
                        if extracted and len(text_parts) >= 1:
                            text_parts[-1] = (text_parts[-1] + "\n" + ocr_txt_any).strip()
                        else:
                            text_parts.append(ocr_txt_any)

            # OCR fallback (opt-in): scan first N pages until we see contact signals.
            if ocr_enabled and i < ocr_pages and not found_contact:
                # Decide whether OCR could help.
                should = True
                if i == 0:
                    should = _pdf_should_try_ocr_first_page(first_page_text)
                else:
                    should = not _text_has_contact_signals(extracted)

                if should:
                    ocr_txt = _pdf_ocr_page_text(page)
                    if ocr_txt:
                        # Merge OCR output into page text and first-page (for i==0).
                        if i == 0:
                            if first_page_text:
                                first_page_text = (first_page_text + "\n" + ocr_txt).strip()
                            else:
                                first_page_text = ocr_txt

                        # Update the corresponding page slot in text_parts (best-effort).
                        if extracted and len(text_parts) >= 1:
                            text_parts[-1] = (text_parts[-1] + "\n" + ocr_txt).strip()
                        else:
                            text_parts.append(ocr_txt)

                        if _text_has_contact_signals(ocr_txt):
                            found_contact = True

            # Track whether we've already seen contact info in normal extraction.
            if not found_contact:
                if i == 0 and _text_has_contact_signals(first_page_text):
                    found_contact = True
                elif _text_has_contact_signals(extracted):
                    found_contact = True
    full_text = "\n".join(text_parts)
    if not full_text.strip():
        # pdfplumber returned nothing for all pages — try pypdfium2 (Chrome PDF engine)
        fallback = _extract_via_pypdfium2(path)
        if fallback.strip():
            # Split on form-feed or use first 3000 chars as first page approximation
            pages = fallback.split("\x0c") if "\x0c" in fallback else [fallback]
            full_text = fallback
            first_page_text = pages[0].strip() if pages else fallback
    return full_text, first_page_text


def _pdf_extract_worker(path: str, send_end) -> None:
    try:
        resume_text, first_page_text = extract_text_and_first_page_from_pdf(path)
        links = extract_links_from_pdf(path)
        send_end.send(("ok", resume_text, links, first_page_text))
    except BaseException as e:
        # Send the error back; caller decides whether to skip.
        send_end.send(("err", f"{e.__class__.__name__}: {e}"))
    finally:
        try:
            send_end.close()
        except Exception:
            pass


def extract_pdf_with_timeout(path: str, *, timeout_seconds: float) -> tuple[str, list[str], str]:
    """Extract PDF text/links in a child process with a hard timeout.

    On Windows, pdfminer can hang on certain PDFs; this keeps batch loads moving.
    """

    if timeout_seconds <= 0:
        # Explicitly allow disabling timeouts.
        full_text, first_page_text = extract_text_and_first_page_from_pdf(path)
        return full_text, extract_links_from_pdf(path), first_page_text

    ctx = mp.get_context("spawn")
    recv_end, send_end = ctx.Pipe(duplex=False)
    proc = ctx.Process(target=_pdf_extract_worker, args=(path, send_end), daemon=True)
    proc.start()
    send_end.close()

    try:
        # On some Windows/Python combinations, Pipe.poll() can block longer than
        # requested. Use Process.join(timeout) for a reliable hard timeout.
        proc.join(timeout=float(timeout_seconds))
        if proc.is_alive():
            raise TimeoutError(f"PDF extraction timed out after {timeout_seconds}s")

        if not recv_end.poll(0.1):
            raise RuntimeError("PDF extraction worker exited without returning a result")

        status, *payload = recv_end.recv()
        if status == "ok":
            resume_text, links, first_page_text = payload
            return str(resume_text), list(links), str(first_page_text)
        err_msg = payload[0] if payload else "Unknown error"
        raise RuntimeError(err_msg)
    finally:
        try:
            recv_end.close()
        except Exception:
            pass

        if proc.is_alive():
            proc.terminate()
        proc.join(timeout=5)


def extract_links_from_pdf(path: str) -> list[str]:
    links: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for link in getattr(page, "hyperlinks", []) or []:
                uri = link.get("uri")
                if uri:
                    links.append(str(uri))

    seen = set()
    out: list[str] = []
    for u in links:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def extract_text_from_docx(path: str) -> str:
    if Document is None:
        raise RuntimeError("python-docx is not installed; cannot parse DOCX")
    doc = Document(path)

    def _extract_xml_text() -> str:
        """Best-effort extraction of text from DOCX XML.

        python-docx does not surface all text in shapes/textboxes. This recovers
        those cases by reading word/document.xml (+ header/footer parts).
        """

        try:
            with zipfile.ZipFile(path) as z:
                parts = [
                    n
                    for n in z.namelist()
                    if n == "word/document.xml" or n.startswith("word/header") or n.startswith("word/footer")
                ]
                if not parts:
                    return ""

                tokens: list[str] = []
                for name in parts:
                    try:
                        root = ET.fromstring(z.read(name))
                    except Exception:
                        continue
                    for el in root.iter():
                        # w:t contains text runs; w:instrText can contain hyperlink fields.
                        if not isinstance(el.tag, str):
                            continue
                        if el.tag.endswith("}t") or el.tag.endswith("}instrText"):
                            if el.text:
                                tokens.append(el.text)

                # Join with spaces: downstream email extraction collapses spaced punctuation.
                return normalize_text(" ".join(tokens))
        except Exception:
            return ""

    def _add(lines: list[str], s: str) -> None:
        t = (s or "").strip()
        if not t:
            return
        # Split multi-line cell texts while preserving order.
        for ln in t.splitlines():
            ln = ln.strip()
            if ln:
                lines.append(ln)

    parts: list[str] = []

    # ── Header/footer content FIRST — this is where candidate name,
    # contact info, and job title typically live in professionally
    # formatted DOCX resumes.  Placing it before body paragraphs
    # ensures ``extract_name`` (which scans from the top) finds the
    # name on the earliest lines.
    for section in getattr(doc, "sections", []) or []:
        for hf in (getattr(section, "header", None), getattr(section, "footer", None)):
            if hf is None:
                continue
            for para in getattr(hf, "paragraphs", []) or []:
                _add(parts, getattr(para, "text", ""))
            for table in getattr(hf, "tables", []) or []:
                for row in getattr(table, "rows", []) or []:
                    for cell in getattr(row, "cells", []) or []:
                        _add(parts, getattr(cell, "text", ""))

    # Body paragraphs
    for para in doc.paragraphs:
        _add(parts, getattr(para, "text", ""))

    # Tables are common for 2-column contact headers (phone/email/location).
    for table in getattr(doc, "tables", []) or []:
        for row in getattr(table, "rows", []) or []:
            for cell in getattr(row, "cells", []) or []:
                _add(parts, getattr(cell, "text", ""))

    # Fallback: if the visible DOCX text appears to lack contact info, try XML text.
    # This recovers email/phone/location stored inside Word textboxes/shapes.
    current = "\n".join(parts)
    if not _text_has_contact_signals(current):
        xml_text = _extract_xml_text()
        if _text_has_contact_signals(xml_text):
            _add(parts, xml_text)

    # De-duplicate while preserving order (tables/headers can repeat body text).
    seen: set[str] = set()
    out: list[str] = []
    for ln in parts:
        key = re.sub(r"\s+", " ", ln).strip()
        if not key:
            continue
        if key in seen:
            continue
        seen.add(key)
        out.append(ln)

    return "\n".join(out)


def normalize_text(text: str) -> str:
    # psycopg2 refuses NUL (0x00) characters in text fields.
    text = text.replace("\x00", "")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[\t\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def file_sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def non_empty_lines(text: str) -> list[str]:
    return [ln.strip() for ln in text.split("\n") if ln.strip()]


# Major section headings that signal the start of the body of a resume.
# The first occurrence of any of these marks the end of the "first page / header block".
_RESUME_SECTION_RE = re.compile(
    r"^\s*(?:"
    r"(?:professional\s+)?(?:work\s+)?experience|employment(?:\s+history)?|"
    r"work\s+history|career\s+(?:history|summary|objective)|"
    r"(?:professional\s+)?summary|objective|"
    r"(?:technical\s+)?skills?(?:\s+(?:summary|profile|set|overview))?|"
    r"core\s+(?:competencies|skills)|key\s+skills?|"
    r"areas?\s+of\s+expertise|technical\s+expertise|technical\s+proficiencies?|"
    r"education(?:al)?(?:\s+background)?|academic(?:\s+background)?|"
    r"qualifications?|certifications?|courses?|training|"
    r"projects?(?:\s+(?:summary|experience))?|"
    r"publications?|awards?|honors?|achievements?|"
    r"languages?|interests?|hobbies|volunteer|extracurricular|references?"
    r")\s*(?::|$)",
    re.IGNORECASE | re.MULTILINE,
)


def _extract_docx_header_block(text: str) -> str:
    """Return the header block of a DOCX resume as a 'first-page' proxy.

    Scans for the first major section heading (Experience, Skills, Education…)
    and returns everything before it.  This mirrors what ``first_page_text`` does
    for PDFs so that all field-extraction logic can use the same priority path
    regardless of file format.

    Returns the full text unchanged when no section heading is found.
    """
    lines = text.splitlines()
    total = len(lines)
    cut_at = total  # default: no cut
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Gate: must be short enough to be a heading, not a body sentence.
        if not stripped or len(stripped) > 80:
            continue
        # Require at least 6 non-empty lines already seen to avoid cutting at the
        # very top (some resumes have "Summary" as their first line).
        non_empty_so_far = sum(1 for ln in lines[:i] if ln.strip())
        if non_empty_so_far < 6:
            continue
        if _RESUME_SECTION_RE.match(stripped):
            cut_at = i
            break
    block = "\n".join(lines[:cut_at]).strip()
    # Sanity-check: if the block looks too short compared to the full text
    # (likely a bad cut), fall back to the first 40 non-empty lines of the doc.
    non_empty_block = [ln for ln in block.splitlines() if ln.strip()]
    if len(non_empty_block) < 4 and total > 20:
        non_empty_all = [ln for ln in lines if ln.strip()]
        block = "\n".join(non_empty_all[:40])
    return block


def _build_header_text(
    resume_text: str,
    links: list[str] | None = None,
    *,
    max_lines: int = 60,
    max_chars: int = 2600,
    fraction: float = 0.25,
) -> tuple[str, str]:
    """Return (top_text, top_extraction_text) from the top part of the resume.

    User hint: most key fields are in the top section/header area.
    We *prioritize* this block for extraction, but always fall back to full text.

    The slice is dynamic (fraction of total lines) with a hard cap to reduce noise.
    """

    lines = [_segment_compact_line(ln) for ln in non_empty_lines(resume_text)]
    if not lines:
        base_text = ""
    else:
        frac = fraction
        if not (0.05 <= frac <= 0.9):
            frac = 0.25
        n = max(12, int(len(lines) * frac))
        n = min(n, int(max_lines))
        base_text = "\n".join(lines[:n])

    if max_chars and len(base_text) > int(max_chars):
        base_text = base_text[: int(max_chars)]

    links = links or []
    extraction_text = base_text + ("\n" + "\n".join(links) if links else "")
    return base_text, extraction_text


def _segment_compact_line(line: str) -> str:
    """Lightly re-segment compact PDF text (missing spaces).

    Applies only safe heuristics (CamelCase, dots as separators) so downstream
    name/title extraction can still use word boundaries.
    """

    s = (line or "").strip()
    if not s:
        return ""

    # Only do aggressive re-segmentation for lines that are unusually compact.
    if s.count(" ") <= 1:
        s = s.replace("|", " | ")
        s = s.replace("·", " · ")
        s = s.replace("•", " • ")
        # Treat dots as separators in compact tokens (e.g., "Sr.FullStackDeveloper").
        s = s.replace(".", " ")

    # Split CamelCase runs: "FullStackDeveloper" -> "Full Stack Developer"
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", s)
    # Split letters/digits: "EngineerII" or "Engineer2" -> "Engineer II" / "Engineer 2"
    s = re.sub(r"([A-Za-z])(\d)", r"\1 \2", s)
    s = re.sub(r"(\d)([A-Za-z])", r"\1 \2", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


@lru_cache(maxsize=1)
def _skills_master_set() -> set[str]:
    """Load skills_master.txt into a normalized set.

    Used only for heuristics (e.g., avoid treating a skills line as a job title).
    """

    path = Path(__file__).with_name("skills_master.txt")
    try:
        raw = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return set()
    out: set[str] = set()
    for ln in raw.splitlines():
        t = ln.strip()
        if not t or t.startswith("#"):
            continue
        out.add(t.casefold())
    return out


# ---------------- BASIC FIELDS ----------------
def extract_email(text):
    """Extract best email address from text.

    The resume header often contains the email, but PDFs can introduce spacing like
    "john @ gmail . com". Some resumes also obfuscate as "john (at) gmail (dot) com".

    Important: avoid global "at"/"dot" replacements (they create false positives like
    "applic@ions.Implemented").
    """

    if not text:
        return None

    candidates: list[str] = []

    # 1) Normal emails (including spaced punctuation)
    t = text
    t = re.sub(r"\s*@\s*", "@", t)
    t = re.sub(r"\s*\.\s*", ".", t)
    for m in re.finditer(r"(?:mailto:)?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})", t, flags=re.I):
        candidates.append(m.group(1))

    # 2) Obfuscated pattern: name (at) domain (dot) tld
    obf = re.compile(
        r"(?i)\b([A-Z0-9._%+-]{2,})\b\s*(?:\(|\[)?\s*at\s*(?:\)|\])?\s*\b([A-Z0-9.-]{2,})\b\s*(?:\(|\[)?\s*dot\s*(?:\)|\])?\s*\b([A-Z]{2,})\b"
    )
    for m in obf.finditer(text):
        local, domain, tld = m.group(1), m.group(2), m.group(3)
        candidates.append(f"{local}@{domain}.{tld}")

    if not candidates:
        return None

    # Dedupe preserving order
    seen: set[str] = set()
    uniq: list[str] = []
    for e in candidates:
        e = (e or "").strip().strip("<>[](){}.,;:\"")
        if not e:
            continue
        k = e.casefold()
        if k in seen:
            continue
        seen.add(k)
        uniq.append(e)

    def score(email: str) -> int:
        e = (email or "").strip()
        m = re.fullmatch(r"([A-Z0-9._%+-]+)@([A-Z0-9.-]+)\.([A-Z]{2,})", e, flags=re.I)
        if not m:
            return -10
        local, domain, tld = m.group(1), m.group(2), m.group(3)
        local_cf = local.casefold()
        domain_cf = domain.casefold()
        tld_cf = tld.casefold()

        # Hard rejects
        if len(local) < 2 or len(local) > 64:
            return -10
        if len(domain) < 3 or len(domain) > 253:
            return -10
        if local.startswith(".") or local.endswith("."):
            return -10
        if ".." in local or ".." in domain:
            return -10

        s = 0
        # Prefer local-parts with letters (numeric-only locals are often extraction junk).
        if any(ch.isalpha() for ch in local):
            s += 30
        else:
            s -= 40

        # Prefer common real domains slightly.
        if domain_cf in {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com"}:
            s += 10

        # Penalize weird TLDs that look like words (often false positives like "Implemented").
        if len(tld_cf) > 10:
            s -= 30

        # Penalize locals that are very short numeric runs (e.g., "111@gmail.com").
        if local.isdigit() and len(local) <= 4:
            s -= 30

        # Prefer earlier-looking emails by leaving tie-breaking to order; score only content.
        return s

    best = None
    best_score = -10**9
    for e in uniq:
        s = score(e)
        if s > best_score:
            best_score = s
            best = e

    # If all candidates look bad, prefer NULL over a likely-wrong email.
    if best is None or best_score < 0:
        return None
    return best


def format_phone_display(phone_value: str | int | None) -> str | None:
    """Format phone for display/storage.

    If the value looks like a US/NANP number (10 digits or 11 digits starting with 1),
    returns: +1(###)-###-####

    Otherwise returns a conservative "+<digits>" for international-ish values, or None.
    """

    if phone_value is None:
        return None

    digits = re.sub(r"\D+", "", str(phone_value))
    if not digits:
        return None

    # Drop obvious placeholders
    if set(digits) == {"0"}:
        return None

    # US/NANP
    if len(digits) == 10:
        a, b, c = digits[:3], digits[3:6], digits[6:]
        return f"+1({a})-{b}-{c}"
    if len(digits) == 11 and digits.startswith("1"):
        a, b, c = digits[1:4], digits[4:7], digits[7:]
        return f"+1({a})-{b}-{c}"

    # International-ish: keep as +<digits> where possible
    if 10 <= len(digits) <= 15:
        return f"+{digits}" if not str(phone_value).strip().startswith("+") else f"+{digits.lstrip('+')}"

    return None


def extract_phone(text):
    """Return best phone number as digits-only string.

    Supports international formats when `phonenumbers` is installed.
    """

    if not text:
        return None

    # Normalize unicode digits to ASCII digits.
    def _normalize_digits(s: str) -> str:
        out_chars: list[str] = []
        for ch in (s or ""):
            if ch.isdigit():
                try:
                    out_chars.append(str(unicodedata.digit(ch)))
                except Exception:
                    out_chars.append(ch)
            else:
                out_chars.append(ch)
        return "".join(out_chars)

    text = _normalize_digits(text)

    # Prefer scanning obvious contact lines first to avoid false positives
    # from experience bullets (years, versions, etc.).
    phone_kw = re.compile(r"(?i)\b(phone|mobile|cell|tel|telephone|contact)\b")
    lines = non_empty_lines(text)
    priority_lines = [ln for ln in lines[:120] if phone_kw.search(ln)]
    priority_text = "\n".join(priority_lines) if priority_lines else ""

    default_region = os.getenv("PHONE_DEFAULT_REGION", "US")

    # Prefer library-based parsing (handles many international formats).
    if phonenumbers is not None:
        # Normalize common international prefix "00" -> "+" (e.g., "0044 20 ..." -> "+44 20 ...").
        lib_text = re.sub(r"(?<!\d)00(?=\d)", "+", text)
        candidates: list[tuple[int, str]] = []
        try:
            for source_text, source_bonus in ((priority_text, 30), (lib_text, 0)):
                if not source_text:
                    continue
                for match in phonenumbers.PhoneNumberMatcher(source_text, default_region):
                    num = match.number
                    if not phonenumbers.is_possible_number(num):
                        continue
                    # Some resumes use odd separators/parentheses; accept "possible" even if
                    # not strictly "valid" for the default region.
                    if not phonenumbers.is_valid_number(num):
                        # But still keep it if it has a country code (explicit +..) or looks like NANP.
                        if not getattr(num, "country_code", None):
                            continue

                    e164 = phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)  # +123...
                    digits = re.sub(r"\D+", "", e164)
                    if not digits or len(digits) < 10 or len(digits) > 15:
                        continue

                    score = source_bonus
                    if e164.startswith("+1"):
                        score += 30
                    # Prefer earlier occurrences slightly.
                    score += max(0, 30 - match.start)
                    # Prefer numbers that look like common national lengths.
                    if len(digits) in {10, 11}:
                        score += 8
                    candidates.append((score, digits))

        except Exception:
            candidates = []

        if candidates:
            candidates.sort(key=lambda x: x[0], reverse=True)
            return candidates[0][1]

    # Regex fallback: tolerate many separators and odd grouping (e.g., "+1 (915) (895) 2020", "98765 43210").
    fallback: list[str] = []

    def _collect_candidates(blob: str) -> None:
        if not blob:
            return
        # Grab number-like chunks, then validate by digit count.
        for m in re.finditer(r"(?:(?:\+|00)?\d[\d\s().\-]{7,}\d)", blob):
            chunk = m.group(0)
            # Avoid common date/version formats.
            if re.search(r"\b\d{4}\s*[/-]\s*\d{2,4}\b", chunk):
                continue
            digits = re.sub(r"\D+", "", chunk)
            if 10 <= len(digits) <= 15:
                fallback.append(digits)

        # Explicit 10-15 digit runs.
        for m in re.finditer(r"\b\d{10,15}\b", blob):
            fallback.append(m.group(0))

    _collect_candidates(priority_text)
    _collect_candidates(text)

    if not fallback:
        return None

    # Prefer +1-like 11-digit starting with 1 by trimming to 10 if valid
    def is_valid_us_10(d: str) -> bool:
        if len(d) != 10 or not d.isdigit():
            return False
        if d[0] in "01" or d[3] in "01":
            return False
        return True

    best = None
    best_score = -1
    for d in fallback:
        score = 0
        if len(d) == 11 and d.startswith("1") and is_valid_us_10(d[1:]):
            score = 90
            d = d[1:]
        elif is_valid_us_10(d):
            score = 80
        else:
            score = 10

        if score > best_score:
            best_score = score
            best = d

    return best


def _name_from_email(email: str) -> tuple[str, str]:
    email = (email or "").strip()
    if not email or "@" not in email:
        return "", ""

    local, domain = email.split("@", 1)
    domain = domain.casefold().strip()

    # Avoid anonymized/job-board relay addresses that frequently contain junk tokens.
    if domain in {"indeedemail.com", "indeed.com"}:
        return "", ""

    # Underscore-heavy locals are usually non-name identifiers.
    if "_" in local:
        return "", ""

    local = re.sub(r"\+.*$", "", local)  # john.doe+tag -> john.doe
    parts = [p for p in re.split(r"[._\-\s]+", local) if p]
    parts = [re.sub(r"\d+", "", p) for p in parts]
    parts = [p for p in parts if re.fullmatch(r"[A-Za-z]{2,}", p)]
    if len(parts) >= 2:
        # Reject non-person locals like "techengineer.work".
        roleish = {
            "developer",
            "engineer",
            "architect",
            "analyst",
            "consultant",
            "tester",
            "qa",
            "devops",
            "sre",
            "manager",
            # Common non-name suffixes in handles
            "ds",
            "de",
            "dev",
            "it",
            "hr",
        }
        utility = {"work", "jobs", "career", "resume", "admin", "test", "testing"}

        lowered_parts = [p.casefold() for p in parts]
        if any(p in utility for p in lowered_parts):
            return "", ""
        if any(any(r in p for r in roleish) for p in lowered_parts):
            return "", ""

        # Heuristic: very long + very short token pairs are usually random ids.
        if len(parts[0]) > 14 and len(parts[-1]) <= 3:
            return "", ""
        fn, ln = parts[0].title(), parts[-1].title()

        # Heuristic swap for emails like "ahn.christopher..." where the first token
        # is a short surname and the second token is a long first name.
        if len(parts[0]) <= 3 and len(parts[-1]) >= 5:
            fn, ln = ln, fn

        return fn, ln
    return "", ""


def extract_name(text: str, *, email: str | None = None) -> tuple[str, str]:
    """Extract candidate name from top-of-resume text.

    Heuristic scoring works better than a single rule, especially for PDFs.
    """

    email_guess: tuple[str, str] = ("", "")
    if email:
        # Email-based inference can be useful, but should not override a clean
        # header name when one exists in the resume text.
        email_guess = _name_from_email(email)

    def looks_like_name_tokens(tokens: list[str]) -> bool:
        # Allow common header patterns:
        # - "Divya" (single token)
        # - "YOGENDRA P" / "Srichandu B" (last initial)
        # - "Satya Veni Chelluboina" (multi-token)
        if not (1 <= len(tokens) <= 5):
            return False

        normalized = [re.sub(r"[^A-Za-z'-]", "", t) for t in tokens]
        normalized = [t for t in normalized if t]
        if not normalized:
            return False

        if len(normalized) == 1:
            return len(normalized[0]) >= 3 and re.fullmatch(r"[A-Za-z][A-Za-z'-]*", normalized[0]) is not None

        valid_long = 0
        has_initial = False
        for t in normalized:
            if re.fullmatch(r"[A-Za-z]", t):
                has_initial = True
                continue
            if len(t) >= 2 and re.fullmatch(r"[A-Za-z][A-Za-z'-]*", t):
                valid_long += 1

        # At least two 2+ letter tokens, or one 2+ letter token plus an initial.
        return valid_long >= 2 or (valid_long >= 1 and has_initial)

    role_words = {
        "developer",
        "engineer",
        "analyst",
        "architect",
        "consultant",
        "scientist",
        "tester",
        "qa",
        "manager",
        "administrator",
        "specialist",
        "lead",
        "intern",
        # Common title/skill tokens that frequently get misread as a surname.
        "data",
        "net",
        "software",
        "development",
        "solutions",
        "operations",
        "operation",
        "stack",
        "full",
        "states",
        "dashboard",
        "dashboards",
        "kpi",
        "kpis",
        "informed",
        "decision",
        "decisions",
        "making",
        "united",
        "hive",
        "spark",
        # Management / training / process tokens misclassified as names.
        "training",
        "management",
        "project",
        "testing",
        "agile",
        "scrum",
        "waterfall",
        # Seniority tokens that should not be treated as a person's first name.
        "sr",
        "senior",
        "jr",
        "junior",
        # Degree abbreviations that should never be treated as a surname.
        "msc",
        "bsc",
        "btech",
        "mtech",
        "mba",
        "phd",
        "bca",
        "mca",
        "com",
        "eng",
        "frontend",
        "backend",
        # Java / tech framework names that appear at the start of two-column DOCX
        # files (skills column is read before the name column) and can score high
        # as name candidates at idx=0.  They must never be accepted as a person's
        # first or last name.
        "hibernate",
        "spring",
        "maven",
        "gradle",
        "struts",
        "tomcat",
        "webpack",
        "docker",
        "kubernetes",
        # Contact/label tokens that bleed into name fields.
        "email",
        "phone",
        "mobile",
        "location",
        "address",
        # Generic tech compound words picked up as names by NER.
        "web",
        "based",
        "machine",
        "learning",
        "cloud",
        "watch",
        "entity",
        "framework",
        "reduce",
        "map",
        "intranet",
        "extranet",
        "portal",
        "platform",
        "server",
        "client",
        "service",
        "system",
        "database",
        "network",
        # Immigration / civil status words that appear in headers.
        "citizen",
        "permanent",
        "resident",
        "authorization",
        "authorized",
        # Abbreviations for role phrases (e.g., FSD = Full Stack Developer).
        "fsd",
        # Microsoft / web tech compound words misread as names.
        "asp",
        "mvc",
        "visual",
        "studio",
    }
    section_words = {
        "professional summary",
        "summary",
        "profile",
        "objective",
        "curriculum",
        "resume",
        "experience",
        "education",
        "skills",
        "certifications",
        "certification",
        "methodologies",
        "methodology",
        "programming languages",
        "languages",
        "frameworks",
        "libraries",
        "tools",
        "cloud",
        "databases",
        "web technologies",
        "about me",
        # Common section headers that can be misclassified as a name.
        "expertise snapshot",
        "applications technologies",
        "technical",
        "proficiencies",
        "technical proficiencies",
        "core competencies",
        "key skills",
        "technical skills",
        "technical expertise",
        "tools and technologies",
        "technical summary",
        "core skills",
    }

    lines = [_segment_compact_line(ln) for ln in non_empty_lines(text)]
    skills_master = _skills_master_set()
    candidates: list[tuple[int, tuple[str, str]]] = []

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
    city_state_re = re.compile(r"\b[A-Za-z][A-Za-z .'-]{1,},\s*(" + "|".join(sorted(US_STATE_ABBRS)) + r")\b")
    # Also catch full US state names, e.g. "Fairfield, Iowa" or "Irving, Texas".
    _US_FULL_STATE_RE = re.compile(
        r"\b[A-Za-z][A-Za-z .'-]{1,},\s*(?:"
        r"Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|"
        r"Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|"
        r"Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|"
        r"Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|"
        r"New\s+Hampshire|New\s+Jersey|New\s+Mexico|New\s+York|"
        r"North\s+Carolina|North\s+Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|"
        r"Rhode\s+Island|South\s+Carolina|South\s+Dakota|Tennessee|Texas|"
        r"Utah|Vermont|Virginia|Washington|West\s+Virginia|Wisconsin|Wyoming|"
        r"District\s+of\s+Columbia"
        r")\b",
        re.IGNORECASE,
    )

    def is_label_line(ln: str) -> bool:
        m = re.match(r"^\s*([A-Za-z][A-Za-z &/]{0,30})\s*:\s+", ln)
        if not m:
            return False
        label = m.group(1).strip().casefold()
        return label in section_words

    def split_name_from_header(ln: str) -> str:
        # Two-column DOCX headers often look like:
        # "Satya Veni Chelluboina              Java Full Stack Developer"
        # After _segment_compact_line, multi-spaces may be collapsed to one:
        # "NIHARIKA A Phone: +1(469)301-6649"
        parts = [p.strip() for p in re.split(r"\s{3,}", ln) if p.strip()]
        if len(parts) <= 1:
            # Split on pipe separators: "Ron Divina | Java Full Stack Developer"
            parts = [p.strip() for p in re.split(r"\s*\|\s*", ln) if p.strip()]
        if len(parts) <= 1:
            # Split on en-dash / em-dash separators commonly used between
            # name and role, e.g. "Praveen SS – Python/Java Developer"
            parts = [p.strip() for p in re.split(r"\s*[\u2013\u2014]\s*", ln) if p.strip()]
        if len(parts) <= 1:
            # Fallback: split on contact/title labels when spaces were collapsed
            # e.g. "NIHARIKA A Phone: +1(469)" → "NIHARIKA A"
            parts = [p.strip() for p in re.split(
                r"(?i)\s+(?:phone|email|e-?mail|mobile|cell|tel|linkedin|github|address|location)\s*:",
                ln,
            ) if p.strip()]
        return parts[0] if parts else ln

    bad_name_leading_tokens = {
        "and",
        "or",
        "for",
        "with",
        "based",
        "implementing",
        "building",
        "build",
        "developing",
        "developed",
        "data",
        "skills",
        "summary",
        "objective",
        # Additional bad leading tokens
        "used",
        "using",
        "tracking",
        "technical",
        "core",
        "key",
        "various",
        "responsible",
        "worked",
        "working",
        # Label/field tokens surviving contact stripping
        "id",
        "designation",
        "role",
    }

    # Scan up to 50 lines: the first-page / header-block can be quite tall
    # (contact info, LinkedIn, address, title all precede the actual name on some layouts).
    for idx, line in enumerate(lines[:50]):
        if is_label_line(line):
            continue

        line = split_name_from_header(line)
        if is_label_line(line):
            continue

        lnl = line.lower().strip()
        if not lnl or lnl.endswith(":"):
            continue

        def strip_contact_tokens(ln: str) -> str:
            # Remove URLs
            ln = re.sub(r"(?i)https?://\S+", " ", ln)
            ln = re.sub(r"(?i)\bwww\.\S+", " ", ln)
            # Remove space-separated URL tokens produced by _segment_compact_line
            # e.g. "https://www linkedin com/in/niharikaar/"  → strip "linkedin" residual
            # Also strip any token that looks like a URL path fragment (word/word/word)
            ln = re.sub(r"(?i)\b[a-z0-9-]+/in/[a-z0-9-]+/?", " ", ln)  # e.g. com/in/niharikaar/
            # Handle _segment_compact_line-split email usernames, e.g.:
            #   "shiva313757@gmail.com" -> "shiva 313757@gmail.com" after segmentation.
            # Remove the whole pattern (word + digits@domain) before the standard email pass.
            ln = re.sub(r"(?i)\b[A-Za-z][A-Za-z0-9]*\s+\d+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", " ", ln)
            # Same pattern but when _segment_compact_line also split the TLD (no .com):
            # e.g. "Saikrishnad 18115@gmail com" - strip "Saikrishnad 18115@gmail" entirely.
            ln = re.sub(r"(?i)\b[A-Za-z][A-Za-z0-9]*\s+\d+@[A-Za-z0-9-]+\b", " ", ln)
            # Remove emails (standard and spacing variants)
            ln = re.sub(r"(?i)\b[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}\b", " ", ln)
            ln = re.sub(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", " ", ln)
            # Partial email tokens where _segment_compact_line broke the TLD to a separate word:
            # e.g. "ronaldbamker@yahoo com" - strip the "word@domain" part (no TLD).
            ln = re.sub(r"(?i)\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\b", " ", ln)
            # Remove any orphaned @domain fragments (e.g. "@gmail" left after number stripping).
            ln = re.sub(r"@[A-Za-z0-9][A-Za-z0-9.-]*", " ", ln)
            # Remove phone-like runs
            ln = re.sub(r"\b\+?\d[\d ()\-]{8,}\d\b", " ", ln)
            # Remove common labels — including segmented "Linked In" form of "LinkedIn"
            ln = re.sub(r"(?i)\b(mail\s*id|e-?mail|email|phone|mobile|linked\s*in|linkedin|github)\b\s*[:\-]?", " ", ln)
            # Remove stray numbers/ids in the header (e.g., LinkedIn slug numbers)
            ln = re.sub(r"\b\d{2,}\b", " ", ln)
            ln = re.sub(r"\s+", " ", ln).strip(" ,|\t")
            return ln

        if any(k in lnl for k in ["@", "linkedin", "github", "http", "www."]):
            stripped = strip_contact_tokens(line)
            if stripped:
                line = stripped
                lnl = line.lower().strip()
            else:
                continue
        if any(k in lnl for k in section_words):
            continue
        if sum(ch.isdigit() for ch in line) >= 2:
            continue

        # Avoid city/state header lines being treated as names (e.g., "Fort Mill, SC" or "Fairfield, Iowa").
        if city_state_re.search(line) or _US_FULL_STATE_RE.search(line):
            continue

        # Normalize separators and remove common prefix labels.
        cleaned = re.sub(r"(?i)^name\s*[:\-]\s*", "", line).strip()
        cleaned = re.sub(r"\s+", " ", cleaned)
        cleaned = cleaned.strip(" ,|-\t")

        # Tokenize and drop common suffixes.
        tokens = [t for t in re.split(r"\s+", cleaned) if t]
        tokens = [t.strip(",.") for t in tokens]
        # Drop tokens ending with ':' — they are field labels (e.g. "id:", "Designation:")
        # that survived contact-info stripping, never person names.
        tokens = [t for t in tokens if not t.endswith(":")]
        suffixes = {"jr", "sr", "ii", "iii", "iv",
                    "msc", "bsc", "mba", "phd", "btech", "mtech",
                    "be", "bca", "mca", "mca", "mca"}
        while tokens and tokens[-1].lower().strip(".") in suffixes:
            tokens = tokens[:-1]
        if not looks_like_name_tokens(tokens):
            continue
        if tokens and tokens[0].casefold() in bad_name_leading_tokens:
            continue
        # Suffixes that, when present at the end of any token, mark it as a role word.
        _role_suffixes = ("developer", "engineer", "analyst", "architect",
                          "consultant", "specialist", "administrator")

        def is_role_token(tok: str) -> bool:
            t = tok.lower().strip(".,")
            if t in role_words:
                return True
            if t.endswith("ing") and t[:-3] in role_words:
                return True
            # Catch compound role tokens like "Dotnetdeveloper", "Javadeveloper"
            if any(t.endswith(sfx) for sfx in _role_suffixes) and len(t) > min(len(sfx) for sfx in _role_suffixes):
                return True
            return False

        if any(is_role_token(t) for t in tokens):
            # If it's a name followed by a title, keep only the name prefix.
            prefix: list[str] = []
            for t in tokens:
                if is_role_token(t):
                    break
                prefix.append(t)
            if looks_like_name_tokens(prefix):
                tokens = prefix
            else:
                continue

        # Avoid picking skill/keyword lines (e.g., "Inheritance Encapsulation").
        # If multiple tokens match known skills, it's very unlikely to be a person's name.
        skill_hits = 0
        for t in tokens:
            t_norm = re.sub(r"[^A-Za-z0-9.+#]", "", t).casefold()
            if t_norm and t_norm in skills_master:
                skill_hits += 1
        if skill_hits >= 2:
            continue
        # A line that is a single known-skill token (e.g. "Hibernate", "Spring",
        # "Maven") can never be a person's name — DOCX two-column layouts can put
        # framework names at idx=0, beating the real name at a later line.
        if skill_hits >= 1 and len(tokens) == 1:
            continue

        # Score: earlier lines + cleaner tokens are better.
        score = 0
        score += max(0, 60 - idx * 3)

        # Bonus if line is ALL CAPS (common in headers) but still name-like.
        letters = re.sub(r"[^A-Za-z]", "", cleaned)
        if letters and letters.isupper():
            score += 10

        # Penalty for odd punctuation.
        if re.search(r"[{}<>\\/]", cleaned):
            score -= 10

        first = tokens[0]
        last = tokens[-1] if len(tokens) >= 2 else ""
        last_alpha = re.sub(r"[^A-Za-z]", "", last)
        # Drop empty/zero-alpha tokens.
        # Keep uppercase single-letter last initials (e.g. "Harsha K", "YOGENDRA P")
        # regardless of their line index — pdfplumber produces slightly different
        # line counts on Linux (Docker) vs Windows, making any fixed idx threshold
        # environment-dependent and the root cause of local/server result differences.
        # Only drop if: no alpha content, or it's a lowercase single char
        # (likely a stray letter), or it matches a US state abbreviation.
        if len(last_alpha) == 0:
            last = ""
        elif len(last_alpha) == 1:
            if last_alpha.isupper() and last_alpha not in US_STATE_ABBRS:
                pass  # genuine last initial – keep it
            elif idx <= 5:
                pass  # within header zone – keep regardless
            else:
                last = ""

        first = first[:1].upper() + first[1:].lower() if first else ""
        last = last[:1].upper() + last[1:].lower() if last else ""
        if first:
            candidates.append((score, (first, last)))

    # spaCy NER boost
    # PERSON entities from the top 5 lines are added as supplementary candidates
    # with score capped at 59 - BELOW the heuristic line-0 minimum of 60 so that
    # a well-scored heuristic candidate (e.g. ALL-CAPS line-0 = 70) always wins.
    # Using only 5 lines prevents tech bullet-point terms (Cloud Watch, Entity
    # Framework, Machine Learning, Map Reduce, Web Based) from being misclassified
    # as PERSON entities and beating the correct heuristic candidate.
    if _SPACY_NER_AVAILABLE and _SPACY_NLP is not None:
        try:
            _ner_header = " ".join(str(ln) for ln in lines[:5])
            _doc = _SPACY_NLP(_ner_header[:400])
            for _ent in _doc.ents:
                if _ent.label_ == "PERSON":
                    _etoks = [t.strip(".,") for t in _ent.text.split() if t.strip(".,")]
                    if not looks_like_name_tokens(_etoks):
                        continue
                    if _etoks[0].casefold() in bad_name_leading_tokens:
                        continue
                    _sfn = _etoks[0][:1].upper() + _etoks[0][1:].lower()
                    _sln = (_etoks[-1][:1].upper() + _etoks[-1][1:].lower()) if len(_etoks) >= 2 else ""
                    # Skip if either token is a role/contact/tech word.
                    if _sfn.casefold() in role_words or _sln.casefold() in role_words:
                        continue
                    # Cap at 59 so heuristic line-0 (score 60) always beats NER.
                    _ner_score = min(59, 57 + max(0, 5 - _ent.start))
                    candidates.append((_ner_score, (_sfn, _sln)))
        except Exception:
            pass
    # ── end NER boost ────────────────────────────────────────────

    if not candidates:
        # Fall back to email-based guess if nothing else was found.
        fn_e, ln_e = email_guess
        return (fn_e, ln_e) if fn_e else ("", "")

    candidates.sort(key=lambda x: x[0], reverse=True)

    best_first, best_last = candidates[0][1]
    if best_first and not best_last and email:
        # Special case: compact all-caps concatenation like "MOHSINRIAZ".
        # If the email local part contains a plausible first-name prefix, split it.
        token = re.sub(r"[^A-Za-z]", "", best_first)
        if token and token.isalpha() and token.casefold() == best_first.casefold() and 6 <= len(token) <= 24:
            local = email.split("@", 1)[0]
            local_parts = [p for p in re.split(r"[._\-\s]+", local) if p]
            local_parts = [re.sub(r"\d+", "", p) for p in local_parts]
            local_parts = [p for p in local_parts if re.fullmatch(r"[A-Za-z]{3,}", p)]
            token_cf = token.casefold()
            for p in local_parts:
                p_cf = p.casefold()
                if token_cf.startswith(p_cf) and len(token_cf) - len(p_cf) >= 3:
                    remainder = token_cf[len(p_cf) :]
                    return p_cf.title(), remainder.title()
    return best_first, best_last


def infer_name_from_filename(file_name: str, *, email: str | None = None) -> tuple[str, str]:
    raw = unicodedata.normalize("NFKC", Path(file_name).stem)

    # If the filename itself looks like a URL/email, it's not a clean name signal.
    raw_cf = raw.casefold()
    if any(x in raw_cf for x in ("@", "http", "www.")):
        return "", ""

    # Strip common non-name tokens and separators.
    base = raw
    base = re.sub(r"(?i)^(resume|cv|profile)\b", " ", base)
    base = re.sub(r"(?i)\b(resume|cv|profile)\b", " ", base)
    base = re.sub(r"\b\d{4,}\b", " ", base)  # remove long numeric ids
    base = re.sub(r"\b\+?\d[\d ()\-]{8,}\d\b", " ", base)  # remove phone-like runs
    base = re.sub(r"[_.\-]+", " ", base).strip()

    # Insert spaces for CamelCase in a Unicode-aware way.
    spaced: list[str] = []
    prev = ""
    for ch in base:
        if prev and prev.isalpha() and ch.isalpha() and prev.islower() and ch.isupper():
            spaced.append(" ")
        spaced.append(ch)
        prev = ch
    base = "".join(spaced)
    base = re.sub(r"\s+", " ", base).strip()

    utility_tokens = {
        "resume",
        "cv",
        "profile",
        "final",
        "latest",
        "updated",
        "update",
        "new",
        "copy",
        "draft",
        "version",
    }

    # If the filename contains skills/roles or organization-ish tokens, don't trust it.
    # This prevents cases like "ResumeJavaDeveloper.pdf" or "ResumeInfosysVarun.pdf".
    roleish_tokens = {
        "developer",
        "engineer",
        "architect",
        "analyst",
        "consultant",
        "tester",
        "qa",
        "devops",
        "sre",
        "manager",
        "intern",
        "lead",
        "fullstack",
        "backend",
        "frontend",
        "datascientist",
        "scientist",
        "admin",
        # Individual words from common role phrases that still signal a role context
        # when they appear after a name in a filename (e.g. "Abhiram full stack .Net").
        "full",
        "stack",
        "stacks",
        # Tech-stack words that appear in filenames but are not surname candidates.
        "net",
        "dotnet",
        "java",
        "python",
        "react",
        "angular",
        "aws",
        "azure",
        "cloud",
        "sql",
        "bi",
        # Microsoft / web tech tokens that must not appear as surname candidates.
        "asp",
        "mvc",
        "visual",
        "studio",
    }
    # Suffixes: a token *ending* with any of these is also a role token
    # (e.g. "dotnetdeveloper", "javadeveloper", "fullstackengineer").
    _fn_role_suffixes = (
        "developer", "engineer", "analyst", "architect",
        "consultant", "specialist", "administrator",
    )
    org_tokens = {
        "inc",
        "incorporated",
        "corp",
        "corporation",
        "company",
        "co",
        "llc",
        "ltd",
        "limited",
        "pvt",
        "private",
        "technologies",
        "technology",
        "tech",
        "systems",
        "services",
        "solutions",
        "consulting",
        "consultancy",
        "enterprise",
        "enterprises",
        "group",
        "labs",
        "lab",
        "software",
        "infotech",
        "infosys",
        "tcs",
        "wipro",
        "hcl",
        "accenture",
        "deloitte",
        "cognizant",
        "capgemini",
        "ibm",
        "microsoft",
        "google",
        "amazon",
        "meta",
        "oracle",
    }
    skills_master = _skills_master_set()

    cleaned_parts: list[str] = []
    initial_parts: list[str] = []
    for part in base.split():
        # Trim punctuation; keep hyphens/apostrophes inside names.
        part = part.strip(" ,()[]{}<>|\t")
        part = re.sub(r"\d+", "", part)
        part = part.strip(" ,()[]{}<>|\t")
        if not part:
            continue
        part_cf = part.casefold()
        if part_cf in utility_tokens:
            continue

        # Also skip portmanteau tokens that end with a utility word — these are
        # filename artifacts produced when separators are consumed (e.g.
        # "Bhagya_Lakshmi_.Netresume.docx" → "Netresume" = "Net"+"resume").
        if any(part_cf.endswith(ut) for ut in ("resume", "profile", "cv") if len(ut) >= 2):
            if len(cleaned_parts) >= 2:
                break  # we already have a full name; stop here
            continue  # discard this artefact token and keep scanning

        # Reject filenames containing skills/roles/org words.
        part_compact = re.sub(r"[^a-z0-9.+#]", "", part_cf)
        _is_bad = (
            part_cf in roleish_tokens
            or part_compact in roleish_tokens
            or (any(part_compact.endswith(sfx) for sfx in _fn_role_suffixes) and len(part_compact) > min(len(s) for s in _fn_role_suffixes))
            or part_cf in org_tokens
            or part_compact in org_tokens
            or part_cf in skills_master
            or part_compact in skills_master
        )
        if _is_bad:
            # If we've already collected ≥ 2 name-like tokens, the role/org word
            # is a suffix that follows the person's name in the filename
            # (e.g. "PriyankaAdhikari_Dotnet_Developer.docx" → keep Priyanka Adhikari).
            # Also break when we have 1 clean token + an initial
            # (e.g. "Bharadwaj P .net.docx" → keep Bharadwaj P).
            # If we have exactly 1 clean token (e.g. "KAVYA-JAVA Resume.docx"),
            # keep it as first-name-only instead of discarding everything.
            if len(cleaned_parts) >= 2 or (len(cleaned_parts) == 1 and initial_parts):
                break
            if len(cleaned_parts) == 1:
                break   # keep the single name token we found
            return "", ""

        alpha = part.replace("'", "").replace("-", "")

        # Keep last-initial patterns like "Vishal B".
        if len(alpha) == 1 and alpha.isalpha():
            initial_parts.append(alpha.upper())
            continue

        if len(alpha) < 2 or not alpha.isalpha():
            continue
        cleaned_parts.append(part)

    if not cleaned_parts:
        return "", ""

    # Common pattern: "ResumeVishalB" -> first name present, last is just an initial.
    # We keep the initial as a last-name initial (e.g., "Vishal B").
    if len(cleaned_parts) == 1 and initial_parts:
        return cleaned_parts[0].title(), initial_parts[-1].upper()

    # Only trust filenames that look like a short person name.
    if len(cleaned_parts) > 6:
        return "", ""

    if len(cleaned_parts) == 1:
        # Sometimes filenames are a single concatenated token in all caps
        # (e.g., ResumePRADEEPGARAPATI). Try splitting using the email local-part.
        token = cleaned_parts[0]
        token_cf = token.casefold()

        # Handle trailing last-initial in filenames like "VAISHNAVIK".
        # Only do this when the email local-part supports the initial; otherwise
        # it can incorrectly truncate real surnames (e.g., "PRADEEPGARAPATI").
        token_alpha = re.sub(r"[^A-Za-z]", "", token)
        if email and token_alpha.isalpha() and token_alpha.isupper() and len(token_alpha) >= 7:
            local = email.split("@", 1)[0]
            # Use the main local token before separators (e.g., "vaishk.ds" -> "vaishk").
            local = re.split(r"[._\-]+", local, maxsplit=1)[0]
            local = re.sub(r"\d+", "", local).casefold()
            last_initial = token_alpha[-1].casefold()
            if local.endswith(last_initial):
                first_guess = token_alpha[:-1]
                if len(first_guess) >= 4:
                    # Return the initial as the last name — don't drop it.
                    # South/East Asian names commonly use a single-letter
                    # last initial ("Vaishnavi K", "Raviteja K").
                    return first_guess.title(), last_initial.upper()

        if email:
            local = email.split("@", 1)[0]
            local = re.sub(r"\d+", "", local)
            local_parts = [p for p in re.split(r"[._\-\s]+", local) if p]

            # Also support a leading initial like "ipradeep" -> "pradeep".
            candidates: list[str] = []
            for p in local_parts:
                p_cf = p.casefold()
                if len(p_cf) >= 3:
                    candidates.append(p_cf)
                if len(p_cf) >= 4 and p_cf[:1].isalpha() and p_cf[1:].isalpha():
                    if len(p_cf[:1]) == 1 and len(p_cf[1:]) >= 3:
                        candidates.append(p_cf[1:])

            # Pick the longest prefix match so we don't split too early.
            candidates = sorted(set(candidates), key=len, reverse=True)
            for p_cf in candidates:
                if token_cf.startswith(p_cf) and len(token_cf) - len(p_cf) >= 3:
                    remainder = token_cf[len(p_cf) :]
                    if remainder.isalpha():
                        return p_cf.title(), remainder.title()

        # If we can't split confidently, return the single token as first-name-only
        # when it's a plausible name (≥ 3 letters).  This covers filenames like
        # "KAVYA-JAVA Resume.docx" where the role word was stripped and a single
        # valid name token remains.
        token_alpha_only = re.sub(r"[^A-Za-z]", "", token)
        if len(token_alpha_only) >= 3 and token_alpha_only.isalpha():
            return token_alpha_only.title(), ""
        return "", ""

    # If we have exactly one trailing initial and at least one long token, keep the first name.
    # (We avoid storing 1-letter last names; downstream will drop them.)
    if len(cleaned_parts) == 1 and initial_parts:
        return cleaned_parts[0].title(), initial_parts[-1].upper()

    if len(cleaned_parts) < 2:
        return "", ""

    first = cleaned_parts[0].title()
    last = cleaned_parts[-1].title()
    return first, last


def _pick_best_name_pair(
    *,
    body_name: tuple[str, str],
    file_name_guess: tuple[str, str],
    email_guess: tuple[str, str] = ("", ""),
    confirm_text: str = "",
) -> tuple[str, str]:
    bad_tokens = {
        "professional",
        "summary",
        "summaries",
        "profile",
        "objective",
        "resume",
        "final",
        "latest",
        "updated",
        "update",
        "new",
        "copy",
        "draft",
        "experience",
        "education",
        "skills",
        "developer",
        "engineer",
        # Common section-heading words that sometimes get extracted as names.
        "expertise",
        "snapshot",
        "applications",
        "application",
        "technologies",
        "technology",
        # Management / training / process tokens misclassified as names.
        "training",
        "management",
        "project",
        "testing",
        "agile",
        "scrum",
        "waterfall",
        # Tech-stack / degree tokens that wrongly appear in filenames as surnames.
        "stack",
        "full",
        "msc",
        "bsc",
        "com",
        "net",
        "dotnet",
        "java",
        "python",
        "react",
        "angular",
        "aws",
        "azure",
        "sql",
        "backend",
        "frontend",
        "tracking",
        "used",
        "analyst",
        "architect",
        "consultant",
        "specialist",
        "manager",
        "lead",
        "intern",
        "senior",
        "junior",
        # Microsoft / web tech tokens that must not appear as filename name tokens.
        "asp",
        "mvc",
        "visual",
        "studio",
    }
    # Role-suffix patterns: any token ending with these is also a bad token.
    _bad_token_suffixes = (
        "developer", "engineer", "analyst", "architect",
        "consultant", "specialist", "administrator",
    )

    def _is_bad_token(tok: str) -> bool:
        t = (tok or "").strip().casefold()
        if t in bad_tokens:
            return True
        # Compound role tokens like "dotnetdeveloper", "fullstackengineer"
        if any(t.endswith(sfx) for sfx in _bad_token_suffixes) and len(t) > min(len(s) for s in _bad_token_suffixes):
            return True
        return False

    def looks_plausible_filename_pair(pair: tuple[str, str]) -> bool:
        fn, ln = (pair[0] or "").strip(), (pair[1] or "").strip()
        if not fn or not ln:
            return False
        if _is_bad_token(fn) or _is_bad_token(ln):
            return False
        fn_alpha = re.sub(r"[^A-Za-z]", "", fn)
        ln_alpha = re.sub(r"[^A-Za-z]", "", ln)
        # Accept a single uppercase letter as last-name initial
        # (e.g. "Pavani P", "Jaswanth N", "Raviteja K" — common in South Asian names).
        if len(ln_alpha) == 1 and ln_alpha.isupper():
            return len(fn_alpha) >= 3 and len(fn_alpha) <= 30
        return len(fn_alpha) >= 3 and len(ln_alpha) >= 3 and len(fn_alpha) <= 30 and len(ln_alpha) <= 30

    def score(pair: tuple[str, str]) -> int:
        fn, ln = (pair[0] or "").strip(), (pair[1] or "").strip()
        if not fn and not ln:
            return -10
        s = 0
        if fn:
            s += 20
        if ln:
            s += 30
        if _is_bad_token(fn):
            s -= 60
        if _is_bad_token(ln):
            s -= 60
        if fn and len(re.sub(r"[^A-Za-z]", "", fn)) <= 1:
            s -= 30
        ln_alpha_s = re.sub(r"[^A-Za-z]", "", ln)
        if ln and len(ln_alpha_s) <= 1:
            # Penalise empty / lowercase stray chars, but NOT uppercase last initials
            # (common in South/East Asian names: "Harsha K", "YOGENDRA P").
            if not (ln_alpha_s and ln_alpha_s.isupper()):
                s -= 30
        # Prefer matches to email inference when available
        fn_e, ln_e = email_guess
        if fn_e and fn and fn.casefold() == fn_e.casefold():
            s += 10
        if ln_e and ln and ln.casefold() == ln_e.casefold():
            s += 10
        return s

    def confirmation_bonus(pair: tuple[str, str]) -> int:
        """Reward names that actually appear in the resume text.

        This is especially important for filename guesses.
        Email addresses are stripped from confirm_text so that a name
        derived from the email local-part cannot self-confirm against it.
        (e.g. "atniha.reddy@gmail.com" must not confirm first_name="Atniha")
        """

        fn, ln = (pair[0] or "").strip(), (pair[1] or "").strip()
        if not confirm_text or (not fn and not ln):
            return 0

        # Strip all email addresses before checking so email-local-part-derived
        # names cannot confirm themselves against the email in the resume text.
        stripped = re.sub(r"[\w.+%-]+@[\w.-]+\.[A-Za-z]{2,}", " ", confirm_text)
        t = re.sub(r"\s+", " ", stripped).casefold()

        def norm_word(w: str) -> str:
            return re.sub(r"[^a-z]", "", w.casefold())

        def has_word(w: str) -> bool:
            ww = norm_word(w)
            if len(ww) < 2:
                return False
            return re.search(rf"\b{re.escape(ww)}\b", re.sub(r"[^a-z]+", " ", t)) is not None

        bonus = 0
        if fn and has_word(fn):
            bonus += 15
        if ln and has_word(ln):
            bonus += 15
        return bonus

    def merge_body_with_filename(body: tuple[str, str], file_guess: tuple[str, str]) -> tuple[str, str]:
        """If header has only first name / last initial, fill missing last from filename when consistent."""
        b_fn, b_ln = (body[0] or "").strip(), (body[1] or "").strip()
        f_fn, f_ln = (file_guess[0] or "").strip(), (file_guess[1] or "").strip()
        if not b_fn or not f_ln:
            return body
        if f_fn and b_fn.casefold() != f_fn.casefold():
            return body

        b_ln_alpha = re.sub(r"[^A-Za-z]", "", b_ln)
        f_ln_alpha = re.sub(r"[^A-Za-z]", "", f_ln)
        if not b_ln:
            return (b_fn, f_ln)
        if len(b_ln_alpha) == 1 and f_ln_alpha and f_ln_alpha[:1].casefold() == b_ln_alpha.casefold():
            return (b_fn, f_ln)
        return body

    # Prefer: header/body name, then filename (if confirmed), then email.
    body_name = merge_body_with_filename(body_name, file_name_guess)

    scored: list[tuple[int, tuple[str, str]]] = []
    for origin, pair in (
        ("body", body_name),
        ("file", file_name_guess),
        ("email", email_guess),
    ):
        s = score(pair)
        if origin == "body":
            s += 25
        elif origin == "file":
            s += 15
        else:  # email
            s -= 10

        bonus = confirmation_bonus(pair)
        s += bonus

        # If a guess doesn't appear anywhere, it's likely wrong.
        # However: filename-based names are often the only reliable signal when
        # PDF text extraction is messy; allow clean-looking filename pairs as a
        # fallback even if the confirmation text missed them.
        if origin == "email" and bonus == 0 and (pair[0] or pair[1]):
            s -= 40
        if origin == "file" and bonus == 0 and (pair[0] or pair[1]):
            s -= 15 if looks_plausible_filename_pair(pair) else 40

        scored.append((s, pair))

    best_score, best_pair = max(scored, key=lambda x: x[0])
    best_fn, best_ln = (best_pair[0] or "").strip(), (best_pair[1] or "").strip()
    if not best_fn and not best_ln:
        non_empty = [(s, p) for (s, p) in scored if (p[0] or "").strip() or (p[1] or "").strip()]
        if non_empty:
            best_pair = max(non_empty, key=lambda x: x[0])[1]
            best_fn, best_ln = (best_pair[0] or "").strip(), (best_pair[1] or "").strip()
    # Sanitize: discard tokens that contain no alphabetic characters (e.g. "(", ".", "-")
    if best_fn and not re.search(r"[A-Za-z]", best_fn):
        best_fn = ""
    if best_ln and not re.search(r"[A-Za-z]", best_ln):
        best_ln = ""
    return best_fn, best_ln


def extract_address(
    text: str,
    *,
    first_name: str | None = None,
    last_name: str | None = None,
    phone: str | int | None = None,
    allow_phone_fallback: bool = True,
) -> str:
    # Best-effort: detect candidate location near the top.
    # User requirement: prefer "City, State, Country" (e.g., "Atlanta, Georgia, United States").
    # If not present, fall back to best available (e.g., "Zurich, Switzerland" or "United States").
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

    # Use light re-segmentation so compact PDF headers like "SanFranciscoBayArea, CA"
    # become matchable without accidentally treating long experience bullets as addresses.
    all_lines = [_segment_compact_line(ln) for ln in non_empty_lines(text)]

    skills_master = _skills_master_set()

    # ── Primary path: use location_parser for a skill-context-safe result ──────
    # The module limits its scan to the contact/header section, applies a
    # skill-context guard (rejects city candidates preceded by tech/tool names),
    # and returns a structured dict.  A "high" confidence result is returned
    # immediately; medium/low are kept as a backup candidate (_lp_str) and
    # used when the regex logic below finds nothing.
    _lp_str: str = ""
    _lp_confidence: str = "low"
    if _LOCATION_PARSER_AVAILABLE:
        try:
            _lp_result = _detect_loc_with_fallback(text, str(phone) if phone else None)
            _lp_confidence = _lp_result.get("confidence", "low")
            _lp_str = _loc_result_to_str(_lp_result)
            # Safety net: reject _lp_str if it's a single word that matches a
            # known skill/tech from skills_master.txt.  spaCy sometimes GPE-tags
            # tool names like "Maven", "Sqoop", "Hibernate" that slip through
            # the location_parser guards.
            if _lp_str and " " not in _lp_str.strip() and _lp_str.strip(",. ").casefold() in skills_master:
                _lp_str = ""
                _lp_confidence = "low"
            if _lp_confidence == "high" and _lp_str:
                return _lp_str
        except Exception:
            _lp_str = ""
            _lp_confidence = "low"

    def _infer_phone_preference(phone_value: str | int | None) -> tuple[str, str]:
        """Return (preferred_country, preferred_state_full).

        Uses E.164 country code (e.g., +1) and NANP area code when possible.
        """

        if phone_value is None:
            return "", ""
        digits = re.sub(r"\D+", "", str(phone_value))
        if not digits:
            return "", ""

        # Small US area-code→state fallback map.
        # We primarily rely on `phonenumbers.geocoder` (covers most NANP area codes);
        # keep this only for cases where geocoder returns empty.
        area_to_state_abbr_hint: dict[str, str] = {
            # PA
            "215": "PA",
            "267": "PA",
            "484": "PA",
            "610": "PA",
            "717": "PA",
            "814": "PA",
            "878": "PA",
            # NJ
            "201": "NJ",
            "551": "NJ",
            "609": "NJ",
            "640": "NJ",
            "732": "NJ",
            "848": "NJ",
            "856": "NJ",
            "862": "NJ",
            "908": "NJ",
            "973": "NJ",
            # AZ
            "480": "AZ",
            "520": "AZ",
            "602": "AZ",
            "623": "AZ",
            "928": "AZ",
            # MO (helps when resumes omit location but area code is present)
            "314": "MO",
        }

        preferred_country = ""
        preferred_state = ""

        def _state_from_desc(desc: str) -> str:
            d = re.sub(r"\s+", " ", (desc or "").strip())
            if not d:
                return ""
            # If it contains a 2-letter state code, prefer that.
            for abbr in US_STATE_ABBR_TO_FULL.keys():
                if re.search(rf"(?i)(?:^|[^A-Z]){re.escape(abbr)}(?:$|[^A-Z])", d):
                    return US_STATE_ABBR_TO_FULL.get(abbr, "")
            # Otherwise match full state names anywhere in the string.
            dl = d.casefold()
            for k, full in US_STATE_NAMES.items():
                if k in dl:
                    return full
            return ""

        # Try library-based parsing (phonenumbers is in requirements.txt).
        if phonenumbers is not None:
            try:
                # If we have a clear country code prefix, parse as +<digits>.
                if len(digits) >= 11 and digits[0] != "0":
                    num = phonenumbers.parse("+" + digits, None)
                else:
                    num = phonenumbers.parse(digits, os.getenv("PHONE_DEFAULT_REGION", "US"))

                region = phonenumbers.region_code_for_number(num) or ""
                if region and pycountry is not None:
                    try:
                        c = pycountry.countries.get(alpha_2=region)
                        if c and getattr(c, "name", None):
                            preferred_country = str(c.name)
                    except Exception:
                        pass
                if not preferred_country and num.country_code == 1:
                    preferred_country = "United States"

                # For NANP numbers, infer a likely US state from the 3-digit area code.
                if num.country_code == 1:
                    national = str(getattr(num, "national_number", "") or "")
                    if len(national) >= 10:
                        area = national[:3]
                        st = area_to_state_abbr_hint.get(area, "")
                        if st and not preferred_state:
                            preferred_state = US_STATE_ABBR_TO_FULL.get(st, "")

                # Optional: try geocoder description (often yields a state/region).
                try:
                    from phonenumbers import geocoder  # type: ignore

                    desc = (geocoder.description_for_number(num, "en") or "").strip()
                    if desc:
                        st_full = _state_from_desc(desc)
                        if st_full:
                            preferred_state = st_full
                except Exception:
                    pass

            except Exception:
                pass

        # Heuristic fallback if library parsing fails.
        if not preferred_country:
            if len(digits) == 11 and digits.startswith("1"):
                preferred_country = "United States"
            elif digits.startswith("91"):
                preferred_country = "India"

        if preferred_country == "United States" and not preferred_state:
            # If NANP and we can see a 3-digit area code at the front.
            area = ""
            if len(digits) == 11 and digits.startswith("1"):
                area = digits[1:4]
            elif len(digits) == 10:
                area = digits[0:3]
            st = area_to_state_abbr_hint.get(area, "")
            if st:
                preferred_state = US_STATE_ABBR_TO_FULL.get(st, "")

        return preferred_country, preferred_state

    preferred_country, preferred_state = _infer_phone_preference(phone)

    US_STATE_NAMES = {
        "alabama": "Alabama",
        "alaska": "Alaska",
        "arizona": "Arizona",
        "arkansas": "Arkansas",
        "california": "California",
        "colorado": "Colorado",
        "connecticut": "Connecticut",
        "delaware": "Delaware",
        "florida": "Florida",
        "georgia": "Georgia",
        "hawaii": "Hawaii",
        "idaho": "Idaho",
        "illinois": "Illinois",
        "indiana": "Indiana",
        "iowa": "Iowa",
        "kansas": "Kansas",
        "kentucky": "Kentucky",
        "louisiana": "Louisiana",
        "maine": "Maine",
        "maryland": "Maryland",
        "massachusetts": "Massachusetts",
        "michigan": "Michigan",
        "minnesota": "Minnesota",
        "mississippi": "Mississippi",
        "missouri": "Missouri",
        "montana": "Montana",
        "nebraska": "Nebraska",
        "nevada": "Nevada",
        "new hampshire": "New Hampshire",
        "new jersey": "New Jersey",
        "new mexico": "New Mexico",
        "new york": "New York",
        "north carolina": "North Carolina",
        "north dakota": "North Dakota",
        "ohio": "Ohio",
        "oklahoma": "Oklahoma",
        "oregon": "Oregon",
        "pennsylvania": "Pennsylvania",
        "rhode island": "Rhode Island",
        "south carolina": "South Carolina",
        "south dakota": "South Dakota",
        "tennessee": "Tennessee",
        "texas": "Texas",
        "utah": "Utah",
        "vermont": "Vermont",
        "virginia": "Virginia",
        "washington": "Washington",
        "west virginia": "West Virginia",
        "wisconsin": "Wisconsin",
        "wyoming": "Wyoming",
        "district of columbia": "District of Columbia",
    }

    @lru_cache(maxsize=1)
    def _country_aliases() -> dict[str, str]:
        # Canonicalize common variants.
        aliases: dict[str, str] = {
            "usa": "United States",
            "u.s.a": "United States",
            "u.s.a.": "United States",
            "us": "United States",
            "u.s": "United States",
            "u.s.": "United States",
            "united states": "United States",
            "united states of america": "United States",
            "uk": "United Kingdom",
            "u.k": "United Kingdom",
            "u.k.": "United Kingdom",
            "india": "India",
            "pakistan": "Pakistan",
            "switzerland": "Switzerland",
            "canada": "Canada",
            "germany": "Germany",
        }
        if pycountry is not None:
            try:
                for c in pycountry.countries:
                    name = getattr(c, "name", None)
                    if name:
                        aliases[name.casefold()] = str(name)
                    for attr in ("official_name", "common_name"):
                        v = getattr(c, attr, None)
                        if v:
                            aliases[str(v).casefold()] = str(name or v)
            except Exception:
                pass
        return aliases

    def normalize_country(raw: str) -> str:
        c = re.sub(r"\s+", " ", (raw or "").strip())
        if not c:
            return ""
        key = c.casefold().strip(".")
        return _country_aliases().get(key, c)

    def is_known_country(raw: str) -> bool:
        c = re.sub(r"\s+", " ", (raw or "").strip())
        if not c:
            return False
        key = c.casefold().strip(".")
        return key in _country_aliases()

    def normalize_state(raw: str) -> str:
        s = re.sub(r"\s+", " ", (raw or "").strip())
        s = s.strip(" ,.;:|/\\")
        if not s:
            return ""
        abbr = re.sub(r"[^A-Za-z]", "", s).upper()
        if len(abbr) == 2:
            return US_STATE_ABBR_TO_FULL.get(abbr, abbr)
        key = s.casefold()
        return US_STATE_NAMES.get(key, s.title() if s.isalpha() else s)

    def is_us_state(raw: str) -> bool:
        s = re.sub(r"\s+", " ", (raw or "").strip())
        if not s:
            return False
        if len(s) == 2 and s.upper() in US_STATE_ABBRS:
            return True
        return s.casefold() in US_STATE_NAMES

    # Reject common non-location phrases accidentally captured as the "city".
    bad_location_tokens = {
        # company-ish
        "inc",
        "llc",
        "ltd",
        "limited",
        "company",
        "corporation",
        "corp",
        "group",
        "services",
        "service",
        "consulting",
        "consultancy",
        "consultant",
        "technologies",
        "technology",
        "solutions",
        "systems",
        "bank",
        "labs",
        "university",
        "college",
        "financial",
        "financials",
        "analytics",
        "health",
        "care",
        "insurance",
        "express",
        "auto",
        "ubs",
        "suncor",
        # education-ish
        "bachelor",
        "masters",
        "master",
        "phd",
        "degree",
        "engineering",
        "electronics",
        "communication",
        "computer",
        "science",
        # role-ish
        "developer",
        "engineer",
        "architect",
        "analyst",
        "intern",
        "manager",
        "consultant",
        # tech-ish (avoid misreading skills/tools as locations)
        "oracle",
        "postgres",
        "postgresql",
        "mysql",
        "mssql",
        "sql",
        "nosql",
        "mongodb",
        "cassandra",
        "snowflake",
        "redshift",
        "dynamodb",
        "bigquery",
        "synapse",
        "powerbi",
        "databricks",
        "hadoop",
        "spark",
        "kafka",
        "pyspark",
        "scala",
        "python",
        "java",
        "aws",
        "azure",
        "gcp",
        "linux",
        # version-control/tooling tokens that often appear near commas and 2-letter chunks (e.g., "Tortoise SVN, MS Team...")
        "svn",
        "tortoise",
        "tortoisesvn",
        "git",
        "github",

        # contact/header tokens that sometimes get split into fake "City, State" matches
        "mail",
        "email",
        "phone",
        "linked",
        "linkedin",
        "about",

        # common stopword that should never be a standalone city
        "and",
        # random resume words that should never be a city
        "boot",
        # org-ish tokens seen in resumes
        "freddie",
        "mac",
        # Testing frameworks / tools — prevents "Xunit, Mississippi", "Xaml, Mississippi" etc.
        "xunit", "nunit", "junit", "testng", "mstest", "specflow",
        "selenium", "moq", "mockito", "jest", "jasmine", "karma", "pytest",
        "xaml", "wpf", "winforms", "blazor", "silverlight",
        # Key generic terms that are never a city name
        "testing", "automation", "tdd", "bdd",
        # Additional JS / web frameworks sometimes adjacent to state names in skill lists
        "angular", "react", "redux", "vue", "svelte", "jquery",
        "typescript", "nodejs",
        # DevOps / process tokens
        "terraform", "ansible", "devops", "cicd", "agile", "scrum", "kanban",
    }

    def _looks_like_sql_state_suffix(full_line: str, state_match_end: int) -> bool:
        """Reject matches like 'Oracle, MS-SQL' where MS is not a state."""
        if not full_line or state_match_end <= 0:
            return False
        tail = full_line[state_match_end : state_match_end + 20]
        # Common tech tokens that immediately follow a 2-letter chunk.
        # Examples: "MS-SQL", "MS SQL", "MS/SQL".
        return re.match(r"(?is)^\s*[-/ ]\s*sql\b", tail) is not None

    def _sanitize_city_candidate(raw: str) -> str:
        s = re.sub(r"\s+", " ", (raw or "").strip())
        if not s:
            return ""

        # Normalize common metro abbreviations.
        if s.casefold() == "nyc":
            s = "New York City"
        if s.casefold() == "sfo":
            s = "San Francisco"
        # Correct common misspellings (be resilient to punctuation/odd glyphs).
        city_key = re.sub(r"[^a-z ]", "", s.casefold()).strip()
        if city_key == "san fransisco":
            s = "San Francisco"
        # Strip common employer prefixes like "Company - City".
        for sep in (" - ", " – ", " — "):
            if sep in s:
                s = s.split(sep)[-1].strip()
        # Strip employer prefixes separated by a period (e.g., "Mosaic Health Care. St Joe").
        # Keep "St." abbreviations intact.
        if "." in s and not re.search(r"(?i)\bst\.\b", s):
            tail = s.split(".")[-1].strip()
            if 1 <= len(tail.split()) <= 4:
                s = tail

        # Remove candidate name tokens if they got prefixed into the city.
        fn = (first_name or "").strip().casefold()
        ln = (last_name or "").strip().casefold()
        if fn or ln:
            toks = [t for t in re.split(r"\s+", s) if t]
            stripped = [t for t in toks if t.casefold() not in {fn, ln}]
            if stripped and len(stripped) <= len(toks):
                s = " ".join(stripped).strip()

        # Strip known org prefixes when followed by a plausible city token.
        org_prefixes = {
            "ubs",
            "suncor",
            "freddie",
            "mosaic",
            "american",
            "state",
        }
        toks2 = [t for t in re.split(r"\s+", s) if t]
        if len(toks2) >= 2 and toks2[0].casefold() in org_prefixes:
            s = " ".join(toks2[1:]).strip()
        # Strip leading bullet/separator glyphs.
        s = re.sub(r"^[|•·\-–—]+\s*", "", s).strip()
        return s

    def _norm_token(t: str) -> str:
        return re.sub(r"[^a-z0-9.+#]", "", (t or "").casefold())

    def is_plausible_city(raw: str) -> bool:
        city = _sanitize_city_candidate(raw)
        if not city:
            return False
        if any(ch.isdigit() for ch in city):
            return False
        # Avoid very long phrases (usually headings/education/employer lines).
        if len(city) > 40:
            return False

        tokens = [t for t in re.split(r"\s+", city) if t]
        if not (1 <= len(tokens) <= 6):
            return False

        # Reject if it contains obvious non-location tokens.
        toks_cf = {_norm_token(t) for t in tokens}
        if any(t in bad_location_tokens for t in toks_cf):
            return False

        # Reject if it looks like a skill (e.g., "MySQL, Mississippi, United States").
        if len(tokens) == 1:
            if _norm_token(city) in skills_master:
                return False
        else:
            # For multi-token cities, reject if 2+ tokens are skills.
            skill_hits = sum(1 for t in tokens if _norm_token(t) in skills_master)
            if skill_hits >= 2:
                return False

        return True

    def is_plausible_region(raw: str) -> bool:
        # Region/state-like token. We have a strong list for US; for other places,
        # keep this permissive but still block org/degree/skill phrases.
        s = re.sub(r"\s+", " ", (raw or "").strip())
        if not s:
            return False
        if any(ch.isdigit() for ch in s):
            return False
        if len(s) > 30:
            return False
        tokens = [t for t in re.split(r"\s+", s) if t]
        toks_cf = {_norm_token(t) for t in tokens}
        if any(t in bad_location_tokens for t in toks_cf):
            return False
        if _norm_token(s) in skills_master:
            return False
        return True

    def format_location(city: str | None, state: str | None, country: str | None) -> str:
        city_n = re.sub(r"\s+", " ", (city or "").strip())
        # Remove common header separators that can stick to location tokens.
        city_n = city_n.strip(" |,;:-\t")
        city_n = re.sub(r"^[|•·]+\s*", "", city_n).strip()
        # Strip stray glyphs (e.g., private-use icons) that can appear in PDF headers.
        while city_n and not city_n[0].isalnum():
            # Also drop uncommon separators even if isalnum() is False.
            if unicodedata.category(city_n[0]).startswith("Z"):
                break
            city_n = city_n[1:].lstrip()
        state_n = normalize_state(state or "")
        country_n = normalize_country(country or "")

        # Defensive: expand state abbreviations for US locations.
        # Some PDFs/headers surface "Nm"/"N.M" or other artifacts; normalize by keeping letters only.
        if (country_n or "").casefold() in {"", "united states"}:
            state_abbr = re.sub(r"[^A-Za-z]", "", state_n).upper()
            if len(state_abbr) == 2 and state_abbr in US_STATE_ABBR_TO_FULL:
                state_n = US_STATE_ABBR_TO_FULL[state_abbr]

        parts: list[str] = []
        if city_n:
            parts.append(city_n.title())
        if state_n:
            parts.append(state_n)
        if country_n:
            parts.append(country_n)
        else:
            # If we have a US state, default to United States.
            if state_n and (state_n in US_STATE_NAMES.values() or state_n == "District of Columbia"):
                parts.append("United States")

        # Final guard: if we ended up with a US state abbreviation, expand it.
        if len(parts) >= 2 and str(parts[-1]).strip().casefold() == "united states":
            st_raw = str(parts[-2])
            st_abbr = re.sub(r"[^A-Za-z]", "", st_raw).upper()
            if len(st_abbr) == 2 and st_abbr in US_STATE_ABBR_TO_FULL:
                parts[-2] = US_STATE_ABBR_TO_FULL[st_abbr]
        return ", ".join([p for p in parts if p])

    # Don't accidentally capture employer/skills-section content as "address".
    # Prefer header-only extraction; cut off at the first major section heading.
    # IMPORTANT: do NOT cut off at "Summary"/"Profile" headings since some resumes
    # place the explicit current location line after a summary block.
    cutoff = 25
    heading_re = re.compile(
        r"(?i)^(?:"
        r"(?:professional\s+)?experience(?:\b.*)?|work\s+experience(?:\b.*)?|experience(?:\b.*)?|"
        r"education(?:\b.*)?|academic\s+background(?:\b.*)?|academics(?:\b.*)?|"
        r"certification(?:s)?(?:\b.*)?|certifications(?:\b.*)?|"
        r"expertise\s+snapshot(?:\b.*)?|technical\s+skills(?:\b.*)?|skills(?:\b.*)?"
        r")$"
    )
    for idx, ln in enumerate(all_lines[:80]):
        if heading_re.fullmatch(ln.strip()):
            cutoff = min(cutoff, idx)
            break

    top = all_lines[:cutoff]

    # Detect experience section start so we never treat employer city lines as a
    # candidate's home location.  We record the index in `top` (not all_lines).
    _exp_hdr_re = re.compile(
        r"(?i)^\s*(?:professional\s+)?(?:work\s+)?experience\b"
        r"|^\s*employment\s+(?:history|summary)\b"
        r"|^\s*work\s+history\b"
    )
    _experience_section_start_idx: int | None = None
    for _idx, _ln in enumerate(top):
        stripped_ln = _ln.strip()
        if _exp_hdr_re.search(stripped_ln) and len(stripped_ln) < 60:
            _experience_section_start_idx = _idx
            break

    # Track the skills section start in the FULL all_lines list so the deep
    # fallback scan stops before reaching technology name bullets.
    # This is the primary fix for false positives like "Xunit, Mississippi".
    _skills_hdg_re = re.compile(
        r"(?i)^\s*(technical\s+skills?|skills?|core\s+(?:skills?|competencies)|"  
        r"key\s+skills?|expertise(?:\s+snapshot)?|competencies|technologies|"  
        r"tools?\s*(?:and|&)\s*technologies)\s*$"
    )
    _skills_section_start_idx: int | None = None
    for _si, _sl in enumerate(all_lines[:300]):
        _sl_stripped = _sl.strip()
        if not _sl_stripped or len(_sl_stripped) > 80:
            continue
        if _skills_hdg_re.search(_sl_stripped):
            _skills_section_start_idx = _si
            break

    zip_state_re = re.compile(r"\b(" + "|".join(sorted(US_STATE_ABBRS)) + r")\b\s*\d{5}(?:-\d{4})?\b")
    city_state_zip_re = re.compile(
        r"\b([A-Za-z][A-Za-z .'-]{1,})[,\s]+(" + "|".join(sorted(US_STATE_ABBRS)) + r")\s*\d{5}(?:-\d{4})?\b"
    )
    city_state_re = re.compile(r"\b([A-Za-z][A-Za-z .'-]{1,}),\s*(" + "|".join(sorted(US_STATE_ABBRS)) + r")\b")
    # City ST (no comma) - common in compact headers and DOCX resumes.
    city_state_space_re = re.compile(r"\b([A-Za-z][A-Za-z .'-]{1,})\s+(" + "|".join(sorted(US_STATE_ABBRS)) + r")\b")
    # City, StateName (full state names like Texas/Illinois; common in DOCX and some PDFs)
    city_state_name_re = re.compile(r"\b([A-Za-z][A-Za-z .'-]{1,}),\s*([A-Za-z][A-Za-z .'-]{2,})\b")
    city_state_country_re = re.compile(
        r"\b([A-Za-z][A-Za-z .'-]{1,}),\s*([A-Za-z .'-]{2,}|[A-Z]{2})\s*,\s*([A-Za-z .'-]{2,})\b"
    )
    city_country_re = re.compile(r"\b([A-Za-z][A-Za-z .'-]{1,}),\s*([A-Za-z .'-]{2,})\b")
    # City Country (no comma) - common in compact headers (e.g., 'Hyderabad India').
    city_country_space_re = re.compile(r"\b([A-Za-z][A-Za-z .'-]{1,})\s+([A-Za-z .'-]{2,})\b")
    state_country_re = re.compile(r"\b([A-Za-z .'-]{2,}|[A-Z]{2})\s*,\s*([A-Za-z .'-]{2,})\b")

    def extract_tail_location_before_country(line: str) -> str:
       

        ln = (line or "").strip()
        if "," not in ln:
            return ""

        # Strip common label prefixes that are not part of the actual location.
        # Examples: "Location: Pennsylvania, United States", "Vishal Location: ...".
        ln = re.sub(r"(?i)^\s*[A-Za-z]{2,}\s+location\s*[:\-]\s*", "", ln).strip()
        ln = re.sub(r"(?i)^\s*(?:current\s+)?(?:location|address)\s*[:\-]\s*", "", ln).strip()

        # If this is clearly an employer/client label, don't treat the preceding token as a city.
        # Prefer country-only in that case.
        org_prefix = re.match(r"(?i)^\s*(client|customer|company|employer|project|role)\s*[:\-]", ln)

        m_end = re.search(r"(?i),\s*([A-Za-z .'-]{2,})\s*$", ln)
        if not m_end:
            return ""
        country = m_end.group(1).strip()
        if not is_known_country(country):
            return ""

        if org_prefix:
            return format_location(None, None, country)

        before = ln[: m_end.start()].strip()

        # Avoid treating education/institution locations as current residence.
        # Common pattern: "<University Name> ... Hyderabad, India".
        if re.search(
            r"(?i)\b( विश्वविद्यालय|university|college|institute|school|academy|"
            r"bachelor|master|phd|doctorate|degree|b\.?tech|m\.?tech|b\.?e\.?|m\.?s\.?|"
            r"cgpa|gpa|graduat(?:e|ion)|education)\b",
            before,
        ):
            return ""

        # Take only the last few words (location is usually at the end).
        words = [w for w in re.split(r"\s+", before) if w]
        if not words:
            return ""

        # Try 3-word, then 2-word, then 1-word tails.
        for n in (3, 2, 1):
            if len(words) < n:
                continue
            tail = " ".join(words[-n:]).strip(" ,-")
            if is_us_state(tail) and is_plausible_region(tail):
                return format_location(None, tail, country)
            if is_plausible_city(tail):
                return format_location(_sanitize_city_candidate(tail), None, country)
        return ""

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

    education_noise_re = re.compile(
        r"(?i)\b("
        r"education|academics?|academic|university|college|institute|school|academy|"
        r"bachelor|masters?|phd|doctorate|degree|graduat(?:e|ion)|cgpa|gpa|"
        r"b\.?tech|m\.?tech|b\.?e\.?|b\.?sc|m\.?sc|mba"
        r")\b"
    )

    preferred_location_label_re = re.compile(
        r"(?i)\b(?:present|current)\s+(?:address|location)\b|"
        r"\bcurrently\s+(?:located|based|residing)\s+(?:in|at)\b|"
        r"\bresiding\s+(?:in|at)\b|"
        r"\bbased\s+(?:in|out\s+of)\b|"
        r"\blocation\s*[:\-]"
    )

    # If we can't find an explicit current/present location near the top, avoid
    # selecting employer/job-site locations from experience entries.
    month_re = r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
    _experience_date_re = re.compile(rf"(?i)\b{month_re}\b\s+\d{{4}}|\b\d{{4}}\b\s*(?:to|\-|–|—)\s*\b\d{{4}}\b|\b(?:present|current)\b")
    _employer_sep_re = re.compile(r"\s[-–—|]\s")

    def _looks_like_experience_location_line(line: str) -> bool:
        ln = (line or "").strip()
        if not ln:
            return False
        # Typical formats: "Company - City, ST Jun 2021 to Dec 2023"
        if not _experience_date_re.search(ln):
            return False
        if _employer_sep_re.search(ln):
            return True
        # If it contains a pipe/bullet separator and dates, it is usually not a residence.
        if any(sep in ln for sep in ["|", "•", "·", "◇", "∙"]):
            return True
        return False

    def _try_parse_location_fragment(fragment: str) -> str:
        frag = (fragment or "").strip()
        if not frag:
            return ""

        # If the fragment is a compact header with separators, try each segment
        # (location is often the last segment).
        if any(sep in frag for sep in ["|", "◇", "·", "•", "∙"]):
            segments = [s.strip() for s in re.split(r"[|◇·•∙]", frag) if s and s.strip()]
            for seg in reversed(segments):
                loc = _try_parse_location_fragment(seg) if seg != frag else ""
                if loc:
                    return loc

        # Redact emails/URLs/social tokens so we can still parse location from mixed contact lines.
        # Example: "name | email@x.com | Dallas, TX".
        frag = re.sub(r"(?i)\b\S+@\S+\b", " ", frag)
        frag = re.sub(r"(?i)https?://\S+|www\.\S+", " ", frag)
        frag = re.sub(r"(?i)\b(linkedin|github)\b", " ", frag)
        frag = re.sub(r"\s+", " ", frag).strip()

        # Normalize common "present/current" labels.
        frag = re.sub(
            r"(?i)^\s*(?:present|current)\s+(?:address|location)\s*[:\-]\s*",
            "",
            frag,
        ).strip()
        frag = re.sub(r"(?i)^\s*(?:residing|based)\s+in\s+", "", frag).strip()
        frag = re.sub(r"(?i)^\s*(?:currently\s+)?(?:located|based|residing)\s+(?:in|at)\s+", "", frag).strip()
        frag = re.sub(r"(?i)^\s*location\s*[:\-]\s*", "", frag).strip()

        # Drop common non-location qualifiers.
        frag = re.sub(r"(?i)\b(open\s+to\s+relocat(?:e|ion)|willing\s+to\s+relocat(?:e|ion)|relocat(?:e|ion)|remote)\b", " ", frag)
        frag = re.sub(r"\s+", " ", frag).strip(" -:|,\t")

        # After redaction, if it still contains an email/url token, treat as non-location.
        if any(bad in frag.lower() for bad in ["http", "www.", "@"]):
            return ""

        m_csz = city_state_zip_re.search(frag)
        if m_csz:
            city, state = _sanitize_city_candidate(m_csz.group(1)), m_csz.group(2)
            if is_plausible_city(city):
                return format_location(city, state, "United States")

        m_zip = zip_state_re.search(frag.upper())
        if m_zip:
            return format_location(None, m_zip.group(1), "United States")

        tail_loc = extract_tail_location_before_country(frag)
        if tail_loc:
            return tail_loc

        m_csc = city_state_country_re.search(frag)
        if m_csc and is_known_country(m_csc.group(3)):
            city, state, country = _sanitize_city_candidate(m_csc.group(1)), m_csc.group(2), m_csc.group(3)
            if is_plausible_city(city) and is_plausible_region(state):
                return format_location(city, state, country)

        m_cs = city_state_re.search(frag)
        if m_cs:
            city, state = _sanitize_city_candidate(m_cs.group(1)), m_cs.group(2)
            if _looks_like_sql_state_suffix(frag, m_cs.end(2)):
                return ""
            if is_plausible_city(city):
                return format_location(city, state, "United States")

        m_css = city_state_space_re.search(frag)
        if m_css:
            city, state = _sanitize_city_candidate(m_css.group(1)), m_css.group(2)
            if _looks_like_sql_state_suffix(frag, m_css.end(2)):
                return ""
            if is_plausible_city(city):
                return format_location(city, state, "United States")

        # City, StateName (e.g., "Chicago, Illinois"; treat as US even without country)
        m_csn = city_state_name_re.search(frag)
        if m_csn:
            city, state = _sanitize_city_candidate(m_csn.group(1)), m_csn.group(2)
            # Avoid hijacking "City, Country" (e.g., Hyderabad, India).
            if is_us_state(state) and is_plausible_region(state) and is_plausible_city(city):
                return format_location(city, state, "United States")

        m_sc = state_country_re.search(frag)
        if m_sc and is_known_country(m_sc.group(2)) and is_us_state(m_sc.group(1)):
            state, country = m_sc.group(1), m_sc.group(2)
            if is_plausible_region(state):
                return format_location(None, state, country)

        m_cc = city_country_re.search(frag)
        if m_cc and is_known_country(m_cc.group(2)):
            city_raw, country = m_cc.group(1), m_cc.group(2)
            city = _sanitize_city_candidate(city_raw)
            if is_us_state(city_raw) and is_plausible_region(city_raw):
                return format_location(None, city_raw, country)
            if is_plausible_city(city):
                return format_location(city, None, country)

        m_ccs = city_country_space_re.search(frag)
        if m_ccs and is_known_country(m_ccs.group(2)):
            city, country = _sanitize_city_candidate(m_ccs.group(1)), m_ccs.group(2)
            if is_us_state(city) and is_plausible_region(city):
                return format_location(None, city, country)
            if is_plausible_city(city):
                return format_location(city, None, country)

        if is_known_country(frag):
            return format_location(None, None, frag)

        return ""

    # Strong preference: if the resume explicitly states present/current location/address, use it.
    for i, ln in enumerate(top[: min(len(top), 45)]):
        if not preferred_location_label_re.search(ln):
            continue

        candidates: list[str] = []
        # If the label is inline, take the tail after ':'/'-'.
        m_inline = re.split(r"[:\-]", ln, maxsplit=1)
        if len(m_inline) == 2:
            candidates.append(m_inline[1].strip())
        candidates.append(ln)
        # Often the address follows on the next line.
        for j in range(i + 1, min(i + 6, len(top))):
            candidates.append(top[j])

        # Also try splitting the labeled line on common separators (pipes/bullets) to
        # isolate a location segment embedded in contact headers.
        if any(sep in ln for sep in ["|", "◇", "·", "•", "∙"]):
            segments = [s.strip() for s in re.split(r"[|◇·•∙]", ln) if s and s.strip()]
            candidates.extend(segments)

        for cand in candidates:
            loc = _try_parse_location_fragment(cand)
            if loc:
                return loc

    best_loc = ""
    best_score = -10**9

    def consider(loc: str, *, base: int, idx: int) -> None:
        nonlocal best_loc, best_score
        if not loc:
            return
        # Prefer earlier mentions slightly.
        score = base + max(0, 25 - idx)

        # Phone-informed preference: if the phone indicates a country/state, use it as a tie-breaker.
        if preferred_country:
            parts = [p.strip() for p in (loc or "").split(",") if p.strip()]
            loc_country = parts[-1] if parts else ""
            loc_state = parts[-2] if len(parts) >= 2 else ""

            if loc_country and normalize_country(loc_country).casefold() == normalize_country(preferred_country).casefold():
                score += 18
            elif loc_country and is_known_country(loc_country):
                # Strong penalty for a different known country (e.g., "India" lines inside a US resume).
                score -= 35

            if preferred_state and loc_state:
                if normalize_state(loc_state).casefold() == normalize_state(preferred_state).casefold():
                    score += 12
                elif normalize_country(loc_country).casefold() == normalize_country(preferred_country).casefold():
                    # If we're already in the preferred country but state mismatches, gently penalize.
                    score -= 6

        if score > best_score:
            best_score = score
            best_loc = loc

    for i, ln in enumerate(top):
        lnl = ln.lower()

        # Never treat experience entries (company/client + dates) as residence.
        if _looks_like_experience_location_line(ln):
            continue

        # Past the experience section heading: accept location only when it has
        # an explicit contact/address label (e.g. "Address:", "Location:").
        if _experience_section_start_idx is not None and i >= _experience_section_start_idx:
            if not preferred_location_label_re.search(ln):
                continue

        # If a contact line contains separators, sometimes one segment is location.
        # Handle this BEFORE skipping because the line may contain "LinkedIn" or an email.
        if any(sep in ln for sep in ["|", "◇", "·", "•", "∙"]):
            segments = [s.strip() for s in re.split(r"[|◇·•∙]", ln) if s.strip()]
            for seg in reversed(segments):
                if _looks_like_experience_location_line(seg):
                    continue
                segl = seg.lower()
                if any(bad in segl for bad in ["linkedin", "github", "email", "@", "http"]):
                    continue
                m_zip = zip_state_re.search(seg.upper())
                m_csz = city_state_zip_re.search(seg)
                if m_csz:
                    city, state = _sanitize_city_candidate(m_csz.group(1)), m_csz.group(2)
                    if is_plausible_city(city):
                        consider(format_location(city, state, "United States"), base=90, idx=i)
                        continue

                if m_zip:
                    consider(format_location(None, m_zip.group(1), "United States"), base=88, idx=i)
                    continue

                # Handle org-prefixed locations ending with ", Country".
                tail_loc = extract_tail_location_before_country(seg)
                if tail_loc:
                    consider(tail_loc, base=70, idx=i)
                    continue

                m_csc = city_state_country_re.search(seg)
                if m_csc and is_known_country(m_csc.group(3)):
                    city, state, country = _sanitize_city_candidate(m_csc.group(1)), m_csc.group(2), m_csc.group(3)
                    if is_plausible_city(city) and is_plausible_region(state):
                        consider(format_location(city, state, country), base=85, idx=i)
                        continue
                    if is_plausible_region(state) and is_known_country(country):
                        # Fallback: state-only if city looks like employer/junk.
                        consider(format_location(None, state, country), base=55, idx=i)
                m_cs = city_state_re.search(seg)
                if m_cs:
                    city, state = _sanitize_city_candidate(m_cs.group(1)), m_cs.group(2)
                    if _looks_like_sql_state_suffix(seg, m_cs.end(2)):
                        continue
                    if is_plausible_city(city):
                        consider(format_location(city, state, "United States"), base=82, idx=i)
                        continue

                # City, StateName inside a segmented header (e.g., "Dallas, Texas")
                m_csn = city_state_name_re.search(seg)
                if m_csn:
                    city, state = _sanitize_city_candidate(m_csn.group(1)), m_csn.group(2)
                    if is_us_state(state) and is_plausible_region(state) and is_plausible_city(city):
                        consider(format_location(city, state, "United States"), base=80, idx=i)
                        continue

                # State, Country (e.g., 'Arizona, United States')
                m_sc = state_country_re.search(seg)
                if m_sc and is_known_country(m_sc.group(2)) and is_us_state(m_sc.group(1)):
                    state, country = m_sc.group(1), m_sc.group(2)
                    if is_plausible_region(state):
                        consider(format_location(None, state, country), base=55, idx=i)
                        continue

                m_cc = city_country_re.search(seg)
                # Validate country token to avoid returning arbitrary "City, Skill" pairs.
                if m_cc and is_known_country(m_cc.group(2)):
                    city, country = _sanitize_city_candidate(m_cc.group(1)), m_cc.group(2)
                    # If the "city" is actually a US state (common), treat it as state-only.
                    if is_us_state(city) and is_plausible_region(city):
                        consider(format_location(None, city, country), base=55, idx=i)
                        continue
                    if is_plausible_city(city):
                        consider(format_location(city, None, country), base=60, idx=i)
                        continue
                    # If the city is junk but ends with a state name, treat it as state-only.
                    city_toks = [t for t in re.split(r"\s+", city) if t]
                    if city_toks:
                        tail = " ".join(city_toks[-2:]).casefold()
                        if is_us_state(tail) and is_plausible_region(tail):
                            consider(format_location(None, tail, country), base=54, idx=i)
                # Country-only token
                if is_known_country(seg):
                    consider(format_location(None, None, seg), base=40, idx=i)
                    continue

        # Simple location tokens (run before skipping contact lines that contain '@')
        if is_known_country(ln) and len(ln.strip()) <= 80:
            consider(format_location(None, None, ln), base=40, idx=i)
            continue

        # Some headers put email/URLs in the same line as the location.
        # Instead of skipping such lines entirely, redact them and still attempt location parsing.
        ln_loc = ln
        lnl_loc = lnl
        if any(bad in lnl for bad in ["@", "http", "www."]):
            ln_loc = re.sub(r"(?i)\b\S+@\S+\b", " ", ln_loc)
            ln_loc = re.sub(r"(?i)https?://\S+|www\.\S+", " ", ln_loc)
            ln_loc = re.sub(r"\s+", " ", ln_loc).strip()
            lnl_loc = ln_loc.lower()

        if any(w in lnl_loc for w in bad_address_words):
            continue

        # Avoid selecting education/institution locations as residence.
        if education_noise_re.search(ln_loc):
            continue

        # Handle org-prefixed locations ending with ", Country".
        tail_loc = extract_tail_location_before_country(ln_loc)
        if tail_loc:
            consider(tail_loc, base=65, idx=i)
            continue

        looks_like_address = False
        m_csz = city_state_zip_re.search(ln_loc)
        m_zip = zip_state_re.search(ln_loc.upper())
        m_csc = city_state_country_re.search(ln_loc)
        m_cs = city_state_re.search(ln_loc)
        m_css = city_state_space_re.search(ln_loc)
        m_cc = city_country_re.search(ln_loc)
        m_ccs = city_country_space_re.search(ln_loc)
        m_sc = state_country_re.search(ln_loc)
        if m_zip or m_csz or (m_csc and is_known_country(m_csc.group(3))) or m_cs or m_css or (m_cc and is_known_country(m_cc.group(2))) or (m_ccs and is_known_country(m_ccs.group(2))):
            looks_like_address = True
        if m_sc and is_known_country(m_sc.group(2)) and is_us_state(m_sc.group(1)):
            looks_like_address = True
        if any(re.search(rf"\b{re.escape(k)}\b", lnl_loc) for k in street_keywords) and any(
            ch.isdigit() for ch in ln_loc
        ):
            looks_like_address = True

        if looks_like_address:
            # Prefer City, ST ZIP over ST ZIP (state-only).
            if m_csz:
                city, state = _sanitize_city_candidate(m_csz.group(1)), m_csz.group(2)
                if is_plausible_city(city):
                    consider(format_location(city, state, "United States"), base=90, idx=i)
                    continue
            if m_zip:
                consider(format_location(None, m_zip.group(1), "United States"), base=88, idx=i)
                continue
            if m_csc and is_known_country(m_csc.group(3)):
                city, state, country = _sanitize_city_candidate(m_csc.group(1)), m_csc.group(2), m_csc.group(3)
                if is_plausible_city(city) and is_plausible_region(state):
                    consider(format_location(city, state, country), base=85, idx=i)
                    continue
                if is_plausible_region(state) and is_known_country(country):
                    consider(format_location(None, state, country), base=55, idx=i)
            if m_cs:
                city, state = _sanitize_city_candidate(m_cs.group(1)), m_cs.group(2)
                if _looks_like_sql_state_suffix(ln_loc, m_cs.end(2)):
                    continue
                if is_plausible_city(city):
                    consider(format_location(city, state, "United States"), base=82, idx=i)
                    continue

            if m_css:
                city, state = _sanitize_city_candidate(m_css.group(1)), m_css.group(2)
                if _looks_like_sql_state_suffix(ln_loc, m_css.end(2)):
                    continue
                if is_plausible_city(city):
                    consider(format_location(city, state, "United States"), base=81, idx=i)
                    continue

            m_csn = city_state_name_re.search(ln_loc)
            if m_csn:
                city, state = _sanitize_city_candidate(m_csn.group(1)), m_csn.group(2)
                if is_us_state(state) and is_plausible_region(state) and is_plausible_city(city):
                    consider(format_location(city, state, "United States"), base=80, idx=i)
                    continue
            if m_sc and is_known_country(m_sc.group(2)) and is_us_state(m_sc.group(1)):
                state, country = m_sc.group(1), m_sc.group(2)
                if is_plausible_region(state):
                    consider(format_location(None, state, country), base=55, idx=i)
                    continue
            if m_cc and is_known_country(m_cc.group(2)):
                city, country = _sanitize_city_candidate(m_cc.group(1)), m_cc.group(2)
                if is_us_state(city) and is_plausible_region(city):
                    consider(format_location(None, city, country), base=55, idx=i)
                    continue
                if is_plausible_city(city):
                    consider(format_location(city, None, country), base=60, idx=i)
                    continue

            if m_ccs and is_known_country(m_ccs.group(2)):
                city, country = _sanitize_city_candidate(m_ccs.group(1)), m_ccs.group(2)
                if is_us_state(city) and is_plausible_region(city):
                    consider(format_location(None, city, country), base=54, idx=i)
                    continue
                if is_plausible_city(city):
                    consider(format_location(city, None, country), base=59, idx=i)
                    continue
            continue

    if best_loc:
        # If the best match is only a country and it contradicts the phone-derived
        # preference, treat it as incidental (often from education like "..., India")
        # and fall back to the phone-derived country/state instead.
        if allow_phone_fallback and preferred_country:
            parts = [p.strip() for p in (best_loc or "").split(",") if p.strip()]
            if len(parts) == 1 and is_known_country(parts[0]):
                best_country = normalize_country(parts[0])
                pref_country = normalize_country(preferred_country)
                if best_country and pref_country and best_country.casefold() != pref_country.casefold():
                    return format_location(None, preferred_state or None, preferred_country)

            # Similar guard for a 2-part "City, Country" result.
            # When the phone indicates a different known country, this is frequently an
            # education/institution/client location rather than the candidate's residence.
            if len(parts) == 2 and is_known_country(parts[1]):
                best_country = normalize_country(parts[1])
                pref_country = normalize_country(preferred_country)
                if best_country and pref_country and best_country.casefold() != pref_country.casefold():
                    return format_location(None, preferred_state or None, preferred_country)

        return best_loc

    # Fallback: pick the first location-like mention anywhere.
    # Keep this strict to avoid matching tool lists like "Oracle, MS-SQL".
    city_state_any = re.compile(r"\b([A-Z][A-Za-z .'-]{1,}),\s*(" + "|".join(sorted(US_STATE_ABBRS)) + r")\b")
    city_state_country_any = re.compile(r"\b([A-Z][A-Za-z .'-]{1,}),\s*([A-Za-z .'-]{2,}|[A-Z]{2})\s*,\s*([A-Za-z .'-]{2,})\b")
    city_state_name_any = re.compile(r"\b([A-Z][A-Za-z .'-]{1,}),\s*([A-Z][A-Za-z .'-]{2,})\b")

    for i_fb, ln in enumerate(all_lines[:300]):
        if _looks_like_experience_location_line(ln):
            continue
        # Stop harvesting location from the experience section in the deep fallback too.
        if _experience_section_start_idx is not None and i_fb >= _experience_section_start_idx:
            continue
        # Stop at the skills section — technology names in skill bullets are NOT locations.
        # This is the primary fix for "Xunit, Mississippi, United States" false positives.
        if _skills_section_start_idx is not None and i_fb >= _skills_section_start_idx:
            break

        # As above: redact emails/URLs rather than skipping the whole line,
        # since many resumes put email + location together.
        ln_loc = ln
        if any(bad in ln.lower() for bad in ["http", "www.", "@"]):
            ln_loc = re.sub(r"(?i)\b\S+@\S+\b", " ", ln_loc)
            ln_loc = re.sub(r"(?i)https?://\S+|www\.\S+", " ", ln_loc)
            ln_loc = re.sub(r"\s+", " ", ln_loc).strip()

        m_any = city_state_any.search(ln_loc)
        if m_any and _looks_like_sql_state_suffix(ln_loc, m_any.end(2)):
            continue

        # If the would-be "city" is actually a known tech token, skip.
        if m_any and _norm_token(m_any.group(1)) in bad_location_tokens:
            continue

        tail_loc = extract_tail_location_before_country(ln_loc)
        if tail_loc:
            consider(tail_loc, base=40, idx=40)
            continue

        # Avoid selecting education/institution locations as residence.
        if education_noise_re.search(ln_loc):
            continue

        m1 = city_state_any.search(ln_loc)
        if m1:
            city, state = _sanitize_city_candidate(m1.group(1)), m1.group(2).strip()
            if is_plausible_city(city):
                consider(format_location(city, state, "United States"), base=45, idx=45)
                continue

        m1b = city_state_name_any.search(ln_loc)
        if m1b:
            city, state = _sanitize_city_candidate(m1b.group(1)), m1b.group(2).strip()
            if is_us_state(state) and is_plausible_region(state) and is_plausible_city(city):
                consider(format_location(city, state, "United States"), base=44, idx=45)
                continue
        m2 = city_state_country_any.search(ln_loc)
        if m2 and is_known_country(m2.group(3)):
            city, state, country = _sanitize_city_candidate(m2.group(1)), m2.group(2).strip(), m2.group(3).strip()
            if is_plausible_city(city) and is_plausible_region(state):
                consider(format_location(city, state, country), base=46, idx=45)
                continue
            if is_plausible_region(state):
                consider(format_location(None, state, country), base=30, idx=45)
        m3 = city_country_re.search(ln_loc)
        if m3 and is_known_country(m3.group(2)):
            city, country = _sanitize_city_candidate(m3.group(1)), m3.group(2)
            if is_us_state(city) and is_plausible_region(city):
                consider(format_location(None, city, country), base=30, idx=45)
                continue
            if is_plausible_city(city):
                consider(format_location(city, None, country), base=32, idx=45)
                continue
        if is_known_country(ln_loc) and len(ln_loc.strip()) <= 60:
            consider(format_location(None, None, ln_loc), base=25, idx=45)
            continue

    if best_loc:
        # Same guard as above: if we only found a conflicting country-only token
        # (often from education), prefer phone-derived residence.
        if allow_phone_fallback and preferred_country:
            parts = [p.strip() for p in (best_loc or "").split(",") if p.strip()]
            if len(parts) == 1 and is_known_country(parts[0]):
                best_country = normalize_country(parts[0])
                pref_country = normalize_country(preferred_country)
                if best_country and pref_country and best_country.casefold() != pref_country.casefold():
                    return format_location(None, preferred_state or None, preferred_country)

            if len(parts) == 2 and is_known_country(parts[1]):
                best_country = normalize_country(parts[1])
                pref_country = normalize_country(preferred_country)
                if best_country and pref_country and best_country.casefold() != pref_country.casefold():
                    return format_location(None, preferred_state or None, preferred_country)

        return best_loc

    # Use location_parser medium/low-confidence result if the full regex scan
    # also found nothing valid.  This is the final content-based attempt before
    # falling back to the phone-derived country/state.
    if not best_loc and _lp_str:
        return _lp_str

    # Final fallback: if we couldn't find a location string in the text,
    # optionally use phone-derived country/state rather than returning blank.
    # IMPORTANT: callers that also search the full resume should disable this
    # for the header-only pass, otherwise a country-only result can mask a more
    # specific city/state found later.
    if allow_phone_fallback and preferred_country:
        return format_location(None, preferred_state or None, preferred_country)

    return ""


# ---------------- EDUCATION ----------------
# NOTE: implementation lives in data_normalization.py (keeps parsing+cleanup consistent).
# The symbol name stays the same for minimal changes across the codebase.



# ---------------- VISA ----------------
def extract_visa(text):
    # visa_support (BOOLEAN): True means candidate needs sponsorship/visa support.
    # work_authorization_type (TEXT): one of the known visa/work types.
    t = text.lower()
    # Normalize to avoid pathological regex behavior on long PDF text.
    # Keep only alphanumerics as tokens; treat everything else as separators.
    t_sep = re.sub(r"[^a-z0-9]+", " ", t)
    t_sep = re.sub(r"\s+", " ", t_sep).strip()

    # Explicit sponsorship signal
    visa_support: bool | None = None
    if any(k in t for k in ["no sponsorship required", "no sponsorship", "do not require sponsorship"]):
        visa_support = False
    elif any(k in t for k in ["sponsorship required", "need sponsorship", "require sponsorship", "will require sponsorship"]):
        visa_support = True

    # Work authorization / visa type
    work_auth: str | None = None
    if any(k in t for k in ["us citizen", "u.s. citizen", "citizen of the united states"]):
        work_auth = "US Citizen"
        visa_support = False
    elif any(k in t for k in ["green card", "permanent resident", "lawful permanent resident"]):
        work_auth = "GreenCard"
        visa_support = False
    else:
        # Match requested visa types. Avoid naive substring matching (e.g., 'cdh4' or 'lead').
        # Allow optional separators between letters for OCR/PDF artifacts.
        def has_sep_token(pattern: str) -> bool:
            # Patterns are matched against separator-normalized text; keep them bounded.
            return re.search(pattern, t_sep, flags=re.I) is not None

        # Combined patterns (more specific)
        has_h4ead = has_sep_token(r"\bh\s*4\s*e\s*a\s*d\b")
        has_l2sead = has_sep_token(r"\bl\s*2\s*s\s*e\s*a\s*d\b")
        has_opt = has_sep_token(r"\bopt\b")
        has_ead = has_sep_token(r"\bead\b")
        has_optead = has_sep_token(r"\bopt\s*e\s*a\s*d\b") or (has_opt and has_ead)

        # Single-token patterns (keep strict boundaries)
        has_h1b = has_sep_token(r"\bh\s*1\s*b\b")
        has_h2b = has_sep_token(r"\bh\s*2\s*b\b")
        has_cpt = has_sep_token(r"\bcpt\b")

        if has_h1b:
            work_auth = "H1B"
        elif has_h2b:
            work_auth = "H2B"
        elif has_h4ead:
            work_auth = "H4EAD"
        elif has_l2sead:
            work_auth = "L2SEAD"
        elif has_optead or has_opt:
            work_auth = "OPT EAD"
        elif has_cpt:
            work_auth = "CPT"

        # If we found a visa type and there's no explicit "no sponsorship" statement,
        # treat visa_support as True by default.
        if work_auth and visa_support is None:
            visa_support = True

    return bool(visa_support) if visa_support is not None else False, work_auth


# ---------------- LINKEDIN ----------------
def extract_linkedin(text):
    """Extract LinkedIn profile URL from resume text.

    Applies a three-tier strategy:
    1. Scan lines that carry an explicit 'LinkedIn' label first — these are
       typically on page 1 of the resume and the most reliable source.
    2. Run the full URL regex over the entire supplied text.
    3. Normalise and validate whatever URL was found.

    Also handles PDF space-broken URLs like
    "linkedin .com /in/ john-smith" by collapsing whitespace inside URL fragments
    before the main regex runs.
    """

    def _normalise_url(raw: str) -> str | None:
        url = raw.strip()
        if not url.lower().startswith("http"):
            url = "https://" + url
        url = re.sub(r"^http://", "https://", url, flags=re.I)
        # Ensure www. prefix for consistency
        url = re.sub(r"^https://linkedin\.com/", "https://www.linkedin.com/", url, flags=re.I)
        # Remove trailing hyphens/slashes that occur when PDF text wraps mid-URL
        url = re.sub(r"[-/]+$", "", url)
        # Validate the slug is non-empty after the /in/ prefix
        slug_match = re.search(r"/in/([a-zA-Z0-9][a-zA-Z0-9\-_%]{1,})", url)
        if not slug_match:
            return None
        # Reject obviously-bad slugs (pure numbers, single char)
        slug = slug_match.group(1)
        if slug.isdigit() or len(slug) < 2:
            return None
        return url

    _LI_URL_RE = re.compile(
        r"(?:https?://)?(?:www\.)?linkedin\.com\s*/\s*in\s*/\s*[a-zA-Z0-9][a-zA-Z0-9\-_%]*",
        re.I,
    )
    # Collapse PDF-introduced whitespace inside URL fragments before the main scan.
    # e.g. "https:// www. linkedin .com /in/ john-smith" -> collapsible.
    _broken_url_re = re.compile(
        r"(?:https?://)?\s*(?:www\.)?\s*linkedin\s*\.\s*com\s*/\s*in\s*/\s*([a-zA-Z0-9][a-zA-Z0-9\-_%\s]*)",
        re.I,
    )

    lines = non_empty_lines(text or "")

    # ── Tier 1: Lines that contain an explicit LinkedIn label ────────────────
    # These lines are virtually always in the contact/header block of page 1.
    for ln in lines[:80]:
        if not re.search(r"(?i)\blinked\s*in\b", ln):
            continue
        # Try the standard URL pattern first.
        m = _LI_URL_RE.search(ln)
        if m:
            result = _normalise_url(m.group())
            if result:
                return result
        # Handle PDF-broken URL on the same line.
        m2 = _broken_url_re.search(ln)
        if m2:
            slug_raw = re.sub(r"\s+", "", m2.group(1))  # collapse spaces in slug
            if slug_raw and not slug_raw.isdigit() and len(slug_raw) >= 2:
                return _normalise_url(f"https://www.linkedin.com/in/{slug_raw}")
        # Handle shorthand label: "LinkedIn: john-smith" or "LinkedIn: /in/john-smith"
        label_m = re.search(
            r"(?i)linked\s*in\s*[:\-]\s*(?:/\s*in\s*/\s*)?([a-zA-Z0-9][a-zA-Z0-9\-_%]{2,})",
            ln,
        )
        if label_m:
            slug = label_m.group(1).strip()
            # Reject common false positives ("LinkedIn: Profile", "LinkedIn: View")
            if slug.casefold() not in {"profile", "view", "link", "url", "connect", "visit"}:
                result = _normalise_url(f"https://www.linkedin.com/in/{slug}")
                if result:
                    return result

    # ── Tier 2: Full-text URL regex scan ────────────────────────────────────
    # Collapse PDF whitespace in a scratch copy to catch broken URLs anywhere.
    scratch = re.sub(
        r"(linkedin)\s*\.\s*(com)",
        r"\1.\2",
        (text or ""),
        flags=re.I,
    )
    m = _LI_URL_RE.search(scratch)
    if m:
        result = _normalise_url(m.group())
        if result:
            return result

    return None


# ---------------- SKILLS ----------------
def extract_skills(text):
    def _normalize_for_skills(s: str) -> str:
        # Keep characters used in common skill tokens: c#, c++, node.js, .net, ci/cd, end-to-end
        s = (s or "")
        # Split common glued/camel-case forms: AzureDatabricks -> Azure Databricks
        s = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", s)
        s = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", s)
        s = s.casefold()
        s = re.sub(r"[^a-z0-9+#+#+#+#+./-]+", " ", s)
        s = re.sub(r"\s+", " ", s).strip()
        return s

    @lru_cache(maxsize=1)
    def _skills_index() -> tuple[set[str], dict[str, list[str]]]:
        """Return (single_token_skills, multiword_skills_by_first_token)."""

        # Load skills master if available/non-empty; otherwise use a small fallback list.
        skills_master: list[str] = []
        try:
            with open("skills_master.txt", encoding="utf-8", errors="ignore") as f:
                skills_master = [s.strip() for s in f.readlines() if s.strip()]
        except OSError:
            skills_master = []

        fallback_skills = [
            "python",
            "java",
            "javascript",
            "typescript",
            "c",
            "c++",
            "c#",
            "golang",
            "go",
            "ruby",
            "php",
            "react",
            "angular",
            "vue",
            "node",
            "node.js",
            "nodejs",
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
            "postgresql",
            "mysql",
            "mongodb",
            "redis",
            "docker",
            "kubernetes",
            "git",
            "jenkins",
            "terraform",
            "ansible",
            "github actions",
            "gitlab ci",
            "html",
            "css",
            "kafka",
            "spark",
            "hadoop",
            "airflow",
            "snowflake",
            "databricks",
            "tableau",
            "power bi",
            "android studio",
            "ms excel",
            "jira",
            "confluence",
            "d3.js",
            "vue.js",
            "api gateway",
            "azure devops",
            "azure dev ops",
            "asp.net",
            "asp.net mvc",
            "react.js",
            "invision",
            "in vision",
            "nlp",
            "spacy",
            "nltk",
            "keras",
            "scikit-learn",
            "tensorflow",
            "pytorch",
            "pytesseract",
            "ocr",
            "llm",
            "rag",
            "langchain",
            "flutter",
            "firebase",
            "swift",
            "android",
            "ios",
        ]

        # Merge master list + fallback so we don't lose common skills if skills_master is incomplete.
        merged: list[str] = []
        seen = set()
        for s in (skills_master + fallback_skills):
            sl = s.strip().casefold()
            if not sl or sl in seen:
                continue
            seen.add(sl)
            merged.append(s)

        single: set[str] = set()
        multi_by_first: dict[str, list[str]] = {}
        for s in merged:
            sn = _normalize_for_skills(s)
            if not sn:
                continue
            # Add a small alias for .NET, which appears with/without leading dot.
            if sn == ".net":
                single.add("net")

            if " " in sn:
                first = sn.split(" ", 1)[0]
                multi_by_first.setdefault(first, []).append(sn)
            else:
                single.add(sn)

        # Dedupe lists
        for k, vals in list(multi_by_first.items()):
            uniq: list[str] = []
            sset: set[str] = set()
            for v in vals:
                if v in sset:
                    continue
                sset.add(v)
                uniq.append(v)
            multi_by_first[k] = uniq

        return single, multi_by_first

    # Fast matching: normalize once and use cached index.
    if not text:
        return None

    single, multi_by_first = _skills_index()
    norm = _normalize_for_skills(text)
    if not norm:
        return None

    tokens = set(norm.split())
    padded = f" {norm} "

    found: set[str] = set()
    # Single-token skills: set intersection
    # Avoid global matching for very ambiguous short tokens (add them only from a Skills section).
    ambiguous = {"c", "go", "r"}
    found |= ((tokens & single) - ambiguous)

    # Multiword skills: only check candidates whose first token appears
    for tok in tokens:
        for phrase in multi_by_first.get(tok, []):
            if f" {phrase} " in padded:
                found.add(phrase)

    if not found:
        found = set()

    def _extract_section_lines(all_lines: list[str], heading_words: set[str]) -> list[str]:
        def is_heading_like(raw_line: str) -> bool:
            ln = (raw_line or "").strip()
            if not ln:
                return False
            if len(ln) > 60:
                return False
            # Common heading formats: ALL CAPS, Title Case short, or ends with ':'
            if ln.endswith(":"):
                return True
            alpha = re.sub(r"[^A-Za-z]", "", ln)
            if alpha and len(alpha) <= 30 and ln.isupper():
                return True
            # Avoid matching mid-sentence words like "technical solutions".
            # Require very low punctuation.
            if re.search(r"[.!?]", ln):
                return False
            # Accept short label-ish lines.
            return len(ln.split()) <= 4

        start = None
        inline_first: str | None = None
        for i, ln in enumerate(all_lines):
            key = re.sub(r"[^a-zA-Z ]", " ", ln).strip().lower()
            key = re.sub(r"\s+", " ", key)
            if key in heading_words or any(key.startswith(h + " ") for h in heading_words):
                if not is_heading_like(ln):
                    continue
                # If the heading line also contains inline content (e.g., "Skills: Python, SQL"), capture it.
                m_inline = re.search(r"(?i)\b(?:skills|technical\s+skills|tools|technologies|tech\s+stack|core\s+competencies)\b\s*[:\-]\s*(.+)$", ln.strip())
                if m_inline:
                    inline_first = m_inline.group(1).strip()
                start = i + 1
                break
        if start is None:
            return []

        out: list[str] = []
        if inline_first:
            out.append(inline_first)
        blanks = 0
        stop_headers = {
            "work experience",
            "experience",
            "professional experience",
            "employment",
            "employment history",
            "work history",
            "education",
            "projects",
            "project",
            "summary",
            "objective",
            "certifications",
            "certification",
            "publications",
            "awards",
            "activities",
        }
        for ln in all_lines[start:]:
            if not ln.strip():
                blanks += 1
                if blanks >= 2:
                    break
                continue
            blanks = 0

            # Stop at likely new section headers.
            if ln.isupper() and len(ln) <= 45:
                break
            if re.fullmatch(r"[A-Za-z ]{3,45}:", ln.strip()):
                break
            key2 = re.sub(r"[^a-zA-Z ]", " ", ln).strip().lower()
            key2 = re.sub(r"\s+", " ", key2)
            if key2 in stop_headers and is_heading_like(ln):
                break

            out.append(ln.strip())
            if len(out) >= 18:
                break
        return out

    # Section-based fallback: parse the Skills section and take tokens as skills,
    # even if they don't exist in skills_master.txt.
    lines_raw = [ln.strip() for ln in (text or "").split("\n")]
    section = _extract_section_lines(
        lines_raw,
        {
            "skills",
            "technical skills",
            "core skills",
            "tools",
            "technologies",
            "tech stack",
            "core competencies",
            "programming languages",
        },
    )

    stopwords = {
        "summary",
        "objective",
        "experience",
        "education",
        "certification",
        "certifications",
        "projects",
        "project",
        # Common non-technical “skills” that we do not want in tech_skills.
        "communication",
        "leadership",
        "teamwork",
        "collaboration",
        "problem solving",
        "problem-solving",
    }

    # Phrases that appear in resumes but are not desired as tech skill tokens.
    drop_skill_phrases = {
        "system design",
        "system-design",
        "css system design",
        "css system-design",
        "sql database",
        "database",
    }

    # Generic verb prefixes that often wrap a real skill token in tables/bullets.
    # Example: "Caching Redis" -> keep "Redis".
    strip_prefix_verbs = {
        "caching",
        "cache",
        "monitoring",
        "logging",
        "testing",
        "automation",
        "orchestration",
    }

    role_words = {
        "engineer",
        "developer",
        "analyst",
        "architect",
        "consultant",
        "manager",
        "lead",
        "intern",
        "specialist",
        "administrator",
        "scientist",
        "designer",
    }

    # Category labels that frequently prefix skills in tabular resumes.
    # Example: "Cloud Platforms AWS, Azure" -> keep only "AWS, Azure".
    category_prefix_re = re.compile(
        r"(?i)^(?:"
        r"category|technologies\s+and\s+tools|technologies\s*&\s*tools|"
        r"languages?|machine\s+learning|schema\s+model(?:ing)?|big\s+data\s+technologies|"
        r"cloud\s+platforms?|data\s+visuali[sz]ation|databases?|data\s+warehouse|"
        r"etl\s+tools?|ide\s+tools?|version\s+control\s+tools?|sdlc\s+methodologies"
        r")\b\s*(.+)$"
    )

    for ln in section:
        # Drop common prefixes like "Frontend:" "Tools:" etc.
        if ":" in ln and len(ln.split(":", 1)[0]) <= 28:
            ln = ln.split(":", 1)[1].strip()
        else:
            # Also handle prefix-without-colon patterns like "Cloud Platforms AWS, Azure".
            m_cat = category_prefix_re.match(ln.strip())
            if m_cat:
                ln = m_cat.group(1).strip()

        # Treat spaced hyphens as separators (e.g., "Python - Matplotlib").
        ln = re.sub(r"\s+[-–—]\s+", ", ", ln)
        parts = re.split(r"[|,/;•·\u2022]", ln)
        for p in parts:
            p = p.strip().strip("-–—•·")
            if not p:
                continue
            if len(p) > 40:
                continue
            pl = p.casefold()
            if pl in stopwords:
                continue
            if any(x in pl for x in ["top secret", "clearance", "ts/sci", "ts sci", "public trust"]):
                continue
            # Reject long numeric-ish tokens and most "word+number" artifacts (e.g., "achieving90").
            digit_count = sum(ch.isdigit() for ch in p)
            if digit_count >= 4:
                continue
            if digit_count and re.search(r"[A-Za-z]", p) and not re.fullmatch(r"(?i)(?:java|python|c\+\+|c#)\s*\d{1,2}(?:\.\d+)?", p.strip()):
                # Keep only obvious version patterns like "Java 17"; otherwise treat as noise.
                continue

            # Keep as normalized phrase in the same format used elsewhere.
            norm_p = _normalize_for_skills(p)
            if not norm_p:
                continue
            if norm_p in drop_skill_phrases:
                continue

            # Strip generic verb prefixes if the remainder is a known skill.
            if " " in norm_p:
                first, rest = norm_p.split(" ", 1)
                if first in strip_prefix_verbs:
                    is_rest_known = False
                    if rest in single:
                        is_rest_known = True
                    elif " " in rest:
                        r_first = rest.split(" ", 1)[0]
                        if rest in (multi_by_first.get(r_first, []) or []):
                            is_rest_known = True
                    if is_rest_known:
                        norm_p = rest

            # Drop 1-char tokens (usually stray initials / state abbreviations).
            if len(norm_p) < 2:
                continue
            # Avoid job-title words leaking into skills (e.g., "DataScienceIntern").
            if any(w in norm_p.split() for w in role_words) and norm_p not in single:
                continue
            # Drop a few generic tokens that tend to appear as plain English words.
            if norm_p in {"actions"}:
                continue

            # Keep section-derived tokens only when they are known skills (master/fallback)
            # or strongly look like a tech token.
            is_known = False
            if norm_p in single:
                is_known = True
            elif " " in norm_p:
                first = norm_p.split(" ", 1)[0]
                if norm_p in (multi_by_first.get(first, []) or []):
                    is_known = True

            if not is_known:
                # Allow common punctuation-based single tokens: node.js, d3.js, express.js
                if re.fullmatch(r"[a-z0-9]+(?:\.[a-z0-9]+)+", norm_p):
                    # Reject purely numeric dotted tokens like "1.1" / "2.0" that often come
                    # from numbered skill lists.
                    if re.search(r"[a-z]", norm_p):
                        pass
                    else:
                        continue
                # Allow CI/CD style tokens
                elif "/" in norm_p or "+" in norm_p or "#" in norm_p:
                    pass
                # Allow short phrases anchored by known skills (e.g., "asp.net mvc")
                elif " " in norm_p:
                    toks = norm_p.split()
                    if len(toks) <= 3 and any(t in single for t in toks):
                        pass
                    else:
                        continue
                else:
                    continue
            found.add(norm_p)

    # Add ambiguous short skills only if they appeared in the Skills/Tech section.
    if section:
        section_norm = _normalize_for_skills(" ".join(section))
        section_tokens = set(section_norm.split())
        for amb in ["c", "go", "r"]:
            if amb in section_tokens and amb in single:
                found.add(amb)

    if not found:
        return None

    cleaned = sorted({re.sub(r"\s+", " ", v).strip() for v in found if v.strip()}, key=lambda x: x.casefold())
    return ", ".join(cleaned) if cleaned else None


# ---------------- EXPERIENCE ----------------
def extract_experience_years(text):
    # Capture common variations: "6+ years", "over 6 years", "6 yrs", and PDFs with missing spaces like "6yearsofexperience".
    m = re.search(
        r"(?i)(?:over\s*|more\s*than\s*|around\s*)?(\d{1,2}(?:\.\d+)?)\s*\+?\s*(?:years|yrs)\s*(?:of\s*)?",
        text,
    )
    return float(m.group(1)) if m else None


def extract_role_experience_years(text: str, job_title: str) -> float | None:
    if not job_title:
        return None
    jt = re.sub(r"\s+", " ", job_title.strip()).lower()
    if not jt or len(jt) < 3:
        return None

    # Look for patterns like "6 years of experience as a Data Engineer"
    pat = re.compile(
        rf"(?i)(\d{{1,2}}(?:\.\d+)?)\s*\+?\s*(?:years|yrs)\s*(?:of\s+)?(?:experience\s*)?(?:as|in)\s+(?:a\s+|an\s+)?{re.escape(jt)}",
    )
    m = pat.search(text)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            return None
    return None


# ---------------- CERTIFICATIONS ----------------
def extract_certifications(text):
    return extract_standard_certifications(text)


def _infer_role_categories(job_title: str, skills: str | None) -> set[str]:
    jt = (job_title or "").casefold()
    sk = (skills or "").casefold()
    cats: set[str] = set()

    if any(x in jt for x in ["project", "program", "product", "scrum", "agile"]):
        cats.add("pm")
    if any(x in jt for x in ["devops", "sre", "site reliability"]):
        cats.add("devops")
    if any(x in jt for x in ["security", "infosec", "cyber"]):
        cats.add("security")
    if any(x in jt for x in ["data", "analytics", "machine learning", "ml", "ai"]):
        cats.add("data")
    if any(x in jt for x in ["network", "cisco"]):
        cats.add("network")

    # Skills-only signals
    if any(x in sk for x in ["kubernetes", "docker", "terraform", "jenkins", "ci/cd"]):
        cats.add("devops")
    if any(x in sk for x in ["aws", "azure", "gcp"]):
        cats.add("cloud")
    if any(x in sk for x in ["sql", "spark", "hadoop", "kafka"]):
        cats.add("data")

    return cats


def extract_standard_certifications(
    text: str,
    *,
    job_title: str = "",
    skills: str | None = None,
    _compiled_patterns_cache: list[tuple[re.Pattern[str], str, set[str]]] = [],
) -> str | None:
    """Extract only well-known certifications.

    Avoids random/low-signal "certificates" (e.g., participation, workshops).
    """

    if not text:
        return None

    # Normalize common extraction artifacts so patterns match reliably.
    text_norm = (text or "")
    text_norm = text_norm.replace("\x00", " ")
    text_norm = text_norm.replace("\u0000", " ")
    text_norm = text_norm.replace("’", "'").replace("‘", "'")
    text_norm = re.sub(r"[\u2010\u2011\u2012\u2013\u2014\u2212]", "-", text_norm)
    text_norm = text_norm.replace("\ufffd", "-")
    text_norm = re.sub(r"\s+", " ", text_norm)

    # Some OCR/text extraction paths can produce extremely large blobs of text.
    # Running many regex searches across multi-megabyte strings can become very slow
    # (and can appear to "hang" during backfills). Limit scanning to relevant windows.
    try:
        max_scan = int(os.getenv("CERT_SCAN_MAX_CHARS", "200000") or "200000")
    except Exception:
        max_scan = 200000
    max_scan = max(20000, min(1_000_000, max_scan))

    if len(text_norm) > max_scan:
        signals = re.compile(
            r"(?i)\b(?:certif(?:ied|ication)|certificate|certifications?|exam|credential)\b|"
            r"\b(?:aws\s+certified|microsoft\s+certified|google\s+cloud\s+certified)\b|"
            r"\b(?:az|dp|ai|sc|pl|mb)-?\d{3}\b|\b(?:saa|sap|dva|soa|dop|das|mls)-?c0?\d\b|"
            r"\b(?:cissp|cism|cisa|ceh|oscp|pmp|capm|itil|istqb|ccna|ccnp|cka|ckad|cks|rhcsa|rhce)\b"
        )
        # Collect small windows around signal matches until we reach max_scan.
        windows: list[str] = []
        total = 0
        last_end = -1
        for m in signals.finditer(text_norm):
            start = max(0, m.start() - 500)
            end = min(len(text_norm), m.end() + 1200)
            if start <= last_end:
                start = last_end + 1
            if start >= end:
                continue
            chunk = text_norm[start:end]
            windows.append(chunk)
            total += len(chunk)
            last_end = end
            if total >= max_scan:
                break

        if windows:
            text_norm = " ... ".join(windows)
        else:
            # Fallback: take a head/tail slice.
            head = text_norm[: max_scan // 2]
            tail = text_norm[-(max_scan // 2) :]
            text_norm = head + " ... " + tail

    # Role categories were previously used to filter certifications; this caused
    # false negatives (many legitimate cert-only resumes ended up NULL). We still
    # infer categories for potential future tuning, but do not hard-filter matches.
    _categories = _infer_role_categories(job_title, skills)

    # Ordered patterns; first match wins for canonical naming.
    patterns: list[tuple[str, str, set[str]]] = [
        # Cloud - AWS
        (r"(?i)\baws\s+certified\s+cloud\s+practitioner\b", "AWS Certified Cloud Practitioner", {"cloud"}),
        (r"(?i)\baws\s+cloud\s+practitioner\b", "AWS Certified Cloud Practitioner", {"cloud"}),
        (r"(?i)\baws\s+certified\s+solutions\s+architect\s*(?:-|\s)+\s*(associate|professional)\b", "AWS Certified Solutions Architect", {"cloud"}),
        (r"(?i)\baws\s+certified\s+solutions\s+architect\b", "AWS Certified Solutions Architect", {"cloud"}),
        (r"(?i)\baws\s+solutions\s+architect\s*(?:-|\s)+\s*(associate|professional)\b", "AWS Certified Solutions Architect", {"cloud"}),
        (r"(?i)\baws\s+certified\s+developer\s*(?:-|\s)+\s*associate\b", "AWS Certified Developer", {"cloud"}),
        (r"(?i)\baws\s+developer\s+associate\b", "AWS Certified Developer", {"cloud"}),
        (r"(?i)\baws\s+certified\s+sysops\s+administrator\s*(?:-|\s)+\s*associate\b", "AWS Certified SysOps Administrator", {"cloud", "devops"}),
        (r"(?i)\baws\s+sysops\s+administrator\s+associate\b", "AWS Certified SysOps Administrator", {"cloud", "devops"}),
        (r"(?i)\baws\s+certified\s+devops\s+engineer\s*(?:-|\s)+\s*professional\b", "AWS Certified DevOps Engineer", {"cloud", "devops"}),
        (r"(?i)\baws\s+devops\s+engineer\s+professional\b", "AWS Certified DevOps Engineer", {"cloud", "devops"}),
        (r"(?i)\baws\s+certified\s+security\s+specialty\b", "AWS Certified Security", {"cloud", "security"}),
        (r"(?i)\baws\s+certified\s+data\s+analytics\s+specialty\b", "AWS Certified Data Analytics", {"cloud", "data"}),
        (r"(?i)\baws\s+certified\s+machine\s+learning\s+specialty\b", "AWS Certified Machine Learning", {"cloud", "data"}),
        (r"(?i)\baws\s+certified\s+data\s+engineer\s*(?:-|\s)+\s*associate\b", "AWS Certified Data Engineer", {"cloud", "data"}),

        # Cloud - AWS (newer/alternate names)
        (r"(?i)\baws\s+certified\s+data\s+engineer\b", "AWS Certified Data Engineer", {"cloud", "data"}),
        (r"(?i)\baws\s+certified\s+data\s+analytics\b", "AWS Certified Data Analytics", {"cloud", "data"}),

        # AWS exam codes (require AWS/Certified/Exam context to avoid random code false positives)
        (
            r"(?i)(?:\baws\b|\bamazon\b|\baws\s+certified\b|\bexam\b|\bcertif(?:ied|ication)\b).{0,60}\bsaa-?c0?3\b|\bsaa-?c0?3\b.{0,60}(?:\baws\b|\bamazon\b|\bexam\b|\bcertif(?:ied|ication)\b)",
            "AWS Certified Solutions Architect",
            {"cloud"},
        ),
        (
            r"(?i)(?:\baws\b|\bamazon\b|\baws\s+certified\b|\bexam\b|\bcertif(?:ied|ication)\b).{0,60}\bsap-?c0?2\b|\bsap-?c0?2\b.{0,60}(?:\baws\b|\bamazon\b|\bexam\b|\bcertif(?:ied|ication)\b)",
            "AWS Certified Solutions Architect",
            {"cloud"},
        ),
        (
            r"(?i)(?:\baws\b|\bamazon\b|\baws\s+certified\b|\bexam\b|\bcertif(?:ied|ication)\b).{0,60}\bdva-?c0?2\b|\bdva-?c0?2\b.{0,60}(?:\baws\b|\bamazon\b|\bexam\b|\bcertif(?:ied|ication)\b)",
            "AWS Certified Developer",
            {"cloud"},
        ),
        (
            r"(?i)(?:\baws\b|\bamazon\b|\baws\s+certified\b|\bexam\b|\bcertif(?:ied|ication)\b).{0,60}\bsoa-?c0?2\b|\bsoa-?c0?2\b.{0,60}(?:\baws\b|\bamazon\b|\bexam\b|\bcertif(?:ied|ication)\b)",
            "AWS Certified SysOps Administrator",
            {"cloud", "devops"},
        ),
        (
            r"(?i)(?:\baws\b|\bamazon\b|\baws\s+certified\b|\bexam\b|\bcertif(?:ied|ication)\b).{0,60}\bdop-?c0?2\b|\bdop-?c0?2\b.{0,60}(?:\baws\b|\bamazon\b|\bexam\b|\bcertif(?:ied|ication)\b)",
            "AWS Certified DevOps Engineer",
            {"cloud", "devops"},
        ),
        (
            r"(?i)(?:\baws\b|\bamazon\b|\baws\s+certified\b|\bexam\b|\bcertif(?:ied|ication)\b).{0,60}\bdas-?c0?1\b|\bdas-?c0?1\b.{0,60}(?:\baws\b|\bamazon\b|\bexam\b|\bcertif(?:ied|ication)\b)",
            "AWS Certified Data Analytics",
            {"cloud", "data"},
        ),
        (
            r"(?i)(?:\baws\b|\bamazon\b|\baws\s+certified\b|\bexam\b|\bcertif(?:ied|ication)\b).{0,60}\bmls-?c0?1\b|\bmls-?c0?1\b.{0,60}(?:\baws\b|\bamazon\b|\bexam\b|\bcertif(?:ied|ication)\b)",
            "AWS Certified Machine Learning",
            {"cloud", "data"},
        ),

        # Cloud - Microsoft Azure
        # NOTE: Avoid matching tool/skill mentions like "Azure DevOps" as certifications.
        # For exam codes, require proximity to cert/exam wording.
        (r"(?i)\bmicrosoft\s+certified\s*:\s*azure\s+fundamentals\b", "Microsoft Certified: Azure Fundamentals", {"cloud"}),
        (r"(?i)(?:\b(certif(?:ied|ication)|exam)\b.{0,40}\baz-?900\b|\baz-?900\b.{0,40}\b(certif(?:ied|ication)|exam)\b)", "Microsoft Certified: Azure Fundamentals", {"cloud"}),
        (r"(?i)(?:\baz-?900\b.{0,40}\bazure\b|\bazure\b.{0,40}\baz-?900\b)", "Microsoft Certified: Azure Fundamentals", {"cloud"}),

        (r"(?i)\bmicrosoft\s+certified\s*:\s*azure\s+ai\s+fundamentals\b", "Microsoft Certified: Azure AI Fundamentals", {"cloud"}),
        (r"(?i)(?:\b(certif(?:ied|ication)|exam)\b.{0,40}\bai-?900\b|\bai-?900\b.{0,40}\b(certif(?:ied|ication)|exam)\b)", "Microsoft Certified: Azure AI Fundamentals", {"cloud"}),
        (r"(?i)(?:\bai-?900\b.{0,40}\bazure\b|\bazure\b.{0,40}\bai-?900\b)", "Microsoft Certified: Azure AI Fundamentals", {"cloud"}),

        (r"(?i)\bmicrosoft\s+certified\s*:\s*azure\s+data\s+fundamentals\b", "Microsoft Certified: Azure Data Fundamentals", {"cloud", "data"}),
        (r"(?i)(?:\b(certif(?:ied|ication)|exam)\b.{0,40}\bdp-?900\b|\bdp-?900\b.{0,40}\b(certif(?:ied|ication)|exam)\b)", "Microsoft Certified: Azure Data Fundamentals", {"cloud", "data"}),
        (r"(?i)(?:\bdp-?900\b.{0,40}\bazure\b|\bazure\b.{0,40}\bdp-?900\b)", "Microsoft Certified: Azure Data Fundamentals", {"cloud", "data"}),

        (r"(?i)\bmicrosoft\s+certified\s*:\s*(?:security,\s*compliance\s+and\s+identity\s+fundamentals|security\s+fundamentals)\b", "Microsoft Certified: Security, Compliance, and Identity Fundamentals", {"cloud", "security"}),
        (r"(?i)(?:\b(certif(?:ied|ication)|exam)\b.{0,40}\bsc-?900\b|\bsc-?900\b.{0,40}\b(certif(?:ied|ication)|exam)\b)", "Microsoft Certified: Security, Compliance, and Identity Fundamentals", {"cloud", "security"}),
        (r"(?i)(?:\bsc-?900\b.{0,40}\bazure\b|\bazure\b.{0,40}\bsc-?900\b)", "Microsoft Certified: Security, Compliance, and Identity Fundamentals", {"cloud", "security"}),

        (r"(?i)\bmicrosoft\s+certified\s*:\s*power\s+platform\s+fundamentals\b", "Microsoft Certified: Power Platform Fundamentals", {"cloud"}),
        (r"(?i)(?:\b(certif(?:ied|ication)|exam)\b.{0,40}\bpl-?900\b|\bpl-?900\b.{0,40}\b(certif(?:ied|ication)|exam)\b)", "Microsoft Certified: Power Platform Fundamentals", {"cloud"}),
        (r"(?i)(?:\bpl-?900\b.{0,40}\bazure\b|\bazure\b.{0,40}\bpl-?900\b)", "Microsoft Certified: Power Platform Fundamentals", {"cloud"}),

        (r"(?i)\bmicrosoft\s+certified\s*:\s*(?:azure\s+administrator|azure\s+administrator\s+associate)\b", "Microsoft Certified: Azure Administrator", {"cloud"}),
        (r"(?i)(?:\b(certif(?:ied|ication)|exam)\b.{0,40}\baz-?104\b|\baz-?104\b.{0,40}\b(certif(?:ied|ication)|exam)\b)", "Microsoft Certified: Azure Administrator", {"cloud"}),
        (r"(?i)(?:\baz-?104\b.{0,40}\bazure\b|\bazure\b.{0,40}\baz-?104\b)", "Microsoft Certified: Azure Administrator", {"cloud"}),

        (r"(?i)\bmicrosoft\s+certified\s*:\s*(?:azure\s+developer|azure\s+developer\s+associate)\b", "Microsoft Certified: Azure Developer", {"cloud"}),
        (r"(?i)(?:\b(certif(?:ied|ication)|exam)\b.{0,40}\baz-?204\b|\baz-?204\b.{0,40}\b(certif(?:ied|ication)|exam)\b)", "Microsoft Certified: Azure Developer", {"cloud"}),
        (r"(?i)(?:\baz-?204\b.{0,40}\bazure\b|\bazure\b.{0,40}\baz-?204\b)", "Microsoft Certified: Azure Developer", {"cloud"}),

        (r"(?i)\bmicrosoft\s+certified\s*:\s*(?:azure\s+solutions\s+architect|azure\s+solutions\s+architect\s+expert)\b", "Microsoft Certified: Azure Solutions Architect", {"cloud"}),
        (r"(?i)(?:\b(certif(?:ied|ication)|exam)\b.{0,40}\baz-?305\b|\baz-?305\b.{0,40}\b(certif(?:ied|ication)|exam)\b)", "Microsoft Certified: Azure Solutions Architect", {"cloud"}),
        (r"(?i)(?:\baz-?305\b.{0,40}\bazure\b|\bazure\b.{0,40}\baz-?305\b)", "Microsoft Certified: Azure Solutions Architect", {"cloud"}),

        (r"(?i)\bmicrosoft\s+certified\s*:\s*devops\s+engineer\b", "Microsoft Certified: DevOps Engineer", {"cloud", "devops"}),
        (r"(?i)(?:\b(certif(?:ied|ication)|exam)\b.{0,40}\baz-?400\b|\baz-?400\b.{0,40}\b(certif(?:ied|ication)|exam)\b)", "Microsoft Certified: DevOps Engineer", {"cloud", "devops"}),
        (r"(?i)(?:\baz-?400\b.{0,40}\bazure\b|\bazure\b.{0,40}\baz-?400\b)", "Microsoft Certified: DevOps Engineer", {"cloud", "devops"}),

        (r"(?i)\bmicrosoft\s+certified\s*:\s*azure\s+security\s+engineer\b", "Microsoft Certified: Azure Security Engineer", {"cloud", "security"}),
        (r"(?i)(?:\b(certif(?:ied|ication)|exam)\b.{0,40}\baz-?500\b|\baz-?500\b.{0,40}\b(certif(?:ied|ication)|exam)\b)", "Microsoft Certified: Azure Security Engineer", {"cloud", "security"}),
        (r"(?i)(?:\baz-?500\b.{0,40}\bazure\b|\bazure\b.{0,40}\baz-?500\b)", "Microsoft Certified: Azure Security Engineer", {"cloud", "security"}),

        (r"(?i)\bmicrosoft\s+certified\s*:\s*azure\s+data\s+engineer\b", "Microsoft Certified: Azure Data Engineer", {"cloud", "data"}),
        (r"(?i)(?:\b(certif(?:ied|ication)|exam)\b.{0,40}\bdp-?203\b|\bdp-?203\b.{0,40}\b(certif(?:ied|ication)|exam)\b)", "Microsoft Certified: Azure Data Engineer", {"cloud", "data"}),
        (r"(?i)(?:\bdp-?203\b.{0,40}\bazure\b|\bazure\b.{0,40}\bdp-?203\b)", "Microsoft Certified: Azure Data Engineer", {"cloud", "data"}),

        # Azure - additional common exams
        (r"(?i)(?:\b(certif(?:ied|ication)|exam)\b.{0,40}\baz-?700\b|\baz-?700\b.{0,40}\b(certif(?:ied|ication)|exam)\b)", "Microsoft Certified: Azure Network Engineer", {"cloud", "network"}),
        (r"(?i)(?:\b(certif(?:ied|ication)|exam)\b.{0,40}\bdp-?300\b|\bdp-?300\b.{0,40}\b(certif(?:ied|ication)|exam)\b)", "Microsoft Certified: Azure Database Administrator", {"cloud", "data"}),
        (r"(?i)(?:\b(certif(?:ied|ication)|exam)\b.{0,40}\bpl-?200\b|\bpl-?200\b.{0,40}\b(certif(?:ied|ication)|exam)\b)", "Microsoft Certified: Power Platform Functional Consultant", {"cloud"}),

        # Cloud - Google
        (r"(?i)\bgoogle\s+cloud\s+certified\s+associate\s+cloud\s+engineer\b", "Google Cloud Certified: Associate Cloud Engineer", {"cloud"}),
        (r"(?i)\bgoogle\s+cloud\s+certified\s+professional\s+cloud\s+architect\b", "Google Cloud Certified: Professional Cloud Architect", {"cloud"}),
        (r"(?i)\bgoogle\s+cloud\s+certified\s+professional\s+data\s+engineer\b", "Google Cloud Certified: Professional Data Engineer", {"cloud", "data"}),
        (r"(?i)\bgoogle\s+cloud\s+certified\s+professional\s+machine\s+learning\s+engineer\b", "Google Cloud Certified: Professional ML Engineer", {"cloud", "data"}),

        # DevOps / containers / IaC
        (r"(?i)\bcertified\s+kubernetes\s+administrator\b|\bcka\b(?=[^\n]{0,120}\bkubernetes\b)", "Certified Kubernetes Administrator (CKA)", {"devops"}),
        (r"(?i)\bcertified\s+kubernetes\s+application\s+developer\b|\bckad\b(?=[^\n]{0,120}\bkubernetes\b)", "Certified Kubernetes Application Developer (CKAD)", {"devops"}),
        (r"(?i)\bcertified\s+kubernetes\s+security\s+specialist\b|\bcks\b(?=[^\n]{0,120}\bkubernetes\b)", "Certified Kubernetes Security Specialist (CKS)", {"devops", "security"}),
        (r"(?i)\bterraform\s+associate\b|\bhashicorp\s+certified\s+terraform\b", "HashiCorp Certified: Terraform Associate", {"devops"}),

        # Red Hat
        (r"(?i)\brhcsa\b|\bred\s*hat\s+certified\s+system\s+administrator\b", "RHCSA", {"devops"}),
        (r"(?i)\brhce\b|\bred\s*hat\s+certified\s+engineer\b", "RHCE", {"devops"}),

        # Security
        (r"(?i)\bcissp\b", "CISSP", {"security"}),
        (r"(?i)\bcisa\b", "CISA", {"security"}),
        (r"(?i)\bcism\b", "CISM", {"security"}),
        (r"(?i)\bceh\b|\bcertified\s+ethical\s+hacker\b", "CEH", {"security"}),
        (r"(?i)\bsecurity\+\b|\bcomptia\s+security\+\b", "CompTIA Security+", {"security"}),
        (r"(?i)\bnetwork\+\b|\bcomptia\s+network\+\b", "CompTIA Network+", {"network"}),
        (r"(?i)\ba\+\b|\bcomptia\s+a\+\b", "CompTIA A+", {"network"}),
        (r"(?i)\blinux\+\b|\bcomptia\s+linux\+\b", "CompTIA Linux+", {"security"}),
        (r"(?i)\bcybersecurity\s+analyst\+\b|\bcysa\+\b|\bcomptia\s+cysa\+\b", "CompTIA CySA+", {"security"}),
        (r"(?i)\bpentest\+\b|\bcomptia\s+pentest\+\b", "CompTIA PenTest+", {"security"}),
        (r"(?i)\bcas\+\b|\bcasp\+\b|\bcomptia\s+casp\+\b", "CompTIA CASP+", {"security"}),

        # Offensive Security
        (r"(?i)\boscp\b|\boffensive\s+security\s+certified\s+professional\b", "OSCP", {"security"}),

        # Networking
        (r"(?i)\bccna\b", "CCNA", {"network"}),
        (r"(?i)\bccnp\b", "CCNP", {"network"}),

        # Project / Agile
        (r"(?i)\bpmp\b|\bproject\s+management\s+professional\b", "PMP", {"pm"}),
        (r"(?i)\bcapm\b", "CAPM", {"pm"}),
        (r"(?i)\bcsm\b|\bcertified\s+scrum\s+master\b", "CSM", {"pm"}),
        (r"(?i)\bcspo\b|\bcertified\s+scrum\s+product\s+owner\b", "CSPO", {"pm"}),
        (r"(?i)\bpsm\s*(?:i|ii|iii)?\b|\bprofessional\s+scrum\s+master\b", "PSM", {"pm"}),
        (r"(?i)\bpspo\s*(?:i|ii)?\b|\bprofessional\s+scrum\s+product\s+owner\b", "PSPO", {"pm"}),
        (r"(?i)\bsafe\s+agilist\b|\bsa\b(?=[^\n]{0,80}\bsafe\b)", "SAFe Agilist", {"pm"}),
        (r"(?i)\bsafe\s+scrum\s+master\b|\bssm\b(?=[^\n]{0,80}\bsafe\b)", "SAFe Scrum Master", {"pm"}),
        (r"(?i)\bitil\b(?:\s+foundation)?\b", "ITIL", {"pm"}),

        # QA
        (r"(?i)\bistqb\b|\binternational\s+software\s+testing\s+qualifications\s+board\b", "ISTQB", {"pm"}),

        # Data platforms
        (r"(?i)\bdatabricks\s+certified\s+data\s+engineer\b", "Databricks Certified Data Engineer", {"data"}),
        (r"(?i)\bsnowpro\b|\bsnowflake\s+snowpro\b", "SnowPro", {"data"}),
        (r"(?i)\btableau\s+(?:desktop\s+specialist|certified)\b", "Tableau Certification", {"data"}),
    ]

    # Compile patterns once per process. Recompiling 100s of patterns for every resume
    # is surprisingly expensive and can look like a hang during DB backfills.
    if not _compiled_patterns_cache:
        _compiled_patterns_cache.extend(
            [(re.compile(pat), canonical, cat) for (pat, canonical, cat) in patterns]
        )

    found: list[str] = []
    for rx, canonical, cat in _compiled_patterns_cache:
        if rx.search(text_norm):
            found.append(canonical)

    # Dedupe preserving order
    out: list[str] = []
    seen: set[str] = set()
    for c in found:
        k = c.casefold()
        if k in seen:
            continue
        seen.add(k)
        out.append(c)

    return "; ".join(out[:8]) if out else None


def extract_job_title(text: str, *, first_name: str = "", last_name: str = "") -> str:
    def is_cert_or_exam_line(s: str) -> bool:
        sl = (s or "").casefold()
        if not sl:
            return False
        if "certified" in sl or "certification" in sl or "certificate" in sl or "exam" in sl:
            return True
        # Common certification exam codes (Azure/AWS etc). If present, treat as cert context.
        if re.search(r"\b(?:az|dp|ai|sc|pl|mb)-?\d{3}\b", sl):
            return True
        if re.search(r"\baws\s+certified\b", sl):
            return True
        if re.search(r"\bmicrosoft\s+certified\b", sl):
            return True
        return False

    def finalize_title(title: str) -> str:
        t = (title or "")
        t = t.replace("â€”", "—").replace("â€“", "–").replace("â€\u0094", "—")
        t = re.sub(r"\s+", " ", t).strip(" -–—:•")

        # Strip leading non-title symbols (e.g., checkmarks/bullets from PDF extraction).
        t = re.sub(r"^[^A-Za-z0-9.]+", "", t).strip()

        # Reject if it looks like a parenthetical fragment (e.g. "Services) and Backend (oracle")
        if t.count(")") > t.count("(") or t.count("(") > t.count(")") + 1:
            return ""
        # Also reject reverse-ordered parens: ")" appears before "(" (garbled fragment)
        idx_close = t.find(")")
        idx_open = t.find("(")
        if idx_close != -1 and (idx_open == -1 or idx_close < idx_open):
            return ""

        # Many resumes embed roles like: "JUL 21– Current Role- Principal Software Engineer".
        # Prefer the explicit "Role- <title>" segment before trimming date ranges.
        m_role = re.search(r"(?i)\brole\b\s*[-:—–]\s*(.{3,120})$", t)
        if m_role:
            t = m_role.group(1).strip()

        # Remove embedded phone numbers (common corruption: "Java Developer 469-279-8670")
        t = re.sub(r"\b\+?\d[\d ()\-]{8,}\d\b", " ", t)
        t = re.sub(r"\s+", " ", t).strip(" -–—:•")

        # Strip trailing numeric junk from header/link fragments.
        # Example: "DATA SCIENTIST 31524" or "DATA SCIENTIST 31524/".
        t = re.sub(r"\b\d{4,}\b\W*$", "", t).strip(" -–—:•/|")

        # Remove trailing date ranges / tenure markers often appended to titles.
        # Examples: "Dec 2022 – Till Date", "01/2020-Present", "Jun '24 — Present"
        t = re.sub(
            r"(?i)\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\s*'?\d{2,4}.*$",
            "",
            t,
        ).strip()
        t = re.sub(r"(?i)\b\d{1,2}/\d{4}.*$", "", t).strip()
        t = re.sub(r"(?i)\b(?:present|till\s+date|current)\b.*$", "", t).strip()

        # Drop skill-tail after dash when it looks like a tech stack, not a role.
        m_dash = re.split(r"\s+[–—-]\s+", t, maxsplit=1)
        if len(m_dash) == 2:
            left, right = m_dash[0].strip(), m_dash[1].strip()
            right_l = right.casefold()
            if any(k in right_l for k in ["angular", "react", "node", "node js", "javascript", "typescript", "aws", "azure", "gcp", "python", "java", ".net", "sql"]):
                t = left

        # Normalize punctuation artifacts
        t = re.sub(r"[._]{2,}", " ", t)
        # Replace stray dots with spaces — but protect ".NET"
        t = re.sub(r"(?i)\.NET\b", "ZDOTNET_PLACEHOLDER", t)
        t = t.replace(".", " ")
        t = t.replace("ZDOTNET_PLACEHOLDER", ".NET")
        t = re.sub(r"\s+", " ", t).strip()

        # Normalize .NET variants
        if re.fullmatch(r"(?i)net\s+developer", t):
            t = ".NET Developer"
        # Normalize "Dot Net" / "DotNet" → ".NET" in-place
        t = re.sub(r"(?i)\bdot\s*net\b", ".NET", t)
        t = re.sub(r"(?i)\bdotnet\b", ".NET", t)
        # Bare "Net" before role words → ".NET"
        t = re.sub(r"(?i)(?<!\.)Net\b(?=\s+(?:Full Stack|Developer|Engineer|Architect))", ".NET", t)
        return t

    def shrink_to_role_phrase(title: str) -> str:
        """Reduce long/noisy title lines to a cleaner role phrase.

        Examples:
        - "Components, And Services Java Developer With Groovy" -> "Java Developer"
        """

        t = normalize_text(title or "")
        t = re.sub(r"\s+", " ", t).strip()
        if not t:
            return ""

        role_words_single = {
            "developer",
            "engineer",
            "analyst",
            "architect",
            "consultant",
            "tester",
            "administrator",
            "specialist",
            "manager",
            "designer",
            "programmer",
            "director",
            "scientist",
            "lead",
            "coordinator",
            "master",
            "owner",
        }
        tech_prefix = {
            "java",
            "python",
            ".net",
            "net",
            "angular",
            "react",
            "node",
            "nodejs",
            "backend",
            "frontend",
            "full",
            "data",
            "aws",
            "azure",
            "cloud",
            "devops",
            "big",
            "machine",
            "learning",
            "ai",
            "ml",
            "etl",
            "bi",
            "qa",
            "software",
            "web",
            "mobile",
            "ios",
            "android",
            "platform",
            "site",
            "reliability",
            "solutions",
            "technical",
            "system",
            "systems",
            "stack",
            "senior",
            "principal",
            "staff",
        }

        specific_prefix = {
            "java",
            "python",
            ".net",
            "net",
            "angular",
            "react",
            "node",
            "nodejs",
            "aws",
            "azure",
        }

        # Tokenize, preserving .NET-ish tokens.
        raw_tokens = [x for x in re.split(r"\s+", t) if x]
        tokens = [re.sub(r"[^A-Za-z0-9.+#]", "", x) for x in raw_tokens]
        tokens = [x for x in tokens if x]

        # Find the last role word position.
        role_pos = None
        for i in range(len(tokens) - 1, -1, -1):
            if tokens[i].casefold() in role_words_single:
                role_pos = i
                break
        if role_pos is None:
            return t

        # Prefer "<Tech> <Role>" (Java Developer) when possible.
        candidates: list[tuple[int, int]] = []  # (score, j)
        for back in range(1, 5):
            j = role_pos - back
            if j < 0:
                break
            tj = tokens[j].casefold()
            tj2 = tj.replace(".", "")
            if tj in tech_prefix or tj2 in tech_prefix:
                score = 2 if (tj in specific_prefix or tj2 in specific_prefix) else 1
                candidates.append((score, j))

        if candidates:
            # Prefer more specific tokens, then longer phrases (earlier j).
            best_score = max(s for s, _j in candidates)
            best_js = [j for s, j in candidates if s == best_score]
            j = min(best_js)
            return " ".join(tokens[j : role_pos + 1])

        # Otherwise, keep a short window ending at the role word.
        start = max(0, role_pos - 3)
        return " ".join(tokens[start : role_pos + 1])

    def pick_best_role_segment(line: str) -> str:
        # Post-process a chosen line to prefer the segment that actually looks like a role.
        parts = [p.strip() for p in re.split(r"[|•·]", line) if p.strip()]
        col_parts = [p.strip() for p in re.split(r"\s{3,}", line) if p.strip()]
        if len(col_parts) >= 2:
            parts = col_parts

        # Also consider prefixes before a comma (often "Role, Employer").
        expanded: list[str] = []
        for p in parts:
            expanded.append(p)
            if "," in p:
                prefix = p.split(",", 1)[0].strip()
                if prefix:
                    expanded.append(prefix)
        parts = expanded

        def seg_score(p: str) -> int:
            pl = p.casefold()
            s = 0
            if has_role_signal(pl):
                s += 50
            if is_cert_or_exam_line(pl):
                s -= 80
            if p.count(",") >= 1:
                s -= 8
            if any(x in pl for x in ["@", "http", "www."]):
                s -= 80
            # Prefer shorter, title-like segments.
            words = [w for w in re.split(r"\s+", p.strip()) if w]
            if len(words) > 10:
                s -= (len(words) - 10) * 3
            return s

        if parts:
            best = max(parts, key=seg_score)
            return best
        return line

    # Quick role signal used for strict matching in explicit patterns (objective/role labels).
    # The more detailed scoring logic later can still recover titles when this is too strict.
    quick_role_re = re.compile(
        r"(?i)\b("
        r"developer|engineer|analyst|architect|consultant|tester|administrator|specialist|devops|sre|manager|intern|"
        r"sde|sdet|programmer|designer|director|scientist|lead|coordinator|scrum\s*master|product\s*owner"
        r")\b|\b(data\s+engineer|data\s+scientist|full\s*stack|front\s*end|back\s*end|backend|frontend|"
        r"machine\s+learning|cloud\s+engineer|platform\s+engineer|site\s+reliability|solutions?\s+architect|"
        r"technical\s+lead|team\s+lead|tech\s+lead|ai\s+engineer|ml\s+engineer)\b"
        r"|\b(etl\s+(?:developer|engineer|analyst))\b"
    )

    patterns = [
        # Require an explicit label delimiter at the start of a line.
        # Avoid matching sentences like "Looking for an engineering role...".
        r"(?im)^(?:position|job\s*title|role)\b\s*:\s*(.{3,120})$",
        r"(?im)^(?:position|job\s*title|role)\b\s+[-–—]\s+(.{3,120})$",
        r"(?im)^(?:applied\s+for|applying\s+for|application\s+for)\b\s*[:\-]\s*(.{3,120})$",
        # Target role stated in an objective/summary.
        r"(?im)^objective\b\s*[:\-]\s*(?:seeking|looking\s+for)\b\s*(?:an?\s+)?(.{3,160})$",
        r"(?im)^(?:objective|profile|summary)\b.*\b(?:seeking|looking\s+for)\b.*\b(?:as|for)\b\s*(.{3,160})$",
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            title = m.group(m.lastindex or 1).strip()
            title = re.sub(r"\s+", " ", title)
            title = re.split(r"[\n\r\t|•]", title)[0].strip(" -:")
            title = finalize_title(title)
            title = shrink_to_role_phrase(title)
            title = finalize_title(title)
            if 3 <= len(title) <= 80 and quick_role_re.search(title):
                return canonicalize_job_title(title)

    role_words = [
        "developer",
        "engineer",
        "analyst",
        "architect",
        "consultant",
        "tester",
        "qa",
        "administrator",
        "specialist",
        "devops",
        "sre",
        "data scientist",
        "data engineer",
        "full stack",
        "frontend",
        "front end",
        "backend",
        "back end",
        "product manager",
        "project manager",
        "program manager",
        "business analyst",
        "sde",
        "sdet",
        "etl developer",
        "etl engineer",
        "etl analyst",
        "programmer",
        "designer",
        "director",
        "scientist",
        "lead",
        "coordinator",
        "scrum master",
        "product owner",
        "cloud engineer",
        "platform engineer",
        "site reliability",
        "solutions architect",
        "solution architect",
        "technical lead",
        "team lead",
        "tech lead",
        "ai engineer",
        "ml engineer",
        "machine learning",
        "big data engineer",
        "bi developer",
    ]

    # Word-boundary role detection (avoids substring accidents like matching "architect" inside "architecture" when it's just a skill).
    role_re = re.compile(
        r"(?i)\b("
        r"developer|engineer|analyst|architect|consultant|tester|administrator|specialist|devops|sre|manager|intern|"
        r"sde|sdet|programmer|designer|director|scientist|lead|coordinator|scrum\s*master|product\s*owner"
        r")\b|\b(data\s+engineer|data\s+scientist|full\s*stack|front\s*end|back\s*end|backend|frontend|"
        r"machine\s+learning|cloud\s+engineer|platform\s+engineer|site\s+reliability|solutions?\s+architect|"
        r"technical\s+lead|team\s+lead|tech\s+lead|ai\s+engineer|ml\s+engineer)\b"
        r"|\b(etl\s+(?:developer|engineer|analyst))\b"
    )

    def has_role_signal(s: str) -> bool:
        return bool(role_re.search(s))

    # If the resume doesn't have a clean standalone title line, it often still
    # states the role in a sentence near the top (e.g., "experience as a Data Engineer").
    as_role_re = re.compile(
        r"(?i)\b(?:experience\s+as\s+an?|worked\s+as\s+an?|working\s+as\s+an?|"
        r"experience\s+in|experience\s+as|"  # also match "experience in Data Engineer"
        r"as\s+an?|as\s+a)\s+"
        r"(?:(senior|lead|principal|staff|junior)\s+)?"
        r"(data\s+engineer|data\s+scientist|software\s+engineer|software\s+developer|java\s+developer|"
        r"python\s+developer|full\s*stack\s+developer|full\s*stack\s+engineer|"
        r"devops\s+engineer|cloud\s+engineer|\\.?net\s+developer|\\.?net\s+full\s*stack\s+developer|"
        r"front\s*end\s+developer|back\s*end\s+developer|react\s+developer|angular\s+developer|"
        r"machine\s+learning\s+engineer|ai\s+engineer|ml\s+engineer|"
        r"business\s+analyst|data\s+analyst|qa\s+engineer|qa\s+analyst|"
        r"solutions?\s+architect|technical\s+architect|systems?\s+architect|"
        r"big\s+data\s+engineer|etl\s+developer|bi\s+developer|"
        r"java\s+full\s*stack\s+developer|java\s+backend\s+developer|"
        r"tester|sre|scrum\s*master|product\s+manager|project\s+manager)\b"
    )
    for ln in non_empty_lines(text)[:40]:
        if is_cert_or_exam_line(ln):
            continue
        m = as_role_re.search(ln)
        if not m:
            continue
        prefix = (m.group(1) or "").strip()
        role = (m.group(2) or "").strip()
        guessed = f"{prefix} {role}".strip()
        guessed = finalize_title(guessed)
        guessed = shrink_to_role_phrase(guessed)
        guessed = finalize_title(guessed)
        if 3 <= len(guessed) <= 70 and has_role_signal(guessed.casefold()):
            return canonicalize_job_title(guessed)

    # ── NEW STRATEGY: "Seeking / Looking for a <Role>" ──────────────────────
    # Handles resumes where the objective says e.g.
    #   "Seeking a Full Stack Developer role where I can …"
    #   "Looking for a Senior Java Developer position"
    _seeking_role_re = re.compile(
        r"(?i)\b(?:seeking|looking\s+for|aspiring\s+to\s+(?:be(?:come)?|work\s+as))\s+"
        r"(?:a\s+|an\s+)?"
        r"(?:(?:position|role|opportunity|career)\s+(?:as|in|of)\s+(?:a\s+|an\s+)?)?"
        r"((?:(?:senior|lead|principal|staff|junior|associate)\s+)?"
        r"(?:\w[\w.#+]*\s+){0,4}"
        r"(?:developer|engineer|analyst|architect|consultant|specialist|"
        r"manager|designer|director|scientist|coordinator|tester|"
        r"programmer|administrator|devops\s+engineer|sre|scrum\s*master|product\s*owner))"
        r"\b"
    )
    for ln in non_empty_lines(text)[:40]:
        if is_cert_or_exam_line(ln):
            continue
        m_seek = _seeking_role_re.search(ln)
        if not m_seek:
            continue
        guessed = m_seek.group(1).strip()
        guessed = finalize_title(guessed)
        guessed = shrink_to_role_phrase(guessed)
        guessed = finalize_title(guessed)
        if 3 <= len(guessed) <= 70 and has_role_signal(guessed.casefold()):
            return canonicalize_job_title(guessed)

    # ── NEW STRATEGY: Objective / Summary section body ──────────────────────
    # When "OBJECTIVE" or "SUMMARY" is a standalone header, scan the next few
    # body lines for a leading role phrase like "Senior Developer with 6 yrs…"
    # or an "Experienced <Role>" / "Results-driven <Role>" pattern.
    _obj_header_re = re.compile(
        r"(?i)^(?:objective|professional\s+summary|summary|profile|"
        r"career\s+(?:objective|summary|profile))\s*:?\s*$"
    )
    _leading_role_re = re.compile(
        r"(?i)^(?:(?:an?\s+)?(?:results?[\s-]*driven|detail[\s-]*oriented|highly[\s-]*(?:skilled|motivated|experienced)|"
        r"experienced|accomplished|dedicated|passionate|versatile|dynamic|proactive|innovative|motivated)\s+)?"
        r"((?:(?:senior|lead|principal|staff|junior|associate)\s+)?"
        r"(?:\w[\w.#+]*\s+){0,3}"
        r"(?:developer|engineer|analyst|architect|consultant|specialist|"
        r"manager|designer|director|scientist|coordinator|tester|"
        r"programmer|administrator|devops|sre))"
        r"\s+(?:with|having|who|–|—|-|,|\()"
    )
    _nel = non_empty_lines(text)
    for idx, ln in enumerate(_nel[:20]):
        if not _obj_header_re.match(ln.strip()):
            continue
        # Found objective/summary header – scan next 5 body lines
        for body_ln in _nel[idx + 1 : idx + 6]:
            body_ln = body_ln.strip()
            if not body_ln:
                continue
            # Stop if we hit another section header
            if _obj_header_re.match(body_ln) or re.match(
                r"(?i)^(?:education|skills|experience|certification|projects?)\s*:?\s*$",
                body_ln,
            ):
                break
            m_lead = _leading_role_re.search(body_ln)
            if m_lead:
                guessed = m_lead.group(1).strip()
                guessed = finalize_title(guessed)
                guessed = shrink_to_role_phrase(guessed)
                guessed = finalize_title(guessed)
                if 3 <= len(guessed) <= 70 and has_role_signal(guessed.casefold()):
                    return canonicalize_job_title(guessed)
        break  # only process first matching section header

    def is_plausible_job_title(s: str) -> bool:
        s = re.sub(r"\s+", " ", (s or "").strip())
        if not s:
            return False
        sl = s.casefold()
        if is_cert_or_exam_line(sl):
            return False
        if not has_role_signal(sl):
            return False
        if any(x in sl for x in ["@", "http", "www."]):
            return False
        # Reject unbalanced parenthetical fragments (garbage extraction)
        if s.count(")") != s.count("("):
            return False
        # Reject fragments starting with a closing paren or conjunction
        if sl.startswith((")", "and ", "or ", "the ", "a ", "an ")):
            return False

        # Reject sentence-like fragments that often get mis-selected as a "title".
        if any(x in sl for x in [" using ", " leveraging ", " utilized ", " responsible ", " developing ", " deploying ", " implementing "]):
            return False
        if sl.startswith((
            "worked on ",
            "working on ",
            "experience in ",
            "experienced in ",
            # Blocks sentences like "Experience Frontend Within Framework Like Angular"
            # that start with "experience" followed by a tech/framework word.
            "experience ",
            "experienced ",
            "hands on ",
            "hands-on ",
        )):
            return False

        # Avoid selecting skill/stack sentences as a title.
        if s.count(",") >= 2 or s.count(";") >= 1:
            return False
        if looks_like_skills_line(s):
            return False
        if sl.startswith(("based ", "using ", "built ", "developed ", "implemented ", "responsible ")):
            return False
        if any(x in sl for x in [" utilized ", " leveraging ", " responsible ", " implemented ", " developed ", " built "]):
            return False

        # Avoid long responsibility-like sentences.
        words = [w for w in re.split(r"\s+", sl) if w]
        if len(words) >= 10 and any(v in sl for v in [" using ", " utilized ", " leveraging ", " responsible ", " implemented ", " developed ", " built ", " transforming ", " processing "]):
            return False

        return True

    fn = (first_name or "").strip().lower()
    ln_name = (last_name or "").strip().lower()

    def strip_leading_candidate_name(s: str) -> str:
        """Strip candidate-name prefixes like 'First Middle Last <Role>'."""
        if not s:
            return s

        # Tokens that look Title-Case but are actually job title keywords — never strip these as "names".
        _NOT_NAME_TOKENS = {
            "senior", "junior", "lead", "principal", "staff", "associate",
            "net", "dot", "java", "python", "angular", "react", "node",
            "full", "stack", "frontend", "backend", "data", "cloud", "devops",
            "software", "web", "mobile", "big", "machine", "azure", "aws",
            "developer", "engineer", "analyst", "architect", "consultant",
            "tester", "specialist", "manager", "designer", "director",
            "scientist", "programmer", "coordinator", "administrator",
        }

        # If we don't know the extracted name, still try a heuristic strip for
        # lines like: "Satya Veni Chelluboina Java Full Stack Developer".
        if not fn or not ln_name:
            toks = [t for t in re.split(r"\s+", s.strip()) if t]
            if len(toks) >= 4:
                # If first 2-4 tokens look like a Title-Case name, drop them
                # if the remainder still looks like a job title.
                def is_name_tok(tok: str) -> bool:
                    if tok.casefold() in _NOT_NAME_TOKENS:
                        return False
                    return tok[:1].isupper() and tok[1:].islower() and tok.isalpha()

                for cut in (3, 2, 4):
                    if len(toks) > cut and all(is_name_tok(x) for x in toks[:cut]):
                        remainder = " ".join(toks[cut:]).strip()
                        rem2 = finalize_title(remainder)
                        rem2 = shrink_to_role_phrase(rem2)
                        if 3 <= len(rem2) <= 70 and has_role_signal(rem2.casefold()):
                            return remainder
            return s

        # Tokenize and find last-name occurrence very early in the string.
        toks = [t for t in re.split(r"\s+", s.strip()) if t]
        if not toks:
            return s

        def norm_tok(t: str) -> str:
            return re.sub(r"[^a-z]", "", t.casefold())

        toks_n = [norm_tok(t) for t in toks]
        if not toks_n or toks_n[0] != re.sub(r"[^a-z]", "", fn):
            return s

        for i in range(1, min(len(toks_n), 6)):
            if toks_n[i] == re.sub(r"[^a-z]", "", ln_name):
                remainder = " ".join(toks[i + 1 :]).strip()
                return remainder if remainder else s
        return s

    lines = [_segment_compact_line(ln) for ln in non_empty_lines(text)]

    def strip_contact_and_urls(s: str) -> str:
        t = (s or "")
        # Remove URLs/emails/phones so header lines like "DATA SCIENTIST https://..." are usable.
        t = re.sub(r"(?i)https?://\S+", " ", t)
        t = re.sub(r"(?i)www\.\S+", " ", t)
        t = re.sub(r"(?i)\b\S+@\S+\b", " ", t)
        t = re.sub(r"\b\+?\d[\d ()\-]{8,}\d\b", " ", t)
        t = re.sub(r"\s+", " ", t).strip()
        return t

    def header_variants(ln: str) -> list[str]:
        # Try splitting header lines into plausible role chunks.
        out: list[str] = []
        parts = [p.strip() for p in re.split(r"[|•·]", ln) if p.strip()]
        col_parts = [p.strip() for p in re.split(r"\s{3,}", ln) if p.strip()]
        if len(col_parts) >= 2:
            parts = col_parts
        if parts:
            out.extend(parts)
        out.append(ln)
        # Dedupe preserve order
        seen: set[str] = set()
        uniq: list[str] = []
        for x in out:
            k = x.casefold()
            if k in seen:
                continue
            seen.add(k)
            uniq.append(x)
        return uniq

    # Prefer the earliest clean title-looking line in the header.
    # First-page / header blocks can be 20-25 non-empty lines tall, so scan[:25].
    for idx, ln in enumerate(lines[:25]):
        for raw in header_variants(ln):
            compact = re.sub(r"\s+", " ", raw).strip()
            if not (4 <= len(compact) <= 70):
                continue
            lnl = compact.casefold()

            # If header line includes URLs/emails, strip them and retry.
            if any(x in lnl for x in ["@", "http", "www."]):
                compact2 = strip_contact_and_urls(compact)
                if compact2 and compact2 != compact:
                    compact = compact2
                    lnl = compact.casefold()
                else:
                    continue
            if any(x in lnl for x in ["summary", "objective", "profile", "skills", "experience", "education", "certification"]):
                continue
            # Avoid labeled/list lines.
            if any(ch in compact for ch in [":", "•"]):
                continue
            if is_cert_or_exam_line(compact):
                continue
            cand = strip_leading_candidate_name(compact)
            cand = finalize_title(cand)
            cand = pick_best_role_segment(cand)
            cand = shrink_to_role_phrase(cand)
            cand = finalize_title(cand)
            if 3 <= len(cand) <= 70 and has_role_signal(cand.casefold()):
                # Strip candidate name prefixes like "Harish .Net Developer"
                if fn and cand.lower().startswith(fn + " "):
                    cand = cand[len(fn) + 1 :].strip()
                if ln_name and cand.lower().startswith(ln_name + " "):
                    cand = cand[len(ln_name) + 1 :].strip()
                cand = finalize_title(cand)
                cand = shrink_to_role_phrase(cand)
                cand = finalize_title(cand)
                if 3 <= len(cand) <= 70 and has_role_signal(cand.casefold()):
                    return canonicalize_job_title(cand)

    skills_master = _skills_master_set()

    education_markers = [
        "bachelor",
        "master",
        "b.tech",
        "btech",
        "m.tech",
        "mtech",
        "b.sc",
        "bs ",
        "m.sc",
        "ms ",
        "phd",
        "degree",
        "university",
        "college",
    ]

    def looks_like_name_line(line: str) -> bool:
        # Only treat a line as a "name" candidate when it does NOT look like a role/title.
        l = line.casefold()
        if has_role_signal(l):
            return False

        cleaned = re.sub(r"[^A-Za-z\s]", " ", line).strip()
        if not cleaned:
            return False

        toks = [t for t in cleaned.split() if t]
        if not (2 <= len(toks) <= 4):
            return False
        if any(len(t) <= 1 for t in toks):
            return False
        if not all(t[0].isupper() for t in toks if t):
            return False

        # If it matches extracted name, it's very likely a header-name line.
        if fn and ln_name and re.search(rf"\b{re.escape(fn)}\b", l) and re.search(rf"\b{re.escape(ln_name)}\b", l):
            return True

        # Otherwise: treat generic 2-4 Title-Case tokens as a likely name header.
        return True

    def looks_like_skills_line(line: str) -> bool:
        # If a line contains many known skills, it's likely a skills listing.
        toks = [t.casefold() for t in re.split(r"[^A-Za-z0-9.+#]+", line) if t]
        hits = 0
        for t in toks:
            if t in skills_master:
                hits += 1
        return hits >= 3

    def score_title_candidate(line: str, idx: int) -> int:
        l = line.casefold()
        score = 0

        has_role = has_role_signal(l)
        # Require some role signal for top-of-resume guessing; otherwise we pick names/headers.
        if not has_role:
            score -= 40

        score += max(0, 40 - idx)  # earlier lines still matter, but shouldn't dominate
        if has_role:
            score += 30
        if any(x in l for x in ["senior", "lead", "principal", "staff"]):
            score += 4
        if is_cert_or_exam_line(l):
            score -= 80
        if "|" in line:
            score -= 6
        # Penalize responsibility/skills sentences and list-like lines.
        if any(x in l for x in [" based ", " using ", " utilized ", " leveraging ", " built ", " developed ", " implemented ", " responsible "]):
            score -= 18
        if l.startswith(("based ", "implementing ", "building ", "data processing")):
            score -= 25
        if line.count(",") >= 2:
            score -= 12
        if ":" in line and (line.count(",") >= 1 or "/" in line):
            score -= 18
        if any(x in l for x in ["years", "experience", "summary", "objective"]):
            score -= 8
        # Strongly penalise lines that START with "experience" — these are body
        # sentences like "Experience Frontend Within Framework Like Angular", not titles.
        if l.startswith("experience ") or l.startswith("experienced "):
            score -= 40
        if any(x in l for x in ["education", "skills", "certification"]):
            score -= 12
        if any(x in l for x in education_markers):
            score -= 30
        if any(x in l for x in ["@", "http", "www."]):
            score -= 30
        if any(x in l for x in ["visa", "ead", "h1b", "c2c", "w2", "usc", "citizen"]):
            score -= 18
        if sum(ch.isdigit() for ch in line) >= 4:
            score -= 18
        if looks_like_name_line(line) and not has_role:
            score -= 40
        if looks_like_skills_line(line):
            score -= 25
        if len(line) > 80:
            score -= 10
        return score

    top_candidates: list[tuple[int, str]] = []
    def candidate_variants(ln: str) -> list[str]:
        # Prefer segments that actually contain a role signal.
        # Examples:
        # - "DXC Technology, FL | Software Engineer" -> pick "Software Engineer"
        # - "Name    Java Full Stack Developer" (two-column header) -> pick title chunk later

        # Split on common separators.
        parts = [p.strip() for p in re.split(r"[|•·]", ln) if p.strip()]
        # Also split two-column lines on large whitespace gaps.
        col_parts = [p.strip() for p in re.split(r"\s{3,}", ln) if p.strip()]
        if len(col_parts) >= 2:
            parts = col_parts

        # Add comma-prefix candidates ("Role, Employer").
        expanded_parts: list[str] = []
        for p in parts:
            expanded_parts.append(p)
            if "," in p:
                prefix = p.split(",", 1)[0].strip()
                if prefix:
                    expanded_parts.append(prefix)
        parts = expanded_parts

        def score_part(p: str) -> int:
            s = 0
            pl = p.casefold()
            if has_role_signal(pl):
                s += 50
            if any(x in pl for x in ["@", "http", "www."]):
                s -= 50
            # Penalize likely employer/location chunks.
            if p.count(",") >= 1 and not has_role_signal(pl):
                s -= 10
            # Prefer shorter, cleaner fragments.
            s -= max(0, len(p) - 60) // 5
            return s

        out: list[str] = []
        if parts:
            best = max(parts, key=score_part)
            out.append(best)
        out.append(ln)

        # Dedupe
        seen: set[str] = set()
        uniq: list[str] = []
        for x in out:
            k = x.casefold()
            if k in seen:
                continue
            seen.add(k)
            uniq.append(x)
        return uniq

    for idx, ln in enumerate(lines[:50]):
        if not (4 <= len(ln) <= 80):
            continue
        for cand in candidate_variants(ln):
            if not (4 <= len(cand) <= 80):
                continue
            score = score_title_candidate(cand, idx)
            if score <= 0:
                continue
            top_candidates.append((score, cand))

    top_candidates.sort(key=lambda x: x[0], reverse=True)
    for _, ln in top_candidates[:8]:
        title = ln.strip(" -:")
        title = strip_leading_candidate_name(title)
        title = pick_best_role_segment(title)
        title = finalize_title(title)
        title = shrink_to_role_phrase(title)
        if 3 <= len(title) <= 80 and is_plausible_job_title(title):
            return canonicalize_job_title(title)

    # Fallback: scan deeper if the role line isn't in the very top.
    for ln in lines[:120]:
        lnl = ln.lower()
        if has_role_signal(lnl) and 4 <= len(ln) <= 70:
            if any(x in lnl for x in ["@", "http", "www."]):
                continue
            if any(x in lnl for x in ["education", "skills", "certification"]):
                continue
            if any(x in lnl for x in education_markers):
                continue
            if looks_like_name_line(ln):
                continue
            if looks_like_skills_line(ln):
                continue
            if any(x in lnl for x in ["/", "-"]):
                # Often experience date ranges; skip unless it looks like a clean title
                if re.search(r"\b\d{4}\b", lnl):
                    continue

            title = ln.strip(" -:")
            title = strip_leading_candidate_name(title)
            title = pick_best_role_segment(title)
            title = finalize_title(title)
            title = shrink_to_role_phrase(title)
            if 3 <= len(title) <= 80 and is_plausible_job_title(title):
                return canonicalize_job_title(title)

    # ── NEW STRATEGY: First experience-section entry ────────────────────────
    # When all other strategies fail, find the EXPERIENCE / PROFESSIONAL EXPERIENCE
    # section header and parse the first job entry's role title.
    # Typical layouts:
    #   EXPERIENCE
    #   Associate Lead                Nov 2019 – Sept 2022
    #   Company Name                  City, State
    # OR inline:
    #   Work Experience
    #   Full time - Company LLC - Software Developer (Jan. 2023 – Aug. 2024)
    _exp_header_re = re.compile(
        r"(?i)^(?:(?:professional|relevant|work)\s+)?experience(?:\s+(?:summary|history))?\s*:?\s*$"
    )
    _date_range_re = re.compile(
        r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|"
        r"aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
        r"\.?\s*'?\d{2,4}",
        re.IGNORECASE,
    )
    _year_re = re.compile(r"\b(?:19|20)\d{2}\b")

    for idx, ln in enumerate(_nel):
        if not _exp_header_re.match(ln.strip()):
            continue
        # Found experience header – check next 5 lines for a role title
        for exp_ln in _nel[idx + 1 : idx + 6]:
            exp_ln = exp_ln.strip()
            if not exp_ln:
                continue
            # Skip bullet-point description lines
            if exp_ln.startswith(("\u2022", "\u00b7", "-", "*")) or re.match(r"^[^\w]", exp_ln):
                continue

            # For inline format: "Full time - Company LLC - Role (dates)"
            # Try dash-segment analysis FIRST — before the company-line skip,
            # because the line may contain "LLC" in one segment but the role in another.
            dash_segments = [s.strip() for s in re.split(r"\s+[-–—]\s+", exp_ln) if s.strip()]
            found_from_segments = False
            if len(dash_segments) >= 2:
                for seg in dash_segments:
                    # Skip company-looking segments
                    if re.search(r"(?i)\b(?:inc|llc|ltd|corp|pvt|private|limited)\b", seg):
                        continue
                    seg_clean = _date_range_re.split(seg)[0].strip()
                    seg_clean = _year_re.split(seg_clean)[0].strip()
                    seg_clean = re.sub(r"\(.*$", "", seg_clean).strip()
                    seg_clean = re.sub(r"[\s,|–—-]+$", "", seg_clean).strip()
                    if seg_clean.casefold().startswith(("full time", "part time", "contract", "freelance")):
                        continue
                    seg_clean = finalize_title(seg_clean)
                    seg_clean = shrink_to_role_phrase(seg_clean)
                    seg_clean = finalize_title(seg_clean)
                    if 3 <= len(seg_clean) <= 70 and has_role_signal(seg_clean.casefold()):
                        if not is_cert_or_exam_line(seg_clean):
                            return canonicalize_job_title(seg_clean)
            # If no inline segments matched, skip pure company/location lines
            if re.search(r"(?i)\b(?:inc|llc|ltd|corp|pvt|private|limited)\b", exp_ln):
                continue

            # Standard format: "Associate Lead  Nov 2019 – Sept 2022"
            cleaned = _date_range_re.split(exp_ln)[0].strip()
            cleaned = _year_re.split(cleaned)[0].strip()
            # Remove trailing parenthetical dates: "Software Developer (Jan 2023 ...)"
            cleaned = re.sub(r"\(.*$", "", cleaned).strip()
            # Remove trailing separators and whitespace
            cleaned = re.sub(r"[\s,|–—-]+$", "", cleaned).strip()
            if not cleaned:
                continue
            # Also try comma-prefix: "Senior Software Engineer, ProArch IT"
            if "," in cleaned:
                cleaned = cleaned.split(",")[0].strip()
            cleaned = finalize_title(cleaned)
            cleaned = shrink_to_role_phrase(cleaned)
            cleaned = finalize_title(cleaned)
            if 3 <= len(cleaned) <= 70 and has_role_signal(cleaned.casefold()):
                if not is_cert_or_exam_line(cleaned):
                    return canonicalize_job_title(cleaned)
        break  # only process first experience section

    return ""


def main() -> int:
    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
    )
    cursor = conn.cursor()
    use_db_dedupe = ensure_schema(cursor, conn)

    resume_input_mode = (os.getenv("RESUME_INPUT_MODE", "local") or "local").strip().casefold()
    resume_folder = (os.getenv("RESUME_INPUT_DIR", "resumes") or "resumes").strip()
    resume_dir = Path(resume_folder).expanduser()
    if not resume_dir.is_absolute():
        resume_dir = (Path(__file__).resolve().parent / resume_dir).resolve()

    # Optional: Google Drive folder sync (supports Shared Drives). This downloads into
    # a local cache directory which we then parse from.
    if resume_input_mode in {"gdrive", "google", "google-drive", "drive"}:
        try:
            from google_drive_sync import sync_drive_folder  # type: ignore
        except Exception as e:
            raise SystemExit(
                "RESUME_INPUT_MODE=gdrive requires google drive dependencies. "
                "Install: google-api-python-client google-auth google-auth-oauthlib\n"
                f"Details: {e.__class__.__name__}"
            )

        folder_id = (os.getenv("GDRIVE_FOLDER_ID", "") or "").strip()
        creds_json = Path((os.getenv("GDRIVE_CREDENTIALS_JSON", "") or "").strip())
        if not folder_id:
            raise SystemExit("Missing GDRIVE_FOLDER_ID for RESUME_INPUT_MODE=gdrive")
        if not creds_json.exists():
            raise SystemExit("Missing/invalid GDRIVE_CREDENTIALS_JSON (OAuth client secrets json)")

        token_json = Path((os.getenv("GDRIVE_TOKEN_JSON", ".gdrive_token.json") or ".gdrive_token.json").strip())
        if not token_json.is_absolute():
            token_json = (Path(__file__).resolve().parent / token_json).resolve()

        cache_dir = Path((os.getenv("GDRIVE_DOWNLOAD_DIR", "resumes_gdrive") or "resumes_gdrive").strip()).expanduser()
        if not cache_dir.is_absolute():
            cache_dir = (Path(__file__).resolve().parent / cache_dir).resolve()

        scanned, downloaded = sync_drive_folder(
            folder_id=folder_id,
            download_dir=cache_dir,
            credentials_json=creds_json,
            token_json=token_json,
            allowed_exts={".pdf", ".docx"},
        )
        if not os.getenv("QUIET", "0") == "1":
            print(f"Google Drive sync: scanned={scanned} downloaded={downloaded} dir={cache_dir}")
        resume_dir = cache_dir
    supported_exts = {".pdf", ".docx"}

    # Seconds; set to 0 to disable. Helps avoid hangs on malformed PDFs.
    try:
        pdf_timeout_seconds = float(os.getenv("PDF_TIMEOUT_SECONDS", "45"))
    except ValueError:
        pdf_timeout_seconds = 45.0

    # Optional: allow processing only a subset of files (used by retry loops).
    only_raw = os.getenv("RESUME_PROCESS_ONLY", "").strip()
    only_set: set[str] | None = None
    if only_raw:
        parts = re.split(r"[;\n\r,]+", only_raw)
        cleaned = [Path(p.strip()).name for p in parts if p and p.strip()]
        only_set = {c for c in cleaned if c}

    report_path = os.getenv("LOAD_REPORT_PATH", "").strip() or None
    quiet = os.getenv("QUIET", "0") == "1"
    report = {
        "processed": [],
        "skipped": [],
        "pdf_timeout_seconds": pdf_timeout_seconds,
        "processed_only": sorted(list(only_set)) if only_set else None,
    }

    try:
        if not resume_dir.exists():
            raise SystemExit(f"Resume input folder not found: {resume_dir}")

        for entry in sorted(resume_dir.iterdir(), key=lambda p: p.name.casefold()):
            if not entry.is_file():
                continue

            file = entry.name
            if only_set is not None and file not in only_set:
                continue

            suffix = Path(file).suffix.lower()
            if suffix not in supported_exts:
                continue

            path = str(entry)
            links: list[str] = []
            first_page_text = ""
            try:
                if suffix == ".pdf":
                    if not quiet:
                        print(f"Parsing: {file}")
                    resume_text, links, first_page_text = extract_pdf_with_timeout(path, timeout_seconds=pdf_timeout_seconds)
                else:
                    resume_text = extract_text_from_docx(path)
                    # Simulate "first page" for DOCX by cutting at the first section heading.
                    first_page_text = _extract_docx_header_block(resume_text)
            except Exception as e:
                is_timeout = isinstance(e, TimeoutError)
                report["skipped"].append(
                    {
                        "file": file,
                        "reason": e.__class__.__name__,
                        "timeout": bool(is_timeout),
                    }
                )
                if not quiet:
                    print(f"Skipped (parse error): {file} ({e.__class__.__name__})")
                continue

            resume_text = normalize_text(resume_text)
            extraction_text = resume_text + ("\n" + "\n".join(links) if links else "")
            resume_text_norm = resume_text.lower()

            # Priority block:
            # Both PDFs and DOCXs now produce a ``first_page_text`` / header-block
            # so all field extraction uses the same first-page-priority path.
            priority_source_text = normalize_text(first_page_text) if first_page_text else resume_text
            header_text, header_extraction_text = _build_header_text(
                priority_source_text,
                links,
                max_lines=120,
                max_chars=4500,
                # Use fraction=1.0 (entire priority block) when we have a proper
                # first-page or header-block; otherwise fall back to the top 30%.
                fraction=1.0 if first_page_text else 0.30,
            )

            # De-dupe key: hash the raw file bytes so different files never collide
            # just because text extraction returned empty/similar text.
            resume_sha256 = file_sha256(path)

            skip_existing = os.getenv("SKIP_EXISTING", "0") == "1"
            if use_db_dedupe and skip_existing:
                cursor.execute(
                    f"SELECT 1 FROM {CANDIDATES_TABLE} WHERE resume_sha256 = %s LIMIT 1",
                    (resume_sha256,),
                )
                if cursor.fetchone() is not None:
                    if not quiet:
                        print(f"Skipped existing: {file}")
                    continue

            # Extract email early (header-first); it can improve name detection.
            email = extract_email(header_extraction_text) or extract_email(extraction_text) or None
            # Prefer extracting name from the priority block first; fall back to full text.
            body_name_top = extract_name(header_text, email=email)
            body_name_full = extract_name(resume_text, email=email)
            # Prefer the header/first-page result: it is closer to the candidate's actual
            # name block and less likely to pick a role-sentence or skills line.
            # Only fall back to the full-text result when the header returned nothing.
            _top_parts = sum(bool(x) for x in body_name_top)
            _full_parts = sum(bool(x) for x in body_name_full)
            if _top_parts >= 2:
                # Header gave us both first + last — use it unconditionally.
                body_name = body_name_top
            elif _top_parts == 1 and _full_parts >= 2:
                # Header found only one part; full text found both — prefer full.
                body_name = body_name_full
            elif _top_parts >= _full_parts:
                body_name = body_name_top
            else:
                body_name = body_name_full
            file_name_guess = infer_name_from_filename(file, email=email)
            email_guess = _name_from_email(email) if email else ("", "")
            first_name, last_name = _pick_best_name_pair(
                body_name=body_name,
                file_name_guess=file_name_guess,
                email_guess=email_guess,
                confirm_text=resume_text,
            )

            # If the extracted name parts are actually skill/role tokens (e.g., "Net", "Data"), drop them.
            skills_master = _skills_master_set()
            roleish = {
                "developer",
                "engineer",
                "architect",
                "analyst",
                "consultant",
                "tester",
                "qa",
                "devops",
                "sre",
                "manager",
                "net",
                "data",
                "stack",
                "full",
                "states",
                "software",
                "development",
                "solutions",
                "operations",
                "dashboard",
                "dashboards",
                "kpi",
                "kpis",
                "informed",
                "decision",
                "decisions",
                "making",
                "united",
                "java",
                "python",
                "react",
                "angular",
                "node",
                "nodejs",
                ".net",
                "dotnet",
                "hive",
                "spark",
                "expertise",
                "snapshot",
                "applications",
                "application",
                "technologies",
                "technology",
                # Additional tech/contact/status tokens that must not survive as name fields.
                "email",
                "web",
                "based",
                "machine",
                "learning",
                "cloud",
                "watch",
                "entity",
                "framework",
                "reduce",
                "map",
                "intranet",
                "extranet",
                "portal",
                "platform",
                "server",
                "client",
                "service",
                "system",
                "database",
                "network",
                "citizen",
                "permanent",
                "resident",
                "fsd",
                # Management / training tokens misclassified as names.
                "training",
                "management",
                "project",
                "testing",
                "agile",
                "scrum",
                "waterfall",
                # Microsoft / web tech tokens.
                "asp",
                "mvc",
                "visual",
                "studio",
            }
            us_state_names = {v.casefold() for v in US_STATE_ABBR_TO_FULL.values()}
            def _compact_token(s: str) -> str:
                return re.sub(r"[^a-z0-9.+#]", "", (s or "").casefold().strip())

            fn_cf = (first_name or "").casefold().strip()
            fn_compact = _compact_token(first_name)
            if first_name and (
                fn_cf in skills_master
                or fn_compact in skills_master
                or fn_compact in roleish
                or fn_cf in roleish
            ):
                first_name = ""

            ln_cf = (last_name or "").casefold().strip()
            ln_cf_compact = _compact_token(last_name)
            if last_name and (
                ln_cf in skills_master
                or ln_cf_compact in skills_master
                or ln_cf_compact in roleish
                or ln_cf in roleish
                or ln_cf in us_state_names
            ):
                last_name = ""

            # Prefer filename-based names when the body result is obviously incomplete or title-ish.
            f_fn, f_ln = file_name_guess
            if (not first_name) and f_fn:
                first_name = f_fn

            # If last name is missing, or looks like initials, fill from filename when consistent.
            ln_alpha = re.sub(r"[^A-Za-z]", "", (last_name or ""))
            f_ln_alpha = re.sub(r"[^A-Za-z]", "", (f_ln or ""))
            if f_fn and f_ln and first_name and first_name.casefold() == f_fn.casefold():
                if not last_name:
                    last_name = f_ln
                elif 1 <= len(ln_alpha) <= 3 and len(f_ln_alpha) >= 5:
                    # Only expand a short initial to the filename's full last name when
                    # the first letter matches — "K" → "Kumar" is correct, but
                    # "K" → "Duddi" is not.  Without this guard the wrong surname
                    # would silently overwrite a legitimate last initial.
                    if f_ln_alpha[:1].casefold() == ln_alpha[:1].casefold():
                        last_name = f_ln

            # If the email is a job-board relay (often anonymized), filename-based names are usually more reliable.
            if email and email.casefold().endswith("@indeedemail.com"):
                fn, ln = file_name_guess
                if fn:
                    first_name = fn
                if ln:
                    last_name = ln

            # ── First-page-priority extraction for all contact/header fields ──────
            # Three-tier waterfall for every field:
            #   Tier 1: first_page/header block (most reliable – fewest noise lines)
            #   Tier 2: full text with links appended
            #   Tier 3: raw resume_text (final safety net)

            # Phone ──────────────────────────────────────────────────────────────
            phone = (
                extract_phone(header_extraction_text)
                or extract_phone(extraction_text)
                or None
            )
            phone_to_store = format_phone_display(phone) or (re.sub(r"\D+", "", str(phone)) if phone else None)

            # Address / Location ──────────────────────────────────────────────────
            # Call extract_address with the narrowest text first so the location_parser
            # module gets the cleanest possible input (no experience bullets).
            address = (
                extract_address(
                    header_text,
                    first_name=first_name,
                    last_name=last_name,
                    phone=phone,
                    allow_phone_fallback=False,
                )
                or (
                    extract_address(
                        priority_source_text,
                        first_name=first_name,
                        last_name=last_name,
                        phone=phone,
                        allow_phone_fallback=False,
                    )
                    if priority_source_text and priority_source_text != header_text
                    else None
                )
                or extract_address(resume_text, first_name=first_name, last_name=last_name, phone=phone)
                or None
            )
            # ── Education: structured parse first, flat fallback ────────────
            education_entries = parse_education_section(resume_text)
            if education_entries:
                # Derive the flat qualification string from structured entries
                # (keeps backward-compat with the qualification TEXT column)
                from data_normalization import post_normalize_qualification
                _flat = education_to_flat_string(education_entries)
                qualification = post_normalize_qualification(_flat) if _flat else extract_qualification(resume_text)
            else:
                qualification = extract_qualification(resume_text)
                education_entries = []
            import json as _json
            _edu_structured = _json.dumps(
                [{k: v for k, v in e.items() if k != "raw_line"} for e in education_entries]
            ) if education_entries else None
            visa_support, visa_type = extract_visa(resume_text_norm)

            # LinkedIn ────────────────────────────────────────────────────────────
            # Tier 1: header block (contains the contact lines)
            # Tier 2: full text + embedded hyperlinks (PDF annotations carry URLs)
            # Tier 3: raw links list extracted from PDF annotations
            linkedin = (
                extract_linkedin(header_extraction_text)
                or extract_linkedin(extraction_text)
                or next(
                    (u for u in links if re.search(r"linkedin\.com/in/", u, re.I)),
                    None,
                )
                or None
            )

            # Store NULL for missing last names.
            # Keep 1-letter last-name initials only when they are confidently sourced from the filename
            # (e.g., "ResumeVishalB" -> "Vishal B").
            if not last_name:
                last_name = ""
            else:
                last_alpha = re.sub(r"[^A-Za-z]", "", last_name)
                if len(last_alpha) <= 1:
                    f_fn, f_ln = file_name_guess
                    f_ln_alpha = re.sub(r"[^A-Za-z]", "", (f_ln or ""))
                    # Trust single-letter initials from the filename when they match.
                    filename_confirms = (
                        first_name
                        and f_fn
                        and first_name.casefold() == f_fn.casefold()
                        and len(f_ln_alpha) == 1
                        and last_alpha.upper() == f_ln_alpha.upper()
                    )
                    # Also trust initials extracted from the resume body/header
                    # text (e.g. DOCX header "KAVYA SRI G" → G is a real initial).
                    b_fn, b_ln = body_name
                    b_ln_alpha = re.sub(r"[^A-Za-z]", "", (b_ln or ""))
                    body_confirms = (
                        first_name
                        and b_fn
                        and first_name.casefold() == b_fn.casefold()
                        and len(b_ln_alpha) == 1
                        and last_alpha.upper() == b_ln_alpha.upper()
                    )
                    if filename_confirms or body_confirms:
                        last_name = last_alpha.upper()
                    else:
                        last_name = ""

            # Job title ───────────────────────────────────────────────────────────
            # Tier 1: header/first-page block (title is almost always here)
            # Tier 2: full priority_source_text (wider first-page slice)
            # Tier 3: entire resume text (deepest fallback)
            job_title = (
                extract_job_title(header_text, first_name=first_name, last_name=last_name)
                or (
                    extract_job_title(priority_source_text, first_name=first_name, last_name=last_name)
                    if priority_source_text and priority_source_text != header_text
                    else None
                )
                or extract_job_title(resume_text, first_name=first_name, last_name=last_name)
            )
            skills = canonicalize_skill_list(extract_skills(resume_text) or "") or None
            experience_years = extract_role_experience_years(resume_text_norm, job_title) or extract_experience_years(resume_text_norm)
            certifications = extract_standard_certifications(resume_text, job_title=job_title, skills=skills)

            # ── LLM enrichment layer (opt-in via LLM_EXTRACT_ENABLED=true) ────────
            _llm = _llm_extract(resume_text, ocr_text="")
            if _llm:
                # Job title: prefer LLM when it has high confidence or rule-based missed
                _llm_jt = _llm.get("job_title")
                _llm_jt_conf = _llm.get("job_title_confidence") or 0.0
                if _llm_jt and (_llm_jt_conf >= 0.85 or not job_title):
                    job_title = _llm_jt

                # LinkedIn: fill in when rule-based extraction missed it
                _llm_li = _llm.get("linkedin_url")
                if _llm_li and not linkedin:
                    linkedin = _llm_li

                # Certifications: use LLM list when rule-based returned nothing
                _llm_certs = _llm.get("certifications") or []
                if _llm_certs and not certifications:
                    certifications = ", ".join(
                        c.get("normalized_name") or c.get("name", "")
                        for c in _llm_certs if c.get("name")
                    ) or None

                # Education: enrich structured entries when rule-based returned none
                _llm_edu = _llm.get("education") or []
                if _llm_edu and not education_entries:
                    education_entries = [
                        {
                            "degree":            e.get("normalized_degree") or e.get("degree") or "",
                            "specialization":    e.get("field_of_study") or "",
                            "university":        e.get("university") or "",
                            "grad_year":         e.get("grad_year") or "",
                            "level":             e.get("level") or "",
                            "confidence":        e.get("confidence") or 0.0,
                        }
                        for e in _llm_edu if isinstance(e, dict)
                    ]
                    import json as _json2
                    _edu_structured = _json2.dumps(
                        [{k: v for k, v in e.items() if k != "raw_line"} for e in education_entries]
                    ) if education_entries else _edu_structured
            # ── end LLM enrichment ────────────────────────────────────────────

            # ── Validation layer (post-processing, applied after extraction) ──
            if _VALIDATION_LAYER_AVAILABLE:
                first_name, last_name = validate_name(first_name, last_name)
                address = validate_location(address)
                qualification = validate_degree(qualification)
                job_title = validate_applied_title(job_title, resume_text)
            # ── end validation layer ──────────────────────────────────────────

            # professional_experience removed

            parsed_at = datetime.now()

            # Store a download-friendly reference.
            # - Set RESUME_DOWNLOAD_BASE_URL (e.g., http://localhost:8000/resumes) to store a full URL.
            # - Set RESUME_FILENAME_MODE: url|path|markdown|html|name
            base_url = os.getenv("RESUME_DOWNLOAD_BASE_URL", "").strip().rstrip("/")
            mode = os.getenv("RESUME_FILENAME_MODE", "path").strip().casefold()

            url = f"{base_url}/{file}" if base_url else ""
            store_label = (os.getenv("RESUME_STORE_FOLDER_LABEL", "") or "").strip()
            if not store_label:
                store_label = resume_dir.name or "resumes"
            path_ref = f"{store_label}/{file}"

            if mode == "name":
                resume_file_ref = file
            elif mode == "markdown" and url:
                resume_file_ref = f"[{file}]({url})"
            elif mode == "html" and url:
                resume_file_ref = f'<a href="{url}">{file}</a>'
            elif mode == "url" and url:
                resume_file_ref = url
            else:
                # Default: store a relative path (or a URL when base_url is set).
                resume_file_ref = url or path_ref

            cursor.execute(
                f"""
                INSERT INTO {CANDIDATES_TABLE}
                (first_name, last_name, address, phone, email, qualification,
                 visa_support, work_authorization_type, linkedin, resume_filename,
                 resume_sha256, parsed_at, education_structured)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (resume_sha256) DO UPDATE SET
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    address = EXCLUDED.address,
                    phone = EXCLUDED.phone,
                    email = EXCLUDED.email,
                    qualification = EXCLUDED.qualification,
                    visa_support = EXCLUDED.visa_support,
                    work_authorization_type = EXCLUDED.work_authorization_type,
                    linkedin = EXCLUDED.linkedin,
                    resume_filename = EXCLUDED.resume_filename,
                    parsed_at = EXCLUDED.parsed_at,
                    education_structured = EXCLUDED.education_structured
                RETURNING id
            """,
                (
                    first_name if first_name and str(first_name).lower() != "none" else None,
                    last_name if last_name and str(last_name).lower() != "none" else None,
                    address,
                    phone_to_store,
                    email,
                    qualification or None,
                    visa_support,
                    visa_type,
                    linkedin,
                    resume_file_ref,
                    resume_sha256,
                    parsed_at,
                    _edu_structured,
                ),
            )

            candidate_id = cursor.fetchone()[0]

            cursor.execute(
                f"""
                INSERT INTO {SKILLS_TABLE}
                (candidate_id, job_title, tech_skills, years_of_experience, certifications, parsed_at)
                VALUES (%s,%s,%s,%s,%s,%s)
                ON CONFLICT (candidate_id) DO UPDATE SET
                    job_title = EXCLUDED.job_title,
                    tech_skills = EXCLUDED.tech_skills,
                    years_of_experience = EXCLUDED.years_of_experience,
                    certifications = EXCLUDED.certifications,
                    parsed_at = EXCLUDED.parsed_at
            """,
                (
                    candidate_id,
                    job_title,
                    skills,
                    experience_years,
                    certifications,
                    parsed_at,
                ),
            )

            conn.commit()
            report["processed"].append(file)
            if not quiet:
                print(f"Processed: {file}")

    finally:
        if report_path:
            try:
                import json

                Path(report_path).write_text(json.dumps(report, indent=2), encoding="utf-8")
            except Exception:
                pass

        cursor.close()
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
