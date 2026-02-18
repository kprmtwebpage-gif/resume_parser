import os
import re
import sys

import pdfplumber

try:
    import pytesseract
except Exception as exc:
    raise SystemExit(f"pytesseract import failed: {exc}")


EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
PHONE_RE = re.compile(
    r"(?:(?:\+?1\s*[.-]?)?\(?\d{3}\)?\s*[.-]?\s*\d{3}\s*[.-]?\s*\d{4})"
)


def _find_all(pattern: re.Pattern[str], text: str) -> list[str]:
    return [m.group(0) for m in pattern.finditer(text or "")]


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python scan_pdf_contacts.py path/to/resume.pdf [max_pages]")
        return 2

    pdf_path = sys.argv[1]
    max_pages = int(sys.argv[2]) if len(sys.argv) >= 3 else 3

    tcmd = os.environ.get("TESSERACT_CMD")
    if tcmd:
        pytesseract.pytesseract.tesseract_cmd = tcmd

    with pdfplumber.open(pdf_path) as pdf:
        n = len(pdf.pages)
        scan_n = min(max_pages, n)
        print(f"pages={n} scanning={scan_n}")

        for page_idx in range(scan_n):
            page = pdf.pages[page_idx]

            extracted = page.extract_text() or ""
            extracted_emails = _find_all(EMAIL_RE, extracted)
            extracted_phones = _find_all(PHONE_RE, extracted)

            print(f"\n--- page {page_idx+1} extracted ---")
            print(f"len={len(extracted)} emails={extracted_emails[:5]} phones={extracted_phones[:5]}")

            try:
                img = page.to_image(resolution=250).original
                ocr = pytesseract.image_to_string(img, config="--oem 3 --psm 6")
            except Exception as exc:
                print(f"OCR error: {exc}")
                continue

            ocr_emails = _find_all(EMAIL_RE, ocr)
            ocr_phones = _find_all(PHONE_RE, ocr)

            print(f"--- page {page_idx+1} ocr ---")
            print(f"len={len(ocr)} emails={ocr_emails[:5]} phones={ocr_phones[:5]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
