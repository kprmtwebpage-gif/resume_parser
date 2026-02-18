"""
Automatic Google Drive Sync Service
Runs in background and continuously syncs new resumes from Google Drive
"""
import os
import sys
import time
from datetime import datetime
from pathlib import Path

# Add Backend directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

def sync_and_parse():
    """Sync from Google Drive and parse new resumes"""
    try:
        from google_drive_sync import sync_drive_folder
        from parser import main as parse_main
        
        folder_id = os.getenv("GDRIVE_FOLDER_ID", "").strip()
        creds_json = Path(os.getenv("GDRIVE_CREDENTIALS_JSON", "drive_service_account.json"))
        token_json = Path(os.getenv("GDRIVE_TOKEN_JSON", ".gdrive_token.json"))
        download_dir = Path(os.getenv("GDRIVE_DOWNLOAD_DIR", "resumes_cache"))
        
        # Make paths absolute
        backend_dir = Path(__file__).parent
        if not creds_json.is_absolute():
            creds_json = backend_dir / creds_json
        if not token_json.is_absolute():
            token_json = backend_dir / token_json
        if not download_dir.is_absolute():
            download_dir = backend_dir / download_dir
        
        if not folder_id:
            print("❌ GDRIVE_FOLDER_ID not configured")
            return False
        
        if not creds_json.exists():
            print(f"❌ Credentials file not found: {creds_json}")
            return False
        
        # Sync from Google Drive
        print(f"🔄 Syncing from Google Drive...")
        scanned, downloaded = sync_drive_folder(
            folder_id=folder_id,
            download_dir=download_dir,
            credentials_json=creds_json,
            token_json=token_json,
            allowed_exts={".pdf", ".docx"}
        )
        
        print(f"📥 Scanned: {scanned}, Downloaded: {downloaded}")
        
        if downloaded > 0:
            # Parse new resumes
            print(f"📄 Parsing {downloaded} new resume(s)...")
            os.environ["RESUME_INPUT_DIR"] = str(download_dir)
            os.environ["SKIP_EXISTING"] = "1"
            
            result = parse_main()
            if result == 0:
                print(f"✅ Successfully parsed {downloaded} resume(s)")
                return True
            else:
                print(f"⚠️  Parser returned code: {result}")
                return False
        else:
            print("✨ No new resumes to process")
            return True
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main auto-sync loop"""
    try:
        interval = int(os.getenv("GDRIVE_SYNC_INTERVAL", "300"))  # Default 5 minutes
    except:
        interval = 300
    
    print("╔══════════════════════════════════════════════════════════════════════════════╗")
    print("║              Google Drive Auto-Sync Service (Background)                     ║")
    print("╚══════════════════════════════════════════════════════════════════════════════╝")
    print()
    print(f"🔍 Monitoring Google Drive folder")
    print(f"⏰ Check interval: {interval} seconds ({interval/60:.1f} minutes)")
    print(f"📍 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    print("Press Ctrl+C to stop")
    print()
    
    run_count = 0
    
    try:
        while True:
            run_count += 1
            print(f"\n{'='*80}")
            print(f"🔄 Sync Check #{run_count} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print('='*80)
            
            sync_and_parse()
            
            print(f"\n⏳ Next sync in {interval} seconds...")
            print(f"   Next check: {datetime.fromtimestamp(time.time() + interval).strftime('%H:%M:%S')}")
            time.sleep(interval)
            
    except KeyboardInterrupt:
        print(f"\n\n🛑 Auto-sync service stopped")
        print(f"📊 Total sync checks: {run_count}")
        print(f"⏰ Stopped at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
