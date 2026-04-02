import requests
from datetime import datetime, timedelta, timezone

base='http://127.0.0.1:8000'
results=[]

def rec(name, ok, detail=''):
    results.append((name, ok, detail))

try:
    r=requests.post(base+'/api/auth/login', data={'username':'admin','password':'admin123'}, timeout=20)
    rec('auth_login', r.status_code==200, f'status={r.status_code}')
    tok=r.json().get('access_token') if r.ok else None
except Exception as e:
    tok=None; rec('auth_login', False, str(e))

headers={'Authorization':f'Bearer {tok}'} if tok else {}

try:
    r=requests.get(base+'/api/auth/me', headers=headers, timeout=20)
    rec('auth_me', r.status_code==200, f'status={r.status_code}')
except Exception as e:
    rec('auth_me', False, str(e))

cand=None
try:
    r=requests.get(base+'/api/candidates?page=1&per_page=10', headers=headers, timeout=30)
    ok=r.status_code==200
    detail=f'status={r.status_code}'
    if ok:
        j=r.json()
        items=j.get('candidates') or j.get('items') or (j if isinstance(j,list) else [])
        if items:
            c=items[0]
            cand={
                'id': c.get('id') or c.get('candidate_id') or 1,
                'name': (c.get('full_name') or ((c.get('first_name') or '')+' '+(c.get('last_name') or '')).strip() or c.get('name') or 'Test Candidate'),
                'email': c.get('email'),
                'phone': c.get('phone')
            }
            total = j.get('total',len(items)) if isinstance(j, dict) else len(items)
            detail += f' total={total}'
    rec('candidates_list', ok and cand is not None, detail)
except Exception as e:
    rec('candidates_list', False, str(e))

if not cand:
    cand={'id':1,'name':'Ahmed Ashour','email':'aashourwz@outlook.com','phone':'+201204822498'}

pc_id=None
next_stage='technical_round_1'
try:
    r=requests.get(base+'/api/pipeline/stages', headers=headers, timeout=20)
    ok=r.status_code==200 and isinstance(r.json(), list) and len(r.json())>0
    if ok and len(r.json())>1:
        next_stage=r.json()[1].get('stage',next_stage)
    rec('pipeline_stages', ok, f'status={r.status_code}')
except Exception as e:
    rec('pipeline_stages', False, str(e))

try:
    payload={'candidate_id': int(cand['id']), 'candidate_name': cand['name'], 'candidate_email': cand['email'], 'candidate_phone': cand['phone'], 'current_stage':'screening'}
    r=requests.post(base+'/api/pipeline/candidates', headers=headers, json=payload, timeout=30)
    ok=r.status_code in (200,201)
    if ok:
        pc_id=r.json().get('id')
    rec('pipeline_add_candidate', ok, f'status={r.status_code}')
except Exception as e:
    rec('pipeline_add_candidate', False, str(e))

try:
    r=requests.get(base+'/api/pipeline/board', headers=headers, timeout=30)
    rec('pipeline_board', r.status_code==200, f'status={r.status_code}')
except Exception as e:
    rec('pipeline_board', False, str(e))

if pc_id:
    try:
        r=requests.post(base+f'/api/pipeline/candidates/{pc_id}/move', headers=headers, json={'to_stage':next_stage,'action':'moved','notes':'UI functional test'}, timeout=30)
        rec('pipeline_move', r.status_code==200, f'status={r.status_code}')
    except Exception as e:
        rec('pipeline_move', False, str(e))

    try:
        fb={'stage':next_stage,'reviewer_name':'QA Tester','reviewer_email':'qa@test.local','technical_rating':4,'communication_rating':4,'problem_solving_rating':4,'cultural_fit_rating':4,'overall_rating':4,'recommendation':'potential_candidate','comments':'Functional test feedback'}
        r=requests.post(base+f'/api/pipeline/candidates/{pc_id}/feedback', headers=headers, json=fb, timeout=30)
        rec('pipeline_feedback', r.status_code in (200,201), f'status={r.status_code}')
    except Exception as e:
        rec('pipeline_feedback', False, str(e))

    try:
        r=requests.get(base+f'/api/pipeline/candidates/{pc_id}/scorecard', headers=headers, timeout=20)
        rec('pipeline_scorecard', r.status_code==200, f'status={r.status_code}')
    except Exception as e:
        rec('pipeline_scorecard', False, str(e))

try:
    r=requests.get(base+'/api/pipeline/analytics', headers=headers, timeout=20)
    rec('pipeline_analytics', r.status_code==200, f'status={r.status_code}')
except Exception as e:
    rec('pipeline_analytics', False, str(e))

interview_id=None
try:
    sched=(datetime.now(timezone.utc)+timedelta(days=1)).isoformat()
    payload={'candidate_id':int(cand['id']),'candidate_name':cand['name'],'candidate_email':cand['email'],'candidate_phone':cand['phone'],'job_title':'Test Role','interview_type':'video','scheduled_date':sched,'duration_minutes':45,'meeting_platform':'zoom','panel_members':[{'interviewer_name':'Interviewer One','interviewer_email':'int1@test.local','interviewer_role':'Hiring Manager','is_lead':True}]}
    r=requests.post(base+'/api/interviews', headers=headers, json=payload, timeout=30)
    ok=r.status_code in (200,201)
    if ok:
        interview_id=r.json().get('id')
    rec('interview_create', ok, f'status={r.status_code}')
except Exception as e:
    rec('interview_create', False, str(e))

try:
    r=requests.get(base+'/api/interviews', headers=headers, timeout=20)
    rec('interview_list', r.status_code==200, f'status={r.status_code}')
except Exception as e:
    rec('interview_list', False, str(e))

try:
    r=requests.get(base+'/api/interviews/analytics', headers=headers, timeout=20)
    rec('interview_analytics', r.status_code==200, f'status={r.status_code}')
except Exception as e:
    rec('interview_analytics', False, str(e))

if interview_id:
    try:
        r=requests.post(base+f'/api/interviews/{interview_id}/feedback', headers=headers, json={'reviewer_name':'Interviewer One','overall_rating':4,'comments':'Good candidate'}, timeout=20)
        rec('interview_feedback', r.status_code in (200,201), f'status={r.status_code}')
    except Exception as e:
        rec('interview_feedback', False, str(e))

try:
    r=requests.post(base+'/api/candidate-comments/', headers=headers, json={'candidate_id':int(cand['id']),'comment':'Functional test comment','author':'QA Tester'}, timeout=20)
    ok=r.status_code in (200,201)
    rec('candidate_comment_create', ok, f'status={r.status_code}')
except Exception as e:
    rec('candidate_comment_create', False, str(e))

try:
    r=requests.get(base+f"/api/candidate-comments/{int(cand['id'])}", headers=headers, timeout=20)
    rec('candidate_comment_list', r.status_code==200, f'status={r.status_code}')
except Exception as e:
    rec('candidate_comment_list', False, str(e))

try:
    r=requests.get(base+'/api/ats/dashboard', headers=headers, timeout=20)
    rec('ats_dashboard', r.status_code==200, f'status={r.status_code}')
except Exception as e:
    rec('ats_dashboard', False, str(e))

try:
    r=requests.get(base+'/api/ats/runs', headers=headers, timeout=20)
    rec('ats_runs', r.status_code==200, f'status={r.status_code}')
except Exception as e:
    rec('ats_runs', False, str(e))

passed=sum(1 for _,ok,_ in results if ok)
failed=[x for x in results if not x[1]]
print('TEST_SUMMARY', f'passed={passed}', f'failed={len(failed)}', f'total={len(results)}')
for name,ok,detail in results:
    print(('PASS' if ok else 'FAIL'), name, detail)
