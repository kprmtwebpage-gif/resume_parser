"""
Standalone Google Drive Integration Example
============================================

This shows how to integrate ONLY the Google Drive sync functionality
into your own resume parser module.

Copy this pattern into your updated resume parser.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Import the Google Drive sync function (standalone module)
from google_drive_sync import sync_drive_folder


def your_parse_resume_function(resume_path: Path):
    """
    Replace this with YOUR actual resume parsing logic.
    
    This is where you would:
    - Extract text from PDF/DOCX
    - Parse name, email, phone, skills, experience, etc.
    - Store in YOUR database
    - Return parsed data
    """
    print(f"  📄 Parsing: {resume_path.name}")
    
    # YOUR PARSING CODE HERE
    # Example:
    # data = extract_resume_data(resume_path)
    # store_in_database(data)
    
    print(f"  ✅ Completed: {resume_path.name}")
    return True


def main():
    """Main function - integrates Google Drive sync with your parser"""
    
    # Load environment variables (or use your own config system)
    load_dotenv()
    
    print("=" * 80)
    print("RESUME PARSER WITH GOOGLE DRIVE SYNC")
    print("=" * 80)
    
    # ========================================================================
    # STEP 1: Configure Google Drive Sync
    # ========================================================================
    
    folder_id = os.getenv("GDRIVE_FOLDER_ID", "").strip()
    creds_json = Path(os.getenv("GDRIVE_CREDENTIALS_JSON", "drive_service_account.json"))
    token_json = Path(os.getenv("GDRIVE_TOKEN_JSON", ".gdrive_token.json"))
    cache_dir = Path(os.getenv("GDRIVE_DOWNLOAD_DIR", "resumes_cache"))
    
    # Validation
    if not folder_id:
        print("❌ Error: GDRIVE_FOLDER_ID not set in environment")
        print("   Set it in .env file or as environment variable")
        return 1
    
    if not creds_json.exists():
        print(f"❌ Error: Credentials file not found: {creds_json}")
        print("   Make sure your Google Drive credentials JSON exists")
        return 1
    
    print(f"\n📂 Google Drive Folder ID: {folder_id}")
    print(f"🔑 Credentials: {creds_json}")
    print(f"💾 Local cache: {cache_dir}")
    
    # ========================================================================
    # STEP 2: Sync from Google Drive
    # ========================================================================
    
    print(f"\n{'='*80}")
    print("SYNCING FROM GOOGLE DRIVE")
    print('='*80)
    
    try:
        scanned, downloaded = sync_drive_folder(
            folder_id=folder_id,
            download_dir=cache_dir,
            credentials_json=creds_json,
            token_json=token_json,
            allowed_exts={".pdf", ".docx"}  # Only PDF and DOCX files
        )
        
        print(f"✅ Sync completed:")
        print(f"   Files scanned: {scanned}")
        print(f"   Files downloaded: {downloaded}")
        
        if downloaded == 0:
            print(f"   ℹ️  No new files (all files are up to date)")
        
    except Exception as e:
        print(f"❌ Error during Google Drive sync: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # ========================================================================
    # STEP 3: Process Resume Files with YOUR Parser
    # ========================================================================
    
    print(f"\n{'='*80}")
    print("PROCESSING RESUMES")
    print('='*80)
    
    # Get all PDF and DOCX files from cache directory
    resume_files = (
        list(cache_dir.glob("*.pdf")) + 
        list(cache_dir.glob("*.docx"))
    )
    
    if not resume_files:
        print("⚠️  No resume files found in cache directory")
        return 0
    
    print(f"Found {len(resume_files)} resume(s) to process\n")
    
    # Process each resume with YOUR parsing function
    success_count = 0
    error_count = 0
    
    for idx, resume_file in enumerate(resume_files, 1):
        print(f"[{idx}/{len(resume_files)}]")
        try:
            # Call YOUR parsing function here
            result = your_parse_resume_function(resume_file)
            if result:
                success_count += 1
        except Exception as e:
            print(f"  ❌ Error: {e}")
            error_count += 1
        print()
    
    # ========================================================================
    # STEP 4: Summary
    # ========================================================================
    
    print('='*80)
    print("SUMMARY")
    print('='*80)
    print(f"✅ Successfully processed: {success_count}")
    if error_count > 0:
        print(f"❌ Errors: {error_count}")
    print()
    
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
