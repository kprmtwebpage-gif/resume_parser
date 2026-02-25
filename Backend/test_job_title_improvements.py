"""
Test script for job title extraction improvements.
Tests both the canonicalize_job_title and finalize_title logic changes.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from data_normalization import canonicalize_job_title

# ──────────────────────────────────────────────────────────────────
# Test 1: canonicalize_job_title ".NET" normalization
# ──────────────────────────────────────────────────────────────────
print("=" * 70)
print("TEST 1: canonicalize_job_title — .NET normalization")
print("=" * 70)

test_cases = [
    # (input, expected)
    ("Senior Net Full Stack Developer",         "Senior .NET Full Stack Developer"),
    ("Net Full Stack Developer",                ".NET Full Stack Developer"),
    ("Dot Net Full Stack Developer",            ".NET Full Stack Developer"),
    ("DotNet Developer",                        ".NET Developer"),
    ("Senior Dot Net Developer",                "Senior .NET Developer"),
    ("Dot Net Developer",                       ".NET Developer"),
    ("net developer",                           ".NET Developer"),
    (".NET Developer",                          ".NET Developer"),
    ("Senior .NET Developer",                   "Senior .NET Developer"),
    ("Full Stack .NET Developer",               "Full Stack .NET Developer"),
    # Non-.NET titles should be untouched
    ("Java Full Stack Developer",               "Java Full Stack Developer"),
    ("Senior Data Engineer",                    "Senior Data Engineer"),
    ("Software Engineer",                       "Software Engineer"),
    ("DevOps Engineer",                         "DevOps Engineer"),
]

passed = 0
failed = 0
for inp, expected in test_cases:
    result = canonicalize_job_title(inp)
    status = "PASS" if result == expected else "FAIL"
    if status == "FAIL":
        failed += 1
        print(f"  {status}: '{inp}' → '{result}'  (expected: '{expected}')")
    else:
        passed += 1
        print(f"  {status}: '{inp}' → '{result}'")

print(f"\nResults: {passed} passed, {failed} failed out of {len(test_cases)}")

# ──────────────────────────────────────────────────────────────────
# Test 2: extract_job_title improvements
# ──────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("TEST 2: extract_job_title — garbage rejection & encoding fixes")
print("=" * 70)

from parser import extract_job_title

# Test: Garbage parenthetical fragments should be rejected
garbage_texts = [
    "Services) and Backend (oracle\nSome other text with developer keyword",
    ") and Backend (oracle Database, PL/SQL Developer experience",
]
for txt in garbage_texts:
    result = extract_job_title(txt)
    # Should NOT return garbage with unbalanced parens
    has_unbalanced = result.count(")") != result.count("(")
    status = "PASS" if not has_unbalanced else "FAIL"
    print(f"  {status}: Garbage input → '{result}' (unbalanced={has_unbalanced})")

# Test: Encoding fix for mojibake dash
enc_texts = [
    "Software Consultant â Lead\nSenior Developer experience",
]
for txt in enc_texts:
    result = extract_job_title(txt)
    has_mojibake = "â" in result
    status = "PASS" if not has_mojibake else "FAIL"
    print(f"  {status}: Encoding input → '{result}' (mojibake={has_mojibake})")

# ──────────────────────────────────────────────────────────────────
# Test 3: extract_job_title with various header formats
# ──────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("TEST 3: extract_job_title — header format detection")
print("=" * 70)

header_tests = [
    # (description, resume_text, should_contain)
    ("Explicit role label",
     "John Smith\nPosition: Senior Java Developer\nSummary: 10 years exp",
     "Java Developer"),
    ("Name + title on same line",
     "Satya Veni Chelluboina Java Full Stack Developer\nSummary: ...",
     "Java Full Stack Developer"),
    ("Dot Net in title",
     "Praveen Reddy\nSenior Dot Net Developer\nSkills: C#, ASP.NET",
     ".NET Developer"),
    ("Net without dot",
     "Rupesh Kumar\nSenior Net Full Stack Developer\nExperience: ...",
     ".NET Full Stack Developer"),
    ("Experience-as pattern",
     "Summary: 8+ years of experience as a Senior Data Engineer\nworking with AWS and Azure",
     "Data Engineer"),
    ("Working as pattern",
     "Currently working as a Machine Learning Engineer at Google\nResponsibilities include...",
     "Machine Learning Engineer"),
    ("Expanded role — Director",
     "Charlie Maere\nGlobal Director\nAI Expert Digital Health Leader",
     "Director"),
    ("Cloud engineer role",
     "John Doe\nSenior Cloud Engineer\nAWS, Azure, GCP certified",
     "Cloud Engineer"),
    ("Solutions architect role",
     "Jane Smith\nSolutions Architect\nDesigning enterprise systems",
     "Solutions Architect"),
]

passed = 0
failed = 0
for desc, txt, should_contain in header_tests:
    result = extract_job_title(txt)
    ok = should_contain.casefold() in result.casefold()
    status = "PASS" if ok else "FAIL"
    if not ok:
        failed += 1
        print(f"  {status}: {desc} → '{result}' (expected to contain '{should_contain}')")
    else:
        passed += 1
        print(f"  {status}: {desc} → '{result}'")

print(f"\nResults: {passed} passed, {failed} failed out of {len(header_tests)}")

# ──────────────────────────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
print("ALL TESTS COMPLETE")
print("=" * 70)
