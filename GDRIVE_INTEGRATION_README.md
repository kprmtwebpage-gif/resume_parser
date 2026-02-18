# Google Drive Integration - Setup Guide

## Overview
The Google Drive integration allows your resume parser to automatically sync and process resumes from a Google Drive folder. This is useful for:
- Centralized resume storage
- Automatic updates when new resumes are added
- Team collaboration with shared folders
- Remote access to resume files

## Features
✅ **Service Account Support** - Non-interactive, automated syncing  
✅ **Smart Caching** - Only downloads new or modified files  
✅ **Shared Drive Support** - Works with team/shared drives  
✅ **API Endpoints** - Trigger sync operations via HTTP  
✅ **Simple Integration** - Works with existing parser code

---

## Setup Instructions

### 1. Google Cloud Setup

#### Option A: Service Account (Recommended for Automation)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Drive API:
   - Navigate to **APIs & Services** > **Library**
   - Search for "Google Drive API"
   - Click **Enable**
4. Create Service Account:
   - Go to **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **Service Account**
   - Give it a name (e.g., "Resume Parser")
   - Click **Create and Continue**
   - Skip optional steps and click **Done**
5. Create Key:
   - Click on your new service account
   - Go to **Keys** tab
   - Click **Add Key** > **Create new key**
   - Choose **JSON** format
   - Download the key file
6. Rename downloaded file to `drive_service_account.json`
7. **Share your Google Drive folder** with the service account email (found in the JSON file, looks like `name@project.iam.gserviceaccount.com`)
   - Give it at least **Viewer** permission

#### Option B: OAuth User Credentials (Interactive)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Download credentials as JSON
4. First run will open browser for authentication
5. Token cached for subsequent runs

---

### 2. Configuration

The integration is already configured! Here's what was set up:

#### Files Updated:
- ✅ `Backend/google_drive_sync.py` - Updated with service account support
- ✅ `Backend/drive_service_account.json` - Credentials file copied
- ✅ `Backend/.env` - Google Drive configuration enabled

#### Environment Variables (Backend/.env):
```env
# Google Drive Integration
GDRIVE_FOLDER_ID=1ov-R7c-LShP2ueXKKPckSTuoqy_35Y2e
GDRIVE_CREDENTIALS_JSON=drive_service_account.json
GDRIVE_TOKEN_JSON=.gdrive_token.json
GDRIVE_DOWNLOAD_DIR=resumes_cache
```

**To use your own Google Drive folder:**
1. Open your Google Drive folder in browser
2. Copy the folder ID from URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
3. Update `GDRIVE_FOLDER_ID` in `Backend/.env`

---

### 3. Usage Options

#### Option 1: Manual Parser Mode
Run the parser with Google Drive as the input source:

```powershell
cd Backend
$env:RESUME_INPUT_MODE="gdrive"
python parser.py
```

This will:
1. Sync files from Google Drive
2. Parse all new/updated resumes
3. Store results in database

#### Option 2: API Endpoints
The following API endpoints are now available at `http://localhost:8000`:

##### Check Configuration
```http
GET /gdrive/status
```
Returns Google Drive configuration status.

##### Sync Files Only
```http
POST /gdrive/sync
```
Downloads new/updated files from Google Drive.

##### Sync + Parse
```http
POST /gdrive/sync-and-parse
```
Downloads files and automatically parses them.

**Example using curl:**
```bash
# Check status
curl http://localhost:8000/gdrive/status

# Sync and parse
curl -X POST http://localhost:8000/gdrive/sync-and-parse
```

**Example using PowerShell:**
```powershell
# Check status
Invoke-RestMethod -Uri "http://localhost:8000/gdrive/status"

# Sync and parse
Invoke-RestMethod -Uri "http://localhost:8000/gdrive/sync-and-parse" -Method Post
```

#### Option 3: Auto-Watcher (Continuous Monitoring)
Run the auto-watcher to continuously check for new files:

```powershell
cd Gdrive-Integration
python auto_watch_gdrive.py
```

This checks for new files every 5 minutes (configurable).

---

## File Structure

```
Backend/
├── google_drive_sync.py          # Core sync module (UPDATED ✅)
├── drive_service_account.json    # Your credentials (ADDED ✅)
├── .env                          # Configuration (UPDATED ✅)
├── api_server.py                 # API with /gdrive/* endpoints (UPDATED ✅)
├── parser.py                     # Resume parser
└── resumes_cache/                # Downloaded files (auto-created)

Gdrive-Integration/
├── auto_watch_gdrive.py          # Auto-watcher script
├── drive_watcher.py              # Watcher helper
├── GDRIVE_INTEGRATION_GUIDE.txt  # Original guide
└── requirements_gdrive.txt       # Dependencies
```

---

## Dependencies

All Google Drive dependencies are already in `Backend/requirements.txt`:

```txt
google-api-python-client>=2.120
google-auth>=2.25
google-auth-oauthlib>=1.2
```

If you need to install separately:
```bash
pip install google-api-python-client google-auth google-auth-oauthlib
```

---

## Troubleshooting

### 1. Authentication Errors
**Error:** "Missing GDRIVE_FOLDER_ID" or "Credentials file not found"
- **Solution:** Check that `Backend/.env` has correct folder ID and credentials file exists

### 2. Permission Denied
**Error:** "Insufficient permissions" or "File not found"
- **Solution:** Make sure you've shared the Drive folder with the service account email
- Check that service account has at least **Viewer** permission

### 3. No Files Downloaded
**Problem:** API returns `downloaded: 0` even though folder has files
- **Check:** File extensions - only `.pdf` and `.docx` are synced by default
- **Check:** Files might already be downloaded (sync only gets new/modified files)
- **Solution:** Delete `Backend/resumes_cache/` folder to force re-download

### 4. Service Account Email Location
**Question:** Where do I find the service account email?
- **Answer:** Open `Backend/drive_service_account.json` and look for `"client_email"` field

---

## Testing the Integration

### Quick Test:
```powershell
# 1. Start the API server
cd Backend
python api_server.py

# 2. In another terminal, test the integration
curl http://localhost:8000/gdrive/status
curl -X POST http://localhost:8000/gdrive/sync
```

### Expected Output:
```json
{
  "success": true,
  "scanned": 15,
  "downloaded": 3,
  "download_directory": "C:\\...\\Backend\\resumes_cache",
  "message": "Scanned 15 files, downloaded 3 new/updated files"
}
```

---

## Advanced Configuration

### Custom Sync Intervals
Edit `Gdrive-Integration/auto_watch_gdrive.py`:
```python
# Change from 300 seconds (5 min) to 600 seconds (10 min)
watch_and_process(interval_seconds=600)
```

Or set environment variable:
```powershell
$env:WATCH_INTERVAL_SECONDS=600
python auto_watch_gdrive.py
```

### Filter Files
Edit `Backend/.env`:
```env
# Only sync PDFs
GDRIVE_QUERY_EXTRA=mimeType='application/pdf'

# Exclude files with "draft" in name
GDRIVE_QUERY_EXTRA=not name contains 'draft'
```

### Page Size (API Performance)
```env
# Increase for large folders (default: 200)
GDRIVE_PAGE_SIZE=500
```

---

## API Documentation

Once the server is running, view complete API docs at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## Security Notes

⚠️ **Important:**
- Never commit `drive_service_account.json` to git
- The file is already in `.gitignore`
- Keep credentials secure and rotate periodically
- Use least-privilege permissions (Viewer is sufficient)

---

## Next Steps

1. ✅ Copy your service account JSON to `Backend/drive_service_account.json`
2. ✅ Share your Google Drive folder with the service account email
3. ✅ Update `GDRIVE_FOLDER_ID` in `Backend/.env`
4. ✅ Test with `curl http://localhost:8000/gdrive/status`
5. ✅ Run sync: `curl -X POST http://localhost:8000/gdrive/sync-and-parse`

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review `Gdrive-Integration/GDRIVE_INTEGRATION_GUIDE.txt`
3. Verify Google Drive API is enabled in Cloud Console
4. Check service account has folder access

---

## Summary of Changes

✅ **Backend/google_drive_sync.py**
   - Added service account authentication support
   - Falls back to OAuth if service account not available

✅ **Backend/.env**
   - Enabled Google Drive configuration
   - Added GDRIVE_* environment variables

✅ **Backend/api_server.py**
   - Added `/gdrive/status` endpoint
   - Added `/gdrive/sync` endpoint  
   - Added `/gdrive/sync-and-parse` endpoint

✅ **Backend/drive_service_account.json** (if file exists)
   - Copied from Gdrive-Integration folder
   - Ready for your credentials

---

**Integration Complete! 🎉**

You can now sync resumes from Google Drive automatically!
