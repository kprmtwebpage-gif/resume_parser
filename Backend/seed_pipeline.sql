-- Seed data for the Interview Pipeline Kanban board
DO $$
DECLARE
    cid1 INT; cid2 INT; cid3 INT; cid4 INT; cid5 INT; cid6 INT;
    cid7 INT; cid8 INT; cid9 INT; cid10 INT; cid11 INT; cid12 INT;
    jid1 UUID; jid2 UUID; jid3 UUID;
    pc1 UUID; pc2 UUID; pc3 UUID; pc4 UUID; pc5 UUID;
    pc6 UUID; pc7 UUID; pc8 UUID; pc9 UUID; pc10 UUID;
    pc11 UUID; pc12 UUID;
BEGIN
    SELECT id INTO cid1 FROM candidate_profile WHERE email='john.smith@email.com';
    SELECT id INTO cid2 FROM candidate_profile WHERE email='sarah.j@email.com';
    SELECT id INTO cid3 FROM candidate_profile WHERE email='michael.chen@email.com';
    SELECT id INTO cid4 FROM candidate_profile WHERE email='emily.davis@email.com';
    SELECT id INTO cid5 FROM candidate_profile WHERE email='david.wilson@email.com';
    SELECT id INTO cid6 FROM candidate_profile WHERE email='jessica.brown@email.com';
    SELECT id INTO cid7 FROM candidate_profile WHERE email='robert.taylor@email.com';
    SELECT id INTO cid8 FROM candidate_profile WHERE email='amanda.m@email.com';
    SELECT id INTO cid9 FROM candidate_profile WHERE email='james.anderson@email.com';
    SELECT id INTO cid10 FROM candidate_profile WHERE email='lisa.thomas@email.com';
    SELECT id INTO cid11 FROM candidate_profile WHERE email='daniel.garcia@email.com';
    IF cid11 IS NULL THEN cid11 := cid1; END IF; -- fallback
    SELECT id INTO cid12 FROM candidate_profile WHERE email='rachel.lee@email.com';

    SELECT id INTO jid1 FROM jobs WHERE job_title='Senior Software Engineer' LIMIT 1;
    SELECT id INTO jid2 FROM jobs WHERE job_title='Data Scientist' LIMIT 1;
    SELECT id INTO jid3 FROM jobs WHERE job_title='DevOps Engineer' LIMIT 1;

    -- Candidates at various stages
    pc1 := gen_random_uuid();
    INSERT INTO pipeline_candidates (id,candidate_id,candidate_name,candidate_email,candidate_phone,job_id,job_title,current_stage,stage_order,overall_score,ranking,stage_status,added_by,created_at,updated_at) VALUES
    (pc1,cid1,'John Smith','john.smith@email.com','+1-555-0101',jid1,'Senior Software Engineer','offer',5,85.0,'potential_candidate','active','admin',NOW()-INTERVAL '30 days',NOW());

    pc2 := gen_random_uuid();
    INSERT INTO pipeline_candidates (id,candidate_id,candidate_name,candidate_email,candidate_phone,job_id,job_title,current_stage,stage_order,overall_score,ranking,stage_status,added_by,created_at,updated_at) VALUES
    (pc2,cid2,'Sarah Johnson','sarah.j@email.com','+1-555-0102',jid2,'Data Scientist','level_2',3,78.0,'potential_candidate','active','admin',NOW()-INTERVAL '25 days',NOW());

    pc3 := gen_random_uuid();
    INSERT INTO pipeline_candidates (id,candidate_id,candidate_name,candidate_email,candidate_phone,job_id,job_title,current_stage,stage_order,overall_score,ranking,stage_status,added_by,created_at,updated_at) VALUES
    (pc3,cid3,'Michael Chen','michael.chen@email.com','+1-555-0103',jid1,'Senior Software Engineer','level_1',2,55.0,'average','active','admin',NOW()-INTERVAL '20 days',NOW());

    pc4 := gen_random_uuid();
    INSERT INTO pipeline_candidates (id,candidate_id,candidate_name,candidate_email,candidate_phone,job_id,job_title,current_stage,stage_order,stage_status,added_by,created_at,updated_at) VALUES
    (pc4,cid4,'Emily Davis','emily.davis@email.com','+1-555-0104',jid2,'Data Scientist','screening',0,'active','admin',NOW()-INTERVAL '5 days',NOW());

    pc5 := gen_random_uuid();
    INSERT INTO pipeline_candidates (id,candidate_id,candidate_name,candidate_email,candidate_phone,job_id,job_title,current_stage,stage_order,stage_status,added_by,created_at,updated_at) VALUES
    (pc5,cid5,'David Wilson','david.wilson@email.com','+1-555-0105',jid3,'DevOps Engineer','written_test',1,'active','admin',NOW()-INTERVAL '15 days',NOW());

    pc6 := gen_random_uuid();
    INSERT INTO pipeline_candidates (id,candidate_id,candidate_name,candidate_email,candidate_phone,job_id,job_title,current_stage,stage_order,overall_score,ranking,stage_status,added_by,created_at,updated_at) VALUES
    (pc6,cid6,'Jessica Brown','jessica.brown@email.com','+1-555-0106',jid1,'Senior Software Engineer','level_3',4,72.0,'potential_candidate','active','admin',NOW()-INTERVAL '18 days',NOW());

    pc7 := gen_random_uuid();
    INSERT INTO pipeline_candidates (id,candidate_id,candidate_name,candidate_email,candidate_phone,job_id,job_title,current_stage,stage_order,overall_score,ranking,stage_status,added_by,created_at,updated_at) VALUES
    (pc7,cid7,'Robert Taylor','robert.taylor@email.com','+1-555-0107',jid1,'Senior Software Engineer','onboarding_initiated',6,90.0,'potential_candidate','active','admin',NOW()-INTERVAL '40 days',NOW());

    pc8 := gen_random_uuid();
    INSERT INTO pipeline_candidates (id,candidate_id,candidate_name,candidate_email,candidate_phone,job_title,current_stage,stage_order,stage_status,added_by,created_at,updated_at) VALUES
    (pc8,cid8,'Amanda Martinez','amanda.m@email.com','+1-555-0108','UI/UX Designer','screening',0,'active','admin',NOW()-INTERVAL '3 days',NOW());

    pc9 := gen_random_uuid();
    INSERT INTO pipeline_candidates (id,candidate_id,candidate_name,candidate_email,candidate_phone,job_title,current_stage,stage_order,overall_score,ranking,stage_status,added_by,created_at,updated_at) VALUES
    (pc9,cid9,'James Anderson','james.anderson@email.com','+1-555-0109','Security Engineer','level_1',2,35.0,'below_average','active','admin',NOW()-INTERVAL '12 days',NOW());

    pc10 := gen_random_uuid();
    INSERT INTO pipeline_candidates (id,candidate_id,candidate_name,candidate_email,candidate_phone,job_title,current_stage,stage_order,stage_status,added_by,created_at,updated_at) VALUES
    (pc10,cid10,'Lisa Thomas','lisa.thomas@email.com','+1-555-0110','QA Engineer','written_test',1,'active','admin',NOW()-INTERVAL '8 days',NOW());

    pc11 := gen_random_uuid();
    INSERT INTO pipeline_candidates (id,candidate_id,candidate_name,candidate_email,candidate_phone,job_title,current_stage,stage_order,overall_score,ranking,stage_status,added_by,created_at,updated_at) VALUES
    (pc11,cid11,'Daniel Garcia','daniel.garcia@email.com','+1-555-0111','Data Scientist','onboarding_completed',7,92.0,'potential_candidate','active','admin',NOW()-INTERVAL '50 days',NOW());

    pc12 := gen_random_uuid();
    INSERT INTO pipeline_candidates (id,candidate_id,candidate_name,candidate_email,candidate_phone,job_title,current_stage,stage_order,stage_status,added_by,created_at,updated_at) VALUES
    (pc12,cid12,'Rachel Lee','rachel.lee@email.com','+1-555-0112','Mobile Developer','screening',0,'active','admin',NOW()-INTERVAL '1 day',NOW());

    -- Stage history
    INSERT INTO pipeline_stage_history (id,pipeline_candidate_id,from_stage,to_stage,action,moved_by,created_at) VALUES
    (gen_random_uuid(),pc1,NULL,'screening','added','admin',NOW()-INTERVAL '30 days'),
    (gen_random_uuid(),pc1,'screening','written_test','moved','admin',NOW()-INTERVAL '27 days'),
    (gen_random_uuid(),pc1,'written_test','level_1','moved','admin',NOW()-INTERVAL '24 days'),
    (gen_random_uuid(),pc1,'level_1','level_2','moved','admin',NOW()-INTERVAL '20 days'),
    (gen_random_uuid(),pc1,'level_2','level_3','moved','admin',NOW()-INTERVAL '15 days'),
    (gen_random_uuid(),pc1,'level_3','offer','passed','admin',NOW()-INTERVAL '7 days'),
    (gen_random_uuid(),pc2,NULL,'screening','added','admin',NOW()-INTERVAL '25 days'),
    (gen_random_uuid(),pc2,'screening','written_test','moved','admin',NOW()-INTERVAL '22 days'),
    (gen_random_uuid(),pc2,'written_test','level_1','moved','admin',NOW()-INTERVAL '18 days'),
    (gen_random_uuid(),pc2,'level_1','level_2','moved','admin',NOW()-INTERVAL '10 days'),
    (gen_random_uuid(),pc3,NULL,'screening','added','admin',NOW()-INTERVAL '20 days'),
    (gen_random_uuid(),pc3,'screening','level_1','moved','admin',NOW()-INTERVAL '14 days'),
    (gen_random_uuid(),pc7,NULL,'screening','added','admin',NOW()-INTERVAL '40 days'),
    (gen_random_uuid(),pc7,'screening','offer','passed','admin',NOW()-INTERVAL '20 days'),
    (gen_random_uuid(),pc7,'offer','onboarding_initiated','moved','admin',NOW()-INTERVAL '10 days'),
    (gen_random_uuid(),pc11,NULL,'screening','added','admin',NOW()-INTERVAL '50 days'),
    (gen_random_uuid(),pc11,'screening','onboarding_completed','passed','admin',NOW()-INTERVAL '15 days');

    -- Feedback entries (generates scorecards)
    INSERT INTO pipeline_feedback (id,pipeline_candidate_id,stage,reviewer_name,reviewer_email,technical_rating,communication_rating,problem_solving_rating,cultural_fit_rating,overall_rating,recommendation,comments,strengths,weaknesses,created_at) VALUES
    (gen_random_uuid(),pc1,'screening','HR Manager','hr@company.com',4,5,4,5,5,'potential_candidate','Excellent first impression','Strong communication, professional','None noted',NOW()-INTERVAL '28 days'),
    (gen_random_uuid(),pc1,'level_1','Tech Lead','lead@company.com',5,4,5,4,4,'potential_candidate','Strong technical skills','Deep system design knowledge, clean code','Could improve on time estimates',NOW()-INTERVAL '22 days'),
    (gen_random_uuid(),pc1,'level_2','Senior Engineer','sr@company.com',4,4,4,5,4,'potential_candidate','Good team fit','Collaborative, mentoring potential','Needs more cloud experience',NOW()-INTERVAL '16 days'),
    (gen_random_uuid(),pc2,'screening','HR Manager','hr@company.com',NULL,5,NULL,4,4,'potential_candidate','Great data science background',NULL,NULL,NOW()-INTERVAL '23 days'),
    (gen_random_uuid(),pc2,'level_1','Data Lead','data@company.com',5,4,5,4,5,'potential_candidate','Outstanding ML skills','Published research, production ML experience','Slightly academic approach',NOW()-INTERVAL '15 days'),
    (gen_random_uuid(),pc3,'screening','HR Manager','hr@company.com',3,3,3,3,3,'average','Meets minimum requirements','Basic skills present','Needs more experience',NOW()-INTERVAL '17 days'),
    (gen_random_uuid(),pc6,'level_1','Tech Lead','lead@company.com',4,3,4,4,4,'potential_candidate','Solid cloud skills','Azure expert, good architecture sense','Communication could improve',NOW()-INTERVAL '14 days'),
    (gen_random_uuid(),pc6,'level_2','VP Eng','vp@company.com',4,4,3,4,4,'average','Good but not exceptional','Reliable, consistent','Problem solving under pressure',NOW()-INTERVAL '10 days'),
    (gen_random_uuid(),pc7,'level_1','Tech Lead','lead@company.com',5,5,5,5,5,'potential_candidate','Exceptional candidate','Everything: Go, system design, leadership','None - best candidate this quarter',NOW()-INTERVAL '25 days'),
    (gen_random_uuid(),pc9,'screening','HR Manager','hr@company.com',2,3,2,3,2,'below_average','Concerning gaps','Some security knowledge','Major resume inconsistencies, vague answers',NOW()-INTERVAL '11 days'),
    (gen_random_uuid(),pc11,'screening','HR Manager','hr@company.com',5,5,4,5,5,'potential_candidate','Star data engineer','Spark expertise, team player','Slightly overfocused on one tech stack',NOW()-INTERVAL '45 days');

    -- Scorecards (auto-calculated normally, but seed for display)
    INSERT INTO pipeline_scorecards (id,pipeline_candidate_id,technical_avg,communication_avg,problem_solving_avg,cultural_fit_avg,overall_avg,final_score,ranking,review_count,stages_completed,updated_at) VALUES
    (gen_random_uuid(),pc1,4.3,4.3,4.3,4.7,4.3,85.0,'potential_candidate',3,3,NOW()),
    (gen_random_uuid(),pc2,5.0,4.5,5.0,4.0,4.5,78.0,'potential_candidate',2,2,NOW()),
    (gen_random_uuid(),pc3,3.0,3.0,3.0,3.0,3.0,55.0,'average',1,1,NOW()),
    (gen_random_uuid(),pc6,4.0,3.5,3.5,4.0,4.0,72.0,'potential_candidate',2,2,NOW()),
    (gen_random_uuid(),pc7,5.0,5.0,5.0,5.0,5.0,90.0,'potential_candidate',1,1,NOW()),
    (gen_random_uuid(),pc9,2.0,3.0,2.0,3.0,2.0,35.0,'below_average',1,1,NOW()),
    (gen_random_uuid(),pc11,5.0,5.0,4.0,5.0,5.0,92.0,'potential_candidate',1,1,NOW());

    RAISE NOTICE 'Pipeline seed data inserted successfully';
END $$;
