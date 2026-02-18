from google.oauth2 import service_account
from googleapiclient.discovery import build

SERVICE_ACCOUNT_FILE = "drive_service_account.json"
SCOPES = ["https://www.googleapis.com/auth/drive"]

credentials = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)

drive_service = build("drive", "v3", credentials=credentials)

# List first 10 files
results = drive_service.files().list(
    pageSize=10,
    fields="files(id, name)"
).execute()

files = results.get("files", [])

print("📂 Files in Drive:")
for file in files:
    print(file["name"], file["id"])
