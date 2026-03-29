"""
Generate 1000 diverse, realistic resumes in PDF format.
Covers many different styles, layouts, and edge cases to stress-test the parser.
"""
import os
import random
import json
from reportlab.lib.pagesizes import letter, A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch

OUTPUT_DIR = "bulk_resumes"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Data pools ──────────────────────────────────────────────────────────────

FIRST_NAMES = [
    "James","Mary","Robert","Patricia","John","Jennifer","Michael","Linda","David","Elizabeth",
    "William","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Christopher","Karen",
    "Charles","Lisa","Daniel","Nancy","Matthew","Betty","Anthony","Margaret","Mark","Sandra",
    "Aisha","Mohammed","Yuki","Hiroshi","Wei","Mei","Raj","Priya","Arjun","Ananya",
    "Carlos","Maria","Pedro","Ana","Diego","Sofia","Luis","Valentina","Miguel","Isabella",
    "Oluwaseun","Chidinma","Kwame","Fatima","Abdul","Amina","Hassan","Zainab","Ibrahim","Aisha",
    "Andrei","Natalia","Dmitri","Olga","Sergei","Tatiana","Pavel","Elena","Boris","Svetlana",
    "Liam","Emma","Noah","Olivia","Ethan","Ava","Logan","Mia","Lucas","Charlotte",
    "Aiden","Amelia","Mason","Harper","Elijah","Evelyn","Oliver","Abigail","Jacob","Emily",
    "Sanjay","Deepika","Vikram","Kavitha","Suresh","Lakshmi","Ravi","Meera","Amit","Nisha",
    "Pierre","Marie","Jean","Claire","Francois","Camille","Antoine","Sophie","Laurent","Julie",
    "Kenji","Sakura","Takeshi","Yuna","Ryo","Hana","Kaito","Rin","Sora","Aoi",
    "Jin","Min","Sung","Hyun","Jae","Eun","Tae","Soo","Chan","Young",
    "Alejandro","Gabriela","Fernando","Claudia","Ricardo","Daniela","Eduardo","Paola","Andres","Camila",
    "Nikolai","Katarina","Henrik","Ingrid","Erik","Astrid","Lars","Freya","Magnus","Sigrid",
]

LAST_NAMES = [
    "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
    "Anderson","Taylor","Thomas","Hernandez","Moore","Martin","Jackson","Thompson","White","Lopez",
    "Lee","Kim","Park","Choi","Jung","Kang","Yoon","Han","Song","Lim",
    "Wang","Chen","Li","Zhang","Liu","Yang","Huang","Wu","Zhou","Xu",
    "Patel","Sharma","Kumar","Singh","Gupta","Reddy","Rao","Nair","Joshi","Verma",
    "Suzuki","Tanaka","Watanabe","Ito","Yamamoto","Nakamura","Kobayashi","Saito","Kato","Yoshida",
    "Fernandez","Gonzalez","Santos","Torres","Diaz","Ruiz","Ramirez","Cruz","Flores","Morales",
    "Okafor","Adebayo","Osei","Mensah","Diallo","Traore","Ndiaye","Mwangi","Kamau","Ochieng",
    "Petrov","Ivanov","Smirnov","Popov","Volkov","Kozlov","Novikov","Morozov","Sokolov","Lebedev",
    "Muller","Schmidt","Schneider","Fischer","Weber","Meyer","Wagner","Becker","Schulz","Hoffmann",
    "OBrien","Murphy","Kelly","Walsh","Ryan","Sullivan","Kennedy","McCarthy","Connor","Doyle",
    "Beaumont","Leclerc","Moreau","Laurent","Bernard","Dubois","Thomas","Leroy","Roux","Girard",
    "Andersson","Johansson","Nilsson","Eriksson","Larsson","Olsson","Persson","Svensson","Gustafsson","Berg",
]

CITIES = [
    ("New York", "NY"), ("Los Angeles", "CA"), ("Chicago", "IL"), ("Houston", "TX"),
    ("Phoenix", "AZ"), ("Philadelphia", "PA"), ("San Antonio", "TX"), ("San Diego", "CA"),
    ("Dallas", "TX"), ("San Jose", "CA"), ("Austin", "TX"), ("Jacksonville", "FL"),
    ("San Francisco", "CA"), ("Columbus", "OH"), ("Charlotte", "NC"), ("Indianapolis", "IN"),
    ("Seattle", "WA"), ("Denver", "CO"), ("Boston", "MA"), ("Nashville", "TN"),
    ("Portland", "OR"), ("Atlanta", "GA"), ("Miami", "FL"), ("Raleigh", "NC"),
    ("Minneapolis", "MN"), ("Tampa", "FL"), ("Pittsburgh", "PA"), ("Cleveland", "OH"),
    ("Detroit", "MI"), ("Salt Lake City", "UT"), ("Richmond", "VA"), ("Kansas City", "MO"),
    ("Sacramento", "CA"), ("Orlando", "FL"), ("St. Louis", "MO"), ("Cincinnati", "OH"),
    ("Milwaukee", "WI"), ("Las Vegas", "NV"), ("Baltimore", "MD"), ("Tucson", "AZ"),
]

JOB_TITLES = [
    "Software Engineer", "Senior Software Engineer", "Staff Software Engineer",
    "Frontend Developer", "Backend Developer", "Full Stack Developer",
    "Data Scientist", "Senior Data Scientist", "Data Analyst", "Data Engineer",
    "DevOps Engineer", "Senior DevOps Engineer", "Site Reliability Engineer",
    "Cloud Architect", "Solutions Architect", "Enterprise Architect",
    "Machine Learning Engineer", "AI Engineer", "NLP Engineer",
    "Mobile Developer", "iOS Developer", "Android Developer",
    "QA Engineer", "Test Automation Engineer", "SDET",
    "Product Manager", "Technical Program Manager", "Engineering Manager",
    "Database Administrator", "Systems Administrator", "Network Engineer",
    "Security Engineer", "Cybersecurity Analyst", "Penetration Tester",
    "UI/UX Designer", "Frontend Architect", "Technical Lead",
    "Platform Engineer", "Infrastructure Engineer", "Release Engineer",
    "Business Analyst", "Scrum Master", "Agile Coach",
    "Python Developer", "Java Developer", "React Developer", ".NET Developer",
    "Salesforce Developer", "SAP Consultant", "ServiceNow Developer",
    "Blockchain Developer", "Embedded Systems Engineer", "Firmware Engineer",
]

COMPANIES = [
    "Google","Amazon","Microsoft","Apple","Meta","Netflix","Uber","Airbnb","Stripe","Slack",
    "Salesforce","Oracle","IBM","Intel","Cisco","Adobe","VMware","Snowflake","Databricks","Palantir",
    "Twitter","LinkedIn","Pinterest","Snap","Reddit","Spotify","Lyft","DoorDash","Instacart","Robinhood",
    "Goldman Sachs","JPMorgan Chase","Morgan Stanley","Bank of America","Citadel","Two Sigma","DE Shaw",
    "Deloitte","Accenture","McKinsey","BCG","KPMG","EY","PwC","Capgemini","Infosys","TCS","Wipro",
    "Tesla","SpaceX","Rivian","Lucid Motors","Boeing","Lockheed Martin","Raytheon","Northrop Grumman",
    "Johnson & Johnson","Pfizer","Moderna","Merck","AbbVie","UnitedHealth Group",
    "Walmart","Target","Costco","Home Depot","Nike","Starbucks",
    "Visa","Mastercard","PayPal","Square","Plaid","Coinbase",
]

SKILLS_POOL = {
    "languages": ["Python","Java","JavaScript","TypeScript","Go","Rust","C++","C#","Ruby","PHP","Scala","Kotlin","Swift","R","MATLAB","Perl","Bash","SQL","HTML","CSS"],
    "frameworks": ["React","Angular","Vue.js","Next.js","Django","Flask","FastAPI","Spring Boot","Express","Node.js",".NET","Rails","Laravel","Svelte","Nuxt.js","Gatsby","NestJS","Gin","Fiber","Echo"],
    "cloud": ["AWS","Azure","GCP","Docker","Kubernetes","Terraform","CloudFormation","Ansible","Pulumi","Helm","ArgoCD","ECS","EKS","Lambda","S3","EC2","RDS","DynamoDB","Fargate","CloudWatch"],
    "data": ["PostgreSQL","MySQL","MongoDB","Redis","Elasticsearch","Cassandra","Snowflake","BigQuery","Redshift","Spark","Kafka","Airflow","dbt","Pandas","NumPy","Tableau","Power BI","Looker","Hive","Presto"],
    "ml": ["TensorFlow","PyTorch","scikit-learn","Keras","XGBoost","LightGBM","Hugging Face","OpenCV","spaCy","NLTK","MLflow","SageMaker","Vertex AI","LangChain","Stable Diffusion","CUDA","Jupyter","Weights & Biases"],
    "tools": ["Git","GitHub","GitLab","Jenkins","CircleCI","GitHub Actions","Jira","Confluence","Slack","Figma","Postman","Swagger","Grafana","Prometheus","Datadog","Splunk","New Relic","PagerDuty","Sentry"],
    "testing": ["Jest","Cypress","Selenium","JUnit","pytest","Mocha","Chai","Playwright","TestNG","Cucumber","Robot Framework","Appium","k6","Locust","SonarQube"],
}

DEGREES = [
    ("Bachelor of Science", "Computer Science"),
    ("Bachelor of Science", "Software Engineering"),
    ("Bachelor of Science", "Information Technology"),
    ("Bachelor of Science", "Data Science"),
    ("Bachelor of Science", "Mathematics"),
    ("Bachelor of Science", "Electrical Engineering"),
    ("Bachelor of Engineering", "Computer Science"),
    ("Bachelor of Arts", "Computer Science"),
    ("Bachelor of Commerce", "Information Systems"),
    ("Master of Science", "Computer Science"),
    ("Master of Science", "Data Science"),
    ("Master of Science", "Artificial Intelligence"),
    ("Master of Science", "Software Engineering"),
    ("Master of Science", "Information Systems"),
    ("Master of Science", "Cybersecurity"),
    ("Master of Business Administration", "Technology Management"),
    ("Master of Engineering", "Computer Engineering"),
    ("Doctor of Philosophy", "Computer Science"),
    ("Associate of Science", "Computer Science"),
]

UNIVERSITIES = [
    "MIT","Stanford University","Carnegie Mellon University","UC Berkeley",
    "Georgia Tech","University of Michigan","University of Illinois",
    "University of Texas at Austin","University of Washington","Cornell University",
    "Columbia University","NYU","Purdue University","Penn State","Ohio State University",
    "University of Southern California","UCLA","University of Florida","Virginia Tech",
    "Northeastern University","Arizona State University","University of Colorado Boulder",
    "University of Wisconsin-Madison","University of Maryland","Rice University",
    "IIT Bombay","IIT Delhi","IIT Madras","NIT Trichy","BITS Pilani",
    "Tsinghua University","Peking University","University of Toronto",
    "University of Waterloo","ETH Zurich","Oxford University","Cambridge University",
    "National University of Singapore","KAIST","Seoul National University",
]

CERTIFICATIONS = [
    "AWS Solutions Architect Professional","AWS Solutions Architect Associate",
    "AWS Developer Associate","AWS DevOps Engineer Professional",
    "AWS Machine Learning Specialty","AWS Security Specialty",
    "Google Cloud Professional Architect","Google Cloud Professional Data Engineer",
    "Google Professional Machine Learning Engineer",
    "Azure Solutions Architect Expert","Azure Developer Associate",
    "Azure Administrator Associate","Azure Data Engineer Associate",
    "Certified Kubernetes Administrator (CKA)","Certified Kubernetes Application Developer (CKAD)",
    "HashiCorp Certified Terraform Associate","Certified Scrum Master (CSM)",
    "Project Management Professional (PMP)","CISSP","CEH","CompTIA Security+",
    "TOGAF 9 Certified","ITIL Foundation","Six Sigma Green Belt",
    "Salesforce Certified Administrator","Oracle Certified Professional",
]

VISA_TYPES = [None, None, None, None, None, "US Citizen", "Green Card", "H1B", "OPT", "L1", "TN Visa", "EAD"]

EMAIL_DOMAINS = ["gmail.com","yahoo.com","outlook.com","hotmail.com","icloud.com","protonmail.com","mail.com","aol.com"]

# ── Resume style variations ─────────────────────────────────────────────────

STYLES = [
    "standard",        # Name, title, contact, summary, skills, exp, edu, certs
    "no_title_header", # Name + contact only at top, no title in header
    "compact_header",  # All contact info on one line
    "summary_first",   # Summary before skills
    "skills_first",    # Skills section right after contact
    "education_first", # Education before experience
    "no_summary",      # No professional summary section
    "minimal",         # Very sparse, few sections
    "verbose",         # Long descriptions, many bullet points
    "two_column_sim",  # Simulated two-column (skills on right area)
    "all_caps_headers",# Section headers in ALL CAPS
    "no_section_labels",# No explicit section headers, just content
    "bullet_heavy",    # Lots of bullet points
    "date_formats_mixed", # Different date formats (Jan 2020, 01/2020, 2020)
    "international",   # Non-US phone format, international university
]

def random_phone(city_state):
    area_codes = {"NY":"212","CA":"415","IL":"312","TX":"512","AZ":"480","PA":"215",
                  "FL":"305","OH":"614","NC":"919","IN":"317","WA":"206","CO":"303",
                  "MA":"617","TN":"615","OR":"503","GA":"404","MN":"612","VA":"804",
                  "MO":"816","WI":"414","NV":"702","MD":"410","MI":"313","UT":"801"}
    state = city_state[1]
    ac = area_codes.get(state, str(random.randint(200,999)))
    n1 = random.randint(200,999)
    n2 = random.randint(1000,9999)
    fmt = random.choice([
        f"({ac}) {n1}-{n2}",
        f"{ac}-{n1}-{n2}",
        f"+1-{ac}-{n1}-{n2}",
        f"+1 ({ac}) {n1}-{n2}",
        f"{ac}.{n1}.{n2}",
        f"1{ac}{n1}{n2}",
    ])
    return fmt

def random_email(first, last):
    separators = [".","_",""]
    sep = random.choice(separators)
    local = f"{first.lower()}{sep}{last.lower()}"
    if random.random() < 0.1:
        local += str(random.randint(1,99))
    domain = random.choice(EMAIL_DOMAINS)
    return f"{local}@{domain}"

def random_linkedin(first, last):
    slug = f"{first.lower()}{last.lower()}"
    if random.random() < 0.3:
        slug += str(random.randint(1,99))
    prefixes = ["linkedin.com/in/","www.linkedin.com/in/","https://linkedin.com/in/","https://www.linkedin.com/in/"]
    return random.choice(prefixes) + slug

def random_skills(job_title):
    cats = list(SKILLS_POOL.keys())
    skills = set()
    # Pick 3-5 categories, 2-5 skills each
    for cat in random.sample(cats, min(random.randint(3,5), len(cats))):
        pool = SKILLS_POOL[cat]
        skills.update(random.sample(pool, min(random.randint(2,5), len(pool))))
    return sorted(skills)

def random_experience(job_title, years):
    roles = []
    current_year = 2026
    remaining = years
    while remaining > 0 and len(roles) < 4:
        dur = min(remaining, random.randint(1, min(5, remaining)))
        end_year = current_year
        start_year = current_year - dur
        company = random.choice(COMPANIES)
        city, state = random.choice(CITIES)

        # Date format variations
        months = "January February March April May June July August September October November December".split()
        start_month = random.choice(months)
        end_month = random.choice(months)
        end_str = "Present" if len(roles) == 0 else f"{end_month} {end_year}"
        end_str2 = "Present" if len(roles) == 0 else f"{random.randint(1,12):02d}/{end_year}"
        end_str3 = "Present" if len(roles) == 0 else str(end_year)
        date_fmt = random.choice([
            f"{start_month} {start_year} - {end_str}",
            f"{random.randint(1,12):02d}/{start_year} - {end_str2}",
            f"{start_year} - {end_str3}",
        ])

        title_var = job_title if len(roles) == 0 else random.choice([
            job_title, "Software Engineer", "Developer", "Engineer", "Analyst",
            f"Junior {job_title}", f"Associate {job_title}"
        ])

        bullets = [
            "Developed and maintained scalable applications serving millions of users",
            "Led cross-functional team of engineers to deliver projects on time",
            "Implemented CI/CD pipelines reducing deployment time by 50%",
            "Designed and built RESTful APIs and microservices architecture",
            "Optimized database queries improving performance by 40%",
            "Mentored junior developers and conducted code reviews",
            "Collaborated with product managers to define technical requirements",
            "Built automated testing framework increasing code coverage to 90%",
            "Migrated legacy systems to cloud-native architecture",
            "Reduced infrastructure costs by 30% through optimization",
        ]

        roles.append({
            "title": title_var,
            "company": company,
            "location": f"{city}, {state}",
            "dates": date_fmt,
            "bullets": random.sample(bullets, random.randint(2,4)),
        })
        current_year = start_year
        remaining -= dur
    return roles

def generate_resume(idx):
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    city, state = random.choice(CITIES)
    job_title = random.choice(JOB_TITLES)
    years_exp = random.randint(1, 15)
    email = random_email(first, last)
    phone = random_phone((city, state))
    linkedin = random_linkedin(first, last)
    skills = random_skills(job_title)
    experience = random_experience(job_title, years_exp)
    degree_info = random.sample(DEGREES, random.randint(1, min(2, len(DEGREES))))
    universities = random.sample(UNIVERSITIES, len(degree_info))
    certs = random.sample(CERTIFICATIONS, random.randint(0, min(3, len(CERTIFICATIONS))))
    visa = random.choice(VISA_TYPES)
    style = random.choice(STYLES)

    filename = f"{OUTPUT_DIR}/resume_{idx:04d}_{first.lower()}_{last.lower()}.pdf"
    pagesize = random.choice([letter, A4]) if random.random() < 0.1 else letter

    c = canvas.Canvas(filename, pagesize=pagesize)
    width, height = pagesize
    margin = 72
    y = height - 50

    def write(text, font='Helvetica', size=10, bold=False, indent=0):
        nonlocal y
        if y < 60:
            c.showPage()
            y = height - 50
        actual_font = 'Helvetica-Bold' if bold else font
        c.setFont(actual_font, size)
        c.drawString(margin + indent, y, str(text)[:100])  # Truncate long lines
        y -= max(size + 2, 13)

    def blank(n=1):
        nonlocal y
        y -= 8 * n

    # ── Header section (varies by style) ───────────────────────────────
    if style == "compact_header":
        write(f"{first} {last} | {email} | {phone} | {city}, {state}", size=11, bold=True)
        write(f"{job_title} | {linkedin}", size=10)
    elif style == "no_title_header":
        write(f"{first} {last}", size=16, bold=True)
        write(f"{email} | {phone} | {city}, {state} | {linkedin}", size=9)
    elif style == "international":
        write(f"{first} {last}", size=16, bold=True)
        write(job_title, size=12)
        country = random.choice(["United States", "Canada", "United Kingdom", "Germany", "India", "Australia"])
        write(f"Email: {email} | Phone: {phone}")
        write(f"Location: {city}, {state}, {country} | LinkedIn: {linkedin}")
    else:
        write(f"{first} {last}", size=16, bold=True)
        write(job_title, size=12)
        # Contact line variations
        contact_style = random.choice(["pipes","newlines","mixed"])
        if contact_style == "pipes":
            write(f"{email} | {phone} | {city}, {state}")
            write(f"LinkedIn: {linkedin}")
        elif contact_style == "newlines":
            write(f"Email: {email}")
            write(f"Phone: {phone}")
            write(f"Location: {city}, {state}")
            write(f"LinkedIn: {linkedin}")
        else:
            write(f"Email: {email} | Phone: {phone}")
            write(f"{city}, {state} | {linkedin}")

    # Visa info (sometimes in header)
    if visa and visa != "US Citizen":
        if random.random() < 0.5:
            write(f"Work Authorization: {visa}", size=9)

    blank()

    # ── Sections (order varies by style) ───────────────────────────────
    sections_order = ["summary","skills","experience","education","certifications"]
    if style == "skills_first":
        sections_order = ["skills","summary","experience","education","certifications"]
    elif style == "education_first":
        sections_order = ["education","summary","skills","experience","certifications"]
    elif style == "no_summary":
        sections_order = ["skills","experience","education","certifications"]
    elif style == "minimal":
        sections_order = ["skills","experience","education"]

    for section in sections_order:
        if section == "summary" and style != "no_summary":
            header_text = random.choice(["PROFESSIONAL SUMMARY","Summary","PROFILE","About Me","OBJECTIVE","Career Summary"])
            if style == "all_caps_headers":
                header_text = header_text.upper()
            if style != "no_section_labels":
                write(header_text, size=12, bold=True)
            write(f"Experienced {job_title} with {years_exp}+ years of expertise in", size=10)
            write(f"software development, team leadership, and delivering high-quality solutions.", size=10)
            if visa:
                if visa != "US Citizen":
                    write(f"Visa Status: {visa}. Authorized to work in the United States.", size=10)
                else:
                    write(f"US Citizen. No sponsorship required.", size=10)
            blank()

        elif section == "skills":
            header_text = random.choice(["TECHNICAL SKILLS","Skills","CORE COMPETENCIES","Technical Expertise","KEY SKILLS"])
            if style == "all_caps_headers":
                header_text = header_text.upper()
            if style != "no_section_labels":
                write(header_text, size=12, bold=True)

            # Skills display variations
            skills_fmt = random.choice(["comma","bullet","categorized","pipes"])
            if skills_fmt == "comma":
                chunk = ", ".join(skills)
                while len(chunk) > 90:
                    split_at = chunk[:90].rfind(",")
                    if split_at < 0: split_at = 90
                    write(chunk[:split_at+1])
                    chunk = chunk[split_at+1:].strip()
                if chunk:
                    write(chunk)
            elif skills_fmt == "bullet":
                for sk in skills:
                    write(f"  - {sk}", indent=10)
            elif skills_fmt == "pipes":
                chunk = " | ".join(skills)
                while len(chunk) > 90:
                    split_at = chunk[:90].rfind("|")
                    if split_at < 0: split_at = 90
                    write(chunk[:split_at])
                    chunk = chunk[split_at+1:].strip()
                if chunk:
                    write(chunk)
            else:
                # Categorized
                random.shuffle(skills)
                mid = len(skills) // 2
                write(f"Programming: {', '.join(skills[:mid])}")
                write(f"Tools & Platforms: {', '.join(skills[mid:])}")
            blank()

        elif section == "experience":
            header_text = random.choice(["WORK EXPERIENCE","Experience","PROFESSIONAL EXPERIENCE","Employment History","CAREER HISTORY"])
            if style == "all_caps_headers":
                header_text = header_text.upper()
            if style != "no_section_labels":
                write(header_text, size=12, bold=True)

            for role in experience:
                # Role header variations
                role_fmt = random.choice(["title_company","company_title","combined"])
                if role_fmt == "title_company":
                    write(f"{role['title']} - {role['company']}", bold=True, size=11)
                    write(f"{role['location']} | {role['dates']}", size=9)
                elif role_fmt == "company_title":
                    write(f"{role['company']}", bold=True, size=11)
                    write(f"{role['title']} | {role['location']} | {role['dates']}", size=9)
                else:
                    write(f"{role['title']} at {role['company']}, {role['location']}", bold=True, size=10)
                    write(role['dates'], size=9)

                for bullet in role['bullets']:
                    bullet_char = random.choice(["- ","* ","• ","  "])
                    write(f"{bullet_char}{bullet}", indent=15, size=9)
                blank()

        elif section == "education":
            header_text = random.choice(["EDUCATION","Education","ACADEMIC BACKGROUND","Academics","EDUCATIONAL QUALIFICATIONS"])
            if style == "all_caps_headers":
                header_text = header_text.upper()
            if style != "no_section_labels":
                write(header_text, size=12, bold=True)

            for i, (degree, field) in enumerate(degree_info):
                uni = universities[i] if i < len(universities) else random.choice(UNIVERSITIES)
                grad_year = 2026 - years_exp - random.randint(0, 4) - i * 2

                # Education format variations
                edu_fmt = random.choice(["degree_first","uni_first","combined"])
                if edu_fmt == "degree_first":
                    write(f"{degree} in {field}", bold=True, size=10)
                    write(f"{uni} - {grad_year}", size=9)
                elif edu_fmt == "uni_first":
                    write(f"{uni}", bold=True, size=10)
                    write(f"{degree} in {field}, {grad_year}", size=9)
                else:
                    write(f"{degree} in {field}, {uni} ({grad_year})", size=10)
                if random.random() < 0.2:
                    write(f"GPA: {random.uniform(3.0, 4.0):.1f}/4.0", size=9, indent=10)
            blank()

        elif section == "certifications" and certs:
            header_text = random.choice(["CERTIFICATIONS","Certifications","PROFESSIONAL CERTIFICATIONS","Licenses & Certifications"])
            if style == "all_caps_headers":
                header_text = header_text.upper()
            if style != "no_section_labels":
                write(header_text, size=12, bold=True)
            for cert in certs:
                write(f"- {cert}", size=9)
            blank()

    c.save()

    return {
        "idx": idx,
        "filename": os.path.basename(filename),
        "first_name": first,
        "last_name": last,
        "email": email,
        "phone": phone,
        "city": city,
        "state": state,
        "job_title": job_title,
        "years_exp": years_exp,
        "style": style,
        "visa": visa,
        "skills_count": len(skills),
        "certs_count": len(certs),
    }


if __name__ == "__main__":
    print("Generating 1000 diverse resumes...")
    manifest = []
    for i in range(1, 1001):
        info = generate_resume(i)
        manifest.append(info)
        if i % 100 == 0:
            print(f"  Generated {i}/1000...")

    with open(f"{OUTPUT_DIR}/manifest.json", "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nDone! Generated 1000 resumes in {OUTPUT_DIR}/")
    print(f"Manifest saved to {OUTPUT_DIR}/manifest.json")

    # Stats
    styles = {}
    for m in manifest:
        styles[m["style"]] = styles.get(m["style"], 0) + 1
    print("\nStyle distribution:")
    for s, count in sorted(styles.items(), key=lambda x: -x[1]):
        print(f"  {s}: {count}")
