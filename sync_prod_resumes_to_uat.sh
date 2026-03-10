#!/bin/bash
#############################################################################
# Full Mirror: Production Resumes → UAT
#
# - Copies ALL files from production to uat
# - Removes files in uat that don't exist in production
# - Production volume is NEVER written to (read-only mount)
# - Running production containers are completely unaffected
#
# Usage:
#   bash sync_prod_resumes_to_uat.sh
#############################################################################

set -euo pipefail

TARGET_ENV="uat"
TARGET_PORT="8001"
PROD_VOLUME="resume-prod_resume_cache"
TARGET_VOLUME="resume-uat_resume_cache"
LOG_FILE="/tmp/sync_uat_$(date +%Y%m%d_%H%M%S).log"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}==========================================${NC}"
echo -e "${CYAN}Full Mirror: Production → UAT${NC}"
echo -e "${CYAN}==========================================${NC}"
echo ""
echo "  Log: $LOG_FILE"
echo ""

# ───────────────────────────────────────────────────────────────
# STEP 1: Count production files
# ───────────────────────────────────────────────────────────────
echo -e "${YELLOW}[1/4] Reading production volume (read-only)...${NC}"

PROD_COUNT=$(docker run --rm \
    -v $PROD_VOLUME:/prod:ro \
    alpine sh -c "find /prod -maxdepth 1 -type f | wc -l" 2>/dev/null)

echo "  Production has: $PROD_COUNT resume(s)"
echo ""

if [ "$PROD_COUNT" -eq 0 ]; then
    echo "  Production volume is empty — nothing to sync"
    exit 0
fi

# ───────────────────────────────────────────────────────────────
# STEP 2: Copy all production files to target (skip existing)
# ───────────────────────────────────────────────────────────────
echo -e "${YELLOW}[2/4] Copying new production resumes to $TARGET_ENV...${NC}"

BEFORE=$(docker run --rm \
    -v $TARGET_VOLUME:/dst \
    alpine sh -c "find /dst -maxdepth 1 -type f | wc -l" 2>/dev/null || echo 0)

COPIED=$(docker run --rm \
    -v $PROD_VOLUME:/src:ro \
    -v $TARGET_VOLUME:/dst \
    alpine sh -c '
        count=0
        for f in /src/*; do
            [ -f "$f" ] || continue
            fname=$(basename "$f")
            if [ ! -f "/dst/$fname" ]; then
                cp "$f" "/dst/$fname"
                count=$((count + 1))
            fi
        done
        echo $count
    ' 2>/dev/null || echo 0)

echo "  Copied: $COPIED new file(s)" | tee -a "$LOG_FILE"
echo ""

# ───────────────────────────────────────────────────────────────
# STEP 3: Remove files in target that don't exist in production
# ───────────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/4] Removing $TARGET_ENV files not in production...${NC}"

REMOVED=$(docker run --rm \
    -v $PROD_VOLUME:/src:ro \
    -v $TARGET_VOLUME:/dst \
    alpine sh -c '
        count=0
        for f in /dst/*; do
            [ -f "$f" ] || continue
            fname=$(basename "$f")
            if [ ! -f "/src/$fname" ]; then
                rm -f "/dst/$fname"
                echo "Removed: $fname"
                count=$((count + 1))
            fi
        done
        echo "REMOVED_COUNT:$count"
    ' 2>/dev/null | tee -a "$LOG_FILE" | grep "REMOVED_COUNT:" | cut -d: -f2 || echo 0)

echo "  Removed: $REMOVED orphan file(s)"
echo ""

# ───────────────────────────────────────────────────────────────
# STEP 4: Verify mirror is complete
# ───────────────────────────────────────────────────────────────
echo -e "${YELLOW}[4/4] Verifying mirror...${NC}"

AFTER=$(docker run --rm \
    -v $TARGET_VOLUME:/dst \
    alpine sh -c "find /dst -maxdepth 1 -type f | wc -l" 2>/dev/null || echo 0)

if [ "$AFTER" -eq "$PROD_COUNT" ]; then
    echo -e "${GREEN}  ✓ Perfect mirror: $AFTER / $PROD_COUNT files match${NC}"
else
    echo -e "${RED}  ⚠ Mismatch: prod=$PROD_COUNT uat=$AFTER — re-run if needed${NC}"
fi

SYNC_TIME=$(date '+%Y-%m-%d %H:%M:%S')

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}✓ Mirror Complete${NC}"
echo -e "${GREEN}==========================================${NC}"
echo "  Production:      $PROD_COUNT files"
echo "  UAT before:      $BEFORE files"
echo "  Copied in:       $COPIED files"
echo "  Removed orphans: $REMOVED files"
echo "  UAT now:         $AFTER files"
echo "  Synced at:       $SYNC_TIME"
echo "  Log:             $LOG_FILE"
echo ""
echo "Verify: curl http://localhost:$TARGET_PORT/health"
echo ""
