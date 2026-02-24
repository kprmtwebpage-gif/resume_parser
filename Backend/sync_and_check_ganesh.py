import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv; load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
from google_drive_sync import sync_drive_folder
from pathlib import Path
import pdfplumber, glob

# Sync from GDrive
scanned, downloaded = sync_drive_folder(
    folder_id=os.getenv('GDRIVE_FOLDER_ID'),
    download_dir=Path('resumes_cache'),
    credentials_json=Path('drive_service_account.json'),
    token_json=Path('.gdrive_token.json')
)
print(f'GDrive sync: scanned={scanned}  downloaded={downloaded}')

# Check the Ganesh file
files = sorted(glob.glob('resumes_cache/*anesh*') + glob.glob('resumes_cache/*ANESH*'))
if not files:
    print("No Ganesh file found in resumes_cache!")
else:
    for f in files:
        try:
            size = os.path.getsize(f)
            with pdfplumber.open(f) as pdf:
                pg_count = len(pdf.pages)
                t = pdf.pages[0].extract_text() if pg_count > 0 else ''
            print(f"\nFile  : {f}")
            print(f"Size  : {size} bytes")
            print(f"Pages : {pg_count}")
            print(f"Chars : {len(t or '')}")
            print(f"Preview: {repr((t or '')[:120])}")
        except Exception as e:
            print(f"{f} -> ERROR: {e}")
