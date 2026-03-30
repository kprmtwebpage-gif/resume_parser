-- ============================================================
-- SEED DATA FOR INTERVIEW SCHEDULING MODULE
-- ============================================================

-- Get some candidate IDs and job IDs to reference
DO $$
DECLARE
    cid1 INT; cid2 INT; cid3 INT; cid4 INT; cid5 INT; cid6 INT;
    jid1 UUID; jid2 UUID; jid3 UUID; jid4 UUID;
    iv1 UUID; iv2 UUID; iv3 UUID; iv4 UUID; iv5 UUID; iv6 UUID;
    iv7 UUID; iv8 UUID; iv9 UUID; iv10 UUID; iv11 UUID; iv12 UUID;
BEGIN
    SELECT id INTO cid1 FROM candidate_profile WHERE email = 'john.smith@email.com';
    SELECT id INTO cid2 FROM candidate_profile WHERE email = 'sarah.j@email.com';
    SELECT id INTO cid3 FROM candidate_profile WHERE email = 'michael.chen@email.com';
    SELECT id INTO cid4 FROM candidate_profile WHERE email = 'emily.davis@email.com';
    SELECT id INTO cid5 FROM candidate_profile WHERE email = 'david.wilson@email.com';
    SELECT id INTO cid6 FROM candidate_profile WHERE email = 'jessica.brown@email.com';

    SELECT id INTO jid1 FROM jobs WHERE job_title = 'Senior Software Engineer' LIMIT 1;
    SELECT id INTO jid2 FROM jobs WHERE job_title = 'Data Scientist' LIMIT 1;
    SELECT id INTO jid3 FROM jobs WHERE job_title = 'DevOps Engineer' LIMIT 1;
    SELECT id INTO jid4 FROM jobs WHERE job_title = 'Cloud Architect' LIMIT 1;

    -- Completed interviews (past)
    iv1 := gen_random_uuid();
    INSERT INTO interviews (id, candidate_id, candidate_name, candidate_email, candidate_phone, job_id, job_title,
        interview_type, round_number, round_label, scheduled_date, scheduled_end, duration_minutes,
        meeting_platform, meeting_link, status, outcome, overall_rating, created_by, created_at, updated_at)
    VALUES (iv1, cid1, 'John Smith', 'john.smith@email.com', '+1-555-0101', jid1, 'Senior Software Engineer',
        'technical', 1, 'Technical Round 1', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days' + INTERVAL '60 minutes', 60,
        'zoom', 'https://zoom.us/j/abc12345', 'completed', 'passed', 4, 'admin', NOW() - INTERVAL '20 days', NOW() - INTERVAL '14 days');

    iv2 := gen_random_uuid();
    INSERT INTO interviews (id, candidate_id, candidate_name, candidate_email, candidate_phone, job_id, job_title,
        interview_type, round_number, round_label, scheduled_date, scheduled_end, duration_minutes,
        meeting_platform, meeting_link, status, outcome, overall_rating, created_by, created_at, updated_at)
    VALUES (iv2, cid1, 'John Smith', 'john.smith@email.com', '+1-555-0101', jid1, 'Senior Software Engineer',
        'behavioral', 2, 'HR Round', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' + INTERVAL '45 minutes', 45,
        'teams', 'https://teams.microsoft.com/l/abc', 'completed', 'passed', 5, 'admin', NOW() - INTERVAL '10 days', NOW() - INTERVAL '7 days');

    iv3 := gen_random_uuid();
    INSERT INTO interviews (id, candidate_id, candidate_name, candidate_email, candidate_phone, job_id, job_title,
        interview_type, round_number, round_label, scheduled_date, scheduled_end, duration_minutes,
        meeting_platform, meeting_link, status, outcome, overall_rating, created_by, created_at, updated_at)
    VALUES (iv3, cid2, 'Sarah Johnson', 'sarah.j@email.com', '+1-555-0102', jid2, 'Data Scientist',
        'technical', 1, 'ML Coding Round', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days' + INTERVAL '90 minutes', 90,
        'google_meet', 'https://meet.google.com/xyz', 'completed', 'strong_hire', 5, 'admin', NOW() - INTERVAL '15 days', NOW() - INTERVAL '10 days');

    iv4 := gen_random_uuid();
    INSERT INTO interviews (id, candidate_id, candidate_name, candidate_email, candidate_phone, job_id, job_title,
        interview_type, round_number, round_label, scheduled_date, scheduled_end, duration_minutes,
        meeting_platform, meeting_link, status, outcome, overall_rating, created_by, created_at, updated_at)
    VALUES (iv4, cid3, 'Michael Chen', 'michael.chen@email.com', '+1-555-0103', jid1, 'Senior Software Engineer',
        'technical', 1, 'System Design', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '60 minutes', 60,
        'zoom', 'https://zoom.us/j/def456', 'completed', 'failed', 2, 'admin', NOW() - INTERVAL '8 days', NOW() - INTERVAL '5 days');

    -- Scheduled interviews (upcoming)
    iv5 := gen_random_uuid();
    INSERT INTO interviews (id, candidate_id, candidate_name, candidate_email, candidate_phone, job_id, job_title,
        interview_type, round_number, round_label, scheduled_date, scheduled_end, duration_minutes,
        meeting_platform, meeting_link, status, created_by, created_at, updated_at)
    VALUES (iv5, cid4, 'Emily Davis', 'emily.davis@email.com', '+1-555-0104', jid2, 'Data Scientist',
        'panel', 1, 'Panel Interview', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '90 minutes', 90,
        'zoom', 'https://zoom.us/j/panel1', 'scheduled', 'admin', NOW() - INTERVAL '3 days', NOW());

    iv6 := gen_random_uuid();
    INSERT INTO interviews (id, candidate_id, candidate_name, candidate_email, candidate_phone, job_id, job_title,
        interview_type, round_number, round_label, scheduled_date, scheduled_end, duration_minutes,
        meeting_platform, meeting_link, status, created_by, created_at, updated_at)
    VALUES (iv6, cid5, 'David Wilson', 'david.wilson@email.com', '+1-555-0105', jid3, 'DevOps Engineer',
        'technical', 1, 'Infrastructure Deep Dive', NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '60 minutes', 60,
        'teams', 'https://teams.microsoft.com/l/devops1', 'confirmed', 'admin', NOW() - INTERVAL '2 days', NOW());

    iv7 := gen_random_uuid();
    INSERT INTO interviews (id, candidate_id, candidate_name, candidate_email, candidate_phone, job_id, job_title,
        interview_type, round_number, round_label, scheduled_date, scheduled_end, duration_minutes,
        meeting_platform, meeting_link, status, created_by, created_at, updated_at)
    VALUES (iv7, cid6, 'Jessica Brown', 'jessica.brown@email.com', '+1-555-0106', jid4, 'Cloud Architect',
        'video', 1, 'Cloud Architecture Review', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days' + INTERVAL '60 minutes', 60,
        'google_meet', 'https://meet.google.com/cloud1', 'scheduled', 'admin', NOW() - INTERVAL '1 day', NOW());

    iv8 := gen_random_uuid();
    INSERT INTO interviews (id, candidate_id, candidate_name, candidate_email, candidate_phone, job_id, job_title,
        interview_type, round_number, round_label, scheduled_date, scheduled_end, duration_minutes,
        meeting_platform, meeting_link, status, created_by, created_at, updated_at)
    VALUES (iv8, cid1, 'John Smith', 'john.smith@email.com', '+1-555-0101', jid1, 'Senior Software Engineer',
        'hr', 3, 'Final Round - VP Interview', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '30 minutes', 30,
        'zoom', 'https://zoom.us/j/final1', 'scheduled', 'admin', NOW(), NOW());

    -- Cancelled / no-show
    iv9 := gen_random_uuid();
    INSERT INTO interviews (id, candidate_id, candidate_name, candidate_email, job_title,
        interview_type, round_number, scheduled_date, scheduled_end, duration_minutes,
        status, cancellation_reason, created_by, created_at, updated_at)
    VALUES (iv9, cid3, 'Michael Chen', 'michael.chen@email.com', 'Senior Software Engineer',
        'behavioral', 2, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '45 minutes', 45,
        'cancelled', 'Candidate withdrew application', 'admin', NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days');

    iv10 := gen_random_uuid();
    INSERT INTO interviews (id, candidate_name, candidate_email, job_title,
        interview_type, round_number, scheduled_date, scheduled_end, duration_minutes,
        status, created_by, created_at, updated_at)
    VALUES (iv10, 'Unknown Candidate', 'noshow@email.com', 'QA Engineer',
        'phone', 1, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '30 minutes', 30,
        'no_show', 'admin', NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days');

    -- Panel members
    INSERT INTO interview_panels (id, interview_id, interviewer_name, interviewer_email, interviewer_role, is_lead, status) VALUES
    (gen_random_uuid(), iv1, 'James Parker', 'james.parker@techcorp.com', 'Tech Lead', true, 'accepted'),
    (gen_random_uuid(), iv1, 'Linda Scott', 'linda.scott@techcorp.com', 'Senior Engineer', false, 'accepted'),
    (gen_random_uuid(), iv2, 'HR Manager', 'hr@techcorp.com', 'HR Manager', true, 'accepted'),
    (gen_random_uuid(), iv3, 'Brian Adams', 'brian.adams@dataflow.com', 'Data Science Lead', true, 'accepted'),
    (gen_random_uuid(), iv3, 'Karen Nelson', 'karen.nelson@dataflow.com', 'ML Engineer', false, 'accepted'),
    (gen_random_uuid(), iv5, 'James Parker', 'james.parker@techcorp.com', 'Tech Lead', true, 'pending'),
    (gen_random_uuid(), iv5, 'Brian Adams', 'brian.adams@dataflow.com', 'Data Science Lead', false, 'accepted'),
    (gen_random_uuid(), iv5, 'Karen Nelson', 'karen.nelson@dataflow.com', 'ML Engineer', false, 'pending'),
    (gen_random_uuid(), iv6, 'Kevin Hall', 'kevin@cloudscale.com', 'VP Engineering', true, 'accepted'),
    (gen_random_uuid(), iv7, 'George Young', 'george@entcloud.com', 'Cloud Architect', true, 'pending'),
    (gen_random_uuid(), iv8, 'Thomas Wright', 'thomas@techcorp.com', 'VP Engineering', true, 'pending');

    -- Feedback for completed interviews
    INSERT INTO interview_feedback (id, interview_id, reviewer_name, reviewer_email,
        technical_rating, communication_rating, problem_solving_rating, cultural_fit_rating, overall_rating,
        recommendation, strengths, weaknesses, comments, created_at, updated_at) VALUES
    (gen_random_uuid(), iv1, 'James Parker', 'james.parker@techcorp.com',
        4, 5, 4, 4, 4, 'hire',
        'Strong system design skills, good understanding of distributed systems',
        'Could improve on time complexity analysis',
        'Solid candidate for senior role. Recommend proceeding to next round.',
        NOW() - INTERVAL '13 days', NOW() - INTERVAL '13 days'),
    (gen_random_uuid(), iv1, 'Linda Scott', 'linda.scott@techcorp.com',
        4, 4, 5, 4, 4, 'hire',
        'Excellent problem solving approach, clean code',
        'None significant',
        'Strong technical skills. Would be a great addition to the team.',
        NOW() - INTERVAL '13 days', NOW() - INTERVAL '13 days'),
    (gen_random_uuid(), iv2, 'HR Manager', 'hr@techcorp.com',
        NULL, 5, NULL, 5, 5, 'strong_hire',
        'Excellent communication, strong cultural fit, leadership potential',
        NULL,
        'Highly recommend. Aligns perfectly with team values and company culture.',
        NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),
    (gen_random_uuid(), iv3, 'Brian Adams', 'brian.adams@dataflow.com',
        5, 5, 5, 4, 5, 'strong_hire',
        'Outstanding ML knowledge, published research, excellent coding skills',
        'Slightly overfocused on deep learning vs traditional ML',
        'Best candidate we have seen for this role. Extend offer immediately.',
        NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'),
    (gen_random_uuid(), iv4, 'James Parker', 'james.parker@techcorp.com',
        2, 3, 2, 3, 2, 'no_hire',
        'Basic knowledge of web technologies',
        'Struggled with system design, could not scale beyond single server architecture',
        'Not ready for senior role. Consider for mid-level position.',
        NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days');

    -- Interviewer availability
    INSERT INTO interviewer_availability (id, interviewer_name, interviewer_email,
        available_date, available_end, timezone, is_recurring, day_of_week, is_active) VALUES
    (gen_random_uuid(), 'James Parker', 'james.parker@techcorp.com',
        NOW() + INTERVAL '1 day' + INTERVAL '9 hours', NOW() + INTERVAL '1 day' + INTERVAL '12 hours',
        'America/New_York', true, 1, true),
    (gen_random_uuid(), 'James Parker', 'james.parker@techcorp.com',
        NOW() + INTERVAL '3 days' + INTERVAL '14 hours', NOW() + INTERVAL '3 days' + INTERVAL '17 hours',
        'America/New_York', true, 3, true),
    (gen_random_uuid(), 'Brian Adams', 'brian.adams@dataflow.com',
        NOW() + INTERVAL '2 days' + INTERVAL '10 hours', NOW() + INTERVAL '2 days' + INTERVAL '16 hours',
        'America/Chicago', false, NULL, true),
    (gen_random_uuid(), 'Karen Nelson', 'karen.nelson@dataflow.com',
        NOW() + INTERVAL '2 days' + INTERVAL '13 hours', NOW() + INTERVAL '2 days' + INTERVAL '17 hours',
        'America/New_York', false, NULL, true),
    (gen_random_uuid(), 'Kevin Hall', 'kevin@cloudscale.com',
        NOW() + INTERVAL '4 days' + INTERVAL '9 hours', NOW() + INTERVAL '4 days' + INTERVAL '11 hours',
        'America/Denver', true, 4, true),
    (gen_random_uuid(), 'George Young', 'george@entcloud.com',
        NOW() + INTERVAL '5 days' + INTERVAL '10 hours', NOW() + INTERVAL '5 days' + INTERVAL '15 hours',
        'America/Los_Angeles', false, NULL, true);

    RAISE NOTICE 'Interview seed data inserted successfully';
END $$;

SELECT 'Interview data seeded' AS status;
