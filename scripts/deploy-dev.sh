#!/usr/bin/env bash
# =============================================================
# deploy-dev.sh  –  Deploy DEV environment
# Run on the server from the project root after git pull
# =============================================================
set -euo pipefail

echo "=== [DEV] Deploying DEV environment ==="

git checkout dev
git pull origin dev

docker compose -p resume-dev \
  --env-file .env.dev \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  up -d --build

echo "=== [DEV] Deploy complete — http://localhost:8002 ==="
