#!/bin/bash
echo "=== ChetanNag_Resume.pdf full traceback ==="
docker exec \
  -e RESUME_INPUT_DIR=/app/Backend/resumes_cache \
  -e "RESUME_PROCESS_ONLY=ChetanNag_Resume.pdf" \
  -e QUIET=0 \
  -e LOG_LEVEL=DEBUG \
  -e PYTHONIOENCODING=utf-8 \
  resume-api-dev python -c "
import os, sys, traceback
sys.path.insert(0, '/app/Backend')
os.environ['RESUME_INPUT_DIR'] = '/app/Backend/resumes_cache'
os.environ['RESUME_PROCESS_ONLY'] = 'ChetanNag_Resume.pdf'
try:
    from parser import extract_pdf_with_timeout
    result = extract_pdf_with_timeout('/app/Backend/resumes_cache/ChetanNag_Resume.pdf', timeout_seconds=30)
    print('SUCCESS:', type(result), len(result[0]) if result else 0)
except Exception as e:
    traceback.print_exc()
    print('ERROR:', type(e).__name__, str(e))
" 2>&1




