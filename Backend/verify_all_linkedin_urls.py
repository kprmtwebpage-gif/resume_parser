import psycopg2
from dotenv import load_dotenv
import os
from parser import extract_text_from_docx
import pdfplumber

load_dotenv()
conn = psycopg2.connect(
    host=os.getenv('DB_HOST'),
    database=os.getenv('DB_NAME'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD')
)
cur = conn.cursor()

# Get all candidates with LinkedIn URLs
cur.execute('''
    SELECT id, first_name, last_name, linkedin, resume_filename
    FROM candidate_profile
    WHERE linkedin IS NOT NULL AND linkedin != ''
    ORDER BY id
''')

results = cur.fetchall()

print("Checking LinkedIn URL accuracy...")
print("=" * 100)

fixes = []

for cid, first, last, linkedin_db, resume in results:
    try:
        # Extract text from resume
        if resume.endswith('.docx'):
            text = extract_text_from_docx(resume)
        else:
            with pdfplumber.open(resume) as pdf:
                text = ''
                for page in pdf.pages:
                    text += page.extract_text() or ''
        
        # Find LinkedIn URL in resume
        lines = text.split('\n')
        linkedin_resume = None
        for line in lines:
            if 'linkedin.com/in/' in line.lower():
                # Extract the URL
                import re
                match = re.search(r'https?://(?:www\.)?linkedin\.com/in/[a-zA-Z0-9\-]+/?', line, re.IGNORECASE)
                if match:
                    linkedin_resume = match.group(0)
                    break
        
        if linkedin_resume:
            # Normalize both URLs for comparison (remove trailing slash, lowercase)
            db_normalized = linkedin_db.rstrip('/').lower()
            resume_normalized = linkedin_resume.rstrip('/').lower()
            
            if db_normalized != resume_normalized:
                print(f"\n❌ MISMATCH - ID {cid}: {first} {last}")
                print(f"   DB:     {linkedin_db}")
                print(f"   Resume: {linkedin_resume}")
                fixes.append((cid, linkedin_resume, first, last))
                
    except Exception as e:
        pass

print("\n" + "=" * 100)
print(f"\n📊 SUMMARY:")
print(f"   Total with LinkedIn: {len(results)}")
print(f"   Issues found: {len(fixes)}")

if fixes:
    print(f"\n{'='*100}")
    print("Would you like to fix these URLs? (Creating fix script...)")
    
    # Create fix script
    with open('fix_linkedin_urls.py', 'w') as f:
        f.write("""import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()
conn = psycopg2.connect(
    host=os.getenv('DB_HOST'),
    database=os.getenv('DB_NAME'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD')
)
cur = conn.cursor()

fixes = [
""")
        for cid, url, first, last in fixes:
            f.write(f"    ({cid}, '{url}', '{first}', '{last}'),\n")
        
        f.write("""]

print("Fixing LinkedIn URLs...")
print("=" * 80)

for cid, correct_url, first, last in fixes:
    cur.execute('UPDATE candidate_profile SET linkedin = %s WHERE id = %s', (correct_url, cid))
    print(f"✓ ID {cid}: {first} {last} -> {correct_url}")

conn.commit()
cur.close()
conn.close()

print("\\n✓ All LinkedIn URLs corrected!")
""")
    
    print(f"✓ Fix script created: fix_linkedin_urls.py")

cur.close()
conn.close()
