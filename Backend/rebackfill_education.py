"""
rebackfill_education.py
────────────────────────────────────────────────────────────────────────────
Re-parse and backfill education_structured for all candidates from their
resume files (DOCX in document order, PDF page-by-page).

Run from the Backend directory:
    python rebackfill_education.py

Requires the education_parser module to be in the same directory or on
the Python path.
"""
import os
import sys
import json
import glob

bp = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, bp)

import psycopg2
from education_parser import parse_education_section


def extract_docx_ordered(path: str) -> str:
    """Extract DOCX text preserving document order (paragraphs and tables interspersed)."""
    import docx as docxlib
    from docx.oxml.ns import qn

    doc = docxlib.Document(path)
    parts = []

    def get_para_text(el):
        return ''.join(t.text for t in el.iter(qn('w:t')) if t.text)

    def get_cell_text(cell_el):
        lines = []
        for para in cell_el.iter(qn('w:p')):
            txt = ''.join(t.text for t in para.iter(qn('w:t')) if t.text).strip()
            if txt:
                lines.append(txt)
        return '\n'.join(lines)

    for child in doc.element.body:
        tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
        if tag == 'p':
            txt = get_para_text(child).strip()
            if txt:
                parts.append(txt)
        elif tag == 'tbl':
            for row in child.iter(qn('w:tr')):
                for cell in row.findall('.//' + qn('w:tc')):
                    ct = get_cell_text(cell)
                    if ct:
                        for line in ct.split('\n'):
                            if line.strip():
                                parts.append(line.strip())

    return '\n'.join(parts)


def extract_full_text(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    try:
        if ext == '.pdf':
            import pdfplumber
            parts = []
            with pdfplumber.open(path) as pdf:
                for page in pdf.pages:
                    try:
                        t = page.extract_text() or ''
                        if t:
                            parts.append(t)
                    except Exception:
                        pass
            return '\n'.join(parts)
        elif ext in ('.docx', '.doc'):
            return extract_docx_ordered(path)
    except Exception as e:
        print(f'    [read error {os.path.basename(path)}] {e}')
    return ''


def resolve_path(resume_filename: str | None) -> str | None:
    if not resume_filename:
        return None
    basename = os.path.basename(resume_filename)
    full = os.path.join(bp, 'resumes_cache', basename)
    if os.path.exists(full):
        return full
    stem = os.path.splitext(basename)[0]
    matches = glob.glob(os.path.join(bp, 'resumes_cache', f'{stem}*'))
    return matches[0] if matches else None


def main() -> None:
    conn = psycopg2.connect(
        dbname=os.getenv('DB_NAME', 'postgres'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', 'admin'),
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 5432)),
    )
    cur = conn.cursor()
    cur.execute(
        'SELECT id, first_name, last_name, resume_filename, qualification '
        'FROM candidate_profile ORDER BY id'
    )
    rows = cur.fetchall()
    updated = no_file = no_edu = 0

    for (cid, fn, ln, rfn, qual) in rows:
        name = f'{fn or ""} {ln or ""}'.strip()
        cache_path = resolve_path(rfn)

        entries = []
        if cache_path:
            text = extract_full_text(cache_path)
            if text.strip():
                try:
                    entries = parse_education_section(text)
                except Exception as e:
                    print(f'  [{cid}] {name}: parse error: {e}')

        # If nothing from resume file, try qualification string
        if not entries and qual:
            try:
                entries = parse_education_section(qual)
            except Exception:
                pass

        if not entries:
            if not cache_path:
                no_file += 1
            else:
                no_edu += 1
            continue

        clean = [{k: v for k, v in e.items() if k != 'raw_line'} for e in entries]
        cur.execute(
            'UPDATE candidate_profile SET education_structured = %s WHERE id = %s',
            (json.dumps(clean), cid),
        )

        for e in clean:
            univ = e.get('university') or ''
            spec = e.get('specialization') or ''
            deg = e.get('degree') or '?'
            univ_str = f' @ {univ}' if univ else ''
            spec_str = f' in {spec}' if spec else ''
            print(f'  [{cid}] {name}: {deg}{spec_str}{univ_str}')
        updated += 1

    conn.commit()
    conn.close()
    print(f'\nDone. Updated={updated}  No cache file={no_file}  No edu found={no_edu}')


if __name__ == '__main__':
    main()
