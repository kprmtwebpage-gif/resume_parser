"""Patch api_server.py on the production server to add auth support."""
import sys

f = '/root/resume-parser/Backend/api_server.py'
with open(f, 'r') as fh:
    content = fh.read()

# 1. Add auth import after chatbot import block
auth_import = '''
# Import auth module
try:
    from auth import router as auth_router, get_current_user, get_current_admin
    AUTH_AVAILABLE = True
except ImportError as e:
    print(f"[WARN] Auth module not available: {e}")
    AUTH_AVAILABLE = False
    auth_router = None
'''

# Insert after the chatbot import block (after 'create_resume_chatbot = None')
marker = 'create_resume_chatbot = None'
if 'from auth import' not in content:
    idx = content.find(marker)
    if idx >= 0:
        insert_pos = content.find('\n', idx) + 1
        content = content[:insert_pos] + auth_import + content[insert_pos:]
        print('Added auth import block')
    else:
        print('ERROR: Could not find chatbot import marker')
        sys.exit(1)
else:
    print('Auth import already exists')

# 2. Add auth router registration after middleware setup
auth_router_reg = '''
# Register auth router (login, logout, me, admin user management)
if AUTH_AVAILABLE and auth_router is not None:
    app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

'''

marker2 = 'app.add_middleware(APINoCacheMiddleware)'
if 'include_router(auth_router' not in content:
    idx2 = content.find(marker2)
    if idx2 >= 0:
        insert_pos2 = content.find('\n', idx2) + 1
        content = content[:insert_pos2] + auth_router_reg + content[insert_pos2:]
        print('Added auth router registration')
    else:
        print('ERROR: Could not find middleware marker')
        sys.exit(1)
else:
    print('Auth router registration already exists')

with open(f, 'w') as fh:
    fh.write(content)
print('Done patching api_server.py')
