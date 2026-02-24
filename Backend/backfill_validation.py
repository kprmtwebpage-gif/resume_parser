"""
backfill_validation.py
======================
Re-applies the v2 validation_layer to all existing candidates in the database.

Run from the Backend/ folder:
    python backfill_validation.py

What it does:
  1. Reads every candidate row from candidate_profile + candidate_skills_profile.
  2. Runs validate_name, validate_location, validate_degree, validate_applied_title.
  3. Writes nulled / cleaned values back to the DB.
  4. Prints a summary of how many fields were nulled per category.
"""
import os
import sys
import re
from pathlib import Path

# Make sure Backend/ is on the path when run from another directory
sys.path.insert(0, str(Path(__file__).resolve().parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env", override=False)

import psycopg2
from validation_layer import (
    validate_name,
    validate_location,
    validate_degree,
    validate_applied_title,
)

CANDIDATES_TABLE = os.getenv("CANDIDATES_TABLE", "candidate_profile")
SKILLS_TABLE     = os.getenv("SKILLS_TABLE",     "candidate_skills_profile")

# ---------------------------------------------------------------------------
# Aggressive name inference from filename (used to recover NULL-name records)
# ---------------------------------------------------------------------------
_FNAME_IGNORE: frozenset = frozenset({
    "resume", "cv", "profile", "final", "latest", "updated", "update",
    "new", "copy", "draft", "version", "java", "dotnet", "net", "dot",
    "developer", "engineer", "architect", "analyst", "consultant", "tester",
    "qa", "manager", "intern", "lead", "senior", "junior", "sr", "jr",
    "full", "stack", "backend", "frontend", "fullstack", "python", "react",
    "angular", "aws", "azure", "cloud", "sql", "bi", "data", "software",
    "technologies", "tech",
})
_FNAME_IGNORE_ENDS: tuple = ("resume", "developer", "engineer", "analyst", "consultant")


def _infer_name_aggressively(filename: str) -> tuple[str, str]:
    """Extract a (first_name, last_name) from a filename when normal heuristics fail.
    Handles patterns like:
      ResumeAkhilD.pdf         -> (Akhil, "")
      KAVYA-JAVA Resume.docx   -> (Kavya, "")
      PriyankaAdhikari_Dotnet_Developer.docx -> (Priyanka, Adhikari)
      GANESH_NAKKALA -Resume- 2024__<hash>.pdf -> (Ganesh, Nakkala)
      TEJA'S resume.docx       -> (Teja, "")
      Bhagya_Lakshmi_.Netresume.docx -> (Bhagya, Lakshmi)
    """
    # Work on just the filename, not the folder
    raw_stem = Path(str(filename).split("/")[-1].split("\\")[-1]).stem
    # Normalize separators FIRST so hash-detection works on individual tokens
    base = re.sub(r"[_.\-\s]+", " ", raw_stem).strip()
    # Remove hash-like random sequences (job-board suffixes: 20+ consecutive alphanums)
    base = re.sub(r"\b[A-Za-z0-9]{20,}\b", "", base)
    # CamelCase split (lowercase → uppercase transitions only)
    base = re.sub(r"([a-z])([A-Z])", r"\1 \2", base)
    base = re.sub(r"\s+", " ", base).strip()

    parts: list[str] = []
    for token in base.split():
        # Strip trailing `'S` / `'s` (e.g. "TEJA'S" → "TEJA")
        token = re.sub(r"'[Ss]$", "", token).strip()
        alpha = re.sub(r"[^A-Za-z]", "", token)
        if len(alpha) < 2:
            continue
        if not re.fullmatch(r"[A-Za-z][A-Za-z'\-]*", alpha):
            continue
        alpha_cf = alpha.casefold()
        if alpha_cf in _FNAME_IGNORE:
            continue
        if any(alpha_cf.endswith(end) for end in _FNAME_IGNORE_ENDS):
            continue
        parts.append(alpha.title())

    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1]

def main():
    conn = psycopg2.connect(
        dbname   = os.getenv("DB_NAME"),
        user     = os.getenv("DB_USER"),
        password = os.getenv("DB_PASSWORD"),
        host     = os.getenv("DB_HOST", "localhost"),
        port     = os.getenv("DB_PORT", "5432"),
    )
    cur = conn.cursor()

    # ---- Fetch all candidates ------------------------------------------------
    cur.execute(f"""
        SELECT
            cp.id,
            cp.first_name,
            cp.last_name,
            cp.address,
            cp.qualification,
            csp.job_title,
            cp.email,
            cp.resume_filename
        FROM {CANDIDATES_TABLE} cp
        LEFT JOIN {SKILLS_TABLE} csp ON csp.candidate_id = cp.id
        ORDER BY cp.id
    """)
    rows = cur.fetchall()

    total   = len(rows)
    nulled  = {"name": 0, "location": 0, "degree": 0, "job_title": 0}
    recovered = {"name": 0, "location": 0}
    updated = 0

    # Normalise: treat None and "" as equivalent (both mean "no value")
    def _changed(old, new) -> bool:
        return (old or None) != (new or None)

    print(f"Processing {total} candidates...\n")

    for row in rows:
        cid, fn, ln, address, qualification, job_title, email, resume_filename = row

        # Normalise empty strings from DB to None
        fn            = fn or None
        ln            = ln or None
        address       = address or None
        qualification = qualification or None
        job_title     = job_title or None

        changes: dict[str, object] = {}

        # ---- Name recovery (NULL first_name from filename) -------------------
        # If the validation layer previously nulled a name that might be
        # recoverable from the filename, try the aggressive inference.
        _recovered_fn: str | None = None
        _recovered_ln: str | None = None
        if fn is None and resume_filename:
            inf_fn, inf_ln = _infer_name_aggressively(resume_filename)
            if inf_fn:
                val_fn, val_ln = validate_name(inf_fn, inf_ln)
                if val_fn:
                    _recovered_fn = val_fn
                    _recovered_ln = val_ln
                    changes["first_name"] = val_fn
                    changes["last_name"]  = val_ln
                    recovered["name"] += 1
                    print(f"  [{cid}] NAME recovered: '{inf_fn} {inf_ln}' -> '{val_fn} {val_ln or ''}' (from filename)")

        # ---- Name ------------------------------------------------------------
        # Skip if already recovered above, otherwise run normal validation
        if _recovered_fn is not None:
            new_fn, new_ln = _recovered_fn, _recovered_ln
        else:
            new_fn, new_ln = validate_name(fn, ln)
            if _changed(fn, new_fn) or _changed(ln, new_ln):
                changes["first_name"] = new_fn
                changes["last_name"]  = new_ln
                if new_fn is None:
                    nulled["name"] += 1
                    print(f"  [{cid}] NAME nulled: '{fn} {ln or ''}' -> NULL")

        # ---- Location --------------------------------------------------------
        new_addr = validate_location(address)
        if _changed(address, new_addr):
            changes["address"] = new_addr
            if new_addr is None:
                nulled["location"] += 1
                print(f"  [{cid}] LOCATION nulled:   '{address}' -> NULL")
            else:
                recovered["location"] += 1
                print(f"  [{cid}] LOCATION cleaned:  '{address}' -> '{new_addr}'")

        # ---- Degree ----------------------------------------------------------
        new_qual = validate_degree(qualification)
        if _changed(qualification, new_qual):
            changes["qualification"] = new_qual
            if new_qual is None:
                nulled["degree"] += 1
                print(f"  [{cid}] DEGREE nulled: '{qualification}' -> NULL")

        # ---- Job title -------------------------------------------------------
        # Note: we pass empty string as resume_text here because we don't have
        # the original text in the DB.  validate_applied_title falls back to
        # structural checks only (role signal, length, etc.) which are still useful.
        new_jt = validate_applied_title(job_title, resume_text="")
        if _changed(job_title, new_jt):
            changes["job_title"] = new_jt
            if new_jt is None:
                nulled["job_title"] += 1
                print(f"  [{cid}] JOB_TITLE nulled: '{job_title}' -> NULL")

        if not changes:
            continue

        updated += 1

        # ---- Write candidate_profile changes ---------------------------------
        profile_fields = {k: v for k, v in changes.items()
                          if k in ("first_name", "last_name", "address", "qualification")}
        if profile_fields:
            set_clause = ", ".join(f"{k} = %s" for k in profile_fields)
            values     = list(profile_fields.values()) + [cid]
            cur.execute(
                f"UPDATE {CANDIDATES_TABLE} SET {set_clause} WHERE id = %s",
                values,
            )

        # ---- Write skills profile changes ------------------------------------
        if "job_title" in changes:
            cur.execute(
                f"UPDATE {SKILLS_TABLE} SET job_title = %s WHERE candidate_id = %s",
                (changes["job_title"], cid),
            )

    conn.commit()
    conn.close()

    print("\n" + "=" * 60)
    print(f"Backfill complete.  Total: {total}  Updated: {updated}")
    print(f"  Names recovered:    {recovered['name']}")
    print(f"  Names nulled:       {nulled['name']}")
    print(f"  Locations cleaned:  {recovered['location']}")
    print(f"  Locations nulled:   {nulled['location']}")
    print(f"  Degrees nulled:     {nulled['degree']}")
    print(f"  Job titles nulled:  {nulled['job_title']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
