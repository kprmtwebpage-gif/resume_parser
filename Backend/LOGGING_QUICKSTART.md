# Quick Start Guide: Using the New Logging System

## What Changed

Your parser now has production-ready logging with:
- ✅ **Compressed rotation** (saves 5-10× disk space in uat/prod)
- ✅ **Separate error logs** (quick troubleshooting without noise)
- ✅ **Environment-aware** (auto-adjusts DEBUG/INFO/WARNING per env)
- ✅ **Log analyzer utility** (search, stats, cleanup commands)

---

## 1. Quick Test (Local Dev)

Run a full parse to populate logs:

```powershell
# Parse a few resumes
cd Backend
$env:PARSER_LOG_LEVEL="DEBUG"
python parser.py

# View logs in real-time
Get-Content logs/parser_debug_dev.log -Wait

# Or view last 50 lines
Get-Content logs/parser_debug_dev.log -Tail 50
```

**You'll see:**
```
2026-03-01 10:15:30 [INFO   ] Logger initialized  env=dev  level=DEBUG  compress=False
2026-03-01 10:15:32 [INFO   ] === Parse run started  dir=C:\...\resumes_cache  env=dev ===
2026-03-01 10:15:35 [DEBUG  ] NAME-RAW  [Resume_John.pdf] body=('John', 'Doe')  file=('John', 'Doe')  picked=('John', 'Doe')
2026-03-01 10:15:35 [DEBUG  ] NAME-FINAL[Resume_John.pdf] first='John'  last='Doe'
2026-03-01 10:15:36 [INFO   ] PARSED [Resume_John.pdf] name=(John, Doe) title=Engineer email=john@example.com
2026-03-01 10:15:36 [DEBUG  ] DB-COMMIT [Resume_John.pdf] candidate_id=1234
2026-03-01 10:20:00 [INFO   ] === Parse run finished  processed=150  skipped=3 ===
```

---

## 2. Using the Log Analyzer

After parsing some resumes:

```powershell
cd Backend

# Show parsing statistics
python log_analyzer.py stats
# Output:
#   Total parsed:     150
#   Name issues:      5 (3.3%)
#   Title issues:     8 (5.3%)

# View recent successful parses
python log_analyzer.py recent 20

# Find a specific resume
python log_analyzer.py search "Resume_Problem.pdf"

# Find all candidates with missing names
python log_analyzer.py filter "name=('', '')"

# View recent errors only
python log_analyzer.py errors

# Show help
python log_analyzer.py
```

---

## 3. Environment Setup

### Development (current)
```bash
# .env file
DEPLOY_ENV=dev
PARSER_LOG_LEVEL=DEBUG
PARSER_LOG_COMPRESS=0

# Result:
# - Full debug output
# - No compression (faster)
# - Files: parser_debug_dev.log, parser_errors_dev.log
```

### UAT Testing
```bash
# .env file
DEPLOY_ENV=uat
PARSER_LOG_LEVEL=INFO
PARSER_LOG_COMPRESS=1

# Result:
# - INFO + WARNING + ERROR only (less noise)
# - Compressed backups (.gz files)
# - Files: parser_debug_uat.log, parser_errors_uat.log
```

### Production
```bash
# .env file
DEPLOY_ENV=prod
PARSER_LOG_LEVEL=WARNING
PARSER_LOG_COMPRESS=1

# Result:
# - Errors + warnings only
# - Compressed backups
# - Files: parser_debug_prod.log, parser_errors_prod.log
```

---

## 4. Troubleshooting Workflow

### Scenario: User reports "Name extracted incorrectly"

**Step 1:** Find the resume in logs
```powershell
python log_analyzer.py search "Resume_Problem.pdf"
```

**Step 2:** Check the decision chain
```
NAME-RAW  [Resume_Problem.pdf] body=('Blobs', '')  file=('John', 'Smith')  picked=('Blobs', '')
NAME-FINAL[Resume_Problem.pdf] first='Blobs'  last=''
PARSED    [Resume_Problem.pdf] name=(Blobs, '') title=None
```

**Step 3:** Diagnosis
- Body extraction returned garbage ('Blobs', '')
- File extraction was correct ('John', 'Smith')
- Scoring system chose body over file (bug!)

**Step 4:** Fix scoring in parser.py
```python
# Increase file_guess bonus when body is obviously wrong
if not body_name[1]:  # Missing last name
    file_score += 20
```

---

## 5. Monitoring Production

### Daily Error Check
```powershell
# Set up scheduled task (Windows) or cron (Linux)
python log_analyzer.py errors prod | Out-File daily_errors.txt

# Or email errors
python log_analyzer.py errors prod | mail -s "Parser Errors" admin@company.com
```

### Weekly Statistics
```powershell
python log_analyzer.py stats prod > weekly_stats.txt
```

### Cleanup Old Logs (Monthly)
```powershell
# Delete logs older than 30 days
python log_analyzer.py cleanup 30
```

---

## 6. Disk Space Usage

Current setup per environment:

| Environment | Compression | Total Max Size |
|-------------|-------------|----------------|
| **dev** | OFF | ~80 MB |
| **uat** | ON | ~8 MB (compressed) |
| **prod** | ON | ~8 MB (compressed) |

**Total across all 3 environments: ~96 MB**

---

## 7. Advanced: Grep/Search Patterns

```powershell
# Find all name extraction failures
Select-String "NAME-FINAL.*first=''\s+last=''" logs/parser_debug_*.log

# Count how many times "title=None"
(Select-String "PARSED.*title=None" logs/parser_debug_dev.log).Count

# Export all parsed candidates to CSV
Select-String "PARSED" logs/parser_debug_dev.log | 
  ForEach-Object { $_.Line } | 
  Out-File parsed_candidates.txt
```

---

## 8. When Logs Grow Too Large

If you're processing 1000+ resumes/day:

1. **Increase rotation size** (edit parser.py):
```python
maxBytes=50 * 1024 * 1024,  # 50 MB instead of 10 MB
backupCount=10,              # 10 backups instead of 5
```

2. **Use WARNING level in prod**:
```bash
PARSER_LOG_LEVEL=WARNING  # Only errors + warnings
```

3. **Aggressive cleanup**:
```powershell
# Delete logs older than 7 days
python log_analyzer.py cleanup 7
```

4. **Ship to centralized logging** (optional):
   - Elasticsearch (ELK stack)
   - Splunk
   - AWS CloudWatch
   - Azure Monitor

---

## 9. Viewing Compressed Logs

```powershell
# Decompress for viewing
python log_analyzer.py decompress parser_debug_prod.log.1.gz

# Then view
Get-Content logs/parser_debug_prod.log.1
```

---

## 10. Common Issues

### "No log files created"
```powershell
# Check directory exists
Test-Path Backend/logs  # Should return True

# Create manually if needed
New-Item -ItemType Directory -Path Backend/logs -Force
```

### "Logs not rotating"
```powershell
# Check current file size
(Get-Item logs/parser_debug_dev.log).Length / 1MB
# Should rotate at 10 MB
```

### "Can't see DEBUG messages"
```powershell
# Check environment variable
$env:PARSER_LOG_LEVEL
# Should be "DEBUG" for full visibility

# Set it
$env:PARSER_LOG_LEVEL="DEBUG"
```

---

## Summary

**What you have now:**
- ✅ Production-ready logging (compressed, rotated, environment-aware)
- ✅ Separate error logs for quick troubleshooting
- ✅ Log analyzer utility for common tasks
- ✅ Full documentation (LOGGING_README.md)

**Next steps:**
1. Run a test parse: `python parser.py`
2. Check logs: `Get-Content logs/parser_debug_dev.log -Tail 50`
3. Try analyzer: `python log_analyzer.py stats`
4. Read full docs: `LOGGING_README.md`

**For production:**
1. Set `DEPLOY_ENV=prod` in .env
2. Set `PARSER_LOG_LEVEL=WARNING`
3. Monitor daily: `python log_analyzer.py errors prod`
