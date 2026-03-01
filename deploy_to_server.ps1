# deploy_to_server.ps1
# Run this script from the project root to package and deploy to the server.
# Usage:
#   .\deploy_to_server.ps1            # Deploy DEV (default)
#   .\deploy_to_server.ps1 -Env dev   # Deploy DEV
#   .\deploy_to_server.ps1 -Env uat   # Deploy UAT
#   .\deploy_to_server.ps1 -Env prod  # Deploy PROD
#
# Requires: OpenSSH installed (Windows 10+), SSH access to 89.167.60.41

param(
    [ValidateSet('dev','uat','prod')]
    [string]$Env = 'dev'
)

$SERVER       = 'root@89.167.60.41'
$REMOTE       = '/opt/resume_parser'
$ARCHIVE      = Join-Path $env:TEMP 'resume_parser.tar.gz'

# Environment-specific settings
$PROJECT_NAME = 'resume-' + $Env
$ENV_FILE     = '.env.' + $Env
$COMPOSE_BASE = 'docker-compose.yml'
$COMPOSE_ENV  = 'docker-compose.' + $Env + '.yml'

Write-Host ''
Write-Host ('=== Resume Parser - Deploy [{0}] to {1} ===' -f $Env, $SERVER) -ForegroundColor Cyan
Write-Host ('  Project: {0}  |  Env file: {1}' -f $PROJECT_NAME, $ENV_FILE) -ForegroundColor DarkCyan

# ---------- 1. Create archive ----------
Write-Host ''
Write-Host '[1/4] Creating archive...' -ForegroundColor Yellow
tar --exclude='.venv' --exclude='node_modules' --exclude='__pycache__' --exclude='*.pyc' --exclude='.git' --exclude='resumes_cache' --exclude='error' --exclude='logs' --exclude='parsed_resumes.csv' --exclude='database_backups' -czf $ARCHIVE .

$archiveLen = (Get-Item $ARCHIVE).Length
$archiveMegs = [math]::Round($archiveLen / 1048576, 1)
Write-Host ('   Archive: {0}  ({1} megabytes)' -f $ARCHIVE, $archiveMegs) -ForegroundColor Green

# ---------- 2. Upload archive ----------
Write-Host ''
Write-Host ('[2/4] Uploading to {0}...' -f $SERVER) -ForegroundColor Yellow
scp $ARCHIVE ($SERVER + ':/root/resume_parser.tar.gz')
if ($LASTEXITCODE -ne 0) { Write-Host 'scp failed' -ForegroundColor Red; exit 1 }

# ---------- 3. Extract on server ----------
Write-Host ''
Write-Host '[3/4] Extracting on server...' -ForegroundColor Yellow
$extractCmd = 'mkdir -p {0} && tar -xzf /root/resume_parser.tar.gz -C {0} && rm /root/resume_parser.tar.gz' -f $REMOTE
ssh $SERVER $extractCmd
if ($LASTEXITCODE -ne 0) { Write-Host 'extraction failed' -ForegroundColor Red; exit 1 }

# ---------- 4. Docker compose build + up ----------
Write-Host ''
Write-Host ('[4/4] Building and starting [{0}] containers...' -f $Env) -ForegroundColor Yellow
$dockerCmd = @(
    'set -e'
    ('cd {0}' -f $REMOTE)
    ('docker compose -p {0} --env-file {1} -f {2} -f {3} up -d --build --remove-orphans' -f $PROJECT_NAME, $ENV_FILE, $COMPOSE_BASE, $COMPOSE_ENV)
    'echo === Running containers ==='
    'docker ps --filter name=resume'
) -join ' && '
ssh $SERVER $dockerCmd
if ($LASTEXITCODE -ne 0) { Write-Host 'Docker deploy failed' -ForegroundColor Red; exit 1 }

# ---------- Done ----------
$portMap = @{ 'dev' = '8002'; 'uat' = '8001'; 'prod' = '8000' }
$port = $portMap[$Env]

Write-Host ''
Write-Host ('=== Deploy [{0}] complete! ===' -f $Env) -ForegroundColor Cyan
Write-Host ('  App:      http://89.167.60.41:{0}/' -f $port) -ForegroundColor Green
Write-Host ('  API docs: http://89.167.60.41:{0}/docs' -f $port) -ForegroundColor Green
