-- ============================================================
-- COMPREHENSIVE DUMMY DATA FOR ALL MODULES
-- Run: psql -U postgres -d resume_dev -f seed_all_dummy_data.sql
-- ============================================================

-- ── 1. USERS (all 12 roles) ─────────────────────────────────
DO $$
DECLARE
    admin_hash TEXT;
BEGIN
    SELECT password_hash INTO admin_hash FROM users WHERE username = 'admin' LIMIT 1;
    IF admin_hash IS NULL THEN admin_hash := '$2b$12$dummy'; END IF;

    INSERT INTO users (username, email, password_hash, role, is_active, total_logins, created_at) VALUES
    ('recruiter1',       'recruiter1@kprmt.com',     admin_hash, 'recruiter',            true, 12, NOW()-INTERVAL '60 days'),
    ('recruiter2',       'recruiter2@kprmt.com',     admin_hash, 'recruiter',            true,  8, NOW()-INTERVAL '45 days'),
    ('freelancer1',      'freelancer1@kprmt.com',    admin_hash, 'recruiter_freelance',  true,  3, NOW()-INTERVAL '30 days'),
    ('teamlead_sarah',   'sarah.lead@kprmt.com',     admin_hash, 'recruiter_lead',       true, 20, NOW()-INTERVAL '90 days'),
    ('bench_mike',       'mike.bench@kprmt.com',     admin_hash, 'bench_sales',          true,  6, NOW()-INTERVAL '40 days'),
    ('bench_lead_tom',   'tom.benchlead@kprmt.com',  admin_hash, 'bench_sales_lead',     true, 10, NOW()-INTERVAL '70 days'),
    ('uploader1',        'uploader@kprmt.com',       admin_hash, 'upload_user',          true,  2, NOW()-INTERVAL '20 days'),
    ('acctmgr_lisa',     'lisa.acctmgr@kprmt.com',   admin_hash, 'account_manager',      true, 15, NOW()-INTERVAL '80 days'),
    ('vp_david',         'david.vp@kprmt.com',       admin_hash, 'vp',                   true, 25, NOW()-INTERVAL '120 days'),
    ('hr_nancy',         'nancy.hr@kprmt.com',       admin_hash, 'hr',                   true, 18, NOW()-INTERVAL '100 days'),
    ('superadmin_co',    'admin.company@kprmt.com',  admin_hash, 'super_admin_company',  true, 30, NOW()-INTERVAL '150 days'),
    ('platform_admin',   'platform@kprmt.com',       admin_hash, 'super_admin_platform', true,  5, NOW()-INTERVAL '180 days'),
    ('dev_support',      'devsupport@kprmt.com',     admin_hash, 'support_admin',        true,  7, NOW()-INTERVAL '50 days')
    ON CONFLICT (username) DO NOTHING;

    RAISE NOTICE 'Users seeded';
END $$;

-- ── 2. MARKET STATUS for existing candidates ────────────────
UPDATE candidate_profile SET market_status = 'open_to_work' WHERE market_status IS NULL;
UPDATE candidate_profile SET market_status = 'actively_looking' WHERE email IN ('john.smith@email.com', 'sarah.j@email.com', 'emily.davis@email.com');
UPDATE candidate_profile SET market_status = 'not_available', market_status_note = 'Accepted offer at Google, starting next month' WHERE email = 'robert.taylor@email.com';
UPDATE candidate_profile SET market_status = 'available_higher_rate', market_status_note = 'Looking for $180k+ base only' WHERE email = 'jessica.brown@email.com';
UPDATE candidate_profile SET market_status = 'passive', market_status_note = 'Happy at current role but open to exceptional offers' WHERE email = 'david.wilson@email.com';
UPDATE candidate_profile SET market_status = 'available_higher_rate', market_status_note = 'Requires 200k+ for relocation' WHERE email = 'michael.chen@email.com';
UPDATE candidate_profile SET market_status = 'actively_looking', market_status_note = 'Laid off, immediately available' WHERE email = 'lisa.thomas@email.com';
UPDATE candidate_profile SET market_status = 'not_available', market_status_note = 'On H1B transfer, cannot switch for 3 months' WHERE email = 'james.anderson@email.com';
UPDATE candidate_profile SET market_status_updated_at = NOW() - (random() * INTERVAL '30 days') WHERE market_status IS NOT NULL;

-- ── 3. More JOBS with variety ────────────────────────────────
INSERT INTO jobs (id, job_title, company, priority, status, location, department, open_positions, category, employment_type, skills, job_description, experience, created_at, updated_at) VALUES
(gen_random_uuid(), 'React Developer', 'TechCorp Inc.', 'High', 'POSTED', 'Remote', 'Engineering', 2, 'Technology', 'Full-time', 'React, TypeScript, Node.js, GraphQL, REST APIs', 'Looking for an experienced React developer to build our next-generation web platform. Must have strong TypeScript and state management skills.', '3+ years', NOW()-INTERVAL '5 days', NOW()),
(gen_random_uuid(), 'Python Developer', 'DataFlow Analytics', 'Normal', 'POSTED', 'San Francisco, CA', 'Engineering', 1, 'Technology', 'Full-time', 'Python, Django, FastAPI, PostgreSQL, Redis, Docker', 'Python backend developer for our analytics platform. Experience with data pipelines and REST API design required.', '4+ years', NOW()-INTERVAL '10 days', NOW()),
(gen_random_uuid(), 'Machine Learning Engineer', 'AI Innovations LLC', 'High', 'POSTED', 'Austin, TX (Hybrid)', 'Data Science', 2, 'Technology', 'Full-time', 'Python, TensorFlow, PyTorch, MLflow, AWS SageMaker, Kubernetes', 'Build and deploy production ML models. Experience with NLP and computer vision preferred.', '5+ years', NOW()-INTERVAL '3 days', NOW()),
(gen_random_uuid(), 'Site Reliability Engineer', 'CloudScale Systems', 'High', 'POSTED', 'Remote', 'Infrastructure', 1, 'Technology', 'Full-time', 'Kubernetes, Terraform, AWS, Prometheus, Grafana, Python, Go', 'SRE to ensure 99.99% uptime for our distributed platform. On-call rotation required.', '4+ years', NOW()-INTERVAL '7 days', NOW()),
(gen_random_uuid(), 'iOS Developer', 'AppWorks Studio', 'Normal', 'POSTED', 'Los Angeles, CA', 'Mobile', 1, 'Technology', 'Contract', 'Swift, SwiftUI, UIKit, Core Data, REST APIs, Firebase', 'iOS developer for our consumer mobile app. App Store publishing experience required.', '3+ years', NOW()-INTERVAL '12 days', NOW()),
(gen_random_uuid(), 'Database Administrator', 'Enterprise Cloud Co.', 'Normal', 'DRAFT', 'Chicago, IL', 'Infrastructure', 1, 'Technology', 'Full-time', 'PostgreSQL, MySQL, MongoDB, Redis, AWS RDS, Performance Tuning', 'Senior DBA to manage our multi-database infrastructure across AWS and on-prem.', '6+ years', NOW()-INTERVAL '2 days', NOW()),
(gen_random_uuid(), 'Scrum Master', 'WebDev Solutions', 'Low', 'POSTED', 'Denver, CO (Hybrid)', 'Project Management', 1, 'Management', 'Full-time', 'Agile, Scrum, Jira, Confluence, SAFe, Kanban', 'Certified Scrum Master to lead 3 agile teams. SAFe experience is a plus.', '3+ years', NOW()-INTERVAL '8 days', NOW()),
(gen_random_uuid(), 'Cybersecurity Analyst', 'SecureNet Corp.', 'High', 'POSTED', 'Washington, DC', 'Security', 2, 'Technology', 'Full-time', 'SIEM, Splunk, Python, Incident Response, Threat Intelligence, CompTIA Security+', 'Cybersecurity analyst for our SOC team. Must have active security clearance.', '3+ years', NOW()-INTERVAL '4 days', NOW()),
(gen_random_uuid(), 'UI/UX Designer', 'Creative Digital Agency', 'Normal', 'POSTED', 'New York, NY', 'Design', 1, 'Design', 'Full-time', 'Figma, Sketch, Adobe XD, User Research, Prototyping, Design Systems', 'Senior UI/UX designer to lead product design for enterprise SaaS products.', '4+ years', NOW()-INTERVAL '6 days', NOW()),
(gen_random_uuid(), 'SAP Consultant', 'Global Consulting Partners', 'High', 'POSTED', 'Dallas, TX', 'Consulting', 3, 'Consulting', 'Contract', 'SAP S/4HANA, SAP FICO, SAP MM, ABAP, SAP BTP', 'SAP implementation consultant for Fortune 500 client. Travel required 50%.', '7+ years', NOW()-INTERVAL '1 day', NOW())
ON CONFLICT DO NOTHING;

-- ── 4. More CUSTOMERS ────────────────────────────────────────
INSERT INTO customers (id, customer_id, customer_type, salutation, first_name, last_name, company_name, display_name, email, phone, country_code, currency, is_active, created_by, created_at, updated_at) VALUES
(gen_random_uuid(), 'CUST-006', 'Business', 'Mr.', 'Robert', 'Chen', 'AI Innovations LLC', 'AI Innovations LLC', 'robert.chen@aiinnovations.com', '+1-555-2001', 'US', 'USD', true, 'admin', NOW()-INTERVAL '25 days', NOW()),
(gen_random_uuid(), 'CUST-007', 'Business', 'Ms.', 'Diana', 'Rodriguez', 'Creative Digital Agency', 'Creative Digital Agency', 'diana@creativedigital.com', '+1-555-2002', 'US', 'USD', true, 'admin', NOW()-INTERVAL '20 days', NOW()),
(gen_random_uuid(), 'CUST-008', 'Business', 'Mr.', 'Steve', 'Park', 'Global Consulting Partners', 'Global Consulting Partners', 'steve.park@globalconsulting.com', '+1-555-2003', 'US', 'USD', true, 'admin', NOW()-INTERVAL '15 days', NOW()),
(gen_random_uuid(), 'CUST-009', 'Individual', 'Ms.', 'Rachel', 'Kim', 'Startup Nexus', 'Startup Nexus', 'rachel@startupnexus.com', '+1-555-2004', 'US', 'USD', true, 'admin', NOW()-INTERVAL '10 days', NOW()),
(gen_random_uuid(), 'CUST-010', 'Business', 'Mr.', 'James', 'O''Brien', 'FinTech Solutions Inc.', 'FinTech Solutions Inc.', 'james@fintechsolutions.com', '+1-555-2005', 'US', 'USD', false, 'admin', NOW()-INTERVAL '5 days', NOW())
ON CONFLICT DO NOTHING;

-- ── 5. CONTACT PERSONS for new customers ─────────────────────
INSERT INTO contact_persons (id, customer_id, salutation, first_name, last_name, email, work_phone, mobile, created_at)
SELECT gen_random_uuid(), c.id, v.sal, v.fn, v.ln, v.email, v.phone, v.mob, NOW()
FROM (VALUES
  ('CUST-006', 'Dr.', 'Alan', 'Wu', 'alan.wu@aiinnovations.com', '+1-555-3001', '+1-555-3002'),
  ('CUST-007', 'Ms.', 'Maria', 'Santos', 'maria@creativedigital.com', '+1-555-3003', '+1-555-3004'),
  ('CUST-008', 'Mr.', 'Kevin', 'Patel', 'kevin.patel@globalconsulting.com', '+1-555-3005', '+1-555-3006'),
  ('CUST-009', 'Ms.', 'Jenny', 'Liu', 'jenny@startupnexus.com', '+1-555-3007', '+1-555-3008')
) AS v(cid, sal, fn, ln, email, phone, mob)
JOIN customers c ON c.customer_id = v.cid;

-- ── 6. More PIPELINE candidates ──────────────────────────────
DO $$
DECLARE
    pc UUID;
    cid INT;
BEGIN
    -- Add some bulk-uploaded candidates to pipeline with varied stages
    FOR cid IN (SELECT id FROM candidate_profile WHERE id > 17 AND id <= 50 ORDER BY random() LIMIT 20)
    LOOP
        pc := gen_random_uuid();
        INSERT INTO pipeline_candidates (id, candidate_id, candidate_name, candidate_email,
            current_stage, stage_order, stage_status, is_active, is_archived, added_by, created_at, updated_at)
        SELECT pc, cp.id,
            COALESCE(cp.first_name, '') || ' ' || COALESCE(cp.last_name, ''),
            cp.email,
            (ARRAY['screening','written_test','level_1','level_2','level_3','offer'])[floor(random()*6+1)],
            floor(random()*6),
            'active', true, false, 'admin',
            NOW() - (random() * INTERVAL '30 days'), NOW()
        FROM candidate_profile cp WHERE cp.id = cid
        ON CONFLICT DO NOTHING;
    END LOOP;

    RAISE NOTICE 'Pipeline candidates added';
END $$;

-- ── 7. More INTERVIEWS ───────────────────────────────────────
DO $$
DECLARE
    jid UUID;
    cid INT;
BEGIN
    SELECT id INTO jid FROM jobs WHERE status = 'POSTED' ORDER BY random() LIMIT 1;

    FOR cid IN (SELECT id FROM candidate_profile WHERE id BETWEEN 20 AND 40 ORDER BY random() LIMIT 8)
    LOOP
        INSERT INTO interviews (id, candidate_id, candidate_name, candidate_email, job_id, job_title,
            interview_type, round_number, round_label, scheduled_date, scheduled_end, duration_minutes,
            meeting_platform, meeting_link, status, created_by, created_at, updated_at)
        SELECT gen_random_uuid(), cp.id,
            COALESCE(cp.first_name,'') || ' ' || COALESCE(cp.last_name,''),
            cp.email, jid,
            (SELECT job_title FROM jobs WHERE id = jid),
            (ARRAY['technical','behavioral','panel','phone','video'])[floor(random()*5+1)],
            floor(random()*3+1),
            'Round ' || floor(random()*3+1)::text,
            NOW() + (random() * INTERVAL '14 days'),
            NOW() + (random() * INTERVAL '14 days') + INTERVAL '60 minutes',
            60,
            (ARRAY['zoom','teams','google_meet'])[floor(random()*3+1)],
            'https://zoom.us/j/' || substring(gen_random_uuid()::text, 1, 8),
            (ARRAY['scheduled','confirmed','completed'])[floor(random()*3+1)],
            'admin', NOW() - (random() * INTERVAL '10 days'), NOW()
        FROM candidate_profile cp WHERE cp.id = cid;
    END LOOP;

    RAISE NOTICE 'Interviews added';
END $$;

-- ── 8. ATS ANALYSIS CONFIGS (auto-run for some jobs) ─────────
INSERT INTO ats_analysis_config (id, job_id, job_title, is_enabled, auto_run, min_score_threshold,
    weight_skills, weight_experience, weight_location, weight_education, weight_title,
    created_by, created_at, updated_at)
SELECT gen_random_uuid(), j.id, j.job_title, true,
    (random() > 0.5),  -- 50% auto-run
    40, 40, 20, 15, 10, 15, 'admin', NOW(), NOW()
FROM jobs j WHERE j.status = 'POSTED'
ON CONFLICT DO NOTHING;

-- ── 9. STANDALONE COMMENTS on more candidates ────────────────
INSERT INTO standalone_candidate_comments (candidate_id, comment_text, created_at)
SELECT cp.id::text,
    (ARRAY[
        'Good communication skills. Recommend for technical round.',
        'Strong portfolio. Schedule panel interview.',
        'Salary expectations too high for this role.',
        'Perfect fit for the remote position.',
        'Need to verify certifications before proceeding.',
        'Excellent references from previous employer.',
        'Overqualified but interested in the role.',
        'Resume gaps need clarification in interview.',
        'Top candidate - fast-track through pipeline.',
        'Cultural fit assessment pending.',
        'Technical skills verified via coding challenge.',
        'Available to start immediately.',
        'Requires visa sponsorship - check with legal.',
        'Internal referral from engineering team.',
        'Previously interviewed - passed first round last quarter.'
    ])[floor(random()*15+1)],
    NOW() - (random() * INTERVAL '20 days')
FROM candidate_profile cp
WHERE cp.id BETWEEN 20 AND 60
ORDER BY random() LIMIT 25;

-- ── 10. SEARCH HISTORY ───────────────────────────────────────
INSERT INTO search_history (id, query, created_at)
SELECT gen_random_uuid(), q, NOW() - (random() * INTERVAL '30 days')
FROM (VALUES
    ('Python Developer'), ('React Engineer'), ('DevOps'), ('Data Scientist'),
    ('Cloud Architect'), ('Full Stack'), ('Machine Learning'), ('iOS Developer'),
    ('Security Engineer'), ('DBA'), ('Scrum Master'), ('SAP Consultant'),
    ('Java Spring Boot'), ('Kubernetes'), ('AWS Solutions Architect')
) AS v(q);

-- ── 11. LOGIN SESSIONS for users ─────────────────────────────
INSERT INTO login_sessions (id, user_id, username, ip_address, logged_in_at, resumes_uploaded_this_session)
SELECT gen_random_uuid(), u.id, u.username, '127.0.0.1',
    NOW() - (random() * INTERVAL '30 days'),
    floor(random() * 10)
FROM users u
CROSS JOIN generate_series(1, 3);

-- ── Summary ──────────────────────────────────────────────────
SELECT 'Users: ' || COUNT(*) FROM users
UNION ALL SELECT 'Candidates: ' || COUNT(*) FROM candidate_profile
UNION ALL SELECT 'Jobs: ' || COUNT(*) FROM jobs
UNION ALL SELECT 'Customers: ' || COUNT(*) FROM customers
UNION ALL SELECT 'Contact Persons: ' || COUNT(*) FROM contact_persons
UNION ALL SELECT 'Pipeline Candidates: ' || COUNT(*) FROM pipeline_candidates
UNION ALL SELECT 'Interviews: ' || COUNT(*) FROM interviews
UNION ALL SELECT 'Interview Panels: ' || COUNT(*) FROM interview_panels
UNION ALL SELECT 'Interview Feedback: ' || COUNT(*) FROM interview_feedback
UNION ALL SELECT 'Pipeline Feedback: ' || COUNT(*) FROM pipeline_feedback
UNION ALL SELECT 'Pipeline Scorecards: ' || COUNT(*) FROM pipeline_scorecards
UNION ALL SELECT 'ATS Configs: ' || COUNT(*) FROM ats_analysis_config
UNION ALL SELECT 'ATS Match Results: ' || COUNT(*) FROM ats_match_results
UNION ALL SELECT 'Comments: ' || COUNT(*) FROM standalone_candidate_comments
UNION ALL SELECT 'Search History: ' || COUNT(*) FROM search_history
UNION ALL SELECT 'Login Sessions: ' || COUNT(*) FROM login_sessions
UNION ALL SELECT 'Email Templates: ' || COUNT(*) FROM email_templates
UNION ALL SELECT 'User Roles: ' || COUNT(*) FROM user_roles;
