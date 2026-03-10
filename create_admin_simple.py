#!/usr/bin/env python3
"""Simple script to create admin user"""
import psycopg2
import os
import bcrypt

DB_CONFIG = {
    'dbname': 'resume_dev',
    'user': 'postgres',
    'password': os.getenv('DB_PASSWORD', 'devpassword'),
    'host': 'database',
    'port': 5432
}

try:
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Hash password using bcrypt directly
    password_hash = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    cur.execute(
        "INSERT INTO users (username, password_hash, role) VALUES (%s, %s, %s) ON CONFLICT (username) DO NOTHING",
        ("admin", password_hash, "admin")
    )
    
    conn.commit()
    print("✓ Admin user created successfully!")
    print("  Username: admin")
    print("  Password: admin123")
    
except Exception as e:
    print(f"Error: {e}")
finally:
    if 'conn' in locals():
        conn.close()
