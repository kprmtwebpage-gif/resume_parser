"""Fix job titles for specific candidates."""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def main():
    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
    )
    
    with conn:
        with conn.cursor() as cur:
            # Check current job titles for these candidates
            candidates = [
                'Angirge Mukesh',
                'Gustavo Felix', 
                'Keerthi Suresh',
                'Parth Patel',
                'Sivasai Gudibandla'
            ]
            
            print("=== Current Job Titles ===\n")
            for name in candidates:
                # Split name into first and last
                parts = name.split()
                first_name = parts[0] if parts else ''
                last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''
                
                # Query for the candidate
                cur.execute("""
                    SELECT cp.id, cp.first_name, cp.last_name, csp.job_title
                    FROM candidate_profile cp
                    LEFT JOIN candidate_skills_profile csp ON cp.id = csp.candidate_id
                    WHERE cp.first_name ILIKE %s AND cp.last_name ILIKE %s
                """, (f'%{first_name}%', f'%{last_name}%'))
                
                results = cur.fetchall()
                if results:
                    for r in results:
                        print(f"{r[1]} {r[2]} (ID: {r[0]})")
                        print(f"  Current Job Title: {r[3]}\n")
                else:
                    print(f"NOT FOUND: {name}\n")
            
            print("\n" + "="*60)
            print("Please specify the correct job titles for each candidate:")
            print("="*60 + "\n")
            
            # Define correct job titles based on common tech roles
            # You can modify these based on what you want
            corrections = {}
            
            for name in candidates:
                parts = name.split()
                first_name = parts[0] if parts else ''
                last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''
                
                cur.execute("""
                    SELECT cp.id, cp.first_name, cp.last_name, csp.job_title
                    FROM candidate_profile cp
                    LEFT JOIN candidate_skills_profile csp ON cp.id = csp.candidate_id
                    WHERE cp.first_name ILIKE %s AND cp.last_name ILIKE %s
                """, (f'%{first_name}%', f'%{last_name}%'))
                
                result = cur.fetchone()
                if result:
                    candidate_id = result[0]
                    current_title = result[3]
                    full_name = f"{result[1]} {result[2]}"
                    
                    print(f"\n{full_name} (ID: {candidate_id})")
                    print(f"Current: {current_title}")
                    
                    # Ask for correct title
                    new_title = input(f"Enter correct job title (press Enter to skip): ").strip()
                    
                    if new_title:
                        corrections[candidate_id] = new_title
            
            # Apply corrections
            if corrections:
                print("\n" + "="*60)
                print("Applying corrections...")
                print("="*60 + "\n")
                
                for candidate_id, new_title in corrections.items():
                    cur.execute("""
                        UPDATE candidate_skills_profile
                        SET job_title = %s
                        WHERE candidate_id = %s
                    """, (new_title, candidate_id))
                    
                    print(f"✓ Updated candidate ID {candidate_id} to: {new_title}")
                
                conn.commit()
                print("\n✅ All corrections applied successfully!")
            else:
                print("\nNo corrections to apply.")

if __name__ == "__main__":
    main()
