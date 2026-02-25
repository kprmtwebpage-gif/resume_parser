#!/bin/bash
# ================================================================
# deploy_prod.sh  –  Deploy PROD environment from prod branch
#
# ⚠️  PRODUCTION DEPLOYMENT – use with caution!
# ================================================================
set -euo pipefail

PROJECT_DIR="/root/resume-parser"
ENV_FILE="$PROJECT_DIR/.env.prod"
COMPOSE_PROJECT="resume-prod"

echo "══════════════════════════════════════════════"
echo "  🚀 PRODUCTION Deployment"
echo "══════════════════════════════════════════════"

cd "$PROJECT_DIR"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Missing $ENV_FILE"
    echo "   cp .env.prod.example .env.prod"
    exit 1
fi

echo "📋 Environment: PROD"
echo "📂 Project dir: $PROJECT_DIR"
echo "🔧 Compose project: $COMPOSE_PROJECT"
echo ""

if [ -d ".git" ]; then
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    echo "🔄 Current branch: $CURRENT_BRANCH"
    echo "📥 Pulling latest changes..."
    git pull --ff-only || echo "⚠️  Git pull skipped (may have local changes)"
    echo ""
fi

echo "🏗️  Building PROD containers (this may take a few minutes)..."
docker compose \
    -p "$COMPOSE_PROJECT" \
    --env-file "$ENV_FILE" \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    up -d --build

echo ""
echo "⏳ Waiting for services to start..."
sleep 15

echo "🩺 Running health check..."
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ PROD API is healthy"
else
    echo "⚠️  PROD API not yet responding (may need more time to start)"
    echo "   Check logs: docker compose -p $COMPOSE_PROJECT logs -f api"
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  ✅ PROD deployment complete!"
echo ""
echo "  Internal: http://localhost:8000/"
echo "  HTTPS:    https://kprmtglobalsolutions.duckdns.org/"
echo ""
echo "  Useful commands:"
echo "    Logs:    docker compose -p $COMPOSE_PROJECT logs -f"
echo "    Status:  docker compose -p $COMPOSE_PROJECT ps"
echo "    Stop:    docker compose -p $COMPOSE_PROJECT down"
echo "    Restart: docker compose -p $COMPOSE_PROJECT restart"
echo "══════════════════════════════════════════════"
