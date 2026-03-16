#!/usr/bin/env python3
"""
Setup script for creating the jobs table in PostgreSQL database.

This script reads the create_jobs_table.sql file and executes it
to create the jobs table with all necessary indexes and triggers.

Usage:
    python setup_jobs_table.py
"""

import os
import sys
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_db_connection():
    """
    Create and return a database connection using environment variables.
    
    Returns:
        psycopg2.connection: Database connection object
    """
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5432'),
            database=os.getenv('DB_NAME', 'your_database'),
            user=os.getenv('DB_USER', 'your_username'),
            password=os.getenv('DB_PASSWORD', '')
        )
        return conn
    except psycopg2.Error as e:
        print(f"❌ Error connecting to database: {e}")
        sys.exit(1)


def read_sql_file(filename):
    """
    Read SQL script from file.
    
    Args:
        filename (str): Path to SQL file
        
    Returns:
        str: SQL script content
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sql_file_path = os.path.join(script_dir, filename)
    
    if not os.path.exists(sql_file_path):
        print(f"❌ Error: SQL file not found at {sql_file_path}")
        sys.exit(1)
    
    with open(sql_file_path, 'r', encoding='utf-8') as f:
        return f.read()


def execute_sql_script(conn, sql_script):
    """
    Execute SQL script.
    
    Args:
        conn: Database connection
        sql_script (str): SQL script to execute
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        with conn.cursor() as cur:
            cur.execute(sql_script)
        conn.commit()
        return True
    except psycopg2.Error as e:
        conn.rollback()
        print(f"❌ Error executing SQL script: {e}")
        return False


def verify_table_exists(conn, table_name='jobs'):
    """
    Verify that the table was created successfully.
    
    Args:
        conn: Database connection
        table_name (str): Name of table to check
        
    Returns:
        bool: True if table exists, False otherwise
    """
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = %s
                );
            """, (table_name,))
            exists = cur.fetchone()[0]
            return exists
    except psycopg2.Error as e:
        print(f"❌ Error verifying table: {e}")
        return False


def get_table_info(conn, table_name='jobs'):
    """
    Get information about the created table.
    
    Args:
        conn: Database connection
        table_name (str): Name of table
        
    Returns:
        list: List of column information tuples
    """
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    column_name, 
                    data_type, 
                    character_maximum_length,
                    is_nullable
                FROM information_schema.columns
                WHERE table_name = %s
                ORDER BY ordinal_position;
            """, (table_name,))
            return cur.fetchall()
    except psycopg2.Error as e:
        print(f"❌ Error getting table info: {e}")
        return []


def get_indexes_info(conn, table_name='jobs'):
    """
    Get information about table indexes.
    
    Args:
        conn: Database connection
        table_name (str): Name of table
        
    Returns:
        list: List of index information tuples
    """
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = %s;
            """, (table_name,))
            return cur.fetchall()
    except psycopg2.Error as e:
        print(f"❌ Error getting indexes info: {e}")
        return []


def main():
    """Main execution function."""
    print("=" * 70)
    print("📊 Jobs Table Setup Script")
    print("=" * 70)
    print()
    
    # Step 1: Connect to database
    print("🔌 Connecting to database...")
    conn = get_db_connection()
    print("✅ Connected successfully!")
    print()
    
    # Step 2: Read SQL script
    print("📄 Reading SQL script...")
    sql_script = read_sql_file('create_jobs_table.sql')
    print("✅ SQL script loaded successfully!")
    print()
    
    # Step 3: Execute SQL script
    print("⚙️  Executing SQL script...")
    success = execute_sql_script(conn, sql_script)
    
    if not success:
        print("❌ Failed to create jobs table!")
        conn.close()
        sys.exit(1)
    
    print("✅ SQL script executed successfully!")
    print()
    
    # Step 4: Verify table creation
    print("🔍 Verifying table creation...")
    if verify_table_exists(conn, 'jobs'):
        print("✅ Jobs table created successfully!")
        print()
        
        # Display table information
        print("📋 Table Structure:")
        print("-" * 70)
        columns = get_table_info(conn, 'jobs')
        for col in columns:
            col_name, data_type, max_length, nullable = col
            length_str = f"({max_length})" if max_length else ""
            null_str = "NULL" if nullable == "YES" else "NOT NULL"
            print(f"  • {col_name:<30} {data_type}{length_str:<20} {null_str}")
        print()
        
        # Display indexes information
        print("🔖 Indexes Created:")
        print("-" * 70)
        indexes = get_indexes_info(conn, 'jobs')
        for idx in indexes:
            idx_name, idx_def = idx
            print(f"  • {idx_name}")
        print()
        
        print("=" * 70)
        print("✅ Setup completed successfully!")
        print("=" * 70)
        print()
        print("📝 Next steps:")
        print("  1. Review the JOBS_TABLE_README.md for detailed documentation")
        print("  2. Test the table with sample data")
        print("  3. Integrate with your application API")
        print()
        
    else:
        print("❌ Failed to verify table creation!")
        conn.close()
        sys.exit(1)
    
    # Close connection
    conn.close()
    print("🔒 Database connection closed.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Setup interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        sys.exit(1)
