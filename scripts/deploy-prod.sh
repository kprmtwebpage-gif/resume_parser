#!/usr/bin/env bash
# =============================================================
# deploy-prod.sh  –  Deploy PROD environment
# Run on the server from the project root after git pull
# Triggered by pull-request merge: uat → prod ONLY
# NEVER push directly to prod branch.
# =============================================================
set -euo pipefail

echo "=== [PROD] Deploying PRODUCTION environment ==="

git checkout prod
git pull origin prod

docker compose -p resume-prod \
  --env-file .env.prod \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --build

echo "=== [PROD] Deploy complete — http://localhost:8000 ==="
