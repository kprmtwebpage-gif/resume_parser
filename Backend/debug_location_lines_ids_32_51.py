import re
from pathlib import Path

import parser as p

FILES = [
    "resumes/ResumePavaniP.pdf",
    "resumes/ResumeVandhanaNakka.pdf",
]


def show_candidates(text: str) -> None:
    lines = p.non_empty_lines(text)
    for ln in lines[:80]:
        lnl = ln.lower()
        if any(k in lnl for k in ["location", "address", "based", "residing", "current"]):
            print("  LBL:", ln)
            continue
        if any(sep in ln for sep in ["|", "◇", "·", "•", "∙", ","]):
            print("  SEP:", ln)
            continue


def main() -> int:
    for rel in FILES:
        path = Path(rel)
        print("\n===", rel, "===")
        full, links, first = p.extract_pdf_with_timeout(str(path), timeout_seconds=10)
        header_text, header_extraction_text = p._build_header_text(full, links)

        phone_h = p.extract_phone(header_extraction_text) or p.extract_phone(full)
        print("phone(header/full)=", phone_h)
        print("address(header)=", p.extract_address(header_text))
        print("address(full)=", p.extract_address(full))

        print("\n-- header lines (first 80) --")
        show_candidates(header_text)

        print("\n-- first page lines (first 80) --")
        show_candidates(first)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
