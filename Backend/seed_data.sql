-- ============================================================
-- SEED DATA FOR RESUME PARSER APPLICATION
-- ============================================================

-- 1. JOB TITLES
INSERT INTO job_titles (job_title) VALUES
  ('Software Engineer'), ('Data Scientist'), ('DevOps Engineer'),
  ('Full Stack Developer'), ('Backend Developer'), ('Frontend Developer'),
  ('Cloud Architect'), ('Product Manager'), ('QA Engineer'),
  ('Machine Learning Engineer'), ('Mobile Developer'), ('UI/UX Designer'),
  ('Database Administrator'), ('Security Engineer'), ('Site Reliability Engineer')
ON CONFLICT (job_title) DO NOTHING;

-- 2. CANDIDATES
INSERT INTO candidate_profile (first_name, last_name, email, phone, address, qualification, visa_support, work_authorization_type, linkedin, resume_filename, resume_sha256, parsed_at, resume_parse_status, education_structured, work_experience_structured) VALUES
('John', 'Smith', 'john.smith@email.com', '+1-555-0101', 'New York, NY 10001', 'Masters in Computer Science', true, 'H1B', 'linkedin.com/in/johnsmith', 'john_smith_resume.pdf', 'sha256_001', NOW() - INTERVAL '30 days', 'completed',
  '[{"degree": "M.S.", "field": "Computer Science", "university": "MIT", "year": 2020, "gpa": "3.9"}]'::jsonb,
  '[{"title": "Senior Software Engineer", "company": "Google", "from": "2020", "to": "Present", "description": "Led microservices migration"}]'::jsonb),
('Sarah', 'Johnson', 'sarah.j@email.com', '+1-555-0102', 'San Francisco, CA 94102', 'Bachelors in Data Science', false, 'US Citizen', 'linkedin.com/in/sarahj', 'sarah_johnson_resume.pdf', 'sha256_002', NOW() - INTERVAL '25 days', 'completed',
  '[{"degree": "B.S.", "field": "Data Science", "university": "Stanford", "year": 2019}]'::jsonb,
  '[{"title": "Data Scientist", "company": "Meta", "from": "2019", "to": "Present", "description": "ML models for recommendation systems"}]'::jsonb),
('Michael', 'Chen', 'michael.chen@email.com', '+1-555-0103', 'Seattle, WA 98101', 'Bachelors in Software Engineering', true, 'OPT', 'linkedin.com/in/michaelchen', 'michael_chen_resume.pdf', 'sha256_003', NOW() - INTERVAL '20 days', 'completed',
  '[{"degree": "B.S.", "field": "Software Engineering", "university": "University of Washington", "year": 2021}]'::jsonb,
  '[{"title": "Full Stack Developer", "company": "Amazon", "from": "2021", "to": "Present", "description": "Built internal tools with React and Java"}]'::jsonb),
('Emily', 'Davis', 'emily.davis@email.com', '+1-555-0104', 'Austin, TX 73301', 'Masters in AI', false, 'Green Card', 'linkedin.com/in/emilydavis', 'emily_davis_resume.pdf', 'sha256_004', NOW() - INTERVAL '15 days', 'completed',
  '[{"degree": "M.S.", "field": "Artificial Intelligence", "university": "Carnegie Mellon", "year": 2018}]'::jsonb,
  '[{"title": "ML Engineer", "company": "Tesla", "from": "2018", "to": "Present", "description": "Computer vision for autonomous driving"}]'::jsonb),
('David', 'Wilson', 'david.wilson@email.com', '+1-555-0105', 'Chicago, IL 60601', 'Bachelors in IT', true, 'H1B', 'linkedin.com/in/davidwilson', 'david_wilson_resume.pdf', 'sha256_005', NOW() - INTERVAL '10 days', 'completed',
  '[{"degree": "B.S.", "field": "Information Technology", "university": "UIUC", "year": 2017}]'::jsonb,
  '[{"title": "DevOps Engineer", "company": "Netflix", "from": "2017", "to": "Present", "description": "CI/CD pipelines and Kubernetes"}]'::jsonb),
('Jessica', 'Brown', 'jessica.brown@email.com', '+1-555-0106', 'Denver, CO 80201', 'Masters in Computer Engineering', false, 'US Citizen', 'linkedin.com/in/jessicabrown', 'jessica_brown_resume.pdf', 'sha256_006', NOW() - INTERVAL '8 days', 'completed',
  '[{"degree": "M.S.", "field": "Computer Engineering", "university": "Georgia Tech", "year": 2019}]'::jsonb,
  '[{"title": "Cloud Architect", "company": "Microsoft", "from": "2019", "to": "Present", "description": "Azure infrastructure design"}]'::jsonb),
('Robert', 'Taylor', 'robert.taylor@email.com', '+1-555-0107', 'Boston, MA 02101', 'Bachelors in Computer Science', true, 'L1', 'linkedin.com/in/roberttaylor', 'robert_taylor_resume.pdf', 'sha256_007', NOW() - INTERVAL '5 days', 'completed',
  '[{"degree": "B.S.", "field": "Computer Science", "university": "Harvard", "year": 2016}]'::jsonb,
  '[{"title": "Backend Developer", "company": "Stripe", "from": "2016", "to": "Present", "description": "Payment processing APIs in Go"}]'::jsonb),
('Amanda', 'Martinez', 'amanda.m@email.com', '+1-555-0108', 'Los Angeles, CA 90001', 'Masters in UX Design', false, 'US Citizen', 'linkedin.com/in/amandamartinez', 'amanda_martinez_resume.pdf', 'sha256_008', NOW() - INTERVAL '3 days', 'completed',
  '[{"degree": "M.F.A.", "field": "UX Design", "university": "UCLA", "year": 2020}]'::jsonb,
  '[{"title": "UI/UX Designer", "company": "Apple", "from": "2020", "to": "Present", "description": "iOS design system"}]'::jsonb),
('James', 'Anderson', 'james.anderson@email.com', '+1-555-0109', 'Portland, OR 97201', 'Bachelors in Cybersecurity', true, 'H1B', 'linkedin.com/in/jamesanderson', 'james_anderson_resume.pdf', 'sha256_009', NOW() - INTERVAL '2 days', 'completed',
  '[{"degree": "B.S.", "field": "Cybersecurity", "university": "Oregon State", "year": 2018}]'::jsonb,
  '[{"title": "Security Engineer", "company": "CrowdStrike", "from": "2018", "to": "Present", "description": "Threat detection and incident response"}]'::jsonb),
('Lisa', 'Thomas', 'lisa.thomas@email.com', '+1-555-0110', 'Miami, FL 33101', 'Bachelors in Computer Science', false, 'Green Card', 'linkedin.com/in/lisathomas', 'lisa_thomas_resume.pdf', 'sha256_010', NOW() - INTERVAL '1 day', 'completed',
  '[{"degree": "B.S.", "field": "Computer Science", "university": "University of Miami", "year": 2020}]'::jsonb,
  '[{"title": "QA Engineer", "company": "Salesforce", "from": "2020", "to": "Present", "description": "Automated testing frameworks"}]'::jsonb),
('Daniel', 'Garcia', 'daniel.garcia@email.com', '+1-555-0111', 'Dallas, TX 75201', 'Masters in Data Engineering', true, 'OPT', 'linkedin.com/in/danielgarcia', 'daniel_garcia_resume.pdf', 'sha256_011', NOW(), 'completed',
  '[{"degree": "M.S.", "field": "Data Engineering", "university": "UT Austin", "year": 2021}]'::jsonb,
  '[{"title": "Data Engineer", "company": "Uber", "from": "2021", "to": "Present", "description": "Real-time data pipelines with Spark"}]'::jsonb),
('Rachel', 'Lee', 'rachel.lee@email.com', '+1-555-0112', 'Atlanta, GA 30301', 'Bachelors in Mobile Development', false, 'US Citizen', 'linkedin.com/in/rachellee', 'rachel_lee_resume.pdf', 'sha256_012', NOW(), 'completed',
  '[{"degree": "B.S.", "field": "Computer Science", "university": "Emory", "year": 2019}]'::jsonb,
  '[{"title": "Mobile Developer", "company": "Airbnb", "from": "2019", "to": "Present", "description": "React Native cross-platform apps"}]'::jsonb)
ON CONFLICT (resume_sha256) DO NOTHING;

-- 3. SKILLS for each candidate
INSERT INTO candidate_skills_profile (candidate_id, job_id, job_title, tech_skills, years_of_experience, certifications, parsed_at)
SELECT cp.id, jt.id, jt.job_title, v.skills, v.exp, v.certs, cp.parsed_at
FROM (VALUES
  ('john.smith@email.com', 'Software Engineer', 'Python, Java, Go, Kubernetes, AWS, Docker, PostgreSQL, Redis, gRPC', 6, 'AWS Solutions Architect, Google Cloud Professional'),
  ('sarah.j@email.com', 'Data Scientist', 'Python, R, TensorFlow, PyTorch, SQL, Spark, Tableau, scikit-learn', 5, 'Google TensorFlow Developer, AWS ML Specialty'),
  ('michael.chen@email.com', 'Full Stack Developer', 'React, TypeScript, Node.js, Java, Spring Boot, PostgreSQL, MongoDB, GraphQL', 3, 'Meta Frontend Developer Certified'),
  ('emily.davis@email.com', 'Machine Learning Engineer', 'Python, C++, TensorFlow, PyTorch, OpenCV, CUDA, MLflow, AWS SageMaker', 6, 'Deep Learning Specialization, AWS ML'),
  ('david.wilson@email.com', 'DevOps Engineer', 'Kubernetes, Terraform, AWS, Docker, Jenkins, GitHub Actions, Ansible, Prometheus', 7, 'CKA, AWS DevOps Professional, HashiCorp Terraform'),
  ('jessica.brown@email.com', 'Cloud Architect', 'Azure, AWS, GCP, Terraform, Kubernetes, Networking, Security, Python', 5, 'Azure Solutions Architect Expert, AWS SAP'),
  ('robert.taylor@email.com', 'Backend Developer', 'Go, Python, PostgreSQL, Redis, gRPC, Kafka, Docker, Microservices', 8, 'Google Go Developer'),
  ('amanda.m@email.com', 'UI/UX Designer', 'Figma, Sketch, Adobe XD, CSS, HTML, React, User Research, Prototyping', 4, 'Google UX Design Certificate'),
  ('james.anderson@email.com', 'Security Engineer', 'Python, Wireshark, Metasploit, AWS Security, SIEM, Incident Response, Linux', 6, 'CISSP, CEH, CompTIA Security+'),
  ('lisa.thomas@email.com', 'QA Engineer', 'Selenium, Cypress, Python, Java, JUnit, TestRail, Postman, CI/CD', 4, 'ISTQB Foundation, AWS Certified'),
  ('daniel.garcia@email.com', 'Data Scientist', 'Python, Spark, Kafka, Airflow, dbt, Snowflake, AWS, SQL', 3, 'Databricks Spark Developer'),
  ('rachel.lee@email.com', 'Mobile Developer', 'React Native, Swift, Kotlin, TypeScript, Firebase, GraphQL, Redux', 5, 'Meta React Native Certified')
) AS v(email, title, skills, exp, certs)
JOIN candidate_profile cp ON cp.email = v.email
JOIN job_titles jt ON jt.job_title = v.title
ON CONFLICT (candidate_id) DO NOTHING;

-- 4. JOBS
INSERT INTO jobs (id, job_title, company, priority, status, location, department, open_positions, category, employment_type, skills, job_description, created_at, updated_at) VALUES
(gen_random_uuid(), 'Senior Software Engineer', 'TechCorp Inc.', 'High', 'POSTED', 'New York, NY', 'Engineering', 3, 'Technology', 'Full-time', 'Python, Java, AWS, Microservices', 'We are looking for a Senior Software Engineer to lead our backend team. You will design and build scalable microservices.', NOW() - INTERVAL '20 days', NOW()),
(gen_random_uuid(), 'Data Scientist', 'DataFlow Analytics', 'Normal', 'POSTED', 'San Francisco, CA', 'Data Science', 2, 'Analytics', 'Full-time', 'Python, TensorFlow, SQL, Spark', 'Join our data science team to build ML models that drive business decisions. Experience with NLP preferred.', NOW() - INTERVAL '15 days', NOW()),
(gen_random_uuid(), 'DevOps Engineer', 'CloudScale Systems', 'High', 'POSTED', 'Remote', 'Infrastructure', 1, 'Technology', 'Full-time', 'Kubernetes, Terraform, AWS, Docker', 'Seeking a DevOps engineer to manage our cloud infrastructure and CI/CD pipelines.', NOW() - INTERVAL '10 days', NOW()),
(gen_random_uuid(), 'Full Stack Developer', 'WebDev Solutions', 'Normal', 'POSTED', 'Austin, TX', 'Engineering', 2, 'Technology', 'Full-time', 'React, Node.js, PostgreSQL, TypeScript', 'Build modern web applications using React and Node.js. Strong TypeScript skills required.', NOW() - INTERVAL '7 days', NOW()),
(gen_random_uuid(), 'Cloud Architect', 'Enterprise Cloud Co.', 'High', 'POSTED', 'Seattle, WA', 'Architecture', 1, 'Technology', 'Full-time', 'Azure, AWS, GCP, Terraform, Kubernetes', 'Design and implement cloud-native solutions for enterprise clients.', NOW() - INTERVAL '5 days', NOW()),
(gen_random_uuid(), 'QA Engineer', 'QualityFirst Labs', 'Normal', 'DRAFT', 'Chicago, IL', 'Quality', 2, 'Technology', 'Full-time', 'Selenium, Cypress, Python, CI/CD', 'Develop and maintain automated testing frameworks for our SaaS platform.', NOW() - INTERVAL '3 days', NOW()),
(gen_random_uuid(), 'Mobile Developer', 'AppWorks Studio', 'Normal', 'POSTED', 'Los Angeles, CA', 'Mobile', 1, 'Technology', 'Contract', 'React Native, Swift, Kotlin, Firebase', 'Build cross-platform mobile apps for iOS and Android.', NOW() - INTERVAL '1 day', NOW()),
(gen_random_uuid(), 'Security Engineer', 'SecureNet Corp.', 'High', 'HOLD', 'Portland, OR', 'Security', 1, 'Technology', 'Full-time', 'SIEM, Python, AWS Security, Incident Response', 'Protect our infrastructure and respond to security incidents.', NOW(), NOW());

-- 5. CUSTOMERS
INSERT INTO customers (id, customer_id, customer_type, salutation, first_name, last_name, company_name, display_name, email, phone, country_code, currency, is_active, created_by, created_at, updated_at) VALUES
(gen_random_uuid(), 'CUST-001', 'Business', 'Mr.', 'Thomas', 'Wright', 'TechCorp Inc.', 'TechCorp Inc.', 'thomas@techcorp.com', '+1-555-1001', 'US', 'USD', true, 'admin', NOW() - INTERVAL '60 days', NOW()),
(gen_random_uuid(), 'CUST-002', 'Business', 'Ms.', 'Patricia', 'Moore', 'DataFlow Analytics', 'DataFlow Analytics', 'patricia@dataflow.com', '+1-555-1002', 'US', 'USD', true, 'admin', NOW() - INTERVAL '45 days', NOW()),
(gen_random_uuid(), 'CUST-003', 'Business', 'Mr.', 'Kevin', 'Hall', 'CloudScale Systems', 'CloudScale Systems', 'kevin@cloudscale.com', '+1-555-1003', 'US', 'USD', true, 'admin', NOW() - INTERVAL '30 days', NOW()),
(gen_random_uuid(), 'CUST-004', 'Individual', 'Ms.', 'Nancy', 'Allen', 'WebDev Solutions', 'WebDev Solutions', 'nancy@webdev.com', '+1-555-1004', 'US', 'USD', true, 'admin', NOW() - INTERVAL '15 days', NOW()),
(gen_random_uuid(), 'CUST-005', 'Business', 'Mr.', 'George', 'Young', 'Enterprise Cloud Co.', 'Enterprise Cloud Co.', 'george@entcloud.com', '+1-555-1005', 'US', 'USD', false, 'admin', NOW() - INTERVAL '5 days', NOW());

-- 6. CONTACT PERSONS for customers
INSERT INTO contact_persons (id, customer_id, salutation, first_name, last_name, email, work_phone, mobile, created_at)
SELECT gen_random_uuid(), c.id, v.salutation, v.fn, v.ln, v.email, v.phone, v.mobile, NOW()
FROM (VALUES
  ('CUST-001', 'Mr.', 'James', 'Parker', 'james.parker@techcorp.com', '+1-555-2001', '+1-555-2002'),
  ('CUST-001', 'Ms.', 'Linda', 'Scott', 'linda.scott@techcorp.com', '+1-555-2003', '+1-555-2004'),
  ('CUST-002', 'Mr.', 'Brian', 'Adams', 'brian.adams@dataflow.com', '+1-555-2005', '+1-555-2006'),
  ('CUST-003', 'Ms.', 'Karen', 'Nelson', 'karen.nelson@cloudscale.com', '+1-555-2007', '+1-555-2008')
) AS v(cust_id, salutation, fn, ln, email, phone, mobile)
JOIN customers c ON c.customer_id = v.cust_id;

-- 7. STANDALONE COMMENTS on candidates
INSERT INTO standalone_candidate_comments (candidate_id, comment_text, created_at)
SELECT cp.id::text, v.comment, NOW() - v.days_ago * INTERVAL '1 day'
FROM (VALUES
  ('john.smith@email.com', 'Excellent candidate. Strong in system design. Scheduled for final round.', 5),
  ('john.smith@email.com', 'Passed technical screening with flying colors.', 10),
  ('sarah.j@email.com', 'Great ML skills. Recommended for Data Science role at DataFlow.', 3),
  ('michael.chen@email.com', 'Good React skills but needs more backend experience.', 7),
  ('emily.davis@email.com', 'Impressive CV background. Fast-tracked for interview.', 2),
  ('david.wilson@email.com', 'Strong DevOps background. Perfect for CloudScale position.', 4),
  ('robert.taylor@email.com', 'Solid Go experience. Stripe will love him.', 1)
) AS v(email, comment, days_ago)
JOIN candidate_profile cp ON cp.email = v.email;

-- 8. CANDIDATE COMMENTS
INSERT INTO candidate_comments (candidate_id, comment_text, created_at)
SELECT cp.id, v.comment, NOW() - v.days_ago * INTERVAL '1 day'
FROM (VALUES
  ('john.smith@email.com', 'Follow up scheduled for next week.', 2),
  ('sarah.j@email.com', 'Salary expectations within budget. Proceed with offer.', 1),
  ('emily.davis@email.com', 'Needs visa sponsorship - check with legal team.', 3),
  ('david.wilson@email.com', 'Available to start in 2 weeks.', 1)
) AS v(email, comment, days_ago)
JOIN candidate_profile cp ON cp.email = v.email;

-- 9. Additional USERS (besides admin)
DO $$
DECLARE
  hashed TEXT;
BEGIN
  -- Use simple bcrypt-compatible hash
  SELECT password_hash INTO hashed FROM users WHERE username = 'admin' LIMIT 1;

  INSERT INTO users (username, email, password_hash, role, is_active, total_logins, created_at) VALUES
    ('recruiter1', 'recruiter1@company.com', hashed, 'user', true, 5, NOW() - INTERVAL '30 days'),
    ('recruiter2', 'recruiter2@company.com', hashed, 'user', true, 3, NOW() - INTERVAL '20 days'),
    ('manager', 'manager@company.com', hashed, 'admin', true, 8, NOW() - INTERVAL '45 days')
  ON CONFLICT (username) DO NOTHING;
END $$;

-- Done
SELECT 'Seed data inserted successfully' AS status;
