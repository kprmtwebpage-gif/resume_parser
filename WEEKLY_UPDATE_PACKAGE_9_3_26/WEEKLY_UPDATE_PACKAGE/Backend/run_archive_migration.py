"""
Migration script to add archive columns to the jobs table.
Run this once to add the archived and archived_at columns.

Usage:
    python run_archive_migration.py
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = (
    f"postgresql://{os.getenv('DB_USER', 'postgres')}"
    f":{os.getenv('DB_PASSWORD', 'admin')}"
    f"@{os.getenv('DB_HOST', 'localhost')}"
    f":{os.getenv('DB_PORT', '5432')}"
    f"/{os.getenv('DB_NAME', 'postgres')}"
)

def run_migration():
    """Add archived and archived_at columns to jobs table."""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if columns already exist
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'jobs' AND column_name IN ('archived', 'archived_at')
        """))
        existing_columns = {row[0] for row in result}
        
        # Add archived column if it doesn't exist
        if 'archived' not in existing_columns:
            print("Adding 'archived' column...")
            conn.execute(text("""
                ALTER TABLE jobs 
                ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE
            """))
            conn.commit()
            print("✓ Added 'archived' column")
        else:
            print("✓ 'archived' column already exists")
        
        # Add archived_at column if it doesn't exist
        if 'archived_at' not in existing_columns:
            print("Adding 'archived_at' column...")
            conn.execute(text("""
                ALTER TABLE jobs 
                ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE
            """))
            conn.commit()
            print("✓ Added 'archived_at' column")
        else:
            print("✓ 'archived_at' column already exists")
        
        # Create index for better performance
        print("Creating index on 'archived' column...")
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_jobs_archived ON jobs(archived)
            """))
            conn.commit()
            print("✓ Index created")
        except Exception as e:
            print(f"Index may already exist: {e}")
        
        print("\n✅ Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
