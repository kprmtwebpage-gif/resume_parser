from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from dotenv import load_dotenv
import os
import io

# ✅ Explicitly load .env from current folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

SERVICE_ACCOUNT_FILE = os.path.join(BASE_DIR, "drive_service_account.json")
FOLDER_ID = os.getenv("GDRIVE_FOLDER_ID")
SCOPES = ["https://www.googleapis.com/auth/drive"]

if not FOLDER_ID:
    raise Exception("❌ GDRIVE_FOLDER_ID missing in .env")

print("✅ Using Drive Folder ID:", FOLDER_ID)

# Authenticate
credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE,
    scopes=SCOPES
)

drive_service = build("drive", "v3", credentials=credentials)

# Download directory
DOWNLOAD_DIR = os.path.join(BASE_DIR, "downloaded_resumes")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# Fetch files
query = f"'{FOLDER_ID}' in parents and trashed=false"
results = drive_service.files().list(
    q=query,
    fields="files(id, name, mimeType)"
).execute()

files = results.get("files", [])

if not files:
    print("⚠ No files found in Drive folder")
    exit(0)

print(f"📂 Found {len(files)} files")

for file in files:
    name = file["name"]
    file_id = file["id"]

    if not name.lower().endswith((".pdf", ".doc", ".docx")):
        print(f"⏭ Skipping unsupported file: {name}")
        continue

    print(f"⬇ Downloading: {name}")

    request = drive_service.files().get_media(fileId=file_id)
    file_path = os.path.join(DOWNLOAD_DIR, name)

    with io.FileIO(file_path, "wb") as fh:
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()

    print(f"🧠 Downloaded → {file_path}")

    # Call parser
    from parser import parse_resume_and_store_db
    parse_resume_and_store_db(file_path)

print("🎉 Drive sync + parsing completed")

