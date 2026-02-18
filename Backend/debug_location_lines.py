import re
from pathlib import Path

import parser as p

FILES = [
    "resumes/ResumeKeerthiK.pdf",
    "resumes/ResumeSaiYadav.pdf",
    "resumes/ResumeVishalB.pdf",
]

CITY_STATE_ABBRS = sorted(p.US_STATE_ABBR_TO_FULL.keys())
city_state_abbr_re = re.compile(r"\b([A-Za-z][A-Za-z .'-]{1,}),\s*(%s)\b" % ("|".join(CITY_STATE_ABBRS)))
city_state_name_re = re.compile(r"\b([A-Za-z][A-Za-z .'-]{1,}),\s*([A-Za-z][A-Za-z .'-]{2,})\b")


def show_candidates(text: str) -> None:
    lines = p.non_empty_lines(text)
    for ln in lines[:80]:
        lnl = ln.lower()
        if any(k in lnl for k in ["location", "address", "based", "residing", "current"]):
            print("  LBL:", ln)
            continue
        if "," in ln and (city_state_abbr_re.search(ln) or city_state_name_re.search(ln)):
            print("  CST:", ln)


def main() -> int:
    for rel in FILES:
        path = Path(rel)
        print("\n===", rel, "===")
        full, links, first = p.extract_pdf_with_timeout(str(path), timeout_seconds=10)
        header_text, header_extraction_text = p._build_header_text(full, links)

        print("header extract_address:", p.extract_address(header_text))
        print("full   extract_address:", p.extract_address(full))

        print("\n-- header lines --")
        show_candidates(header_text)

        print("\n-- first page lines --")
        show_candidates(first)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
