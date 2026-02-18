import os
import re
import sys
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

import parser as p


# Windows consoles can default to cp1252; resume text often contains symbols.
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def _parse_ids(argv: list[str]) -> list[int]:
    ids: list[int] = []
    for a in argv[1:]:
        for part in a.split(","):
            part = part.strip()
            if part:
                ids.append(int(part))
    return ids


def _extract_text_for_file(path: Path, *, timeout_seconds: float | None = None) -> tuple[str, str, list[str]]:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        if timeout_seconds is None:
            try:
                timeout_seconds = float(os.getenv("PDF_TIMEOUT_SECONDS", "10") or "10")
            except Exception:
                timeout_seconds = 10.0
        full, links, first_page = p.extract_pdf_with_timeout(str(path), timeout_seconds=float(timeout_seconds))
        return p.normalize_text(full), p.normalize_text(first_page or ""), links
    if suffix == ".docx":
        full = p.extract_text_from_docx(str(path))
        return p.normalize_text(full), "", []
    raise RuntimeError(f"Unsupported file: {path}")


def main(argv: list[str]) -> int:
    load_dotenv()
    ids = _parse_ids(argv)
    if not ids:
        print("Usage: python debug_contacts_for_ids.py 6 17 20 46 49")
        return 2

    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
    )

    q = (
        "SELECT id, resume_filename, first_name, last_name "
        "FROM candidate_profile WHERE id = ANY(%s) ORDER BY id"
    )

    with conn:
        with conn.cursor() as cur:
            cur.execute(q, (ids,))
            rows = cur.fetchall()

    base = Path.cwd()

    for cid, resume_filename, first_name, last_name in rows:
        rel = str(resume_filename or "")
        path = Path(rel)
        if not path.exists():
            path = base / rel
        print("=" * 120)
        print(f"id={cid} file={path}")

        try:
            full_text, first_page_text, links = _extract_text_for_file(path)
        except Exception as e:
            print(f"FAILED to extract text: {e}")
            continue

        extraction_text = full_text + ("\n" + "\n".join(links) if links else "")
        priority_source_text = p.normalize_text(first_page_text) if (path.suffix.lower() == ".pdf" and first_page_text) else full_text
        header_text, header_extraction_text = p._build_header_text(
            priority_source_text,
            links,
            fraction=1.0 if (path.suffix.lower() == ".pdf" and first_page_text) else 0.30,
        )

        phone_header = p.extract_phone(header_extraction_text)
        phone_full = p.extract_phone(extraction_text)
        phone = phone_header or phone_full

        addr_header = p.extract_address(header_text, first_name=first_name, last_name=last_name, phone=phone)
        addr_full = p.extract_address(full_text, first_name=first_name, last_name=last_name, phone=phone)
        address = addr_header or addr_full

        print(f"first_name={first_name!r} last_name={last_name!r}")
        print(f"phone(header)={phone_header!r} phone(full)={phone_full!r} => phone={phone!r}")
        print(f"address(header)={addr_header!r} address(full)={addr_full!r} => address={address!r}")

        print("\n--- header lines (first 25) ---")
        for i, ln in enumerate(p.non_empty_lines(header_text)[:25]):
            if re.search(r"\d", ln) or re.search(r"(?i)phone|mobile|cell|tel|contact", ln):
                print(f"{i+1:02d}: {ln}")

        print("\n--- digit-ish lines anywhere (first 15 matches) ---")
        shown = 0
        for ln in p.non_empty_lines(full_text):
            if re.search(r"(?i)phone|mobile|cell|tel|contact", ln) or re.search(r"\b\d[\d\s().+-]{6,}\d\b", ln):
                print(ln)
                shown += 1
                if shown >= 15:
                    break

    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
