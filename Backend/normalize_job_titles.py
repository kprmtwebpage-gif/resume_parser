"""Normalize job titles for specific candidates."""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    host=os.getenv("DB_HOST"),
    port=os.getenv("DB_PORT"),
)

# Define corrections - mapping from ID to correct job title
corrections = {
    6: ".NET Full Stack Developer",  # Angirge Mukesh: 'Net Full Stack Developer' -> '.NET Full Stack Developer'
    14: ".NET Cloud Solutions Engineer",  # Gustavo Felix: 'Net Cloud Solutions Engineer' -> '.NET Cloud Solutions Engineer'
    20: "Node.js Backend Developer",  # Keerthi Suresh: 'Backend: Node Js' -> 'Node.js Backend Developer'
    27: "Junior Software Developer"  # Parth Patel: 'Amazon Junior Software Developer' -> 'Junior Software Developer'
}

with conn:
    with conn.cursor() as cur:
        print("=== Normalizing Job Titles ===\n")
        
        for candidate_id, new_title in corrections.items():
            # Get current title
            cur.execute("""
                SELECT cp.first_name, cp.last_name, csp.job_title
                FROM candidate_profile cp
                LEFT JOIN candidate_skills_profile csp ON cp.id = csp.candidate_id
                WHERE cp.id = %s
            """, (candidate_id,))
            
            result = cur.fetchone()
            if result:
                first_name, last_name, old_title = result
                
                # Update the job title
                cur.execute("""
                    UPDATE candidate_skills_profile
                    SET job_title = %s
                    WHERE candidate_id = %s
                """, (new_title, candidate_id))
                
                print(f"✓ {first_name} {last_name} (ID: {candidate_id})")
                print(f"  Old: '{old_title}'")
                print(f"  New: '{new_title}'")
                print()
        
        conn.commit()
        print("\n✅ All job titles normalized successfully!")

conn.close()
