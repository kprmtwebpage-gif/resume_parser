import psycopg2
import bcrypt
import sys

try:
    conn = psycopg2.connect(
        dbname="postgres", user="postgres", password="admin",
        host="localhost", port=5432
    )
    cur = conn.cursor()
    
    # Hash password using bcrypt
    password_hash = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create admin user (upsert)
    cur.execute("""
        INSERT INTO users (username, password_hash, role, email)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (username) DO UPDATE
        SET password_hash = EXCLUDED.password_hash
    """, ("admin", password_hash, "admin", "admin@kprmt.local"))
    
    conn.commit()
    print("✓ Admin user created/updated!")
    print("  Username: admin")
    print("  Password: admin123")
    
    # Verify
    cur.execute("SELECT username, role FROM users WHERE username='admin'")
    result = cur.fetchone()
    if result:
        print(f"  Verified: {result[0]} ({result[1]})")
    
    conn.close()
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
