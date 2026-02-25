#!/usr/bin/env python3
"""Diagnostic: trace the exact address-extraction pipeline for problem candidates.

Run INSIDE the Docker container (resume-ingestion-dev) on the server to see
why the 3-tier waterfall in main() produces empty addresses.
"""
import os, sys, re, json, glob
sys.path.insert(0, os.path.dirname(__file__))

from parser import (
    extract_address, extract_phone, format_phone_display,
    _extract_docx_header_block, _build_header_text, non_empty_lines,
)
from location_parser import (
    detect_location_with_fallback,
    location_result_to_string,
    extract_location,
    detect_location_from_phone,
)

# 13 problem candidates (filename substring → expected phone area code location)
PROBLEM_CANDIDATES = [
    "KAVYA",
    "PavaniP",
    "RamPolsani",
    "SolGar",
    "Abhiram",
    "Akhil",
    "Bharadwaj",
    "Pranav",
    "Prashanth",
    "JagadeeshK",
    "PavaniGoli",
    "VidyaSagar",
    "Tejaswini",
]

RESUME_DIR = os.environ.get("RESUME_DIR", "/app/resumes_cache")


def find_resume_file(name_substr: str) -> str | None:
    """Find the resume file matching the candidate name substring."""
    for ext in ("*.docx", "*.pdf", "*.doc"):
        for path in glob.glob(os.path.join(RESUME_DIR, ext)):
            if name_substr.lower() in os.path.basename(path).lower():
                return path
    return None


def extract_text(filepath: str) -> tuple[str, list[str]]:
    """Extract text and links from a resume file."""
    from parser import extract_text_from_file
    return extract_text_from_file(filepath)


def trace_candidate(name_substr: str):
    """Trace the full address extraction pipeline for a single candidate."""
    print(f"\n{'='*80}")
    print(f"  TRACING: {name_substr}")
    print(f"{'='*80}")

    filepath = find_resume_file(name_substr)
    if not filepath:
        print(f"  [!] No resume file found for '{name_substr}' in {RESUME_DIR}")
        return
    print(f"  File: {os.path.basename(filepath)}")

    # Extract text
    try:
        resume_text, links = extract_text(filepath)
    except Exception as e:
        print(f"  [!] Text extraction failed: {e}")
        return

    print(f"  Text length: {len(resume_text)} chars, {len(resume_text.splitlines())} lines")
    print(f"  Links: {links[:3]}...")

    # --- Step 1: Extract phone (same as main()) ---
    is_docx = filepath.lower().endswith(".docx")
    first_page_text = None  # DOCX doesn't have first_page_text

    if is_docx:
        header_block = _extract_docx_header_block(resume_text)
        header_text, header_extraction_text = _build_header_text(
            header_block, links, max_lines=120, max_chars=4500, fraction=1.0
        )
    else:
        header_text, header_extraction_text = _build_header_text(
            resume_text, links, max_lines=60, max_chars=2600, fraction=0.25
        )

    # priority_source_text (same logic as main())
    if first_page_text:
        priority_source_text, extraction_text = _build_header_text(
            first_page_text, links, max_lines=120, max_chars=4500, fraction=1.0
        )
    else:
        priority_source_text, extraction_text = _build_header_text(
            resume_text, links, max_lines=120, max_chars=4500, fraction=0.30
        )

    print(f"\n  --- Header Text (first 500 chars) ---")
    print(f"  {repr(header_text[:500])}")
    print(f"\n  --- Priority Source Text (first 500 chars) ---")
    print(f"  {repr(priority_source_text[:500])}")

    # --- Step 2: Extract phone ---
    phone = extract_phone(header_extraction_text) or extract_phone(extraction_text) or None
    phone_display = format_phone_display(phone) or (re.sub(r"\D+", "", str(phone)) if phone else None)
    print(f"\n  Phone: {phone} → display: {phone_display}")

    # --- Step 3: Extract names (simplified) ---
    first_name = name_substr  # Approximation
    last_name = ""

    # --- Step 4: Trace location_parser ---
    print(f"\n  --- location_parser.extract_location(header_text) ---")
    lp_result_header = extract_location(header_text)
    print(f"  Result: {lp_result_header}")
    if lp_result_header:
        print(f"  → string: {location_result_to_string(lp_result_header)}")

    print(f"\n  --- location_parser.detect_location_with_fallback(header_text, phone) ---")
    lp_fb_header = detect_location_with_fallback(header_text, str(phone) if phone else None)
    print(f"  Result: {lp_fb_header}")
    if lp_fb_header:
        print(f"  → string: {location_result_to_string(lp_fb_header)}")
        print(f"  → confidence: {lp_fb_header.get('confidence')}")
        print(f"  → source: {lp_fb_header.get('source')}")

    print(f"\n  --- location_parser.detect_location_from_phone(phone) ---")
    phone_loc = detect_location_from_phone(str(phone) if phone else None)
    print(f"  Result: {phone_loc}")

    # --- Step 5: Trace the 3-tier extract_address waterfall ---
    print(f"\n  --- TIER 1: extract_address(header_text, allow_phone_fallback=False) ---")
    addr_t1 = extract_address(
        header_text, first_name=first_name, last_name=last_name,
        phone=phone, allow_phone_fallback=False,
    )
    print(f"  Result: {repr(addr_t1)}")

    print(f"\n  --- TIER 2: extract_address(priority_source_text, allow_phone_fallback=False) ---")
    if priority_source_text and priority_source_text != header_text:
        addr_t2 = extract_address(
            priority_source_text, first_name=first_name, last_name=last_name,
            phone=phone, allow_phone_fallback=False,
        )
        print(f"  Result: {repr(addr_t2)}")
    else:
        addr_t2 = None
        print(f"  Skipped (same as header_text or empty)")

    print(f"\n  --- TIER 3: extract_address(resume_text, allow_phone_fallback=True) ---")
    addr_t3 = extract_address(
        resume_text, first_name=first_name, last_name=last_name,
        phone=phone, allow_phone_fallback=True,
    )
    print(f"  Result: {repr(addr_t3)}")

    # --- Final result (same or-chain as main()) ---
    final = addr_t1 or addr_t2 or addr_t3 or None
    print(f"\n  *** FINAL ADDRESS: {repr(final)}")

    # --- What would the phone-only fallback give? ---
    if not final:
        print(f"  *** PHONE-ONLY fallback would give: {phone_loc}")
        if phone_loc:
            print(f"     → {location_result_to_string(phone_loc)}")


if __name__ == "__main__":
    # Trace first 5 problem candidates (or all if arg given)
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    for name in PROBLEM_CANDIDATES[:n]:
        try:
            trace_candidate(name)
        except Exception as e:
            print(f"\n  [!] ERROR tracing {name}: {e}")
            import traceback
            traceback.print_exc()
