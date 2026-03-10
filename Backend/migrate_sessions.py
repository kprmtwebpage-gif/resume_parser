#!/usr/bin/env python3
"""
Migration: Add resume upload tracking to login_sessions table.

This script adds the resumes_uploaded_this_session column to the 
login_sessions table to track how many resumes were uploaded during each session.
"""

import psycopg2

# Database config
DB_CONFIG = {
    'dbname': 'postgres',
    'user': 'postgres',
    'password': 'admin',
    'host': 'localhost',
}


def migrate():
    """Add resumes_uploaded_this_session column if missing."""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        with conn.cursor() as cur:
            # Check if column exists
            cur.execute("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name='login_sessions' 
                AND column_name='resumes_uploaded_this_session'
            """)
            
            if not cur.fetchone():
                print("⏳ Adding resumes_uploaded_this_session column...")
                cur.execute("""
                    ALTER TABLE login_sessions 
                    ADD COLUMN resumes_uploaded_this_session INT DEFAULT 0
                """)
                print("  ✓ Column added")
            else:
                print("✓ Column already exists")
        
        conn.commit()
        print("\n✅ Migration successful!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    finally:
        conn.close()
    
    return True


if __name__ == "__main__":
    migrate()
