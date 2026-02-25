#!/bin/bash
# ================================================================
# deploy_dev.sh  –  Deploy DEV environment from dev branch
# ================================================================
set -euo pipefail

PROJECT_DIR="/root/resume-parser"
ENV_FILE="$PROJECT_DIR/.env.dev"
COMPOSE_PROJECT="resume-dev"

echo "══════════════════════════════════════════════"
echo "  DEV Deployment"
echo "══════════════════════════════════════════════"

cd "$PROJECT_DIR"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Missing $ENV_FILE"
    echo "   cp .env.dev.example .env.dev"
    exit 1
fi

echo "📋 Environment: DEV"
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

echo "🏗️  Building DEV containers..."
docker compose \
    -p "$COMPOSE_PROJECT" \
    --env-file "$ENV_FILE" \
    -f docker-compose.yml \
    -f docker-compose.dev.yml \
    up -d --build

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

echo "🩺 Running health check..."
if curl -sf http://localhost:8002/health > /dev/null 2>&1; then
    echo "✅ DEV API is healthy"
else
    echo "⚠️  DEV API not yet responding (may need more time to start)"
    echo "   Check logs: docker compose -p $COMPOSE_PROJECT logs -f api"
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  ✅ DEV deployment complete!"
echo ""
echo "  Internal: http://localhost:8002/"
echo ""
echo "  Useful commands:"
echo "    Logs:    docker compose -p $COMPOSE_PROJECT logs -f"
echo "    Status:  docker compose -p $COMPOSE_PROJECT ps"
echo "    Stop:    docker compose -p $COMPOSE_PROJECT down"
echo "    Restart: docker compose -p $COMPOSE_PROJECT restart"
echo "══════════════════════════════════════════════"
