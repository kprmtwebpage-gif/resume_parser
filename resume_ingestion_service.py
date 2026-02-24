"""
Resume Ingestion Service - Module 1
====================================
Standalone service that:
1. Syncs resumes from Google Drive
2. Parses PDF/DOCX files
3. Extracts structured data
4. Loads into PostgreSQL database

Can run as:
- One-time sync: python resume_ingestion_service.py --once
- Continuous watcher: python resume_ingestion_service.py --watch
- Scheduled job: python resume_ingestion_service.py --once (via cron/scheduler)

Docker-ready: All dependencies included, uses environment variables
"""

import os
import sys
import time
import argparse
from datetime import datetime
from pathlib import Path

# Add Backend to path for imports
BACKEND_DIR = Path(__file__).parent / "Backend"
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv()


def sync_and_parse():
    """Main ingestion logic: Sync from GDrive → Parse → Load to DB"""
    try:
        from google_drive_sync import sync_drive_folder
        from parser import main as parse_main
        
        folder_id = os.getenv("GDRIVE_FOLDER_ID", "").strip()
        creds_json = Path(os.getenv("GDRIVE_CREDENTIALS_JSON", "drive_service_account.json"))
        token_json = Path(os.getenv("GDRIVE_TOKEN_JSON", ".gdrive_token.json"))
        download_dir = Path(os.getenv("GDRIVE_DOWNLOAD_DIR", "resumes_cache"))
        
        # Make paths absolute relative to Backend directory
        if not creds_json.is_absolute():
            creds_json = BACKEND_DIR / creds_json
        if not token_json.is_absolute():
            token_json = BACKEND_DIR / token_json
        if not download_dir.is_absolute():
            download_dir = BACKEND_DIR / download_dir
        
        if not folder_id:
            print("❌ GDRIVE_FOLDER_ID not configured in .env")
            return False
        
        if not creds_json.exists():
            print(f"❌ Credentials file not found: {creds_json}")
            return False
        
        # Step 1: Sync from Google Drive
        print(f"🔄 Syncing from Google Drive (folder: {folder_id})...")
        scanned, downloaded = sync_drive_folder(
            folder_id=folder_id,
            download_dir=download_dir,
            credentials_json=creds_json,
            token_json=token_json
        )
        print(f"✅ Google Drive sync complete: scanned={scanned}, downloaded={downloaded}")
        
        # Step 2: Parse resumes and load to database
        if downloaded > 0 or scanned > 0:
            print(f"📄 Parsing resumes and loading to database...")
            result = parse_main()
            
            if result == 0:
                print(f"✅ Successfully parsed and loaded resumes to database")
                # Step 3: Apply all manual corrections (names + job titles)
                # keyed by resume_filename so they work on any environment
                try:
                    from post_parse_fixes import apply_fixes
                    apply_fixes()
                except Exception as _fix_err:
                    print(f"⚠️  post_parse_fixes failed (non-fatal): {_fix_err}")
                return True
            else:
                print(f"⚠️  Parser returned status code: {result}")
                return False
        else:
            print(f"ℹ️  No new resumes to process")
            return True
            
    except Exception as e:
        print(f"❌ Error during ingestion: {e}")
        import traceback
        traceback.print_exc()
        return False


def run_once():
    """Run ingestion once and exit"""
    print("="*80)
    print("RESUME INGESTION SERVICE - ONE-TIME RUN")
    print("="*80)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    success = sync_and_parse()
    
    print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    return 0 if success else 1


def run_watcher(interval_seconds=300):
    """Run continuous watcher that syncs at regular intervals"""
    print("="*80)
    print("RESUME INGESTION SERVICE - CONTINUOUS WATCHER")
    print("="*80)
    print(f"📂 Checking for new resumes every {interval_seconds} seconds ({interval_seconds/60:.1f} minutes)")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("Press Ctrl+C to stop\n")
    
    run_count = 0
    
    try:
        while True:
            run_count += 1
            print(f"\n{'='*80}")
            print(f"🔄 Check #{run_count} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print('='*80)
            
            success = sync_and_parse()
            
            if success:
                print(f"✅ Sync cycle completed successfully")
            else:
                print(f"⚠️  Sync cycle completed with errors")
            
            # Wait before next check
            print(f"\n⏳ Waiting {interval_seconds} seconds until next check...")
            next_time = time.time() + interval_seconds
            print(f"   Next check at: {datetime.fromtimestamp(next_time).strftime('%Y-%m-%d %H:%M:%S')}")
            time.sleep(interval_seconds)
            
    except KeyboardInterrupt:
        print(f"\n\n🛑 Watcher stopped by user")
        print(f"📊 Total checks performed: {run_count}")
        print(f"⏰ Stopped at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        return 0


def main():
    """Main entry point with command-line argument parsing"""
    parser = argparse.ArgumentParser(
        description="Resume Ingestion Service - Syncs resumes from Google Drive and loads to database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run once (for scheduled jobs)
  python resume_ingestion_service.py --once
  
  # Run continuous watcher (check every 5 minutes)
  python resume_ingestion_service.py --watch
  
  # Run continuous watcher (custom interval)
  python resume_ingestion_service.py --watch --interval 600
  
Environment Variables Required:
  GDRIVE_FOLDER_ID          - Google Drive folder ID
  GDRIVE_CREDENTIALS_JSON   - Path to service account credentials
  DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT - Database connection
        """
    )
    
    parser.add_argument(
        "--once", 
        action="store_true", 
        help="Run once and exit (for scheduled jobs)"
    )
    parser.add_argument(
        "--watch", 
        action="store_true", 
        help="Run continuously, checking at regular intervals"
    )
    parser.add_argument(
        "--interval", 
        type=int, 
        default=300,
        help="Interval in seconds between checks when using --watch (default: 300 = 5 minutes)"
    )
    
    args = parser.parse_args()
    
    # Validate environment
    required_vars = ["DB_NAME", "DB_USER", "DB_PASSWORD", "DB_HOST", "DB_PORT", "GDRIVE_FOLDER_ID"]
    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        print(f"❌ Missing required environment variables: {', '.join(missing)}")
        print(f"   Please set them in Backend/.env file or environment")
        return 1
    
    # Run in selected mode
    if args.once:
        return run_once()
    elif args.watch:
        return run_watcher(args.interval)
    else:
        # Default: run once if no arguments
        print("ℹ️  No mode specified. Use --once or --watch")
        print("   Running in one-time mode by default...\n")
        return run_once()


if __name__ == "__main__":
    sys.exit(main())
