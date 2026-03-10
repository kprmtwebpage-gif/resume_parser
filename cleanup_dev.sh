#!/bin/bash
#############################################################################
# Dev Server Safe Cleanup Script
# Removes only safe-to-delete files
#############################################################################

PROJECT_DIR="/root/resume-parser"
BACKEND_DIR="$PROJECT_DIR/Resume_Parsing -Latest -Updated_UI/Backend"
FRONTEND_DIR="$PROJECT_DIR/Frontend"

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "=========================================="
echo "Dev Server Safe Cleanup"
echo "=========================================="
echo ""

# Backup log
CLEANUP_LOG="/tmp/cleanup_$(date +%Y%m%d_%H%M%S).log"
echo "Cleanup Log: $CLEANUP_LOG"
echo "" | tee "$CLEANUP_LOG"

FREED=0

# 1. Clean __pycache__
echo -e "${YELLOW}[1] Cleaning __pycache__ directories...${NC}"
COUNT=$(find "$BACKEND_DIR" -name "__pycache__" 2>/dev/null | wc -l)
if [ $COUNT -gt 0 ]; then
    find "$BACKEND_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
    echo "✓ Removed $COUNT __pycache__ directories" | tee -a "$CLEANUP_LOG"
else
    echo "  (none found)"
fi

# 2. Clean .pyc files
echo -e "${YELLOW}[2] Cleaning .pyc files...${NC}"
PYCOUNT=$(find "$BACKEND_DIR" -name "*.pyc" 2>/dev/null | wc -l)
if [ $PYCOUNT -gt 0 ]; then
    find "$BACKEND_DIR" -name "*.pyc" -delete 2>/dev/null
    echo "✓ Removed $PYCOUNT .pyc files" | tee -a "$CLEANUP_LOG"
else
    echo "  (none found)"
fi

# 3. Prune Docker
echo -e "${YELLOW}[3] Pruning Docker artifacts...${NC}"
DOCKER_FREED=$(docker system prune -af 2>/dev/null)
echo "✓ Docker pruned" | tee -a "$CLEANUP_LOG"
echo "$DOCKER_FREED" >> "$CLEANUP_LOG"

# 4. Optional: Clean old logs (older than 30 days)
echo ""
echo -e "${YELLOW}[4] Optional - Archive old logs? (older than 30 days)${NC}"
if [ -d "$PROJECT_DIR/logs" ]; then
    OLD_LOGS=$(find "$PROJECT_DIR/logs" -name "*.log" -mtime +30 2>/dev/null | wc -l)
    if [ $OLD_LOGS -gt 0 ]; then
        echo "  Found $OLD_LOGS old log files"
        read -p "  Archive them? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            mkdir -p "$PROJECT_DIR/logs/archive"
            find "$PROJECT_DIR/logs" -name "*.log" -mtime +30 -exec mv {} "$PROJECT_DIR/logs/archive/" \;
            echo "✓ Archived old logs to logs/archive/" | tee -a "$CLEANUP_LOG"
        fi
    fi
fi

echo ""
echo "=========================================="
echo "Cleanup Summary:"
echo "=========================================="
echo "Cleanup log saved to: $CLEANUP_LOG"
echo ""
echo "Safe cleanup actions completed:"
echo "  ✓ __pycache__ removed"
echo "  ✓ .pyc files removed"
echo "  ✓ Docker artifacts pruned"
echo ""
echo "Next run will regenerate these automatically."
echo ""
