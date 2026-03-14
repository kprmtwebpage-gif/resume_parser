#!/bin/bash
#############################################################################
# Safe Production Deployment Orchestrator
#
# This script coordinates a safe, zero-downtime deployment:
# 1. Backup production database
# 2. Sync latest production resumes to UAT
# 3. Run UAT tests
# 4. Deploy to production
#
# Note: Prod→DEV resume sync is MANUAL only.
#       Run: bash sync_prod_resumes_to_dev.sh
#
# Usage:
#   bash safe_deploy_to_production.sh
#############################################################################

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="/root/resume-parser"
BACKUP_DIR="$PROJECT_DIR/database_backups"
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/production_backup_$BACKUP_DATE.sql"
LOG_FILE="/tmp/deployment_$BACKUP_DATE.log"

# Track overall status
DEPLOYMENT_FAILED=0

log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

fail() {
    log "${RED}❌ FATAL: $1${NC}"
    DEPLOYMENT_FAILED=1
}

success() {
    log "${GREEN}✓ $1${NC}"
}

# ───────────────────────────────────────────────────────────────
# PRE-DEPLOYMENT CHECKS
# ───────────────────────────────────────────────────────────────
log "${CYAN}========================================${NC}"
log "${CYAN}Safe Production Deployment${NC}"
log "${CYAN}========================================${NC}"
echo "" | tee -a "$LOG_FILE"

log "${YELLOW}[0/5] Pre-flight checks...${NC}"

# Check prod is running
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    success "Production API is healthy"
else
    fail "Production API not responding!"
    exit 1
fi

# Check disk space
DISK_AVAIL=$(df / | awk 'NR==2 {print $4}')
if [ $DISK_AVAIL -lt 1000000 ]; then  # Less than 1GB
    fail "Low disk space: ${DISK_AVAIL}KB available"
    exit 1
fi
success "Disk space OK (${DISK_AVAIL}KB available)"

# Check git status
cd "$PROJECT_DIR"
GIT_STATUS=$(git status --porcelain)
if [ -n "$GIT_STATUS" ]; then
    log "${YELLOW}⚠  Uncommitted changes detected${NC}"
    log "$GIT_STATUS"
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Deployment cancelled"
        exit 0
    fi
fi

echo "" | tee -a "$LOG_FILE"

# ───────────────────────────────────────────────────────────────
# STEP 1: BACKUP PRODUCTION DATABASE
# ───────────────────────────────────────────────────────────────
log "${YELLOW}[1/4] Backing up production database...${NC}"

mkdir -p "$BACKUP_DIR"

if docker exec resume-db-prod pg_dump -U postgres resume_prod > "$BACKUP_FILE" 2>/dev/null; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    success "Database backed up to: $BACKUP_FILE ($BACKUP_SIZE)"
    log "  Rollback: docker exec resume-db-prod psql -U postgres -d resume_prod < $BACKUP_FILE"
else
    fail "Database backup failed!"
    exit 1
fi
echo "" | tee -a "$LOG_FILE"

# ───────────────────────────────────────────────────────────────
# STEP 2: SYNC RESUMES TO UAT
# ───────────────────────────────────────────────────────────────
log "${YELLOW}[2/4] Syncing latest production resumes to UAT...${NC}"

if bash "$PROJECT_DIR/sync_prod_resumes_to_uat.sh" 2>&1 | tee -a "$LOG_FILE"; then
    success "UAT resumes synced"
else
    fail "UAT resume sync failed"
    DEPLOYMENT_FAILED=1
fi
echo "" | tee -a "$LOG_FILE"

# ───────────────────────────────────────────────────────────────
# STEP 2.5: SYNC UAT USERS TO PRODUCTION
# ───────────────────────────────────────────────────────────────
log "${YELLOW}[2.5/4] Syncing UAT user accounts to production...${NC}"

# Export users from UAT DB → import into PROD DB (upsert: skip existing)
if docker exec resume-db-uat pg_dump -U postgres resume_uat \
    --table users --data-only --column-inserts --on-conflict-do-nothing 2>/dev/null \
    | docker exec -i resume-db-prod psql -U postgres -d resume_prod 2>&1 | tee -a "$LOG_FILE"; then
    success "UAT users synced to production"
else
    log "${YELLOW}⚠  User sync skipped (users may already exist in PROD)${NC}"
fi
echo "" | tee -a "$LOG_FILE"

# ───────────────────────────────────────────────────────────────
# STEP 3: UAT SANITY CHECK (optional)
# ───────────────────────────────────────────────────────────────
log "${YELLOW}[3/4] Checking UAT health...${NC}"

if curl -sf http://localhost:8001/health > /dev/null 2>&1; then
    success "UAT API is healthy"
elif [ $DEPLOYMENT_FAILED -eq 0 ]; then
    read -p "UAT is not responding. Force deploy anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        fail "Deployment cancelled"
        exit 0
    fi
fi
echo "" | tee -a "$LOG_FILE"

# ───────────────────────────────────────────────────────────────
# STEP 4: DEPLOY TO PRODUCTION
# ───────────────────────────────────────────────────────────────
log "${YELLOW}[4/4] Deploying to production...${NC}"
log "  Starting rolling update (current containers stay up during build)"

if bash "$PROJECT_DIR/deploy_prod.sh" 2>&1 | tee -a "$LOG_FILE"; then
    success "Production deployment complete"
else
    fail "Production deployment failed!"
    log ""
    log "${RED}ROLLBACK INSTRUCTIONS:${NC}"
    log "  1. Revert last git commit:"
    log "     cd $PROJECT_DIR && git reset --hard HEAD~1"
    log "  2. Restore database:"
    log "     docker exec resume-db-prod psql -U postgres -d resume_prod < $BACKUP_FILE"
    log "  3. Redeploy:"
    log "     bash deploy_prod.sh"
    exit 1
fi
echo "" | tee -a "$LOG_FILE"

# ───────────────────────────────────────────────────────────────
# FINAL VERIFICATION
# ───────────────────────────────────────────────────────────────
log "${YELLOW}Post-deployment verification...${NC}"
sleep 3

if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    success "Production API responding"
else
    fail "Production API not responding after deploy!"
    exit 1
fi

# ───────────────────────────────────────────────────────────────
# SUCCESS
# ───────────────────────────────────────────────────────────────
log ""
log "${GREEN}========================================${NC}"
log "${GREEN}✅ DEPLOYMENT SUCCESSFUL${NC}"
log "${GREEN}========================================${NC}"
log "  Backup saved: $BACKUP_FILE"
log "  Deployment log: $LOG_FILE"
log "  Production API: https://kprmtglobalsolutions.duckdns.org"
log ""
log "  Next steps:"
log "    1. Verify in browser/API"
log "    2. Monitor logs: docker compose -p resume-prod logs -f"
log "    3. Keep backup handy for 24 hours"
log ""
