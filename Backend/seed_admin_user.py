"""Seed default admin user into the users table."""
import psycopg2
import bcrypt

DB_CONFIG = dict(
    host='localhost', port=5432,
    dbname='resume_db', user='postgres', password='admin'
)

password = 'admin123'
password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

conn = psycopg2.connect(**DB_CONFIG)
try:
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO users (username, email, password_hash, role, is_active)
               VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT (username) DO UPDATE
               SET password_hash = EXCLUDED.password_hash,
                   role = EXCLUDED.role,
                   is_active = EXCLUDED.is_active""",
            ('admin', 'admin@kprmt.com', password_hash, 'admin', True)
        )
    conn.commit()
    print('Admin user seeded successfully.')
    print('  Username: admin')
    print('  Password: admin123')
finally:
    conn.close()
