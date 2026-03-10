#!/bin/bash
TOKEN=$(curl -s -X POST -H "Content-Type: application/x-www-form-urlencoded" -d "username=admin&password=admin123" http://127.0.0.1:8002/api/auth/login | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
echo "TOKEN: $TOKEN"
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8002/api/auth/admin/users
