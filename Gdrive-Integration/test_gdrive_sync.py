"""
Test script for Google Drive sync module
=========================================

This tests ONLY the Google Drive sync functionality without any parsing.
Use this to verify the GDrive integration works before connecting your parser.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Import the standalone sync module
from google_drive_sync import sync_drive_folder

def test_sync():
    """Test the Google Drive sync functionality"""
    
    load_dotenv()
    
    print("=" * 80)
    print("TESTING GOOGLE DRIVE SYNC MODULE")
    print("=" * 80)
    
    # Configuration
    folder_id = os.getenv("GDRIVE_FOLDER_ID", "").strip()
    creds_json = Path(os.getenv("GDRIVE_CREDENTIALS_JSON", "drive_service_account.json"))
    token_json = Path(".test_token.json")
    test_dir = Path("test_gdrive_sync")
    
    print(f"\n📋 Configuration:")
    print(f"   Folder ID: {folder_id}")
    print(f"   Credentials: {creds_json}")
    print(f"   Token: {token_json}")
    print(f"   Download to: {test_dir}")
    
    # Validate
    if not folder_id:
        print("\n❌ GDRIVE_FOLDER_ID not set!")
        print("   Add it to .env file:")
        print("   GDRIVE_FOLDER_ID=your-folder-id-here")
        return False
    
    if not creds_json.exists():
        print(f"\n❌ Credentials file not found: {creds_json}")
        print("   Make sure your credentials JSON file exists")
        return False
    
    # Test sync
    print(f"\n{'='*80}")
    print("RUNNING SYNC TEST")
    print('='*80)
    
    try:
        print("Connecting to Google Drive...")
        scanned, downloaded = sync_drive_folder(
            folder_id=folder_id,
            download_dir=test_dir,
            credentials_json=creds_json,
            token_json=token_json,
            allowed_exts={".pdf", ".docx"}
        )
        
        print(f"\n✅ Sync successful!")
        print(f"   Files scanned in Drive: {scanned}")
        print(f"   Files downloaded: {downloaded}")
        
        # List downloaded files
        if test_dir.exists():
            files = list(test_dir.glob("*"))
            print(f"\n📂 Files in {test_dir}:")
            if files:
                for f in sorted(files):
                    size_kb = f.stat().st_size / 1024
                    print(f"   - {f.name} ({size_kb:.1f} KB)")
            else:
                print("   (empty)")
        
        # Test again to verify caching
        print(f"\n{'='*80}")
        print("TESTING CACHE (Running sync again)")
        print('='*80)
        print("This should download 0 files if caching works...\n")
        
        scanned2, downloaded2 = sync_drive_folder(
            folder_id=folder_id,
            download_dir=test_dir,
            credentials_json=creds_json,
            token_json=token_json,
            allowed_exts={".pdf", ".docx"}
        )
        
        print(f"\n✅ Second sync completed!")
        print(f"   Files scanned: {scanned2}")
        print(f"   Files downloaded: {downloaded2}")
        
        if downloaded2 == 0:
            print("   ✅ Caching works! No files re-downloaded.")
        else:
            print("   ⚠️  Some files were downloaded again (might be new/modified)")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Sync failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main test function"""
    
    print("\n" + "="*80)
    print("Google Drive Sync Module - Standalone Test")
    print("="*80)
    print("\nThis test will:")
    print("  1. Connect to your Google Drive")
    print("  2. Download files to test_gdrive_sync/ directory")
    print("  3. Test caching (run sync again)")
    print("  4. Verify everything works")
    print("\nMake sure you have:")
    print("  ✓ GDRIVE_FOLDER_ID set in .env")
    print("  ✓ Credentials JSON file exists")
    print("  ✓ Drive folder is shared with service account")
    print()
    
    input("Press Enter to start test...")
    
    success = test_sync()
    
    print("\n" + "="*80)
    if success:
        print("✅ TEST PASSED")
        print("\nThe Google Drive sync module is working correctly!")
        print("You can now integrate it into your resume parser.")
    else:
        print("❌ TEST FAILED")
        print("\nFix the errors above before integrating.")
    print("="*80)
    
    return 0 if success else 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
