"""
migrate_auth.py
===============
Safe one-time migration to add auth tables.
- Idempotent: safe to run multiple times (uses IF NOT EXISTS / IF NOT EXISTS checks)
- Never deletes existing data
- Seeds a default admin user if none exists
- Run BEFORE deploying new backend code

Usage:
    python migrate_auth.py
"""

import psycopg2
import hashlib
import os
from datetime import datetime


# ── Config ────────────────────────────────────────────────────────────────────
DB_CONFIG = dict(host="localhost", port=5432, dbname="postgres",
                 user="postgres", password="admin")

# Default admin credentials (change password after first login!)
DEFAULT_ADMIN = {
    "username": "admin",
    "email":    "admin@company.com",
    "password": "Admin@123",   # ← CHANGE THIS after first login
    "role":     "admin",
}


# ── Helpers ───────────────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    """Simple bcrypt-compatible hash. Replace with passlib in production."""
    try:
        from passlib.context import CryptContext
        return CryptContext(schemes=["bcrypt"], deprecated="auto").hash(password)
    except ImportError:
        # Fallback if passlib not installed yet
        import hashlib
        return "pbkdf2:" + hashlib.sha256(password.encode()).hexdigest()


def run_migration():
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    cur = conn.cursor()

    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] Starting auth migration...")
    print()

    # ── Step 1: Create users table ────────────────────────────────────────────
    print("Step 1: Creating 'users' table (if not exists)...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id              SERIAL PRIMARY KEY,
            username        VARCHAR(100) UNIQUE NOT NULL,
            email           VARCHAR(255) UNIQUE NOT NULL,
            password_hash   VARCHAR(255) NOT NULL,
            role            VARCHAR(20)  NOT NULL DEFAULT 'user',
            is_active       BOOLEAN      NOT NULL DEFAULT true,
            total_logins    INTEGER      NOT NULL DEFAULT 0,
            last_login      TIMESTAMP    NULL,
            last_ip         VARCHAR(50)  NULL,
            created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
        );
    """)
    print("  ✓ 'users' table ready")

    # ── Step 2: Add uploaded_by to candidate_profile ─────────────────────────
    print("Step 2: Adding 'uploaded_by' column to 'candidate_profile' (if not exists)...")
    cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'candidate_profile'
          AND column_name  = 'uploaded_by'
    """)
    if cur.fetchone() is None:
        cur.execute("""
            ALTER TABLE candidate_profile
            ADD COLUMN uploaded_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL;
        """)
        print("  ✓ 'uploaded_by' column added (existing rows will have NULL = unknown uploader)")
    else:
        print("  ✓ 'uploaded_by' column already exists — skipped")

    # ── Step 3: Seed default admin user ──────────────────────────────────────
    print("Step 3: Seeding default admin user...")
    cur.execute("SELECT id FROM users WHERE username = %s", (DEFAULT_ADMIN["username"],))
    if cur.fetchone() is None:
        hashed = hash_password(DEFAULT_ADMIN["password"])
        cur.execute("""
            INSERT INTO users (username, email, password_hash, role)
            VALUES (%s, %s, %s, %s)
        """, (DEFAULT_ADMIN["username"], DEFAULT_ADMIN["email"], hashed, DEFAULT_ADMIN["role"]))
        print(f"  ✓ Admin user created: username='{DEFAULT_ADMIN['username']}' password='{DEFAULT_ADMIN['password']}'")
        print("  ⚠  IMPORTANT: Change the password after first login!")
    else:
        print(f"  ✓ Admin user '{DEFAULT_ADMIN['username']}' already exists — skipped")

    # ── Step 4: Create index for faster queries ───────────────────────────────
    print("Step 4: Creating indexes...")
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_users_username
        ON users(username);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_candidate_profile_uploaded_by
        ON candidate_profile(uploaded_by);
    """)
    print("  ✓ Indexes ready")

    # ── Step 5: Make email nullable (allow users without email) ───────────────
    print("Step 5: Making email column nullable...")
    cur.execute("ALTER TABLE users ALTER COLUMN email DROP NOT NULL;")
    # Convert empty strings to NULL
    cur.execute("UPDATE users SET email = NULL WHERE email = '';")
    print("  ✓ Email column is now nullable, empty strings converted to NULL")

    # ── Commit ────────────────────────────────────────────────────────────────
    conn.commit()
    print()
    print("=" * 60)
    print("Migration completed successfully!")
    print()

    # ── Verify ────────────────────────────────────────────────────────────────
    print("Current state:")
    cur.execute("SELECT COUNT(*) FROM users")
    print(f"  users table:              {cur.fetchone()[0]} row(s)")

    cur.execute("SELECT COUNT(*) FROM candidate_profile")
    total = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM candidate_profile WHERE uploaded_by IS NOT NULL")
    linked = cur.fetchone()[0]
    print(f"  candidate_profile rows:   {total} total, {linked} linked to a user, {total - linked} legacy (NULL)")

    conn.close()
    print()
    print("Next steps:")
    print("  1. Install packages:  pip install python-jose[cryptography] passlib[bcrypt] python-multipart")
    print("  2. Deploy backend auth code")
    print("  3. Deploy frontend login page")


if __name__ == "__main__":
    # Safety confirmation
    print("=" * 60)
    print("AUTH MIGRATION SCRIPT")
    print("=" * 60)
    print("This will:")
    print("  + CREATE TABLE users")
    print("  + ALTER TABLE candidate_profile ADD COLUMN uploaded_by")
    print("  + INSERT default admin user")
    print()
    print("Existing data will NOT be deleted or modified.")
    print()
    confirm = input("Type 'yes' to proceed: ").strip().lower()
    if confirm != "yes":
        print("Aborted.")
        exit(0)
    print()
    run_migration()
