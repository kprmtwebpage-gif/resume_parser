#!/bin/bash
#############################################################################
# Dev Server Cleanup Analyzer
# Scans for safe-to-delete files WITHOUT affecting running services
#############################################################################

echo "=========================================="
echo "Dev Server Cleanup Analysis"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to format bytes
format_size() {
    local size=$1
    if [ $size -gt 1073741824 ]; then
        echo "$(($size / 1073741824)) GB"
    elif [ $size -gt 1048576 ]; then
        echo "$(($size / 1048576)) MB"
    elif [ $size -gt 1024 ]; then
        echo "$(($size / 1024)) KB"
    else
        echo "$size B"
    fi
}

PROJECT_DIR="/root/resume-parser"
BACKEND_DIR="$PROJECT_DIR/Resume_Parsing -Latest -Updated_UI/Backend"

echo -e "${BLUE}[1] CRITICAL FILES (DO NOT DELETE)${NC}"
echo "=================================================="

# Check database volume
if [ -d "$PROJECT_DIR/postgres_data" ] 2>/dev/null; then
    db_size=$(du -sh "$PROJECT_DIR/postgres_data" 2>/dev/null | cut -f1)
    echo -e "${RED}✗ Database Data: $db_size${NC} → CONTAINS ALL PARSED RESUMES"
fi

# Check cache
if [ -d "$BACKEND_DIR/resumes_cache" ] 2>/dev/null; then
    cache_size=$(du -sh "$BACKEND_DIR/resumes_cache" 2>/dev/null | cut -f1)
    echo -e "${RED}✗ Resume Cache: $cache_size${NC} → USED BY RUNNING SERVICES"
fi

echo ""
echo -e "${GREEN}[2] SAFE TO DELETE (NO PERFORMANCE IMPACT)${NC}"
echo "=================================================="

# Check __pycache__
pycache_count=$(find "$BACKEND_DIR" -name "__pycache__" 2>/dev/null | wc -l)
if [ $pycache_count -gt 0 ]; then
    pycache_size=$(du -sh "$BACKEND_DIR" 2>/dev/null | grep -o "^[0-9]*" | head -1)
    echo -e "${GREEN}✓ __pycache__ directories: $pycache_count found${NC}"
    echo "  → Regenerated automatically on next Python run"
fi

# Check .pyc files
pyc_count=$(find "$BACKEND_DIR" -name "*.pyc" 2>/dev/null | wc -l)
if [ $pyc_count -gt 0 ]; then
    echo -e "${GREEN}✓ .pyc files: $pyc_count found${NC}"
    echo "  → Compiled Python cache, regenerated automatically"
fi

# Check node_modules
if [ -d "$PROJECT_DIR/Frontend/node_modules" ] 2>/dev/null; then
    npm_size=$(du -sh "$PROJECT_DIR/Frontend/node_modules" 2>/dev/null | cut -f1)
    echo -e "${GREEN}✓ Frontend node_modules: $npm_size${NC}"
    echo "  → Can rebuild with: npm install"
fi

# Check Docker unused
echo ""
echo -e "${GREEN}✓ Docker cleanup available:${NC}"
unused_images=$(docker images -q -f "dangling=true" 2>/dev/null | wc -l)
if [ $unused_images -gt 0 ]; then
    echo "  → Dangling images: $unused_images"
fi
unused_containers=$(docker ps -a -q -f "status=exited" 2>/dev/null | wc -l)
if [ $unused_containers -gt 0 ]; then
    echo "  → Stopped containers: $unused_containers"
fi

echo ""
echo -e "${YELLOW}[3] OPTIONAL (Can clean if not debugging)${NC}"
echo "=================================================="

# Check logs size
if [ -d "$PROJECT_DIR/logs" ] 2>/dev/null; then
    logs_size=$(du -sh "$PROJECT_DIR/logs" 2>/dev/null | cut -f1)
    logs_count=$(find "$PROJECT_DIR/logs" -type f 2>/dev/null | wc -l)
    echo -e "${YELLOW}? Logs directory: $logs_size ($logs_count files)${NC}"
    echo "  → Keep for debugging, but can archive old logs"
fi

# Check resumes folder
if [ -d "$BACKEND_DIR/resumes" ] 2>/dev/null; then
    resumes_size=$(du -sh "$BACKEND_DIR/resumes" 2>/dev/null | cut -f1)
    echo -e "${YELLOW}? Uploaded resumes: $resumes_size${NC}"
    echo "  → Only delete if you have backups elsewhere"
fi

echo ""
echo "=========================================="
echo "RECOMMENDATION"
echo "=========================================="
echo ""
echo "Safe immediate cleanup:"
echo "  1. Remove __pycache__ → Free up ~100-500MB"
echo "  2. Clean Docker images → Free up 1-5GB"
echo "  3. Remove .pyc files"
echo ""
echo "If disk space critical:"
echo "  4. Archive old logs (keep last 30 days)"
echo "  5. Rebuild node_modules (only if needed)"
echo ""
