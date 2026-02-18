import re
import sys
import zipfile


EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
PHONE_RE = re.compile(r"(?:(?:\+?1\D*)?\(?\d{3}\)?\D*\d{3}\D*\d{4})")


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python inspect_docx_xml_contacts.py path/to/file.docx")
        return 2

    docx_path = sys.argv[1]

    with zipfile.ZipFile(docx_path) as z:
        names = [n for n in z.namelist() if n.startswith("word/") and n.endswith(".xml")]
        picked = [
            n
            for n in names
            if n == "word/document.xml" or n.startswith("word/header") or n.startswith("word/footer")
        ]

        raw = ""
        for n in picked:
            raw += z.read(n).decode("utf-8", errors="ignore") + "\n"

    emails = EMAIL_RE.findall(raw)
    phones = PHONE_RE.findall(raw)

    print(f"xml_parts={len(names)} picked={picked}")
    print(f"has_at={'@' in raw}")
    print(f"email_matches={emails[:10]}")
    print(f"phone_matches={phones[:10]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
