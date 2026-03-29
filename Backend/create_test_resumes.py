"""Create test resumes for end-to-end parser testing."""
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

def make_resume(filename, name, title, email, phone, location, linkedin, summary, skills_lines, experience, education, certs):
    c = canvas.Canvas(filename, pagesize=letter)
    y = 740
    def write(text, font='Helvetica', size=10, bold=False):
        nonlocal y
        c.setFont('Helvetica-Bold' if bold else font, size)
        c.drawString(72, y, text)
        y -= max(size + 3, 14)

    write(name, size=16, bold=True)
    write(title, size=12)
    write(f'Email: {email} | Phone: {phone}')
    write(f'Location: {location} | LinkedIn: {linkedin}')
    y -= 10
    write('PROFESSIONAL SUMMARY', size=13, bold=True)
    for line in summary:
        write(line)
    y -= 5
    write('TECHNICAL SKILLS', size=13, bold=True)
    for line in skills_lines:
        write(line)
    y -= 5
    write('WORK EXPERIENCE', size=13, bold=True)
    for block in experience:
        write(block[0], bold=True, size=11)
        for line in block[1:]:
            write(line)
        y -= 3
    y -= 5
    write('EDUCATION', size=13, bold=True)
    for line in education:
        write(line, bold=('University' in line or 'Institute' in line or 'College' in line))
    y -= 5
    write('CERTIFICATIONS', size=13, bold=True)
    for cert in certs:
        write(f'- {cert}')
    c.save()

# Resume 1: Senior Software Engineer
make_resume('test_resumes/alex_kumar_resume.pdf',
    'Alex Kumar', 'Senior Software Engineer',
    'alex.kumar@gmail.com', '(512) 555-0199',
    'Austin, TX 78701', 'linkedin.com/in/alexkumar',
    ['Experienced Senior Software Engineer with 8+ years building scalable distributed systems.',
     'Expert in Python, Java, AWS, and microservices architecture.'],
    ['Languages: Python, Java, Go, JavaScript, TypeScript, SQL',
     'Frameworks: Django, Spring Boot, React, FastAPI, Flask',
     'Cloud: AWS (EC2, S3, Lambda, ECS, RDS), Docker, Kubernetes, Terraform',
     'Databases: PostgreSQL, MongoDB, Redis, DynamoDB, Elasticsearch',
     'Tools: Git, Jenkins, GitHub Actions, Kafka, RabbitMQ, Grafana'],
    [['Senior Software Engineer - Amazon Web Services',
      'Austin, TX | January 2021 - Present',
      '- Led migration of monolithic app to microservices architecture',
      '- Designed real-time data pipeline processing 1M+ events/day'],
     ['Software Engineer - Microsoft',
      'Seattle, WA | June 2017 - December 2020',
      '- Built RESTful APIs serving 100K+ requests per second',
      '- Implemented CI/CD pipelines reducing deployment time by 60%']],
    ['Master of Science in Computer Science',
     'University of Texas at Austin - 2017',
     'Bachelor of Technology in Computer Science',
     'Indian Institute of Technology Bombay - 2015'],
    ['AWS Solutions Architect Professional', 'Certified Kubernetes Administrator (CKA)'])
print('Resume 1: Alex Kumar created')

# Resume 2: Data Scientist
make_resume('test_resumes/priya_sharma_resume.pdf',
    'Priya Sharma', 'Data Scientist',
    'priya.sharma@outlook.com', '+1-415-555-0234',
    'San Francisco, CA 94105', 'linkedin.com/in/priyasharma',
    ['Data Scientist with 5 years of experience in machine learning, NLP, and deep learning.',
     'Published researcher with expertise in recommendation systems and computer vision.'],
    ['Languages: Python, R, SQL, Scala',
     'ML/AI: TensorFlow, PyTorch, scikit-learn, XGBoost, Hugging Face, LangChain',
     'Data: Spark, Airflow, dbt, Snowflake, BigQuery, Pandas, NumPy',
     'Cloud: AWS SageMaker, GCP Vertex AI, Azure ML',
     'Tools: MLflow, Weights and Biases, Jupyter, Git, Docker'],
    [['Senior Data Scientist - Meta',
      'San Francisco, CA | March 2022 - Present',
      '- Built recommendation engine increasing user engagement by 15%',
      '- Led NLP team developing content moderation models'],
     ['Data Scientist - Uber Technologies',
      'San Francisco, CA | July 2019 - February 2022',
      '- Developed demand forecasting models with 92% accuracy',
      '- Created real-time anomaly detection pipeline for fraud']],
    ['Master of Science in Data Science',
     'Stanford University - 2019',
     'Bachelor of Science in Mathematics',
     'University of California Berkeley - 2017'],
    ['Google Professional Machine Learning Engineer', 'AWS Machine Learning Specialty'])
print('Resume 2: Priya Sharma created')

# Resume 3: DevOps Engineer
make_resume('test_resumes/marcus_johnson_resume.pdf',
    'Marcus Johnson', 'DevOps Engineer',
    'marcus.j.devops@gmail.com', '(312) 555-0456',
    'Chicago, IL 60601', 'linkedin.com/in/marcusjohnson',
    ['DevOps Engineer with 6+ years automating infrastructure and CI/CD pipelines.',
     'Passionate about SRE practices, observability, and infrastructure as code.'],
    ['Infrastructure: Kubernetes, Docker, Terraform, Ansible, Helm',
     'Cloud: AWS, Azure, GCP multi-cloud experience',
     'CI/CD: Jenkins, GitHub Actions, GitLab CI, ArgoCD, CircleCI',
     'Monitoring: Prometheus, Grafana, Datadog, PagerDuty, ELK Stack',
     'Languages: Python, Bash, Go, YAML, HCL'],
    [['Senior DevOps Engineer - Netflix',
      'Chicago, IL (Remote) | May 2021 - Present',
      '- Managed Kubernetes clusters serving 200M+ subscribers',
      '- Reduced deployment failures by 80% with canary releases'],
     ['DevOps Engineer - Salesforce',
      'Chicago, IL | August 2018 - April 2021',
      '- Built infrastructure automation reducing provisioning time',
      '- Implemented zero-downtime deployment strategy']],
    ['Bachelor of Science in Information Technology',
     'University of Illinois at Chicago - 2018'],
    ['Certified Kubernetes Administrator (CKA)', 'AWS DevOps Engineer Professional',
     'HashiCorp Certified Terraform Associate'])
print('Resume 3: Marcus Johnson created')

# Resume 4: Frontend Developer
make_resume('test_resumes/sofia_rodriguez_resume.pdf',
    'Sofia Rodriguez', 'Frontend Developer',
    'sofia.rodriguez@yahoo.com', '(305) 555-0789',
    'Miami, FL 33101', 'linkedin.com/in/sofiarodriguez',
    ['Creative Frontend Developer with 4 years of experience building responsive web apps.',
     'Strong focus on accessibility, performance optimization, and modern UI frameworks.'],
    ['Frontend: React, Next.js, Vue.js, Angular, TypeScript, JavaScript ES6+',
     'Styling: Tailwind CSS, Styled Components, SASS, Material UI, Chakra UI',
     'Testing: Jest, Cypress, React Testing Library, Storybook',
     'Tools: Webpack, Vite, npm, Git, Figma, Adobe XD',
     'Backend: Node.js, Express, GraphQL, REST APIs'],
    [['Frontend Developer - Spotify',
      'Miami, FL (Remote) | September 2022 - Present',
      '- Built accessible music player components used by 500M+ users',
      '- Reduced page load time by 40% through code splitting'],
     ['Junior Frontend Developer - IBM',
      'Miami, FL | June 2020 - August 2022',
      '- Developed enterprise dashboard using React and TypeScript',
      '- Created reusable component library adopted by 12 teams']],
    ['Bachelor of Science in Computer Science',
     'Florida International University - 2020'],
    ['Meta Frontend Developer Certificate', 'Google UX Design Professional Certificate'])
print('Resume 4: Sofia Rodriguez created')

# Resume 5: Cloud Architect with visa info
make_resume('test_resumes/wei_chen_resume.pdf',
    'Wei Chen', 'Cloud Architect',
    'wei.chen.cloud@gmail.com', '+1-206-555-0345',
    'Seattle, WA 98101', 'linkedin.com/in/weichen',
    ['Cloud Architect with 10+ years designing enterprise cloud solutions.',
     'Work Authorization: H1B Visa. Willing to relocate.'],
    ['Cloud: AWS (15+ services), Azure, GCP, Multi-cloud architecture',
     'Infrastructure: Terraform, CloudFormation, Pulumi, Ansible',
     'Containers: Kubernetes, Docker, ECS, EKS, AKS',
     'Security: IAM, VPC, WAF, KMS, SSL/TLS, Zero Trust',
     'Languages: Python, Go, Java, Bash, PowerShell'],
    [['Principal Cloud Architect - Amazon Web Services',
      'Seattle, WA | April 2020 - Present',
      '- Designed multi-region disaster recovery for Fortune 500 clients',
      '- Led cloud migration of 200+ on-premise applications'],
     ['Senior Cloud Engineer - Google Cloud',
      'Mountain View, CA | January 2016 - March 2020',
      '- Built auto-scaling infrastructure handling 10B+ API calls daily'],
     ['Cloud Engineer - Deloitte',
      'New York, NY | August 2014 - December 2015',
      '- Migrated legacy systems to AWS for financial services clients']],
    ['Master of Science in Cloud Computing',
     'Carnegie Mellon University - 2014',
     'Bachelor of Engineering in Computer Science',
     'Tsinghua University, Beijing - 2012'],
    ['AWS Solutions Architect Professional', 'Google Cloud Professional Architect',
     'Azure Solutions Architect Expert', 'TOGAF 9 Certified'])
print('Resume 5: Wei Chen created')

print('\nAll 5 test resumes created!')
