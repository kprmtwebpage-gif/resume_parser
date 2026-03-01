# Resume Parser Logging Guide

## Overview

The parser uses a production-ready logging system with:
- **Environment-aware configuration** (dev/uat/prod)
- **Automatic log rotation** with compression (saves 5-10× disk space)
- **Separate error logs** for quick troubleshooting
- **Structured log messages** for easy searching

---

## Log Files

All logs are stored in `Backend/logs/`:

| File | Purpose | Max Size | Backups | Compression |
|------|---------|----------|---------|-------------|
| `parser_debug_{env}.log` | Main log (all levels) | 10 MB | 5 | uat/prod only |
| `parser_errors_{env}.log` | Errors/warnings only | 5 MB | 3 | uat/prod only |
| `*.log.1.gz` | Compressed backups | ~1 MB | auto | always |

**Total disk usage:** ~60 MB per environment (compressed)

---

## Environment Variables

### `DEPLOY_ENV`
Sets the environment and determines log file names.

```bash
# Dev (local development)
DEPLOY_ENV=dev

# UAT (testing environment)
DEPLOY_ENV=uat

# Production
DEPLOY_ENV=prod
```

### `PARSER_LOG_LEVEL`
Controls logging verbosity. Defaults:
- **dev:** `DEBUG` (everything)
- **uat:** `INFO` (reasonable detail)
- **prod:** `WARNING` (errors + warnings only)

```bash
# Override default (e.g., enable debug in prod for troubleshooting)
PARSER_LOG_LEVEL=DEBUG

# Silence everything except errors
PARSER_LOG_LEVEL=ERROR
```

### `PARSER_LOG_COMPRESS`
Enable/disable compression of rotated logs. Defaults:
- **dev:** `0` (off - faster local development)
- **uat/prod:** `1` (on - saves disk space)

```bash
# Force compression in dev
PARSER_LOG_COMPRESS=1

# Disable compression in prod (not recommended)
PARSER_LOG_COMPRESS=0
```

---

## Log Message Format

### Startup
```
2026-03-01 10:15:30 [INFO   ] Logger initialized  env=dev  level=DEBUG  compress=False  dir=C:\...\Backend\logs
2026-03-01 10:15:32 [INFO   ] === Parse run started  dir=C:\...\resumes_cache  env=dev ===
```

### Per-Candidate Parsing (DEBUG level)
```
2026-03-01 10:15:35 [DEBUG  ] NAME-RAW  [Resume_John_Doe.pdf] body=('John', 'Doe')  file=('John', 'Doe')  email=('john', 'doe')  picked=('John', 'Doe')
2026-03-01 10:15:35 [DEBUG  ] NAME-FINAL[Resume_John_Doe.pdf] first='John'  last='Doe'  (after roleish/garbled/fallback filtering)
```

### Per-Candidate Results (INFO level)
```
2026-03-01 10:15:36 [INFO   ] PARSED [Resume_John_Doe.pdf] name=(John, Doe) title=Software Engineer email=john@example.com edu=Master of Science in Computer Science certs=AWS Certified Solutions Architect
```

### Detailed Fields (DEBUG level)
```
2026-03-01 10:15:36 [DEBUG  ] DETAIL [Resume_John_Doe.pdf] phone=+1-555-0100 addr=San Francisco, CA visa=None/None linkedin=linkedin.com/in/johndoe exp=5
```

### Database Commit (DEBUG level)
```
2026-03-01 10:15:36 [DEBUG  ] DB-COMMIT [Resume_John_Doe.pdf] candidate_id=1234
```

### Errors/Skips (WARNING level)
```
2026-03-01 10:15:40 [WARNING] SKIPPED [Corrupted_Resume.pdf] reason=TimeoutError timeout=True
```

### Run Summary (INFO level)
```
2026-03-01 10:20:00 [INFO   ] === Parse run finished  processed=150  skipped=3 ===
```

---

## Common Troubleshooting Scenarios

### 1. Find Why a Specific Resume Failed
```bash
# Search all logs for that file
python log_analyzer.py search "Resume_Problem.pdf"

# Output shows full decision chain:
# NAME-RAW: body=('Blobs', '')  file=('John', 'Smith')  picked=('Blobs', '')
# NAME-FINAL: first='Blobs' last=''
# PARSED: name=(Blobs, '') title=None email=None
```

**Diagnosis:** Body extraction failed → file guess should have won but didn't.

### 2. Check Recent Errors
```bash
# Show last 50 errors across all environments
python log_analyzer.py errors

# Show errors from production only
python log_analyzer.py errors prod
```

### 3. Find All Candidates with Missing Data
```bash
# Missing names
python log_analyzer.py filter "name=('', '')"

# Missing titles
python log_analyzer.py filter "title=None"

# Missing emails
python log_analyzer.py filter "email=None"
```

### 4. Check Parsing Statistics
```bash
python log_analyzer.py stats

# Output:
# Parsing Statistics (parser_debug_dev.log):
#   Total parsed:     150
#   Total skipped:    3
#   Name issues:      5 (3.3%)
#   Title issues:     8 (5.3%)
#   Email issues:     12 (8.0%)
```

### 5. View Recent Successful Parses
```bash
# Last 50 candidates
python log_analyzer.py recent 50

# Last 100 candidates from UAT
python log_analyzer.py recent 100 uat
```

### 6. Direct Log File Viewing
```bash
# View main log (uncompressed)
tail -f Backend/logs/parser_debug_dev.log

# View errors only (uncompressed)
tail -f Backend/logs/parser_errors_dev.log

# Decompress and view old logs
python log_analyzer.py decompress parser_debug_prod.log.1.gz
cat Backend/logs/parser_debug_prod.log.1
```

### 7. Grep/Search Patterns
```bash
# All name extraction issues on Windows
Select-String "NAME-RAW.*body=\('', ''\)" Backend/logs/parser_debug_dev.log

# On Linux/Mac
grep -E "NAME-RAW.*body=\('', ''\)" Backend/logs/parser_debug_dev.log

# Find candidates with "Blobs" name issue
grep "Blobs" Backend/logs/parser_debug_dev.log | grep PARSED
```

---

## Disk Space Management

### Current Setup (per environment)
- Main log: 10 MB × 6 (1 active + 5 backups) = **60 MB max**
- Error log: 5 MB × 4 (1 active + 3 backups) = **20 MB max**
- **Total: ~80 MB per environment** (compressed saves 5-10×)

### Cleanup Old Logs
```bash
# Delete logs older than 30 days
python log_analyzer.py cleanup 30

# Delete logs older than 7 days (aggressive)
python log_analyzer.py cleanup 7
```

### Manual Cleanup
```powershell
# Windows: Delete all .gz archives older than 30 days
$cutoff = (Get-Date).AddDays(-30)
Get-ChildItem Backend\logs\*.gz | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item

# Linux/Mac
find Backend/logs -name "*.gz" -mtime +30 -delete
```

---

## Production Best Practices

### 1. Set Correct Environment
```bash
# In .env file or system environment
DEPLOY_ENV=prod
PARSER_LOG_LEVEL=WARNING
PARSER_LOG_COMPRESS=1
```

### 2. Monitor Error Logs Daily
```bash
# Set up daily cron job to email errors
0 9 * * * python /path/to/Backend/log_analyzer.py errors prod | mail -s "Parser Errors" admin@company.com
```

### 3. Rotate Logs More Aggressively (High Volume)
If processing 1000+ resumes/day, edit `parser.py`:
```python
# Increase max size and backup count
maxBytes=50 * 1024 * 1024,  # 50 MB
backupCount=10,              # 10 backups
```

### 4. Centralized Logging (Optional)
For multi-server deployments, ship logs to:
- **Elasticsearch** (ELK stack)
- **Splunk**
- **AWS CloudWatch**
- **Azure Monitor**
- **Google Cloud Logging**

Example: Forward to CloudWatch
```python
# Add to parser.py after existing handlers
import watchtower
cloudwatch_handler = watchtower.CloudWatchLogHandler(
    log_group="resume-parser",
    stream_name=f"{_deploy_env}-{os.getpid()}"
)
_log.addHandler(cloudwatch_handler)
```

### 5. Alert on Critical Errors
```bash
# Add to log_analyzer.py or separate monitoring script
if error_count > 10:
    send_slack_alert("Parser errors exceeded threshold")
```

---

## Development Tips

### Enable Verbose Logging Temporarily
```bash
# In terminal (Windows)
$env:PARSER_LOG_LEVEL="DEBUG"
python parser.py

# In terminal (Linux/Mac)
PARSER_LOG_LEVEL=DEBUG python parser.py
```

### Watch Logs in Real-Time
```powershell
# Windows PowerShell
Get-Content Backend\logs\parser_debug_dev.log -Wait

# Or use log_analyzer filter
python log_analyzer.py filter "PARSED" | Select-Object -Last 50
```

### Extract Data for Analysis
```bash
# Export all parsed names to CSV
grep "PARSED" Backend/logs/parser_debug_dev.log | \
  sed -E 's/.*name=\(([^)]+)\).*/\1/' > parsed_names.csv

# Count most common issues
grep "NAME-RAW" Backend/logs/parser_debug_dev.log | \
  grep "body=('', '')" | wc -l
```

---

## Log Analyzer Quick Reference

```bash
# Show help
python log_analyzer.py

# Common commands
python log_analyzer.py errors              # Recent errors
python log_analyzer.py stats               # Parsing statistics
python log_analyzer.py recent 100          # Last 100 candidates
python log_analyzer.py search "Resume.pdf" # Find specific file
python log_analyzer.py filter "title=None" # Find issues
python log_analyzer.py cleanup 30          # Delete old logs
python log_analyzer.py decompress file.gz  # Decompress archive
```

---

## Troubleshooting the Logger Itself

### Logs Not Being Created
```python
# Check if logs directory exists
import pathlib
log_dir = pathlib.Path("Backend/logs")
print(log_dir.exists())  # Should be True

# Check permissions
log_dir.mkdir(exist_ok=True, mode=0o755)
```

### Logs Not Rotating
```python
# Check file size
import os
size_mb = os.path.getsize("Backend/logs/parser_debug_dev.log") / (1024*1024)
print(f"Current size: {size_mb:.2f} MB")  # Should rotate at 10 MB
```

### Compression Not Working
```bash
# Verify gzip module available
python -c "import gzip; print('OK')"

# Check if .gz files exist
ls Backend/logs/*.gz
```

### Wrong Log Level
```bash
# Check current environment settings
python -c "import os; print('ENV:', os.getenv('DEPLOY_ENV', 'dev')); print('LEVEL:', os.getenv('PARSER_LOG_LEVEL', 'auto'))"
```

---

## Questions?

For issues or enhancements, check:
1. This README
2. `log_analyzer.py` source code
3. `parser.py` logging setup (lines 1-120)
