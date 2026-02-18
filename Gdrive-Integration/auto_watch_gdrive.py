"""Automatic Google Drive watcher - continuously monitors and processes new resumes"""
import time
import os
import sys
from pathlib import Path
from datetime import datetime

# Add Backend directory to Python path
backend_dir = Path(__file__).parent.parent / "Backend"
sys.path.insert(0, str(backend_dir))

def watch_and_process(interval_seconds=300):
    """
    Continuously watch Google Drive for new resumes and process them.
    
    Args:
        interval_seconds: How often to check for new files (default: 300 = 5 minutes)
    """
    print(f"🔍 Starting Google Drive watcher...")
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
            
            # Run the parser (which includes sync)
            try:
                from parser import main
                result = main()
                
                if result == 0:
                    print(f"✅ Sync and processing completed successfully")
                else:
                    print(f"⚠️  Parser returned status code: {result}")
                    
            except Exception as e:
                print(f"❌ Error during processing: {e}")
                import traceback
                traceback.print_exc()
            
            # Wait before next check
            print(f"\n⏳ Waiting {interval_seconds} seconds until next check...")
            print(f"   Next check at: {datetime.fromtimestamp(time.time() + interval_seconds).strftime('%Y-%m-%d %H:%M:%S')}")
            time.sleep(interval_seconds)
            
    except KeyboardInterrupt:
        print(f"\n\n🛑 Watcher stopped by user")
        print(f"📊 Total checks performed: {run_count}")
        print(f"⏰ Stopped at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        sys.exit(0)


if __name__ == "__main__":
    # You can change the interval here (in seconds)
    # 300 = 5 minutes
    # 600 = 10 minutes  
    # 1800 = 30 minutes
    # 3600 = 1 hour
    
    interval = int(os.getenv("WATCH_INTERVAL_SECONDS", "300"))
    
    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║                      Google Drive Resume Auto-Watcher                         ║
╚══════════════════════════════════════════════════════════════════════════════╝
    
This script will automatically:
  • Monitor your Google Drive folder for new resumes
  • Download only new or changed files
  • Parse and store them in the database
  • Repeat every {interval} seconds
  
To customize the check interval, set environment variable:
  WATCH_INTERVAL_SECONDS=600  (for 10 minutes)
  
""".format(interval=interval))
    
    watch_and_process(interval_seconds=interval)
