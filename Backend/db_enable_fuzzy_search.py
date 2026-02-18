"""
Enable PostgreSQL pg_trgm extension for fuzzy text matching
This is required for the job title search functionality
"""
import os
import psycopg2
from dotenv import load_dotenv


def main():
    load_dotenv()
    
    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
    )
    
    with conn:
        with conn.cursor() as cur:
            # Enable pg_trgm extension for similarity matching
            try:
                cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
                print("✅ pg_trgm extension enabled successfully")
            except psycopg2.Error as e:
                print(f"⚠️  Warning: Could not enable pg_trgm extension: {e}")
                print("   Fuzzy matching may have limited functionality")
            
            # Create GIN index on job_title for faster similarity searches
            try:
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_job_titles_trgm 
                    ON public.job_titles 
                    USING GIN (job_title gin_trgm_ops)
                """)
                print("✅ Created GIN index on job_titles for faster fuzzy search")
            except psycopg2.Error as e:
                print(f"⚠️  Warning: Could not create index: {e}")
    
    conn.close()
    print("\n🎯 Fuzzy search setup complete!")


if __name__ == "__main__":
    main()
