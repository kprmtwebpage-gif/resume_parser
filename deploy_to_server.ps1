# deploy_to_server.ps1
# Run this script from the project root to package and deploy to the server.
# Usage:  .\deploy_to_server.ps1
#
# Requires: OpenSSH installed (Windows 10+), SSH access to 89.167.60.41

$SERVER    = "root@89.167.60.41"
$REMOTE    = "/opt/resume_parser"
$ARCHIVE   = "$env:TEMP\resume_parser.tar.gz"
$IMAGE_TAG = "resume_parser_dev"

Write-Host "=== Resume Parser – Deploy to $SERVER ===" -ForegroundColor Cyan

# 1. Create archive (exclude unnecessary dirs)
Write-Host "`n[1/4] Creating archive..." -ForegroundColor Yellow
tar --exclude='.venv' `
    --exclude='node_modules' `
    --exclude='__pycache__' `
    --exclude='*.pyc' `
    --exclude='.git' `
    --exclude='resumes_cache' `
    --exclude='error' `
    --exclude='parsed_resumes.csv' `
    -czf $ARCHIVE .

$sizeMB = [int]((Get-Item $ARCHIVE).Length / 1MB)
Write-Host "   Archive: $ARCHIVE  ($sizeMB MB)" -ForegroundColor Green

# 2. Upload archive
Write-Host "`n[2/4] Uploading to $SERVER..." -ForegroundColor Yellow
scp $ARCHIVE "${SERVER}:/root/resume_parser.tar.gz"
if ($LASTEXITCODE -ne 0) { Write-Host "scp failed" -ForegroundColor Red; exit 1 }

# 3. Extract on server
Write-Host "`n[3/4] Extracting on server..." -ForegroundColor Yellow
ssh $SERVER "mkdir -p $REMOTE && tar -xzf /root/resume_parser.tar.gz -C $REMOTE && rm /root/resume_parser.tar.gz"
if ($LASTEXITCODE -ne 0) { Write-Host "extraction failed" -ForegroundColor Red; exit 1 }

# 4. Build image + run container
Write-Host "`n[4/4] Building Docker image [$IMAGE_TAG] and starting container..." -ForegroundColor Yellow
ssh $SERVER @"
  set -e
  cd $REMOTE

  # Build and tag with _dev suffix
  docker build -t ${IMAGE_TAG} .

  # Start / recreate via docker-compose
  docker compose up -d --remove-orphans

  echo ''
  echo '=== Running containers ==='
  docker ps --filter name=resume_parser
"@
if ($LASTEXITCODE -ne 0) { Write-Host "Docker deploy failed" -ForegroundColor Red; exit 1 }

Write-Host "`n=== Deploy complete! ===" -ForegroundColor Cyan
Write-Host "  App:      http://89.167.60.41:8000/" -ForegroundColor Green
Write-Host "  API docs: http://89.167.60.41:8000/docs" -ForegroundColor Green
