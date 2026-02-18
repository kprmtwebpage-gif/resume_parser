"""Show job titles for specific candidates."""
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

with conn.cursor() as cur:
    # Get the candidates by partial name match
    search_names = [
        ('Angirge', 'Mukesh'),
        ('Gustavo', 'Felix'),
        ('Keerthi', 'Suresh'),
        ('Parth', 'Patel'),
        ('Sivasai', 'Gudibandla')
    ]
    
    print("=== Current Job Titles ===\n")
    for first, last in search_names:
        cur.execute("""
            SELECT cp.id, cp.first_name, cp.last_name, csp.job_title
            FROM candidate_profile cp
            LEFT JOIN candidate_skills_profile csp ON cp.id = csp.candidate_id
            WHERE cp.first_name ILIKE %s AND cp.last_name ILIKE %s
        """, (f'%{first}%', f'%{last}%'))
        
        result = cur.fetchone()
        if result:
            print(f"ID: {result[0]}")
            print(f"Name: {result[1]} {result[2]}")
            print(f"Job Title: '{result[3]}'")
            print()
        else:
            print(f"NOT FOUND: {first} {last}\n")

conn.close()
