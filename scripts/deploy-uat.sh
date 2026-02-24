#!/usr/bin/env bash
# =============================================================
# deploy-uat.sh  –  Deploy UAT environment
# Run on the server from the project root after git pull
# Triggered by pull-request merge: dev → uat
# =============================================================
set -euo pipefail

echo "=== [UAT] Deploying UAT environment ==="

git checkout uat
git pull origin uat

docker compose -p resume-uat \
  --env-file .env.uat \
  -f docker-compose.yml \
  -f docker-compose.uat.yml \
  up -d --build

echo "=== [UAT] Deploy complete — http://localhost:8001 ==="
