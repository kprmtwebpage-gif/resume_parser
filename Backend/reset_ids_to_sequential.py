"""Reset candidate IDs to start from 1 with proper sequential order"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

print("="*70)
print("ID RESET UTILITY - Reset candidate IDs to start from 1")
print("="*70)
print("\n⚠️  WARNING: This will reassign all IDs in the database!")
print("   - All candidate_profile IDs will be renumbered 1, 2, 3, ...")
print("   - All candidate_skills_profile.candidate_id will be updated to match")
print("   - The sequence will be reset to continue from the new max ID")
print("\n")

response = input("Do you want to proceed? (yes/no): ")
if response.lower() != 'yes':
    print("❌ Cancelled")
    exit(0)

conn = psycopg2.connect(
    dbname=os.getenv('DB_NAME'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'),
    host=os.getenv('DB_HOST'),
    port=os.getenv('DB_PORT')
)

print("\n🔄 Starting ID reset process...")

with conn:
    with conn.cursor() as cur:
        # Get current state
        cur.execute('SELECT COUNT(*) FROM candidate_profile')
        total = cur.fetchone()[0]
        print(f"   Found {total} candidates to renumber")
        
        # Create temporary columns
        print("\n📝 Step 1: Adding temporary columns...")
        cur.execute('ALTER TABLE candidate_profile ADD COLUMN IF NOT EXISTS new_id INTEGER')
        cur.execute('ALTER TABLE candidate_skills_profile ADD COLUMN IF NOT EXISTS new_candidate_id INTEGER')
        
        # Assign new sequential IDs
        print("📝 Step 2: Assigning new sequential IDs...")
        cur.execute("""
            WITH numbered AS (
                SELECT id, ROW_NUMBER() OVER (ORDER BY id) as new_id
                FROM candidate_profile
            )
            UPDATE candidate_profile cp
            SET new_id = numbered.new_id
            FROM numbered
            WHERE cp.id = numbered.id
        """)
        print(f"   ✅ Assigned new IDs to {cur.rowcount} records")
        
        # Update skills table with new IDs
        print("📝 Step 3: Updating candidate_skills_profile...")
        cur.execute("""
            UPDATE candidate_skills_profile csp
            SET new_candidate_id = cp.new_id
            FROM candidate_profile cp
            WHERE csp.candidate_id = cp.id
        """)
        print(f"   ✅ Updated {cur.rowcount} skills records")
        
        # Drop foreign key constraint
        print("📝 Step 4: Temporarily removing foreign key constraint...")
        cur.execute("""
            ALTER TABLE candidate_skills_profile 
            DROP CONSTRAINT IF EXISTS candidate_skills_profile_candidate_id_fkey
        """)
        
        # Drop primary key constraints
        print("📝 Step 5: Temporarily removing primary keys...")
        cur.execute('ALTER TABLE candidate_skills_profile DROP CONSTRAINT IF EXISTS candidate_skills_profile_pkey')
        cur.execute('ALTER TABLE candidate_profile DROP CONSTRAINT IF EXISTS candidate_profile_pkey')
        
        # Update the actual IDs
        print("📝 Step 6: Replacing old IDs with new IDs...")
        cur.execute('UPDATE candidate_profile SET id = new_id')
        cur.execute('UPDATE candidate_skills_profile SET candidate_id = new_candidate_id')
        
        # Recreate primary keys
        print("📝 Step 7: Recreating primary keys...")
        cur.execute('ALTER TABLE candidate_profile ADD PRIMARY KEY (id)')
        cur.execute('ALTER TABLE candidate_skills_profile ADD PRIMARY KEY (candidate_id)')
        
        # Recreate foreign key
        print("📝 Step 8: Recreating foreign key constraint...")
        cur.execute("""
            ALTER TABLE candidate_skills_profile 
            ADD CONSTRAINT candidate_skills_profile_candidate_id_fkey 
            FOREIGN KEY (candidate_id) REFERENCES candidate_profile(id) ON DELETE CASCADE
        """)
        
        # Drop temporary columns
        print("📝 Step 9: Cleaning up temporary columns...")
        cur.execute('ALTER TABLE candidate_profile DROP COLUMN IF EXISTS new_id')
        cur.execute('ALTER TABLE candidate_skills_profile DROP COLUMN IF EXISTS new_candidate_id')
        
        # Reset the sequence
        print("📝 Step 10: Resetting sequence to continue from new max ID...")
        cur.execute('SELECT MAX(id) FROM candidate_profile')
        max_id = cur.fetchone()[0] or 0
        cur.execute(f'ALTER SEQUENCE candidate_profile_id_seq RESTART WITH {max_id + 1}')
        print(f"   ✅ Sequence will continue from {max_id + 1}")
        
        # Verify
        print("\n📊 Verification:")
        cur.execute('SELECT MIN(id), MAX(id), COUNT(*) FROM candidate_profile')
        min_id, max_id, count = cur.fetchone()
        print(f"   candidate_profile: IDs now range from {min_id} to {max_id} ({count} records)")
        
        cur.execute('SELECT MIN(candidate_id), MAX(candidate_id), COUNT(*) FROM candidate_skills_profile')
        min_cid, max_cid, count2 = cur.fetchone()
        print(f"   candidate_skills_profile: candidate_ids range from {min_cid} to {max_cid} ({count2} records)")
        
        # Check for gaps
        cur.execute('SELECT id FROM candidate_profile ORDER BY id')
        all_ids = [r[0] for r in cur.fetchall()]
        expected = 1
        gaps = []
        for id_val in all_ids:
            if id_val != expected:
                gaps.append((expected, id_val - 1))
            expected = id_val + 1
        
        if gaps:
            print(f"   ⚠️  Still has {len(gaps)} gaps: {gaps}")
        else:
            print(f"   ✅ All IDs are now sequential with no gaps!")

conn.close()

print("\n" + "="*70)
print("✅ ID RESET COMPLETED SUCCESSFULLY!")
print("="*70)
print(f"All {total} candidates now have IDs from 1 to {total}")
print("The database is ready to use with sequential IDs.")
print("="*70)
