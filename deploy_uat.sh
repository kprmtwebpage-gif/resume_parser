#!/bin/bash
# ================================================================
# deploy_uat.sh  –  Deploy UAT environment from dev branch
#
# This builds Docker images from the current code (dev branch)
# with UAT-specific configuration (BASE_PATH=/uat) and starts
# the UAT stack. No separate source copy needed.
#
# Usage (on server):
#   cd /root/resume-parser
#   bash deploy_uat.sh
#
# Prerequisites:
#   - .env.uat file exists (copy from .env.uat.example)
#   - Docker + Docker Compose installed
# ================================================================
set -euo pipefail

PROJECT_DIR="/root/resume-parser"
ENV_FILE="$PROJECT_DIR/.env.uat"
COMPOSE_PROJECT="resume-uat"

echo "══════════════════════════════════════════════"
echo "  UAT Deployment"
echo "══════════════════════════════════════════════"

cd "$PROJECT_DIR"

# ── 1. Verify .env.uat exists ────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Missing $ENV_FILE"
    echo "   Copy from .env.uat.example and fill in values:"
    echo "   cp .env.uat.example .env.uat"
    exit 1
fi

echo "📋 Environment: UAT"
echo "📂 Project dir: $PROJECT_DIR"
echo "🔧 Compose project: $COMPOSE_PROJECT"
echo ""

# ── 2. Pull latest code (if on a git repo) ──────────────────
if [ -d ".git" ]; then
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    echo "🔄 Current branch: $CURRENT_BRANCH"
    echo "📥 Pulling latest changes..."
    git pull --ff-only || echo "⚠️  Git pull skipped (may have local changes)"
    echo ""
fi

# ── 3. Build & start UAT stack ──────────────────────────────
echo "🏗️  Building UAT containers (this may take a few minutes)..."
docker compose \
    -p "$COMPOSE_PROJECT" \
    --env-file "$ENV_FILE" \
    -f docker-compose.yml \
    -f docker-compose.uat.yml \
    up -d --build

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# ── 4. Health check ─────────────────────────────────────────
echo "🩺 Running health check..."
if curl -sf http://localhost:8001/health > /dev/null 2>&1; then
    echo "✅ UAT API is healthy"
else
    echo "⚠️  UAT API not yet responding (may need more time to start)"
    echo "   Check logs: docker compose -p $COMPOSE_PROJECT logs -f api"
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  ✅ UAT deployment complete!"
echo ""
echo "  Internal: http://localhost:8001/"
echo "  HTTPS:    https://kprmtglobalsolutions.duckdns.org/uat/"
echo ""
echo "  Useful commands:"
echo "    Logs:    docker compose -p $COMPOSE_PROJECT logs -f"
echo "    Status:  docker compose -p $COMPOSE_PROJECT ps"
echo "    Stop:    docker compose -p $COMPOSE_PROJECT down"
echo "    Restart: docker compose -p $COMPOSE_PROJECT restart"
echo "══════════════════════════════════════════════"
