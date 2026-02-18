"""
Script to update LinkedIn profile picture URLs for candidates
You can manually add LinkedIn profile picture URLs to the database using this script.

To get LinkedIn profile pictures:
1. Visit the candidate's LinkedIn profile
2. Right-click their profile picture and select "Copy image address"
3. Use that URL in this script

Example usage:
    python update_linkedin_photos.py --id 1 --url "https://media.licdn.com/dms/image/..."
"""

import argparse
import os
import psycopg2
from dotenv import load_dotenv


def main():
    load_dotenv()
    
    parser = argparse.ArgumentParser(description="Update LinkedIn profile picture URLs")
    parser.add_argument("--id", type=int, required=True, help="Candidate ID")
    parser.add_argument("--url", type=str, required=True, help="Profile picture URL")
    args = parser.parse_args()
    
    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
    )
    
    with conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE candidate_profile SET profile_picture_url = %s WHERE id = %s",
                (args.url, args.id)
            )
            print(f"✅ Updated profile picture URL for candidate ID {args.id}")
    
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
