@echo off
setlocal

REM === LLM Extraction Run ===
SET LLM_EXTRACT_ENABLED=true
SET LLM_COMPACT_PROMPT=true
SET LLM_RATE_DELAY=10
SET RESUME_INPUT_MODE=local
SET RESUME_INPUT_DIR=resumes_cache
SET PDF_TIMEOUT_SECONDS=30
SET PYTHONUNBUFFERED=1
SET QUIET=0

CD /D "C:\Users\prave\PycharmProjects\Resume_Parsing -Latest -Updated_UI_190226\Resume_Parsing -Latest -Updated_UI\Backend"

echo Started at %DATE% %TIME% >> parse_llm.log
"C:\Users\prave\PycharmProjects\Resume_Parsing -Latest -Updated_UI_190226\.venv\Scripts\python.exe" -u parser.py >> parse_llm.log 2>&1
echo Finished at %DATE% %TIME% >> parse_llm.log
